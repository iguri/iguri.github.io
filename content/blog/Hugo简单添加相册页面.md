---
title: "Hugo简单添加相册页面"
date: 2022-04-13T17:54:48+08:00
tags:
  - Hugo
  - 博客
slug: 413a754
categories: 折腾记
lastmod: 2022-04-13T17:54:48+08:00
author: "GRer"
draft: false
---

## 给hugo添加相册页面

今天逛[木木博客](//immmmm.com)的时候看到的，实现方法和效果都是简单又美观，搞起来~~

### 1，创建html页面

在主题文件下的`layouts/_default/`目录下创建一个`photos.html`,并贴上以下代码：

```html
{{ define "main" }}
<div class="post">
  <h2 class="post-title">{{.Title}}</h2>
</div>

<div class="page-photos">
  {{ range (readDir "./static/photos") }}
  <figure>
    <img src="{{"photos/" | absURL }}{{ .Name }}" alt="{{ .Name }}" />
    <figcaption>{{ .Name | replaceRE "(.*)[.].*" "$1"}}</figcaption>
  </figure>
  {{ end }}
</div>
{{ end }}
```

### 2，新增css样式代码

然后根据主题文件的结构添加样式，以我使用的`PaperMod`为例，在`assets/css/extended/blank.css`下修改（参考我的）:

```css
/* 相册 */
.page-photos figure figcaption{
    margin: 0.1rem auto 1rem;
    width: 36%;
    border-top: 1px solid #bbb;
    padding: 5px;
    line-height: .8em;
}
.page-photos figure img{
    box-shadow: 0 12px 40px rgba(0,0,0,.15);
    border-radius: 8px;
    margin: .5rem auto .3rem;
}

```

### 3，添加索引文件

然后到`content`下创建一个`photos.md`或者像我先创建一个`photos`文件夹再创建索引文件`index.md`贴上：

```markdown
---
title: "相册"
layout: "photos"
---
```

### 完毕

这样就算造完了，在`static`创建一个`photos`把想要放的图片放进去，就会输出图片和图片名了

## 查看效果

看看[我的相册](/photos/)
