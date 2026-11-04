# Hugo 博客审计 — 共享上下文（Lead 已核实的事实）

站点：/root/blog ，baseURL https://grer.cn ，中文单语言博客，主题 PaperMod，部署到 GitHub Pages（iguri/iguri.github.io 的 gh-pages 分支）。
今天：2026-11-04。审计目标：多年未更新的配置/文件结构是否仍适配新版 Hugo，并给出优化方向。

## 环境与构建现状（已实测）
- 本机 Hugo：v0.169.0+extended (2026-10-27)。CI 用 `peaceiris/actions-hugo@v3` + `hugo-version: latest`。
- `hugo --gc --minify -d /tmp/hugo-out` **构建成功**：313 pages / 8 paginator pages / 113 non-page files / 52 static / 0 processed images / 114 aliases / 463ms。
- 构建仅 2 条 deprecation 警告，来自主题模板：
  - `.Language.LanguageDirection` 已弃用（v0.158.0），改用 `.Language.Direction`
  - `.Language.LanguageCode` 已弃用（v0.158.0），改用 `.Language.Locale`
- 主题 `themes/PaperMod` 是**直接提交进仓库的 vendored 副本**（不是 submodule；无 .gitmodules；但目录里残留自己的 `.git`，版本 `v8.0-53-g1cf5327`，最后提交 2025-10-26）。theme.toml `min_version = "0.146.0"`。
- 仓库没有 `.gitignore`；`public/`、`resources/`、`.hugo_build.lock`、`.audit/` 都未被忽略。`.hugo_build.lock` 与 `resources/` 未出现在 git status 里（需复核是否曾被提交）。

## 工作区未提交状态（关键！）
- `M config.toml`：permalinks 由 `/blog/:year/:slug.html` 改为 `/blog/:slug.html`（未提交 → 一旦提交会造成全站文章 URL 变更）。
- `D hugo.yaml`（已删除、未提交）：仓库里**同时存在**过 `hugo.yaml` 和 `config.toml`。Hugo 加载优先级 hugo.toml/hugo.yaml/hugo.json > config.toml，所以历史上实际生效的是 hugo.yaml，config.toml 可能长期未生效！hugo.yaml 里 `languageCode: en`、`pagination.pagerSize: 8`。现已删除，config.toml 才开始生效。
- `?? public/`：本地构建产物，未追踪。
- `?? content/blog/ai-tech-2026-04.md`：新文章（2026-11-04，Redis/Agent 主题，含 mermaid 代码块）。

## 已确认的配置缺陷（Lead 实测）
1. `config.toml:6` 写的是 `"pagination.pagerSize" = 12`（**带引号**）。TOML 中引号内的点是字面量，Hugo 不认，`hugo config` 显示实际 `[pagination] pagersize = 10`（默认值）。修正写法：`[pagination]\n  pagerSize = 12` 或不带引号的 `pagination.pagerSize = 12`。已验证：不加引号 = 12 生效，加引号 = 10。
2. 6 个 section/leaf 页无 `date`（content/page/{about,agreement,search,archives,photos}/index.md、content/page/about/resume/resume.md），且 `[frontmatter] date = [":filename", ":default"]` 让日期取文件名，`index.md` 取不到 → 构建产物里出现 `0001-01-01`（/about、/archives、/search、/links、/agreement、/photos 页面 HTML 中可搜到），归档页会列出这些页面。
3. `params.env = "duction"` 疑似 "production" 拼写错误（主题可能用该值决定资源/CDN 行为，需核对 theme 模板）。
4. `BaiduAnalytics` 写在根级（不在 `params` 下），需确认主题 PaperMod v8 是否仍读这个键（新版可能改为 `params.analytics.baidu`）。
5. 根级还写了 `HasCJKLanguage` / `isCJKLanguage`（后者不是合法 Hugo 配置键，CJK 只认 `hasCJKLanguage`）；`locale` 与 `languageCode` 并存，需确认优先级。
6. `[markup.highlight]` 里 `hl_Lines = "0"`、`lineAnchors = ""`、`noClasses = true` + `style = "monokai"`：需核对新版是否仍支持/是否应改用 `markup.highlight` 的新键（如 `noClasses` 与 `style` 同时用会内联样式，影响 CSP/体积）。
7. `[security] allowContent = ['text/markdown','text/html']`：需确认键名在新版是否有效（Hugo 0.144+ 的 security 配置项）。
8. `ignoreLogs = "warning-partial-superfluous-prefix"`：屏蔽了警告；新版警告名可能已变，导致屏蔽失效或反过来隐藏真实问题。
9. 主题 `themes/PaperMod` 内置 `.git` 且被整体提交；无 `module` 配置（没有 go.mod 引入主题），升级只能手动拷贝。
10. 有 `data/`、`i18n/` 空目录，`assets/css` 有自定义样式，`layouts/` 有 6 个 partial + 3 个 shortcode + 3 个 `_default` 覆盖（search/photos 等），需核对与新版主题是否冲突。
11. `layouts/_default/photos.html` 用 `readDir "./static/photos"` 遍历静态目录（依赖工作目录、构建期读磁盘；新版 Hugo 对 `readDir`/`os.ReadDir` 与 `--renderToMemory`、`hugo server` 的行为需核对），且 `/photos` 构建产物 `<img>` 只有 1 个（疑似失效）。
12. 模板里用 `.Site.Taxonomies`、`.Site.Params`、`.Param` 等新旧 API 混用；主题警告说明主题落后 Hugo 0.158+ 的 API。
13. `config.toml` 未设置 `taxonomies`（默认 tags/categories，OK）；`content/links` 目录需确认是否有 `_index.md` 与 section 类型。

## 内容层结构
- 66 篇 md：content/blog（含 2020/2022/2023/2024 年份子目录 + 大量散落文件）、content/page（about/agreement/search/archives/photos、links、about/resume）。
- 图片：56 jpg / 22 png / 16 webp / 16 jpeg / 2 gif，散落在 content/img/YYYY/MM/... 与 content/blog/img/...，另有 static/images、static/photos。构建显示 **Processed images = 0**（没用 Hugo 图片处理管线）。
- 文件名含大量中文、空格、`！`、`？`、《》、`（` 等；`[frontmatter] date = [":filename", ":default"]` 依赖文件名日期前缀（如 `2020-08-05-xxx.md`）。
- 所有文章 frontmatter 都有 `slug`（手写短 slug），permalinks 用 `:slug`；无重复 slug、无 draft、无 future 文章。1 篇缺 slug。
- 新文章 `ai-tech-2026-04.md` 有 mermaid 代码块 → 主题/站点是否支持 mermaid 渲染需核对。

## 部署（.github/workflows/deploy.yml）
- `submodules: false` + `fetch-depth: 0`；`hugo -F --cleanDestinationDir` 后 `cp -r public/* ./`；`peaceiris/actions-gh-pages@v3`，`PUBLISH_DIR: ./`，发布到 `iguri/iguri.github.io` gh-pages。
- 疑点：① `PUBLISH_DIR: ./` 会把整个源码仓库（content、themes、config、.github、public 自身）发布到 gh-pages；② `-F` = --buildFuture，与 config `buildFuture=false` 冲突（会发布未来文章）；③ 用 `latest` Hugo 版本，与本地 0.169 无锁定；④ actions 版本较旧（peaceiris v3、actions-hugo v3）。

## 待你核实的开放问题（不要重复上面的实测）
- 主题模板里 `.Language.LanguageCode`/`LanguageDirection` 具体位置，以及 PaperMod 官方升级路径/兼容版本。
- `params.env`、`BaiduAnalytics`、`ShowWordCounts`、`homeInfoMode`、`commentopen`、`shareButtons` 等键在 PaperMod v8 模板中是否仍被读取（grep themes/PaperMod/layouts）。
- 自定义 layouts（partials/search/photos/shortcodes）与 PaperMod v8 新结构的冲突点。
- 内容日期/URL/SEO 风险清单（permalinks 变更、.html 后缀、aliases、canonical、sitemap、robots、RSS、CJK slug）。
- 新版 Hugo（0.123→0.169）与本项目相关的破坏性变更清单（模板系统、语言 API、图片处理、minify、config 加载顺序、security、cascade 等）。
- 部署链路与仓库卫生（.gitignore、vendored 主题、public/、CDN 依赖、Twikoo 版本）。

## 产出规则
- 只读审计：**不要修改 /root/blog 下的任何站点文件**，只写你自己的报告文件（路径见各自任务）。
- 每条结论标注证据（文件:行号 / 命令输出），区分「已实测确认」和「需验证推测」。
- 报告用中文，简洁分点，给出可执行的修复项（含具体配置片段/命令）。
