import { access, readFile, readdir } from 'node:fs/promises'
import { extname } from 'node:path'

import { statusLabels, type Book } from '../../src/data/books.ts'

const booksDir = new URL('../../src/content/books/', import.meta.url)
const supportedCoverExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const supportedStatuses = new Set(Object.keys(statusLabels))

interface BookFile {
  book: Book
  filename: string
}

async function localCoverExists(cover: string) {
  try {
    await access(new URL(`../../public${cover}`, import.meta.url))
    return true
  } catch {
    return false
  }
}

function isValidDateString(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false

  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date
}

function report(list: string[], label: string) {
  if (!list.length) return
  console.log(`\n${label}:`)
  for (const item of list) console.log(`- ${item}`)
}

async function readBookFiles(errors: string[]): Promise<BookFile[]> {
  const filenames = (await readdir(booksDir)).filter((filename) => filename.endsWith('.json')).sort()
  const files: BookFile[] = []

  for (const filename of filenames) {
    try {
      const book = JSON.parse(await readFile(new URL(filename, booksDir), 'utf8')) as Book
      files.push({ book, filename })
    } catch (error) {
      errors.push(`${filename}: invalid JSON. ${error instanceof Error ? error.message : ''}`)
    }
  }

  return files
}

async function main() {
  const errors: string[] = []
  const warnings: string[] = []
  const identities = new Set<string>()
  const bookFiles = await readBookFiles(errors)

  for (const { book, filename } of bookFiles) {
    const label = book.title || filename
    const identity = `${book.title}::${book.author}`

    if (!book.title?.trim()) errors.push(`${filename}: book title is required.`)
    if (!book.author?.trim()) errors.push(`${label}: author is required.`)

    if (identities.has(identity)) {
      errors.push(`${label}: duplicate title and author.`)
    }
    identities.add(identity)

    if (!supportedStatuses.has(book.status)) {
      errors.push(`${label}: unsupported status "${book.status}".`)
    }

    if (book.status === 'read' && !book.finishedDate) {
      warnings.push(`${label}: read books should include finishedDate.`)
    }

    if (book.finishedDate && !isValidDateString(book.finishedDate)) {
      errors.push(`${label}: finishedDate must use YYYY-MM-DD and be a valid date.`)
    }

    if (
      book.wordCount !== undefined &&
      (!Number.isSafeInteger(book.wordCount) || book.wordCount <= 0)
    ) {
      errors.push(`${label}: wordCount must be a positive integer.`)
    }

    if (
      book.sortOrder !== undefined &&
      (!Number.isSafeInteger(book.sortOrder) || book.sortOrder < 0)
    ) {
      errors.push(`${label}: sortOrder must be a non-negative integer.`)
    }

    if (book.rating !== undefined && (book.rating < 1 || book.rating > 5)) {
      errors.push(`${label}: rating must be between 1 and 5.`)
    }

    if (book.link) {
      try {
        new URL(book.link)
      } catch {
        errors.push(`${label}: link must be a valid absolute URL.`)
      }
    }

    if (!book.cover) {
      warnings.push(`${label}: cover is missing.`)
      continue
    }

    if (!book.cover.startsWith('/images/books/')) {
      errors.push(`${label}: cover must start with /images/books/.`)
    }

    const ext = extname(book.cover).toLowerCase()
    if (!supportedCoverExtensions.has(ext)) {
      errors.push(`${label}: cover extension must be jpg, jpeg, png, webp, or avif.`)
    }

    if (!(await localCoverExists(book.cover))) {
      errors.push(`${label}: cover file does not exist at public${book.cover}.`)
    }
  }

  report(warnings, 'Warnings')
  report(errors, 'Errors')

  if (errors.length) {
    process.exitCode = 1
    return
  }

  console.log(`Validated ${bookFiles.length} book${bookFiles.length === 1 ? '' : 's'}.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
