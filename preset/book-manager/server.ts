import { access, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { Book, BookStatus } from '../../src/data/books.ts'
import { cacheBookCoverForFile, type BookCoverCacheResult } from '../scripts/cacheBookCovers.ts'

interface LocalBunServer {
  hostname: string
  port: number
}

declare const Bun: {
  file(path: string): Blob
  serve(options: {
    hostname: string
    port: number
    fetch(request: Request): Response | Promise<Response>
  }): LocalBunServer
  spawn(command: string[], options: { stdout: 'ignore'; stderr: 'ignore' }): { unref(): void }
}

const defaultRepoRoot = fileURLToPath(new URL('../../', import.meta.url))
const repoRoot = resolve(process.env.BOOK_MANAGER_ROOT || defaultRepoRoot)
const booksDir = join(repoRoot, 'src/content/books')
const coversDir = join(repoRoot, 'public/images/books')
const staticDir = fileURLToPath(new URL('./static/', import.meta.url))
const preferredPort = Number.parseInt(process.env.BOOK_MANAGER_PORT || '4322', 10)
const sessionToken = process.env.BOOK_MANAGER_TEST_TOKEN || crypto.randomUUID()
const supportedStatuses = new Set<BookStatus>(['read', 'reading', 'planned'])
const supportedCoverExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const maxCoverSize = 10 * 1024 * 1024

type BookCoverLookupResult =
  | BookCoverCacheResult
  | {
      status: 'failed'
      message: string
    }

class UserInputError extends Error {}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  })
}

function textField(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function parseOptionalInteger(
  form: FormData,
  key: string,
  label: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER
) {
  const raw = textField(form, key)
  if (!raw) return undefined

  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new UserInputError(`${label}必须是 ${minimum} 到 ${maximum} 之间的整数。`)
  }
  return value
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

function slugify(input: string) {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function normalizeIdentity(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN')
}

function parseTags(value: string) {
  const seen = new Set<string>()
  return value
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter((tag) => {
      if (!tag) return false
      const key = normalizeIdentity(tag)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

async function pathExists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function resolveAvailablePath(directory: string, basename: string, extension: string) {
  let counter = 1
  let filename = `${basename}${extension}`

  while (await pathExists(join(directory, filename))) {
    counter += 1
    filename = `${basename}-${counter}${extension}`
  }

  return { filename, path: join(directory, filename) }
}

async function readExistingBooks() {
  const filenames = (await readdir(booksDir)).filter((filename) => filename.endsWith('.json'))
  const books: Book[] = []

  for (const filename of filenames) {
    try {
      books.push(JSON.parse(await readFile(join(booksDir, filename), 'utf8')) as Book)
    } catch {
      // Existing validation reports malformed JSON; it should not prevent opening this helper.
    }
  }

  return books
}

async function assertNotDuplicate(title: string, author: string) {
  const identity = `${normalizeIdentity(title)}::${normalizeIdentity(author)}`
  const duplicate = (await readExistingBooks()).some(
    (book) =>
      `${normalizeIdentity(book.title || '')}::${normalizeIdentity(book.author || '')}` === identity
  )

  if (duplicate) throw new UserInputError('已有相同书名和作者的记录。')
}

function validateExternalLink(link: string) {
  if (!link) return undefined

  try {
    const url = new URL(link)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol')
    return url.toString()
  } catch {
    throw new UserInputError('外部链接必须是完整的 http 或 https 地址。')
  }
}

function coverExtension(file: File) {
  const extension = extname(file.name).toLowerCase()
  if (!supportedCoverExtensions.has(extension)) {
    throw new UserInputError('封面仅支持 JPG、PNG、WebP 或 AVIF 图片。')
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw new UserInputError('所选封面不是有效的图片文件。')
  }
  if (file.size > maxCoverSize) {
    throw new UserInputError('封面文件不能超过 10 MB。')
  }
  return extension === '.jpeg' ? '.jpg' : extension
}

async function saveBook(form: FormData) {
  const title = textField(form, 'title')
  const author = textField(form, 'author')
  const status = textField(form, 'status') as BookStatus
  const finishedDate = textField(form, 'finishedDate')
  const wordCount = parseOptionalInteger(form, 'wordCount', '字数', 1)
  const sortOrder = parseOptionalInteger(form, 'sortOrder', '排序值', 0)
  const rating = parseOptionalInteger(form, 'rating', '评分', 1, 5)
  const tags = parseTags(textField(form, 'tags'))
  const note = textField(form, 'note')
  const link = validateExternalLink(textField(form, 'link'))
  const recommended = textField(form, 'recommended') === 'true'
  const autoFetchCover = textField(form, 'autoFetchCover') === 'true'
  const cover = form.get('cover')

  if (!title) throw new UserInputError('请填写书名。')
  if (!author) throw new UserInputError('请填写作者。')
  if (!supportedStatuses.has(status)) throw new UserInputError('请选择有效的阅读状态。')
  if (status === 'read' && !finishedDate) throw new UserInputError('已读书籍需要填写读完日期。')
  if (finishedDate && !isValidDateString(finishedDate)) {
    throw new UserInputError('读完日期必须是有效的 YYYY-MM-DD 日期。')
  }

  await assertNotDuplicate(title, author)

  const baseSlug = slugify(title) || `book-${Date.now()}`
  const bookFile = await resolveAvailablePath(booksDir, baseSlug, '.json')
  let coverFile: { filename: string; path: string } | undefined

  if (cover instanceof File && cover.size > 0) {
    coverFile = await resolveAvailablePath(coversDir, baseSlug, coverExtension(cover))
    await writeFile(coverFile.path, Buffer.from(await cover.arrayBuffer()), { flag: 'wx' })
  }

  const book: Book = {
    title,
    author,
    status,
    ...(coverFile ? { cover: `/images/books/${coverFile.filename}` } : {}),
    ...(status === 'read' && finishedDate ? { finishedDate } : {}),
    ...(wordCount !== undefined ? { wordCount } : {}),
    ...(sortOrder !== undefined ? { sortOrder } : {}),
    ...(rating !== undefined ? { rating } : {}),
    tags,
    ...(note ? { note } : {}),
    ...(link ? { link } : {}),
    recommended
  }

  try {
    await writeFile(bookFile.path, `${JSON.stringify(book, null, 2)}\n`, { flag: 'wx' })
  } catch (error) {
    if (coverFile) await unlink(coverFile.path).catch(() => undefined)
    throw error
  }

  let coverLookup: BookCoverLookupResult | undefined
  if (autoFetchCover && !coverFile) {
    try {
      coverLookup = await cacheBookCoverForFile(pathToFileURL(bookFile.path), {
        coverDir: pathToFileURL(`${coversDir}/`)
      })
    } catch (error) {
      console.warn(`Failed to cache a Douban cover for ${title}:`, error)
      coverLookup = {
        status: 'failed',
        message: '书籍已保存，但豆瓣封面获取失败，可稍后重试。'
      }
    }
  }

  const savedBook = JSON.parse(await readFile(bookFile.path, 'utf8')) as Book

  return {
    book: savedBook,
    file: `src/content/books/${bookFile.filename}`,
    coverFile: coverFile ? `public/images/books/${coverFile.filename}` : undefined,
    coverLookup
  }
}

async function getStats() {
  const books = await readExistingBooks()
  return {
    total: books.length,
    read: books.filter((book) => book.status === 'read').length,
    reading: books.filter((book) => book.status === 'reading').length,
    planned: books.filter((book) => book.status === 'planned').length
  }
}

function hasValidSession(request: Request) {
  return request.headers.get('X-Book-Manager-Key') === sessionToken
}

const indexTemplate = await readFile(join(staticDir, 'index.html'), 'utf8')

async function handleRequest(request: Request) {
  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/') {
    return new Response(indexTemplate.replace('__BOOK_MANAGER_TOKEN__', sessionToken), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    })
  }

  if (request.method === 'GET' && url.pathname === '/styles.css') {
    return new Response(Bun.file(join(staticDir, 'styles.css')), {
      headers: { 'Content-Type': 'text/css; charset=utf-8' }
    })
  }

  if (request.method === 'GET' && url.pathname === '/app.js') {
    return new Response(Bun.file(join(staticDir, 'app.js')), {
      headers: { 'Content-Type': 'text/javascript; charset=utf-8' }
    })
  }

  if (request.method === 'GET' && url.pathname === '/api/stats') {
    return json(await getStats())
  }

  if (request.method === 'POST' && url.pathname === '/api/books') {
    if (!hasValidSession(request)) return json({ error: '当前会话无效，请刷新页面后重试。' }, 403)

    try {
      return json(await saveBook(await request.formData()), 201)
    } catch (error) {
      if (error instanceof UserInputError) return json({ error: error.message }, 400)
      console.error(error)
      return json({ error: '保存失败，请查看终端中的错误信息。' }, 500)
    }
  }

  return json({ error: 'Not found' }, 404)
}

await Promise.all([mkdir(booksDir, { recursive: true }), mkdir(coversDir, { recursive: true })])

let server: ReturnType<typeof Bun.serve> | undefined
for (let offset = 0; offset < 10; offset += 1) {
  try {
    server = Bun.serve({
      hostname: '127.0.0.1',
      port: preferredPort + offset,
      fetch: handleRequest
    })
    break
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : ''
    if (code !== 'EADDRINUSE') throw error
  }
}

if (!server) {
  throw new Error(
    `无法找到可用端口，请关闭占用 ${preferredPort}-${preferredPort + 9} 端口的程序后重试。`
  )
}

const appUrl = `http://${server.hostname}:${server.port}`
console.log(`Book Manager: ${appUrl}`)
console.log(`Writing to: ${repoRoot}`)
console.log('Press Ctrl+C to stop.')

if (!process.argv.includes('--no-open') && process.env.BOOK_MANAGER_NO_OPEN !== '1') {
  const opener = Bun.spawn(['open', appUrl], { stdout: 'ignore', stderr: 'ignore' })
  opener.unref()
}
