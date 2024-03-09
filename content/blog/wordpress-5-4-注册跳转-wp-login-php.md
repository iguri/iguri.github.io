---
title: "WordPress 5.4 注册跳转 wp-login.php?"
tags:
  - wordpress
  - BUG
slug: '75bd'
categories: 折腾笔记 # 分类 ! 灵感记录 生活 折腾笔记 日常水文 分享安利 !
date: 2020-04-11 17:32:46
---
前几天升级了下 5.4，也是忘了之前用的是什么古老的版本，完事后也没发现什么问题，今天看到了个有关注册的评论，拿自己站试了下，发现注册后跳转到了 ***[https://wp-login.php/?checkemail=registered](https://wp-login.php/?checkemail=registered) ，**What the F\*\*k? 域名被你吃了啊？

然后拉出个旧版本备份比对了下，问题在 **/wp-includes/pluggable.php**这个文件上，直接把 1399-1405 行删了就完事了，相当于把这个文件回退到上一个版本。

    if ( ! isset( $lp['host'] ) && ! empty( $lp['path'] ) && '/' !== $lp['path'][0] ) {
    	$path = '';
    if ( ! empty( $_SERVER['REQUEST_URI'] ) ) {
    	$path = dirname( parse_url( 'http://placeholder' . $_SERVER['REQUEST_URI'], PHP_URL_PATH ) . '?' );
    	}
    	$location = '/' . ltrim( $path . '/', '/' ) . $location;
    	}