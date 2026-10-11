# Books / Spirits 数据维护 SOP

适用项目：`/Users/centrix/Blog/blog-astro`
更新日期：2026-06-13

本文档用于维护博客中的两类收藏页：

- `Books`：在读、计划阅读、已读完书籍
- `Spirits`：品饮过的酒类

所有命令默认在项目根目录运行。

```bash
cd /Users/centrix/Blog/blog-astro
```

## 1. 快速规则

| 页面    | 数据目录                     | 图片目录                 | 校验命令                   |
| ------- | ---------------------------- | ------------------------ | -------------------------- |
| Books   | `src/content/books/*.json`   | `public/images/books/`   | `bun run validate:books`   |
| Spirits | `src/content/spirits/*.json` | `public/images/spirits/` | `bun run validate:spirits` |

通用流程：

1. 在对应 `src/content/.../` 目录中新建或修改一个 JSON 文件。
2. 如需封面图，将图片放到对应的 `public/images/...` 目录。
3. 在 JSON 记录中填写图片路径。
4. 运行对应校验命令。
5. 发布前运行 `bun run check`，必要时运行 `bun run build`。

说明：`src/data/books.ts` 和 `src/data/spirits.ts` 现在只保存类型和页面 label，不再保存具体记录。

## 2. Books 页面 SOP

Books 数据位于：

```text
src/content/books/*.json
```

当前支持三种状态：

```ts
type BookStatus = 'read' | 'reading' | 'planned'
```

### 2.1 使用本地可视化工具添加书籍（推荐）

在 Mac 终端中运行：

```bash
bun run manage:books
```

命令会自动在浏览器中打开本地书籍录入工具。填写表单并提交后，工具会：

1. 检查书名、作者、状态、日期、字数、评分和链接格式。
2. 拒绝添加书名与作者均相同的重复记录。
3. 将记录写入 `src/content/books/*.json`。
4. 如选择了本地封面，将图片复制到 `public/images/books/` 并自动填写 `cover`。
5. 默认尝试根据豆瓣链接，或书名与作者，自动补充豆瓣链接并缓存封面。

“自动获取豆瓣封面”开关默认开启。选择本地封面时不会访问豆瓣；自动获取失败也不会撤销已经保存的书籍记录，界面会提示稍后重试。此时可以再次使用批量命令：

```bash
bun run cache:book-covers
```

工具仅监听 `127.0.0.1`，不能从局域网或公网访问。使用完毕后，在终端按 `Control-C` 停止。

保存后建议运行：

```bash
bun run validate:books
```

以下手动流程仍然保留，适合批量修改或调整已有记录。

页面行为：

- `Reading Shelf` 展示全部书籍。
- 排序顺序为：`reading` → `planned` → `read`。
- 已读书籍会按 `finishedDate` 倒序排列。
- 同一状态且没有日期可比较时，会按 `sortOrder` 从小到大排列。
- `Reading Archive` 根据 `finishedDate` 按年份归档。
- 顶部 `累计字数` 只统计状态为 `read` 且填写了 `wordCount` 的书籍。

### 2.2 添加计划阅读书籍

适用状态：`planned`

推荐方式：用脚本生成空白模板。

```bash
bun run new:book -- "示例书名"
```

脚本会在 `src/content/books/` 下生成一个新的 JSON 文件。
如需先预览文件名和内容，不实际写入：

```bash
bun run new:book -- --dry-run "示例书名"
```

步骤：

1. 运行 `bun run new:book -- "书名"`，或在 `src/content/books/` 中手动新建一个 `.json` 文件。
2. 如果手动新建，文件名建议使用英文 slug，例如 `possible-art.json`。
3. 必填字段：
   - `title`
   - `author`
   - `status`
4. 可选字段：
   - `cover`
   - `wordCount`
   - `sortOrder`
   - `tags`
   - `note`
   - `link`
   - `recommended`
5. 通常不填写：
   - `finishedDate`
   - `rating`

示例：

```json
{
  "title": "示例书名",
  "author": "作者",
  "status": "planned",
  "sortOrder": 10,
  "tags": ["历史", "社科"],
  "note": "计划阅读。",
  "link": "https://book.douban.com/subject/xxx/"
}
```

完成后运行：

```bash
bun run validate:books
```

### 2.3 添加正在阅读书籍

适用状态：`reading`

步骤：

1. 在 `src/content/books/` 中新建一个 `.json` 文件，或修改已有书籍 JSON。
2. 将 `status` 填为 `reading`。
3. 可选填写当前阅读状态到 `note`，例如：
   - `读至第二章。`
   - `准备后续整理读书笔记。`
4. 如果已经确认当前版本字数，可以填写 `wordCount`。
5. 如果有多本在读书籍，可用 `sortOrder` 控制展示顺序。
6. 不填写 `finishedDate`，直到读完后再改为 `read`。

示例：

```json
{
  "title": "示例书名",
  "author": "作者",
  "status": "reading",
  "cover": "/images/books/example-book.jpg",
  "wordCount": 320000,
  "sortOrder": 10,
  "tags": ["政治学", "读书笔记"],
  "note": "正在阅读。",
  "link": "https://book.douban.com/subject/xxx/",
  "recommended": true
}
```

完成后运行：

```bash
bun run validate:books
```

### 2.4 标记已读完书籍

适用状态：`read`

步骤：

1. 打开目标书籍的 JSON 文件。
2. 将 `status` 改为 `read`。
3. 填写 `finishedDate`，格式必须为 `YYYY-MM-DD`。
4. 根据需要填写：
   - `rating`
   - `wordCount`
   - `tags`
   - `note`
   - `recommended`
5. 确认 `cover` 指向本地存在的图片文件。

示例：

```json
{
  "title": "可能性的艺术",
  "author": "刘瑜",
  "status": "read",
  "cover": "/images/books/35819419-可能性的艺术.jpg",
  "finishedDate": "2026-06-06",
  "wordCount": 260000,
  "rating": 4,
  "tags": ["政治学", "社科", "读书笔记"],
  "note": "一条简短读书记录。",
  "link": "https://book.douban.com/subject/35819419/",
  "recommended": true
}
```

完成后运行：

```bash
bun run validate:books
```

### 2.5 Books 封面处理

优先方式：使用豆瓣链接自动缓存封面。

适用场景：

- 新书已有豆瓣链接。
- 新书没有 `link`，但标题和作者足够明确，脚本可以尝试自动匹配豆瓣。

命令：

```bash
bun run cache:book-covers
```

脚本行为：

- 读取 `src/content/books/*.json`。
- 如果缺少豆瓣链接，会尝试通过标题和作者查找豆瓣条目。
- 如果找到豆瓣条目，会写入当前书籍 JSON 的 `link`。
- 如果本地没有封面，会下载封面到 `public/images/books/`。
- 会回写当前书籍 JSON 的 `cover` 字段。

手动方式：

1. 将封面图保存到：

   ```text
   public/images/books/
   ```

2. 在 JSON 中填写：

   ```json
   "cover": "/images/books/example-book.jpg"
   ```

3. 运行：

   ```bash
   bun run validate:books
   ```

注意：`cache:book-covers` 需要访问外网，可能受网络环境影响。失败时使用手动方式即可。

### 2.6 Books 字段速查

| 字段           | 是否必填     | 说明                                    |
| -------------- | ------------ | --------------------------------------- |
| `title`        | 是           | 书名                                    |
| `author`       | 是           | 作者                                    |
| `status`       | 是           | `read` / `reading` / `planned`          |
| `cover`        | 否           | 本地封面路径，建议位于 `/images/books/` |
| `finishedDate` | 已读建议填写 | 读完日期，格式 `YYYY-MM-DD`             |
| `wordCount`    | 否           | 当前版本字数，填写正整数；未知时省略    |
| `sortOrder`    | 否           | 同状态下的手动排序值，数字越小越靠前    |
| `rating`       | 否           | 1-5 分，建议读完后填写                  |
| `tags`         | 否           | 主题标签                                |
| `note`         | 否           | 简短记录或读书笔记摘要                  |
| `link`         | 否           | 豆瓣、微信读书、Goodreads 或官网链接    |
| `recommended`  | 否           | 是否显示推荐标记                        |

## 3. Spirits 页面 SOP

Spirits 数据位于：

```text
src/content/spirits/*.json
```

当前支持的酒类类型：

```ts
type SpiritKind =
  | 'whisky'
  | 'brandy'
  | 'rum'
  | 'gin'
  | 'vodka'
  | 'tequila'
  | 'baijiu'
  | 'liqueur'
  | 'other'
```

页面行为：

- `Spirits Cabinet` 直接展示全部酒类记录。
- 可用 `sortOrder` 控制展示顺序。
- 不记录品饮日期。
- 不记录品饮场所。
- 封面图采用手动维护方式。

### 3.1 添加品饮过的酒类

推荐方式：用脚本生成空白模板。

```bash
bun run new:spirit -- "Laphroaig 10 Year Old"
```

默认 `kind` 是 `whisky`。如需指定其它类型：

```bash
bun run new:spirit -- --kind rum "Diplomatico Reserva Exclusiva"
```

如需先预览文件名和内容，不实际写入：

```bash
bun run new:spirit -- --dry-run "Laphroaig 10 Year Old"
```

步骤：

1. 运行 `bun run new:spirit -- "酒名"`，或在 `src/content/spirits/` 中手动新建一个 `.json` 文件。
2. 如果手动新建，文件名建议使用英文 slug，例如 `laphroaig-10-year-old.json`。
3. 必填字段：
   - `name`
   - `kind`
4. 建议填写：
   - `producer`
   - `origin`
   - `vintage`
   - `rating`
   - `image`
   - `abv`
   - `sortOrder`
   - `tags`
   - `note`
   - `link`
   - `recommended`

示例：

```json
{
  "name": "Laphroaig 10 Year Old",
  "kind": "whisky",
  "producer": "Laphroaig",
  "origin": "Islay, Scotland",
  "vintage": "10 年",
  "rating": 4,
  "image": "/images/spirits/laphroaig-10-year-old.jpg",
  "abv": "40%",
  "sortOrder": 10,
  "tags": ["泥煤", "海风", "烟熏"],
  "note": "这里写一句简短品饮记录。",
  "link": "https://www.whiskybase.com/...",
  "recommended": true
}
```

完成后运行：

```bash
bun run validate:spirits
```

### 3.2 Spirits 封面处理

Spirits 不使用自动抓图脚本，统一手动维护。

步骤：

1. 找到合适的酒款图片。
2. 将图片保存到：

   ```text
   public/images/spirits/
   ```

3. 文件名建议使用酒名 slug，例如：

   ```text
   laphroaig-10-year-old.jpg
   ```

4. 在 JSON 中填写：

   ```json
   "image": "/images/spirits/laphroaig-10-year-old.jpg"
   ```

5. 运行：

   ```bash
   bun run validate:spirits
   ```

### 3.3 Spirits 外部链接

`link` 可填写：

- Whiskybase
- Distiller
- Wine-Searcher
- 酒厂官网
- 品牌官网

页面会根据域名显示来源名：

| 链接来源            | 页面显示        |
| ------------------- | --------------- |
| `whiskybase.com`    | `Whiskybase`    |
| `distiller.com`     | `Distiller`     |
| `wine-searcher.com` | `Wine-Searcher` |
| 其它合法 URL        | `Official Site` |

### 3.4 Spirits 字段速查

| 字段          | 是否必填 | 说明                                      |
| ------------- | -------- | ----------------------------------------- |
| `name`        | 是       | 酒款名称                                  |
| `kind`        | 是       | 酒类类型，必须使用预设枚举                |
| `producer`    | 否       | 酒厂或品牌                                |
| `origin`      | 否       | 产地                                      |
| `vintage`     | 否       | 年份、陈年或版本                          |
| `rating`      | 否       | 1-5 分                                    |
| `image`       | 否       | 本地图片路径，建议位于 `/images/spirits/` |
| `abv`         | 否       | 酒精度，例如 `40%`                        |
| `sortOrder`   | 否       | 手动排序值，数字越小越靠前                |
| `tags`        | 否       | 风味或印象标签                            |
| `note`        | 否       | 简短品饮记录                              |
| `link`        | 否       | 外部参考页面                              |
| `recommended` | 否       | 是否显示推荐标记                          |

## 4. 发布前检查清单

每次新增或修改 Books / Spirits 数据后，建议按顺序执行：

```bash
bun run validate:books
bun run validate:spirits
bun run check
```

如果涉及页面展示、路由、构建配置，额外运行：

```bash
bun run build
```

检查标准：

- `validate:books` 无 `Errors`。
- `validate:spirits` 无 `Errors`。
- `bun run check` 显示 `0 errors`。
- 本地预览 `/books` 和 `/spirits` 时：
  - 封面正常显示。
  - 弹窗可以打开。
  - 评分显示正常。
  - 外部链接来源名显示正常。
  - Books 的 `Reading Shelf` 和 `Reading Archive` 符合预期。
  - Spirits 的 `Spirits Cabinet` 全量展示符合预期。

## 5. 常见问题

### 5.1 Books 封面脚本失败怎么办？

使用手动方式：

1. 自行保存封面到 `public/images/books/`。
2. 手动填写 `cover`。
3. 运行 `bun run validate:books`。

### 5.2 已读书籍没有 `finishedDate` 可以吗？

可以构建，但不推荐。`validate:books` 会给出 warning。
如果希望出现在 `Reading Archive` 中，应填写 `finishedDate`。

### 5.3 书籍没有 `wordCount` 可以吗？

可以。`wordCount` 是可选字段，未知时省略即可。
顶部 `累计字数` 只会统计已经填写 `wordCount` 的已读书籍。

### 5.4 是否还需要编辑 `src/data/books.ts` 或 `src/data/spirits.ts`？

通常不需要。现在这两个文件只保存类型定义和 label。
新增、修改、删除具体记录时，只操作 `src/content/books/*.json` 和 `src/content/spirits/*.json`。

### 5.5 Spirits 是否需要记录日期？

当前不需要。页面设计为全量酒柜展示，不按年份或日期归档。

### 5.6 Spirits 是否可以自动抓 Whiskybase / Distiller 封面？

当前不做自动抓取。命令行抓取这些站点可能遇到 Cloudflare 或 403，稳定性不足，因此统一手动保存封面。

### 5.7 修改完成后是否一定要运行 `bun run build`？

只改数据时，至少运行对应 `validate` 命令和 `bun run check`。
如果准备发布，建议运行 `bun run build` 做最终确认。
