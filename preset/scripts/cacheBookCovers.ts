import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Book } from '../../src/data/books.ts'

interface DoubanSuggestion {
  author?: string[]
  author_name?: string
  id?: string
  img?: string
  pic?: string
  url?: string
  title?: string
}

interface BookFile {
  book: Book
  fileUrl: URL
}

interface CacheBookCoverOptions {
  coverDir?: URL
  fetcher?: typeof fetch
}

export interface BookCoverCacheResult {
  status: 'cached' | 'linked' | 'not-found' | 'unchanged'
  message: string
  cover?: string
  link?: string
}

const booksDir = new URL('../../src/content/books/', import.meta.url)
const defaultCoverDir = new URL('../../public/images/books/', import.meta.url)
const doubanSubjectPattern = /book\.douban\.com\/subject\/(\d+)/
const requestTimeoutMs = 12_000

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function getDoubanSubjectId(link: string) {
  return link.match(doubanSubjectPattern)?.[1]
}

function getImageExtension(url: string) {
  const pathname = new URL(url).pathname
  const ext = extname(pathname).toLowerCase()
  if (['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext)) return ext
  return '.jpg'
}

function extractCoverUrl(html: string) {
  const metaPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
  ]

  for (const pattern of metaPatterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1].replace(/&amp;/g, '&')
  }

  const imageMatch = html.match(/<a[^>]+class=["']nbg["'][\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
  return imageMatch?.[1]?.replace(/&amp;/g, '&')
}

function requestOptions(extraHeaders: Record<string, string> = {}) {
  return {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
      ...extraHeaders
    },
    signal: AbortSignal.timeout(requestTimeoutMs)
  }
}

async function fetchText(url: string, fetcher: typeof fetch) {
  const response = await fetcher(url, requestOptions())
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  return response.text()
}

async function downloadFile(
  url: string,
  filename: string,
  targetCoverDir: URL,
  fetcher: typeof fetch
) {
  const response = await fetcher(
    url,
    requestOptions({
      Referer: 'https://book.douban.com/'
    })
  )
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  await mkdir(targetCoverDir, { recursive: true })
  await writeFile(new URL(filename, targetCoverDir), buffer)
}

async function fetchJson<T>(url: string, fetcher: typeof fetch) {
  const response = await fetcher(
    url,
    requestOptions({
      Referer: 'https://book.douban.com/'
    })
  )
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  return (await response.json()) as T
}

async function localCoverExists(cover: string | undefined, targetCoverDir: URL) {
  if (!cover?.startsWith('/images/books/')) return false
  try {
    await access(new URL(basename(cover), targetCoverDir))
    return true
  } catch {
    return false
  }
}

async function resolveDoubanLink(title: string, author: string, fetcher: typeof fetch) {
  const fetchSuggestions = (query: string) =>
    fetchJson<DoubanSuggestion[]>(
      `https://book.douban.com/j/subject_suggest?q=${encodeURIComponent(query)}`,
      fetcher
    )

  let suggestions = await fetchSuggestions(`${title} ${author}`)
  if (!suggestions.length) suggestions = await fetchSuggestions(title)

  const exactMatch =
    suggestions.find(
      (item) =>
        item.title === title &&
        (item.author?.some((name) => author.includes(name) || name.includes(author)) ||
          item.author_name?.includes(author) ||
          author.includes(item.author_name || ''))
    ) || suggestions.find((item) => item.title === title)

  const candidate = exactMatch || suggestions[0]
  if (!candidate?.id) return null

  return {
    coverUrl: candidate.img || candidate.pic,
    link: candidate.url || `https://book.douban.com/subject/${candidate.id}/`,
    subjectId: candidate.id
  }
}

async function readBookFiles(): Promise<BookFile[]> {
  const filenames = (await readdir(booksDir))
    .filter((filename) => filename.endsWith('.json'))
    .sort()
  return Promise.all(
    filenames.map(async (filename) => {
      const fileUrl = new URL(filename, booksDir)
      const book = JSON.parse(await readFile(fileUrl, 'utf8')) as Book
      return { book, fileUrl }
    })
  )
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== '')
  )
}

function orderBookFields(book: Book) {
  return compactRecord({
    title: book.title,
    author: book.author,
    status: book.status,
    cover: book.cover,
    finishedDate: book.finishedDate,
    wordCount: book.wordCount,
    sortOrder: book.sortOrder,
    rating: book.rating,
    tags: book.tags,
    note: book.note,
    link: book.link,
    recommended: book.recommended
  })
}

async function writeBookFile(fileUrl: URL, book: Book) {
  await writeFile(fileUrl, `${JSON.stringify(orderBookFields(book), null, 2)}\n`)
}

export async function cacheBookCoverForFile(
  fileUrl: URL,
  options: CacheBookCoverOptions = {}
): Promise<BookCoverCacheResult> {
  const targetCoverDir = options.coverDir || defaultCoverDir
  const fetcher = options.fetcher || fetch
  const book = JSON.parse(await readFile(fileUrl, 'utf8')) as Book
  let changed = false
  let linkAdded = false
  let lookupLink = book.link
  let subjectId = lookupLink ? getDoubanSubjectId(lookupLink) : undefined
  let suggestionCoverUrl: string | undefined

  if (!subjectId) {
    const resolvedBook = await resolveDoubanLink(book.title, book.author, fetcher)
    if (!resolvedBook) {
      return {
        status: 'not-found',
        message: '未找到匹配的豆瓣条目。',
        link: book.link
      }
    }

    lookupLink = resolvedBook.link
    subjectId = resolvedBook.subjectId
    suggestionCoverUrl = resolvedBook.coverUrl

    if (!book.link) {
      book.link = resolvedBook.link
      changed = true
      linkAdded = true
    }
  }

  if (!lookupLink || !subjectId) {
    if (changed) await writeBookFile(fileUrl, book)
    return {
      status: 'not-found',
      message: '未找到可用的豆瓣链接。',
      link: book.link
    }
  }

  if (await localCoverExists(book.cover, targetCoverDir)) {
    if (changed) await writeBookFile(fileUrl, book)
    return {
      status: changed ? 'linked' : 'unchanged',
      message: changed ? '已补充豆瓣链接，本地封面保持不变。' : '已有本地封面，无需获取。',
      cover: book.cover,
      link: book.link
    }
  }

  try {
    const coverUrl = suggestionCoverUrl || extractCoverUrl(await fetchText(lookupLink, fetcher))
    if (!coverUrl) {
      if (changed) await writeBookFile(fileUrl, book)
      return {
        status: linkAdded ? 'linked' : 'not-found',
        message: linkAdded
          ? '已补充豆瓣链接，但没有找到可用封面。'
          : '豆瓣页面中没有找到可用封面。',
        link: book.link
      }
    }

    const extension = getImageExtension(coverUrl)
    const filename = `${subjectId}-${slugify(book.title)}${extension}`
    const coverPath = `/images/books/${filename}`

    await downloadFile(coverUrl, filename, targetCoverDir, fetcher)
    book.cover = coverPath
    changed = true
    await writeBookFile(fileUrl, book)

    return {
      status: 'cached',
      message: linkAdded ? '已补充豆瓣链接并保存封面。' : '豆瓣封面已保存。',
      cover: coverPath,
      link: book.link
    }
  } catch (error) {
    if (changed) await writeBookFile(fileUrl, book)
    throw error
  }
}

async function main() {
  const bookFiles = await readBookFiles()
  let failed = false

  for (const { book, fileUrl } of bookFiles) {
    try {
      const result = await cacheBookCoverForFile(fileUrl)
      console.log(`${book.title}: ${result.message}`)
    } catch (error) {
      failed = true
      console.error(`${book.title}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (failed) process.exitCode = 1
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
