/* ============================================================
   关卡入口 —— 这就是你要改的文件

   主程序用 iframe 加载本文件夹的 index.html，所以只要保证三件事：

     1. index.html 存在（已经有了，一般不用动）
     2. 画面能画出来（改 style.css 和这个 level.js）
     3. 通关时 postMessage 一声 —— 见下面的 finish()
     4. 想自己加「返回」按钮，发 { type: 'cz:exit' } 即可（见文件末尾注释）

   现在它是「点一下就通关」的最小示例。先原样跑通，
   确认从地图能进、能回，再把里面的东西换成你自己的。

   直接双击 index.html 也能玩，不需要服务器、不需要构建。
   ============================================================ */
(function (global) {
  'use strict';

  function mount(root, ctx) {
    root.innerHTML =
      '<div class="probe">' +
      '  <p class="probe-main">点击屏幕，通关</p>' +
      '  <p class="probe-sub">这是示例，换成你自己的关卡</p>' +
      '</div>';

    var box = root.querySelector('.probe');
    var done = false;

    function finish() {
      if (done) return;
      done = true;

      /* ★ 最重要的一行 ★
         嵌在游戏里时，通关必须用 postMessage 通知主程序，
         否则你这边跑完了，地图那边不知道，关卡会一直挂着。 */
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'cz:done' }, '*');
          return;
        }
      } catch (e) {}

      // 单独双击打开（没有主程序）时，自己收个尾
      box.classList.add('is-done');
      box.querySelector('.probe-main').textContent = '通关';
      box.querySelector('.probe-sub').textContent = '流程已通，开始做你自己的吧';
    }

    box.addEventListener('click', finish);

    /* ctx.complete() 是留给将来「主程序直接加载脚本」那套方案用的，
       现在走 iframe，用不上，但先留着别删。 */
    if (ctx && typeof ctx.complete === 'function') {
      // 接入后由主程序接管收尾
    }
  }

  global.LEVEL = { mount: mount };

  // 独立运行时自己挂上去
  var stage = document.getElementById('stage');
  if (stage && !stage.dataset.mounted) {
    stage.dataset.mounted = '1';
    mount(stage, null);
  }
})(window);
