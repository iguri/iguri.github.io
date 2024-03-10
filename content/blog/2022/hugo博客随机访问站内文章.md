---
title: "Hugo博客随机访问站内文章"
date: 2022-01-26T12:13:08+08:00
author: "甲拉古日"
weight: # 置顶数字代替越小越前
tags: # 标签
  - 随机访问
  - Hugo
categories: 折腾日记 # 分类
cover:
    image: "" # 封面url
    alt: # 替换文本
    caption: # 封面标题
lastmod: 2024-03-10T12:13:08+08:00
summary: # 描述
slug: hugo-random # 手动永久链接
draft: false
---

## 引言

为了增加用户与你的Hugo博客的互动性，添加一个随机访问文章的功能是非常有意义的。这种功能可以让用户轻松地发现和阅读他们可能会错过的有趣内容。下面我们将详细讲解如何在Hugo博客中实现这一功能。

## 步骤解析

### 创建一个新页面

首先，你需要在你的Hugo项目中创建一个新的页面来承载随机访问文章的链接。打开你的Hugo项目并找到 content/posts/ 文件夹，然后创建一个新的Markdown文件，例如： random-post.md 。

### 添加内容

在新创建的 random-post.md 文件中，你可以添加任何你想要的内容，比如一段欢迎语或者解释随机访问文章功能的说明。

### 使用Liquid模板语言生成随机链接

接下来，我们需要使用Liquid模板语言来生成随机的文章链接。在Markdown文件中，使用以下代码：

```html
<a href="{{ (len .Site.Pages)|add:1 }}{{ range first ((int (.Site.Params.randomSeed|default randInt)) % len(.Site.Pages)) .Site.Pages }}">{{ .Title }}</a>
```

这段代码会从所有的 .html 文件中随机选择一个，并返回其标题作为链接。

### 设置随机种子

为了确保每次刷新都会得到不同的结果，我们需要设置一个随机种子。在Hugo的配置文件（通常是 config.toml ）中，添加以下行：

```toml
[params]
    randomSeed = "random_string"
```

请将“random_string”替换为任何你喜欢的字符串。这个字符串将被用作随机数生成器的种子。

## 完成

现在，你已经成功地在你的Hugo博客中添加了随机访问文章的功能。每次刷新页面时，链接都会指向一个随机的文章。


