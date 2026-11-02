/* ============================================================
   飞夺泸定桥 · 关卡实现（levels/hry）
   ------------------------------------------------------------
   契约见 docs/level-api.md：

     · 主程序用 iframe 加载本文件夹的 index.html，舞台固定 1280×720
     · 导出 window.LEVEL.mount(root, ctx)
     · 通关 → window.parent.postMessage({ type: 'cz:done' }, '*')
     · 单独双击 index.html 也能玩，不依赖主程序

   画布按 16:9 等比铺满舞台：内部沿用 960×540 的设计坐标，
   由 VIEW 一次性放大到 1280×720，玩法数值和构图都不用重算。

   纯 Canvas 2D，零依赖、零外部素材、零网络请求：
   铁索、木板、江水、火、人物、音效全部实时生成，
   所以 assets/ 是空的也不影响别人 clone 下来玩。
   ============================================================ */
(function (global) {
  'use strict';

  var DESIGN_W = 960, DESIGN_H = 540;

  function mount(root, ctxApi) {
    if (!root || root.dataset.mounted === '1') return;
    root.dataset.mounted = '1';

  /* ==================== 常量 ==================== */

  var W = DESIGN_W, H = DESIGN_H;
  var WORLD_W = 8200;             // 桥的世界长度
  var BRIDGE_Y = 322;             // 桥面基准高度（两端），中段下垂 SAG
  var SAG = 17;                   // 铁索下垂幅度，做出悬索桥的弧
  var TIME_LIMIT = 60;            // 限时（秒）
  var MAX_HP = 5;                 // 生命上限
  var GOAL_X = WORLD_W - 190;     // 通关位置

  var GRAVITY = 2100;
  var MOVE_SPEED = 182;
  var JUMP_V = -740;
  var COYOTE_TIME = 0.12;         // 离地后仍可起跳的宽容时间
  var JUMP_BUFFER = 0.13;         // 落地前按下跳跃的缓存时间

  // 双击方向键冲刺
  var DASH_MULT = 1.9;            // 冲刺时的速度倍率
  var DASH_TIME = 0.26;           // 冲刺持续（秒）
  var DASH_COOLDOWN = 0.85;       // 冲刺冷却（秒）
  var DASH_TAP_WINDOW = 0.26;     // 判定为“双击”的两次按键间隔上限
  var PLAYER_FIRE_CD = 0.155;
  var PLAYER_BULLET_SPEED = 1080;
  var ENEMY_BULLET_SPEED = 385;
  var ENEMY_HP = 3;
  var INVULN_TIME = 1.25;
  var MAG_SIZE = 8;               // 弹匣容量
  var RELOAD_TIME = 0.85;         // 换弹时间（秒）
  var ENEMY_RANGE = 520;          // 守敌开火距离

  // 被拆掉桥板的缺口，必须跳过
  var GAPS = [
    { a: 1180, b: 1240 },
    { a: 2520, b: 2580 },
    { a: 3860, b: 3920 },
    { a: 5200, b: 5260 },
    { a: 6540, b: 6600 },
    { a: 7480, b: 7540 }
  ];

  // 守敌位置：三人一组据点，成组出现才有“火力封锁桥面”的压迫感
  var ENEMY_SPOTS = [
    690, 760, 830,
    1830, 1900, 1970,
    3170, 3240, 3310,
    4510, 4580, 4650,
    5850, 5920, 5990,
    6830, 6900, 6970,
    7690, 7760, 7830
  ];

  var FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC","Source Han Sans SC",sans-serif';

  /* ==================== 画布与舞台缩放 ==================== */

  /* 主程序把 #stage 撑成 1280×720 后整体缩放，
     所以这里只按 #stage 的实际尺寸建画布，不再读 window.innerWidth。 */
  var canvas = document.createElement('canvas');
  canvas.className = 'cz-canvas';
  root.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var VIEW = { s: 1, ox: 0, oy: 0, dpr: 1 };

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = root.clientWidth || window.innerWidth;
    var ch = root.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    var s = Math.min(canvas.width / W, canvas.height / H);
    VIEW.s = s;
    VIEW.ox = (canvas.width - W * s) / 2;
    VIEW.oy = (canvas.height - H * s) / 2;
    VIEW.dpr = dpr;
  }
  window.addEventListener('resize', resize);
  resize();

  /* 嵌在 iframe 里时，键盘事件要等 iframe 拿到焦点才生效。
     下面在第一次点按时把焦点抢过来，避免「按方向键没反应」。 */
  var embedded = (window.parent && window.parent !== window);

  /* ==================== 小工具 ==================== */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function inRect(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ==================== 输入 ==================== */

  var keys = Object.create(null);
  var mouseDown = false;
  var wantJump = false;
  var IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  var TOUCH_BTNS = [
    { id: 'left',  x: 16,      y: H - 112, w: 88, h: 88, label: '◀' },
    { id: 'right', x: 116,     y: H - 112, w: 88, h: 88, label: '▶' },
    { id: 'jump',  x: W - 104, y: H - 112, w: 88, h: 88, label: '跳' },
    { id: 'fire',  x: W - 204, y: H - 112, w: 88, h: 88, label: '射' }
  ];
  var touchState = { left: false, right: false, jump: false, fire: false };
  var pointerButtons = Object.create(null);

  var uiButton = { x: W / 2 - 112, y: 408, w: 224, h: 58, label: '开始冲锋' };

  function toLogical(ev) {
    var r = canvas.getBoundingClientRect();
    var px = (ev.clientX - r.left) * VIEW.dpr;
    var py = (ev.clientY - r.top) * VIEW.dpr;
    return { x: (px - VIEW.ox) / VIEW.s, y: (py - VIEW.oy) / VIEW.s };
  }

  function hitTouchBtn(p) {
    for (var i = 0; i < TOUCH_BTNS.length; i++) {
      if (inRect(p, TOUCH_BTNS[i])) return TOUCH_BTNS[i];
    }
    return null;
  }

  var tapState = { left: 0, right: 0 };

  // 连按两下同一方向 => 冲刺
  function registerTap(dir) {
    if (mode !== 'play' || !player) return;
    var now = performance.now() / 1000;
    var slot = dir < 0 ? 'left' : 'right';
    if (now - tapState[slot] <= DASH_TAP_WINDOW) {
      tapState[slot] = 0;          // 清掉时间戳，避免三连击连发
      startDash(dir);
    } else {
      tapState[slot] = now;
    }
  }

  function startDash(dir) {
    if (player.dashT > 0 || player.dashCd > 0) return;
    player.dashT = DASH_TIME;
    player.dashDir = dir;
    player.dashCd = DASH_COOLDOWN;
    sfx.dash();
    shake = Math.max(shake, 0.22);
    spawnParticles(player.x - dir * 12, player.y - 26, 9, '#d9c49c', 8, 130, 2.2);
  }

  function onKeyDown(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
    }
    keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') wantJump = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') registerTap(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') registerTap(1);
    if (mode !== 'play' && (e.code === 'Space' || e.code === 'Enter')) activate();
  }
  window.addEventListener('keydown', onKeyDown, { passive: false });

  function onKeyUp(e) {
    keys[e.code] = false;
  }
  window.addEventListener('keyup', onKeyUp);

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    // 嵌在 iframe 里时，点一下把焦点抢过来，方向键才会生效
    try { window.focus(); } catch (err) { /* ignore */ }
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    var p = toLogical(e);
    if (mode !== 'play') {
      if (inRect(p, uiButton)) activate();
      return;
    }
    if (IS_TOUCH) {
      var b = hitTouchBtn(p);
      if (b) {
        pointerButtons[e.pointerId] = b.id;
        touchState[b.id] = true;
        if (b.id === 'jump') wantJump = true;
        if (b.id === 'left') registerTap(-1);
        if (b.id === 'right') registerTap(1);
        return;
      }
    }
    mouseDown = true;
  });

  function releasePointer(id) {
    var bid = pointerButtons[id];
    if (bid) {
      touchState[bid] = false;
      delete pointerButtons[id];
      return;
    }
    mouseDown = false;
  }

  canvas.addEventListener('pointerup', function (e) { releasePointer(e.pointerId); });
  canvas.addEventListener('pointercancel', function (e) { releasePointer(e.pointerId); });
  window.addEventListener('blur', function () {
    mouseDown = false;
    touchState.left = touchState.right = touchState.jump = touchState.fire = false;
    pointerButtons = Object.create(null);
  });

  /* ==================== 音效（WebAudio 合成，无音频文件） ==================== */

  var ac = null;
  var noiseBuf = null;
  var lastShootSfx = 0;

  function initAudio() {
    if (ac) {
      if (ac.state === 'suspended') ac.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (err) { ac = null; return; }
    var len = Math.floor(ac.sampleRate * 0.3);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(f0, f1, dur, type, vol, delay) {
    if (!ac) return;
    var t = ac.currentTime + (delay || 0);
    var o = ac.createOscillator();
    var g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ac || !noiseBuf) return;
    var t = ac.currentTime;
    var s = ac.createBufferSource();
    s.buffer = noiseBuf;
    var f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq || 1400;
    f.Q.value = 0.9;
    var g = ac.createGain();
    g.gain.setValueAtTime(vol || 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(ac.destination);
    s.start(t); s.stop(t + dur + 0.02);
  }

  var sfx = {
    shoot: function () {
      var now = performance.now() / 1000;
      if (now - lastShootSfx < 0.05) return;
      lastShootSfx = now;
      noiseBurst(0.055, 0.035, 2100);
      tone(340, 130, 0.05, 'square', 0.028);
    },
    enemyShoot: function () {
      noiseBurst(0.06, 0.028, 900);
      tone(210, 90, 0.07, 'sawtooth', 0.02);
    },
    hitEnemy: function () { tone(700, 320, 0.045, 'square', 0.03); },
    down: function () { tone(190, 70, 0.13, 'square', 0.04); },
    hurt: function () {
      noiseBurst(0.2, 0.09, 380);
      tone(150, 60, 0.2, 'sine', 0.07);
    },
    jump: function () { tone(320, 560, 0.09, 'sine', 0.035); },
    land: function () { tone(120, 80, 0.05, 'sine', 0.03); },
    dash: function () {
      noiseBurst(0.16, 0.05, 760);
      tone(190, 440, 0.16, 'sine', 0.045);
    },
    win: function () {
      tone(523, 523, 0.18, 'sine', 0.06);
      tone(659, 659, 0.18, 'sine', 0.06, 0.16);
      tone(784, 784, 0.5, 'sine', 0.06, 0.32);
    },
    lose: function () {
      tone(300, 200, 0.3, 'sine', 0.06);
      tone(200, 90, 0.6, 'sine', 0.06, 0.22);
    }
  };

  /* ==================== 游戏状态 ==================== */

  var mode = 'intro';           // intro | play | win | lose
  var player = null;
  var bullets = [];
  var ebullets = [];
  var enemies = [];
  var particles = [];
  var camX = 0;
  var timeLeft = TIME_LIMIT;
  var elapsed = 0;
  var shake = 0;
  var hitFlash = 0;
  var animT = 0;
  var winTime = 0;
  var loseReason = '';
  var doneTimer = null;         // 通关后通知主程序的定时器

  function reset() {
    player = {
      x: 84, y: groundY(84),
      vx: 0, vy: 0,
      hp: MAX_HP,
      onGround: true,
      fireCd: 0,
      invuln: 0,
      runPhase: 0,
      recoil: 0,
      ammo: MAG_SIZE,
      reload: 0,
      coyote: 0,
      jumpBuf: 0,
      dashT: 0,
      dashDir: 1,
      dashCd: 0
    };
    tapState.left = 0;
    tapState.right = 0;
    bullets = [];
    ebullets = [];
    particles = [];
    enemies = ENEMY_SPOTS.map(function (ex, i) {
      return {
        x: ex, y: groundY(ex),
        hp: ENEMY_HP,
        alive: true,
        cd: rand(0.9, 2.4),
        flash: 0,
        recoil: 0
      };
    });
    camX = 0;
    timeLeft = TIME_LIMIT;
    elapsed = 0;
    shake = 0;
    hitFlash = 0;
    loseReason = '';
  }

  function startGame() {
    initAudio();
    reset();
    mode = 'play';
  }

  function activate() {
    // 嵌在主程序里：点了「继续」就立刻通知通关，不用等自动跳转
    if (mode === 'win' && embedded) { sendDone(); return; }
    if (mode === 'intro' || mode === 'win' || mode === 'lose') startGame();
  }

  function reachWin() {
    if (mode === 'win') return;
    mode = 'win';
    winTime = elapsed;
    sfx.win();
    // 嵌在主程序里才需要通知；单独打开时留在本关的胜利画面
    if (embedded) doneTimer = setTimeout(sendDone, 2600);
  }

  function reachLose(reason) {
    mode = 'lose';
    loseReason = reason;
    sfx.lose();
  }

  /* ---------- 与主程序通信（契约见 docs/level-api.md） ---------- */

  function postToParent(type) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: type }, '*');
        return true;
      }
    } catch (err) { /* 父窗口不存在或跨域，按独立运行处理 */ }
    return false;
  }

  /* 通关要通知主程序，否则地图那边一直挂着。
     但要在胜利画面停留一会儿再发：主程序收到 cz:done 会立刻销毁 iframe。 */
  function sendDone() {
    if (doneTimer) { clearTimeout(doneTimer); doneTimer = null; }
    return postToParent('cz:done');
  }

  /* ==================== 更新 ==================== */

  function hasGroundAt(x) {
    for (var i = 0; i < GAPS.length; i++) {
      if (x > GAPS[i].a && x < GAPS[i].b) return false;
    }
    return true;
  }

  function spawnParticles(x, y, n, col, spread, speed, size) {
    for (var i = 0; i < n; i++) {
      if (particles.length > 220) break;
      var a = rand(0, Math.PI * 2);
      var sp = rand(speed * 0.35, speed);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(0, spread),
        life: rand(0.2, 0.5),
        max: 0.5,
        col: col,
        size: rand(size * 0.6, size)
      });
    }
  }

  function firePlayer() {
    if (player.reload > 0 || player.fireCd > 0) return;
    if (player.ammo <= 0) {
      player.reload = RELOAD_TIME;
      return;
    }
    player.ammo -= 1;
    player.fireCd = PLAYER_FIRE_CD;
    player.recoil = 1;
    bullets.push({ x: player.x + 30, y: player.y - 41, vx: PLAYER_BULLET_SPEED, life: 0.56 });
    spawnParticles(player.x + 34, player.y - 41, 3, '#ffd27a', 40, 120, 2.2);
    sfx.shoot();
    shake = Math.max(shake, 0.06);
    if (player.ammo <= 0) player.reload = RELOAD_TIME;
  }

  function fireEnemy(e) {
    e.recoil = 1;
    var sx = e.x - 22, sy = e.y - 36;
    var tx = player.x + 4, ty = player.y - 34;
    var dx = tx - sx, dy = ty - sy;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    ebullets.push({
      x: sx, y: sy,
      vx: (dx / d) * ENEMY_BULLET_SPEED,
      vy: (dy / d) * ENEMY_BULLET_SPEED,
      life: 3.2
    });
    spawnParticles(sx, sy, 3, '#ff9a4a', 30, 110, 2);
    sfx.enemyShoot();
  }

  function hurtPlayer() {
    if (player.invuln > 0) return;
    player.hp -= 1;
    player.invuln = INVULN_TIME;
    hitFlash = 1;
    shake = 1;
    sfx.hurt();
    spawnParticles(player.x, player.y - 34, 10, '#e8534a', 90, 200, 2.6);
    if (player.hp <= 0) reachLose('hp');
  }

  function fallIntoGap() {
    var gx = null;
    for (var i = 0; i < GAPS.length; i++) {
      if (player.x > GAPS[i].a - 30 && player.x < GAPS[i].b + 30) gx = GAPS[i];
    }
    var back = gx ? gx.a - 48 : clamp(player.x - 70, 40, WORLD_W - 40);
    player.x = back;
    player.y = groundY(back);
    player.vy = 0;
    player.onGround = true;
    player.invuln = Math.max(player.invuln, INVULN_TIME);
    spawnParticles(player.x, groundY(back) + 40, 12, '#5f8f9a', 60, 160, 2.4);
    if (player.hp <= 0) reachLose('hp');
  }

  function updatePlay(dt) {
    elapsed += dt;
    timeLeft -= dt;

    if (timeLeft <= 0) {
      timeLeft = 0;
      reachLose('time');
      return;
    }

    /* ---- 玩家 ---- */
    var goLeft = keys.ArrowLeft || keys.KeyA || touchState.left;
    var goRight = keys.ArrowRight || keys.KeyD || touchState.right;

    var ax = 0;
    if (goLeft) ax -= 1;
    if (goRight) ax += 1;

    if (player.dashCd > 0) player.dashCd = Math.max(0, player.dashCd - dt);

    // 冲刺：短暂锁定方向，速度翻倍
    var speed = MOVE_SPEED;
    if (player.dashT > 0) {
      player.dashT -= dt;
      if (player.dashT < 0) player.dashT = 0;
      ax = player.dashDir;
      speed = MOVE_SPEED * DASH_MULT;
      if (Math.random() < 0.55) {
        spawnParticles(player.x - player.dashDir * 10, player.y - 6 - Math.random() * 34, 1, '#e6d3aa', 4, 80, 1.6);
      }
    }

    player.vx = ax * speed;
    var nx = clamp(player.x + player.vx * dt, 40, WORLD_W - 110);

    // 活着的守敌拦在桥上：必须打掉才能继续前进
    if (nx > player.x) {
      for (var bi = 0; bi < enemies.length; bi++) {
        var be = enemies[bi];
        if (!be.alive) continue;
        if (player.x <= be.x - 74 && nx > be.x - 74) {
          nx = be.x - 74;
          break;
        }
      }
    }
    player.x = nx;

    if (player.onGround && Math.abs(player.vx) > 1) {
      player.runPhase += dt * 11;
    }

    if (player.onGround) {
      player.coyote = COYOTE_TIME;
    } else if (player.coyote > 0) {
      player.coyote -= dt;
    }

    if (wantJump) {
      wantJump = false;
      player.jumpBuf = JUMP_BUFFER;
    }

    if (player.jumpBuf > 0) {
      if (player.onGround || player.coyote > 0) {
        player.vy = JUMP_V;
        player.onGround = false;
        player.coyote = 0;
        player.jumpBuf = 0;
        sfx.jump();
        spawnParticles(player.x, player.y, 4, '#8a7a5a', 20, 90, 1.8);
      } else {
        player.jumpBuf -= dt;
      }
    }

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    var gy = groundY(player.x);

    if (player.y >= gy) {
      if (player.vy >= 0 && hasGroundAt(player.x)) {
        if (!player.onGround && player.vy > 380) {
          sfx.land();
          spawnParticles(player.x, gy, 4, '#8a7a5a', 20, 80, 1.8);
        }
        player.y = gy;
        player.vy = 0;
        player.onGround = true;
      } else {
        player.onGround = false;
      }
    }

    if (player.y > gy + 170) {
      // 掉下去必定扣血，无敌帧不再豁免（否则可以反复刷过缺口）
      player.hp -= 1;
      hitFlash = 1;
      shake = 1;
      sfx.hurt();
      spawnParticles(player.x, gy + 30, 10, '#5f8f9a', 70, 170, 2.4);
      if (player.hp <= 0) { reachLose('hp'); return; }
      fallIntoGap();
      if (mode !== 'play') return;
    }

    if (player.invuln > 0) player.invuln -= dt;
    if (player.fireCd > 0) player.fireCd -= dt;
    if (player.recoil > 0) player.recoil -= dt * 6;
    if (player.reload > 0) {
      player.reload -= dt;
      if (player.reload <= 0) {
        player.reload = 0;
        player.ammo = MAG_SIZE;
      }
    }

    var firing = keys.Space || keys.KeyJ || mouseDown || touchState.fire;
    if (firing) firePlayer();

    /* ---- 相机 ---- */
    var targetCam = clamp(player.x - W * 0.34, 0, WORLD_W - W);
    camX += (targetCam - camX) * Math.min(1, dt * 7);

    /* ---- 玩家子弹 ---- */
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt;
      b.life -= dt;
      var dead = b.life <= 0 || b.x > WORLD_W;
      if (!dead) {
        for (var j = 0; j < enemies.length; j++) {
          var en = enemies[j];
          if (!en.alive) continue;
          if (b.x > en.x - 16 && b.x < en.x + 16 && b.y > en.y - 62 && b.y < en.y + 6) {
            en.hp -= 1;
            en.flash = 1;
            spawnParticles(b.x, b.y, 5, '#ffcf6a', 50, 180, 2.2);
            sfx.hitEnemy();
            if (en.hp <= 0) {
              en.alive = false;
              spawnParticles(en.x, en.y - 34, 14, '#8a4a3a', 70, 190, 2.6);
              sfx.down();
              shake = Math.max(shake, 0.35);
            }
            dead = true;
            break;
          }
        }
      }
      if (dead) bullets.splice(i, 1);
    }

    /* ---- 敌人 ---- */
    for (var k = 0; k < enemies.length; k++) {
      var e = enemies[k];
      if (!e.alive) continue;
      if (e.flash > 0) e.flash -= dt * 5;
      if (e.recoil > 0) e.recoil -= dt * 6;

      var dx = e.x - player.x;
      if (dx < -70 || dx > ENEMY_RANGE) continue;

      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = rand(1.7, 2.5);
        fireEnemy(e);
      }
    }

    /* ---- 敌方子弹 ---- */
    for (var m = ebullets.length - 1; m >= 0; m--) {
      var eb = ebullets[m];
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;
      eb.life -= dt;

      var hit = eb.life <= 0 || eb.x < -40 || eb.y > H + 40 || eb.y < -40;

      if (!hit && player.invuln <= 0) {
        if (eb.x > player.x - 13 && eb.x < player.x + 13 &&
            eb.y > player.y - 52 && eb.y < player.y) {
          hurtPlayer();
          hit = true;
          if (mode !== 'play') { ebullets.splice(m, 1); return; }
        }
      }
      if (hit) ebullets.splice(m, 1);
    }

    /* ---- 通关判定 ---- */
    if (player.x >= GOAL_X) reachWin();
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.vx *= 0.985;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 3.2);
    if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - dt * 2.4);
  }

  /* ==================== 绘制：地形 ==================== */

  // 桥面沿下垂弧线：两端 BRIDGE_Y，中间下垂 SAG
  function groundY(x) {
    var t = clamp(x / WORLD_W, 0, 1);
    return BRIDGE_Y + SAG * Math.sin(Math.PI * t);
  }

  function drawRidge(baseY, amp, color, parallax, seed, bottom) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-20, bottom);
    for (var sx = -20; sx <= W + 20; sx += 10) {
      var wx = sx + camX * parallax;
      var y = baseY
        - amp * (0.55 + 0.45 * Math.sin(wx * 0.0016 + seed * 3.1) * Math.sin(wx * 0.0007 + seed))
        - amp * 0.32 * Math.sin(wx * 0.0051 + seed * 1.7);
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(W + 20, bottom);
    ctx.closePath();
    ctx.fill();
  }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, 362);
    g.addColorStop(0, '#0b141d');
    g.addColorStop(0.18, '#18242f');
    g.addColorStop(0.38, '#33414c');
    g.addColorStop(0.56, '#6d5a45');
    g.addColorStop(0.72, '#a8763c');
    g.addColorStop(0.86, '#cf9450');
    g.addColorStop(1, '#e2b374');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 366);

    // 对岸火光在天上的散射
    var glow = ctx.createRadialGradient(W * 0.9, 300, 30, W * 0.9, 300, 520);
    glow.addColorStop(0, 'rgba(255,160,70,0.42)');
    glow.addColorStop(0.45, 'rgba(255,120,50,0.14)');
    glow.addColorStop(1, 'rgba(255,120,50,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 400);

    // 远山：三层，越近越暗；只填到地平线，桥下留出峡谷的空
    drawRidge(302, 74, '#16222e', 0.05, 1.3, 362);
    drawRidge(324, 50, '#0e1822', 0.15, 3.7, 362);
    drawRidge(344, 32, '#070d13', 0.30, 6.1, 362);
  }

  function drawGorge() {
    var top = 352;

    // 峡谷深处：越往下越被雾吞掉，只留底部一点水光
    var g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#0d1720');
    g.addColorStop(0.3, '#16242e');
    g.addColorStop(0.62, '#243842');
    g.addColorStop(0.86, '#334d56');
    g.addColorStop(1, '#283e46');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);

    // 谷底隐约的水光与浪声
    for (var i = 0; i < 26; i++) {
      var wy = 462 + ((i * 29) % 68);
      var wx = ((animT * (34 + (i % 7) * 9) + i * 113) % (W + 260)) - 130;
      var wa = 0.05 + (i % 4) * 0.02;
      ctx.strokeStyle = 'rgba(196,228,228,' + wa.toFixed(3) + ')';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + 34 + (i % 5) * 16, wy);
      ctx.stroke();
    }

    // 峡谷的雾：几层柔和横带，把谷底彻底藏起来
    for (var m = 0; m < 5; m++) {
      var my = 378 + m * 34 + Math.sin(animT * 0.55 + m * 1.4) * 6;
      var mg = ctx.createLinearGradient(0, my, 0, my + 64);
      mg.addColorStop(0, 'rgba(152,182,190,0)');
      mg.addColorStop(0.5, 'rgba(186,210,216,' + (0.06 + m * 0.016) + ')');
      mg.addColorStop(1, 'rgba(152,182,190,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, my, W, 64);
    }
  }

  function drawFarBank() {
    var bx = WORLD_W - 70;          // 崖壁起点：正好在终点之后
    var deck = groundY(WORLD_W);

    ctx.fillStyle = '#0a1218';
    ctx.beginPath();
    ctx.moveTo(bx - 6, deck + 60);
    ctx.lineTo(bx + 8, deck - 60);
    ctx.lineTo(bx + 30, deck - 152);
    ctx.lineTo(bx + 98, deck - 210);
    ctx.lineTo(bx + 252, deck - 238);
    ctx.lineTo(bx + 420, deck - 146);
    ctx.lineTo(bx + 520, H + 20);
    ctx.closePath();
    ctx.fill();

    // 桥头堡 / 城门
    ctx.fillStyle = '#131c24';
    ctx.fillRect(bx + 44, deck - 170, 126, 170);
    ctx.fillStyle = '#070d12';
    ctx.beginPath();
    ctx.moveTo(bx + 78, deck);
    ctx.lineTo(bx + 78, deck - 96);
    ctx.quadraticCurveTo(bx + 107, deck - 142, bx + 137, deck - 96);
    ctx.lineTo(bx + 137, deck);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1a242d';
    ctx.beginPath();
    ctx.moveTo(bx + 34, deck - 170);
    ctx.lineTo(bx + 107, deck - 208);
    ctx.lineTo(bx + 180, deck - 170);
    ctx.closePath();
    ctx.fill();

    // 城门后的火光
    var fg = ctx.createRadialGradient(bx + 107, deck - 56, 4, bx + 107, deck - 56, 120);
    fg.addColorStop(0, 'rgba(255,150,60,0.48)');
    fg.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(bx + 30, deck - 170, 200, 170);

    // 崖顶边缘光
    ctx.strokeStyle = 'rgba(255,160,80,0.26)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 30, deck - 152);
    ctx.lineTo(bx + 98, deck - 210);
    ctx.lineTo(bx + 252, deck - 238);
    ctx.lineTo(bx + 420, deck - 146);
    ctx.stroke();
  }

  function drawBridge() {
    var left = camX - 80;
    var right = Math.min(camX + W + 80, WORLD_W - 70);
    var sway = Math.sin(animT * 1.45) * 2.6;
    var sway2 = Math.sin(animT * 1.45 + 0.85) * 3.6;
    var x, y;

    /* ---- 远侧扶手链：更暗更高，制造纵深 ---- */
    ctx.strokeStyle = 'rgba(64,54,42,0.52)';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    for (x = left; x <= right; x += 14) {
      y = groundY(x) - 96 + sway2 * 0.8;
      if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    /* ---- 木板桥面（沿下垂弧线铺设） ---- */
    var startP = Math.floor(left / 30) * 30;
    for (var p = startP; p < right; p += 30) {
      if (!hasGroundAt(p + 13)) continue;
      var y0 = groundY(p);
      var y1 = groundY(p + 26);
      var burnt = p > WORLD_W - 660;
      ctx.beginPath();
      ctx.moveTo(p, y0);
      ctx.lineTo(p + 26, y1);
      ctx.lineTo(p + 26, y1 + 22);
      ctx.lineTo(p, y0 + 22);
      ctx.closePath();
      ctx.fillStyle = burnt ? '#1c1009' : ((Math.floor(p / 30) % 4 === 0) ? '#2a2016' : '#1e1710');
      ctx.fill();
      // 板缝
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(p - 1, y0, 1.6, 22);
      // 木面反光
      ctx.fillStyle = 'rgba(225,180,120,0.16)';
      ctx.beginPath();
      ctx.moveTo(p, y0);
      ctx.lineTo(p + 26, y1);
      ctx.lineTo(p + 26, y1 + 2);
      ctx.lineTo(p, y0 + 2);
      ctx.closePath();
      ctx.fill();
    }

    /* ---- 桥面被火光打亮的上沿，加上下方的阴影：做出“一条路”的厚度 ---- */
    ctx.strokeStyle = 'rgba(255,196,120,0.40)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (x = left; x <= right; x += 12) {
      y = groundY(x);
      if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (x = left; x <= right; x += 12) {
      y = groundY(x) + 19;
      if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    /* ---- 底链（承重索） ---- */
    ctx.strokeStyle = '#463a2c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (x = left; x <= right; x += 14) {
      y = groundY(x) + 15 + sway * 0.5;
      if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(214,168,110,0.34)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (x = left; x <= right; x += 14) {
      y = groundY(x) + 12 + sway * 0.5;
      if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    /* ---- 近侧扶手链 ---- */
    ctx.strokeStyle = 'rgba(72,58,44,0.9)';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    for (x = left; x <= right; x += 14) {
      y = groundY(x) - 74 + sway;
      if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(240,190,128,0.34)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (x = left; x <= right; x += 14) {
      y = groundY(x) - 76.5 + sway;
      if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    /* ---- 吊杆：密排，读出“铁索桥”的肌理 ---- */

    // 远侧一排
    ctx.strokeStyle = 'rgba(58,48,38,0.22)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (var hb = Math.floor(left / 44) * 44 + 22; hb < right; hb += 44) {
      ctx.moveTo(hb, groundY(hb) - 96 + sway2 * 0.8);
      ctx.lineTo(hb, groundY(hb) + 15);
    }
    ctx.stroke();

    // 近侧一排
    ctx.strokeStyle = 'rgba(96,77,58,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (var h = Math.floor(left / 44) * 44; h < right; h += 44) {
      ctx.moveTo(h, groundY(h) - 74 + sway);
      ctx.lineTo(h, groundY(h) + 15);
    }
    ctx.stroke();

    // 吊杆底部的小铁环
    ctx.fillStyle = 'rgba(150,120,84,0.35)';
    for (var hr = Math.floor(left / 44) * 44; hr < right; hr += 44) {
      ctx.fillRect(hr - 1.3, groundY(hr) + 13, 2.6, 2.6);
    }

    /* ---- 缺口：断裂的桥板 ---- */
    for (var i = 0; i < GAPS.length; i++) {
      var g0 = GAPS[i];
      if (g0.b < left - 60 || g0.a > right + 60) continue;
      var gaL = groundY(g0.a), gaR = groundY(g0.b);
      ctx.fillStyle = '#150d09';
      ctx.fillRect(g0.a - 6, gaL - 3, 7, 20);
      ctx.fillRect(g0.b - 1, gaR - 3, 7, 20);
      ctx.save();
      ctx.translate(g0.a - 2, gaL + 2);
      ctx.rotate(0.72 + Math.sin(animT * 2.2) * 0.06);
      ctx.fillStyle = '#2e2218';
      ctx.fillRect(0, 0, 6, 18);
      ctx.restore();
      ctx.save();
      ctx.translate(g0.b + 2, gaR + 2);
      ctx.rotate(-0.72 + Math.sin(animT * 2.2 + 1) * 0.06);
      ctx.fillStyle = '#2e2218';
      ctx.fillRect(-6, 0, 6, 18);
      ctx.restore();
    }

    /* ---- 近岸桥台 ---- */
    if (camX < 260) {
      var deckN = groundY(0);
      ctx.fillStyle = '#1a1611';
      ctx.beginPath();
      ctx.moveTo(-40, deckN + 16);
      ctx.lineTo(-40, deckN - 98);
      ctx.lineTo(74, deckN - 108);
      ctx.lineTo(96, deckN + 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,180,110,0.13)';
      ctx.fillRect(-40, deckN - 102, 136, 2);
    }
  }

  function drawFire() {
    var fx0 = WORLD_W - 640;
    var fx1 = WORLD_W - 24;
    var base = groundY(WORLD_W - 300);

    // 桥面被火照亮的大范围辉光
    var gl = ctx.createRadialGradient(WORLD_W - 320, base - 30, 10, WORLD_W - 320, base - 30, 470);
    gl.addColorStop(0, 'rgba(255,160,70,0.30)');
    gl.addColorStop(0.5, 'rgba(255,110,40,0.10)');
    gl.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(WORLD_W - 1020, base - 400, 1120, 540);

    // 火舌：逐个尖顶形状叠出火墙，靠低频包络聚成几团大火
    function tongues(hMul, widthMul, colOuter, colInner, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      for (var x = fx0; x <= fx1; x += 11) {
        var jitter = Math.sin(x * 0.9) * 5;
        var wx = x + jitter;
        var env = 0.34 + 0.66 * (0.5 + 0.5 * Math.sin(wx * 0.0115 - 1.1));
        var n = Math.sin(wx * 0.058 + animT * 4.4) * 0.5
              + Math.sin(wx * 0.023 - animT * 2.7) * 0.5;
        var h = (16 + 62 * env + 13 * n) * hMul;
        var w = (7 + 5 * Math.abs(n)) * widthMul;
        var by = groundY(wx) + 7;
        var sway = Math.sin(animT * 3.2 + wx * 0.05) * 5;

        // 外层
        ctx.beginPath();
        ctx.moveTo(wx - w, by);
        ctx.quadraticCurveTo(wx - w * 0.85 + sway * 0.4, by - h * 0.55, wx + sway, by - h);
        ctx.quadraticCurveTo(wx + w * 0.85 + sway * 0.4, by - h * 0.55, wx + w, by);
        ctx.closePath();
        ctx.fillStyle = colOuter;
        ctx.fill();

        // 内层芯
        if (hMul > 0.5) {
          ctx.beginPath();
          ctx.moveTo(wx - w * 0.42, by);
          ctx.quadraticCurveTo(wx - w * 0.38 + sway * 0.3, by - h * 0.4, wx + sway * 0.8, by - h * 0.72);
          ctx.quadraticCurveTo(wx + w * 0.38 + sway * 0.3, by - h * 0.4, wx + w * 0.42, by);
          ctx.closePath();
          ctx.fillStyle = colInner;
          ctx.fill();
        }
      }
      ctx.restore();
    }

    tongues(1.0, 1.0, 'rgba(255,110,32,0.55)', 'rgba(255,170,70,0.35)', 0.9);
    tongues(0.72, 0.72, 'rgba(255,158,52,0.7)', 'rgba(255,222,140,0.5)', 0.9);
    tongues(0.44, 0.45, 'rgba(255,214,120,0.85)', 'rgba(255,250,220,0.75)', 0.9);

    // 火星
    for (var k = 0; k < 18; k++) {
      var t = (animT * (0.6 + k * 0.06) + k * 0.31) % 1;
      var ex = fx0 + 50 + ((k * 137) % 540) + Math.sin(animT * 2 + k) * 16;
      var ey = groundY(ex) - t * 220;
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.fillStyle = k % 3 === 0 ? '#ffd88a' : '#ff8a3a';
      ctx.fillRect(ex, ey, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  /* ==================== 绘制：角色 ==================== */

  function drawFigure(sx, sy, opts) {
    var phase = opts.phase || 0;
    var facing = opts.facing || 1;
    var scale = opts.scale || 1;
    var body = opts.body || '#141c24';
    var rim = opts.rim || 'rgba(235,185,115,0.8)';
    var recoil = opts.recoil || 0;
    var flash = opts.flash || 0;
    var lean = opts.lean || 0;
    var band = opts.band || null;
    var s = Math.sin(phase);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(facing * scale, scale);
    ctx.rotate(lean);

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 17, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = body;
    ctx.strokeStyle = body;

    // 腿：髋在 -27，双脚交替（保留一点基础张角，站定也不会并成一根）
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1.5, -27);
    ctx.lineTo(s * 12 + 3, -1);
    ctx.moveTo(1.5, -27);
    ctx.lineTo(-s * 12 - 3, -1);
    ctx.stroke();

    // 躯干
    ctx.beginPath();
    ctx.moveTo(-6.5, -51);
    ctx.lineTo(6.5, -51);
    ctx.lineTo(4.5, -26);
    ctx.lineTo(-4.5, -26);
    ctx.closePath();
    ctx.fill();

    // 背包（干粮袋）
    ctx.fillStyle = 'rgba(58,48,36,1)';
    roundRect(ctx, -13, -49, 9, 16, 3);
    ctx.fill();
    ctx.fillStyle = body;

    // 持枪手臂
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(2, -46);
    ctx.lineTo(15, -39 + recoil * 2.5);
    ctx.stroke();

    // 头
    ctx.beginPath();
    ctx.arc(1.5, -58, 7.6, 0, Math.PI * 2);
    ctx.fill();
    // 八角帽
    ctx.beginPath();
    ctx.ellipse(1.5, -62.5, 8.6, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 帽檐
    ctx.beginPath();
    ctx.ellipse(7.5, -61, 5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 红领章
    if (band) {
      ctx.fillStyle = band;
      ctx.fillRect(-1, -53.5, 5, 3);
      ctx.fillStyle = body;
    }

    // 步枪
    ctx.strokeStyle = '#232326';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(8, -41 + recoil * 2.5);
    ctx.lineTo(28, -37 + recoil * 2.5);
    ctx.stroke();
    ctx.fillStyle = '#33333a';
    ctx.fillRect(20, -39.5 + recoil * 2.5, 8, 2.6);

    // 边缘光
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(6, -50);
    ctx.lineTo(4.5, -27);
    ctx.moveTo(4, -64);
    ctx.lineTo(6, -54);
    ctx.stroke();

    // 受击闪白：用柔和的辉光，别糊成一枚死白的圆点
    if (flash > 0) {
      var fa = Math.min(1, flash) * 0.6;
      var fg = ctx.createRadialGradient(0, -38, 1, 0, -38, 26);
      fg.addColorStop(0, 'rgba(255,244,214,' + fa.toFixed(3) + ')');
      fg.addColorStop(0.55, 'rgba(255,226,170,' + (fa * 0.45).toFixed(3) + ')');
      fg.addColorStop(1, 'rgba(255,226,170,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(0, -38, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPlayer() {
    if (!player) return;
    var blink = player.invuln > 0 && Math.floor(player.invuln * 18) % 2 === 0;

    // 火光照出的轮廓光晕
    var g = ctx.createRadialGradient(player.x + 4, player.y - 34, 2, player.x + 4, player.y - 34, 66);
    g.addColorStop(0, 'rgba(255,180,100,0.16)');
    g.addColorStop(1, 'rgba(255,180,100,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(player.x + 4, player.y - 34, 66, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.globalAlpha = blink ? 0.45 : 1;

    // 冲刺残影与速度线
    if (player.dashT > 0) {
      var k = clamp(player.dashT / DASH_TIME, 0, 1);
      for (var gi = 3; gi >= 1; gi--) {
        ctx.globalAlpha = 0.30 * k * (1 - (gi - 1) * 0.24);
        drawFigure(player.x - player.dashDir * gi * 21, player.y, {
          phase: player.runPhase - gi * 0.5,
          facing: 1,
          scale: 1.2,
          body: '#0d151b',
          rim: 'rgba(250,200,130,0.9)',
          lean: 0.16
        });
      }
      ctx.globalAlpha = blink ? 0.45 : 1;

      ctx.lineCap = 'round';
      for (var si = 0; si < 5; si++) {
        var ly = player.y - 8 - si * 12;
        var len = 46 + si * 26;
        ctx.strokeStyle = 'rgba(255,226,168,' + (0.55 * k * (1 - si * 0.12)).toFixed(2) + ')';
        ctx.lineWidth = 2.8 - si * 0.3;
        ctx.beginPath();
        ctx.moveTo(player.x - player.dashDir * 28, ly);
        ctx.lineTo(player.x - player.dashDir * (28 + len), ly);
        ctx.stroke();
      }
    }

    drawFigure(player.x, player.y, {
      phase: player.runPhase,
      facing: 1,
      scale: 1.2,
      body: '#111a22',
      rim: 'rgba(250,200,130,0.95)',
      lean: player.onGround ? 0.05 : 0.09,
      recoil: player.recoil,
      band: '#b8432f'
    });
    // 枪口火光
    if (player.recoil > 0.6) {
      var r = 6 * player.recoil;
      var mf = ctx.createRadialGradient(player.x + 34, player.y - 45, 0, player.x + 34, player.y - 45, r * 3.2);
      mf.addColorStop(0, 'rgba(255,245,200,' + player.recoil + ')');
      mf.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = mf;
      ctx.beginPath();
      ctx.arc(player.x + 34, player.y - 45, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemies() {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) continue;
      if (e.x < camX - 100 || e.x > camX + W + 100) continue;

      // 瞄准警示
      if (e.cd < 0.42 && e.cd > 0) {
        var a = 1 - e.cd / 0.42;
        ctx.strokeStyle = 'rgba(255,120,80,' + (0.25 + a * 0.5).toFixed(2) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x - 22, e.y - 36, 9 + a * 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      drawFigure(e.x, e.y, {
        phase: 0,
        facing: -1,
        scale: 1.02,
        body: '#1d1210',
        rim: 'rgba(214,108,68,0.72)',
        lean: -0.05,
        recoil: e.recoil,
        flash: e.flash
      });
    }
  }

  function drawBullets() {
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      var g = ctx.createLinearGradient(b.x - 24, 0, b.x, 0);
      g.addColorStop(0, 'rgba(255,220,130,0)');
      g.addColorStop(1, 'rgba(255,235,170,0.95)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(b.x - 24, b.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (var j = 0; j < ebullets.length; j++) {
      var eb = ebullets[j];
      var g2 = ctx.createLinearGradient(eb.x + 26, 0, eb.x, 0);
      g2.addColorStop(0, 'rgba(255,90,50,0)');
      g2.addColorStop(1, 'rgba(255,140,80,0.95)');
      ctx.strokeStyle = g2;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(eb.x + 26, eb.y);
      ctx.lineTo(eb.x, eb.y);
      ctx.stroke();
      ctx.fillStyle = '#ffd08a';
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawForeground() {
    var m = ctx.createLinearGradient(0, H - 130, 0, H + 10);
    m.addColorStop(0, 'rgba(150,185,190,0)');
    m.addColorStop(0.6, 'rgba(150,185,190,0.055)');
    m.addColorStop(1, 'rgba(150,185,190,0)');
    ctx.fillStyle = m;
    ctx.fillRect(0, H - 130, W, 140);
  }

  function drawScene() {
    drawSky();
    drawGorge();

    ctx.save();
    ctx.translate(-camX, 0);
    drawFarBank();
    drawBridge();
    drawFire();
    drawEnemies();
    drawPlayer();
    drawBullets();
    drawParticles();
    ctx.restore();

    drawForeground();

    // 暗角
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.46, W / 2, H / 2, H * 0.98);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.52)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // 受击红闪
    if (hitFlash > 0) {
      ctx.fillStyle = 'rgba(190,30,25,' + (hitFlash * 0.3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ==================== 绘制：HUD ==================== */

  function drawHUD() {
    if (!player) return;

    ctx.fillStyle = 'rgba(7,11,15,0.62)';
    ctx.fillRect(0, 0, W, 56);
    ctx.fillStyle = 'rgba(255,180,90,0.35)';
    ctx.fillRect(0, 55, W, 1);

    ctx.font = '13px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('生命', 20, 28);

    for (var i = 0; i < MAX_HP; i++) {
      var bx = 62 + i * 25;
      if (i < player.hp) {
        ctx.fillStyle = '#e8534a';
        roundRect(ctx, bx, 19, 18, 18, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,220,190,0.35)';
        roundRect(ctx, bx + 2, 21, 14, 6, 3);
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.20)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, 19, 18, 18, 4);
        ctx.stroke();
      }
    }

    // 弹药
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('弹药', 214, 28);

    for (var a = 0; a < MAG_SIZE; a++) {
      var ax = 252 + a * 13;
      ctx.fillStyle = a < player.ammo ? '#e8c07a' : 'rgba(255,255,255,0.15)';
      roundRect(ctx, ax, 22, 8, 12, 2);
      ctx.fill();
    }
    if (player.reload > 0) {
      ctx.fillStyle = 'rgba(255,190,110,0.95)';
      ctx.font = '11px ' + FONT;
      ctx.fillText('装填中', 364, 28);
    }

    var urgent = timeLeft <= 15;
    var pulse = urgent ? (0.65 + 0.35 * Math.sin(animT * 12)) : 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 27px ' + FONT;
    ctx.fillStyle = urgent
      ? 'rgba(255,' + Math.round(80 + 120 * pulse) + ',70,1)'
      : '#f3ead9';
    ctx.fillText(timeLeft.toFixed(1), W / 2, 29);
    ctx.font = '11px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('剩余秒数', W / 2, 47);

    var prog = clamp(player.x / GOAL_X, 0, 1);
    ctx.textAlign = 'right';
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('对岸 ' + Math.round(prog * 100) + '%', W - 24, 24);

    var barW = 150, barX = W - 24 - barW, barY = 36;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, barX, barY, barW, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#d8a45a';
    roundRect(ctx, barX, barY, Math.max(4, barW * prog), 6, 3);
    ctx.fill();

    if (IS_TOUCH) {
      for (var k = 0; k < TOUCH_BTNS.length; k++) {
        var b = TOUCH_BTNS[k];
        var on = touchState[b.id];
        ctx.fillStyle = on ? 'rgba(240,170,90,0.32)' : 'rgba(10,16,20,0.40)';
        roundRect(ctx, b.x, b.y, b.w, b.h, 16);
        ctx.fill();
        ctx.strokeStyle = on ? 'rgba(255,200,120,0.85)' : 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.6;
        roundRect(ctx, b.x, b.y, b.w, b.h, 16);
        ctx.stroke();
        ctx.fillStyle = on ? '#fff3d8' : 'rgba(255,255,255,0.72)';
        ctx.font = 'bold 26px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      }
    }
  }

  /* ==================== 绘制：界面 ==================== */

  function drawButton(label) {
    ctx.fillStyle = '#c8492f';
    roundRect(ctx, uiButton.x, uiButton.y, uiButton.w, uiButton.h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,150,0.55)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, uiButton.x, uiButton.y, uiButton.w, uiButton.h, 10);
    ctx.stroke();
    ctx.fillStyle = '#fff6e8';
    ctx.font = 'bold 20px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, uiButton.y + uiButton.h / 2 + 1);
  }

  function drawCenterLine(y, w) {
    var g = ctx.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
    g.addColorStop(0, 'rgba(200,73,47,0)');
    g.addColorStop(0.5, 'rgba(200,73,47,0.9)');
    g.addColorStop(1, 'rgba(200,73,47,0)');
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - w / 2, y, w, 2);
  }

  function drawIntro() {
    ctx.fillStyle = 'rgba(5,9,13,0.76)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#f6ead6';
    ctx.font = 'bold 46px ' + FONT;
    ctx.fillText('飞 夺 泸 定 桥', W / 2, 118);

    ctx.fillStyle = 'rgba(216,164,90,0.9)';
    ctx.font = '14px ' + FONT;
    ctx.fillText('1935 · 大 渡 河', W / 2, 150);

    drawCenterLine(172, 260);

    var lines = [
      '1935 年 5 月 29 日，红四团一昼夜奔袭二百四十里，',
      '抢在敌军增援之前赶到大渡河泸定桥。',
      '桥板已被拆去，只剩十三根铁索横在江上，对岸以火力封锁桥面；',
      '二十二名突击队员攀着铁索向对岸冲击。'
    ];
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = 'rgba(238,232,220,0.86)';
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, 212 + i * 28);
    }

    drawCenterLine(330, 420);

    ctx.font = '16px ' + FONT;
    ctx.fillStyle = '#ffd9a0';
    ctx.fillText('目标：60 秒内冲过桥去', W / 2, 352);

    ctx.font = '14px ' + FONT;
    ctx.fillStyle = 'rgba(238,232,220,0.70)';
    ctx.fillText('← → / A D 移动　　　↑ / W 跳　　　空格 / 点击 射击', W / 2, 380);
    ctx.fillStyle = 'rgba(255,217,160,0.85)';
    ctx.fillText('连按两下 ← / → 冲刺加速', W / 2, 404);

    uiButton.y = 424;
    drawButton('开始冲锋');

    ctx.font = '11px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fillText('本作为游戏化演绎，非史料原文。', W / 2, 498);
  }

  function drawWin() {
    ctx.fillStyle = 'rgba(5,9,13,0.78)';
    ctx.fillRect(0, 0, W, H);
    uiButton.y = 408;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#f6ead6';
    ctx.font = 'bold 48px ' + FONT;
    ctx.fillText('冲 过 去 了', W / 2, 168);

    drawCenterLine(196, 300);

    ctx.font = '17px ' + FONT;
    ctx.fillStyle = '#ffd9a0';
    ctx.fillText('用时 ' + winTime.toFixed(1) + ' 秒　·　剩余生命 ' + player.hp + ' 格', W / 2, 238);

    ctx.font = '16px ' + FONT;
    ctx.fillStyle = 'rgba(238,232,220,0.85)';
    ctx.fillText('身后，木板一块一块铺上来，', W / 2, 290);
    ctx.fillText('队伍跟上来了。', W / 2, 320);

    drawButton(embedded ? '继 续' : '再冲一次');

    ctx.font = '11px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fillText('本作为游戏化演绎，非史料原文。', W / 2, 498);
  }

  function drawLose() {
    ctx.fillStyle = 'rgba(5,9,13,0.78)';
    ctx.fillRect(0, 0, W, H);
    uiButton.y = 408;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#f6ead6';
    ctx.font = 'bold 44px ' + FONT;
    ctx.fillText(loseReason === 'time' ? '时 间 到 了' : '倒 在 了 桥 上', W / 2, 176);

    drawCenterLine(204, 300);

    var sub = loseReason === 'time'
      ? '对岸的援兵已经赶到。'
      : '大渡河的水声，盖过了一切。';
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = 'rgba(238,232,220,0.85)';
    ctx.fillText(sub, W / 2, 248);

    ctx.font = '15px ' + FONT;
    ctx.fillStyle = 'rgba(238,232,220,0.62)';
    ctx.fillText('桥还在那里。再试一次。', W / 2, 292);

    drawButton('再冲一次');
  }

  /* ==================== 主循环 ==================== */

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05080b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(VIEW.s, 0, 0, VIEW.s, VIEW.ox, VIEW.oy);

    var sh = shake * 9;
    var sx = (Math.random() - 0.5) * sh;
    var sy = (Math.random() - 0.5) * sh;

    ctx.save();
    ctx.translate(sx, sy);
    drawScene();
    ctx.restore();

    if (mode === 'play') {
      drawHUD();
    } else if (mode === 'intro') {
      drawIntro();
    } else if (mode === 'win') {
      drawWin();
    } else if (mode === 'lose') {
      drawLose();
    }

    // 竖屏提示
    if (window.innerHeight > window.innerWidth) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, H - 30, W, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('横屏游玩体验更佳', W / 2, H - 14);
    }
  }

  var last = 0;

  function loop(ts) {
    if (!last) last = ts;
    var dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.05) dt = 0.05;

    animT += dt;

    if (mode === 'play') {
      updatePlay(dt);
    }
    updateParticles(dt);

    draw();
    requestAnimationFrame(loop);
  }

  // 调试钩子：仅在 ?debug=1 时暴露，方便自动化截图与调参，不影响正常游玩
  if (/[?&]debug=1/.test(location.search)) {
    window.__LUDING = {
      state: function () {
        return {
          mode: mode,
          hp: player ? player.hp : 0,
          x: player ? Math.round(player.x) : 0,
          time: +timeLeft.toFixed(1),
          ammo: player ? player.ammo : 0,
          dashCd: player ? +Math.max(0, player.dashCd).toFixed(2) : 0,
          dashing: player ? player.dashT > 0 : false
        };
      },
      start: startGame,
      win: reachWin,
      lose: function (r) { reachLose(r || 'hp'); },
      hurt: hurtPlayer,
      gaps: GAPS,
      dash: function (d) { startDash(d || 1); },
      teleport: function (x) {
        player.x = x;
        player.y = groundY(x);
        camX = clamp(x - W * 0.34, 0, WORLD_W - W);
      }
    };
  }

  // 初始化：先铺一个空状态，intro 界面也有背景可看
  reset();
  mode = 'intro';
  requestAnimationFrame(loop);

  /* 关卡卸载（主程序目前是直接销毁 iframe，所以这里只是兜底：
     如果哪天改成同页挂载，把监听和定时器都收干净） */
  return {
    destroy: function () {
      if (doneTimer) { clearTimeout(doneTimer); doneTimer = null; }
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      root.dataset.mounted = '';
    }
  };

  } /* ---- end mount ---- */

  global.LEVEL = { mount: mount };

  // iframe 里由 index.html 直接拉起；单独双击 index.html 也走同一条路
  var stage = document.getElementById('stage');
  if (stage && !stage.dataset.mounted) mount(stage, null);

})(window);
