---
title: 关掉WordPress顶部管理条
author: "甲拉古日"
tags:
  - wordpress
  - 网站日记
slug: 1731
categories: 折腾笔记
date: 2020-04-02 00:58:39
aliases:
  - "/blog/2020/1731.html/index.html"
---
在`functions.php`里找个合适的位置加上下面代码：

```php
function wpbeginner_remove_version(){
    return;
```

就这样又水了一帖...