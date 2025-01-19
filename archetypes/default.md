---
title: "{{ replace .Name "-" " " | title }}"
date: {{ .Date }}
author: "甲拉古日"
weight: # 置顶数字代替越小越前
tags: # 标签
  - 
  - 
categories: # 分类 ! 
  # 灵感记录
  # 生活
  # 折腾笔记
  # 日常水文
  # 分享安利
cover:
    image: "" # 封面url
    alt: # 替换文本
    caption: # 封面标题
lastmod: {{ .Date }}
summary: # 描述
slug: {{ substr (md5 (printf "%s%s" .Date (replace .TranslationBaseName "-" " " | title))) 4 6 }} # 手动永久链接
draft: false
---
