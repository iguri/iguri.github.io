---
title: "复习GitHub并使用Actions自动化部署"
date: 2022-04-14T11:14:21+08:00
tags:
  - GitHub Actions
  - Hugo
slug: 414a
categories: 折腾笔记 # 分类 ! 灵感记录 生活 折腾笔记 日常水文 分享安利 !
lastmod: 2022-04-14T11:14:21+08:00
author: "GRer"
draft: false
---

一直使用GitHub Pages作为境外托管平台，在墙外GitHub是真的强，ms从不超过两位数，但是墙内还是会抽风，所以我的方案都是把GitHub解析到境外。

接触GitHub也有小几年但是我一直都是使用传统的方式pull和push，今天突发奇想用上已经烂大街的GitHub Actions，实测效果很nice~~

## 创建github仓库

账号什么的这里就不哔哔了，直接从建库开始！

新建一个`github用户名.github.io`的仓库，顺便建一个 `gh-pages` 分支(也可以放在两个仓库)，创建链接：

**生成ssh**:

```html
ssh-keygen -t rsa -C "your_email@example.com"
```

- -t 指定密钥类型，默认`rsa`
- -C 设置注释
- -f 指定密钥存储的文件名，默认`/c/Users/you/.ssh/id_rsa`

接着无脑回车就行，中间会让你输入密码什么的可以设置也可以忽略，反正现在也只能用toke了，当出现以下字符就算是成功生成本地ssh key了：

```html
Your identification has been saved in /c/Users/you/.ssh/id_rsa.
# Your public key has been saved in /c/Users/you/.ssh/id_rsa.pub.
# The key fingerprint is:
# 01:0f:f4:3b:ca:85:d6:17:a1:7d:f0:68:9d:f0:a2:db your_email@example.com
```

**将ssh key添加到github**

- 复制`id_rsa.pub`文件的内存，最好全县复制要不然可能会漏掉空格字符，
- GitHub>Settings>Account Settings>侧栏SSH key，Title随意，下面粘贴复制的内容

测试一下：

```html
ssh -t git@github.com
```

如果没有报错会出现：

```html
The authenticity of host 'github.com (207.97.227.239)' can't be established.
# RSA key fingerprint is 16:27:ac:a5:76:28:2d:36:63:1b:56:4d:eb:df:a6:48.
# Are you sure you want to continue connecting (yes/no)?
```

yes回车，输入刚刚创建SSH时设置的密码，没有设置就不需要密码，后续push不能用密码，只能token

```html
Hi username! You've successfully authenticated, but GitHub does not
# provide shell access.
```

密码正确后你会看到上面这段话，如果用户名是正确的,你已经成功设置SSH密钥。如果你看到 `access denied`，则表示拒绝访问，那么你就需要使用 https 去访问，而不是 SSH 。

**本地和GitHub第一次建立链接**

先将远程仓库clone到本地：

```html
git clone https://github.com/用户名/仓库名.git
# 例 git clone https://github.com/grinxxoo/grinxxoo.github.io.git
```

将本地修改后

``` html
git add .
git commit -m "描述"
# 代码分别执行回车，第一次coomit后会提示 please tell me who are...等信息
```

按照所提示设置：

```html
git config --global user.name "your name"
git config --global user.email "your_email@youremail.com"
# 如无报错就算建立链接了
```



## 上传已生成的hugo

这里指的是源文件，就是最开始用`hugo new site filename`生成的站点目录，复制到上面clone下来的仓库里，然后整个push到github仓库（uname.github.io)：

```
git add .
```

```
git commit -m "上传hugo博客源文件"
```

```
git push origin master
# 除了第一次指定分支 后续可以简写如下
git push
```

### 创建toke key

- github创建一个`toke key`，`note`栏随意**勾选repo和workflow**也可以全选，一劳永逸，**复制生成的toke key保存好，只显示一次**
- 进项目(刚刚上传的仓库master分支)，`settings>secrets >actions >new repository secret`： 标题`personal_token`，内容粘贴刚刚生成的`token`
- 返回项目(master), `actions > new wordflow > set up a workflow yourself : `将内容修改为：

```yaml
name: Hugo # 随意
on:
  push:
    branches:
      - master   # master 更新触发
jobs:
  build-deploy:
    runs-on: ubuntu-18.04
    steps:
      - uses: actions/checkout@v1
      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: latest
      - name: Build 
        run: hugo
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          personal_token: ${{ secrets.personal_token }} # 这里和刚刚设置的token相呼应，可以改但是两处要保持一样
          PUBLISH_BRANCH: gh-pages  # 推送到刚刚创建的 gh-pages 分支
          PUBLISH_DIR: ./public  # hugo 默认的生成根目录
          commit_message: ${{ github.event.head_commit.message }}
```

保持完等几秒就会触发自动部署，自动将生成的`public`内容推送到`gh-pages`分支，以后可以实现在线发博文了，直接在master分支修改，当内容产生改动就会触发Actions，化繁为简~~~
