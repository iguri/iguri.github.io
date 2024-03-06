---
title: HTTP请求转发到HTTPS Nginx版
tags:
  - Nginx.SSL
  - wordpress
  - 网站日记
id: '415'
slug: e685
categories: 折腾记
date: 2020-04-07 17:24:50
---
在腾讯云上申请到了免费的SSL证书，于是开始了折腾网站切换到了https，这时如果在使用http访问，即出现HTTP 400错误，所以需要设置Nginx将http请求跳转到https。

一开始查到一些配置方案，比如这篇，但是方案一使用后出现**400 Bad Request. The plain HTTP request was sent to HTTPS port，**方案二太麻烦没试，方案三仅能跳转首页。

腾讯云的SSL配置教程和方案一一样也建议使用**rewrite ^(.\*) https://$host$1 permanent;，**但是实际是在我这里**400 Bad Request**，事实上我的Nginx是1.10.3版，很可能已经不支持那个指令了。

经过我搜索试错，再第n次我成功了... 其实也很简单的原理， 配置文件里加入以下这段代码：

```css
server {
listen 80;
#listen \[::\]:80; // IPv6监控相关，我选择关闭
 
server\_name www.grins.top;  //替换成你的域名
 
return 301 http://demo.blog.2sxs.net$request\_uri; //替换成你的域名
}
 
server {
// other server block
}
```

就ok了，只是在坑里的时候觉得好难搞