/**
 * MBTI 维度条 —— 交互脚本
 *
 * 配合 layouts/_shortcodes/mbti.html 使用：
 *   - 悬停（>768px）或点击任意维度条 → 右侧详情面板淡入切换
 *   - 数据全部来自 data/mbti.yaml 渲染出的 data-* 属性，本脚本不含业务数据
 *
 * 由短代码以 <script defer> 引入，仅在包含组件的页面加载。
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var items = document.querySelectorAll('.mbti-item');
    var dCat = document.getElementById('dCat');
    var dScore = document.getElementById('dScore');
    var dLabelText = document.getElementById('dLabelText');
    var dImg = document.getElementById('dImg');
    var dDesc = document.getElementById('dDesc');
    var detail = document.getElementById('mbtiDetailContent');

    if (!items.length || !detail) return;

    /**
     * 用某个维度条目刷新右侧详情面板。
     * data-label 形如 "61% 内向"（百分比 + 空格 + 名称）。
     */
    function renderDetail(item) {
      var cat = item.getAttribute('data-cat');
      var label = item.getAttribute('data-label') || '';
      var scoreColor = item.getAttribute('data-score-color');
      var img = item.getAttribute('data-img');
      var desc = item.getAttribute('data-desc');

      var space = label.indexOf(' ');
      var percent = space === -1 ? label : label.slice(0, space);
      var name = space === -1 ? '' : label.slice(space + 1);

      detail.classList.remove('show');
      setTimeout(function () {
        dCat.innerText = cat;
        dScore.innerText = percent;
        dScore.style.color = scoreColor;
        dLabelText.innerText = name;
        dImg.src = img;
        dDesc.innerText = desc;
        detail.classList.add('show');
      }, 150); // 与原始组件一致的 150ms 淡入延迟
    }

    function activate(item) {
      items.forEach(function (el) { el.classList.remove('active'); });
      item.classList.add('active');
      renderDetail(item);
    }

    items.forEach(function (item) {
      // 桌面端：悬停切换
      item.addEventListener('mouseenter', function () {
        if (window.innerWidth > 768) activate(item);
      });
      // 触屏 / 点击：始终切换
      item.addEventListener('click', function () {
        activate(item);
      });
    });
  });
})();
