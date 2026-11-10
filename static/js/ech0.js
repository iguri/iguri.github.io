/**
 * 随笔页交互脚本 —— 配合 layouts/ech0.html 使用
 * ===================================================================
 * 页面骨架（含第一页正文）是 Hugo 在构建期渲染好的静态 HTML，
 * 本脚本只负责 ech0 那部分"活的"交互，行为对齐 ech0 自己的前端：
 *
 *   1. 点赞   —— 7 个表情的选择条；点已选中的表情 = 取消，否则 = 添加
 *                写接口：PUT / DELETE /api/echo/{id}/reactions/{key}
 *                访客标识：请求头 X-Ech0-Visitor（localStorage 里的 uuid）
 *                更新策略：乐观更新，失败回滚（与 ech0 一致）
 *   2. 评论   —— 点「评论」才加载；列表 + 回复 + 提交
 *                接口：GET /api/comments?echo_id=、GET /api/comments/form、
 *                      POST /api/comments
 *                正文按纯文本渲染（转义 + 保留换行），不引第三方 Markdown 库
 *                没有验证码；仍保留 ech0 的 form_token 与 2 秒最短提交间隔
 *   3. 加载更多 —— 第 2 页起拉取，按 id 去重后追加
 *   4. 首屏对齐 —— 带访客标识重拉第 1 页，纠正"我赞过没"的初始状态，
 *                  并把构建之后新发的随笔插到顶部
 *
 * 所有接口都在 ech0 域上，跨域由 ech0 的 CORS 放行（已实测）。
 * ===================================================================
 */
(function () {
  'use strict';

  var root = document.getElementById('ech0-timeline');
  if (!root) return;

  /* ---------- 基础配置 ---------- */

  var API = (root.getAttribute('data-api') || '').replace(/\/+$/, '');
  var PAGE_SIZE = parseInt(root.getAttribute('data-page-size') || '20', 10) || 20;
  var total = parseInt(root.getAttribute('data-total') || '0', 10) || 0;
  var page = 1;
  var loading = false;

  /* 访客标识：与 ech0 用同一个 localStorage 键，
     这样在博客和 essay.grer.cn 上看到的是同一份点赞身份 */
  var VISITOR_KEY = 'ech0_visitor_id';
  /* 评论昵称/邮箱记忆键，同样沿用 ech0 的命名 */
  var GUEST_KEY = 'ech0:comment-guest-profile';

  function visitorId() {
    var v = '';
    try { v = localStorage.getItem(VISITOR_KEY) || ''; } catch (e) {}
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return v;
    v = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = (Math.random() * 16) | 0;
          var n = c === 'x' ? r : (r & 0x3) | 0x8;
          return n.toString(16);
        });
    try { localStorage.setItem(VISITOR_KEY, v); } catch (e) {}
    return v;
  }

  /* 统一的请求封装：自动带访客头，统一判 code !== 1 为失败 */
  function request(path, options) {
    options = options || {};
    var headers = { 'X-Ech0-Visitor': visitorId() };
    if (options.body) headers['Content-Type'] = 'application/json';
    if (options.headers) {
      for (var k in options.headers) headers[k] = options.headers[k];
    }
    return fetch(API + path, {
      method: options.method || 'GET',
      headers: headers,
      credentials: 'omit',
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () {
        throw new Error('响应不是合法 JSON（HTTP ' + res.status + '）');
      });
    }).then(function (json) {
      if (json.code !== 1) {
        var err = new Error(json.msg || '请求失败');
        err.code = json.error_code;
        throw err;
      }
      return json;
    });
  }

  /* ---------- 小工具 ---------- */

  /* 转义：评论正文、最新随笔的兜底渲染都走这里，避免任何注入 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 时间：ech0 存的是 Unix 秒，按浏览器本地时区显示，形如 2026-11-09 16:02 */
  function fmtTime(ts) {
    var d = new Date((ts || 0) * 1000);
    if (isNaN(d.getTime())) return '';
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* 运行时新增/加载更多的随笔：这里做一个安全的 Markdown 渲染兜底。
     构建期卡片走的是 Hugo 的 markdownify，这里尽量对齐同一种结构
     （标题/列表/引用/围栏代码/表格/分隔线/行内样式），
     原则是先整体转义再套白名单替换，内容里的 HTML 一律不生效。 */
  function inlineMd(text) {
    return esc(text)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)/g,
        '<img src="$2" alt="$1" loading="lazy" decoding="async">')
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
  }

  function splitTableRow(line) {
    var s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return s.split('|').map(function (c) { return c.trim(); });
  }

  function renderBody(md) {
    var lines = String(md == null ? '' : md).split('\n');
    var out = [];
    var para = [];
    var i = 0;

    function flush() {
      if (!para.length) return;
      out.push('<p>' + inlineMd(para.join('\n')) + '</p>');
      para = [];
    }

    while (i < lines.length) {
      var line = lines[i];

      // 围栏代码块：整段原样保留，不做行内替换
      var fence = line.match(/^\s*```+\s*([\w+-]*)\s*$/);
      if (fence) {
        flush();
        var lang = fence[1] || '';
        var code = [];
        i++;
        while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
        i++;
        out.push('<pre><code' + (lang ? ' class="language-' + esc(lang) + '"' : '') + '>' +
          esc(code.join('\n')) + '</code></pre>');
        continue;
      }

      // 标题：层级与 Hugo 的 markdownify 保持一致（## → h2）
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flush();
        var lv = Math.min(h[1].length, 6);
        out.push('<h' + lv + '>' + inlineMd(h[2]) + '</h' + lv + '>');
        i++;
        continue;
      }

      // 引用块
      if (/^>\s?/.test(line)) {
        flush();
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote><p>' + inlineMd(quote.join('\n')) + '</p></blockquote>');
        continue;
      }

      // 无序 / 有序列表
      if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        flush();
        var ordered = /^\s*\d+\.\s+/.test(line);
        var re = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
        var items = [];
        while (i < lines.length && re.test(lines[i])) {
          items.push('<li>' + inlineMd(lines[i].match(re)[1]) + '</li>');
          i++;
        }
        out.push('<' + (ordered ? 'ol' : 'ul') + '>' + items.join('') + '</' + (ordered ? 'ol' : 'ul') + '>');
        continue;
      }

      // 表格：当前行含 | 且下一行是分隔行
      if (line.indexOf('|') >= 0 && i + 1 < lines.length &&
          /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
        flush();
        var head = splitTableRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].indexOf('|') >= 0 && lines[i].trim() !== '') {
          rows.push(splitTableRow(lines[i]));
          i++;
        }
        var tbl = '<table><thead><tr>' + head.map(function (c) {
          return '<th>' + inlineMd(c) + '</th>';
        }).join('') + '</tr></thead><tbody>';
        rows.forEach(function (r) {
          tbl += '<tr>' + r.map(function (c) { return '<td>' + inlineMd(c) + '</td>'; }).join('') + '</tr>';
        });
        out.push(tbl + '</tbody></table>');
        continue;
      }

      // 分隔线
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
        flush();
        out.push('<hr>');
        i++;
        continue;
      }

      // 空行 = 段落结束
      if (line.trim() === '') {
        flush();
        i++;
        continue;
      }

      para.push(line);
      i++;
    }
    flush();
    return out.join('\n');
  }

  /* 把 ech0 的相对文件路径补成可直接访问的绝对地址 */
  function fileUrl(u) {
    if (!u) return '';
    return u.charAt(0) === '/' ? API + u : u;
  }

  /* ---------- 点赞 ---------- */

  /* 表情目录：先用 ech0 的默认 7 个，拿到 /api/reactions 后再替换 */
  var catalog = [
    { key: 'like', emoji: '👍' }, { key: 'heart', emoji: '❤️' },
    { key: 'haha', emoji: '😂' }, { key: 'wow', emoji: '😮' },
    { key: 'sad', emoji: '😢' }, { key: 'cry', emoji: '😭' },
    { key: 'party', emoji: '🎉' }
  ];
  var catalogLoaded = false;

  function loadCatalog() {
    if (catalogLoaded) return Promise.resolve(catalog);
    catalogLoaded = true;
    return request('/api/reactions').then(function (json) {
      if (json.data && json.data.length) catalog = json.data;
      return catalog;
    }).catch(function () { return catalog; });
  }

  /* 把 reactions 数组渲染进「点赞」按钮：最多 3 个表情 + 总数；没有就显示笑脸图标 */
  function paintReactions(article, reactions) {
    var btn = article.querySelector('.ech0-react-btn');
    if (!btn) return;
    reactions = reactions || [];
    var totalCount = reactions.reduce(function (s, r) { return s + (r.count || 0); }, 0);
    btn.setAttribute('aria-expanded', 'false');
    btn.classList.remove('is-open');
    if (!totalCount) {
      btn.innerHTML =
        '<svg class="ech0-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>' +
        '<circle cx="8.9" cy="10" r="1.35" fill="currentColor"></circle>' +
        '<circle cx="15.1" cy="10" r="1.35" fill="currentColor"></circle>' +
        '<path d="M8 13.9a4.7 4.7 0 0 0 8 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>' +
        '</svg>';
      return;
    }
    var sorted = reactions.slice().sort(function (a, b) { return (b.count || 0) - (a.count || 0); }).slice(0, 3);
    var html = '';
    sorted.forEach(function (r) {
      html += '<span class="ech0-react-emoji" aria-hidden="true">' + esc(r.emoji) + '</span>';
    });
    html += '<span class="ech0-react-count">' + (totalCount > 99 ? '99+' : totalCount) + '</span>';
    btn.innerHTML = html;
  }

  /* 收起表情条：选中表情之后、点页面空白处时调用 */
  function closePicker(article) {
    var bar = article.querySelector('.ech0-reaction-bar');
    var btn = article.querySelector('.ech0-react-btn');
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    if (btn) {
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  /* 弹出/收起表情条：条子直接挂在卡片内，靠 CSS 定位在按钮上方 */
  function togglePicker(article) {
    var btn = article.querySelector('.ech0-react-btn');
    var existing = article.querySelector('.ech0-reaction-bar');
    if (existing) { existing.parentNode.removeChild(existing); btn.classList.remove('is-open'); return; }

    // 同时只允许开一个表情条：先把其它卡片上开着的收掉
    Array.prototype.forEach.call(root.querySelectorAll('.ech0-reaction-bar'), function (other) {
      var host = other.closest('.ech0-item');
      if (host && host !== article) closePicker(host);
    });

    loadCatalog().then(function (list) {
      var bar = document.createElement('div');
      bar.className = 'ech0-reaction-bar';
      bar.setAttribute('role', 'menu');
      bar.setAttribute('aria-label', '选择表情反应');
      list.forEach(function (item) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ech0-reaction-item';
        b.setAttribute('data-key', item.key);
        b.setAttribute('title', item.key);
        b.textContent = item.emoji;
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          react(article, item.key);
          // 选完就收起：表情条浮在按钮上方，不收会挡住旁边的「评论」按钮
          closePicker(article);
        });
        bar.appendChild(b);
      });
      // 标记当前已选中的表情（高亮）
      var current = article._reactions || [];
      current.forEach(function (r) {
        if (!r.reacted) return;
        var target = bar.querySelector('[data-key="' + r.key + '"]');
        if (target) target.classList.add('is-active');
      });
      article.appendChild(bar);
      btn.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    });
  }

  /* 一次点赞/取消：先乐观更新界面，再打接口，失败回滚（对齐 ech0 的做法） */
  function react(article, key) {
    var id = article.getAttribute('data-echo-id');
    var snapshot = JSON.parse(JSON.stringify(article._reactions || []));
    var current = snapshot.filter(function (r) { return r.key === key; })[0];
    var add = !(current && current.reacted);

    // —— 乐观更新 ——
    var next = snapshot.map(function (r) { return { key: r.key, emoji: r.emoji, count: r.count, reacted: r.reacted }; });
    var target = next.filter(function (r) { return r.key === key; })[0];
    if (!target) {
      var meta = catalog.filter(function (c) { return c.key === key; })[0] || { key: key, emoji: '' };
      target = { key: key, emoji: meta.emoji, count: 0, reacted: false };
      next.push(target);
    }
    target.reacted = add;
    target.count = Math.max(0, (target.count || 0) + (add ? 1 : -1));
    article._reactions = next;
    paintReactions(article, next);

    request('/api/echo/' + encodeURIComponent(id) + '/reactions/' + encodeURIComponent(key), {
      method: add ? 'PUT' : 'DELETE'
    }).then(function (json) {
      article._reactions = json.data || [];
      paintReactions(article, article._reactions);
      // 表情条按最新状态重新高亮
      var bar = article.querySelector('.ech0-reaction-bar');
      if (bar) {
        Array.prototype.forEach.call(bar.children, function (b) {
          b.classList.remove('is-active');
        });
        (article._reactions || []).forEach(function (r) {
          if (!r.reacted) return;
          var t = bar.querySelector('[data-key="' + r.key + '"]');
          if (t) t.classList.add('is-active');
        });
      }
    }).catch(function () {
      // —— 失败回滚 ——
      article._reactions = snapshot;
      paintReactions(article, snapshot);
    });
  }

  /* Esc 关闭表情条（与 ech0 的键盘行为一致） */
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    Array.prototype.forEach.call(root.querySelectorAll('.ech0-reaction-bar'), function (bar) {
      var host = bar.closest('.ech0-item');
      if (host) closePicker(host);
    });
  });

  /* 点空白处收起表情条 */
  document.addEventListener('click', function (ev) {
    if (ev.target.closest && ev.target.closest('.ech0-reaction-bar, .ech0-react-btn')) return;
    Array.prototype.forEach.call(document.querySelectorAll('.ech0-reaction-bar'), function (bar) {
      var art = bar.closest('.ech0-item');
      bar.parentNode.removeChild(bar);
      var btn = art && art.querySelector('.ech0-react-btn');
      if (btn) { btn.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
    });
  });

  /* ---------- 评论 ---------- */

  /* 对一条评论按纯文本渲染：转义 + 保留换行。
     不渲染 Markdown，也就不需要任何第三方库，内容不可能造成注入。 */
  function renderCommentText(text) {
    return esc(text).replace(/\n/g, '<br>');
  }

  /* 拉评论列表 + 表单元信息（并行的两个请求） */
  function loadComments(article) {
    var id = article.getAttribute('data-echo-id');
    var section = article.querySelector('.ech0-comments');
    if (!section) return Promise.resolve();
    if (section.getAttribute('data-loaded') === '1') return Promise.resolve();
    section.hidden = false;
    section.innerHTML = '<p class="ech0-hint">评论加载中…</p>';

    return Promise.all([
      request('/api/comments?echo_id=' + encodeURIComponent(id)),
      request('/api/comments/form')
    ]).then(function (res) {
      var comments = res[0].data || [];
      var meta = res[1].data || {};
      section.setAttribute('data-loaded', '1');
      // 顺带同步卡片底部「评论」按钮上的计数
      var badge = article.querySelector('.ech0-comment-count');
      if (badge) badge.textContent = comments.length;
      renderComments(article, section, comments, meta);
    }).catch(function (err) {
      section.innerHTML = '<p class="ech0-hint">评论加载失败：' + esc(err.message) + '</p>';
    });
  }

  /* 渲染整个评论区：线程 + 表单 */
  function renderComments(article, section, comments, meta) {
    var html = '';

    if (!meta.enable_comment) {
      html += '<p class="ech0-hint">本站暂时关闭了评论。</p>';
      section.innerHTML = html;
      return;
    }

    // —— 按 parent_id 分组：一级评论 + 它们的回复 ——
    var tops = [], repliesMap = {};
    comments.forEach(function (c) {
      if (c.parent_id) {
        (repliesMap[c.parent_id] = repliesMap[c.parent_id] || []).push(c);
      } else {
        tops.push(c);
      }
    });

    var floorOf = {};
    comments.forEach(function (c, i) { floorOf[c.id] = i + 1; });

    html += '<div class="ech0-cmt-board">';
    html += '<div class="ech0-cmt-head">' +
      '<button type="button" class="ech0-cmt-write">写评论</button>' +
      '<span class="ech0-cmt-total">' + comments.length + ' 条评论</span>' +
      '</div>';

    // 提交结果提示：放在表单之外，这样「已发布」后重新拉列表也不会被冲掉
    var notice = section.getAttribute('data-notice') || '';
    if (notice) {
      html += '<p class="ech0-cmt-notice">' + esc(notice) + '</p>';
    }

    // —— 表单（默认收起，点「写评论」展开） ——
    html += '<form class="ech0-cmt-form" hidden>' +
      '<div class="ech0-cmt-fields">' +
      '<input type="text" name="nickname" placeholder="昵称（必填）" maxlength="40" autocomplete="nickname">' +
      '<input type="email" name="email" placeholder="邮箱（必填，不公开）" maxlength="120" autocomplete="email">' +
      '<input type="text" name="website" placeholder="网址（选填）" maxlength="120">' +
      '</div>' +
      '<textarea name="content" rows="3" maxlength="200" placeholder="说点什么…（最多 200 字）"></textarea>' +
      // 蜜罐字段：人看不见，机器人会填；ech0 侧收到非空即拒
      '<input type="text" name="hp_field" class="ech0-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div class="ech0-cmt-actions">' +
      '<button type="submit" class="ech0-cmt-submit" disabled>提交</button>' +
      '<button type="button" class="ech0-cmt-cancel">取消</button>' +
      '<span class="ech0-cmt-tip"></span>' +
      '</div>' +
      '</form>';

    // —— 列表 ——
    html += '<div class="ech0-cmt-list">';
    if (!tops.length) {
      html += '<p class="ech0-hint">还没有评论，来说两句吧。</p>';
    } else {
      tops.forEach(function (c) {
        html += renderOneComment(c, floorOf[c.id], false);
        var replies = repliesMap[c.id] || [];
        if (replies.length) {
          html += '<div class="ech0-cmt-replies">';
          replies.forEach(function (r) {
            html += renderOneComment(r, floorOf[r.id], true);
          });
          html += '</div>';
        }
      });
    }
    html += '</div></div>';

    section.innerHTML = html;
    bindCommentForm(article, section, meta);
  }

  /* 单条评论的 HTML（纯文本正文，无头像） */
  function renderOneComment(c, floor, isReply) {
    var author = c.website
      ? '<a class="ech0-cmt-author" href="' + esc(c.website) + '" target="_blank" rel="noopener nofollow">' + esc(c.nickname) + '</a>'
      : '<span class="ech0-cmt-author">' + esc(c.nickname) + '</span>';
    var verified = c.source === 'system'
      ? '<span class="ech0-cmt-badge" title="站内用户">✓</span>' : '';
    var hot = c.hot ? '<span class="ech0-cmt-hot">Hot</span>' : '';
    var replyRef = '';
    if (isReply && c.parent_id) {
      replyRef = '<button type="button" class="ech0-cmt-toreply" disabled>回复</button>';
    }
    return '<div class="ech0-cmt-item' + (isReply ? ' is-reply' : '') + '">' +
      '<div class="ech0-cmt-meta">' +
        '<span class="ech0-cmt-floor">#' + floor + '</span>' +
        author + verified +
        '<span class="ech0-cmt-dot">·</span>' +
        '<span class="ech0-cmt-time">' + fmtTime(c.created_at) + '</span>' +
        hot + replyRef +
      '</div>' +
      '<div class="ech0-cmt-content">' + renderCommentText(c.content) + '</div>' +
      '</div>';
  }

  /* 绑定表单行为：展开/收起、记忆昵称邮箱、提交 */
  function bindCommentForm(article, section, meta) {
    var form = section.querySelector('.ech0-cmt-form');
    var writeBtn = section.querySelector('.ech0-cmt-write');
    var cancelBtn = section.querySelector('.ech0-cmt-cancel');
    var submitBtn = section.querySelector('.ech0-cmt-submit');
    var tip = section.querySelector('.ech0-cmt-tip');
    var contentEl = form.querySelector('textarea[name="content"]');
    var minMs = meta.min_submit_ms || 2000;
    var tokenAt = Date.now();
    var ready = false;

    // 表单令牌有最短提交间隔，到点前禁用提交按钮（与 ech0 的 2 秒一致）
    var enableTimer = setTimeout(function () {
      ready = true;
      updateSubmitState();
    }, minMs);

    // 回填上次填过的昵称/邮箱
    try {
      var saved = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null');
      if (saved) {
        if (saved.nickname) form.nickname.value = saved.nickname;
        if (saved.email) form.email.value = saved.email;
        if (saved.website) form.website.value = saved.website;
      }
    } catch (e) {}

    function updateSubmitState() {
      var ok = ready &&
        form.nickname.value.trim() !== '' &&
        form.email.value.trim() !== '' &&
        contentEl.value.trim() !== '';
      submitBtn.disabled = !ok;
      if (!ready) tip.textContent = '请稍候…';
      else if (!ok) tip.textContent = '';
      else tip.textContent = '';
    }

    form.addEventListener('input', updateSubmitState);

    writeBtn.addEventListener('click', function () {
      form.hidden = false;
      writeBtn.hidden = true;
      contentEl.focus();
      updateSubmitState();
    });

    cancelBtn.addEventListener('click', function () {
      form.hidden = true;
      writeBtn.hidden = false;
      form.reset();
      tip.textContent = '';
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      tip.textContent = '提交中…';

      var payload = {
        echo_id: article.getAttribute('data-echo-id'),
        content: contentEl.value.trim(),
        nickname: form.nickname.value.trim(),
        email: form.email.value.trim(),
        website: form.website.value.trim(),
        form_token: meta.form_token,
        // 蜜罐必须为空；ech0 侧收到非空直接拒绝
        hp_field: form.hp_field.value
      };

      request('/api/comments', { method: 'POST', body: payload }).then(function (json) {
        var status = (json.data && json.data.status) || 'pending';
        // 记住昵称邮箱，下次自动回填
        try {
          localStorage.setItem(GUEST_KEY, JSON.stringify({
            nickname: payload.nickname, email: payload.email, website: payload.website
          }));
        } catch (e) {}

        contentEl.value = '';
        var noticeText = status === 'approved'
          ? '评论已发布。'
          : '已提交，等待博主审核后显示。';
        // 记在 section 上：approved 时会重新渲染评论区，提示不能丢
        section.setAttribute('data-notice', noticeText);
        tip.textContent = noticeText;

        if (status === 'approved') {
          // 已直接通过：重新拉一次列表（顺带刷新评论数）
          section.removeAttribute('data-loaded');
          loadComments(article);
        } else {
          submitBtn.disabled = false;
        }
      }).catch(function (err) {
        tip.textContent = '提交失败：' + (err.message || '请稍后再试');
        submitBtn.disabled = false;
      });
    });
  }

  /* ---------- 媒体与扩展卡（与 layouts/ech0.html 的渲染规则保持一致） ---------- */

  /* 按 ech0 的 file.category 分派：图片网格 / 原生视频 / 原生音频 / 下载链接 */
  function mediaHtml(files) {
    var images = [], videos = [], audios = [], others = [];
    files.forEach(function (f) {
      var cat = String(f.category || '');
      if (cat === 'image') images.push(f);
      else if (cat === 'video') videos.push(f);
      else if (cat === 'audio') audios.push(f);
      else others.push(f);
    });

    var html = '';

    if (images.length) {
      var cols = Math.min(images.length, 3);
      html += '<div class="ech0-files" style="--cols:' + cols + '">' +
        images.map(function (f) {
          var u = fileUrl(f.url);
          return '<a class="ech0-file" href="' + esc(u) + '" target="_blank" rel="noopener">' +
            '<img src="' + esc(u) + '" alt="' + esc(f.name || '') + '" loading="lazy" decoding="async"></a>';
        }).join('') + '</div>';
    }

    videos.forEach(function (f) {
      var u = fileUrl(f.url);
      // 原生播放：ech0 的文件接口支持 Range，可以拖动进度条
      html += '<div class="ech0-video"><video controls preload="metadata" playsinline src="' +
        esc(u) + '"></video></div>';
    });

    audios.forEach(function (f) {
      var u = fileUrl(f.url);
      html += '<div class="ech0-audio">' +
        (f.name ? '<p class="ech0-audio-name">' + esc(f.name) + '</p>' : '') +
        '<audio controls preload="metadata" src="' + esc(u) + '"></audio></div>';
    });

    if (others.length) {
      html += '<ul class="ech0-attachments">' + others.map(function (f) {
        var u = fileUrl(f.url);
        return '<li><a href="' + esc(u) + '" download>' + esc(f.name || '文件') + '</a></li>';
      }).join('') + '</ul>';
    }

    return html;
  }

  /* ech0 扩展卡：VIDEO → B 站/YouTube iframe；MUSIC → 网易云 outchain iframe；
     其它类型降级成外链卡片（这些卡需要登录态或第三方脚本，博客侧做不了） */
  function extensionHtml(ext) {
    if (!ext) return '';
    var p = ext.payload || {};

    if (ext.type === 'VIDEO') {
      var vid = String(p.videoId || '');
      if (!vid) return '';
      var src = vid.indexOf('BV') === 0
        ? 'https://www.bilibili.com/blackboard/html5mobileplayer.html?bvid=' +
          encodeURIComponent(vid) + '&as_wide=1&high_quality=1&danmaku=0'
        : 'https://www.youtube.com/embed/' + encodeURIComponent(vid);
      return '<div class="ech0-embed ech0-embed--video">' +
        '<iframe src="' + esc(src) + '" scrolling="no" frameborder="0" allowfullscreen ' +
        'loading="lazy" title="视频"></iframe></div>';
    }

    if (ext.type === 'MUSIC') {
      var mu = String(p.url || '');
      var m = mu.match(/[?&]id=(\d+)/);
      if (m) {
        // 网易云 outchain 的 type：2=单曲、1=专辑、0=歌单
        var kind = /playlist/.test(mu) ? '0' : /album/.test(mu) ? '1' : '2';
        var h = kind === '2' ? 66 : 430;
        var msrc = 'https://music.163.com/outchain/player?type=' + kind + '&id=' + m[1] +
          '&auto=0&height=' + h;
        return '<div class="ech0-embed ech0-embed--music">' +
          '<iframe src="' + esc(msrc) + '" frameborder="0" height="' + h +
          '" loading="lazy" title="网易云音乐"></iframe></div>';
      }
      if (mu) {
        return '<a class="ech0-linkcard" href="' + esc(mu) +
          '" target="_blank" rel="noopener">音乐链接：' + esc(mu) + '</a>';
      }
      return '';
    }

    var u = String(p.url || p.repoUrl || '');
    if (!u) return '';
    return '<a class="ech0-linkcard" href="' + esc(u) + '" target="_blank" rel="noopener">' +
      '<span class="ech0-linkcard-kind">' + esc(ext.type) + '</span> ' + esc(u) + '</a>';
  }

  /* ---------- 长文折叠（4 行） ---------- */

  var COLLAPSE_LINES = 4;

  /* 正文超过 4 行就折叠，点「展开全文」展开。
     无 JS 时不做任何处理，正文完整显示（不影响 SEO）。 */
  function setupCollapse(article) {
    var body = article.querySelector('.ech0-body');
    if (!body || body.getAttribute('data-collapse-ready') === '1') return;
    body.setAttribute('data-collapse-ready', '1');

    var cs = window.getComputedStyle(body);
    var lineHeight = parseFloat(cs.lineHeight);
    if (!isFinite(lineHeight) || lineHeight <= 0) {
      lineHeight = parseFloat(cs.fontSize) * 1.75 || 26;
    }
    var limit = Math.round(lineHeight * COLLAPSE_LINES);

    // 没超过 4 行就不折叠
    if (body.scrollHeight <= limit + 4) return;

    var wrap = document.createElement('div');
    wrap.className = 'ech0-body-wrap';
    wrap.style.setProperty('--ech0-collapse-h', limit + 'px');
    body.parentNode.insertBefore(wrap, body);
    wrap.appendChild(body);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ech0-expand';
    btn.textContent = '展开全文';
    btn.setAttribute('aria-expanded', 'false');
    wrap.parentNode.insertBefore(btn, wrap.nextSibling);

    function apply(collapsed) {
      wrap.classList.toggle('is-collapsed', collapsed);
      btn.textContent = collapsed ? '展开全文' : '收起';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    apply(true);

    btn.addEventListener('click', function () {
      apply(!wrap.classList.contains('is-collapsed'));
    });
  }

  /* ---------- 卡片构建（加载更多 / 首屏新增用） ---------- */

  function buildArticle(item) {
    var art = document.createElement('article');
    art.className = 'post-entry ech0-item';
    art.setAttribute('data-echo-id', item.id);
    art.setAttribute('data-created', item.created_at);
    art._reactions = (item.reactions || []).map(function (r) {
      return { key: r.key, emoji: r.emoji, count: r.count, reacted: r.reacted };
    });

    var files = (item.echo_files || []).map(function (ef) {
      return ef.file;
    }).filter(Boolean);

    // 标签只做展示（ech0 的标签过滤不落 URL，避免生成死链）
    var tags = (item.tags || []).map(function (t) {
      return '<li><span class="ech0-tag">#' + esc(t.name) + '</span></li>';
    }).join('');

    art.innerHTML =
      '<header class="ech0-head">' +
        '<time class="ech0-time">' + fmtTime(item.created_at) + '</time>' +
      '</header>' +
      // post-content / md-content 是主题的排版类，和构建期模板保持一致
      '<div class="entry-content post-content md-content ech0-body">' + renderBody(item.content || '') + '</div>' +
      mediaHtml(files) +
      extensionHtml(item.extension) +
      '<footer class="entry-footer ech0-meta">' +
        (tags ? '<ul class="terms-tags ech0-tags">' + tags + '</ul>' : '') +
        '<div class="ech0-actions">' +
          '<button type="button" class="ech0-react-btn" aria-haspopup="true" aria-expanded="false" aria-label="添加表情反应"></button>' +
          '<button type="button" class="ech0-comment-btn" aria-expanded="false">' +
            '<svg class="ech0-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
              '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.7 8.7 0 0 1-3.9-.9L3 20.5l1.4-4.6A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>' +
            '</svg><span class="ech0-comment-count">0</span>' +
          '</button>' +
        '</div>' +
      '</footer>' +
      '<section class="ech0-comments" hidden></section>';

    paintReactions(art, art._reactions);
    return art;
  }

  /* 给一张卡片挂上交互（构建期渲染的和运行时新建的都用这一个入口） */
  function wire(article) {
    if (article.getAttribute('data-wired') === '1') return;
    article.setAttribute('data-wired', '1');

    // 长文折叠（构建期卡片与运行时新增卡片都走这里）
    setupCollapse(article);

    // 构建期渲染的卡片没带 _reactions，从 DOM 里读不出来，
    // 交给首屏对齐请求补齐；这里只保证按钮能点。
    var reactBtn = article.querySelector('.ech0-react-btn');
    if (reactBtn) {
      reactBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (!article._reactions) article._reactions = [];
        togglePicker(article);
      });
    }

    var cmtBtn = article.querySelector('.ech0-comment-btn');
    if (cmtBtn) {
      cmtBtn.addEventListener('click', function () {
        var section = article.querySelector('.ech0-comments');
        var expanded = cmtBtn.getAttribute('aria-expanded') === 'true';
        cmtBtn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        if (expanded) {
          section.hidden = true;
        } else {
          section.hidden = false;
          loadComments(article);
        }
      });
    }
  }

  /* ---------- 加载更多 ---------- */

  var moreBtn = document.getElementById('ech0-more');
  var moreWrap = document.getElementById('ech0-more-wrap');

  function loadMore() {
    if (loading) return;
    loading = true;
    if (moreBtn) moreBtn.textContent = '加载中…';
    // 正常情况下构建期已渲染第一页（page=1），所以续拉第 2 页；
    // 但如果构建期抓取失败（页面上一张卡都没有），首屏对齐也可能失败，
    // 这时从第 1 页开始拉，避免直接跳过第一页。
    var hasCards = root.querySelector('.ech0-item') !== null;
    var next = hasCards ? page + 1 : 1;

    request('/api/echo/query', {
      method: 'POST',
      body: { page: next, pageSize: PAGE_SIZE, private: false, sortBy: 'created_at', sortOrder: 'desc' }
    }).then(function (json) {
      var data = json.data || {};
      var items = data.items || [];
      var existing = {};
      Array.prototype.forEach.call(root.querySelectorAll('.ech0-item'), function (a) {
        existing[a.getAttribute('data-echo-id')] = true;
      });
      var empty = root.querySelector('.ech0-empty');
      var frag = document.createDocumentFragment();
      var pending = [];
      var added = 0;
      items.forEach(function (item) {
        if (existing[item.id]) return;
        existing[item.id] = true;
        var art = buildArticle(item);
        pending.push(art);
        frag.appendChild(art);
        added++;
      });
      root.appendChild(frag);
      // 必须等元素进了 DOM 再挂交互：长文折叠要靠 scrollHeight 判断行数
      pending.forEach(wire);
      if (empty && added) empty.hidden = true;

      page = Math.max(page, next);
      if (data.total != null) total = data.total;
      var shown = root.querySelectorAll('.ech0-item').length;
      if (shown >= total) {
        if (moreWrap) moreWrap.hidden = true;
      }
    }).catch(function () {
      if (moreBtn) moreBtn.textContent = '加载失败，点击重试';
    }).then(function () {
      loading = false;
      if (moreBtn && moreWrap && !moreWrap.hidden) moreBtn.textContent = '加载更多';
    });
  }

  if (moreBtn) moreBtn.addEventListener('click', loadMore);

  /* ---------- 首屏对齐 ---------- */

  /* 构建期渲染的卡片是不带访客身份的，所以：
       - reactions 里 reacted 全是 false，赞过的表情不会高亮；
       - 构建之后新发的随笔也不在页面里。
     这里带访客标识重拉第一页，做两件事：更新已有卡片的点赞状态 + 顶部补新条目。 */
  function syncFirstPage() {
    return request('/api/echo/query', {
      method: 'POST',
      body: { page: 1, pageSize: PAGE_SIZE, private: false, sortBy: 'created_at', sortOrder: 'desc' }
    }).then(function (json) {
      var data = json.data || {};
      var items = data.items || [];
      if (data.total != null) total = data.total;

      var byId = {};
      Array.prototype.forEach.call(root.querySelectorAll('.ech0-item'), function (a) {
        byId[a.getAttribute('data-echo-id')] = a;
      });

      var empty = root.querySelector('.ech0-empty');
      if (items.length && empty) empty.hidden = true;

      // 1) 已有卡片：补上点赞状态
      items.forEach(function (item) {
        var art = byId[item.id];
        if (!art) return;
        art._reactions = (item.reactions || []).map(function (r) {
          return { key: r.key, emoji: r.emoji, count: r.count, reacted: r.reacted };
        });
        paintReactions(art, art._reactions);
      });

      // 2) 新条目：按时间倒序插到最前面
      var fresh = items.filter(function (it) { return !byId[it.id]; });
      fresh.sort(function (a, b) { return (b.created_at || 0) - (a.created_at || 0); });
      fresh.reverse().forEach(function (item) {
        var art = buildArticle(item);
        root.insertBefore(art, root.firstChild);
        // 入 DOM 之后再挂交互，折叠测量才准
        wire(art);
      });

      // 3) 分页按钮显隐
      var shown = root.querySelectorAll('.ech0-item').length;
      if (moreWrap) moreWrap.hidden = shown >= total;
    }).catch(function () {
      // 首屏对齐失败不影响已渲染的静态内容，静默即可
    });
  }

  /* ---------- 启动 ---------- */

  function init() {
    Array.prototype.forEach.call(root.querySelectorAll('.ech0-item'), wire);
    syncFirstPage().then(function () {
      // 对齐后如果表情目录还没拉过，顺手拉一次，后续点开就快了
      return loadCatalog();
    }).catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
