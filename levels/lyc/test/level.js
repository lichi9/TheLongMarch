/* ============================================================
   测试关卡 · 点一下屏幕就通关

   这是关卡的最小骨架，照它写你自己的：
     1. 定义 mount(root, ctx)
     2. 往 root 里塞你自己的 DOM（root 是普通 div，不是 ShadowRoot）
     3. 通关时调 ctx.complete()

   直接双击 index.html 就能玩，不需要服务器、不需要构建。
   ============================================================ */
(function (global) {
  'use strict';

  function mount(root, ctx) {
    root.innerHTML =
      '<div class="probe">' +
      '  <p class="probe-main">点击屏幕，通关</p>' +
      '  <p class="probe-sub">测试关卡 · 流程通了就换成你自己的</p>' +
      '</div>';

    var box = root.querySelector('.probe');
    var done = false;

    function finish() {
      if (done) return;
      done = true;

      // 接入 core 之后，通关由它推进（core 还没写，这里是预留接口）
      if (ctx && typeof ctx.complete === 'function') {
        ctx.complete();
        return;
      }

      // 被主游戏用 iframe 嵌进来时：什么都别自己演，
      // 直接通知外面，过场动画统一由主程序播（保证全站一致）。
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'cz:done' }, '*');
          return;
        }
      } catch (e) {}

      // 只有单独双击打开 index.html 时，才自己收个尾
      box.classList.add('is-done');
      box.querySelector('.probe-main').textContent = '通关';
      box.querySelector('.probe-sub').textContent = '流程已通，把 level.js 换成你自己的吧';
    }

    box.addEventListener('click', finish);
  }

  global.TEST_LEVEL = { mount: mount };

  // 独立打开时自己挂上去
  var stage = document.getElementById('stage');
  if (stage && !stage.dataset.mounted) {
    stage.dataset.mounted = '1';
    mount(stage, null);
  }
})(window);
