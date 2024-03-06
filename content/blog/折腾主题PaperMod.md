---
title: "折腾主题PaperMod"
date: 2022-05-10T13:19:23+08:00
author: "GRer"
weight: # 置顶数字代替越小越前
tags: # 标签
  - hugo
  - PaperMod
categories: 折腾记 # 分类
cover:
    image: "" # 封面url
    alt: # 替换文本
    caption: # 封面标题
lastmod: 2022-05-10T13:19:23+08:00
summary: # 描述
slug: PaperMod1 # 手动永久链接
draft: false
---

[PaperMod](https://git.io/hugopapermod)主题是一个优雅简洁的Hugo主题，也是我入坑Hugo就使用的主题，其阅读体验和布局都是我喜欢的，唯一不足的是在移动端屏幕比较小的设备上`menu`栏显的有点"太过简单"，作者也提到过未来不会增加移动端上的菜单，因为加上等于引用一些不必要的依赖来提供过度动画的展示，这将会影响加载速度。

我最不能接受的是左上角logo旁边的日夜切换按钮，当你正在阅读的时候感觉眼睛累了想切换夜间模式（虽然有自动日夜替换和回到顶部），发现你要会回到顶部切换，属实有点反人类，之前我都是开了自动设置日夜间模式，然后把开关给隐藏了...今天突然又想给它展示的机会，那么我就把它放在它该待的地方（全网统一位置——固定右下角）。

在`header.html`里把第61行的`<button>`标签全部剪切到`footer.html`第一行`<script>`标签上面，在`<button>`里添加样式如：

```html
<button class="top-link bottom-riye"  style="visibility: visible; opacity: 1;" id="theme-toggle" accesskey="t" title="(Alt + T)">
<!-- 上面第一行新增样式： class="top-link bottom-riye"  style="visibility: visible; opacity: 1;" -->
                    <svg id="moon" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
                    <svg id="sun" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"></path></svg>
</button>
```

然后在自定义css文件`blank.css`添加css样式：

```css
/* 日夜切换移至右下角 */
.bottom-riye{
    bottom:110px;
    right:30px
}

.hover {
    transition: transform 0.5s;
    -webkit-transform: scale(1.2);
    -moz-transform: scale(1.2);
    -ms-transform: scale(1.2);
    -o-transform: scale(1.2);
    transform: scale(1.03) translateZ(0) translate3d(0, 0, 0) rotate(0.01deg);
}
```

在`header.css`里把：

```css
/*
#theme-toggle svg {
    height: 23px;
    font: none;
}

button#theme-toggle {
    font-size: 26px;
    margin: auto 4px;
}
*/
```

注释掉！

上面其实高手都是可以直接新增css样式就搞定了，哪儿像我这种菜鸟只能引用原有的样式，明明可以在`header`里作改动，偏偏要剪切来剪切去...真的是又菜又爱玩。
