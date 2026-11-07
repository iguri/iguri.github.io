---
title: 给WordPress博客系统评论框显示用户UA
tags:
  - wordpress
  - 网站日记
slug: 2355
categories: 折腾笔记
cover:
    image: "wordpress.jpg"
    alt: # 替换文本
    caption: # 封面标题
date: 2020-03-30 01:54:19
aliases:
  - "/blog/2020/2355.html/index.html"
---
**User Agent**，简称 UA，通过HPPT头连同访问请求传递给服务器，使得服务器能够识别客户使用的操作系统及版本、CPU 类型、浏览器及版本、浏览器渲染引擎、浏览器语言、浏览器插件等，并依此为依据返回针对相应设备适配的网页和数据。

![wordpress](wordpress.jpg)

在WordPress中，用户提交评论甚至是用户访问，相应的 UA 信息都会储存到数据库中。如果感兴趣，可以查看 WordPress 数据库下的 `wp_comments` 表，里面有一项 `comment_agent` 即是评论的 UA 信息，因此很轻易地，我们可以通过调用各条评论的UA，来显示评论者的操作系统和浏览器等信息。 

WordPress 提供的函数中，如 `get_comment_author_IP` 可以直接调取评论者 IP，但同一数据表下的 `comment_agent` 却没有直接调取的函数，那么自己造一个吧。

在 WordPress 文档中发现，`get_comment_author_IP` 实际是由 `wp-includes/comment-template.php` 定义的，那么直接对它稍加改造就能调用 UA 了。

具体来说，在主题的 `function.php` 中直接加入下面一段函数，`get_comment_agent` 就造好了：

```php
comment_agent, $comment->comment_ID, $comment );
  }
  ?>
```

接下来我们需要一个转换函数把上面调取出来的UA字段转换为显示在用户屏幕上的内容，我的想法是使用icon font来显示，那么直接把UA输出到HTML标签上就好啦。

可是 User Agent 是一段类似 `Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36` 的文字，需要用正则拆分再用 UA 数据库匹配，实在太麻烦，我懒得做。幸好找到一个转换 UA 的 API，直接调用就行（这个数据库服务器好像有点不稳，偶尔掉线，不妨在 API 请求部分加一个超时条件）。

下面是UA转换的代码，添加到function.php中：

```php
agent_name; //Chrome / Android Webkit Browser / Safari / Firefox / BlackBerry / Internet Explorer / Edge
$OsType = $getua->os_type; //Windows / Android / Linux / Macintosh / BlackBerryOS 
$OsName = $getua->os_name; //Windows 10 / Windows 8 / Windows 8.1 / Windows 7 / Windows XP /  / Android / Linux / OS X / iPhone OS / BlackBerryOS / FreeBSD
$LinuxDistibution = $getua->linux_distibution; //Ubuntu / CentOS / Fedora / Debian / Red Hat
 
// Browser name
if (($AgentName == "Chrome") || ($AgentName == "Android Webkit Browser") || ($AgentName == "Safari") || ($AgentName == "Firefox") || ($AgentName == "BlackBerry") || ($AgentName == "Internet Explorer") || ($AgentName == "Edge")) {
    if (($AgentName == "Android Webkit Browser") || ($AgentName == "Internet Explorer")) {
        $print_browser = str_replace( " ", "-",$AgentName);
    } else {
        $print_browser = $AgentName;
    }
}
else {
    $print_browser = "unkwon-browser";
}
 
// System name
if (($LinuxDistibution == "Ubuntu") || ($LinuxDistibution == "CentOS") || ($LinuxDistibution == "Fedora") || ($LinuxDistibution == "Debian") || ($LinuxDistibution == "Red Hat")) {
    if ($LinuxDistibution == "Red Hat") {
        $print_system = str_replace( " ", "-",$LinuxDistibution);
    } else {
        $print_system = $LinuxDistibution; // Linux Distributions
    }
} elseif (($OsName == "Windows 10") || ($OsName == " Windows 8") || ($OsName == "Windows 7") || ($OsName == "Windows XP") || ($OsName == "Android") || ($OsName == "Linux") || ($OsName == "OS X") || ($OsName == "iPhone OS") || ($OsName == "BlackBerryOS") || ($OsName == "FreeBSD")) {
    if (($OsName == "Windows 10") || ($OsName == " Windows 8") || ($OsName == "Windows 8.1") || ($OsName == "Windows 7") || ($OsName == "Windows XP") || ($OsName == "OS X") || ($OsName == "iPhone OS")) {
        $print_system = str_replace( " ", "-",$OsName);
    } elseif ($OsName == "Windows 8.1") {
        $print_system = "Windows-9";
    } else {
        $print_system = $OsName; // OS name like Windows 10, iPhone
    }
} elseif (($OsType == "Windows") || ($OsType == "Android") || ($OsType == "Linux") || ($OsType == "Macintosh") || ($OsType == "BlackBerryOS")) {
    $print_system = $OsType; // No specified OS info
} else { 
    $print_system = "unkwon-system";
}
 
return "  ";
//return ""; 
//return $print_system . $print_browser;
//return $ua;
}
?>
```

然后呢，在function.php中找到类似的一段代码，这附近就是评论框了，主题不同内容也略有不同，在合适的位置加上一句即可调用转换后的内容，直接以的形式输出在HTML中。然后你就可以导入自己的icon font来渲染啦。

你可以直接用我搭配好的，HTML中引入：

```css
.icon {
 width: 1em; height: 1em;
 vertical-align: -0.15em;
 fill: currentColor;
 overflow: hidden;
 } 
```

Icon font可以在阿里巴巴矢量图标库中自由配置（需要按照上面转换代码中的注释重命class名，注意我把所有空格转换成了-），最后直接引入相应的CSS或者JS即可，如果网页中已经引入了Font Awesome，那么你可以修改上面的函数以使用fa fa icon。

**注意：因为每一条UA的处理都需要访问外部API，所以页面请求时间会变长，建议控制每页显示评论数量，善用评论的翻页功能；或者尝试建立本地的UA字符串匹配。**