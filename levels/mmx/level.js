/* =========================================================
 * 飞夺泸定桥 —— 长征题材 2D 射击关卡
 * levels/mmx/level.js
 *
 * 平台约定（见 docs/level-api.md）：
 *   - index.html 固定加载 level.js，舞台固定 1280 × 720
 *   - 关卡逻辑导出 global.LDQ_LEVEL = { mount }，主程序调用 mount(#stage)
 *   - 通关必须 window.parent.postMessage({ type: 'cz:done' })
 *
 * 玩法（按史实修正）：
 *   守军在对岸桥头，不上桥。红军突击队员沿铁索桥推进，
 *   越过桥面中点时守军泼油放火，桥头烧成一道火墙 —— 只能向前冲。
 *   打退 3 波守敌后冲上对岸桥头，夺下泸定桥。
 *
 * 操作：←/→ 或 A/D 前后移动，↑/↓ 或 W/S 换位，J / 空格 开枪，
 *       回车 开始 / 重来，M 静音
 *
 * 历史参考：1935 年 5 月 29 日，红四团一昼夜急行军 240 里奔袭泸定桥；
 *           泸定桥由 13 根铁链组成（9 根底链 + 4 根扶手链），
 *           全长约 103 米、宽约 3 米，守军拆去桥板，仅剩铁索；
 *           22 名突击队员攀着铁索，冲过桥头火障夺下桥头。
 * 所有画面均由 Canvas 绘制，不使用任何外部素材。
 * ========================================================= */
(function (global) {
  'use strict';

  var W = 1280, H = 720;

  /* ================= 版面参数 ================= */
  var DECK_L = 96;            // 铁索桥左端（红军一侧桥台）
  var DECK_R = 1000;          // 铁索桥右端（对岸桥头）
  var BANK_X = 1000;          // 对岸地面起点
  var BRIDGE_TOP = 306;       // 可活动区上沿
  var BRIDGE_BOT = 486;       // 可活动区下沿（再往下是大渡河）
  var RIVER_Y = 486;
  var MID_X = 548;            // 桥面中点：越过这里，守军就放火（(96+1000)/2）
  var FIRE_MIN = 720;         // 火线最多往左烧到这里
  var FIRE_START = 800;       // 火起时桥头已经烧着的那一段
  var WIN_X = 998;            // 冲上对岸桥头的判定线
  var BULLET_RANGE = 900;     // 子弹有效射程：够得着对岸桥头，边走边压制守军
  var BULLET_SPEED = 1100;

  /* ================= 工具 ================= */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function shuffle(arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = (Math.random() * (i + 1)) | 0;
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* 五角星：帽徽用，实心红色（需要 ctx，所以放在 mount 里） */

  /* ================= 挂载入口 ================= */
  function mount(root, hostCtx) {
    if (!root) return;

    /* ---------- 画布（舞台 1280×720） ----------
       index.html 里已经放好了 canvas；万一没有才临时建一块。 */
    var canvas = null;
    try { canvas = root.querySelector ? root.querySelector('canvas') : null; } catch (e) {}
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.cssText =
        'display:block;width:100%;height:100%;background:#0b1220;touch-action:none;';
      root.appendChild(canvas);
    }
    canvas.width = W;
    canvas.height = H;
    if (!canvas.style.width) canvas.style.width = '100%';
    if (!canvas.style.height) canvas.style.height = '100%';

    var ctx = hostCtx || canvas.getContext('2d');

    /* 五角星路径（帽徽） */
    function starPath(cx, cy, R, r, rot) {
      var i, a, x, y;
      ctx.beginPath();
      for (i = 0; i < 10; i++) {
        a = rot + i * Math.PI / 5;
        var rr = (i % 2 === 0) ? R : r;
        x = cx + Math.cos(a) * rr;
        y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    /* ---------- 音效（WebAudio，无外部素材） ---------- */
    var actx = null, muted = false;
    function beep(freq, dur, type, vol) {
      if (muted) return;
      try {
        if (!actx) {
          var AC = global.AudioContext || global.webkitAudioContext;
          if (!AC) return;
          actx = new AC();
        }
        if (actx.state === 'suspended' && actx.resume) actx.resume();
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = type || 'square';
        o.frequency.value = freq;
        g.gain.value = vol || 0.025;
        o.connect(g); g.connect(actx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
        o.stop(actx.currentTime + dur + 0.02);
      } catch (e) {}
    }
    function roar() {
      // 放火那一下的低频轰鸣
      if (muted) return;
      try {
        if (!actx) {
          var AC = global.AudioContext || global.webkitAudioContext;
          if (!AC) return;
          actx = new AC();
        }
        if (actx.state === 'suspended' && actx.resume) actx.resume();
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(140, actx.currentTime);
        o.frequency.exponentialRampToValueAtTime(48, actx.currentTime + 1.1);
        g.gain.setValueAtTime(0.05, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 1.2);
        o.connect(g); g.connect(actx.destination);
        o.start();
        o.stop(actx.currentTime + 1.25);
      } catch (e) {}
    }

    /* ---------- 状态 ---------- */
    var ST_INTRO = 'intro', ST_PLAY = 'play',
        ST_OVER = 'over', ST_WIN = 'win', ST_DONE = 'done';
    var state = ST_INTRO, stateTimer = 0;

    var player, bullets, eBullets, enemies, particles, banners, embers;
    var score, kills, spawnQueue, spawnTimer, shake, timeAcc;
    var fire, hint, routed = false;
    var winButton = null;

    /* ---------- 玩家 ---------- */
    function resetPlayer() {
      player = {
        x: 150, y: 348,
        w: 34, h: 60,
        hp: 100, maxHp: 100,
        speed: 300,
        fireCd: 0, fireGap: 0.16,
        invul: 0, muzzle: 0, recoil: 0, burnCd: 0
      };
    }

    function resetGame() {
      resetPlayer();
      bullets = []; eBullets = []; enemies = []; particles = [];
      banners = []; embers = [];
      score = 0; kills = 0;
      spawnQueue = []; spawnTimer = 0; shake = 0; timeAcc = 0;
      fire = { on: false, edge: FIRE_START, t: 0 };
      routed = false;
      finished = false;
      hint = '沿铁索向前推进 · 枪能打到对岸，边走边压制';
      spawnDefenders();
    }

    /* ---------- 守军（整局只有这一轮：拦击 → 放火 → 溃逃） ---------- */
    var N_RIFLE = 5;            // 桥头步枪手
    var N_GUN = 1;              // 机枪一挺

    var RIFLE_SLOTS = [
      { x: 1010, y: 302 }, { x: 1010, y: 368 }, { x: 1054, y: 332 },
      { x: 1054, y: 406 }, { x: 1098, y: 304 }, { x: 1098, y: 374 },
      { x: 1142, y: 338 }, { x: 1142, y: 410 }, { x: 1174, y: 308 },
      { x: 1174, y: 380 }
    ];
    var GUN_SLOTS = [
      { x: 1032, y: 356 }, { x: 1082, y: 306 }, { x: 1122, y: 400 }
    ];

    function spawnDefenders() {
      var q = [], i;
      var slots = shuffle(RIFLE_SLOTS);
      var gunSlots = shuffle(GUN_SLOTS);

      // 全部守军一开始就在桥头，几秒内到齐，之后不会再有增援
      for (i = 0; i < N_RIFLE; i++) {
        q.push({
          type: 'rifle',
          delay: 0.15 + i * 0.12,
          x: slots[i].x, y: slots[i].y
        });
      }
      for (i = 0; i < N_GUN; i++) {
        q.push({
          type: 'gunner',
          delay: 0.8 + i * 0.5,
          x: gunSlots[i].x, y: gunSlots[i].y
        });
      }
      q.sort(function (a, b) { return a.delay - b.delay; });

      spawnQueue = q;
      spawnTimer = 0;
      addBanner('对岸桥头 · 守敌拦击', 2.8, 118, 30, '#ffe6a4');
      addBanner('越过桥面中点，守军就会放火烧桥', 2.8, 158, 18, '#d6e0f0');
    }

    function addBanner(text, life, y, size, color) {
      banners.push({ text: text, life: life, max: life, y: y, size: size, color: color });
    }

    function spawnEnemy(it) {
      if (it.type === 'rifle') {
        enemies.push({
          type: 'rifle',
          x: it.x, y: it.y,
          w: 34, h: 60,
          hp: 3, maxHp: 3,
          fireCd: rand(1.4, 3.0), fireGap: rand(3.8, 5.4),
          flash: 0, muzzle: 0, sway: rand(0, 6.28), retreat: false
        });
        burst(it.x + 17, it.y + 30, '#9a8a5a', 5);
      } else {
        enemies.push({
          type: 'gunner',
          x: it.x, y: it.y,
          w: 40, h: 62,
          hp: 8, maxHp: 8,
          fireCd: rand(1.4, 2.4), fireGap: 3.8,
          burstLeft: 0, flash: 0, muzzle: 0, sway: rand(0, 6.28), retreat: false
        });
        burst(it.x + 20, it.y + 44, '#9a8a5a', 8);
      }
    }

    /* ---------- 射击 ---------- */
    function playerShoot() {
      if (player.fireCd > 0) return;
      player.fireCd = player.fireGap;
      player.muzzle = 0.05;
      player.recoil = 1;

      var bx = player.x + 46, by = player.y + 26;
      // 轻微自动瞄准：子弹会往上下 52px 内最近的敌人身上带一点
      // （铁索上只能横扫，靠走位躲子弹的时候不至于完全打不中）
      var vy = 0, best = null, bd = 52, i, cy, dd;
      for (i = 0; i < enemies.length; i++) {
        if (enemies[i].x < player.x) continue;
        cy = enemies[i].y + 30;
        dd = Math.abs(cy - by);
        if (dd < bd) { bd = dd; best = enemies[i]; }
      }
      if (best) {
        var dx = (best.x + best.w / 2) - bx;
        if (dx > 20) vy = ((best.y + 30) - by) / (dx / BULLET_SPEED);
      }

      bullets.push({
        x: bx, y: by,
        vx: BULLET_SPEED, vy: vy,
        w: 16, h: 4,
        life: BULLET_RANGE / BULLET_SPEED
      });
      beep(620, 0.045, 'square', 0.016);
      particles.push({
        x: player.x + 52, y: player.y + 26,
        vx: rand(80, 180), vy: rand(-40, 40),
        life: 0.08, r: 4, c: '#ffd873', g: 0
      });
    }

    function enemyShoot(e) {
      var dx = (player.x + player.w / 2) - (e.x + e.w / 2);
      var dy = (player.y + player.h / 2) - (e.y + e.h / 2);
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var sp = e.type === 'gunner' ? 420 : 330;
      var spread = rand(-0.05, 0.05);
      var cs = Math.cos(spread), sn = Math.sin(spread);
      var nx = dx / len, ny = dy / len;
      eBullets.push({
        x: e.x + e.w / 2 - 10, y: e.y + 28,
        vx: (nx * cs - ny * sn) * sp,
        vy: (nx * sn + ny * cs) * sp,
        w: 13, h: 4
      });
      e.muzzle = 0.06;
      beep(e.type === 'gunner' ? 200 : 290, 0.05, 'sawtooth', 0.011);
    }

    function burst(x, y, color, n) {
      var k;
      for (k = 0; k < (n || 12); k++) {
        particles.push({
          x: x, y: y, vx: rand(-180, 180), vy: rand(-220, 90),
          life: rand(0.25, 0.5), r: rand(2, 5), c: color, g: 420
        });
      }
    }

    function damagePlayer(d, fromFire) {
      if (!fromFire && player.invul > 0) return;
      player.hp -= d;
      player.invul = fromFire ? 0.12 : 0.55;
      if (!fromFire) shake = Math.max(shake, 0.45);
      burst(player.x + 17, player.y + 28, fromFire ? '#ffb24a' : '#ff5544', 8);
      beep(fromFire ? 90 : 130, 0.14, 'sawtooth', 0.028);
      if (player.hp <= 0) {
        player.hp = 0;
        state = ST_OVER;
        stateTimer = 0;
        shake = 1;
      }
    }

    /* ---------- 放火（越过桥面中点触发） ---------- */
    function igniteFire() {
      banners.length = 0;     // 清掉开场横幅，别叠在一起
      fire.on = true;
      fire.edge = FIRE_START;
      fire.t = 0;
      shake = 1.2;
      roar();
      addBanner('守军泼下火油 —— 桥头烧起来了！', 4.0, 118, 32, '#ffb066');
      addBanner('火往这边烧，只能往前冲', 4.0, 158, 19, '#f0d9a6');
      burst(FIRE_START, 400, '#ff9a3c', 26);

      /* 史实：守军放完火就弃桥溃逃，不再抵抗 */
      spawnQueue.length = 0;        // 不再有守军上桥
      for (var i = 0; i < enemies.length; i++) {
        enemies[i].retreat = true;
        enemies[i].fireCd = 9999;
        enemies[i].burstLeft = 0;
      }
      routed = true;
      addBanner('守军放火后弃桥溃逃 —— 冲过去！', 4.2, 196, 24, '#a8e6a0');
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
      if (state === ST_INTRO) {
        stateTimer += dt;
        if (stateTimer > 0.4 && (keys['enter'] || keys[' '])) {
          beep(660, 0.08, 'triangle', 0.02);
          resetGame();
          state = ST_PLAY;
        }
        return;
      }
      if (state === ST_OVER) {
        stateTimer += dt;
        if (stateTimer > 0.7 && (keys['enter'] || keys[' '])) {
          resetGame();
          state = ST_PLAY;
        }
        return;
      }
      if (state === ST_WIN) {
        stateTimer += dt;
        if (stateTimer > 0.9 && keys['enter']) { finish(); }
        return;
      }
      if (state === ST_DONE) return;

      updateWorld(dt);
    }

    function updateWorld(dt) {
      var i, j;
      var k;

      /* --- 玩家移动 --- */
      var mx = 0, my = 0;
      if (keys['arrowleft'] || keys['a']) mx -= 1;
      if (keys['arrowright'] || keys['d']) mx += 1;
      if (keys['arrowup'] || keys['w']) my -= 1;
      if (keys['arrowdown'] || keys['s']) my += 1;
      if (mx || my) {
        var l = Math.sqrt(mx * mx + my * my);
        // 火里跑不快：浓烟热浪压得人直不起腰
        var spd = player.speed;
        if (fire.on && player.x < BANK_X && player.x + player.w - 6 > fire.edge) {
          spd *= 0.6;
        }
        player.x += (mx / l) * spd * dt;
        player.y += (my / l) * spd * dt;
      }
      player.x = clamp(player.x, 110, 1046);
      player.y = clamp(player.y, BRIDGE_TOP - 8, BRIDGE_BOT - player.h + 4);

      player.fireCd = Math.max(0, player.fireCd - dt);
      player.muzzle = Math.max(0, player.muzzle - dt);
      player.invul = Math.max(0, player.invul - dt);
      player.burnCd = Math.max(0, player.burnCd - dt);
      player.recoil = Math.max(0, player.recoil - dt * 6);
      if (keys['j'] || keys[' ']) playerShoot();

      /* --- 越过桥面中点：守军放火 --- */
      if (!fire.on && player.x >= MID_X - 20) igniteFire();

      /* --- 火势蔓延（往左烧，追着人走） --- */
      if (fire.on) {
        fire.t += dt;
        if (fire.t > 0.6 && fire.edge > FIRE_MIN) {
          fire.edge = Math.max(FIRE_MIN, fire.edge - 58 * dt);
        }
        // 火星
        if (Math.random() < 0.55) {
          embers.push({
            x: rand(fire.edge, DECK_R),
            y: rand(BRIDGE_TOP + 40, BRIDGE_BOT),
            vx: rand(-40, 20), vy: rand(-120, -40),
            life: rand(0.7, 1.6), r: rand(1.5, 3.4)
          });
        }
        // 烧伤：站在火里就掉血（对岸地面上不算）
        if (player.x < BANK_X && player.x + player.w - 6 > fire.edge) {
          if (player.burnCd <= 0) {
            player.burnCd = 0.5;
            damagePlayer(6, true);
          }
        }
      }

      /* --- 出兵 --- */
      spawnTimer += dt;
      for (i = spawnQueue.length - 1; i >= 0; i--) {
        if (spawnQueue[i].delay <= spawnTimer) {
          spawnEnemy(spawnQueue[i]);
          spawnQueue.splice(i, 1);
        }
      }

      /* --- 玩家子弹 --- */
      for (i = bullets.length - 1; i >= 0; i--) {
        var b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0 || b.x > W + 30) {
          bullets.splice(i, 1);
          continue;
        }
        for (j = enemies.length - 1; j >= 0; j--) {
          var e = enemies[j];
          if (hit(b, e)) {
            bullets.splice(i, 1);
            e.hp--; e.flash = 0.09;
            burst(b.x, b.y, '#ff9a6a', 4);
            if (e.hp <= 0) {
              enemies.splice(j, 1);
              kills++;
              score += e.type === 'gunner' ? 40 : 20;
              burst(e.x + e.w / 2, e.y + e.h / 2, '#cbbfa0', 14);
              beep(320, 0.12, 'square', 0.018);
            }
            break;
          }
        }
      }

      /* --- 敌人（都站在对岸桥头，不上桥） --- */
      for (i = enemies.length - 1; i >= 0; i--) {
        var en = enemies[i];
        en.flash = Math.max(0, en.flash - dt);
        en.muzzle = Math.max(0, en.muzzle - dt);
        en.sway += dt;

        /* 溃逃：转身往对岸纵深跑，跑出画面即消失，不再开火 */
        if (en.retreat) {
          en.x += 175 * dt;   // 放慢一点，让玩家看清他们弃桥逃跑
          if (en.x > W + 80) enemies.splice(i, 1);
          continue;
        }

        en.fireCd -= dt;
        if (en.fireCd <= 0) {
          if (en.type === 'gunner') {
            // 机枪：一轮三发点射
            if (en.burstLeft <= 0) en.burstLeft = 3;
            enemyShoot(en);
            en.burstLeft--;
            en.fireCd = en.burstLeft > 0 ? 0.14 : en.fireGap;
          } else {
            enemyShoot(en);
            en.fireCd = en.fireGap * rand(0.85, 1.3);
          }
        }
      }

      /* --- 敌方子弹 --- */
      for (i = eBullets.length - 1; i >= 0; i--) {
        var eb = eBullets[i];
        eb.x += eb.vx * dt;
        eb.y += eb.vy * dt;
        if (eb.x < -40 || eb.x > W + 40 || eb.y < -40 || eb.y > H + 40) {
          eBullets.splice(i, 1); continue;
        }
        if (player.invul <= 0 && hit(eb, player)) {
          eBullets.splice(i, 1);
          damagePlayer(5, false);
        }
      }

      /* --- 粒子 / 火星 / 字幕 --- */
      for (i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += (p.g === undefined ? 420 : p.g) * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (i = embers.length - 1; i >= 0; i--) {
        var em = embers[i];
        em.x += em.vx * dt; em.y += em.vy * dt;
        em.vy -= 26 * dt;
        em.life -= dt;
        if (em.life <= 0) embers.splice(i, 1);
      }
      for (i = banners.length - 1; i >= 0; i--) {
        banners[i].life -= dt;
        if (banners[i].life <= 0) banners.splice(i, 1);
      }

      shake = Math.max(0, shake - dt * 2.6);

      /* --- 冲上对岸桥头：整局只这一轮，到了就结束 --- */
      if (player.x >= WIN_X) {
        state = ST_WIN;
        stateTimer = 0;
        score += 200;
        beep(880, 0.5, 'triangle', 0.03);
        burst(player.x + 20, player.y + 26, '#ffd873', 26);
      }
    }

    /* ================= 绘制 ================= */
    var plankRnd = (function (seed) {
      var s = seed;
      return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    })(19350529);

    // 残存桥板：只有红军这一侧还剩几块，中间全被拆光
    var planks = (function () {
      var arr = [], x;
      for (x = 100; x < DECK_R - 20; x += 34) {
        if (x > 420) break;                    // 中段桥板已被拆去
        if (plankRnd() < 0.55) {
          arr.push({
            x: x,
            y: BRIDGE_TOP + 8 + plankRnd() * (BRIDGE_BOT - BRIDGE_TOP - 26),
            w: 28, h: 10
          });
        }
      }
      return arr;
    })();

    function drawSky(t) {
      var sky = ctx.createLinearGradient(0, 0, 0, BRIDGE_TOP + 40);
      sky.addColorStop(0, '#16233b');
      sky.addColorStop(0.45, '#39496a');
      sky.addColorStop(0.78, '#7d7580');
      sky.addColorStop(1, '#b98d68');
      ctx.fillStyle = sky;
      ctx.fillRect(-24, -24, W + 48, BRIDGE_TOP + 70);

      // 对岸桥头的火光映在天上
      var glow = ctx.createRadialGradient(
        W - 260, BRIDGE_TOP - 30, 20,
        W - 260, BRIDGE_TOP - 30, 420);
      glow.addColorStop(0, 'rgba(255,150,60,' + (0.16 + Math.sin(t * 5) * 0.04) + ')');
      glow.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-24, -24, W + 48, BRIDGE_TOP + 80);

      // 云带
      ctx.fillStyle = 'rgba(210,190,180,0.07)';
      for (var i = 0; i < 5; i++) {
        var cx = ((i * 307 + t * 5) % (W + 400)) - 200;
        ctx.beginPath();
        ctx.ellipse(cx, 80 + i * 26, 150, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawMountains() {
      // 远山
      ctx.fillStyle = '#334359';
      ctx.beginPath();
      ctx.moveTo(-20, BRIDGE_TOP - 40);
      ctx.lineTo(120, 132);
      ctx.lineTo(300, 246);
      ctx.lineTo(450, 108);
      ctx.lineTo(620, 238);
      ctx.lineTo(800, 128);
      ctx.lineTo(960, 244);
      ctx.lineTo(1120, 140);
      ctx.lineTo(W + 20, 236);
      ctx.lineTo(W + 20, BRIDGE_TOP + 6);
      ctx.lineTo(-20, BRIDGE_TOP + 6);
      ctx.closePath();
      ctx.fill();

      // 近山
      ctx.fillStyle = '#27323f';
      ctx.beginPath();
      ctx.moveTo(-20, BRIDGE_TOP - 6);
      ctx.lineTo(170, 196);
      ctx.lineTo(330, 276);
      ctx.lineTo(510, 178);
      ctx.lineTo(690, 274);
      ctx.lineTo(870, 194);
      ctx.lineTo(1010, 268);
      ctx.lineTo(W + 20, 214);
      ctx.lineTo(W + 20, BRIDGE_TOP + 6);
      ctx.lineTo(-20, BRIDGE_TOP + 6);
      ctx.closePath();
      ctx.fill();

      // 山脊的雪线 / 亮边
      ctx.strokeStyle = 'rgba(190,205,225,0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(450, 108); ctx.lineTo(390, 178);
      ctx.moveTo(800, 128); ctx.lineTo(745, 190);
      ctx.moveTo(120, 132); ctx.lineTo(78, 190);
      ctx.stroke();
    }

    /* 峡谷深处的岩壁：整块可活动区每帧都要被覆盖，
       否则移动的人物会在画布上留下永不消退的残影。 */
    function drawGorge(t) {
      var g = ctx.createLinearGradient(0, BRIDGE_TOP - 8, 0, RIVER_Y + 40);
      g.addColorStop(0, '#2a3242');
      g.addColorStop(0.45, '#212833');
      g.addColorStop(1, '#151a22');
      ctx.fillStyle = g;
      ctx.fillRect(-24, BRIDGE_TOP - 8, W + 48, RIVER_Y - BRIDGE_TOP + 52);

      // 对岸崖壁的竖向岩纹
      ctx.strokeStyle = 'rgba(200,215,235,0.045)';
      ctx.lineWidth = 9;
      for (var i = 0; i < 16; i++) {
        var x = 90 + i * 62 + Math.sin(i * 2.3) * 10;
        ctx.beginPath();
        ctx.moveTo(x, BRIDGE_TOP - 6);
        ctx.lineTo(x + 26, RIVER_Y + 8);
        ctx.stroke();
      }

      // 江面水汽
      var mist = ctx.createLinearGradient(0, RIVER_Y - 90, 0, RIVER_Y + 10);
      mist.addColorStop(0, 'rgba(190,210,235,0)');
      mist.addColorStop(1, 'rgba(190,210,235,0.10)');
      ctx.fillStyle = mist;
      ctx.fillRect(-24, RIVER_Y - 90, W + 48, 100);
      void t;
    }

    function drawRiver(t) {
      var water = ctx.createLinearGradient(0, RIVER_Y - 6, 0, H);
      water.addColorStop(0, '#42607c');
      water.addColorStop(0.45, '#2b4460');
      water.addColorStop(1, '#132433');
      ctx.fillStyle = water;
      ctx.fillRect(-24, RIVER_Y - 6, W + 48, H - RIVER_Y + 30);

      // 水流
      var row, col, y0, x0, yy;
      ctx.lineWidth = 2;
      for (row = 0; row < 6; row++) {
        y0 = RIVER_Y + 26 + row * 42;
        if (y0 > H) break;
        ctx.strokeStyle = 'rgba(170,205,235,' + (0.22 - row * 0.024) + ')';
        ctx.beginPath();
        for (col = 0; col <= 64; col++) {
          x0 = -24 + (col / 64) * (W + 48);
          yy = y0 + Math.sin(col * 0.45 + t * (1.4 + row * 0.35) + row * 1.7) * (5 + row);
          if (col === 0) ctx.moveTo(x0, yy); else ctx.lineTo(x0, yy);
        }
        ctx.stroke();
      }

      // 白色浪花
      ctx.fillStyle = 'rgba(220,238,250,0.32)';
      for (var i = 0; i < 26; i++) {
        var px = ((i * 137 + t * 60) % (W + 200)) - 100;
        var py = RIVER_Y + 18 + ((i * 53) % (H - RIVER_Y));
        ctx.fillRect(px, py, 12 + (i % 4) * 5, 3);
      }
    }

    /* 对岸：岩体 + 桥头堡 + 地面，守军就站在这块地上 */
    function drawFarBank(t) {
      // 岩体
      ctx.fillStyle = '#3a3529';
      ctx.fillRect(BANK_X, BRIDGE_TOP - 6, W - BANK_X + 24, H - BRIDGE_TOP + 6);

      // 桥头堡城墙
      ctx.fillStyle = '#544c3d';
      ctx.fillRect(BANK_X, 176, W - BANK_X + 24, BRIDGE_TOP - 176);
      ctx.fillStyle = '#61594a';
      ctx.fillRect(BANK_X, 168, W - BANK_X + 24, 14);
      // 垛口
      ctx.fillStyle = '#544c3d';
      for (var cx = BANK_X + 12; cx < W; cx += 44) {
        ctx.fillRect(cx, 150, 26, 20);
      }
      // 砖缝
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      for (var y = 186; y < BRIDGE_TOP; y += 20) {
        ctx.beginPath(); ctx.moveTo(BANK_X, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (var bx = BANK_X + 40; bx < W; bx += 52) {
        ctx.beginPath(); ctx.moveTo(bx, 176); ctx.lineTo(bx, BRIDGE_TOP); ctx.stroke();
      }

      // 门洞（黑）
      ctx.fillStyle = '#1a1712';
      ctx.beginPath();
      ctx.moveTo(1058, BRIDGE_TOP);
      ctx.lineTo(1058, 244);
      ctx.quadraticCurveTo(1096, 208, 1134, 244);
      ctx.lineTo(1134, BRIDGE_TOP);
      ctx.closePath();
      ctx.fill();

      // 匾额
      ctx.fillStyle = '#33281c';
      ctx.fillRect(1148, 206, 96, 36);
      ctx.strokeStyle = '#8a7444';
      ctx.lineWidth = 2;
      ctx.strokeRect(1148, 206, 96, 36);
      ctx.fillStyle = '#e8d9a0';
      ctx.font = 'bold 21px "STKaiti","KaiTi",serif';
      ctx.textAlign = 'center';
      ctx.fillText('泸定桥', 1196, 232);
      ctx.textAlign = 'left';

      // 地面（桥头平台，守军站这儿）
      var gd = ctx.createLinearGradient(0, BRIDGE_TOP, 0, BRIDGE_BOT + 26);
      gd.addColorStop(0, '#6d6046');
      gd.addColorStop(0.6, '#584c37');
      gd.addColorStop(1, '#41382a');
      ctx.fillStyle = gd;
      ctx.fillRect(BANK_X, BRIDGE_TOP, W - BANK_X + 24, BRIDGE_BOT - BRIDGE_TOP + 26);

      // 地面碎石
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (var s = 0; s < 46; s++) {
        var sx = BANK_X + ((s * 97) % (W - BANK_X));
        var sy = BRIDGE_TOP + 10 + ((s * 53) % (BRIDGE_BOT - BRIDGE_TOP - 4));
        ctx.fillRect(sx, sy, 5 + (s % 3) * 3, 3);
      }
      // 平台外沿（临江一侧的边）
      ctx.fillStyle = '#3a3227';
      ctx.fillRect(BANK_X, BRIDGE_BOT + 14, W - BANK_X + 24, 12);

      // 桥头火盆（放火之后就是火源）
      var pots = [1004, 1210];
      for (var p = 0; p < pots.length; p++) {
        var px2 = pots[p];
        ctx.fillStyle = '#2b261e';
        ctx.fillRect(px2 - 8, BRIDGE_TOP - 34, 16, 34);
        var fl = fire.on ? 16 + Math.sin(t * 9 + p) * 6 : 5;
        var fg = ctx.createRadialGradient(px2, BRIDGE_TOP - 36, 2, px2, BRIDGE_TOP - 36, fl * 2.4);
        fg.addColorStop(0, 'rgba(255,220,140,0.95)');
        fg.addColorStop(0.45, 'rgba(255,140,40,0.55)');
        fg.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(px2, BRIDGE_TOP - 36, fl * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 敌旗
      ctx.strokeStyle = '#241f18';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(1252, BRIDGE_TOP - 6);
      ctx.lineTo(1252, 236);
      ctx.stroke();
      ctx.fillStyle = '#c9b25a';
      ctx.beginPath();
      ctx.moveTo(1252, 238);
      ctx.lineTo(1252 + 24 + Math.sin(t * 3) * 5, 246);
      ctx.lineTo(1252, 262);
      ctx.closePath();
      ctx.fill();
    }

    function drawLeftBank(t) {
      // 红军一侧桥台
      ctx.fillStyle = '#413a2d';
      ctx.fillRect(-24, BRIDGE_TOP - 120, DECK_L + 24, H - BRIDGE_TOP + 120);
      ctx.fillStyle = '#514834';
      ctx.fillRect(-24, BRIDGE_TOP - 120, DECK_L + 24, 14);

      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      for (var y = BRIDGE_TOP - 106; y < H; y += 22) {
        ctx.beginPath(); ctx.moveTo(-24, y); ctx.lineTo(DECK_L, y); ctx.stroke();
      }

      // 桥桩
      ctx.fillStyle = '#2f2a20';
      ctx.fillRect(DECK_L - 10, BRIDGE_TOP - 60, 10, BRIDGE_BOT - BRIDGE_TOP + 60);

      // 红旗
      ctx.strokeStyle = '#2b2418';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(34, BRIDGE_TOP - 6);
      ctx.lineTo(34, 158);
      ctx.stroke();
      ctx.fillStyle = '#b8231c';
      ctx.beginPath();
      ctx.moveTo(34, 160);
      var wob = Math.sin(t * 3.4) * 6;
      ctx.quadraticCurveTo(70, 166 + wob, 104, 172);
      ctx.lineTo(104, 214);
      ctx.quadraticCurveTo(70, 208 + wob, 34, 202);
      ctx.closePath();
      ctx.fill();
      // 旗上的小五角星
      ctx.save();
      ctx.translate(52, 186);
      ctx.fillStyle = '#f3d24a';
      starPath(0, 0, 7, 3, -Math.PI / 2);
      ctx.fill();
      ctx.restore();
    }

    function drawChains() {
      var i, y, x;
      // 9 根底链
      ctx.strokeStyle = '#7b7565';
      ctx.lineWidth = 3;
      for (i = 0; i < 9; i++) {
        y = BRIDGE_TOP + 12 + i * ((BRIDGE_BOT - BRIDGE_TOP - 16) / 8);
        ctx.beginPath();
        for (x = DECK_L - 6; x <= DECK_R + 6; x += 14) {
          var yy = y + Math.sin(x * 0.045 + (i % 2) * 0.7) * 1.6;
          if (x === DECK_L - 6) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      // 4 根扶手链
      ctx.strokeStyle = '#8d8776';
      ctx.lineWidth = 4;
      for (i = 0; i < 4; i++) {
        y = BRIDGE_TOP - 68 + i * 15;
        ctx.beginPath();
        for (x = DECK_L - 6; x <= DECK_R + 6; x += 14) {
          var sag = Math.sin(((x - DECK_L) / (DECK_R - DECK_L)) * Math.PI) * 12;
          if (x === DECK_L - 6) ctx.moveTo(x, y + sag); else ctx.lineTo(x, y + sag);
        }
        ctx.stroke();
      }
      // 残存桥板
      for (i = 0; i < planks.length; i++) {
        var p = planks[i];
        ctx.fillStyle = '#6b5335';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
      }
    }

    /* ---------- 桥头火障 ---------- */
    function drawFire(t) {
      if (!fire.on) return;
      var x0 = fire.edge, x1 = DECK_R + 8;
      if (x1 <= x0) return;

      // 焦黑的桥面
      ctx.fillStyle = 'rgba(24,14,10,0.85)';
      ctx.fillRect(x0, BRIDGE_TOP - 4, x1 - x0, BRIDGE_BOT - BRIDGE_TOP + 16);

      // 光晕
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var gl = ctx.createRadialGradient((x0 + x1) / 2, BRIDGE_BOT - 40, 30,
                                        (x0 + x1) / 2, BRIDGE_BOT - 40, (x1 - x0) * 0.9 + 120);
      gl.addColorStop(0, 'rgba(255,140,40,0.30)');
      gl.addColorStop(0.5, 'rgba(255,90,20,0.12)');
      gl.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x0 - 160, 60, (x1 - x0) + 320, BRIDGE_BOT + 80);
      ctx.restore();

      // 火舌
      var x, hgt, w, base;
      for (x = x0; x < x1; x += 13) {
        var n1 = Math.sin(t * 7.5 + x * 0.06);
        var n2 = Math.sin(t * 3.1 + x * 0.13 + 1.7);
        hgt = 92 + n1 * 26 + n2 * 18;
        w = 16 + Math.sin(t * 5 + x * 0.09) * 4;
        base = BRIDGE_BOT + 6;
        var grad = ctx.createLinearGradient(0, base, 0, base - hgt);
        grad.addColorStop(0, 'rgba(255,230,150,0.95)');
        grad.addColorStop(0.35, 'rgba(255,150,40,0.85)');
        grad.addColorStop(0.75, 'rgba(220,70,15,0.45)');
        grad.addColorStop(1, 'rgba(150,30,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x - w, base);
        ctx.quadraticCurveTo(x - w * 0.9, base - hgt * 0.55, x + n1 * 10, base - hgt);
        ctx.quadraticCurveTo(x + w * 0.9, base - hgt * 0.55, x + w, base);
        ctx.closePath();
        ctx.fill();
      }

      // 火线前沿的亮边
      ctx.fillStyle = 'rgba(255,220,150,' + (0.4 + Math.sin(t * 8) * 0.15) + ')';
      ctx.fillRect(x0 - 3, BRIDGE_TOP, 5, BRIDGE_BOT - BRIDGE_TOP + 14);

      // 火星
      var i, em;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < embers.length; i++) {
        em = embers[i];
        ctx.globalAlpha = clamp(em.life, 0, 1);
        ctx.fillStyle = i % 3 === 0 ? '#ffe6a0' : '#ff9a3c';
        ctx.beginPath();
        ctx.arc(em.x, em.y, em.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // 烟
      ctx.fillStyle = 'rgba(40,30,26,0.18)';
      for (i = 0; i < 7; i++) {
        var sy = BRIDGE_TOP - 60 - ((t * 34 + i * 47) % 190);
        var sx = x0 + 40 + i * 34 + Math.sin(t + i) * 12;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 46 + i * 5, 18 + i * 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* ---------- 人物 ---------- */
    function drawSoldier(x, y, isRed) {
      var body = isRed ? '#5c6b80' : '#8d7c48';
      var dark = isRed ? '#3f4c60' : '#6d5d36';

      ctx.save();
      ctx.translate(x, y);

      // 腿 + 绑腿
      ctx.fillStyle = dark;
      ctx.fillRect(7, 44, 8, 16);
      ctx.fillRect(19, 44, 8, 16);
      ctx.fillStyle = isRed ? '#a9a094' : '#7d6f4b';
      ctx.fillRect(7, 52, 8, 6);
      ctx.fillRect(19, 52, 8, 6);

      // 上衣
      ctx.fillStyle = body;
      ctx.fillRect(3, 18, 28, 28);

      // 腰带
      ctx.fillStyle = isRed ? '#33302a' : '#5a4c2e';
      ctx.fillRect(3, 38, 28, 5);

      // 挎带
      ctx.strokeStyle = isRed ? '#3d4a5c' : '#54462a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(6, 20); ctx.lineTo(26, 40);
      ctx.stroke();

      // 背包
      ctx.fillStyle = isRed ? '#4a5568' : '#6b5c39';
      ctx.fillRect(-2, 22, 8, 14);

      // 头
      ctx.fillStyle = '#e6bd94';
      ctx.fillRect(9, 4, 16, 15);

      if (isRed) {
        /* 红军八角帽：灰蓝帽身 + 正面一颗红色五角星 */
        ctx.fillStyle = '#4d5c72';
        ctx.beginPath();
        ctx.moveTo(5, 8);
        ctx.lineTo(29, 8);
        ctx.lineTo(26, -3);
        ctx.lineTo(8, -3);
        ctx.closePath();
        ctx.fill();
        // 帽檐
        ctx.fillStyle = '#3c4860';
        ctx.fillRect(3, 6, 30, 4);
        // 红星（正对镜头，朝向观众）
        ctx.save();
        ctx.fillStyle = '#d9251c';
        starPath(17, 2, 6.2, 2.6, -Math.PI / 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,10,6,0.8)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      } else {
        // 敌军：土黄大檐帽
        ctx.fillStyle = '#6d5d36';
        ctx.fillRect(4, -2, 26, 8);
        ctx.fillStyle = '#54462a';
        ctx.fillRect(2, 5, 30, 4);
      }

      // 步枪
      ctx.strokeStyle = '#382f24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (isRed) {
        ctx.moveTo(6, 34); ctx.lineTo(48, 27);
      } else {
        ctx.moveTo(24, 34); ctx.lineTo(-14, 27);
      }
      ctx.stroke();
      // 枪托
      ctx.strokeStyle = '#5b452c';
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (isRed) { ctx.moveTo(6, 34); ctx.lineTo(14, 33); }
      else { ctx.moveTo(24, 34); ctx.lineTo(16, 33); }
      ctx.stroke();

      // 手臂
      ctx.fillStyle = body;
      if (isRed) ctx.fillRect(20, 26, 12, 7);
      else ctx.fillRect(0, 26, 12, 7);

      // 枪口火光
      ctx.restore();
    }

    function drawPlayer(t) {
      // 无敌帧闪烁：不做拖影，只做轻微明暗
      var blink = player.invul > 0 && Math.floor(t * 22) % 2 === 0;
      var rx = player.recoil * 3;

      ctx.save();
      if (blink) ctx.globalAlpha = 0.55;
      drawSoldier(player.x - rx, player.y, true);
      ctx.restore();

      if (player.muzzle > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,230,150,0.95)';
        ctx.beginPath();
        ctx.arc(player.x - rx + 52, player.y + 27, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,200,110,0.35)';
        ctx.beginPath();
        ctx.arc(player.x - rx + 52, player.y + 27, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 站在火里：脚下一圈焦灼的光
      if (fire.on && player.x < BANK_X && player.x + player.w > fire.edge) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,120,40,0.28)';
        ctx.beginPath();
        ctx.ellipse(player.x + 17, player.y + 56, 30, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    /* 溃逃的守军：转身朝对岸纵深跑（左右镜像） */
    function drawFleeing(e, dy) {
      ctx.save();
      ctx.translate(e.x + e.w, e.y + dy);
      ctx.scale(-1, 1);
      drawSoldier(0, 0, false);
      ctx.restore();
    }

    function drawEnemy(e, t) {
      if (e.type === 'gunner') {
        if (e.retreat) { drawFleeing(e, -4); return; }   // 丢下沙袋工事就跑
        // 沙袋工事
        ctx.fillStyle = '#5b5342';
        ctx.beginPath();
        ctx.ellipse(e.x + 20, e.y + 58, 44, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6b6350';
        ctx.beginPath();
        ctx.ellipse(e.x + 12, e.y + 50, 21, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        drawSoldier(e.x, e.y - 4, false);

        // 机枪
        ctx.strokeStyle = '#24201a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(e.x + 12, e.y + 22); ctx.lineTo(e.x - 34, e.y + 16);
        ctx.stroke();

        // 枪口火光
        if (e.muzzle > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(255,240,180,0.9)';
          ctx.beginPath();
          ctx.arc(e.x - 36, e.y + 16, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 血条
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - 6, e.y - 18, 52, 6);
        ctx.fillStyle = '#e05545';
        ctx.fillRect(e.x - 6, e.y - 18, 52 * (e.hp / e.maxHp), 6);
      } else {
        if (e.retreat) { drawFleeing(e, 0); return; }
        drawSoldier(e.x, e.y, false);

        if (e.muzzle > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(255,240,180,0.85)';
          ctx.beginPath();
          ctx.arc(e.x - 16, e.y + 27, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        if (e.flash > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(e.x - 2, e.y - 6, 38, 66);
        }

        // 血条
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(e.x + 2, e.y - 12, 30, 5);
        ctx.fillStyle = '#e05545';
        ctx.fillRect(e.x + 2, e.y - 12, 30 * (e.hp / e.maxHp), 5);
      }
      void t;
    }

    function drawBullets() {
      var i;
      for (i = 0; i < bullets.length; i++) {
        var b = bullets[i];
        ctx.fillStyle = 'rgba(255,240,170,0.5)';
        ctx.fillRect(b.x - 26, b.y + 1, 26, 2);
        ctx.fillStyle = '#fff6c8';
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      for (i = 0; i < eBullets.length; i++) {
        var eb = eBullets[i];
        ctx.fillStyle = 'rgba(255,140,90,0.45)';
        ctx.fillRect(eb.x + 10, eb.y + 1, 16, 2);
        ctx.fillStyle = '#ffb066';
        ctx.fillRect(eb.x, eb.y, eb.w, eb.h);
      }
    }

    function drawParticles() {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.globalAlpha = clamp(p.life * 2.6, 0, 1);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function text(str, x, y, size, color, align, bold) {
      ctx.fillStyle = color;
      ctx.font = (bold ? 'bold ' : '') + size + 'px "STKaiti","KaiTi","Microsoft YaHei",sans-serif';
      ctx.textAlign = align || 'center';
      ctx.fillText(str, x, y);
      ctx.textAlign = 'left';
    }

    function drawHUD(t) {
      // 体力
      ctx.fillStyle = 'rgba(8,14,22,0.62)';
      ctx.fillRect(28, 22, 300, 54);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(96, 36, 180, 18);
      var r = player.hp / player.maxHp;
      ctx.fillStyle = r > 0.35 ? '#63b25c' : '#d8524a';
      ctx.fillRect(96, 36, 180 * r, 18);
      text('体力', 42, 52, 20, '#f2e8d2', 'left', true);
      text(player.hp + '', 288, 52, 16, '#f2e8d2', 'right', true);

      // 冲锋进度（桥面推进度）
      var prog = clamp((player.x - 110) / (BANK_X - 110), 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(96, 60, 180, 7);
      ctx.fillStyle = '#e0b45a';
      ctx.fillRect(96, 60, 180 * prog, 7);
      // 火线刻度
      if (fire.on) {
        var fx = 96 + 180 * clamp((fire.edge - 110) / (BANK_X - 110), 0, 1);
        ctx.fillStyle = '#ff7a2a';
        ctx.fillRect(fx - 1.5, 57, 3, 13);
      }

      // 得分 / 守敌
      ctx.fillStyle = 'rgba(8,14,22,0.62)';
      ctx.fillRect(W - 372, 22, 344, 54);
      text('得分 ' + score + '　·　' +
           (routed ? '守敌已溃逃' : '守敌 ' + (enemies.length + spawnQueue.length) + ' 名'),
           W - 48, 52, 19, '#f2e8d2', 'right', true);

      if (fire.on) {
        text('桥头火起 · 冲过去', W - 48, 68, 15, '#ffb066', 'right');
      }

      // 操作提示
      text('←/→ 移动　↑/↓ 换位　J / 空格 开枪　M 静音', 28, H - 22, 15,
           'rgba(240,232,214,0.55)', 'left');

      // 开局提示
      if (hint && timeAcc < 6) {
        ctx.globalAlpha = clamp(6 - timeAcc, 0, 1) * 0.9;
        text(hint, W / 2, H - 58, 18, '#ffd873', 'center', true);
        ctx.globalAlpha = 1;
      }
    }

    function dim(alpha) {
      ctx.fillStyle = 'rgba(6,10,16,' + alpha + ')';
      ctx.fillRect(0, 0, W, H);
    }

    function drawIntro(t) {
      dim(0.6);
      text('飞 夺 泸 定 桥', W / 2, 214, 68, '#ffe6a4', 'center', true);
      text('1935 年 5 月 29 日　红四团一昼夜急行军 240 里奔袭泸定桥', W / 2, 274, 22, '#d7dfee');
      text('13 根铁索横跨大渡河，桥板已被守军拆去，22 名勇士攀索冲锋', W / 2, 312, 22, '#d7dfee');
      ctx.save();
      ctx.globalAlpha = 0.65 + Math.sin(t * 4) * 0.35;
      text('按 空格 / 回车 开始冲锋', W / 2, 490, 28, '#ffd873', 'center', true);
      ctx.restore();

      text('←/→ 移动　↑/↓ 换位　J / 空格 开枪　M 静音', W / 2, 548, 17,
           'rgba(215,223,238,0.62)');
    }

    function drawOver() {
      dim(0.7);
      text('冲锋受阻……', W / 2, 292, 54, '#ff9a8a', 'center', true);
      text('得分 ' + score + '　·　击退敌人 ' + kills + ' 名', W / 2, 348, 24, '#f0e6d0');
      if (Math.floor(stateTimer * 2) % 2 === 0) {
        text('按 回车 重新集结', W / 2, 432, 26, '#ffd873', 'center', true);
      }
    }

    function drawWin(t) {
      dim(0.66);
      text('夺 下 泸 定 桥', W / 2, 268, 62, '#a8e6a0', 'center', true);
      text('红军主力由此跨越天险，继续北上。', W / 2, 326, 24, '#f0e6d0');
      text('得分 ' + score + '　·　击退敌人 ' + kills + ' 名', W / 2, 368, 22, '#e8dcc2');

      var bw = 240, bh = 56, bx = W / 2 - bw / 2, by = 424;
      var hot = Math.sin(t * 4) * 0.06 + 0.94;
      ctx.fillStyle = 'rgba(224,180,90,' + hot + ')';
      ctx.fillRect(bx, by, bw, bh);
      text('返回地图', W / 2, by + 37, 24, '#2a1d0c', 'center', true);
      winButton = { x: bx, y: by, w: bw, h: bh };

      text('（也可以按 回车）', W / 2, by + 94, 16, 'rgba(230,220,200,0.6)');
    }

    function drawDone() {
      ctx.fillStyle = '#8a1a12';
      ctx.fillRect(0, 0, W, H);
      text('通　关', W / 2, H / 2 - 20, 72, '#f9f0da', 'center', true);
      text('飞夺泸定桥 · 得分 ' + score, W / 2, H / 2 + 46, 26, 'rgba(249,240,218,0.85)');
      text('刷新页面可再玩一次', W / 2, H / 2 + 96, 18, 'rgba(249,240,218,0.6)');
    }

    /* ---------- 通关 ---------- */
    var finished = false;
    function finish() {
      if (finished) return;   // 只发一次，防止按住回车连发消息
      finished = true;
      if (global.parent && global.parent !== global) {
        try {
          global.parent.postMessage({ type: 'cz:done' }, '*');
          return;
        } catch (e) {}
      }
      // 单独双击打开时自己收尾
      state = ST_DONE;
    }

    /* ================= 主循环 ================= */
    var last = 0;
    function frame(ts) {
      var t = ts / 1000;
      var dt = last ? Math.min(0.05, t - last) : 0.016;
      last = t;
      timeAcc += dt;

      update(dt);

      /* 先整块铺底：任何一帧都从干净的画面开始，
         这样人物移动不会在画布上留下残影（旧版就栽在这里）。 */
      ctx.fillStyle = '#0d1522';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      if (shake > 0) {
        ctx.translate(rand(-1, 1) * shake * 7, rand(-1, 1) * shake * 7);
      }

      drawSky(timeAcc);
      drawMountains();
      drawGorge(timeAcc);
      drawRiver(timeAcc);
      drawFarBank(timeAcc);
      drawLeftBank(timeAcc);
      drawChains();

      var i;
      for (i = 0; i < enemies.length; i++) drawEnemy(enemies[i], timeAcc);
      if (state !== ST_OVER && state !== ST_DONE) drawPlayer(timeAcc);
      drawBullets();
      drawParticles();
      drawFire(timeAcc);   // 火在人物之后画：冲过火障时人影落在火里
      ctx.restore();

      if (state === ST_INTRO) {
        drawIntro(timeAcc);
      } else if (state === ST_DONE) {
        drawDone();
      } else {
        drawHUD(timeAcc);

        for (i = 0; i < banners.length; i++) {
          var b = banners[i];
          var a = clamp(b.life / Math.min(0.6, b.max), 0, 1);
          ctx.globalAlpha = a;
          text(b.text, W / 2, b.y, b.size, b.color, 'center', true);
          ctx.globalAlpha = 1;
        }

        if (state === ST_OVER) drawOver();
        if (state === ST_WIN) drawWin(timeAcc);
      }

      global.requestAnimationFrame(frame);
    }

    /* ================= 输入 ================= */
    var keys = {};
    function norm(e) {
      return (e.key || '').toLowerCase();
    }
    function onKeyDown(e) {
      var k = norm(e);
      keys[k] = true;
      if (k === ' ' || k.indexOf('arrow') === 0) {
        if (e.preventDefault) e.preventDefault();
      }
      if (k === 'm') muted = !muted;
      if (state === ST_WIN && k === 'enter') finish();
    }
    function onKeyUp(e) {
      keys[norm(e)] = false;
    }

    canvas.addEventListener('click', function () {
      if (state === ST_INTRO) { resetGame(); state = ST_PLAY; return; }
      if (state === ST_WIN && winButton) finish();
    });

    global.addEventListener('keydown', onKeyDown);
    global.addEventListener('keyup', onKeyUp);

    global.LDQ_DEBUG = function () {
      // 最近的敌人（按横向距离），供自动化测试对准
      var near = null, best = 1e9, i, dd;
      for (i = 0; i < enemies.length; i++) {
        dd = Math.abs(enemies[i].x - player.x);
        if (dd < best) { best = dd; near = enemies[i]; }
      }
      return {
        state: state, routed: routed,
        hp: player ? player.hp : 0,
        px: player ? Math.round(player.x) : 0,
        py: player ? Math.round(player.y) : 0,
        tx: near ? Math.round(near.x) : -1,
        ty: near ? Math.round(near.y) : -1,
        score: score, kills: kills,
        enemies: enemies.length, queue: spawnQueue.length,
        fire: fire ? (fire.on ? Math.round(fire.edge) : -1) : -1
      };
    };

    /* ================= 启动 ================= */
    routed = false;
    resetPlayer();
    score = 0; kills = 0;
    bullets = []; eBullets = []; enemies = []; particles = [];
    banners = []; embers = [];
    spawnQueue = []; spawnTimer = 0; shake = 0; timeAcc = 0;
    fire = { on: false, edge: FIRE_START, t: 0 };
    state = ST_INTRO; stateTimer = 0;

    global.requestAnimationFrame(frame);
  }

  /* 平台加载 level.js 后调用 mount；单独双击打开时自动挂到 #stage */
  global.LDQ_LEVEL = { mount: mount };
  /* 调试用：返回当前游戏内部状态（不影响玩法） */
  global.LDQ_DEBUG = null;

  function autoMount() {
    var stage = document.getElementById('stage');
    if (stage && !stage.dataset.mounted) {
      stage.dataset.mounted = '1';
      mount(stage, null);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
})(window);
