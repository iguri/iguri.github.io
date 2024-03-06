---
title: GRTask使用文档
tags:
  - 自动化
  - 云任务
  - GRTask
author: GRer
slug: tuog
categories: 文档
date: 2022-04-04 18:34:35
---

### GRTask是什么？

这是一个自动化的托管系统，目前支持网易云签到刷歌，bilibili赚经验+自动赛事预测，米游社原神签到，部署至服务器和你的小伙伴一起赚经验吧。

### 使用文档

- 新建托管任务请先注册或登录一个账号
- 本项目默认会在早上8点开始执行任务，中午12点更新网易云状态信息
- 任务执行完成之后，可前往`我的任务`中查看上一次的运行日志。

#### `bilibili`

支持`b站签到任务`以及`赛事预测任务`，赛事预测默认会跟着押注多的一方押注，可以在配置中更改为反向押注。

使用扫码自动填充cookie值**（推荐！！）**

使用cookie登录

- 使用电脑端浏览器登录bilibili
- 右键选择`审查元素`或者按`f12`调出开发者工具
- 选择`应用程序/Application`
- 找到左边`储存/Storage`一栏并找到`Cookie/Cookies`一项
- 选择`bilibili.com`并查看cookie值

##### 进阶设置

下面是给出的一张参数参考，页面中已经提供了翻译，如果想查看详情的话请对照下表

大部分配置参数依赖于[BILIBILI-HELPER-PRE](https://github.com/JunzhouLiu/BILIBILI-HELPER-PRE)（貌似已删库跑路了）

|         Key          |        Value         |                             说明                             |
| :------------------: | :------------------: | :----------------------------------------------------------: |
|      matchGame       |     [false,true]     |                      是否开启赛事预测。                      |
|    showHandModel     |     [false,true]     |             true ：压赔率高的，false：压赔率低的             |
| predictNumberOfCoins |         1-10         |                  单次预测的硬币数量,默认为1                  |
| minimumNumberOfCoins |      [1,无穷大]      |           预留的硬币数，低于此数量不执行赛事预测。           |
|   taskIntervalTime   |      [1,无穷大]      | 任务之间的执行间隔,默认10秒,**为了避免服务器资源被恶意利用，可以设置的最大时间为20s** |
|    numberOfCoins     |        [0,5]         |             每日投币数量,默认 5 ,为 0 时则不投币             |
|     reserveCoins     |       [0,4000]       | 预留的硬币数，当硬币余额小于这个值时，不会进行投币任务，默认值为 50 |
|      selectLike      |        [0,1]         |             投币时是否点赞，默认 0, 0：否 1：是              |
|  monthEndAutoCharge  |     [false,true]     |      年度大会员月底是否用 B 币券自动充电，默认 `true`。      |
|       giveGift       |     [false,true]     |    直播送出即将过期的礼物，默认开启，如需关闭请改为 false    |
|        upLive        | [0,送礼 up 主的 uid] | 直播送出即将过期的礼物，指定 up 主，为 0 时则随随机选取一个 up 主 |
|    chargeForLove     |   [充电对象的 uid]   |        给指定 up 主充电，值为充电对象的 uid ,默认为0         |
|      chargeDay       |       [1，28]        |                        默认为每月28号                        |
|    devicePlatform    |    [ios,android]     |  手机端漫画签到时的平台，建议选择你设备的平台 ，默认 `ios`   |
|   coinAddPriority    |        [0,1]         |        0：优先给热榜视频投币，1：优先给关注的 up 投币        |
|      userAgent       |      浏览器 UA       |  用户可根据部署平台配置，可根据 userAgent 参数列表自由选取   |
|    skipDailyTask     |     [false,true]     | 是否跳过每日任务，默认`true`,如果关闭跳过每日任务，请改为`false` |

**tips:如果你没有上传过视频并开启充电计划，充电会失败，B 币券会浪费。此时建议配置为给指定的 up 主充电。&& 如果选择为指定up充电，请务必填写正确值**

**userAgent 可选参数列表**

|   平台    |     浏览器     |                          userAgent                           |
| :-------: | :------------: | :----------------------------------------------------------: |
| Windows10 | EDGE(chromium) | Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36 Edg/86.0.622.69 |
| Windows10 |     Chrome     | Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36 |
|   masOS   |     safari     | Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15 |
|   macOS   |    Firefox     | Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:65.0) Gecko/20100101 Firefox/65.0 |
|   macOS   |     Chrome     | Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36 |

*ps：如果尝试给关注的 up 投币十次后（保不准你关注的是年更 up 主），还没完成每日投币任务，则切换成热榜模式，给热榜视频投币*

*投币数量代码做了处理，如果本日投币不能获得经验了，则不会投币，每天只投能获得经验的硬币。假设你设置每日投币 3 个，早上 7 点你自己投了 2 个硬币，则十点半时，程序只会投 1 个）*

#### `网易云音乐`

仅支持使用手机号和密码登录，国内手机号不用填国家代码。别的都是字面意思

#### `米游社`

暂时只支持原神签到任务以及米游币任务，关于cookie的获取教程如下:

注意，米游社获取的cookie必须包括`account_id/ltuid/login_uid`和`cookie_token`字段，否则会被视为无效cookie

米游社获取的cookie中现在已经没有`login_ticket`字段了，如果需要使用米游币任务，请前往`米哈游通行证`处获取：https://user.mihoyo.com/

如果您一个cookie中都包含了上述这些必要字段，第二项cookie就不用写了

如果第一次添加任务的时候没有输入米哈游通行证的cookie或者cookie失效导致米游币任务执行失败，您可以在`编辑`功能中重新追加。

**米游币任务会执行以下几项内容：**

1. 社区签到
2. 点赞
3. 分享
4. 浏览

##### 电脑端

请尽量使用**浏览器无痕模式**来进行以下操作，否则注销账户之后，获取的cookie也会随之失效！

懂行的人可以直接略过，直接从浏览器f12复制cookie就完事了，其他在`添加米游社任务页面`给出了提示，

1. 将这个红色标签拖动到`书签栏`
2. 登录米游社，注意一定要登录
3. 打开 `米游社通行证/米游社` 页面
4. 点击刚刚拖到书签的标签复制cookie即可

##### JS代码

```js
javascript:(function(){let domain=document.domain;let cookie=document.cookie;prompt(Cookies: ${domain}, cookie)})();
```

##### 手机端

1. 收藏本页面
2. 进入书签栏编辑刚刚加入的书签
3. 将地址改为刚刚的js代码并保存
4. 打开`米哈游通行证/米游社`页面并登录
5. 点击刚刚收藏的书签会弹出一个框，复制中间的cookie即可

#### 订阅执行结果

本项目主体推送部分代码由[BILIBILI-HELPER-PRE](https://github.com/JunzhouLiu/BILIBILI-HELPER-PRE)修改而成，使用webhook推送有两种方式：

1. 在新建任务时填入webhook，这种方式仅对这个任务生效。
2. 使用全局webhook：在个人中心设置中设定全局webhook。

> 当同时存在单任务webhook和全局webhook时，程序会默认选择单任务webhook进行推送，只有在推送失败时才会使用全局webhook

**目前推送部分代码为json字符串形式传入，在填写webhook的页面中已经给出了[生成器](//task.grer.cn/webhook-generate)页面，请使用[生成器](//task.grer.cn/webhook-generate)生成之后复制到webhook一栏。**

目前项目的推送支持：

- server 酱
- server 酱 Turbo
- Telegram
- PUSH PLUS
- 钉钉
- 企业微信

#### Server 酱 Turbo 版

1. 前往 [sct.ftqq.com](https://sct.ftqq.com/sendkey)点击登入，创建账号。
2. 点击点[SendKey](https://sct.ftqq.com/sendkey) ，生成一个 Key
3. 进入[生成页面](//task.grer.cn/webhook-generate)，选择server酱turbo，填入key
4. [配置消息通道](https://sct.ftqq.com/forward) ，选择方糖服务号，保存即可。

#### 钉钉机器人

1. 首先你得有个钉钉企业 [快速注册](https://oa.dingtalk.com/register.html)
2. [进入钉钉开放平台添加机器人](https://open-dev.dingtalk.com/#/corprobot)

目前钉钉机器人有两种认证方式，两种方式均需要填入`推送地址（webhook）`：

1. 加签（secret）
   1. 在机器人安全设置中选择`加签`，机器人会生成一串密钥，复制下来
   2. 在生成页面中选择钉钉并将推送方式改为`加签`，填入webhook推送地址以及secret
2. 自定义关键词
   1. 添加自定义关键词：`HELPER`
   2. 在[生成页面](//task.grer.cn/webhook-generate)中选择钉钉并填入推送地址

结束

#### PushPlus(Push+)

1. [前往 PushPlus 登录并获取 Token](https://www.pushplus.plus/push2.html)
2. 进入[生成页面](//task.grer.cn/webhook-generate)选择PUSH PLUS
3. 将获取到的Token填入
4. 输出结果并复制到`webhook`一栏

#### Telegram

关于Telegram bot的创建，可以参考知乎这篇文章：[教程|Telegram Bot 搭建](https://zhuanlan.zhihu.com/p/59228574)

没有测试过，测试服务器为国内服务器，如有需要测试请使用国外服务器或反代

#### 企业微信

没有测试过（~~字段太多懒得研究~~）

#### 字段说明

字段和[BILIBILI-HELPER-PRE](https://github.com/JunzhouLiu/BILIBILI-HELPER-PRE)中的字段完全一致，如下表所示

|    字段类型     |       Key(字段)        |  Value(值)   |                             说明                             |
| :-------------: | :--------------------: | :----------: | :----------------------------------------------------------: |
|    server 酱    |         SC_KEY         |     str      |               Server 酱老版本 key，SCU 开头的                |
| server 酱 turbo |        SCT_KEY         |     str      |             Server 酱 Turbo 版本 key，SCT 开头的             |
|    Telegram     |   TG_USE_CUSTOM_URL    | [false,true] |                   是否开启 TGbot API 反代                    |
|    Telegram     |      TG_BOT_TOKEN      |     str      | TG 推送 bot_token,若开启反代，需填写完整反代 url `https://api.mytelegram.org/botTOKEN` |
|    Telegram     |       TG_USER_ID       |     str      |                  TG 推送的用户/群组/频道 ID                  |
|    PUSH PLUS    |    PUSH_PLUS_TOKEN     |     str      |                   push plus++推送的`token`                   |
|      钉钉       |     DING_TALK_URL      |     str      | 钉钉推送的完整 URL,e.g.`https://oapi.dingtalk.com/robot/send?access_token=xxx` |
|      钉钉       |    DING_TALK_SECRET    |     str      |                        钉钉推送的密钥                        |
|  正向推送代理   |    PROXY_HTTP_HOST     |     str      |            推送使用 HTTP 正向代理,e.g.`127.0.0.1`            |
|  正向推送代理   |   PROXY_SOCKET_HOST    |     str      |        推送使用 SOCKS(V4/V5)正向代理,e.g.`127.0.0.1`         |
|  正向推送代理   |       PROXY_PORT       |     int      |              推送正向代理的端口，默认 0 不代理               |
| 企业微信群消息  |      WE_COM_TOKEN      |     str      |                  企业微信，群消息非应用消息                  |
|  企业微信应用   |   WE_COM_APP_CORPID    |     str      | 企业 id 获取方式参考 :[获取](https://work.weixin.qq.com/wework_admin/frame#profile) |
|  企业微信应用   | WE_COM_APP_CORP_SECRET |     str      |                        应用的凭证密钥                        |
|  企业微信应用   |  WE_COM_APP_AGENT_ID   |     int      |                     企业应用的 id，整型                      |
|  企业微信应用   |   WE_COM_APP_TO_USER   |     str      |         指定接收消息的成员，成员 ID 列表 默认为@all          |
|  企业微信应用   |  WE_COM_APP_MEDIA_ID   |     str      | 缩略图的 media_id, 可以通过素材[管理接口](https://work.weixin.qq.com/wework_admin/frame#material/image)获得。(为空发送**文本消息**) |

- **tips:`PROXY_HTTP_HOST`和`PROXY_SOCKET_HOST`仅需填写一个。**
- **tips:钉钉推送密钥可不填，不填仅用关键词验证。**
- **获取 `media_id`的方式请参考`docs/images/media_id.png`**

### 项目部署

1. 首先准备好`application.yml`配置文件，模板文件可以在项目根目录找到或Releases中附，或者可以直接复制以下内容：

   ```yaml
   server:
     #服务器端口
     port: 26666
   spring:
     #数据库连接配置
     datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://数据库地址:3306/数据库名称?characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai
    username: 数据库用户名
    password: 数据库密码
     main:
    allow-bean-definition-overriding: true
     mvc: #静态文件
    static-path-pattern: /static/**
   # actable自动建表
   actable:
   table:
      auto: update
   model:
      #分号或者逗号隔开
      pack: com.oldwu.entity;com.oldwu.domain;com.netmusic.model;com.miyoushe.model
   database:
      type: mysql
   index:
      #自己定义的索引前缀#该配置项不设置默认使用actable_idx_
      prefix: INDEX_
   unique:
      #自己定义的唯一约束前缀#该配置项不设置默认使用actable_uni_
      prefix: INDEX_UNIQUE_
   # mybatis自有的配置信息，key也可能是：mybatis.mapperLocations
   mybatis-plus:
   #mapper配置文件
   mapper-locations: classpath:mapper/*.xml,classpath:mapper/**/*.xml,classpath*:com/gitee/sunchenbin/mybatis/actable/mapping/*/*.xml
   type-aliases-package: com.oldwu.entity
   #开启驼峰命名
   configuration:
      map-underscore-to-camel-case: true
      #输出mybatis日志
   #      log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
   ```

2. 在mysql中创建数据库并导入sql

3. 接下来你可以选择两种方式部署：

#### 使用 Releases 中打包好的jar运行

1. 将`application.yml`修改正确并放入jar包同级目录中
2. 使用`java -jar xxx.jar`运行

#### 自行编译

1. 导入idea并下载依赖（请使用JDK1.8）
2. 在`resources`文件夹放入`application.yml`配置文件（可选，你可以选择外置配置文件）
3. 使用maven install打包成jar
4. 使用`java -jar xxx.jar`运行

**后续步骤**：

注册账号，并将其定为管理员账户，步骤：

1. 查看`sys_user`表中你的账号对应的`id`
2. 进入`sys_role_user`表中找到对应的`user_id`
3. 将对应行的`sys_role_id`值改为1

一些定时任务的配置请登录管理员账号在`自动任务管理`中查看

**转自[oldwu博客](//blog.oldwu.top)，如果觉得好用，给[原仓库](//github.com/wyt1215819315/autoplan)点个star吧**