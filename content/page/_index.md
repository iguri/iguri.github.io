---
title: Page
# 注意：这里只关 render 不关 list。
# 曾经写有 list: false，会让 page 分区从 site.Sections 消失，
# 主题模板 layouts/llms.txt（PaperMod 自带）因此漏收 关于/相册/隐私政策。
# render: false 仍保证不生成 public/page/ 目录，页面 URL 不受影响。
build:
  render: false
---
