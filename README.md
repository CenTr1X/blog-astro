# Bufengji

Personal blog for technical notes, security research, essays, and reading notes across the humanities and social sciences.

Site: <https://centrix.top/>

## Stack

- [Astro](https://astro.build/)
- [Astro Theme Pure](https://github.com/cworld1/astro-theme-pure)
- [Bun](https://bun.sh/)
- [Vercel](https://vercel.com/)
- [Waline](https://waline.js.org/)
- [Pagefind](https://pagefind.app/)

## Development

Install dependencies:

```sh
bun install
```

Start the dev server:

```sh
bun dev
```

Run type checks:

```sh
bun run check
```

Build the site:

```sh
bun run build
```

Preview the production build:

```sh
bun preview
```

## Content

Blog posts live in `src/content/blog/`. The collection schema requires:

- `title`
- `description`
- `publishDate`

Optional frontmatter fields include `updatedDate`, `heroImage`, `tags`, `language`, `draft`, and `comment`.

## Notes

This project is adapted from Astro Theme Pure. Template-specific metadata has been replaced with site-specific configuration where possible.
