import { access, readFile, readdir } from 'node:fs/promises'
import { extname, posix } from 'node:path'

import { kindLabels, type Spirit } from '../../src/data/spirits.ts'

const spiritsDir = new URL('../../src/content/spirits/', import.meta.url)
const supportedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const supportedKinds = new Set(Object.keys(kindLabels))

interface SpiritFile {
  filename: string
  spirit: Spirit
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function localImageExists(image: string) {
  try {
    await access(new URL(`../../public${image}`, import.meta.url))
    return true
  } catch {
    return false
  }
}

function report(list: string[], label: string) {
  if (!list.length) return
  console.log(`\n${label}:`)
  for (const item of list) console.log(`- ${item}`)
}

async function readSpiritFiles(errors: string[]): Promise<SpiritFile[]> {
  const filenames = (await readdir(spiritsDir)).filter((filename) => filename.endsWith('.json')).sort()
  const files: SpiritFile[] = []

  for (const filename of filenames) {
    try {
      const spirit = JSON.parse(await readFile(new URL(filename, spiritsDir), 'utf8')) as Spirit
      files.push({ filename, spirit })
    } catch (error) {
      errors.push(`${filename}: invalid JSON. ${error instanceof Error ? error.message : ''}`)
    }
  }

  return files
}

async function main() {
  const errors: string[] = []
  const warnings: string[] = []
  const names = new Set<string>()
  const spiritFiles = await readSpiritFiles(errors)

  for (const { filename, spirit } of spiritFiles) {
    const label = spirit.name || filename

    if (!spirit.name?.trim()) errors.push(`${filename}: spirit name is required.`)

    if (names.has(spirit.name)) {
      errors.push(`${label}: duplicate name. Use unique names so dialog ids and validation stay stable.`)
    }
    names.add(spirit.name)

    if (!supportedKinds.has(spirit.kind)) {
      errors.push(`${label}: unsupported kind "${spirit.kind}".`)
    }

    if (spirit.rating !== undefined && (spirit.rating < 1 || spirit.rating > 5)) {
      errors.push(`${label}: rating must be between 1 and 5.`)
    }

    if (
      spirit.sortOrder !== undefined &&
      (!Number.isSafeInteger(spirit.sortOrder) || spirit.sortOrder < 0)
    ) {
      errors.push(`${label}: sortOrder must be a non-negative integer.`)
    }

    if (spirit.link) {
      try {
        new URL(spirit.link)
      } catch {
        errors.push(`${label}: link must be a valid absolute URL.`)
      }
    }

    if (spirit.image) {
      if (!spirit.image.startsWith('/images/spirits/')) {
        errors.push(`${label}: image must start with /images/spirits/.`)
      }

      const ext = extname(spirit.image).toLowerCase()
      if (!supportedImageExtensions.has(ext)) {
        errors.push(`${label}: image extension must be jpg, jpeg, png, webp, or avif.`)
      }

      if (!(await localImageExists(spirit.image))) {
        errors.push(`${label}: image file does not exist at public${spirit.image}.`)
      }

      const expectedFilename = `${slugify(spirit.name)}${ext}`
      const actualFilename = posix.basename(spirit.image)
      if (actualFilename !== expectedFilename) {
        warnings.push(`${label}: suggested cover filename is ${expectedFilename}.`)
      }
    }
  }

  report(warnings, 'Warnings')
  report(errors, 'Errors')

  if (errors.length) {
    process.exitCode = 1
    return
  }

  console.log(`Validated ${spiritFiles.length} spirit${spiritFiles.length === 1 ? '' : 's'}.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
