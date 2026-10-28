/* ============================================================
   四渡赤水 —— 走位躲避关
   1935.01-03，红军在川黔滇边穿插，四次渡过赤水河。
   玩法：方向键 / WASD 操控红星，躲避敌军巡逻与侦察机，
        抵达本渡指定渡口即完成一渡，共四渡，全部完成即通关。
   舞台固定 1280×720。全部图形 CSS 自绘，无外部素材。
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 关卡数据 ---------- */
  var CROSSES = [
    { name: '一渡·土城',   date: '1935年1月29日', tip: '西渡赤水，摆脱川军堵截',
      dock: { x: 250,  y: 200 } },
    { name: '二渡·太平渡', date: '1935年2月18日', tip: '东渡赤水，回师黔北',
      dock: { x: 1030, y: 180 } },
    { name: '三渡·茅台',   date: '1935年3月16日', tip: '再西渡，佯动诱敌',
      dock: { x: 300,  y: 540 } },
    { name: '四渡·二郎滩', date: '1935年3月21日', tip: '折而东渡，南渡乌江逼贵阳',
      dock: { x: 1000, y: 545 } }
  ];

  /* 敌军巡逻：直线往返（dx/dy 单位向量，span 行程，speed 像素/秒）
     plane: true 为敌机，圆周盘旋（r 半径，speed 角速度） */
  var ENEMIES = [
    { x: 420, y: 150, dx: 0, dy: 1, span: 260, speed: 95 },
    { x: 640, y: 330, dx: 1, dy: 0, span: 300, speed: 120 },
    { x: 880, y: 160, dx: 0, dy: 1, span: 230, speed: 105 },
    { x: 540, y: 90,  dx: 1, dy: 0, span: 220, speed: 135 },
    { x: 640, y: 250, plane: true, r: 130, speed: 1.1 },
    { x: 640, y: 470, plane: true, r: 120, speed: -1.3 },
    { x: 480, y: 480, dx: 1, dy: 0, span: 320, speed: 140 },
    { x: 760, y: 600, dx: 0, dy: 1, span: 200, speed: 115 },
    { x: 920, y: 430, dx: 1, dy: 0, span: 260, speed: 150 },
    { x: 350, y: 620, dx: 1, dy: 0, span: 240, speed: 125 }
  ];

  var W = 1280, H = 720;
  var PLAYER_R = 16, ENEMY_R = 15, DOCK_R = 26;
  var PLAYER_SPEED = 235;
  var SPAWN = { x: 640, y: 690 };

  var STATE = { START: 0, PLAY: 1, CROSS_OK: 2, WIN: 3 };

  function mount(root, ctx) {
    /* ---------- DOM ---------- */
    root.innerHTML =
      '<div class="battlefield">' +
      '  <div class="river"></div>' +
      '  <div class="river-bank bank-n"></div>' +
      '  <div class="river-bank bank-s"></div>' +
      '  <div class="hud">' +
      '    <div class="hud-title">四渡赤水</div>' +
      '    <div class="hud-mission" id="hud-mission"></div>' +
      '    <div class="hud-tip" id="hud-tip"></div>' +
      '    <div class="hud-dots" id="hud-dots"></div>' +
      '  </div>' +
      '  <div class="msg-layer" id="msg-layer"></div>' +
      '</div>';

    var field = root.querySelector('.battlefield');
    var missionEl = root.querySelector('#hud-mission');
    var tipEl = root.querySelector('#hud-tip');
    var dotsEl = root.querySelector('#hud-dots');
    var msgLayer = root.querySelector('#msg-layer');

    /* 渡口 */
    CROSSES.forEach(function (c) {
      var d = document.createElement('div');
      d.className = 'dock';
      d.style.left = (c.dock.x - DOCK_R) + 'px';
      d.style.top = (c.dock.y - DOCK_R) + 'px';
      d.innerHTML = '<span class="dock-name">' + c.name.split('·')[1] + '</span>';
      field.appendChild(d);
      c.el = d;
    });

    /* 敌军 */
    ENEMIES.forEach(function (e, i) { e.phase = i * 0.9; });
    var enemyEls = ENEMIES.map(function (e) {
      var el = document.createElement('div');
      el.className = e.plane ? 'enemy plane' : 'enemy';
      el.textContent = e.plane ? '机' : '敌';
      field.appendChild(el);
      e.el = el;
      return el;
    });

    /* 玩家红星 */
    var player = document.createElement('div');
    player.className = 'player';
    player.textContent = '★';
    field.appendChild(player);

    var pos = { x: SPAWN.x, y: SPAWN.y };
    var state = STATE.START;
    var crossIdx = 0;
    var keys = {};
    var lastT = 0, rafId = 0, t = 0, shakeT = 0;
    var done = false;

    /* ---------- HUD ---------- */
    function renderHud() {
      CROSSES.forEach(function (cc, i) {
        cc.el.classList.toggle('active', state !== STATE.WIN && i === crossIdx);
        cc.el.classList.toggle('passed', i < crossIdx || state === STATE.WIN);
      });
      if (state === STATE.WIN) {
        missionEl.textContent = '四渡赤水 · 跳出重围';
        tipEl.textContent = '三个月穿插周旋，跳出四十万敌军包围圈';
        dotsEl.innerHTML = '';
        return;
      }
      var c = CROSSES[crossIdx];
      missionEl.textContent = '第 ' + (crossIdx + 1) + ' 渡 · 前往「' + c.name.split('·')[1] + '」渡口';
      tipEl.textContent = c.tip + '（' + c.date + '）';
      dotsEl.innerHTML = CROSSES.map(function (_, i) {
        return '<span class="dot' + (i < crossIdx ? ' done' : '') +
               (i === crossIdx ? ' cur' : '') + '"></span>';
      }).join('');
    }

    /* ---------- 消息层 ---------- */
    function showMsg(html, cls) {
      msgLayer.innerHTML = '<div class="msg ' + (cls || '') + '">' + html + '</div>';
      var el = msgLayer.firstChild;
      requestAnimationFrame(function () { el.classList.add('on'); });
      return el;
    }
    function hideMsg() { msgLayer.innerHTML = ''; }

    /* ---------- 通关 ---------- */
    function finish() {
      if (done) return;
      done = true;
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'cz:done' }, '*');
          return;
        }
      } catch (e) {}
      showMsg('<p class="msg-main">通关</p><p class="msg-sub">四渡赤水 · 流程已通</p>', 'win');
    }

    /* ---------- 几何 ---------- */
    function dist(ax, ay, bx, by) {
      var dx = ax - bx, dy = ay - by;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function enemyPos(e) {
      if (e.plane) {
        var a = t * e.speed + e.phase;
        return { x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r * 0.6 };
      }
      var p = (t * e.speed) % (e.span * 2);
      if (p > e.span) p = e.span * 2 - p;
      return { x: e.x + e.dx * p, y: e.y + e.dy * p };
    }

    /* ---------- 主循环 ---------- */
    function tick(now) {
      var dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      if (state !== STATE.START) t += dt;

      if (state === STATE.PLAY) {
        var mx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
        var my = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
        if (mx && my) { mx *= 0.7071; my *= 0.7071; }
        pos.x = Math.max(PLAYER_R, Math.min(W - PLAYER_R, pos.x + mx * PLAYER_SPEED * dt));
        pos.y = Math.max(PLAYER_R, Math.min(H - PLAYER_R, pos.y + my * PLAYER_SPEED * dt));

        /* 碰撞：被发现 → 弹回南岸起点 */
        for (var i = 0; i < ENEMIES.length; i++) {
          var ep = enemyPos(ENEMIES[i]);
          if (dist(pos.x, pos.y, ep.x, ep.y) < PLAYER_R + ENEMY_R - 4) {
            pos.x = SPAWN.x; pos.y = SPAWN.y;
            shakeT = 0.4;
            showMsg('<p class="msg-main danger">被发现了！</p>' +
                    '<p class="msg-sub">退回南岸，重新穿插</p>', 'fail');
            setTimeout(function () {
              if (state === STATE.PLAY && msgLayer.querySelector('.fail')) hideMsg();
            }, 1100);
            break;
          }
        }

        /* 抵达渡口 */
        var c = CROSSES[crossIdx];
        if (state === STATE.PLAY && dist(pos.x, pos.y, c.dock.x, c.dock.y) < DOCK_R) {
          crossIdx++;
          if (crossIdx >= CROSSES.length) {
            state = STATE.WIN;
            renderHud();
            showMsg(
              '<p class="msg-main">四渡赤水 · 跳出重围</p>' +
              '<p class="msg-sub">一渡土城，二渡太平，三渡茅台，四渡二郎滩。<br>' +
              '声东击西，避实击虚，三万红军跳出四十万敌军的包围圈。</p>' +
              '<p class="msg-btn">点击屏幕或按回车 · 结束</p>', 'win');
            /* 主程序约定：收到 cz:done 立刻关闭关卡回面板，
               所以嵌在游戏里时直接通知，不等待玩家点击 */
            setTimeout(finish, 400);
          } else {
            state = STATE.CROSS_OK;
            renderHud();
            showMsg('<p class="msg-main ok">' + CROSSES[crossIdx - 1].name + ' · 完成</p>' +
                    '<p class="msg-sub">' + CROSSES[crossIdx - 1].tip + '</p>', 'ok');
            setTimeout(function () {
              if (state === STATE.CROSS_OK) { hideMsg(); state = STATE.PLAY; renderHud(); }
            }, 1500);
          }
        }
      }

      /* 渲染 */
      player.style.left = (pos.x - PLAYER_R) + 'px';
      player.style.top = (pos.y - PLAYER_R) + 'px';
      enemyEls.forEach(function (el, i) {
        var p = enemyPos(ENEMIES[i]);
        el.style.left = (p.x - ENEMY_R) + 'px';
        el.style.top = (p.y - ENEMY_R) + 'px';
      });
      if (shakeT > 0) {
        shakeT -= dt;
        field.style.transform = 'translate(' + (Math.random() * 8 - 4) + 'px,' +
                                (Math.random() * 8 - 4) + 'px)';
      } else {
        field.style.transform = '';
      }

      rafId = requestAnimationFrame(tick);
    }

    /* ---------- 输入 ---------- */
    function setKey(e, down) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].indexOf(k) >= 0) {
        keys[k] = down;
        e.preventDefault();
      }
    }
    function onKeyDown(e) {
      if (state === STATE.START && (e.key === 'Enter' || e.key === ' ')) { startPlay(); return; }
      if (state === STATE.WIN && (e.key === 'Enter' || e.key === ' ')) { finish(); return; }
      setKey(e, true);
    }
    function onKeyUp(e) { setKey(e, false); }

    function startPlay() {
      state = STATE.PLAY;
      hideMsg();
      renderHud();
    }

    field.addEventListener('click', function () {
      if (state === STATE.START) { startPlay(); return; }
      if (state === STATE.WIN) { finish(); }
    });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    /* 开场说明 */
    showMsg(
      '<p class="msg-main">四渡赤水</p>' +
      '<p class="msg-sub">1935年1月至3月，三万红军在川黔滇边穿插周旋。<br>' +
      '方向键 / WASD 操控红星，躲避敌军巡逻与侦察机，<br>' +
      '依次抵达四个渡口，完成四渡。被发现会退回南岸。</p>' +
      '<p class="msg-btn">点击屏幕或按回车 · 开始</p>', 'intro');

    renderHud();
    lastT = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  global.LEVEL = { mount: mount };

  /* 自动化测试钩子：只改判定坐标，不改 DOM，玩法无关。
     真实游玩不触发（没有任何代码调用它）。 */
  global.LEVEL_DEBUG = {
    setDock: function (i, x, y) {
      if (CROSSES[i]) { CROSSES[i].dock.x = x; CROSSES[i].dock.y = y; }
    }
  };

  /* 独立运行时自己挂上去 */
  var stage = document.getElementById('stage');
  if (stage && !stage.dataset.mounted) {
    stage.dataset.mounted = '1';
    mount(stage, null);
  }
})(window);
