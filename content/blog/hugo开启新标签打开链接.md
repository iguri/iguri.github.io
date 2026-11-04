---
title: "Hugo开启新标签打开链接"
date: 2022-04-07T15:25:02+08:00
tags:
  - hugo 
  - 博客
slug: 47wa
categories: 折腾笔记 # 分类 ! 灵感记录 生活 折腾笔记 日常水文 分享安利 !
lastmod: 2022-04-07T15:25:02+08:00
author: "甲拉古日"
---

从hexo来到hugo才觉得各种配置写法都不一样了，之前因为都是基于markdown应该差不多，实则差太多了，不过有1说1，hugo比hexo要好用一点。

博客一直都是新标签打开链接，毕竟有时候打开一个链接不小心x掉了就很烦，来到了hugo也不例外，因为习惯了yml格式的写法我的配置文件是转换过的，在主题配置文件加入以下代码：

```yml
markup:
  goldmark:
      renderer:
          unsafe: true
```

原toml写法：

```yml
[markup.goldmark]
   [markup.goldmark.renderer]
      unsafe = true
```

然后true状态下就支持HTML标签了：

```html
<a href="//example.com" target="_blank">example.com</a>
```

如果想某篇文章不想新标签打开或者只想让某篇文章新标签打开就在文章头部加入：

```yaml
unsafe: true / false 或者 [unsafe = true / false]
```

毕...
