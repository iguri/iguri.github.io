---
title: "利用宝塔自动计划主动推送sitemap"
date: 2022-05-06T19:16:28+08:00
author: "GRer"
comments: # 评论
weight: # 置顶数字代替越小越前
tags:
  - 宝塔
  - 自动计划
  -
categories: 折腾笔记 # 分类 ! 灵感记录 生活 折腾笔记 日常水文 分享安利 !
cover:
    image: "" # 封面url
    alt: # 替换文本
    caption: # 封面标题
lastmod: 2022-05-06T19:16:28+08:00
summary: 
slug: 50619
draft: false
---

**今天分享可以利用宝塔计划任务实现百度自动推送代码实例及教程**

在网站根目录新建一个文件夹或直接新建php，我的是在根目录新建了一个tool文件夹，文件夹里面新建一个`名字.php`张贴以下代码：

```php
<?php
header('Content-Type:text/html;charset=utf-8');
$xmldata =file_get_contents("https://www.grer.cn/sitemap.xml");
$xmlstring = simplexml_load_string($xmldata,'SimpleXMLElement',LIBXML_NOCDATA);
$value_array = json_decode(json_encode($xmlstring),true);
$url = [];
for ($i =0;$i < count($value_array['url']);$i++){
    echo $value_array['url'][$i]['loc']."<br/>";
    $url[]= $value_array['url'][$i]['loc'];
}
$api ='百度站长的推送接口';
$ch = curl_init();
$options = array(
   CURLOPT_URL => $api,
   CURLOPT_POST => true,
   CURLOPT_RETURNTRANSFER => true,
   CURLOPT_POSTFIELDS => implode("\n",$url),
   CURLOPT_HTTPHEADER => array('Content-Type:text/plain'),
);
curl_setopt_array($ch, $options);
$result =curl_exec($ch);
echo $result;
?>
```



以上代码需要修改第`3`行为你的`sitemap.xml`路径，第`11`行是你的`百度api接口`！

打开宝塔的`计划任务`栏新建：

* 任务类型：访问URL
* 任务名称：随意
* 执行周期：每天 （sitemap主动推送每天只能一次，执行时间也随便）
* URL地址：https://www.grer.cn/api/tool/bdsitemap.php（刚刚新建的php文件路径）

保存，然后手动执行看看日志是否成功。

成功返回示例：

```js
{
    "remain":99998,
    "success":2,
    "not_same_site":[],
    "not_valid":[]
}
```

这就完事了，以后会自动在你设置的时间段执行访问一次。
