---
title: WordPress博客域名完美更换详细教程
tags:
  - Navicat
  - 教程
  - 更换域名
comments: false
slug: cec8
categories:
  - 折腾记
date: 2020-04-08 20:37:00
---
**WordPress** 网站域名完美更换详细教程 网站域名更换这是站长们经常遇到的问题，博主最近也遇到这个问题，操作记录下来以备不时之需。 

不管是个人网站还是企业网站，一般都不建议更换网站域名，因为这不但会影响网站在搜索引擎结果中的排名，减少网站的访问量，同时还会在网站用户中留下不好印象。最好是能不换就不换吧。

我们以手头的演示网站为例，介绍一下如何将 WordPress 网站的域名从旧域名 **www.muyixi.cn** 更换为新域名 **www.grins.top** 。

### 第一步
**开始之前，最重要的是做好网站的备份，备份好网站数据库和网站文件。尤其是数据库，一定要做好备份，以防操作过程中出现错误，我们可以使用备份的数据库重新进行操作。**

### 第二步
将新域名做好解析和绑定操作。解析新域名，就是将域名指向服务器的 IP 地址，通常在域名商那里进行操作；绑定新域名，通常在空间商那里进行操作，就是在服务器上添加新域名，并确保网站目录和旧域名的网站目录一致。

完成以上两步之后，需要确认新域名生效之后，再继续进行以下操作。

新域名设置解析后，通常需要一段时间才能传递到各地网络，各地生效时间并不一致，通常需要几分钟或者几个小时，最多不会超过 48 小时，你可以使用 ping 命令来检查，来查看新域名是否生效，如果 ping 出来的 ip 地址是刚刚设置的 ip，那么解析就生效了，新域名生效之后，这个时候在浏览器中输入新域名和旧域名，都可以打开原来的网站，如果旧域名已经失效，比如说已经过期，或者已经解析到其他地方等，那么网站虽然可以打开，但网页看起来会比较乱；这是因为网页无法正常加载 WordPress 主题的样式表。

### 第三步
登录主机管理系统，进入 **phpmyadmin**，选择 **WordPress** 网站所使用的数据库。如果你不确定 WordPress 使用的是哪一个数据库，可以查看 WordPress 目录下的 wp-config.php 配置文件，查看其中的 DB\_NAME 设置。 选中该数据库之后，点击 SQL，输入以下代码：

    UPDATE wp\_options SET option\_value = replace(option\_value, 'www.muyixi.cn','www.grins.top') ;
    UPDATE wp\_posts SET post\_content = replace(post\_content, 'www.muyixi.cn','www.grins.top') ;
    UPDATE wp\_comments SET comment\_content = replace(comment\_content, 'www.muyixi.cn', 'www.grins.top') ;
    UPDATE wp\_comments SET comment\_author\_url = replace(comment\_author\_url, 'www.muyixi.cn', 'www.grins.top') ;

以上代码中，**www.muyixi.cn** 代表原来的域名，**www.grins.top** 代表新域名。域名一定要输入完整；如果你使用类似 blog.grins.top 这样的二级域名，也是可以的，只要输入完整域名就可以了。

博主直接用的 Navicat 工具，用起来更加方便，直接先在数据库中搜索要替换的字段，确定到在哪几张表中，再用上面的 sql 语句来替换，当然不仅仅限于替换域名，其他也是可以的。

**与直接在 WordPress 的管理后台修改域名相比，今天介绍的这个办法有两个优点：**

1. 即便旧域名已经失效了，也可以更换新域名；因为整个操作过程中，根本不需要登陆 WordPress 的管理后台。
2. 更换比较彻底，不光更换了网站的域名，连文章内部的链接，图片和音视频等媒体文件的地址、链接，以及评论中的链接等，都一起进行了更换。


因此，通过以上操作，可以比较完美地更换 WordPress 网站域名。 嫌弃太麻烦的可以wp后台搜下，应该有此效果的wp插件