# Hugo 博客项目审计与优化报告

> 站点：`/root/blog` ｜ 生产域名 `https://grer.cn` ｜ 主题 PaperMod ｜ 审计日期 2026-11-04
> 环境：Hugo **v0.169.0+extended**（本机），主题 vendored 版本 `v8.0-53-g1cf5327`（2025-10-26）
> 方法：全部结论基于本机实测（`hugo config`、最小站点对照实验、构建产物与线上抓取比对），非推测。

---

## 一、结论先行（TL;DR）

**好消息：项目本身没有"烂掉"。** 用当前 Hugo 0.169 直接构建**完全成功**——313 页 / 463ms / 0 图片处理 / 仅 2 条主题级 deprecation 警告。这意味着它不是"需要重写"的老项目，而是**一批具体、可修的配置缺陷 + 一条需要重新接通的发布链路**。

**但有 4 件事必须先做，否则一改动就会出事：**

| # | 风险 | 一句话 |
|---|------|--------|
| 1 | **本地仓库落后远端 6 个提交** | 你本地 `HEAD=444cd6b`，远端 `main=bbecbc7`。本地的 `deploy.yml` 和 `hugo.yaml` 状态**已经不是线上实际状态**，直接提交会冲突/回滚别人的修复 |
| 2 | **一个未提交的 permalink 改动会废掉全站 60 篇文章的 URL** | `config.toml` 里 `blog = "/blog/:slug.html"`（已从 `:year` 去掉）未提交、未验证，提交即 60 条链接 404 |
| 3 | **`pagination.pagerSize` 从第一天起就没生效过** | `"pagination.pagerSize" = 12` 带引号 → TOML 视为字面量键，实测回落到默认 10 |
| 4 | **`hugo.yaml` 与 `config.toml` 曾长期同时存在** | YAML 优先级更高，历史上 `config.toml` 可能**从未生效**；现在两者都删/改了，行为才刚变得一致 |

---

## 二、现状核实：哪些"老配置"其实还能用

我逐键验证了 `config.toml` 的每个配置项在 0.169 下的真实被读取情况。

### ✅ 仍然有效（无需改）
`baseURL` `title` `locale` `defaultContentLanguage` `defaultContentLanguageInSubdir` `theme` `HasCJKLanguage` `summaryLength` `enableRobotsTXT` `buildDrafts` `buildFuture` `buildExpired` `Copyright` `[minify]` `[frontmatter]` `[permalinks]` `[outputs]` `[security] allowContent` `[markup.goldmark.renderer] unsafe` `[params]` 全组、`[[languages.zh.menu.main]]`。

> 注：`[markup.highlight]` 中除 `noHl` 外全部有效（`anchorLineNos` `lineAnchors` `lineNoStart` `lineNos` `lineNumbersInTable` `noClasses` `hl_Lines` `codeFences` `guessSyntax` `tabWidth` `style` `wrapperClass` 实测均被识别）。

### ❌ 已确认失效 / 必须修正

**(1) `"pagination.pagerSize" = 12` —— 键名带引号，值被丢弃**
```toml
# 现在（无效）：引号内的点是字面量，Hugo 找不到 pagination 段
"pagination.pagerSize" = 12

# 实测三态：
pagination.pagerSize = 12      → pagersize = 12  ✅
[pagination]
  pagerSize = 12              → pagersize = 12  ✅
"pagination.pagerSize" = 12   → pagersize = 10  ❌（默认值）
```
证据：`hugo config | grep -A1 '[pagination]'` 三组对照实验。**当前全站每页 10 篇，不是你以为的 12。** 线上实测 `/blog/` 也是 10 篇/页（共 7 页），与本地一致 —— 说明这个问题线上也一直存在。

**(2) 5 个页面产出 `0001-01-01` 假日期**
`content/page/{about,agreement,search,archives,photos}/index.md` 无 `date`，而 `[frontmatter] date = [":filename", ":default"]` 让日期优先取文件名。`index.md` 没有日期前缀 → 落到零值。
产物里已实证：`/about/` `/archives/` `/search/` `/links/` `/agreement/` `/photos/` 全部含 `"datePublished":"0001-01-01T00:00:00Z"`，**线上同样存在**（`curl https://grer.cn/about/` 可复现）。
后果：JSON-LD 结构化数据出现非法日期、归档页出现 `0001` 分组。

> `/links/` 也中招，是因为 `content/links/index.html` 被当作 section 页面渲染（见 4.2b）。
> `about/resume/resume.md` 则是**连 frontmatter 都没有**（纯正文 `### 个人信息`），它压根不是一个 page —— 见 4.2a。
> 补充实测：目录名里的日期**不参与**解析，只有**文件名**前缀参与（`2022/07/29/xxx.md` 仍取 frontmatter 的 date）。所以 `content/blog/2022/**` 那些带日期目录的文章没有受影响，纯粹是 `index.md` 这个命名造成的。
> **修复已验证**：给这 5 个文件补 `date:` 后重新构建，`/about/` `/archives/` `/search/` 中 `0001-01-01` 出现次数归零。

**(3) `isCJKLanguage = true` 是无效键**
Hugo 只认 `hasCJKLanguage`。`hugo config` 中该键根本不出现（已合并 `hascjklanguage = true`）。属于无害冗余，建议删除以免误导。

**(4) `params.env = "duction"` 拼写错误**
主题 `head.html:4` 与 `:200`、`cover.html:6`、`index_profile.html:14` 都在判断 `site.Params.env == "production"`。
实测影响：`hugo -e production` 时 `hugo.IsProduction` 为真，所以 robots/OG/schema 侥幸正常；但**一旦用 `-e development` 本地预览，会掉到 `noindex,nofollow` 且不生成 OG/schema**。这是"看着小、坑在后"的典型。

**(5) `BaiduAnalytics` 写在根级，但没有任何模板读它**
`grep -rn 'baidu|Baidu' themes/PaperMod/layouts themes/PaperMod/assets` → **0 命中**；构建产物中 `hm.js` 出现 **0 次**。
结论：**百度统计从未生效**（很可能自建站起就没工作过）。主题 v8 只支持 `params.analytics.{google,bing,yandex,naver}.SiteVerificationTag` 这类验证标签。

**(6) `ignoreLogs = "warning-partial-superfluous-prefix"` 掩盖了真实警告**
类型也不对——它应是数组 `['warning-partial-superfluous-prefix']`。当前这个屏蔽项与 0.169 的实际警告名已不完全对应，而真正需要关注的 2 条 deprecation 恰好**没被屏蔽**（说明屏蔽项已过期）。建议直接删除该配置。

---

## 三、主题层：2 条 deprecation 是"定时炸弹"

构建警告：
```
.Language.LanguageDirection  deprecated (v0.158.0) → 用 .Language.Direction
.Language.LanguageCode       deprecated (v0.158.0) → 用 .Language.Locale
```
落点：
- `themes/PaperMod/layouts/_default/baseof.html:8/10/12` — 每页 `<html dir=...>`
- `themes/PaperMod/layouts/partials/templates/opengraph.html:15`
- `themes/PaperMod/layouts/_default/rss.xml:59`

**关键实测（`--panicOnWarning`）**：在 `--panicOnWarning` 下这两个警告会**直接让构建失败**——因为它们在渲染每篇页面的热路径上。也就是说：**哪天 Hugo 把它们从"弃用"变"移除"，站点会整体构建失败，而不是降级。** 这不是理论风险。

主题落后程度：本地 `v8.0-53-g1cf5327`（2025-10-26），上游 `HEAD` 已前进（`git ls-remote` 可确认）；且**仓库里 vendored 的主题副本还有本地改动**：
```
themes/PaperMod: M assets/css/common/404.css   (font-size: 160px → 10px)
```
这就是"升级主题会覆盖你的 hack"的隐患，目前**没有任何记录**说明这行为什么改。

---

## 四、内容与文件存放格式（"存放格式"层面的问题）

### 4.1 目录结构：年份目录 + 根级散落 + 中文长文件名
- `content/blog/`：**49 篇散在根级**，11 篇在 `2020/2022/2023/2024` 年份子目录。
- **60/60 篇文章的文件名都不以 `YYYY-MM-DD` 开头** → `[frontmatter] date = [":filename", ":default"]` 这个配置对**所有文章**实际上都在走 `:default` 分支，形同虚设。
- 文件名含空格、`！？《》（）`、`·`、省略号：`为在抗击疫情和西昌南线山中牺牲的同胞默哀！.md`、`《花束般的恋爱》观后....md`、`打工是不可能打工的-窃·格瓦拉出狱-看好你的电瓶.md`。
  - 实测无碍（无 path warning，Git 中文名正常），但**跨平台 checkout（Windows/macOS NFC vs Linux NFD）和 `hugo new` 时容易踩坑**；`--printPathWarnings` 目前无告警，属于"暂时安全"。

### 4.2 真实存在的结构缺陷（已实测）

**(a) `/about/resume` 页面是死链**
`content/page/about/` 是 **leaf bundle**（含 `index.md`），所以其子目录 `resume/` 里的 `resume.md` 被当成**页面资源**而非页面，**不会生成 HTML**。
- 本地构建产物：`/about/` 下只有 `resume/resume.pdf`，**没有 `resume/index.html`**
- 线上 `https://grer.cn/about/resume/` → **403 Forbidden**（不是 404，是 nginx 目录列表被禁）
- 而 `content/page/about/resume/index.html`（手写的旧静态页）**被 git 追踪也不会被发布**——它躺在 content 里被 Hugo 忽略。
→ 简历页实际上已经挂了很久。

**(b) `content/links/index.html` 是一个裸的 meta-refresh 片段**
Hugo 把 content 里的 `.html` 当页面渲染，于是 `/links/` 输出了**一整个主题页面**，里面才嵌套着 `Refresh ... url=/about/#link`。线上 `/links/` 返回 200 但内容是套壳页面。应改用 `aliases` 或 `layouts` 重定向。

**(c) 图片从未走过 Hugo 图片管线**
`Processed images = 0`。图片靠 URL 硬编码（`/img/2020/08/05/xxx.jpg`）直接从 `content/img` 发布出去（实测 `/img/**` 确实被发布，119 张图）。**一旦改 permalink/目录结构，这些绝对路径引用不会自动跟着变。**
- 图片总量：`content/img 18M` + `content/blog/img 5.0M` + `static/images 6.2M` + `static/photos 3.5M` ≈ **33M**
- 存在**孤儿资产**：`content/blog/img/2026/06/01/` 下 `102016.jpg`(3.1MB)、`123.gif`(2.0MB) 等**零引用**；`static/images/屏幕截图(2).png`(3.9MB) 零引用
- 实测**无 404 图**（扫描 307 个 HTML、比对产物文件：0 个缺失）—— 这是好消息，说明现有引用是自洽的

**(d) Mermaid 完全不渲染**
新文章 `content/blog/ai-tech-2026-04.md` 有 2 个 ` ```mermaid ` 块。产物中 `mermaid` 关键字出现 **0 次**；且因 `guessSyntax = true`，这些块被**误判成 `gdscript3`** 高亮（产物里 `class=language-gdscript3`）。
→ 流程图目前显示为一堆被乱染色的文本。需要 codeblock render hook 或引入 mermaid.js。

### 4.3 分类与 URL
- 107 个 tag、9 个 category。中文标签能正常 slug 化（`/tags/ai-agent/`、`/categories/ai%E4%81.../`）。
- 存在**近义/空标签**（如 `# 标签` 注释残留、重复语义），建议归一化。
- `/page/` 是一个**意外暴露的 section 列表页**（`content/page` 无 `_index.md`，Hugo 自动生成 `Pages` 列表，线上 200）。应设为 `_build: {render: never}` 或补 `_index.md`。

---

## 五、URL 结构：最需要谨慎的部分

线上实测（`sitemap.xml` + 逐条 curl）确认：

| 形式 | 结果 |
|---|---|
| `/blog/2020/ga12.html/`（带尾斜杠） | **200** ← 实际规范形式 |
| `/blog/2020/ga12.html`（无尾斜杠） | **301** → 加尾斜杠 |
| `/blog/ga12.html/`（去掉年份） | **404** |

**即：`:slug.html` 在 Hugo 里并不产出"文件"，而是产出"目录 + index.html"。** 这个反直觉的产物形式导致：
- 所有 canonical / sitemap / og:url 都带尾斜杠 `.../ga12.html/`
- 用户分享出去的"看起来像静态文件"的链接会 301 一次

### 未提交的 permalink 变更 = 60 条链接失效
```
工作区  config.toml:  blog = "/blog/:slug.html"       ← 未提交
远程 main config.toml: blog = "/blog/:year/:slug.html" ← 线上实际
```
完整旧→新映射（60 篇，逐条核对）：

| 旧 URL（线上） | 新 URL（若提交当前改动） |
|---|---|
| `/blog/2020/ga12.html/` | `/blog/ga12.html/` |
| `/blog/2022/220606.html/` | `/blog/220606.html/` |
| `/blog/2024/no1006.html/` | `/blog/no1006.html/` |
| …（共 60 条，全部会 404） | |

**如果一定要去掉 `:year`**，必须同时给每篇加 `aliases`。实测验证过：在 `.html` permalink 下，`aliases: ["/blog/2022/220729.html"]` 会正确生成 301 跳转文件（**注意：`aliases` 写不带尾斜杠的形式即可，Hugo 会自动处理**）。

**我的建议：这一步先不动。** 去掉 `:year` 收益（URL 更短）远小于风险（60 条外链/搜索引擎收录全废），且可以用 `aliases` 平滑过渡——但那是独立的一次迁移，不该混在这次"恢复更新"里。

---

## 六、部署链路：这里才是真正"多年未更新"的重灾区

### 6.1 最大的发现：本地仓库与远端已经分叉

```
本地  HEAD        = 444cd6b
远端  main        = bbecbc7   (领先 6 个提交)
远端  gh-pages      = 4aeb135  (2025-01-19，已 21 个月未更新)
```
远端 6 个提交做的事：
```
bbecbc7 Create hugo.yaml                    ← 新增全新 workflow！
d1e8ee9 Delete .github/workflows/deploy.yml ← 删掉旧的 deploy.yml
1faba6d Update deploy.yml
b412787 Update deploy.yml
d2e164e Update deploy.yml
e06b414 Delete hugo.yaml                     ← 先删了配置，后又重建 workflow
```
**即：远端的 CI 已经换成 GitHub 官方 Pages 流程（`configure-pages` + `upload-pages-artifact` + `deploy-pages`），旧的 `peaceiris/actions-gh-pages` 已被删除。**
而你本地看到的 `.github/workflows/deploy.yml`（peaceiris v3）**已经是历史文件**。远端还有 `deploy` workflow 的 5 次连续失败记录（2026-11-04 01:15–02:02），最后靠 `workflow_dispatch` 手动跑通一次。

→ **在这个状态下直接 `git push` 会把远端已经修好的 CI 覆盖回旧版本。这是当前最大的操作风险。**

### 6.2 旧 deploy.yml 本身的两个硬伤（供对照）

```yaml
hugo -F --cleanDestinationDir      # -F = --buildFuture，与 config 的 buildFuture=false 冲突
mkdir -p public
cp -r public/* ./                  # 把产物摊到仓库根
PUBLISH_DIR: ./                    # 结果：把源码目录一起发布
```
实测模拟（在 /tmp 复制仓库跑同一套命令）确认产物根目录会包含：`content/ themes/ config.toml archetypes/ layouts/ assets/ data/ i18n/ static/ README.md public/`。
进一步查证：
- `gh-pages` 分支实际内容 **2503 个条目**，其中 `content/` 233、`themes/` 140、`public/` 1037
- **67 个 `.md` 源文件**被发布到 gh-pages（`content/blog/**/*.md`）
- `hugo.yaml`、`README.md`、`themes/PaperMod/README.md`、`public/index.html` 均在 gh-pages 分支
- 公开仓库（`private: false`），所以**源文件曾经是公开可下载的**
- 不过直接访问 `https://iguri.github.io/*` 现已 301 到 `grer.cn`；`grer.cn/*` 由 nginx 托管，`.md`/`config.toml` 均 404 —— **当前没有实际泄露**，但这是**靠"巧合"而不是靠设计**挡住的。

### 6.3 当前真实发布状态不一致（三方都不同）

| 来源 | 文章数 | 最新内容 |
|---|---|---|
| 线上 `grer.cn`（nginx） | 63 篇索引 | 最新 2024-08-30，**无 2026 文章** |
| `gh-pages` 分支 | 旧（2025-01-19 的构建） | 无 Redis 新文 |
| 本地工作区构建 | **64 篇**（含新文 `ai-tech-2026-04.md`） | 2026-11-04 |

线上与 `origin/main` 构建产物**完全一致**（`sitemap.xml` diff 为 IDENTICAL），说明 nginx 那台机器是**手工同步 `origin/main` 的构建结果**，而不是自动从 gh-pages 拉。

**所以你实际有 3 条互不相通的发布路径：**
1. 旧 peaceiris → gh-pages（已停用，停留在 2025-01）
2. 新 Pages workflow → GitHub Pages（已跑通，但被 301 到 grer.cn，等于白跑）
3. nginx（线上真实服务，靠手工同步）

这是"多年未维护"最典型的后果：**没有一个可信的单一发布源**。

### 6.4 新 workflow 也有问题

远端 `hugo.yaml` 里：
```yaml
hugo --gc --minify --baseURL "https://iguri.github.io/"
```
`--baseURL` 覆盖成了 GitHub 域名。实测该覆盖的后果：**所有 canonical / og:url / sitemap 里的绝对链接都会变成 `https://iguri.github.io/...`**，而站点真实域名是 `grer.cn`。对 SEO 是直接伤害（canonical 指向别处）。若继续用 GitHub Pages，应改为 `--baseURL "https://grer.cn/"`。

（另外它确实比旧版健康：锁定了 `HUGO_VERSION: 0.169.0`、用了官方 pages artifact、有 `concurrency` 和 `permissions`。这是值得保留的部分。）

### 6.5 其它部署细节
- `.nojekyll`：仓库里**没有**（`static/` 下无），但 gh-pages 分支上**有**——是老 peaceiris 流程留下的。换 GitHub Pages 流程后需自己保证（`actions/upload-pages-artifact` 自动处理，OK）。
- `CNAME` = `grer.cn` 存在于 `static/`，正确。
- 无 `.gitignore`：`public/`(未追踪但存在)、`resources/`、`.hugo_build.lock`(已被追踪！)、`.audit/` 都裸露在外。
- 仓库体积：`.git` 39M / 工作区 36M；最大对象 `static/images/屏幕截图(2).png` 3.9MB（**零引用**）。

---

## 七、其它可修问题

| 位置 | 问题 | 影响 |
|---|---|---|
| `assets/css/extended/fonts.css:3` | `"Microsoft Yahei" sans-serif` —— 缺逗号 | 整条 `font-family` 声明**失效**，自定义字体实际没生效 |
| `layouts/_default/photos.html:28` | `opacity: 0.1S`（字母 S） | 非法值，浏览器丢弃该声明 |
| `layouts/_default/photos.html:6` | `readDir "./static/photos"` | 依赖工作目录，且 0.169 下仍可用（实测 22 张全部输出），但**改用 `resources.Get` 更安全**；同时 `{{ "photos/" | absURL }}` 拼 URL 是手工拼接 |
| `layouts/_default/search.html` | 与主题同名文件差 18 行（加了 tag 云） | 主题升级时**必须手动重做**，无记录 |
| `layouts/partials/share_icons.html` | 与主题差 135 行（换成微信/微博/qzone 等） | 同上；且用了 `api.qrserver.com` 生成微信二维码（**第三方外链**） |
| `layouts/partials/svg.html` | 与主题差 **1033 行**（整套自定义图标） | 升级主题的最大工作量所在 |
| `layouts/partials/toc.html` | 与主题差 91 行（改成 `aside` 宽版 TOC） | 同理 |
| `extend_head.html` | 引 `npm.elemecdn.com` 字体 CSS（**无 SRI、第三方**） | CDN 挂了字体就丢；建议本地化 |
| `extend_footer.html` / `photos.html` | 引 `cdn.grer.cn/js/view-image.js`（**无 SRI**） | 同上 |
| `layouts/partials/comments.html` | Twikoo 从 `registry.npmmirror.com` 加载 | 版本 1.6.39（2022 年代的版本），建议固定 CDN + SRI |
| `static/bdsitemap/index.php` | PHP 文件躺在静态目录 | 会被原样发布，无意义（且 GitHub Pages 不执行 PHP） |
| `config.toml` | `summaryLength` 生效（60），但 `ShowWordCounts` 未配 | 文章页不显示字数（`ShowWordCount` 才是主题读的键，注意单数） |

---

## 八、优化方向（按优先级，可直接执行）

### P0 — 动手前必做（防事故，30 分钟）

```bash
cd /root/blog
# 1) 先同步远端，看清真实状态（本地落后 6 个提交！）
git fetch origin
git log --oneline HEAD..origin/main     # 看别人改了什么

# 2) 保存当前工作区改动，别丢
git stash push -u -m "pre-audit: config未提交修改+新文章"

# 3) 建一个安全分支再干活
git checkout -b chore/restore-2026 origin/main
git stash pop   # 只把「新文章」捞回来，config 改动先别要

# 4) 打标签做回滚点
git tag pre-restore-20261104
```

> 决定：`config.toml` 里那句 `blog = "/blog/:slug.html"`（去 :year）**先不要**。远端配置是 `:year` 版本，与线上一致。

### P1 — 配置修正（半天，收益最高）

新建 `hugo.toml`（或改 `config.toml`），关键片段：

```toml
# ── 分页：改成正确的写法（这是从未生效过的配置）
[pagination]
  pagerSize = 12

# ── 未生效的键，删掉
# isCJKLanguage = true          ← 无效键
# BaiduAnalytics = "..."        ← 无模板读取
# ignoreLogs = "..."            ← 类型错误且已过期

# ── 生产环境标识：修拼写
[params]
  env = "production"

# ── 页面日期：给 6 个无日期页面显式补上，或改回退策略
# 推荐：[frontmatter] 只留 :default，让文件名不再参与日期解析
[frontmatter]
  date = [":default"]
```

并给 5 个 `content/page/*/index.md` 补 `date: 2020-01-01`（内容页用合理起始日期即可），消除 `0001-01-01`。

**百度统计**若要恢复，需要在 `layouts/partials/extend_head.html` 自己加脚本（主题 v8 不再内置）：
```html
<script>
var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?xqDP7owQ6bJEDs9g";
  document.head.appendChild(hm);
})();
</script>
```

### P2 — 主题升级（半天~1 天）

两个选择：

**A. 升级 vendored 主题（推荐，改动最小）**
```bash
cd themes/PaperMod
git fetch origin && git checkout <最新 tag>
# 但注意：先导出这 4 个本地改动，升级后逐个重放
#   assets/css/common/404.css  (font-size 10px)
#   layouts/partials/{svg,share_icons,toc}.html → 站点级 layouts/ 覆盖（本就在站点层）
```
关键认知：`layouts/partials/svg.html` `share_icons.html` `toc.html` **是你放在站点 `layouts/` 的覆盖文件**（不是改主题），所以不会被主题升级覆盖。真正会被覆盖的只有 `404.css` 那一行。→ **升级风险比想象的小。**

**B. 改用 Hugo Modules（更长远）**
```bash
hugo mod init github.com/iguri/iguri.github.io
```
```toml
[module]
  [[module.imports]]
    path = "github.com/adityatelange/hugo-PaperMod"
```
然后从仓库删掉 `themes/PaperMod`（含那个内嵌 `.git` 和 120 个被追踪的主题文件）。收益：升级一条命令、仓库瘦身、CI 可复现。代价：需要网络拉取、`go.mod/go.sum` 要提交。**首次迁移建议选 A；等这套流程稳定后，下次选 B。**

无论 A/B，`baseof.html` 的 `LanguageDirection` / `opengraph.html` 的 `LanguageCode` 都会随上游更新自动消失（上游已改用新 API）。**如果暂不升级主题**，就自己在站点 `layouts/` 里覆盖这两个文件（`_default/baseof.html` 是主题核心文件，覆盖它意味着你要长期跟进主题的其他改动 —— 所以还是升级更稳）。

### P3 — 发布链路收敛（1 天，最重要的一步）

**目标：一条可信发布路径。**

推荐结论：**继续用 nginx + GitHub Actions 推送产物，不要用 GitHub Pages。** 因为 `grer.cn` 是 nginx 托管的，GitHub Pages 那条链路最终被 301 绕过，等于空跑。

新 workflow 骨架（在 `origin/main` 的最新基础上改）：
```yaml
name: Build & Publish
on:
  push: { branches: [main] }
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: publish
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    env: { HUGO_VERSION: "0.169.0" }
    steps:
      - uses: actions/checkout@v4
        with: { submodules: false, fetch-depth: 0 }
      - name: Install Hugo
        run: |
          wget -O /tmp/hugo.deb https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.deb
          sudo dpkg -i /tmp/hugo.deb
      - name: Build
        run: hugo --gc --minify --baseURL "https://grer.cn/"
      - name: Deploy via rsync
        run: |
          echo "${{ secrets.DEPLOY_KEY }}" > /tmp/key && chmod 600 /tmp/key
          rsync -avz --delete -e "ssh -i /tmp/key -o StrictHostKeyChecking=no" \
            public/ ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}:/var/www/grer.cn/
```
要点：
- `--baseURL "https://grer.cn/"`（**不要** `iguri.github.io`）
- `--delete` 保证不残留旧文件
- 去掉 `-F`（`--buildFuture` 与 `buildFuture=false` 冲突）
- 只发布 `public/`，**不发布源码**

**同时**：把 gh-pages 分支归档（改名 `archive/gh-pages-2025`）或直接删掉，消除第二条幽灵链路。

### P4 — 长期卫生（可选，持续做）

1. **`.gitignore`**（现在完全没有）：
```gitignore
/public/
/resources/_gen/
/.hugo_build.lock
.hugo_build.lock
node_modules/
.DS_Store
.audit/
*.bak
```
> 注意 `.hugo_build.lock` 目前**被 git 追踪**，需要 `git rm --cached .hugo_build.lock`。

2. **图片管线**：把 `content/img/**` 迁到 page bundle 或 `assets/`，用 `resources.Get | images.Process` 生成 webp + 响应式尺寸。实测本机 **extended 版图片处理可用**（`Processed images = 1` 测试通过）。预计图片体积可降 40–60%。
   - 顺手清理 3 个孤儿大文件（约 9MB）：`static/images/屏幕截图(2).png`、`content/blog/img/2026/06/01/102016.jpg`、`123.gif`

3. **目录规范化**（分步，别一把梭）：
   - 短期：保持现状（已确认无 path 冲突）
   - 中期：`hugo new` 时按 `YYYY-MM-DD-slug.md` 命名，让 `[frontmatter] :filename` 真正开始工作；或干脆彻底放弃 `:filename`
   - 长期：把 49 个根级文件归到年份目录（用脚本重命名并 `git mv`，保留 `slug` 所以 URL 不变 —— **这点很关键：URL 只由 slug 决定，挪目录是安全的**）

4. **Mermaid**：加 `layouts/_default/_markup/render-codeblock-mermaid.html`，或简单地关掉 `guessSyntax`（避免 mermaid 被当 gdscript3）+ 用 shortcode 引入 mermaid.js。

5. **内容小节**：
   - `content/page/about/resume/` 改成独立页面（`content/resume.md` 或独立 bundle），修好已挂的简历页
   - `content/links/index.html` 换成 `aliases: [/links]` 写法
   - `content/page` 补 `_index.md`（`_build: {render: never}`）避免 `/page/` 泄露

6. **安全**：给所有第三方 `<script>/<link>` 加 `integrity` + `crossorigin`，或本地化（`view-image.js`、`lxgw-wenkai` 字体、Twikoo）。

---

## 九、给你的"最小安全路径"（建议今天就做这一步）

```bash
# 1. 先备份
cd /root/blog && git stash push -u -m "wip-20261104"
git tag backup-$(date +%Y%m%d)

# 2. 对齐远端（拿到已经修好的 CI）
git fetch origin && git checkout -b fix/2026 origin/main

# 3. 只改最小集，验证，再推
#    - [pagination] pagerSize = 12
#    - params.env = "production"
#    - 5 个页面补 date
#    - 升级主题（消除 deprecation）
#    - 重写 workflow 为 rsync 直发 nginx

hugo --gc --minify -d /tmp/verify && echo "BUILD OK"
# 检查 /tmp/verify 里：分页 12 篇、无 0001-01-01、有 canonical=https://grer.cn/...

git commit -m "chore: 恢复更新，修 pagination/env/date，升级主题，收敛发布链路"
```
**先不要**把 Redis 新文章和 permalink 改动混在这一次里 —— URL 变更需要独立的 aliases 迁移。

---

## 附：本次审计的实测证据速查

| 结论 | 验证方式 |
|---|---|
| 构建成功、313 页 | `hugo --gc --minify -d /tmp/hugo-out` |
| `pagination.pagerSize` 未生效 | 三种写法 `hugo config` 对照 → 10/12/12 |
| 5 个页面 0001-01-01 | 产物 grep + 线上 `curl /about/` |
| `BaiduAnalytics` 无模板读取 | `grep -rn baidu themes/PaperMod/layouts` = 0 |
| `.Language.LanguageCode` 是硬错误风险 | `hugo --panicOnWarning` → 构建失败 |
| 60 篇 URL 会因去 :year 失效 | 60 条 sitemap URL 逐条与 slug 配对 |
| aliases 在 `.html` permalink 下可用 | `/tmp/al` 最小站点实验 |
| permalink `.html/` 产出目录而非文件 | `ls blog/tuog.html` → 目录 |
| resume 页死链 | 本地产物无 `resume/index.html`；线上 403 |
| gh-pages 曾发布源码 | GitHub API tree: 2503 条，含 67 个 .md |
| 本地落后远端 6 提交 | `git ls-remote` + `git rev-list --left-right` |
| 线上与 origin/main 构建一致 | `sitemap.xml` diff = IDENTICAL |
| 图片管线可用 | `/tmp/imgt` 测试 `Resize` → Processed images=1 |
| 无 404 图片引用 | 307 个 HTML 全量比对产物文件 |
| `--delete` 前须知 | CI 模拟 `cp -r public/* ./` → 125M 含源码 |
