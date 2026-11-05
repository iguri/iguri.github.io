/* ===================================================================
   【站点自定义，非主题文件】首页 profile 打字机 + 英文 3D 翻转
   -------------------------------------------------------------------
   配套：layouts/_partials/index_profile.html（由该 partial 引入本脚本）
         assets/css/extended/profile-typewriter.css（翻转动画类 .is-flip）

   逻辑：
   - 词库 ['审阅','超越','取悦']，循环：打字 110ms/字 → 停顿 1400ms
     → 删字 55ms/字 → 循环间隙 170ms → 下一个词。
   - 删完字、即将开始打下一个词时，英文词（Review/Surpass/Please）
     做一次绕 X 轴的 3D 翻转（CSS keyframes，弹性缓动）。
   - 光标闪烁纯 CSS（steps(1,end) 1s），本脚本不干预。
   - prefers-reduced-motion 时停止动效，静态展示首个词。
   =================================================================== */
(function () {
    'use strict';

    var WORDS_CN = ['审阅', '超越', '取悦'];
    var WORDS_EN = ['Review', 'Surpass', 'Please'];

    var TYPE_MS = 110;    // 打字每字
    var HOLD_MS = 1400;   // 打完停顿
    var DEL_MS  = 55;     // 删字每字
    var GAP_MS  = 170;    // 循环间隙

    function start() {
        var head = document.getElementById('twHead');
        var typed = document.getElementById('twTyped');
        var en = document.getElementById('twEn');
        if (!head || !typed || !en) return; // 非 profileMode 首页

        // 标记 JS 已接管：取消无 JS 的静态兜底（CSS ::after "审阅"）
        head.classList.add('is-js');

        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            typed.textContent = WORDS_CN[0];
            en.textContent = WORDS_EN[0];
            return;
        }

        var idx = 0;      // 当前词序号
        var chars = 0;    // 当前已显示字符数
        var deleting = false;
        var timer = null;
        var epoch = 0;    // 计时链令牌：防止 visibilitychange 重入产生并行链

        function flipEn() {
            en.textContent = WORDS_EN[idx];
            // 重触发动画：先摘 class，强制 reflow，再挂上
            en.classList.remove('is-flip');
            void en.offsetWidth;
            en.classList.add('is-flip');
        }

        function schedule(fn, ms) {
            var myEpoch = epoch;
            timer = setTimeout(function () {
                if (myEpoch !== epoch) return; // 旧链作废（可见性切换后重启）
                fn();
            }, ms);
        }

        function tick() {
            var w = WORDS_CN[idx];

            if (!deleting) {
                if (chars < w.length) {
                    chars++;
                    typed.textContent = w.slice(0, chars);
                    schedule(tick, TYPE_MS);
                } else {
                    // 打满，停顿后进入删除
                    schedule(function () {
                        deleting = true;
                        tick();
                    }, HOLD_MS);
                }
            } else {
                if (chars > 0) {
                    chars--;
                    typed.textContent = w.slice(0, chars);
                    schedule(tick, DEL_MS);
                } else {
                    // 删完 → 切下一个词并触发英文 3D 翻转；循环间隙 170ms
                    idx = (idx + 1) % WORDS_CN.length;
                    flipEn();
                    deleting = false;
                    schedule(tick, GAP_MS);
                }
            }
        }

        // 首词直接打出来（与翻转后的词保持同一节奏）
        flipEn();
        tick();

        // 页面切到后台时作废当前计时链（隐藏期浏览器会限流 setTimeout，
        // 恢复显示后从当前状态重启，避免出现两条并行链）
        document.addEventListener('visibilitychange', function () {
            epoch++;
            clearTimeout(timer);
            if (!document.hidden) tick();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
