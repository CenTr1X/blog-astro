export type SpiritKind =
  | 'whisky'
  | 'brandy'
  | 'rum'
  | 'gin'
  | 'vodka'
  | 'tequila'
  | 'baijiu'
  | 'liqueur'
  | 'other'

export interface Spirit {
  name: string
  kind: SpiritKind
  producer?: string
  origin?: string
  vintage?: string
  rating?: number
  image?: string
  abv?: string
  sortOrder?: number
  tags?: string[]
  note?: string
  link?: string
  recommended?: boolean
}

export const kindLabels: Record<SpiritKind, string> = {
  whisky: '威士忌',
  brandy: '白兰地',
  rum: '朗姆',
  gin: '金酒',
  vodka: '伏特加',
  tequila: '龙舌兰',
  baijiu: '白酒',
  liqueur: '利口酒',
  other: '其它'
}

/**
 * Maintenance notes:
 * - Add one JSON file per spirit in src/content/spirits/.
 * - Put cover images in public/images/spirits/.
 * - Name covers with the slugified spirit name, for example laphroaig-10-year-old.jpg.
 * - Reference covers as /images/spirits/<filename>.
 * - link can point to Whiskybase, Distiller, Wine-Searcher, or an official product page.
 * - Run `bun run validate:spirits` before publishing changes.
 */
