import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
// @ts-expect-error Bun provides this test module at runtime without project-level Bun types.
import { expect, test } from 'bun:test'

import type { Book } from '../../src/data/books.ts'
import { cacheBookCoverForFile } from '../scripts/cacheBookCovers.ts'

test('resolves a Douban entry and caches its cover without replacing another external link', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'book-cover-cache-'))
  const coverPath = join(testRoot, 'covers')
  const bookPath = join(testRoot, 'book.json')
  const originalBook: Book = {
    title: '测试书籍',
    author: '测试作者',
    status: 'planned',
    tags: [],
    link: 'https://weread.qq.com/example',
    recommended: false
  }

  await mkdir(coverPath, { recursive: true })
  await writeFile(bookPath, `${JSON.stringify(originalBook, null, 2)}\n`)

  const mockFetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith('https://book.douban.com/j/subject_suggest')) {
      return Response.json([
        {
          title: '测试书籍',
          author: ['测试作者'],
          id: '123456',
          url: 'https://book.douban.com/subject/123456/',
          img: 'https://img.example.com/cover.jpg'
        }
      ])
    }
    if (url === 'https://img.example.com/cover.jpg') {
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))
    }
    throw new Error(`Unexpected request: ${url}`)
  }) as typeof fetch

  try {
    const result = await cacheBookCoverForFile(pathToFileURL(bookPath), {
      coverDir: pathToFileURL(`${coverPath}/`),
      fetcher: mockFetch
    })
    const savedBook = JSON.parse(await readFile(bookPath, 'utf8')) as Book
    const savedCover = await readFile(join(coverPath, '123456-测试书籍.jpg'))

    expect(result.status).toBe('cached')
    expect(savedBook.link).toBe(originalBook.link)
    expect(savedBook.cover).toBe('/images/books/123456-测试书籍.jpg')
    expect(savedCover).toEqual(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
  } finally {
    await rm(testRoot, { recursive: true, force: true })
  }
})

test('reports a missing Douban match without changing the book record', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'book-cover-cache-'))
  const coverPath = join(testRoot, 'covers')
  const bookPath = join(testRoot, 'book.json')
  const originalBook: Book = {
    title: '没有匹配的书',
    author: '测试作者',
    status: 'planned',
    tags: [],
    recommended: false
  }

  await mkdir(coverPath, { recursive: true })
  await writeFile(bookPath, `${JSON.stringify(originalBook, null, 2)}\n`)

  const mockFetch = (async () => Response.json([])) as typeof fetch

  try {
    const result = await cacheBookCoverForFile(pathToFileURL(bookPath), {
      coverDir: pathToFileURL(`${coverPath}/`),
      fetcher: mockFetch
    })
    const savedBook = JSON.parse(await readFile(bookPath, 'utf8')) as Book

    expect(result.status).toBe('not-found')
    expect(savedBook).toEqual(originalBook)
  } finally {
    await rm(testRoot, { recursive: true, force: true })
  }
})
