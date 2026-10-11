import { access, mkdir, writeFile } from 'node:fs/promises'

import type { Book } from '../../src/data/books.ts'

const booksDir = new URL('../../src/content/books/', import.meta.url)

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function fileExists(fileUrl: URL) {
  try {
    await access(fileUrl)
    return true
  } catch {
    return false
  }
}

async function resolveAvailableFilename(baseSlug: string) {
  let filename = `${baseSlug}.json`
  let counter = 2

  while (await fileExists(new URL(filename, booksDir))) {
    filename = `${baseSlug}-${counter}.json`
    counter += 1
  }

  return filename
}

function parseArgs() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const title = args.filter((arg) => arg !== '--dry-run').join(' ').trim()

  return { dryRun, title }
}

function createBookTemplate(title: string): Book {
  return {
    title,
    author: '',
    status: 'planned',
    tags: [],
    note: '',
    recommended: false
  }
}

function printUsage() {
  console.log('Usage: bun run new:book -- "书名"')
  console.log('Preview: bun run new:book -- --dry-run "书名"')
}

async function main() {
  const { dryRun, title } = parseArgs()

  if (!title) {
    printUsage()
    process.exitCode = 1
    return
  }

  const baseSlug = slugify(title) || `book-${Date.now()}`
  const filename = await resolveAvailableFilename(baseSlug)
  const fileUrl = new URL(filename, booksDir)
  const content = `${JSON.stringify(createBookTemplate(title), null, 2)}\n`

  if (dryRun) {
    console.log(`Would create: src/content/books/${filename}`)
    console.log(content)
    return
  }

  await mkdir(booksDir, { recursive: true })
  await writeFile(fileUrl, content, { flag: 'wx' })
  console.log(`Created: src/content/books/${filename}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
