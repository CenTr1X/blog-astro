export type BookStatus = 'read' | 'reading' | 'planned'

export interface Book {
  title: string
  author: string
  status: BookStatus
  cover?: string
  finishedDate?: string
  wordCount?: number
  sortOrder?: number
  rating?: number
  tags?: string[]
  note?: string
  link?: string
  recommended?: boolean
}

export const statusLabels: Record<BookStatus, string> = {
  read: '已读',
  reading: '在读',
  planned: '想读'
}

/**
 * Maintenance notes:
 * - Run `bun run manage:books` to add a book through the local Mac helper.
 * - Add one JSON file per book in src/content/books/.
 * - Run `bun run cache:book-covers` after adding a Douban link or a book without a link/cover.
 * - Put manual cover images in public/images/books/.
 * - Reference covers as /images/books/<filename>.
 * - Read books should include finishedDate in YYYY-MM-DD format.
 * - wordCount is optional; omit it when the edition's word count is unknown.
 * - Run `bun run validate:books` before publishing changes.
 */
