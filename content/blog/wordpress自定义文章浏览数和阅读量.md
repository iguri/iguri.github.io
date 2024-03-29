---
title: "WordPress自定义文章浏览数和阅读量"
tags:
  - wordpress
  - 网站日记
slug: '2d3f'
categories: 折腾笔记 # 分类 ! 灵感记录 生活 折腾笔记 日常水文 分享安利 !
date: 2020-04-15 15:04:38
---

##### wordpress自定义文章的浏览数（阅读量）教程，支持自定义其实阅读量和随意编辑，用来假装人气再好不过了。

**WordPress** 站点统计文章浏览数（阅读量）大多数默认都是安装 [WP-PostViews 插件](https://github.com/lesterchan/wp-postviews/)（**PS：不安装这个插件而是用纯代码实现统计的，更简单了，直接修改你所用的代码即可**），所以本文就以这个插件的 ****the\_views()****函数为例进行说明如何设置一个基数。

### 方法一

修改文章页 ****single.php**** 文件,打开主题文件夹中的 ****single.php ****文件，一般都能找到以下代码：

    the\_views();

这个代码就是输出当前文章的浏览数（阅读量）。所以想要增加一个基数，我们只需要修改这个代码即可。比如增加基数为 1000 的，那么上述代码可以修改为：

    (1000 + the\_views(false));

或者修改为：

    (1000 + (int) get\_post\_meta( get\_the\_ID(), 'views', true ));

以上代码中的 1000 就是浏览数的基数，可以自行修改。有些站长说固定基数不好，想要指定一个范围内的随机数作为基数，比如在 500 到 999 之间，那么我们只需要将上述代码中的 1000 改为 rand(500,999)即可，完整代码如下：

    (rand(500,999) + the\_views(false));

这种随机显示的浏览数，boke112 倒是认为不可取，因为随机数我们无法把控，这就会造成这篇文章浏览数一会儿高一会儿低，估计会对用户或搜索引擎产生不好的影响，所以还不如设置一个固定的基数呢。

### 方法二

设置自定义字段 ***views***的值，安装有 ***WP-PostViews*** 插件的，发布文章的时候都会自动添加一个自定义字段 ***views***，它的值就是该篇文章的浏览数（阅读量）。所以我们不想修改代码的情况下完全可以在编辑文章的时候直接设置该 ***views*** 的值。 1. 新发布的文章：我们在编辑文章的时候，在编辑器下方找到自定义字段，点击名称右侧的倒三角找到并选择 ***views***，然后在值中输入如 888，然后点击【添加自定义栏目】，最后发布文章后就会直接显示浏览数为 888 了。