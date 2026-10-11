import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

function removeDupsAndLowerCase(array: string[]) {
  if (!array.length) return array
  const lowercaseItems = array.map((str) => str.toLowerCase())
  const distinctItems = new Set(lowercaseItems)
  return Array.from(distinctItems)
}

// Define blog collection
const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Required
  schema: ({ image }) =>
    z.object({
      // Required
      title: z.string().max(60),
      description: z.string().max(160),
      publishDate: z.coerce.date(),
      // Optional
      updatedDate: z.coerce.date().optional(),
      heroImage: z
        .object({
          src: image(),
          alt: z.string().optional(),
          inferSize: z.boolean().optional(),
          width: z.number().optional(),
          height: z.number().optional(),

          color: z.string().optional()
        })
        .optional(),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      language: z.string().optional(),
      draft: z.boolean().default(false),
      // Special fields
      comment: z.boolean().default(true)
    })
})

const books = defineCollection({
  loader: glob({ base: './src/content/books', pattern: '**/*.json' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    status: z.enum(['read', 'reading', 'planned']),
    cover: z.string().optional(),
    finishedDate: z.string().optional(),
    wordCount: z.number().int().positive().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    rating: z.number().min(1).max(5).optional(),
    tags: z.array(z.string()).default([]),
    note: z.string().optional(),
    link: z.url().optional(),
    recommended: z.boolean().default(false)
  })
})

const spirits = defineCollection({
  loader: glob({ base: './src/content/spirits', pattern: '**/*.json' }),
  schema: z.object({
    name: z.string(),
    kind: z.enum(['whisky', 'brandy', 'rum', 'gin', 'vodka', 'tequila', 'baijiu', 'liqueur', 'other']),
    producer: z.string().optional(),
    origin: z.string().optional(),
    vintage: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
    image: z.string().optional(),
    abv: z.string().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    tags: z.array(z.string()).default([]),
    note: z.string().optional(),
    link: z.url().optional(),
    recommended: z.boolean().default(false)
  })
})

export const collections = { blog, books, spirits }
