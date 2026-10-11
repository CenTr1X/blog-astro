import { access, mkdir, writeFile } from 'node:fs/promises'

import { kindLabels, type Spirit, type SpiritKind } from '../../src/data/spirits.ts'

const spiritsDir = new URL('../../src/content/spirits/', import.meta.url)
const supportedKinds = new Set(Object.keys(kindLabels))

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

  while (await fileExists(new URL(filename, spiritsDir))) {
    filename = `${baseSlug}-${counter}.json`
    counter += 1
  }

  return filename
}

function parseArgs() {
  const args = process.argv.slice(2)
  const nameParts: string[] = []
  let dryRun = false
  let kind = 'whisky'

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    if (arg === '--kind') {
      kind = args[index + 1] || ''
      index += 1
      continue
    }

    nameParts.push(arg)
  }

  const name = nameParts.join(' ').trim()

  return { dryRun, kind, name }
}

function createSpiritTemplate(name: string, kind: SpiritKind): Spirit {
  return {
    name,
    kind,
    producer: '',
    origin: '',
    vintage: '',
    abv: '',
    tags: [],
    note: '',
    recommended: false
  }
}

function printUsage() {
  console.log('Usage: bun run new:spirit -- "酒名"')
  console.log('With kind: bun run new:spirit -- --kind rum "酒名"')
  console.log('Preview: bun run new:spirit -- --dry-run "酒名"')
  console.log(`Kinds: ${Object.keys(kindLabels).join(', ')}`)
}

async function main() {
  const { dryRun, kind, name } = parseArgs()

  if (!name) {
    printUsage()
    process.exitCode = 1
    return
  }

  if (!supportedKinds.has(kind)) {
    console.error(`Unsupported kind "${kind}". Supported kinds: ${Object.keys(kindLabels).join(', ')}`)
    process.exitCode = 1
    return
  }

  const baseSlug = slugify(name) || `spirit-${Date.now()}`
  const filename = await resolveAvailableFilename(baseSlug)
  const fileUrl = new URL(filename, spiritsDir)
  const content = `${JSON.stringify(createSpiritTemplate(name, kind as SpiritKind), null, 2)}\n`

  if (dryRun) {
    console.log(`Would create: src/content/spirits/${filename}`)
    console.log(content)
    return
  }

  await mkdir(spiritsDir, { recursive: true })
  await writeFile(fileUrl, content, { flag: 'wx' })
  console.log(`Created: src/content/spirits/${filename}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
