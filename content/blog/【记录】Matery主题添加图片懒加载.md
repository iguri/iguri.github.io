---
title: 【记录】Matery主题添加图片懒加载
date: 2020-08-30 20:05:00
author: GRer
summary: 让所有图片元素src指向一个小的站位图片比如loading，并新增一个属性(如data-original)存放真实图片地址。每当页面加载（或者滚动条滚动），使用JS脚本将可视区域内的图片src替换回真实地址，并做请求重新加载。
slug: 33ef
categories: 折腾笔记 # 分类 ! 灵感记录 生活 折腾笔记 日常水文 分享安利 !
tags:
  - 记录
  - hexo
  - 懒加载
---

**2020.09.01 测试图片显示不出来，问了下度娘是因为跟豆瓣插件不兼容，而且还没有很好的解决办法，所以我就停了。**

### 安装插件：

hexo-lazyload-image需要安装插件才能使用

安装：

```
npm install hexo-lazyload-image --save
```

安装完插件就可以在博客配置文件（_config.yml）添加以下代码：

```yaml
#loading-image
lazyload:
  enable: true
  onlypost: false
  loadingImg: /medias/loading.gif
```
![](/img/2020/08/30/159878786gfas.jpg)

### 懒加载插件优化（可选）

打开 Hexo根目录 >node_modules > hexo-lazyload-image > lib > simple-lazyload.js 文件

第 9 行修改为：

```
&& rect.top <= (window.innerHeight +240 || document.documentElement.clientHeight +240)
```

![](/img/2020/08/30/1598788174lzjj.jpg)

作用就是提前 240 个像素加载图片；当然这个值也可以根据自己情况修改

**matery主题存在的问题**

matery主题和`hexo-lazyload-image`插件有个BUG，查看大图，发现全部为 loading 加载图，

原因是因为懒加载插件与 `lightgallery` 插件冲突，解决办法如下：

修改主题文件下的 `matery.js`，在 108 行左右添加以下代码：

```
$(document).find('img[data-original]').each(function(){ 	$(this).parent().attr("href", $(this).attr("data-original")); });
```

![](/img/2020/08/30/1598788583jssf.jpg)

这样就算大功告成！

可以查看我的博客效果，我也是初次使用`hexo-lazyload-image`插件，可能有些BUG，如果有就慢慢修吧！