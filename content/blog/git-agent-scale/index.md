---
title: "8 个 agent 抢一个工作副本，7 个死在 index.lock 上"
date: 2026-11-10T16:30:00+08:00
summary: "8 个 agent 共用一个工作副本，7 个死在 index.lock；换 worktree 后全过，附克隆实测。"
tags: ["git", "AI Agent", "Claude Code"]
categories: 折腾笔记
author: "甲拉古日"
slug: git-agent-scale
draft: false
---

我在同一个工作副本里放了 8 个 agent 并行干活，收工时只有 1 个提交成功。剩下 7 个的报错一模一样：

```text
fatal: Unable to create '/root/exp/agent/.git/index.lock': File exists.
```

这不是查出来的，是数出来的：8 个进程各自写一个文件、`git add`、`git commit`，跑完 `git rev-list --count HEAD` 从 98 变成 99——8 个里活了 1 个。

## 一把锁，串起所有 agent

`.git/index.lock` 不是可以绕过去的实现细节。提交要改 `.git/index`，而这个文件在整个仓库里只有一份，git 靠一个 lockfile 独占它。独占不到就直接报错退出，没有排队，没有重试。

所以「一个工作副本 = 一个 index = 一把锁 = 一个串行点」。你把 agent 数量乘以 8，这个串行点不会变粗，只会让撞锁概率变成 8 倍。

顺带记一笔：这把锁是进程级的。我跑崩过一次，`.git/index.lock` 留在原地，之后所有 git 命令全失败，`git status` 也只回一句「另有一个 git 进程在跑」。手动删掉才恢复。所以真上 agent 之后，这个残留锁会变成一个需要人盯的故障点——它不会自己消失。

## worktree：换掉的不是锁，是「同一把」

```bash
git worktree add ../agent-42 -b agent-42 main
```

同样的 8 并发，换成 8 个 worktree，8 个全过，8 个独立分支。

原因很实在：worktree 的 `.git` 不是目录，是一个 50 字节的文本文件，里面一行 `gitdir: /root/exp/agent/.git/worktrees/wt_demo`。真正的对象库还是共享的那一份，但每个 worktree 有**自己的 index、自己的 HEAD、自己的锁**。锁不再争用，因为根本不是同一把。

加一个 worktree 我这边耗时 179ms。磁盘代价得说准：主仓库 `.git` 是 48MB，这个数不会因为开 worktree 变两倍——变的是检出文件，一个 worktree 目录 51MB，基本全是工作副本里那些文件。开 8 个就是 8 份检出，不是 8 份历史。

我第一次测的时候还翻了个车：worktree 建完之后，我直接在共享的 `.git/config` 里写 `user.email`，8 个进程同时写配置文件，又撞出一个 `could not lock config file`。配置在克隆时设一次就行，别让每个 agent 自己去 `git config`。这一条很容易漏，因为它跟 index 锁不是一个文件、也不是同一个报错。

## 服务端那层：同一个分支出 3 个进 5 个

客户端解决了，还有服务端。我在本机起了一个裸仓库，8 个克隆并发往**同一个分支**推：

```text
pushes to SAME branch:   ok=3  fail=5
! [rejected]  master -> master (fetch first)
```

再换 8 个克隆，各自推**不同分支**：`ok=8 fail=0`。

这条结果比我预想的更能说明问题。拒绝的原因不是服务器扛不住并发，而是 ref 的 compare-and-swap：`master` 这一行被 8 个人抢，抢到的先动，后到的发现远端已经不在自己以为的位置，直接 `fetch first`。换了分支名，争用的对象就不存在了，服务器一点没更努力，8 个全部成功。

也就是说 Git 的写路径从客户端到服务端是同一个形状：**争用点是「具名的那个东西」**，客户端是 `.git/index`，服务端是 ref。其余部分本来就是并行的，不用改。

## 我以为 `--filter=blob:none` 能省下大头，结果本地仓库根本没理我

站里这个 Hugo 仓库 48MB，对象 4715 个。我按网上的说法试了部分克隆：

```bash
git clone --filter=blob:none --no-checkout file:///root/blog/grer.cn partial
```

克隆出来 `.git` 还是 48MB，对象还是 4715 个，只有一行不起眼的警告：

```text
warning: filtering not recognized by server, ignoring
```

原因在服务端的 `uploadpack.allowFilter`，git 2.47.3 里默认 `false`。同一个仓库，把这个开关打开再克隆一次，`.git` 变成 302KB、2273 个对象，110ms 跑完。差别不在客户端参数写没写对，在服务端允不允许。

托管平台呢？拿 hugo 的仓库试了一下，全量 154MB／127 秒，blobless 12MB／87 秒。全量的包 156326KB，blobless 的包 10936KB，正好 14 倍。GitHub 是支持 filter 的——所以别拿自己机器上那条 warning 去判断托管方，这是两件事。

顺带说一句，blobless 克隆出来的仓库不是不能用：我做了 sparse checkout 只留一个 bundle 目录，`.git` 顶到 592KB，`git log` 照样能在缺 blob 的情况下回答提交历史。缺的是文件内容，不是历史。

## 稀疏检出在我这儿没能用起来

```bash
git sparse-checkout set content/blog/go-json-v2-migration
```

只留一个目录确实干净。但 Hugo 构建要读全部 `content/`，稀疏检出留一个目录，构建直接缺页。

所以这条我只在「agent 只需要读一两篇文章」的场景开，构建和本地预览都走全量。工具对不对，得看你的构建是不是真的只需要一部分——我这类静态站点构建天然要全量，省不下来。

## 两家大厂把同一条锁放大了

掘金上那篇《agent 撑爆 Git 之后，两家改的不是同一层》把 OpenAI 的 Pando 和 Anthropic 的 Scion 摊在一起比。数字先摆着：OpenAI 把中位推送延迟压到原来的五分之一，Anthropic 的改动量从 5 月每天约 2500 个涨到 9 月每天超过 3 万，主分支历史近 100GB，压缩后的工作副本还有 25GB 以上。

Pando 的做法是把「按仓库协调」降成「按分支协调」——推 foo 的人不用等推 bar 的人，再配合复用 packfile，一份字节可以发给成千上万个客户端。代价写得很明确：仓库不再有一个「此刻所有分支都长这样」的统一时间点，只剩因果一致性。

我在裸仓库上跑出来的 `same branch 3/8` 和 `different branches 8/8`，其实就是同一件事的缩小版：Pando 没有发明新机制，它是把「争用点从仓库降级到分支」这件事推到了工程实现上。我这边 8 个进程能给到的证据很弱，但方向对得上。

Anthropic 换得更彻底，客户端不再持有完整仓库，提交、rebase、合并全在服务端做。他们自己划的边界是：Scion 绝不是 git 的通用替代品，只有几万个工程师或者成群 agent 猛写代码的超大仓库，这套才说得通。还有一句我觉得最狠——行业标准合并队列是给仓库上一把全局锁，而他们没能在 agent 规模下复刻这把锁，于是把门挪到合并之后，改成靠 post-merge、pre-deploy 的测试兜，主干允许坏一段时间。

这两篇的方案我一样都用不上，但有一句话可以搬回来：**合并队列那把全局锁，就是我 `.git/index.lock` 的放大版**。我改不了服务端，能动的只有「几个 agent 共享同一个 index」这件事。

## 现在就能量的三个数

如果你开始在一台机器上并排跑 agent，先量这三个，不用等文章讲完：

- 同一个工作副本上同时 `git commit` 的进程数——超过 1 就开始丢提交
- `git worktree list | wc -l`——等于你实际能跑的 agent 并发上限
- 单次检出耗时——这个数进到分钟级，稀疏检出和 blobless 才值得折腾

我这边第一个数是 8，第二个是 1，于是 7 个提交没了。

`git config --get uploadpack.allowFilter` 在我自己的服务器上返回的还是空。要不要为了 agent 把 filter 打开，我还没定：开了之后所有依赖全量对象的构建都要重新验一遍，而我这套 Hugo 构建恰好是全量依赖的那一类。所以最近只敢把 worktree 开到底，配置文件在克隆时写死，谁也别再碰 `.git/config`。
