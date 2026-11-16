---
title: "Redis 的 TTL 不是倒计时：在 7.4.12 上把过期语义逐条跑了一遍"
date: 2026-11-16T18:35:00+08:00
summary: "TTL 返回 0 时键还活着、从库 dbsize 不减但不让读、GT 遇到无 TTL 的键返回 0。三处都实测过。"
tags: ["Redis", "TTL", "缓存"]
categories: 折腾笔记
author: "甲拉古日"
slug: "redis-ttl-expiry-semantics"
draft: false
---

```text
127.0.0.1:6379> SET z1 v PX 480
OK
127.0.0.1:6379> PTTL z1
(integer) 397
127.0.0.1:6379> TTL z1
(integer) 0
127.0.0.1:6379> GET z1
"v"
```

`TTL` 返回 0，`GET` 还能拿到值。这不是竞态，也不是 README 里说漏了。

我原来把 `TTL == 0` 当成「键已经过期、下一个命令就会返回 nil」，于是在业务层写了 `if ttl <= 0 then 重建缓存`。这个判断在毫秒级 TTL 上直接把缓存打成了穿透——每次读都命中 0，每次都重建。

下面这些数字全是在 `redis-server v7.4.12` 上跑出来的。起环境两条命令：

```bash
docker run -d --rm --name ttlprobe -p 6399:6379 redis:7-alpine
docker exec ttlprobe redis-server --version
# Redis server v=7.4.12 sha=00000000:0 malloc=jemalloc-5.3.0 bits=64
```

## TTL 返回的 0 不是「过期了」，是「不足一秒」

结论先给：`TTL` 只是 `PTTL` 的取整，规则是 `floor((pttl + 500) / 1000)`。

单看两个数字容易怀疑是采样时刻不同，所以我用 Lua 把它们塞进同一次调用，消掉时钟漂移：

```bash
docker exec ttlprobe redis-cli eval "
  local t = redis.call('time')
  local now = tonumber(t[1])*1000 + math.floor(tonumber(t[2])/1000)
  redis.call('set', KEYS[1], 'v')
  redis.call('pexpireat', KEYS[1], now + 499)
  return {redis.call('pttl', KEYS[1]), redis.call('ttl', KEYS[1])}" 1 rnd
```

把 `499` 换成 499 / 500 / 501、999 / 1000、1499 / 1500、2499 / 2500，逐档跑：

| 实际剩余 | PTTL | TTL |
|---|---|---|
| 499 ms | 499 | 0 |
| 500 ms | 500 | 1 |
| 999 ms | 999 | 1 |
| 1000 ms | 1000 | 1 |
| 1499 ms | 1499 | 1 |
| 1500 ms | 1500 | 2 |
| 2499 ms | 2499 | 2 |
| 2500 ms | 2500 | 3 |

四舍五入，不是向下取整。`PTTL = 500` 时 `TTL` 已经是 1。

我不信一档数据，又写了个 1..3000 毫秒的全量扫描，用 `floor((pttl+500)/1000)` 比对每次的真实返回：

```bash
docker exec ttlprobe redis-cli eval "
  local t=redis.call('time'); local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
  local bad=0
  for d=1,3000 do
    redis.call('set','q','v')
    redis.call('pexpireat','q',now+d)
    local p=redis.call('pttl','q'); local s=redis.call('ttl','q')
    if math.floor((p+500)/1000) ~= s then bad=bad+1 end
  end
  return bad" 0
# (integer) 0
```

3000 次，0 例外。所以 `TTL == 0` 的正确含义是「还剩 0～499 毫秒」，键完全可用。

那 `TTL` 为什么会返回 `-2`？因为负数是状态码，被过期判断覆盖掉了。我在同一次采样里抓到过 `pttl = 55, ttl = -2` 这种组合——剩 55 毫秒就该被删掉了，那个时刻键刚过期。业务代码里判断存活请一律用 `PTTL`，或者 `EXISTS`。

## EXPIRE 存的是绝对时刻，所以「剩多久」是算出来的

这是理解后面所有怪异行为的钥匙：`EXPIRE` 不存倒计时，它把相对秒数换成绝对毫秒时刻写进键里。

```bash
docker exec ttlprobe redis-cli set a v EX 100
docker exec ttlprobe redis-cli expiretime a      # 1794825671        秒级
docker exec ttlprobe redis-cli pexpiretime a     # 1794825670885     毫秒级
docker exec ttlprobe redis-cli time
```

`TTL` 只是拿 `pexpiretime(键) - now` 现算的。这也解释了为什么从库上 `TTL` 看起来和主库一模一样——两边读的是同一个绝对时刻，不需要主库告诉它「还剩多少秒」。

`EXPIRE` 的 0 和负数是个隐式删除：`EXPIRE j1 0` 返回 1，紧接着 `EXISTS j1` 返回 0。而 `SET j3 v EX 0` 直接报错，两种写法语义不统一：

```text
127.0.0.1:6379> SET j3 v EX 0
(error) ERR invalid expire time in 'set' command
127.0.0.1:6379> EXPIRE j2 9999999999999999
(error) ERR invalid expire time in 'expire' command
127.0.0.1:6379> PEXPIRE j2 99999999999999999999
(error) ERR value is not an integer or out of range
```

一个超的是时间范围，一个超的是整数范围，报错文本还不一样。要写「永不过期」别拿大数凑，用 `PERSIST`。

## 覆盖写会清掉 TTL，除非你显式说要留

这条踩的人最多。同一个键第三次写，前两次设的过期时间就没了：

```bash
docker exec ttlprobe redis-cli set k5 v EX 300   # TTL = 300
docker exec ttlprobe redis-cli set k5 v2         # TTL = -1  ← 没了
docker exec ttlprobe redis-cli set k6 v EX 300
docker exec ttlprobe redis-cli set k6 v2 KEEPTTL # TTL = 300 ← 留住了
```

但「写」的形态不止 `SET`，我挨个试了一遍，行为分三类：

| 操作 | TTL 结局 |
|---|---|
| `SET k v`（不带 KEEPTTL） | 清空，变 -1 |
| `SET k v KEEPTTL` | 保留 |
| `INCR k` | 保留 |
| `APPEND k x` | 保留 |
| `GETSET k v` | **清空** |
| `RENAME k k9` | 跟着键走，保留 |
| `PERSIST k` | 主动清空 |

`INCR` 和 `APPEND` 保留 TTL 合理——它们改的是值本身。`GETSET` 清空就不太符合直觉：它名字里没写「重置」，行为却是全量 `SET`。这一条我估摸坑过一批人：拿 `GETSET` 做「读旧值 + 写新值」的原子操作，顺手就把过期时间丢了，那批键从此永久驻留内存，直到 `maxmemory` 触发淘汰。

## 7.0 的 NX/XX/GT/LT 把「续期」变成了一个判断

`EXPIRE` 在 7.0 加了条件参数，返回值是「有没有真的改掉」，不是「命令有没有成功」。这两个不一样。

```bash
docker exec ttlprobe redis-cli set d1 v
docker exec ttlprobe redis-cli expire d1 100 NX   # 1  无 TTL，设上了
docker exec ttlprobe redis-cli expire d1 200 NX   # 0  已有 TTL，不动
docker exec ttlprobe redis-cli expire d1 50 GT    # 0  50 < 当前，不动
docker exec ttlprobe redis-cli expire d1 500 GT   # 1  只有变长才生效
docker exec ttlprobe redis-cli expire d1 10 LT    # 1  缩短
docker exec ttlprobe redis-cli expire d1 500 LT   # 0
docker exec ttlprobe redis-cli expire d1 100 XX   # 1
```

这条我最先用错的地方是「缓存续期」：想做「访问就延长到 1 小时，但不要把本来就更长的缩短」，直觉写 `EXPIRE key 3600 GT`。结果对**没有 TTL 的键**它返回 0，键保持永久：

```bash
docker exec ttlprobe redis-cli set d2 v
docker exec ttlprobe redis-cli expire d2 100 GT   # 0
docker exec ttlprobe redis-cli ttl d2             # -1  ← 还是个永久键
```

因为 `GT` 的比较基准是「当前 TTL」，而 `-1` 在数值上小于任何正数，永远不满足 `>`。`LT` 对无 TTL 的键反而生效（`-1` 不是无穷大，被当成 0 处理）。两个方向的边界不对称。

要「有 TTL 就续、没有就设」，得靠返回值补一次：

```bash
docker exec ttlprobe redis-cli eval "
  if redis.call('expire', KEYS[1], ARGV[1], 'GT') == 0 and redis.call('persist', KEYS[1]) == 0 then
    return redis.call('expire', KEYS[1], ARGV[1])
  end
  return 1" 1 d2 3600
```

`NX` 和 `XX`（或 `GT`/`LT`）互斥，同时给会直接报错，不会静默取其一：

```text
(error) ERR NX and XX, GT or LT options at the same time are not compatible
```

## 从库不会自己删键，它只是不让你看见

这是我这次最想验证的一段，因为线上「从库内存不降」的工单常年挂着。

先搭一主一从。我把从库放在另一个容器里，第一次 `master_link_status` 卡在 `down`，`docker logs` 里只到 `Non blocking connect for SYNC fired the event`。等了几秒它自己变成 `up`——全量同步走 RDB 传输，慢的机器上这个窗口有十几秒，别看到 `down` 就以为配错了。

```bash
IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ttlprobe)
docker run -d --name ttlreplica redis:7-alpine redis-server --replicaof $IP 6379
docker exec ttlreplica redis-cli info replication | head -5
```

从库正常状态下和主库读数一致：两边 `PEXPIRETIME` 是同一个数，`TTL` 同步递减。往从库写直接拒：`READONLY You can't write against a read only replica.`

然后是关键实验：写 50 个 `PX 1500` 的键，等同步完成，**把主库容器 `docker pause` 掉**。主库被冻住就无法广播 `DEL`，从库手里那批键早该过期了，但没人通知它。

3 秒后在从库上读：

```text
replica> DBSIZE           (integer) 50
replica> KEYS k:*         0 个
replica> SCAN 0           空游标
replica> RANDOMKEY        "k:25"
replica> GET k:1          (nil)
replica> TTL k:1          (integer) -2
replica> EXISTS k:1       (integer) 0
replica> TYPE k:1         none
replica> MEMORY USAGE k:1 (integer) 56
replica> INFO keyspace    db0:keys=50,expires=50
```

同一台机器、同一时刻，`DBSIZE` 说 50，`KEYS` 说 0，`RANDOMKEY` 还能捞出一个 `k:25`，`MEMORY USAGE` 说这 56 字节正占着。

看似矛盾，其实是两套逻辑：**`EXISTS` / `GET` / `TTL` / `TYPE` / `SCAN` 走惰性过期（logical expire）**，读的时候发现过期就按不存在返回；**`DBSIZE` / `RANDOMKEY` / `INFO keyspace` / `MEMORY USAGE` 直接看字典**，字典里还有它。所以用 `DBSIZE` 或 `used_memory` 监控从库内存，在长 TTL 场景下看到的是真相；用 `KEYS`/`SCAN` 对账则会漏。

`docker unpause` 之后不到 1 秒，`DEL` 全量追上来，`DBSIZE` 归零。这条也说明从库内存「不降」通常不是泄漏，是主库那边还没轮到删。

`MEMORY USAGE` 返回 56 而 `TYPE` 返回 `none`，这个组合我没在文档里翻到一句话解释，结论是我自己推的：`MEMORY USAGE` 算的是字典里那条记录，不看惰性过期。如果这条判断哪里不对，欢迎拍我。

## 主库上没人访问的键也会消失，但节奏由 hz 定

反过来验证一下主库的主动过期（active expire）。写 2000 个 `PX 1000` 的键，全程不 `GET` 任何一个，2.5 秒后看：

```text
127.0.0.1:6379> DBSIZE
(integer) 0
127.0.0.1:6379> INFO stats | grep expired_keys
expired_keys:2065
```

`expired_keys` 从 65 涨到 2065，正好 2000。主动过期确实在跑，而且不少删。

那它的粒度有多细？`hz` 决定每秒扫多少轮，默认 10，也就是 100ms 一轮。我把同一批 3000 个 `PX 500` 的键在不同 `hz` 下测「全部消失耗时」，50ms 轮询一次 `DBSIZE`：

| hz | 3000 个 500ms 键清空耗时 |
|---|---|
| 1 | 1620 ms |
| 10（默认） | 739 ms |
| 100 | 550 ms |

`hz=10` 相对 `hz=1` 快了 2.2 倍，`hz=100` 再快上去只有 1.3 倍（已经逼近轮询精度了）。这意味着默认配置下，一个 500ms TTL 的键在「逻辑过期」之后平均还要再占内存几十毫秒。TTL 越短、写入越密，这段「已过期但没删」的窗口里堆的键越多。

`hz` 调高是有代价的：每秒多扫几轮字典，CPU 就多花在这上面。`active-expire-effort` 默认 1（范围 1–10），和 `hz` 一起决定主动过期占用的时间片。这两个值我这次没做压力对比，只确认了 `hz` 对清空延迟的影响是单调的。

顺便记一下这台机器上的相关默认值，排查时省得猜：

```text
hz                     10
active-expire-effort   1
maxmemory-policy       noeviction
lazyfree-lazy-expire   no
replica-ignore-maxmemory yes
```

`lazyfree-lazy-expire: no` 意味着删大 value 是同步的，如果你存的是几百 KB 的大对象，过期风暴会在主线程上卡出尖峰。`replica-ignore-maxmemory: yes` 则解释了为什么从库内存可能超出 `maxmemory`——它不自己淘汰。

## 下次要验的是 `lazyfree-lazy-expire` 对延迟的实际影响

回到开头那个 bug。真正在业务里该写的是这个判断，用 `PTTL`，别再碰 `TTL` 的正负：

```go
pttl, err := rdb.PTTL(ctx, key).Result()
switch {
case err != nil:
    return err
case pttl == -2:            // 键不存在
    return rebuild(ctx, key)
case pttl > 0 && pttl < 500: // 快过期，异步续期，别在这里阻塞
    go refresh(ctx, key)
}
```

从键过期到内存真正释放之间隔着一个 `hz` 周期，这个差值我在 500ms TTL 上量到的是几十毫秒量级，还没在大 value（≥100KB）、`lazyfree-lazy-expire=yes` 的组合下测过。那才是过期风暴最容易打出毛刺的地方，下次把 `MEMORY USAGE` 和 `latency doctor` 一起挂上去跑一轮。

相关的还有一篇讲 TTL 语义踩坑的：[《API 请求签名实测：TTL 配成 W 留下一秒缝隙》]({{< relref "blog/api-signature-replay/index.md" >}})，那里是拿 TTL 当时间窗口用、结果窗口边界算错一秒；如果键的过期时间本身还承载着业务含义，可以对照 [《用 Redis 承载 Agent 会话记忆》]({{< relref "blog/redis-agent-session-memory/index.md" >}}) 里对「存多久」这层边界的划法。
