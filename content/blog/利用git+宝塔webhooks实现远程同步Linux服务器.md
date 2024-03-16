---
title: "利用git+宝塔webhooks实现远程同步Linux服务器"
date: 2022-05-08T16:36:06+08:00
author: "甲拉古日"
comments: # 评论
weight: # 置顶数字代替越小越前
tags:
  - webhooks
  - git
categories: 折腾笔记 # 分类 ! 灵感记录 生活 折腾笔记 日常水文 分享安利 !
cover:
    image: "" # 封面url
    alt: # 替换文本
    caption: # 封面标题
lastmod: 2022-05-08T16:36:06+08:00
summary: 
slug: 581720
draft: false
---

## 化简为繁

### 目前写文章的顺序有三个步骤；

1. 本地写好md文件
2. push到GitHub，利用GitHub Action实现自动部署到分支`gh-pages`
3. 用服务器端pull分支

之前更多，用上GitHub Action了还是省下了不少时间，那么可不可以再挤挤呢...当然可以，利用宝塔软件商店的webhooks就可以省下在服务器上pull的步骤。

## 充分利用GitHub Action和WebHook

### GitHub 你已经是个大人了，应该学会自己推送到服务器！！！
首先还是跟本地环境一样配置好，git服务就不用说了，服务器应该是自己就有的...吧。

1. 查看已安装的的git版本号：
```
root@VM-12-10-debian:~# git --version
git version 2.39.2
```

如果没有就安装：
```
apt install git
```

2. 生成密钥并添加到GitHub：
```
root@VM-12-10-debian:~# ssh-keygen -t rsa
Generating public/private rsa key pair.
Enter file in which to save the key (/root/.ssh/id_rsa): 
Enter passphrase (empty for no passphrase): 
Enter same passphrase again: 
Your identification has been saved in /root/.ssh/id_rsa
Your public key has been saved in /root/.ssh/id_rsa.pub
The key fingerprint is:
SHA256:DsvSMbNBFwo5VGDmhBOJOMF0vjqiW02ekRVkMjKLhvo root@VM-12-10-debian
The key's randomart image is:
+---[RSA 3072]----+
|=++*X== .        |
|=o*Oo= o .       |
|oo.o..+ .        |
|o   .+ .         |
|.  .+ * S        |
| ..+ = X         |
|.oE = = .        |
|o..  .           |
|o.               |
+----[SHA256]-----+
```

上面可以看出证书生成到了 `/root/.ssh/`目录，接着我们查看并复制到GitHub：
```
root@VM-12-10-debian:~# cd ~/.ssh
root@VM-12-10-debian:~/.ssh# ls
authorized_keys  id_ed25519  id_ed25519.pub  id_rsa  id_rsa.pub
root@VM-12-10-debian:~/.ssh# cat id_rsa.pub
ssh-rsa ****** root@VM-12-10-debian
```

宝塔软件安装`宝塔WebHook 2.0`，设置 > 添加；名称随意，执行脚本如下：

```shell
#!/bin/bash
echo ""
#输出当前时间
date --date='0 days ago' "+%Y-%m-%d %H:%M:%S"
echo "Start"
#判断宝塔WebHook参数是否存在
if [ ! -n "$1" ];
then 
          echo "param参数错误"
          echo "End"
          exit
fi
#本地存放路径
gitPath="/www/wwwroot/grinxxoo.github.io"
#github项目路径
gitHttp="https://github.com/grinxxoo/grinxxoo.github.io.git"

echo "Web站点路径：$gitPath"
#判断项目路径是否存在
if [ -d "$gitPath" ]; then
        cd $gitPath
        if [ ! -d ".git" ]; then
                echo "在该目录下克隆 git"
                git clone -b gh-pages $gitHttp gittemp
                mv gittemp/.git .
                rm -rf gittemp
        fi
        #拉取最新的项目文件
        git reset --hard gh-pages
        git pull
        #设置目录权限
        chown -R www:www $gitPath
        echo "End"
        exit
else
        echo "该项目路径不存在"
        echo "End"
        exit
fi
```

附：编辑栏会过滤掉代码，点击编辑再进去粘贴修改保存即可

保存完查看密钥，除了密钥下边有使用说明：

```
宝塔WebHook使用方法:
GET/POST:
http://ip:端口/hook?access_key=密钥&param=项目名
@param access_key string HOOK密钥
@param param string 自定义参数（在hook脚本中使用$1接收）
```

我们需要把它拆开来用，分别是:

```html
# 第一条
http://ip:端口/hook?access_key=密钥

# 第二条
&param=项目名

# 完整
http://ip:端口/hook?access_key=密钥&param=项目名
```

在GitHub的`gh-pages`分支，地址栏加上`settings/secrets/actions`回车，新建(New repository secret)两个分别是：

1. 名称填`WEBHOOK_URL` ，值填入我们拆出来的第一条
2. 名称填`WEBHOOK_SECRET`，值填入我们拆出来的第二条

### GitHub Action

然后回到我们的Action部署代码页代码(新增一段代码)：

```yaml
name: Hugo
on:
  push:
    branches:
      - master
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
          personal_token: ${{ secrets.personal_token }}
          PUBLISH_BRANCH: gh-pages
          PUBLISH_DIR: ./public
          commit_message: ${{ github.event.head_commit.message }}
          # 新增如下代码接尾部，注意格式空格
      - name: Webhook
        uses: distributhor/workflow-webhook@v1
        env:
          webhook_url: ${{ secrets.WEBHOOK_URL }}
          webhook_secret: ${{ secrets.WEBHOOK_SECRET }}
```

注意要把上面注释出来的内容改成你的。

