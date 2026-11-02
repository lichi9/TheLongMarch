/* ============================================================
   巧渡金沙江 —— levels/wxh/level.js

   1935 年 5 月，皎平渡。七只木船，三十六名船工，九昼夜渡完三万红军。
   这一关的核心只有一句：船不能停。

   玩法：
     · 点左岸「待命」的船 → 装上一批红军，出航
     · 到达南岸自动卸人，然后返航，回到左岸才能再派
     · 3 条船要轮着派，船工连续跑 3 趟必须轮换休息
     · 追兵倒计时结束前把人渡完就赢，渡不完就重来

   舞台固定 1280 × 720，主程序负责缩放，所以下面全是像素值。
   ============================================================ */
(function (global) {
  'use strict';

  /* ===== 难度参数：想调松紧就改这里 ===== */
  var CFG = {
    totalBatches: 10,      // 一共要渡几批
    perBatch: 100,         // 每批多少人
    boatCount: 3,          // 几条船
    tripMs: 3400,          // 单程航行时间（毫秒）
    dockMs: 420,           // 靠岸装卸时间
    restMs: 1800,          // 船工轮换休息时间
    tripsBeforeRest: 3,    // 连跑几趟后必须轮换
    pressureMs: 38000      // 追兵抵达倒计时
  };

  /* 船停靠的两个横坐标（船宽 140，右岸留出同样的边距） */
  var LEFT_X = 165;
  var RIGHT_X = 975;

  function buildHTML() {
    var boats = '';
    var i;
    for (i = 0; i < CFG.boatCount; i++) {
      boats +=
        '<div class="cz-boat" data-i="' + i + '" ' +
             'style="top:' + (110 + i * 165) + 'px; left:' + LEFT_X + 'px">' +
          '<div class="cz-boat-hull">' +
            '<span class="cz-boat-mast"></span>' +
            '<span class="cz-boat-flag"></span>' +
          '</div>' +
          '<div class="cz-boat-label">待命</div>' +
          '<div class="cz-boat-pips"></div>' +
        '</div>';
    }

    return '' +
      '<div class="cz-wrap">' +

        '<div class="cz-hud">' +
          '<div class="cz-hud-left">' +
            '<span class="cz-tag">1935.05 · 皎平渡</span>' +
            '<span class="cz-stat">已渡 <b id="cz-crossed">0</b> / ' +
              (CFG.totalBatches * CFG.perBatch) + ' 人</span>' +
            '<span class="cz-stat">待命 <b id="cz-idle">' + CFG.boatCount + '</b> 船</span>' +
          '</div>' +
          '<div class="cz-pressure" id="cz-pressure">' +
            '<span class="cz-pressure-text">追兵</span>' +
            '<div class="cz-pressure-bar"><i id="cz-pfill"></i></div>' +
            '<span class="cz-pressure-sec" id="cz-psec">' +
              (CFG.pressureMs / 1000).toFixed(1) + 's</span>' +
          '</div>' +
        '</div>' +

        '<div class="cz-river" id="cz-river">' +
          '<div class="cz-bank cz-bank-l">' +
            '<span class="cz-bank-name">北岸</span>' +
            '<span class="cz-bank-sub">红军集结</span>' +
          '</div>' +
          '<div class="cz-water">' +
            '<i class="cz-wave cz-wave-1"></i>' +
            '<i class="cz-wave cz-wave-2"></i>' +
            '<i class="cz-wave cz-wave-3"></i>' +
          '</div>' +
          '<div class="cz-bank cz-bank-r">' +
            '<span class="cz-bank-name">南岸</span>' +
            '<span class="cz-bank-sub">脱离追敌</span>' +
          '</div>' +
          boats +
        '</div>' +

        '<div class="cz-tip">' +
          '点击左岸待命的船，派出一批红军 · 按空格派最近的船 · ' +
          '船工连跑 ' + CFG.tripsBeforeRest + ' 趟必须轮换，换着用才不耽误' +
        '</div>' +

        '<div class="cz-overlay is-on" id="cz-ov"></div>' +
      '</div>';
  }

  function mount(root, ctx) {
    root.innerHTML = buildHTML();

    var ov        = root.querySelector('#cz-ov');
    var crossedEl = root.querySelector('#cz-crossed');
    var idleEl    = root.querySelector('#cz-idle');
    var pfill     = root.querySelector('#cz-pfill');
    var psecEl    = root.querySelector('#cz-psec');
    var pressure  = root.querySelector('#cz-pressure');
    var river     = root.querySelector('#cz-river');

    /* ---------- 船只状态 ---------- */
    var boats = [];
    var nodes = root.querySelectorAll('.cz-boat');
    var i;
    for (i = 0; i < nodes.length; i++) {
      (function (el) {
        el.style.transitionDuration = (CFG.tripMs / 1000) + 's';
        boats.push({
          el: el,
          label: el.querySelector('.cz-boat-label'),
          pips: el.querySelector('.cz-boat-pips'),
          state: 'ready',   // ready | out | back | rest
          trips: 0,
          timer: null
        });
      })(nodes[i]);
    }

    /* ---------- 局内状态 ---------- */
    var crossed = 0;
    var running = false;
    var ended = false;
    var tickHandle = null;
    var deadline = 0;

    function clearTimers() {
      var k;
      for (k = 0; k < boats.length; k++) {
        if (boats[k].timer) {
          clearTimeout(boats[k].timer);
          boats[k].timer = null;
        }
      }
      if (tickHandle) {
        clearInterval(tickHandle);
        tickHandle = null;
      }
    }

    /* ---------- 显示 ---------- */
    function renderPips(b) {
      var used = b.trips % CFG.tripsBeforeRest;
      if (b.trips > 0 && used === 0) used = CFG.tripsBeforeRest;
      var out = '';
      var n;
      for (n = 0; n < CFG.tripsBeforeRest; n++) {
        out += '<i class="' + (n < used ? 'is-used' : '') + '"></i>';
      }
      b.pips.innerHTML = out;
    }

    function updateHud() {
      var idle = 0;
      var k;
      for (k = 0; k < boats.length; k++) {
        if (boats[k].state === 'ready') idle++;
        renderPips(boats[k]);
      }
      crossedEl.textContent = String(crossed);
      idleEl.textContent = String(idle);
    }

    /* ---------- 船的流程：出航 → 卸人 → 返航 → 靠岸 ---------- */
    function launch(b) {
      if (!running || ended) return;
      if (b.state !== 'ready') {
        b.el.classList.remove('is-bump');
        void b.el.offsetWidth;        /* 强制重排，让抖动动画能重新播放 */
        b.el.classList.add('is-bump');
        return;
      }
      b.state = 'out';
      b.el.classList.remove('is-ready', 'is-rest');
      b.el.classList.add('is-sailing');
      b.label.textContent = '出航';
      b.el.style.left = RIGHT_X + 'px';
      b.timer = setTimeout(function () { arrive(b); }, CFG.tripMs);
      updateHud();
    }

    function arrive(b) {
      crossed += CFG.perBatch;
      b.el.classList.remove('is-sailing');
      b.el.classList.add('is-docking');
      b.label.textContent = '卸人';
      updateHud();
      checkWin();
      b.timer = setTimeout(function () { sailBack(b); }, CFG.dockMs);
    }

    function sailBack(b) {
      b.state = 'back';
      b.el.classList.remove('is-docking');
      b.el.classList.add('is-sailing');
      b.label.textContent = '返航';
      b.el.style.left = LEFT_X + 'px';
      b.timer = setTimeout(function () { dock(b); }, CFG.tripMs);
    }

    function dock(b) {
      b.trips += 1;
      b.el.classList.remove('is-sailing');

      if (b.trips % CFG.tripsBeforeRest === 0) {
        /* 船工连跑若干趟，必须轮换 */
        b.state = 'rest';
        b.el.classList.add('is-rest');
        b.label.textContent = '船工轮换';
        b.timer = setTimeout(function () { markReady(b); }, CFG.restMs);
      } else {
        markReady(b);
      }
      updateHud();
    }

    function markReady(b) {
      b.state = 'ready';
      b.el.classList.remove('is-rest', 'is-docking');
      b.el.classList.add('is-ready');
      b.label.textContent = '待命';
      b.timer = null;
      updateHud();
      checkWin();
    }

    /* ---------- 判定 ---------- */
    function checkWin() {
      if (ended) return;
      if (crossed >= CFG.totalBatches * CFG.perBatch) win();
    }

    function win() {
      if (ended) return;
      ended = true;
      running = false;
      clearTimers();

      var usedSec = ((CFG.pressureMs - Math.max(0, deadline - Date.now())) / 1000).toFixed(1);

      overlay(
        'cz-win',
        '全部渡过',
        '用时 ' + usedSec + ' 秒，人马全部过江。<br>' +
        '追兵赶到皎平渡时，只看见空船。',
        null,
        null
      );
      setTimeout(finish, 1400);
    }

    function lose() {
      if (ended) return;
      ended = true;
      running = false;
      clearTimers();

      var rest = (CFG.totalBatches * CFG.perBatch - crossed) / CFG.perBatch;

      overlay(
        'cz-lose',
        '追兵已至',
        '还差 ' + rest + ' 批人马没能过江。<br>船一停，就来不及了。',
        '再渡一次',
        function () { start(); }
      );
    }

    /* ---------- 倒计时 ---------- */
    function tick() {
      if (!running || ended) return;
      var left = deadline - Date.now();
      if (left < 0) left = 0;

      pfill.style.width = (left / CFG.pressureMs * 100) + '%';
      psecEl.textContent = (left / 1000).toFixed(1) + 's';
      pressure.classList.toggle('is-urgent', left < CFG.pressureMs * 0.3);

      if (left <= 0) lose();
    }

    /* ---------- 覆盖层 ---------- */
    function overlay(kind, title, desc, btnText, onBtn) {
      var btn = btnText
        ? '<button class="cz-btn" id="cz-ovbtn">' + btnText + '</button>'
        : '';
      ov.className = 'cz-overlay is-on ' + kind;
      ov.innerHTML =
        '<div class="cz-card">' +
          '<h1>' + title + '</h1>' +
          '<p>' + desc + '</p>' +
          btn +
        '</div>';
      var b = ov.querySelector('#cz-ovbtn');
      if (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          if (typeof onBtn === 'function') onBtn();
        });
      }
    }

    /* ---------- 开局 ---------- */
    function start() {
      clearTimers();

      crossed = 0;
      ended = false;
      running = true;

      var k;
      for (k = 0; k < boats.length; k++) {
        var b = boats[k];
        b.state = 'ready';
        b.trips = 0;
        b.timer = null;
        b.el.style.left = LEFT_X + 'px';
        b.el.className = 'cz-boat is-ready';
        b.label.textContent = '待命';
      }

      ov.className = 'cz-overlay';
      ov.innerHTML = '';

      updateHud();
      deadline = Date.now() + CFG.pressureMs;
      pfill.style.width = '100%';
      psecEl.textContent = (CFG.pressureMs / 1000).toFixed(1) + 's';
      pressure.classList.remove('is-urgent');

      tickHandle = setInterval(tick, 100);
    }

    /* ---------- 通关：通知主程序 ---------- */
    function finish() {
      /* ★ 最重要的一行：嵌在游戏里时必须发这条消息，否则地图那边不知道你打完了 */
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'cz:done' }, '*');
          return;
        }
      } catch (e) {}

      /* 单独双击打开（没有主程序）时自己收尾 */
      ov.className = 'cz-overlay is-on cz-win';
      ov.innerHTML =
        '<div class="cz-card">' +
          '<h1>通关</h1>' +
          '<p>全部人马渡过金沙江。</p>' +
          '<p class="cz-small">（独立运行模式，未通知主程序）</p>' +
        '</div>';
    }

    /* ---------- 交互 ---------- */
    river.addEventListener('click', function (e) {
      var node = e.target;
      while (node && node !== river && !node.classList.contains('cz-boat')) {
        node = node.parentNode;
      }
      if (!node || node === river) return;
      var idx = Number(node.getAttribute('data-i'));
      if (isNaN(idx) || !boats[idx]) return;
      launch(boats[idx]);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.code !== 'Space') return;
      e.preventDefault();
      if (!running || ended) return;
      var k;
      for (k = 0; k < boats.length; k++) {
        if (boats[k].state === 'ready') {
          launch(boats[k]);
          return;
        }
      }
    });

    /* ---------- 开场卡片 ---------- */
    overlay(
      'cz-intro',
      '巧渡金沙江',
      '1935 年 5 月，皎平渡。七只木船，三十六名船工，九昼夜渡完三万红军。' +
        '<br><br>现在轮到你：<b>3 条船</b>，' +
        (CFG.totalBatches * CFG.perBatch) + ' 人，追兵 <b>' +
        (CFG.pressureMs / 1000) + ' 秒</b>后就到。' +
        '<br><b>船不能停。</b>',
      '开始渡江',
      function () { start(); }
    );

    /* ctx.complete 是留给将来「主程序直接加载脚本」那套方案用的，先别删 */
    if (ctx && typeof ctx.complete === 'function') {
      // 现在走 iframe，用不上
    }
  }

  global.LEVEL = { mount: mount };

  /* 独立运行时自己挂上去 */
  var stage = document.getElementById('stage');
  if (stage && !stage.dataset.mounted) {
    stage.dataset.mounted = '1';
    mount(stage, null);
  }
})(window);
