---
title: "照抄一份分页缓存方案，5 个并发收回 4 个 AbortError"
date: 2026-11-28T18:40:00+08:00
summary: "文章说同 key 并发就取消前一个，我照抄后 5 并发挂了 4 个。把 key 排序、错误缓存、单条错位都跑了一遍。"
tags: ["缓存", "并发", "前端性能"]
categories: 折腾笔记
author: "甲拉古日"
slug: "pagination-request-cache-traps"
draft: false
---

```text
用例1 方案A 结果 = [
  'rejected:AbortError',
  'rejected:AbortError',
  'rejected:AbortError',
  'rejected:AbortError',
  'ok'
]
用例1 方案A 服务端真实命中 = 1
```

服务端确实只被打了一次，看起来缓存生效了。但五个调用方里四个拿到了 `AbortError`。

这不是配置问题，是「取消前一个」和「共享同一个 promise」压根是两件事，而原文的代码把它们当成了同一件。

## 那把锁到底锁住了谁

照抄的原文（[掘金：列表分页查询的优化](https://juejin.cn/post/7712765229256163379)）在请求拦截器里做的是：

```js
if (pendingRequestMap.has(key)) {
  pendingRequestMap.get(key).abort()   // 掐掉前一个
  pendingRequestMap.delete(key)
}
```

它在乎的是「别让服务端被打两次」，所以第二个请求进来就把第一个弄死。这在这个场景下成立：翻页连点时，前一次的响应本来就没人要了。

问题在于同一份代码被当成通用缓存用。列表页首屏、筛选栏回填、详情弹窗预取同时拉第 1 页，这是五个合法的调用方，它们谁都想要数据。

我把它改写成更贴近现代运行时的一版，用 `AbortController` 替掉 `cancelToken`，起一个本地 HTTP 服务数真实命中次数：

```js
// /tmp/pg-exp/exp1.mjs —— 方案A：取消前一个
const A = { pending: new Map(), cache: new Map() }

async function aGet(url, params = {}, { cache = false, cacheTTL = 30_000 } = {}) {
  const key = keyOf({ url, params })
  if (cache) {
    const hit = A.cache.get(key)
    if (hit && hit.expiresAt > Date.now()) return hit.value
    if (hit) A.cache.delete(key)          // 过期就删
  }
  if (A.pending.has(key)) {
    A.pending.get(key).abort()            // 原文这一行
    A.pending.delete(key)
  }
  const ac = new AbortController()
  A.pending.set(key, ac)
  try {
    const res = await fetch(base + url + '?p=' + encodeURIComponent(JSON.stringify(params)), {
      signal: ac.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if (cache) A.cache.set(key, { value: body, expiresAt: Date.now() + cacheTTL })
    return body
  } finally {
    if (A.pending.get(key) === ac) A.pending.delete(key)
  }
}
```

`finally` 里那个身份判断是我加的。不加的话，五个并发里第一个请求结束时会无条件 `delete`，把第五个刚登记进去的那把 `AbortController` 一起删掉，下次真需要取消时反而取消不了。

## 想要的是共享，不是互斥

同一个 key 在途中，正确语义是「后来的等着，拿同一份结果」。这在 fetch 里就是缓存 promise 本身，而不是缓存响应值。

```js
// 方案B：promise 共享 + 成功才回填
const B = { inflight: new Map(), cache: new Map() }

async function bGet(url, params = {}, { cacheTTL = 30_000 } = {}) {
  const key = keyOf({ url, params })
  const hit = B.cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  if (B.inflight.has(key)) return B.inflight.get(key)   // ← 关键一行

  const p = fetch(base + url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      B.cache.set(key, { value: body, expiresAt: Date.now() + cacheTTL })
      return body
    })
    .finally(() => B.inflight.delete(key))

  B.inflight.set(key, p)
  return p
}
```

同一组用例跑出来：

```text
用例1b 方案B 结果 = [ 'ok', 'ok', 'ok', 'ok', 'ok' ]
用例1b 方案B 服务端真实命中 = 1
```

两边服务端都只被打了 1 次，差别只在前端那四次调用是报错还是拿到数据。取消前一个省下的那点流量，抵不上一个 `AbortError` 冒到 UI 上的成本。

真遇到翻页竞态（第 3 页点了又点第 5 页），正确做法是在调用方加序号，而不是在传输层取消：

```js
let sequence = 0
async function fetchPage(query) {
  const requestId = ++sequence
  const data = await http.get('/orders', { params: query })
  if (requestId !== sequence) return      // 过期响应直接丢，不抛错
  list.value = data.list
  total.value = data.total
}
```

## key 排序，文章说到了，代码没做

原文有一句判断是对的：「缓存 key 必须能区分同一接口的不同筛选、排序、页码和分页大小，推荐用 `JSON.stringify` 按固定字段顺序生成 key」。

但它自己的 `createRequestKey` 就是这个样子：

```js
export function createRequestKey(config) {
  return JSON.stringify({
    method: (config.method ?? 'get').toLowerCase(),
    url: config.url,
    params: config.params ?? null,
    data: config.data ?? null,
  })
}
```

外层四个字段顺序是写死的，`config.params` 里面的顺序不是。而 `params` 经常来自两处：筛选表单重建一次、从 URL query 复原一次。两边字段顺序一样只是巧合。

实测：

```text
用例2 {a,b} 与 {b,a} key 相同 = false
用例2 两个 key = {"method":"get","url":"/o","params":{"a":1,"b":2}}
               {"method":"get","url":"/o","params":{"b":2,"a":1}}
```

语义完全相同，缓存却各存一份。表现是「明明刚看过，返回上一步又打了一次接口」——用户不一定报 bug，你也不一定查得出来。

排序版：

```js
function normalizeKey(method, url, params = {}) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')   // 空值不参与
    .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v])     // 数组也归一化
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  return `${method.toUpperCase()} ${url} ${JSON.stringify(entries)}`
}
```

顺带把 `undefined` 和空串滤掉。`JSON.stringify` 本来就会丢弃值为 `undefined` 的键，所以 `{page:1}` 和 `{page:1, keyword:undefined}` 恰好同 key；但手写拼接（`a=1&b=`）就会分叉，两套逻辑并存时更麻烦。统一在入口归一化省事。

## rejected promise 一进缓存，30 秒内别想恢复

原文把 promise 存进缓存的写法是缓存已完成的结果：

```js
responseCacheMap.set(key, {
  promise: Promise.resolve(response),        // 只有成功路径才走到这里
  expiresAt: Date.now() + (config.cacheTTL ?? 30_000),
})
```

这在源文件里是安全的，因为回填只发生在响应拦截器的成功分支。但我见到的多数复刻版（包括我第一版）图省事，把 `fetch(...)` 的 promise 在**发起那一刻**就塞进缓存：

```js
const promise = fetch(base + url).then(async (res) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
})
C.cache.set(key, { promise, expiresAt: Date.now() + cacheTTL })   // 还没结果就登记了
return promise
```

一个会先失败一次（500）的接口，连调三次：

```text
用例4 第 1 次 = 失败 HTTP 500
用例4 第 2 次 = 失败 HTTP 500
用例4 第 3 次 = 失败 HTTP 500
用例4 服务端真实命中 = 1 （3 次调用只打了这么多次）
```

后两次根本没摸到网络，直接吃到同一个已经 rejected 的 promise。rejected promise 是被永久钉住的，TTL 只是让 key 过期，管不了这个 promise 本身。用户点三次刷新都失败，手动刷新页面反而好了——这种「刷新能好」的 bug 最难报。

修法是失败不入缓存，`finally` 里清 in-flight：

```js
const p = fetch(base + url).then(async (res) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  cache.set(key, { value: body, expiresAt: Date.now() + ttl })   // 只有成功才写
  return body
})
inflight.set(key, p)
p.then(() => {}, () => {}).finally(() => inflight.delete(key))
```

注意那个空的 `p.then(() => {}, () => {})`。不加它，失败路径上 `finally` 派生出的 promise 没人接，Node 会直接抛 unhandled rejection 把进程带走。

改完同一个接口连调三次：

```text
修正版 第1次 失败 HTTP 500 服务端累计 1
修正版 第2次 成功 服务端累计 2
修正版 第3次 成功 服务端累计 2
```

## 过期那一瞬间，两种方案的差距最大

先预热一份、等 TTL 到期、再打 10 个并发：

```text
用例6 方案A 过期瞬间 10 并发 → 服务端真实命中 1 次，成功 1 个
用例6 方案B 过期瞬间 10 并发 → 服务端真实命中 1 次，成功 10 个
```

两边都没击穿到服务端（取消机制歪打正着地也挡住了），但 A 是「杀掉 9 个」，B 是「10 个都按序拿到同一份」。缓存命中率一样，用户体验差 9 倍。

## 用 page:index,size:1 取单条，别人插一行就错位

原文还有一条我认为不该照抄的建议：

> 可以很风骚地使用分页请求的优点来单独更新某条数据，只要计算好单条数据的 index（page：index，size：1）则可以轻轻松松的处理，也不用后台额外提供单独更新某条数据的接口。

省掉一个详情接口的诱惑很大。我按这个口径起了一个 200 行的列表（`page=3`、`size=20`，取页内第 4 条 → 全局第 44 条），取完之后往列表头插一条：

```text
列表第3页第4条 = row-044
换算出的 index = 44
插入前按 index 单拉 = row-044
插入后按 index 单拉 = row-043 ← 已经变成上一条了
```

分页是「按当前排序切好的位置」，不是稳定 id。任何一条的插入、删除、或者排序字段被更新，index 就整体位移。用户看到的是：详情弹窗里改完保存，列表里那一行变成了邻居的数据。

这个错位还能叠加在缓存上——错误的数据被缓存 30 秒，甚至被 `patchListItem` 按 id 合并回列表，把正确的行覆盖掉。要省接口，至少用 keyset 分页（`WHERE (created_at, id) < (?, ?)`），或者干脆让详情接口返回完整快照。

## 多一份 bundle，就多一份 Map

最后一件事是我在微前端项目里踩到的：那个 `Map` 是模块级变量，每份 bundle 各有一份。

```js
function createClient() {          // 模拟每份 bundle 各自 new 出来的实例
  const inflight = new Map()
  return function get(url) { /* ... */ }
}

const clientA = createClient()     // 主应用
const clientB = createClient()     // 微前端子应用
await Promise.all([clientA('/list?page=1'), clientB('/list?page=1')])
```

```text
多实例同 key 并发 → 服务端真实命中 2 次
单实例同 key 并发 → 服务端真实命中 1 次
```

第二个数字对应的命令是 `Promise.all([clientC(...), clientC(...), clientC(...)])`，三并发收成一次；换成两个实例各发一次，就一次收不住了。

把它挂到 `globalThis` 上能解决同一页面内的重复，但跨标签页仍然各算各的。真要收，就得把 in-flight 标记放到真有共享语义的地方——`BroadcastChannel` 加 `sessionStorage`，或者干脆让服务端做幂等（`Idempotency-Key`）。

## 方案对照

| | 取消前一个（原文） | promise 共享（修正） |
|---|---|---|
| 同 key 并发 N 次 | 1 成功，N-1 报错 | N 个都成功 |
| 服务端命中 | 1 次 | 1 次 |
| 适合场景 | 翻页连点，旧响应确定不要 | 多个独立调用方要同一份数据 |
| 失败恢复 | 正常（没写缓存） | 需要显式「失败不写」 |
| 跨 bundle | 各一份 Map，收不住 | 同样收不住 |

原方案不是错的，它只是把「竞态时丢弃过期结果」和「缓存命中」混在了一个机制里。这两件事分开写，各自都能对。

```text
下次要试的是把那层 in-flight 换到 BroadcastChannel 上，看两个标签页同时进列表页时，
服务端能不能从 2 次压到 1 次；本地这个 HTTP 服务数得清，剩下的变量只有浏览器那边。
```
