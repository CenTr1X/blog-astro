# 捕风集

个人博客，用于记录技术、安全与人文社科方向的随笔和读书笔记。

站点：<https://centrix.top/>

## 技术栈

- [Astro](https://astro.build/)
- [Astro Theme Pure](https://github.com/cworld1/astro-theme-pure)
- [Bun](https://bun.sh/)
- [Vercel](https://vercel.com/)
- [Waline](https://waline.js.org/)
- [Pagefind](https://pagefind.app/)

## 本地开发

安装依赖：

```sh
bun install
```

启动开发服务器：

```sh
bun dev
```

运行类型检查：

```sh
bun run check
```

构建站点：

```sh
bun run build
```

预览生产构建：

```sh
bun preview
```

## 内容

文章位于 `src/content/blog/`。内容集合要求文章 frontmatter 包含：

- `title`
- `description`
- `publishDate`

可选字段包括 `updatedDate`、`heroImage`、`tags`、`language`、`draft` 和 `comment`。

## 说明

本项目基于 Astro Theme Pure 改造，站点配置和项目说明已替换为当前博客的信息。
