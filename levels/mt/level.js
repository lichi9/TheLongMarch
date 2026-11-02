/* levels/mt/level.js
 * 湘江战役 · 渡口阻击战
 * 塔防：枪手 / 炮手 两种工事，守住湘江渡口。
 *
 * 契约：经典 <script>，全文件只调用 CZ.register；无模块、无外链、无外部素材，
 *       地图与单位全部用 Canvas 2D 现画。
 * 本地预览：preview.html 会自己兜一层最小 CZ 壳子，双击即可玩。
 */
(function () {
  'use strict';

  var W = 1280;
  var H = 720;
  var TAU = Math.PI * 2;
  var FONT = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Heiti SC", sans-serif';

  /* ============================================================
   * 0. 小工具
   * ============================================================ */

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rrPath(g, x, y, w, h, r) {
    var rad = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rad, y);
    g.lineTo(x + w - rad, y);
    g.quadraticCurveTo(x + w, y, x + w, y + rad);
    g.lineTo(x + w, y + h - rad);
    g.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    g.lineTo(x + rad, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - rad);
    g.lineTo(x, y + rad);
    g.quadraticCurveTo(x, y, x + rad, y);
    g.closePath();
  }

  function ellipsePath(g, x, y, rx, ry, rot) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  }

  function label(g, str, x, y, size, color, align, bold) {
    g.font = (bold ? '700 ' : '400 ') + size + 'px ' + FONT;
    g.textAlign = align || 'left';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(str, x, y);
  }

  /* ============================================================
   * 1. 关卡数据
   * ============================================================ */

  var START_COINS = 320;
  var START_LIVES = 20;
  var PREP_FIRST = 26;
  var PREP_BETWEEN = 15;
  var EARLY_BONUS = 8;
  var WAVE_BONUS = 20;

  var TOWER_DEF = {
    gun: {
      key: 'gun', name: '枪手', glyph: '枪',
      blurb: '射速快 · 打单个',
      rows: [
        { name: '步枪班', cost: 70, dmg: 8, cd: 0.95, range: 152 },
        { name: '机枪组', cost: 85, dmg: 13, cd: 0.78, range: 168 },
        { name: '神枪手', cost: 135, dmg: 21, cd: 0.60, range: 186 }
      ]
    },
    cannon: {
      key: 'cannon', name: '炮手', glyph: '炮',
      blurb: '范围伤害 · 慢',
      rows: [
        { name: '迫击炮', cost: 110, dmg: 26, radius: 56, cd: 2.4, range: 172 },
        { name: '山炮', cost: 120, dmg: 38, radius: 64, cd: 2.2, range: 188 },
        { name: '榴弹炮', cost: 175, dmg: 56, radius: 74, cd: 2.0, range: 206 }
      ]
    }
  };

  var ENEMY_DEF = {
    scout:   { name: '前哨',   hp: 55,  speed: 54, reward: 12, leak: 1, size: 0.92, tone: 'grey' },
    rifle:   { name: '步兵',   hp: 110, speed: 44, reward: 15, leak: 1, size: 1.00, tone: 'grey' },
    cavalry: { name: '骑兵',   hp: 150, speed: 86, reward: 20, leak: 1, size: 1.00, tone: 'grey', horse: true },
    mg:      { name: '机枪队', hp: 300, speed: 34, reward: 30, leak: 2, size: 1.06, tone: 'grey', mg: true },
    officer: { name: '敌指挥官', hp: 950, speed: 30, reward: 90, leak: 5, size: 1.22, tone: 'officer', boss: true }
  };

  var WAVES = [
    { groups: [{ type: 'scout', n: 6, gap: 0.95 }] },
    { groups: [{ type: 'scout', n: 8, gap: 0.8 }, { type: 'rifle', n: 2, gap: 1.6, delay: 3.5 }] },
    { groups: [{ type: 'rifle', n: 8, gap: 0.85 }, { type: 'scout', n: 5, gap: 0.7, delay: 2 }] },
    { groups: [{ type: 'cavalry', n: 4, gap: 1.3 }, { type: 'rifle', n: 6, gap: 0.9, delay: 2.5 }] },
    { groups: [{ type: 'rifle', n: 10, gap: 0.75 }, { type: 'cavalry', n: 3, gap: 1.4, delay: 3 }] },
    { groups: [{ type: 'mg', n: 3, gap: 2.4 }, { type: 'scout', n: 8, gap: 0.6, delay: 1 }] },
    { groups: [{ type: 'cavalry', n: 6, gap: 0.95 }, { type: 'mg', n: 4, gap: 2.0, delay: 2 }] },
    { groups: [{ type: 'mg', n: 5, gap: 1.7 }, { type: 'rifle', n: 10, gap: 0.7, delay: 1 }, { type: 'cavalry', n: 3, gap: 1.5, delay: 7 }] },
    { groups: [{ type: 'officer', n: 1, gap: 1 }, { type: 'rifle', n: 10, gap: 0.7, delay: 1.5 }, { type: 'cavalry', n: 4, gap: 1.3, delay: 4.5 }] },
    { groups: [{ type: 'officer', n: 2, gap: 7 }, { type: 'mg', n: 6, gap: 1.6, delay: 1 }, { type: 'cavalry', n: 6, gap: 1.1, delay: 5 }, { type: 'rifle', n: 10, gap: 0.65, delay: 9 }] }
  ];

  /* 路：敌军从右上角村子出发，三折蛇形，最后到左下渡口 */
  var PATH_CTRL = [
    [1320, 116], [1200, 110], [1080, 122], [960, 140], [840, 150], [735, 162],
    [652, 194], [596, 236], [568, 288], [578, 336], [624, 352],
    [700, 358], [800, 358], [900, 356], [1000, 354], [1080, 360],
    [1140, 380], [1178, 416], [1182, 456], [1152, 490],
    [1096, 548], [1010, 560], [905, 564], [800, 564], [700, 568],
    [610, 578], [540, 606], [490, 636], [452, 658], [430, 666]
  ];

  var PLOT_SPOTS = [
    [715, 262], [835, 248], [955, 246], [1085, 250],
    [660, 455], [800, 455], [940, 452], [1070, 455],
    [760, 662], [900, 662], [1040, 645], [435, 552]
  ];

  var VILLAGE = { x: 1160, y: 58 };
  var CAMP = { x: 238, y: 330 };
  var BASE = { x: 420, y: 664 };

  /* ---------- 路径采样 ---------- */
  function buildPath(ctrl) {
    var pts = [];
    var i, t, u, u2, u3;
    function cr(p0, p1, p2, p3, k) {
      var x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * k +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * k * k +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * k * k * k);
      var y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * k +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * k * k +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * k * k * k);
      return [x, y];
    }
    for (i = 0; i < ctrl.length - 1; i++) {
      var p0 = ctrl[Math.max(0, i - 1)];
      var p1 = ctrl[i];
      var p2 = ctrl[i + 1];
      var p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      for (t = 0; t < 16; t++) {
        pts.push(cr(p0, p1, p2, p3, t / 16));
      }
    }
    pts.push(ctrl[ctrl.length - 1].slice());

    var cum = [0];
    for (i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + dist(pts[i][0], pts[i][1], pts[i - 1][0], pts[i - 1][1]));
    }
    return { pts: pts, cum: cum, len: cum[cum.length - 1] };
  }

  var PATH = buildPath(PATH_CTRL);

  function pathAt(s) {
    s = clamp(s, 0, PATH.len);
    var lo = 0, hi = PATH.cum.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (PATH.cum[mid] < s) lo = mid + 1; else hi = mid;
    }
    var i = Math.max(1, lo);
    var a = PATH.pts[i - 1];
    var b = PATH.pts[i];
    var seg = PATH.cum[i] - PATH.cum[i - 1] || 1;
    var k = (s - PATH.cum[i - 1]) / seg;
    return {
      x: lerp(a[0], b[0], k),
      y: lerp(a[1], b[1], k),
      a: Math.atan2(b[1] - a[1], b[0] - a[0])
    };
  }

  function distToPath(x, y) {
    var best = 1e9;
    for (var i = 0; i < PATH.pts.length; i += 2) {
      var d = dist(x, y, PATH.pts[i][0], PATH.pts[i][1]);
      if (d < best) best = d;
    }
    return best;
  }

  /* 把木牌推到离路足够远的位置，免得塔基压在路上 */
  function safePlots(spots) {
    return spots.map(function (p) {
      var x = clamp(p[0], 80, W - 80);
      var y = clamp(p[1], 90, H - 46);
      for (var guard = 0; guard < 40; guard++) {
        var d = distToPath(x, y);
        if (d >= 94) break;
        // 找最近的路点，朝反方向挪
        var best = 1e9, bx = 0, by = 0;
        for (var i = 0; i < PATH.pts.length; i += 2) {
          var dd = dist(x, y, PATH.pts[i][0], PATH.pts[i][1]);
          if (dd < best) { best = dd; bx = PATH.pts[i][0]; by = PATH.pts[i][1]; }
        }
        var ang = Math.atan2(y - by, x - bx);
        x = clamp(x + Math.cos(ang) * 4, 80, W - 80);
        y = clamp(y + Math.sin(ang) * 4, 90, H - 46);
      }
      return { x: x, y: y };
    });
  }

  var PLOTS = safePlots(PLOT_SPOTS);

  /* ---------- 水岸 ---------- */
  var SHORE = [
    [0, 486], [104, 500], [196, 528], [272, 568],
    [332, 616], [376, 666], [396, 720]
  ];

  function shoreXAt(y) {
    if (y <= SHORE[0][1]) return -20;
    for (var i = 1; i < SHORE.length; i++) {
      if (y <= SHORE[i][1]) {
        var a = SHORE[i - 1];
        var b = SHORE[i];
        var k = (y - a[1]) / (b[1] - a[1] || 1);
        return lerp(a[0], b[0], k);
      }
    }
    return SHORE[SHORE.length - 1][0];
  }

  function inWater(x, y) {
    return y > SHORE[0][1] && x < shoreXAt(y) - 6;
  }

  /* ============================================================
   * 2. 静态地图（只画一次，缓存成 2 倍图）
   * ============================================================ */

  var MAP_CV = null;
  var MAP_SCALE = 2;

  function tracePath(g) {
    var p = PATH.pts;
    g.beginPath();
    g.moveTo(p[0][0], p[0][1]);
    for (var i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]);
  }

  function drawGrass(g, rng) {
    var grd = g.createLinearGradient(0, 0, W * 0.6, H);
    grd.addColorStop(0, '#84bd4d');
    grd.addColorStop(0.45, '#74b144');
    grd.addColorStop(1, '#609d3a');
    g.fillStyle = grd;
    g.fillRect(-20, -20, W + 40, H + 40);

    var i, x, y, r;
    for (i = 0; i < 80; i++) {
      x = rng() * W;
      y = rng() * H;
      r = 60 + rng() * 150;
      var rg = g.createRadialGradient(x, y, 0, x, y, r);
      var light = rng() > 0.5;
      rg.addColorStop(0, light ? 'rgba(186,224,124,0.16)' : 'rgba(38,96,32,0.13)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }

    // 细碎草点
    for (i = 0; i < 3200; i++) {
      x = rng() * W;
      y = rng() * H;
      var v = rng();
      g.fillStyle = v > 0.6 ? 'rgba(196,228,132,0.20)' : 'rgba(42,92,32,0.16)';
      g.fillRect(x, y, 1.6, 1.6);
    }

    // 草叶
    g.lineWidth = 1.4;
    for (i = 0; i < 620; i++) {
      x = rng() * W;
      y = rng() * H;
      var h = 3 + rng() * 5;
      g.strokeStyle = rng() > 0.5 ? 'rgba(52,110,38,0.40)' : 'rgba(173,214,108,0.36)';
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 1.5, y - h * 0.6, x + (rng() > 0.5 ? 3 : -3), y - h);
      g.stroke();
    }

    // 云影
    for (i = 0; i < 6; i++) {
      x = rng() * W;
      y = rng() * H;
      r = 180 + rng() * 200;
      g.fillStyle = 'rgba(30,70,25,0.045)';
      g.beginPath();
      g.ellipse(x, y, r, r * 0.45, -0.3, 0, TAU);
      g.fill();
    }
  }

  function drawRiver(g, rng) {
    var i, x, y;

    // 沙滩
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(SHORE[0][0], SHORE[0][1]);
    for (i = 1; i < SHORE.length; i++) g.lineTo(SHORE[i][0], SHORE[i][1]);
    g.strokeStyle = '#e3c893';
    g.lineWidth = 40;
    g.stroke();
    g.strokeStyle = '#eed7a9';
    g.lineWidth = 22;
    g.stroke();

    // 水面
    g.beginPath();
    g.moveTo(SHORE[0][0], SHORE[0][1]);
    for (i = 1; i < SHORE.length; i++) g.lineTo(SHORE[i][0], SHORE[i][1]);
    g.lineTo(SHORE[SHORE.length - 1][0], H + 20);
    g.lineTo(-20, H + 20);
    g.closePath();
    var wg = g.createLinearGradient(0, 470, 300, 720);
    wg.addColorStop(0, '#5b9fb6');
    wg.addColorStop(0.5, '#3f83a0');
    wg.addColorStop(1, '#2c627c');
    g.fillStyle = wg;
    g.fill();

    // 浅水带
    g.save();
    g.clip();
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(SHORE[0][0], SHORE[0][1]);
    for (i = 1; i < SHORE.length; i++) g.lineTo(SHORE[i][0], SHORE[i][1]);
    g.strokeStyle = '#8ec6d6';
    g.lineWidth = 18;
    g.stroke();
    g.globalAlpha = 1;

    // 波纹
    for (i = 0; i < 34; i++) {
      x = rng() * 380;
      y = 500 + rng() * 230;
      if (!inWater(x, y)) continue;
      var w = 10 + rng() * 26;
      g.strokeStyle = 'rgba(214,240,246,' + (0.10 + rng() * 0.18).toFixed(2) + ')';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + w * 0.5, y - 3, x + w, y);
      g.stroke();
    }
    g.restore();

    // 芦苇
    for (i = 0; i < 46; i++) {
      y = 492 + rng() * 200;
      x = shoreXAt(y) + 6 + rng() * 26;
      var hh = 14 + rng() * 20;
      g.strokeStyle = 'rgba(96,130,58,0.9)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 4, y - hh * 0.6, x + 2 + rng() * 8, y - hh);
      g.stroke();
      if (rng() > 0.45) {
        g.fillStyle = '#a9824a';
        g.beginPath();
        g.ellipse(x + 3, y - hh, 2, 4.5, 0.3, 0, TAU);
        g.fill();
      }
    }
  }

  function drawPath(g, rng) {
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // 外圈土色
    tracePath(g);
    g.strokeStyle = 'rgba(96,72,36,0.28)';
    g.lineWidth = 80;
    g.stroke();

    tracePath(g);
    g.strokeStyle = '#bf9455';
    g.lineWidth = 74;
    g.stroke();

    tracePath(g);
    g.strokeStyle = '#d1ac6b';
    g.lineWidth = 66;
    g.stroke();

    tracePath(g);
    g.strokeStyle = '#ddb87a';
    g.lineWidth = 58;
    g.stroke();

    // 中缝高光
    tracePath(g);
    g.strokeStyle = 'rgba(246,225,170,0.32)';
    g.lineWidth = 30;
    g.stroke();

    // 路面颗粒
    for (var i = 0; i < 1300; i++) {
      var k = Math.floor(rng() * PATH.pts.length);
      var p = PATH.pts[k];
      var nx = Math.cos(rng() * TAU);
      var ny = Math.sin(rng() * TAU);
      var rad = rng() * 30;
      var x = p[0] + nx * rad;
      var y = p[1] + ny * rad;
      g.fillStyle = rng() > 0.55 ? 'rgba(120,92,48,0.22)' : 'rgba(250,232,186,0.30)';
      g.beginPath();
      g.arc(x, y, 0.6 + rng() * 1.5, 0, TAU);
      g.fill();
    }

    // 车辙
    g.strokeStyle = 'rgba(140,105,58,0.16)';
    g.lineWidth = 2;
    for (var side = -1; side <= 1; side += 2) {
      g.beginPath();
      var started = false;
      for (var j = 0; j < PATH.pts.length; j += 3) {
        var q = PATH.pts[j];
        var prev = PATH.pts[Math.max(0, j - 1)];
        var ang = Math.atan2(q[1] - prev[1], q[0] - prev[0]) + Math.PI / 2;
        var xx = q[0] + Math.cos(ang) * 11 * side;
        var yy = q[1] + Math.sin(ang) * 11 * side;
        if (!started) { g.moveTo(xx, yy); started = true; } else g.lineTo(xx, yy);
      }
      g.stroke();
    }

    // 草沿
    for (var m = 0; m < PATH.pts.length; m += 3) {
      var pt = PATH.pts[m];
      var pr = PATH.pts[Math.max(0, m - 1)];
      var a2 = Math.atan2(pt[1] - pr[1], pt[0] - pr[0]) + Math.PI / 2;
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        if (rng() > 0.55) continue;
        var ex = pt[0] + Math.cos(a2) * (33 + rng() * 7) * s2;
        var ey = pt[1] + Math.sin(a2) * (33 + rng() * 7) * s2;
        g.strokeStyle = rng() > 0.5 ? 'rgba(84,146,52,0.75)' : 'rgba(108,172,66,0.75)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(ex, ey);
        g.lineTo(ex + (rng() - 0.5) * 6, ey - 5 - rng() * 3);
        g.stroke();
      }
    }
  }

  function drawTree(g, x, y, s, rng) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);

    g.fillStyle = 'rgba(28,62,20,0.20)';
    g.beginPath();
    g.ellipse(5, 2, 25, 8, 0, 0, TAU);
    g.fill();

    g.fillStyle = '#6d4a28';
    rrPath(g, -3.5, -20, 7, 22, 3);
    g.fill();

    var blobs = [
      [-13, -26, 15],
      [0, -34, 19],
      [13, -26, 15],
      [0, -20, 15]
    ];
    var i, b;
    for (i = 0; i < blobs.length; i++) {
      b = blobs[i];
      g.fillStyle = '#24521d';
      g.beginPath();
      g.arc(b[0], b[1], b[2] + 2.4, 0, TAU);
      g.fill();
    }
    for (i = 0; i < blobs.length; i++) {
      b = blobs[i];
      g.fillStyle = '#4d9a37';
      g.beginPath();
      g.arc(b[0], b[1], b[2], 0, TAU);
      g.fill();
      g.fillStyle = '#66b348';
      g.beginPath();
      g.arc(b[0] - b[2] * 0.22, b[1] - b[2] * 0.28, b[2] * 0.62, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(150,212,100,0.9)';
      g.beginPath();
      g.arc(b[0] - b[2] * 0.32, b[1] - b[2] * 0.42, b[2] * 0.3, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  function drawBush(g, x, y, s, rng) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = 'rgba(28,62,20,0.15)';
    g.beginPath();
    g.ellipse(2, 2, 14, 5, 0, 0, TAU);
    g.fill();
    var blobs = [[-7, -8, 9], [4, -10, 10], [0, -4, 9]];
    for (var i = 0; i < blobs.length; i++) {
      g.fillStyle = '#3d7f2c';
      g.beginPath();
      g.arc(blobs[i][0], blobs[i][1], blobs[i][2] + 1.2, 0, TAU);
      g.fill();
    }
    for (i = 0; i < blobs.length; i++) {
      g.fillStyle = '#55a03a';
      g.beginPath();
      g.arc(blobs[i][0], blobs[i][1], blobs[i][2], 0, TAU);
      g.fill();
      g.fillStyle = '#74bd4c';
      g.beginPath();
      g.arc(blobs[i][0] - 2, blobs[i][1] - 3, blobs[i][2] * 0.5, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  function nearVillage(x, y) {
    return dist(x, y, VILLAGE.x, VILLAGE.y) < 150;
  }
  function nearCamp(x, y) {
    return dist(x, y, CAMP.x, CAMP.y) < 145;
  }
  function nearBase(x, y) {
    return dist(x, y, BASE.x, BASE.y) < 95;
  }
  function nearPlot(x, y) {
    for (var i = 0; i < PLOTS.length; i++) {
      if (dist(x, y, PLOTS[i].x, PLOTS[i].y) < 62) return true;
    }
    return false;
  }

  function drawForest(g, rng) {
    var spots = [];
    var i, x, y;

    function tryTree(x, y, s) {
      if (x < 8 || x > W - 8 || y < 4 || y > H - 4) return;
      if (inWater(x, y + 8)) return;
      if (distToPath(x, y) < 74) return;
      if (nearVillage(x, y) || nearCamp(x, y) || nearBase(x, y) || nearPlot(x, y)) return;
      spots.push({ x: x, y: y, s: s });
    }

    // 上缘
    for (x = -6; x < W + 20; x += 42) {
      tryTree(x + (rng() - 0.5) * 16, 12 + rng() * 34, 0.85 + rng() * 0.45);
    }
    // 左缘
    for (y = 50; y < 470; y += 40) {
      tryTree(10 + rng() * 46, y + (rng() - 0.5) * 14, 0.8 + rng() * 0.4);
    }
    // 右缘
    for (y = 110; y < 690; y += 38) {
      tryTree(1218 + rng() * 50, y + (rng() - 0.5) * 14, 0.8 + rng() * 0.4);
    }
    // 右下角树林
    for (i = 0; i < 34; i++) {
      x = 980 + rng() * 300;
      y = 600 + rng() * 120;
      tryTree(x, y, 0.8 + rng() * 0.5);
    }
    // 零散树丛
    var clusters = [
      [210, 170], [320, 120], [180, 250], [520, 470], [380, 470],
      [640, 620], [470, 220], [900, 150], [1200, 520], [860, 610],
      [430, 110], [350, 75], [505, 85], [560, 640]
    ];
    for (i = 0; i < clusters.length; i++) {
      var cx = clusters[i][0] + (rng() - 0.5) * 30;
      var cy = clusters[i][1] + (rng() - 0.5) * 30;
      var n = 2 + Math.floor(rng() * 3);
      for (var j = 0; j < n; j++) {
        tryTree(cx + (rng() - 0.5) * 56, cy + (rng() - 0.5) * 40, 0.7 + rng() * 0.35);
      }
    }

    // 后面的先画
    spots.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < spots.length; i++) drawTree(g, spots[i].x, spots[i].y, spots[i].s, rng);

    // 灌木
    for (i = 0; i < 26; i++) {
      x = rng() * W;
      y = rng() * H;
      if (inWater(x, y) || distToPath(x, y) < 60) continue;
      if (nearVillage(x, y) || nearCamp(x, y) || nearBase(x, y) || nearPlot(x, y)) continue;
      drawBush(g, x, y, 0.7 + rng() * 0.6, rng);
    }
  }

  function drawRocks(g, rng) {
    var spots = [
      [1000, 210], [1060, 230], [720, 300], [430, 260], [890, 470],
      [1040, 330], [600, 470], [330, 470], [1130, 560], [520, 690],
      [860, 690], [250, 210], [700, 120], [370, 380]
    ];
    for (var i = 0; i < spots.length; i++) {
      var x = spots[i][0] + (rng() - 0.5) * 12;
      var y = spots[i][1] + (rng() - 0.5) * 10;
      var s = 0.7 + rng() * 0.7;
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(30,60,25,0.18)';
      g.beginPath();
      g.ellipse(2, 1, 10, 4, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#8f8d7d';
      g.beginPath();
      g.moveTo(-8, 0);
      g.lineTo(-5, -7);
      g.lineTo(2, -9);
      g.lineTo(8, -3);
      g.lineTo(7, 0);
      g.closePath();
      g.fill();
      g.fillStyle = '#b0ad9c';
      g.beginPath();
      g.moveTo(-5, -6);
      g.lineTo(0, -8);
      g.lineTo(4, -5);
      g.lineTo(-2, -3);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  function drawHut(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);

    g.fillStyle = 'rgba(60,44,20,0.20)';
    g.beginPath();
    g.ellipse(3, 2, 30, 9, 0, 0, TAU);
    g.fill();

    // 墙
    g.fillStyle = '#e8d6ab';
    rrPath(g, -24, -34, 48, 34, 4);
    g.fill();
    g.strokeStyle = 'rgba(140,110,60,0.45)';
    g.lineWidth = 1.5;
    g.stroke();

    // 草顶
    g.fillStyle = '#d3ab60';
    g.beginPath();
    g.moveTo(-33, -30);
    g.quadraticCurveTo(-30, -56, 0, -58);
    g.quadraticCurveTo(30, -56, 33, -30);
    g.quadraticCurveTo(18, -38, 0, -38);
    g.quadraticCurveTo(-18, -38, -33, -30);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(120,86,36,0.45)';
    g.lineWidth = 1.5;
    g.stroke();

    // 草纹
    g.strokeStyle = 'rgba(150,108,48,0.45)';
    g.lineWidth = 1;
    for (var i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(i * 8, -54 + Math.abs(i) * 2.2);
      g.lineTo(i * 9.5, -33);
      g.stroke();
    }

    // 门窗
    g.fillStyle = '#6b4a2a';
    rrPath(g, -7, -22, 14, 22, 2);
    g.fill();
    g.fillStyle = '#4a3119';
    rrPath(g, -4, -18, 8, 18, 1);
    g.fill();
    g.fillStyle = '#8a6636';
    g.fillRect(-19, -26, 9, 7);
    g.strokeStyle = '#6b4a2a';
    g.lineWidth = 1.4;
    g.strokeRect(-19, -26, 9, 7);

    g.restore();
  }

  function drawVillage(g, rng) {
    g.save();
    // 泥地
    var vg = g.createRadialGradient(VILLAGE.x, VILLAGE.y, 10, VILLAGE.x, VILLAGE.y, 130);
    vg.addColorStop(0, 'rgba(214,184,126,0.95)');
    vg.addColorStop(1, 'rgba(214,184,126,0)');
    g.fillStyle = vg;
    g.beginPath();
    g.ellipse(VILLAGE.x, VILLAGE.y + 12, 140, 76, 0, 0, TAU);
    g.fill();

    drawHut(g, 1100, 74, 0.62);
    drawHut(g, 1162, 62, 0.72);
    drawHut(g, 1212, 86, 0.56);

    // 围栏
    g.strokeStyle = '#8a6134';
    g.lineWidth = 3.4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(1040, 44);
    for (var i = 0; i < 6; i++) {
      g.lineTo(1040 + i * 18, 40 + (i % 2) * 4);
    }
    g.stroke();
    for (i = 0; i <= 6; i++) {
      g.beginPath();
      g.moveTo(1040 + i * 18, 40 + (i % 2) * 4);
      g.lineTo(1038 + i * 18, 56 + (i % 2) * 3);
      g.stroke();
    }

    // 木桶
    g.fillStyle = '#9a6b38';
    rrPath(g, 1024, 88, 18, 22, 4);
    g.fill();
    g.strokeStyle = '#6d4822';
    g.lineWidth = 2;
    g.stroke();
    g.beginPath();
    g.moveTo(1024, 96);
    g.lineTo(1042, 96);
    g.stroke();

    // 干草堆
    g.fillStyle = '#d9b768';
    g.beginPath();
    g.ellipse(1246, 112, 22, 13, -0.2, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(150,110,48,0.55)';
    g.lineWidth = 1.2;
    for (i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(1246 + i * 7, 101);
      g.lineTo(1248 + i * 7, 122);
      g.stroke();
    }
    g.restore();
  }

  function drawTent(g, x, y, s, tone) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);

    g.fillStyle = 'rgba(40,50,25,0.20)';
    g.beginPath();
    g.ellipse(4, 2, 30, 8, 0, 0, TAU);
    g.fill();

    var body = tone === 'blue' ? '#cfdbe2' : '#d9d3bd';
    var shade = tone === 'blue' ? '#93a8b8' : '#b3ac90';

    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-30, 0);
    g.lineTo(-6, -46);
    g.lineTo(6, -46);
    g.lineTo(30, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(90,100,90,0.5)';
    g.lineWidth = 1.6;
    g.stroke();

    g.fillStyle = shade;
    g.beginPath();
    g.moveTo(2, -44);
    g.lineTo(6, -46);
    g.lineTo(30, 0);
    g.lineTo(12, 0);
    g.closePath();
    g.fill();

    // 门帘
    g.fillStyle = '#54646e';
    g.beginPath();
    g.moveTo(-7, 0);
    g.lineTo(-2, -24);
    g.lineTo(4, -24);
    g.lineTo(9, 0);
    g.closePath();
    g.fill();

    // 顶部旗杆
    g.strokeStyle = '#7a5a32';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -46);
    g.lineTo(0, -60);
    g.stroke();

    g.restore();
  }

  function drawFlag(g, x, y, s, color, star) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.strokeStyle = '#7c5a30';
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -40);
    g.stroke();

    g.fillStyle = color;
    g.beginPath();
    g.moveTo(1, -39);
    g.quadraticCurveTo(14, -44, 26, -37);
    g.quadraticCurveTo(20, -30, 26, -23);
    g.quadraticCurveTo(13, -30, 1, -25);
    g.closePath();
    g.fill();

    if (star) {
      g.fillStyle = '#f2d34c';
      starPath(g, 9, -32, 4.2);
      g.fill();
    }
    g.restore();
  }

  function starPath(g, x, y, r) {
    g.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? r : r * 0.45;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var px = x + Math.cos(a) * rad;
      var py = y + Math.sin(a) * rad;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }

  function drawCamp(g, rng) {
    g.save();
    var cg = g.createRadialGradient(CAMP.x, CAMP.y, 8, CAMP.x, CAMP.y, 140);
    cg.addColorStop(0, 'rgba(208,186,132,0.55)');
    cg.addColorStop(1, 'rgba(208,186,132,0)');
    g.fillStyle = cg;
    g.beginPath();
    g.ellipse(CAMP.x, CAMP.y, 142, 92, 0, 0, TAU);
    g.fill();

    drawTent(g, 168, 322, 1.02, 'blue');
    drawTent(g, 238, 292, 0.92, 'blue');
    drawTent(g, 300, 348, 0.86, 'white');
    drawTent(g, 214, 386, 0.8, 'white');

    // 篝火
    var fx = 268, fy = 344;
    g.fillStyle = '#6b4a2a';
    g.save();
    g.translate(fx, fy);
    for (var i = 0; i < 3; i++) {
      g.save();
      g.rotate(i * 1.05);
      rrPath(g, -11, -2.2, 22, 4.4, 2);
      g.fillStyle = '#7d5730';
      g.fill();
      g.restore();
    }
    g.restore();
    g.fillStyle = 'rgba(240,150,50,0.85)';
    g.beginPath();
    g.moveTo(fx, fy - 2);
    g.quadraticCurveTo(fx + 7, fy - 10, fx + 3, fy - 16);
    g.quadraticCurveTo(fx + 1, fy - 8, fx - 4, fy - 5);
    g.closePath();
    g.fill();

    // 木箱
    g.fillStyle = '#a97b42';
    rrPath(g, 300, 268, 24, 20, 3);
    g.fill();
    g.strokeStyle = '#77501f';
    g.lineWidth = 1.6;
    g.stroke();
    g.beginPath();
    g.moveTo(300, 278);
    g.lineTo(324, 278);
    g.stroke();

    // 弹药箱
    g.fillStyle = '#7e8a6e';
    rrPath(g, 144, 372, 30, 18, 2);
    g.fill();
    g.strokeStyle = '#4e5a44';
    g.lineWidth = 1.4;
    g.stroke();
    g.beginPath();
    g.moveTo(144, 381);
    g.lineTo(174, 381);
    g.stroke();

    // 步枪架
    g.strokeStyle = '#4a3722';
    g.lineWidth = 2;
    for (i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(326 + i * 5, 316);
      g.lineTo(338 + i * 5, 296);
      g.stroke();
    }

    drawFlag(g, 132, 300, 1, '#c8342a', true);
    g.restore();
  }

  function drawPier(g, rng) {
    // 浮桥：从岸上伸进水里
    var x0 = 430, y0 = 662, x1 = 286, y1 = 700;
    var ang = Math.atan2(y1 - y0, x1 - x0);
    var len = dist(x0, y0, x1, y1);
    g.save();
    g.translate(x0, y0);
    g.rotate(ang);

    // 水面阴影
    g.fillStyle = 'rgba(18,52,64,0.28)';
    rrPath(g, -len - 4, -10, len + 8, 30, 6);
    g.fill();

    // 桥面
    g.fillStyle = '#c08f55';
    rrPath(g, -len, -15, len, 30, 4);
    g.fill();

    // 木板
    var planks = 15;
    var step = len / planks;
    for (var i = 0; i < planks; i++) {
      g.fillStyle = i % 2 ? '#b08248' : '#c3935a';
      rrPath(g, -len + i * step + 1.5, -14.5, step - 3, 29, 2);
      g.fill();
      g.strokeStyle = 'rgba(90,60,28,0.35)';
      g.lineWidth = 1;
      g.stroke();
    }

    // 两侧木栏
    g.strokeStyle = '#8a6134';
    g.lineWidth = 2.6;
    for (var s = -1; s <= 1; s += 2) {
      g.beginPath();
      g.moveTo(-len + 5, s * 13);
      g.lineTo(-6, s * 13);
      g.stroke();
      for (var k = 0; k <= 4; k++) {
        var px = -len + 6 + (len - 12) * (k / 4);
        g.beginPath();
        g.moveTo(px, s * 13);
        g.lineTo(px, s * 13 - 14);
        g.stroke();
        g.fillStyle = '#a37a45';
        g.beginPath();
        g.arc(px, s * 13 - 14, 2.4, 0, TAU);
        g.fill();
      }
    }

    // 桥头立柱
    g.fillStyle = '#7a5330';
    rrPath(g, -len - 6, -20, 6, 40, 2);
    g.fill();
    rrPath(g, -8, -20, 6, 40, 2);
    g.fill();
    g.restore();

    // 水边小船
    g.save();
    g.translate(330, 690);
    g.rotate(0.08);
    g.fillStyle = '#8a5f36';
    g.beginPath();
    g.moveTo(-26, -4);
    g.quadraticCurveTo(0, 10, 26, -4);
    g.quadraticCurveTo(0, 2, -26, -4);
    g.closePath();
    g.fill();
    g.strokeStyle = '#5d3f22';
    g.lineWidth = 1.4;
    g.stroke();
    g.strokeStyle = '#c8a97a';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-20, -1);
    g.lineTo(18, -1);
    g.stroke();
    g.restore();
  }

  function drawBase(g, rng) {
    var x = BASE.x, y = BASE.y;

    g.save();
    // 沙袋圈
    for (var i = 0; i < 12; i++) {
      var a = -Math.PI * 0.95 + (i / 11) * Math.PI * 1.9;
      var bx = x + Math.cos(a) * 40;
      var by = y + Math.sin(a) * 17 - 6;
      g.save();
      g.translate(bx, by);
      g.rotate(a + Math.PI / 2);
      g.fillStyle = i % 2 ? '#c8b183' : '#bfa878';
      rrPath(g, -9, -5, 18, 10, 4);
      g.fill();
      g.strokeStyle = 'rgba(120,96,54,0.55)';
      g.lineWidth = 1.2;
      g.stroke();
      g.restore();
    }

    // 旗
    drawFlag(g, x + 18, y - 10, 1.15, '#c8342a', true);

    // 守卫
    var sy = y - 8;
    drawSoldier(g, x - 20, sy, 0.95, 1, {
      coat: '#b9a675', pants: '#8f7f58', cap: '#8f9a8a', skin: '#e6c49a',
      star: true, phase: 0, rifle: true, aim: -0.4
    });
    drawSoldier(g, x + 6, sy + 2, 0.95, -1, {
      coat: '#b9a675', pants: '#8f7f58', cap: '#8f9a8a', skin: '#e6c49a',
      star: true, phase: 1.6, rifle: true, aim: -2.7
    });

    // 木牌
    g.fillStyle = '#7d5730';
    rrPath(g, x - 44, y - 42, 4, 30, 1);
    g.fill();
    g.fillStyle = '#e7d7ae';
    rrPath(g, x - 62, y - 60, 40, 20, 3);
    g.fill();
    g.strokeStyle = '#8a6636';
    g.lineWidth = 1.4;
    g.stroke();
    label(g, '渡口', x - 42, y - 50, 12, '#5a4322', 'center', true);

    // 缆绳
    g.strokeStyle = 'rgba(230,214,170,0.8)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(x - 16, y + 6);
    g.quadraticCurveTo(x - 60, y + 20, x - 96, y + 26);
    g.stroke();

    g.restore();
  }

  function drawFence(g, x0, y0, x1, y1, rng) {
    var len = dist(x0, y0, x1, y1);
    var n = Math.max(2, Math.round(len / 26));
    var i, k, x, y;
    g.strokeStyle = '#8a6134';
    g.lineWidth = 2;
    g.beginPath();
    for (i = 0; i <= n; i++) {
      k = i / n;
      x = lerp(x0, x1, k);
      y = lerp(y0, y1, k) + Math.sin(k * Math.PI * 2) * 1.5;
      g.moveTo(x, y);
      g.lineTo(x, y - 24);
    }
    g.stroke();
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(x0, y0 - 18);
    for (i = 0; i <= n; i++) {
      k = i / n;
      g.lineTo(lerp(x0, x1, k), lerp(y0, y1, k) - 18);
    }
    g.moveTo(x0, y0 - 8);
    for (i = 0; i <= n; i++) {
      k = i / n;
      g.lineTo(lerp(x0, x1, k), lerp(y0, y1, k) - 8);
    }
    g.stroke();

    for (i = 0; i <= n; i++) {
      k = i / n;
      x = lerp(x0, x1, k);
      y = lerp(y0, y1, k);
      g.fillStyle = '#a37a45';
      g.beginPath();
      g.arc(x, y - 24, 2.2, 0, TAU);
      g.fill();
    }
  }

  function drawSheep(g, x, y, s, face) {
    g.save();
    g.translate(x, y);
    g.scale(face * s, s);
    g.fillStyle = 'rgba(30,50,22,0.18)';
    g.beginPath();
    g.ellipse(0, 0, 13, 3.6, 0, 0, TAU);
    g.fill();
    g.strokeStyle = '#5c5648';
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-7, -8); g.lineTo(-7, -1);
    g.moveTo(-2, -8); g.lineTo(-2, -1);
    g.moveTo(5, -8); g.lineTo(5, -1);
    g.moveTo(9, -8); g.lineTo(9, -1);
    g.stroke();
    g.fillStyle = '#f2ecdc';
    g.beginPath();
    g.ellipse(0, -12, 12, 8, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#3f3d38';
    g.beginPath();
    g.ellipse(11, -18, 4.6, 3.8, -0.3, 0, TAU);
    g.fill();
    g.fillStyle = '#f2ecdc';
    g.beginPath();
    g.arc(9, -19, 3.4, 0, TAU);
    g.fill();
    g.fillStyle = '#3f3d38';
    g.beginPath();
    g.arc(12.4, -21.4, 3, 0, TAU);
    g.fill();
    g.fillStyle = '#f2ecdc';
    g.beginPath();
    g.arc(13, -22, 1.4, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawDecor(g, rng) {
    // 右侧木栅栏与草垛
    drawFence(g, 1080, 596, 1210, 620, rng);
    var hays = [[1136, 646], [1176, 640], [1210, 660]];
    for (var i = 0; i < hays.length; i++) {
      var x = hays[i][0], y = hays[i][1];
      g.fillStyle = '#d8b45f';
      g.beginPath();
      g.ellipse(x, y, 20, 12, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(150,110,40,0.5)';
      g.lineWidth = 1.2;
      for (var j = -1; j <= 1; j++) {
        g.beginPath();
        g.ellipse(x, y, 20 - Math.abs(j) * 3, 12 - Math.abs(j) * 2, 0, 0.2, Math.PI - 0.2);
        g.stroke();
      }
    }

    // 路标（敌军方向）
    g.fillStyle = '#7d5730';
    rrPath(g, 1244, 158, 4, 30, 1);
    g.fill();
    g.fillStyle = '#e7d7ae';
    g.beginPath();
    g.moveTo(1216, 152);
    g.lineTo(1252, 152);
    g.lineTo(1262, 160);
    g.lineTo(1252, 168);
    g.lineTo(1216, 168);
    g.closePath();
    g.fill();
    g.strokeStyle = '#8a6636';
    g.lineWidth = 1.4;
    g.stroke();
    label(g, '敌', 1234, 160, 11, '#7a2b22', 'center', true);

    // 路中红旗（阻击点）
    drawFlag(g, 596, 348, 0.7, '#c8342a', true);
    drawFlag(g, 1088, 470, 0.7, '#c8342a', true);

    // 江边小屋与羊群
    drawHut(g, 252, 468, 0.62);
    drawSheep(g, 312, 480, 0.92, 1);
    drawSheep(g, 342, 466, 0.8, -1);
    drawSheep(g, 330, 494, 0.7, 1);

    // 水面标签
    g.save();
    g.translate(150, 574);
    g.rotate(-0.1);
    label(g, '湘  江', 0, 0, 27, 'rgba(236,248,250,0.5)', 'center', true);
    g.restore();

    // 破损辎重
    g.save();
    g.translate(470, 452);
    g.rotate(0.32);
    g.fillStyle = '#9c7a45';
    rrPath(g, -16, -10, 32, 20, 3);
    g.fill();
    g.strokeStyle = '#6d4f26';
    g.lineWidth = 1.6;
    g.stroke();
    g.beginPath();
    g.moveTo(-16, 0);
    g.lineTo(16, 0);
    g.stroke();
    g.restore();
  }

  function paintMap() {
    var cv = document.createElement('canvas');
    cv.width = W * MAP_SCALE;
    cv.height = H * MAP_SCALE;
    var g = cv.getContext('2d');
    g.scale(MAP_SCALE, MAP_SCALE);
    var rng = mulberry32(19341127);

    drawGrass(g, rng);
    drawRiver(g, rng);
    drawPath(g, rng);
    drawVillage(g, rng);
    drawCamp(g, rng);
    drawForest(g, rng);
    drawRocks(g, rng);
    drawDecor(g, rng);
    drawPier(g, rng);
    drawBase(g, rng);

    // 暗角
    var vg = g.createRadialGradient(W * 0.5, H * 0.46, H * 0.34, W * 0.5, H * 0.5, H * 0.95);
    vg.addColorStop(0, 'rgba(20,40,16,0)');
    vg.addColorStop(1, 'rgba(16,34,14,0.28)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    return cv;
  }

  /* ============================================================
   * 3. 单位与工事的画法
   * ============================================================ */

  var SKIN = '#e5c39a';
  var RED_COAT = '#b8a478';
  var RED_PANTS = '#95855f';
  var RED_CAP = '#8b9583';
  var GREY_COAT = '#6c7a86';
  var GREY_PANTS = '#586571';
  var GREY_CAP = '#4a5560';

  function drawSoldier(g, x, y, s, face, o) {
    o = o || {};
    var ph = o.phase || 0;
    var sw = Math.sin(ph) * 3;

    g.save();
    g.translate(x, y);
    g.scale(face * s, s);

    if (o.cape) {
      g.fillStyle = o.cape;
      g.beginPath();
      g.moveTo(-6, -28);
      g.quadraticCurveTo(-18, -16, -12, 0);
      g.lineTo(0, -2);
      g.lineTo(4, -28);
      g.closePath();
      g.fill();
    }

    g.fillStyle = 'rgba(18,34,12,0.22)';
    g.beginPath();
    g.ellipse(2, 0, 11, 3.6, 0, 0, TAU);
    g.fill();

    // 腿
    g.strokeStyle = o.pants || GREY_PANTS;
    g.lineWidth = 4.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-3, -15);
    g.lineTo(-3 + sw, -1.5);
    g.moveTo(3, -15);
    g.lineTo(3 - sw, -1.5);
    g.stroke();

    g.fillStyle = '#463f33';
    g.beginPath();
    g.ellipse(-3 + sw, -1, 3.4, 2, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(3 - sw, -1, 3.4, 2, 0, 0, TAU);
    g.fill();

    // 上衣
    g.fillStyle = o.coat || GREY_COAT;
    rrPath(g, -7.5, -32, 15, 20, 5);
    g.fill();
    g.strokeStyle = 'rgba(30,36,26,0.28)';
    g.lineWidth = 1;
    g.stroke();

    // 腰带
    g.fillStyle = '#5a4a30';
    g.fillRect(-7.5, -19, 15, 3);

    // 手臂
    g.strokeStyle = o.coat || GREY_COAT;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(4, -27);
    g.lineTo(9, -21);
    g.stroke();
    g.fillStyle = SKIN;
    g.beginPath();
    g.arc(9, -20, 2.2, 0, TAU);
    g.fill();

    // 头
    g.fillStyle = o.skin || SKIN;
    g.beginPath();
    g.arc(0, -37, 6.3, 0, TAU);
    g.fill();

    // 帽子
    if (o.helmet) {
      g.fillStyle = o.cap || GREY_CAP;
      g.beginPath();
      g.arc(0, -38, 7.4, Math.PI, TAU);
      g.closePath();
      g.fill();
      g.beginPath();
      g.ellipse(0, -38, 9, 2.2, 0, 0, Math.PI);
      g.fill();
    } else {
      g.fillStyle = o.cap || GREY_CAP;
      g.beginPath();
      g.arc(0, -39, 7, Math.PI * 1.02, TAU);
      g.closePath();
      g.fill();
      g.beginPath();
      g.ellipse(3.4, -38.4, 5.4, 2.2, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(-6, -42, 12, 1.4);
    }

    // 红星
    if (o.star) {
      g.fillStyle = '#d33a2c';
      starPath(g, 1.4, -41.5, 2.7);
      g.fill();
    }

    // 步枪
    if (o.rifle) {
      g.save();
      g.translate(6, -24);
      g.rotate(-0.12 + (o.rifleTilt || 0));
      g.strokeStyle = '#3d3529';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(-4, 0);
      g.lineTo(13, -1);
      g.stroke();
      g.strokeStyle = '#8f9499';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(13, -1);
      g.lineTo(19, -2);
      g.stroke();
      g.restore();
    }

    g.restore();
  }

  function drawHorse(g, x, y, s, face, phase) {
    g.save();
    g.translate(x, y);
    g.scale(face * s, s);

    g.fillStyle = 'rgba(18,34,12,0.22)';
    g.beginPath();
    g.ellipse(0, 0, 24, 5.5, 0, 0, TAU);
    g.fill();

    var leg = Math.sin(phase) * 5;

    g.strokeStyle = '#5b3d22';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-13, -18); g.lineTo(-15 + leg, -1);
    g.moveTo(-6, -17); g.lineTo(-4 - leg, -1);
    g.moveTo(9, -18); g.lineTo(7 - leg, -1);
    g.moveTo(16, -17); g.lineTo(19 + leg, -1);
    g.stroke();

    g.fillStyle = '#7a5230';
    g.beginPath();
    g.ellipse(0, -24, 21, 11, 0, 0, TAU);
    g.fill();

    g.beginPath();
    g.moveTo(15, -30);
    g.quadraticCurveTo(24, -40, 27, -44);
    g.lineTo(33, -42);
    g.quadraticCurveTo(30, -32, 22, -24);
    g.closePath();
    g.fill();

    g.beginPath();
    g.ellipse(31, -44, 7, 4.4, -0.35, 0, TAU);
    g.fill();

    g.strokeStyle = '#4a3018';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-20, -26);
    g.quadraticCurveTo(-28, -20, -26, -12);
    g.stroke();

    // 马鞍
    g.fillStyle = '#8a4b33';
    rrPath(g, -7, -35, 17, 7, 3);
    g.fill();

    g.restore();
  }

  function drawEnemy(g, e) {
    var face = Math.cos(e.ang) < 0 ? -1 : 1;
    var phase = e.s * 0.18;

    if (e.type === 'cavalry') {
      drawHorse(g, e.x, e.y, e.size, face, phase);
      drawSoldier(g, e.x - 2 * face, e.y - 26, 0.72 * e.size, face, {
        coat: GREY_COAT, pants: GREY_PANTS, cap: GREY_CAP,
        phase: phase, rifle: true, rifleTilt: 0.4
      });
    } else if (e.type === 'mg') {
      drawSoldier(g, e.x + 6 * face, e.y, e.size, face, {
        coat: GREY_COAT, pants: GREY_PANTS, cap: GREY_CAP, helmet: true,
        phase: phase * 0.6, rifle: false
      });
      // 机枪
      g.save();
      g.translate(e.x - 6 * face, e.y - 2);
      g.strokeStyle = '#3a3a34';
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(-8, 0); g.lineTo(4, -14);
      g.moveTo(2, 0); g.lineTo(4, -14);
      g.moveTo(10, 0); g.lineTo(4, -14);
      g.stroke();
      g.fillStyle = '#2e2e29';
      rrPath(g, -12, -18, 22, 4, 2);
      g.fill();
      g.restore();
    } else if (e.type === 'officer') {
      drawSoldier(g, e.x, e.y, e.size, face, {
        coat: '#5b6672', pants: '#47525c', cap: '#39424b',
        phase: phase, cape: '#3f2f36', rifle: false, star: false
      });
      // 指挥刀
      g.save();
      g.translate(e.x + 6 * face, e.y - 26);
      g.rotate(-0.55 * face);
      g.strokeStyle = '#cfd6dc';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(21 * face, -2);
      g.stroke();
      g.restore();
    } else {
      drawSoldier(g, e.x, e.y, e.size, face, {
        coat: GREY_COAT, pants: GREY_PANTS, cap: GREY_CAP,
        phase: phase, rifle: true, rifleTilt: 0
      });
    }

    // 血条
    var top = e.type === 'cavalry' ? 52 : (e.boss ? 56 : 48);
    if (e.hp < e.maxHp || e.boss) {
      var bw = e.boss ? 44 : 30;
      var bx = e.x - bw / 2;
      var by = e.y - top * e.size;
      g.fillStyle = 'rgba(16,22,16,0.62)';
      rrPath(g, bx - 1, by - 1, bw + 2, 6, 3);
      g.fill();
      var ratio = clamp(e.hp / e.maxHp, 0, 1);
      g.fillStyle = ratio > 0.55 ? '#8ed24c' : (ratio > 0.28 ? '#e3c447' : '#d3452f');
      rrPath(g, bx, by, bw * ratio, 4, 2);
      g.fill();
    }

    if (e.flash > 0) {
      g.globalAlpha = e.flash * 4;
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(e.x, e.y - 22 * e.size, 16 * e.size, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
  }

  /* ---------- 木牌 / 工事 ---------- */

  function drawPlot(g, p, idx) {
    var hovered = S.hoverPlot === p && !p.tower;
    var selected = S.sel && S.sel.plot === p;

    g.save();
    var grd = g.createRadialGradient(p.x, p.y - 6, 3, p.x, p.y, 34);
    grd.addColorStop(0, '#dcc08a');
    grd.addColorStop(1, '#b8985f');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(p.x, p.y, 34, 24, 0, 0, TAU);
    g.fill();
    g.strokeStyle = hovered || selected ? 'rgba(255,226,150,0.95)' : 'rgba(110,84,44,0.5)';
    g.lineWidth = hovered || selected ? 3 : 2;
    g.stroke();

    if (!p.tower) {
      var bob = hovered ? Math.sin(S.time * 5) * 2 - 2 : 0;
      var tilt = (idx % 2 ? 0.05 : -0.05);
      g.save();
      g.translate(p.x, p.y - 10 + bob);
      g.rotate(tilt);
      g.fillStyle = '#7d5730';
      rrPath(g, -2, -18, 4, 28, 1.5);
      g.fill();
      g.fillStyle = 'rgba(30,40,20,0.18)';
      g.fillRect(-1, -6, 2, 18);
      g.restore();

      g.save();
      g.translate(p.x, p.y - 34 + bob);
      g.rotate(tilt);
      g.fillStyle = '#efe0b8';
      rrPath(g, -17, -13, 34, 26, 4);
      g.fill();
      g.strokeStyle = '#8a6636';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = 'rgba(150,118,66,0.25)';
      g.fillRect(-13, 6, 26, 2);
      label(g, '?', 0, 0, 19, '#6b5227', 'center', true);
      g.restore();
    }
    g.restore();
  }

  function drawSandbagRing(g, x, y, rx, ry, n, rot) {
    for (var i = 0; i < n; i++) {
      var a = (rot || 0) + (i / n) * TAU;
      var bx = x + Math.cos(a) * rx;
      var by = y + Math.sin(a) * ry - 4;
      g.save();
      g.translate(bx, by);
      g.rotate(a + Math.PI / 2);
      g.fillStyle = i % 2 ? '#cbb383' : '#c0a878';
      rrPath(g, -9.5, -5.5, 19, 11, 4.5);
      g.fill();
      g.strokeStyle = 'rgba(110,88,50,0.5)';
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = 'rgba(255,245,214,0.22)';
      g.fillRect(-6, -3.6, 12, 2);
      g.restore();
    }
  }

  function muzzleOf(t) {
    var len = t.kind === 'gun' ? (t.level === 3 ? 26 : 20) : (13 + t.level * 6);
    return {
      x: t.x + Math.cos(t.aim) * len,
      y: t.y - 26 + Math.sin(t.aim) * len * 0.7
    };
  }

  function drawTower(g, t) {
    var x = t.x, y = t.y;

    g.save();
    g.translate(x, y);
    g.scale(1.16, 1.16);
    g.translate(-x, -y);

    // 地基
    g.fillStyle = 'rgba(60,44,22,0.18)';
    g.beginPath();
    g.ellipse(x + 2, y + 4, 34, 15, 0, 0, TAU);
    g.fill();

    g.fillStyle = '#b99a63';
    g.beginPath();
    g.ellipse(x, y, 31, 16, 0, 0, TAU);
    g.fill();

    if (t.kind === 'gun') {
      if (t.level === 1) {
        drawSandbagRing(g, x, y, 26, 13, 7, 0.2);
        drawSoldier(g, x - 10, y + 3, 0.95, 1, {
          coat: RED_COAT, pants: RED_PANTS, cap: RED_CAP, phase: 0,
          rifle: true, star: true
        });
        drawSoldier(g, x + 9, y + 5, 0.95, -1, {
          coat: RED_COAT, pants: RED_PANTS, cap: RED_CAP, phase: 2.1,
          rifle: true, star: true
        });
        drawRifleAim(g, x - 4, y - 24, t.aim, t.recoil, '#3d3529');
      } else if (t.level === 2) {
        drawSandbagRing(g, x, y, 28, 14, 8, 0.1);
        drawSoldier(g, x - 13, y + 4, 0.95, 1, {
          coat: RED_COAT, pants: RED_PANTS, cap: RED_CAP, phase: 0,
          rifle: false, star: true
        });
        drawSoldier(g, x + 13, y + 5, 0.9, -1, {
          coat: RED_COAT, pants: RED_PANTS, cap: RED_CAP, phase: 1.4,
          rifle: false, star: true
        });
        drawMG(g, x, y - 16, t.aim, t.recoil);
      } else {
        drawWatchtower(g, x, y, t);
      }
    } else {
      if (t.level === 1) {
        drawSandbagRing(g, x, y, 26, 13, 7, 0.35);
        drawMortar(g, x, y - 16, t.aim, t.recoil, 1);
        drawSoldier(g, x - 15, y + 4, 0.9, 1, {
          coat: RED_COAT, pants: RED_PANTS, cap: RED_CAP, phase: 0.4,
          rifle: false, star: true
        });
        drawShellBox(g, x + 16, y + 4);
      } else if (t.level === 2) {
        drawSandbagRing(g, x, y, 29, 15, 9, 0.2);
        drawMortar(g, x, y - 14, t.aim, t.recoil, 2);
        drawSoldier(g, x - 16, y + 4, 0.92, 1, {
          coat: RED_COAT, pants: RED_PANTS, cap: RED_CAP, phase: 0.4,
          rifle: false, star: true
        });
        drawSoldier(g, x + 15, y + 6, 0.9, -1, {
          coat: RED_COAT, pants: RED_PANTS, cap: RED_CAP, phase: 2.4,
          rifle: false, star: true
        });
        drawShellBox(g, x + 18, y - 2);
      } else {
        drawFieldGun(g, x, y, t);
      }
    }

    // 等级点（地基下沿）
    for (var i = 0; i < 3; i++) {
      var px = x - 9 + i * 9;
      var py = y + 15;
      if (i < t.level) {
        g.fillStyle = '#ffd873';
        g.strokeStyle = 'rgba(64,44,16,0.8)';
      } else {
        g.fillStyle = 'rgba(60,48,30,0.35)';
        g.strokeStyle = 'rgba(60,44,22,0.35)';
      }
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px, py - 3.4);
      g.lineTo(px + 3, py);
      g.lineTo(px, py + 3.4);
      g.lineTo(px - 3, py);
      g.closePath();
      g.fill();
      g.stroke();
    }

    g.restore();
  }

  function drawRifleAim(g, x, y, aim, recoil, color) {
    var back = (recoil || 0) * 3;
    g.save();
    g.translate(x - Math.cos(aim) * back, y - Math.sin(aim) * back);
    g.rotate(aim);
    g.strokeStyle = color || '#3d3529';
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-7, 0);
    g.lineTo(15, 0);
    g.stroke();
    g.strokeStyle = '#9aa1a6';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(15, 0);
    g.lineTo(21, 0);
    g.stroke();
    g.restore();
  }

  function drawMG(g, x, y, aim, recoil) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = '#4a4034';
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(-9, 12); g.lineTo(0, 0);
    g.moveTo(9, 12); g.lineTo(0, 0);
    g.moveTo(0, 14); g.lineTo(0, 0);
    g.stroke();

    g.translate(0, -2);
    g.rotate(aim + Math.PI);
    var back = (recoil || 0) * 4;
    g.fillStyle = '#3a3f42';
    rrPath(g, -10 - back, -3.4, 26, 7, 2);
    g.fill();
    g.fillStyle = '#22262a';
    rrPath(g, -8 - back, -6.5, 9, 4, 1.5);
    g.fill();
    g.fillStyle = '#555d61';
    g.beginPath();
    g.arc(0, 0, 3.4, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawMortar(g, x, y, aim, recoil, lv) {
    g.save();
    g.translate(x, y);
    g.fillStyle = '#5b5a4c';
    g.beginPath();
    g.ellipse(0, 12, 15, 5, 0, 0, TAU);
    g.fill();

    g.rotate(aim);
    var back = (recoil || 0) * (lv === 2 ? 5 : 4);
    g.strokeStyle = '#4e5246';
    g.lineWidth = lv === 2 ? 9 : 8;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-8 - back, 0);
    g.lineTo(14 - back, 0);
    g.stroke();
    g.strokeStyle = '#71766a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-6 - back, -2);
    g.lineTo(10 - back, -2);
    g.stroke();
    g.restore();
  }

  function drawFieldGun(g, x, y, t) {
    drawSandbagRing(g, x, y, 31, 15, 6, 2.4);
    g.save();
    g.translate(x, y - 5);

    // 炮架尾撑
    g.strokeStyle = '#6b5233';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-6, 6);
    g.lineTo(-26, 22);
    g.moveTo(6, 6);
    g.lineTo(26, 22);
    g.stroke();

    // 轮子
    function wheel(wx) {
      g.fillStyle = '#3f3020';
      g.beginPath();
      g.arc(wx, 8, 12, 0, TAU);
      g.fill();
      g.fillStyle = '#9a7844';
      g.beginPath();
      g.arc(wx, 8, 5, 0, TAU);
      g.fill();
      g.strokeStyle = '#5b4526';
      g.lineWidth = 1.6;
      for (var k = 0; k < 6; k++) {
        var a = k * Math.PI / 3;
        g.beginPath();
        g.moveTo(wx + Math.cos(a) * 4, 8 + Math.sin(a) * 4);
        g.lineTo(wx + Math.cos(a) * 11, 8 + Math.sin(a) * 11);
        g.stroke();
      }
      g.strokeStyle = '#2f2416';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(wx, 8, 12, 0, TAU);
      g.stroke();
    }
    wheel(-16);
    wheel(16);

    // 炮盾
    g.fillStyle = '#88865f';
    g.beginPath();
    g.moveTo(-18, -4);
    g.lineTo(18, -4);
    g.lineTo(14, 12);
    g.lineTo(-14, 12);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(38,38,24,0.65)';
    g.lineWidth = 1.6;
    g.stroke();
    g.fillStyle = '#3c3c2c';
    rrPath(g, -2.5, -4, 5, 10, 2);
    g.fill();
    g.fillStyle = '#a5a37a';
    g.fillRect(-14, -2, 26, 2);

    // 炮管
    var back = (t.recoil || 0) * 8;
    g.save();
    g.rotate(t.aim);
    g.fillStyle = '#44463a';
    rrPath(g, -8 - back, -5.2, 38, 10.4, 4);
    g.fill();
    g.fillStyle = '#6c7160';
    rrPath(g, 24 - back, -4, 6, 8, 2);
    g.fill();
    g.fillStyle = 'rgba(255,240,190,0.16)';
    g.fillRect(-4 - back, -4, 24, 2);
    g.restore();

    g.restore();

    drawSoldier(g, x - 22, y + 14, 0.9, 1, {
      coat: RED_COAT, pants: RED_PANTS, cap: RED_CAP, phase: 0,
      rifle: false, star: true
    });
    drawSoldier(g, x + 23, y + 15, 0.88, -1, {
      coat: RED_COAT, pants: RED_PANTS, cap: RED_CAP, phase: 1.8,
      rifle: false, star: true
    });
  }

  function drawWatchtower(g, x, y, t) {
    g.save();
    // 四根柱
    g.strokeStyle = '#7a5630';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - 15, y + 4); g.lineTo(x - 11, y - 52);
    g.moveTo(x + 15, y + 4); g.lineTo(x + 11, y - 52);
    g.moveTo(x - 7, y + 2); g.lineTo(x - 6, y - 52);
    g.moveTo(x + 7, y + 2); g.lineTo(x + 6, y - 52);
    g.stroke();
    // 斜撑
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 13, y - 8); g.lineTo(x + 11, y - 34);
    g.moveTo(x + 13, y - 8); g.lineTo(x - 11, y - 34);
    g.stroke();

    // 平台
    g.fillStyle = '#9b7342';
    rrPath(g, x - 20, y - 60, 40, 10, 3);
    g.fill();
    g.strokeStyle = 'rgba(60,40,20,0.5)';
    g.lineWidth = 1.4;
    g.stroke();

    // 护栏
    g.strokeStyle = '#8a6436';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 19, y - 60);
    g.lineTo(x - 19, y - 72);
    g.moveTo(x + 19, y - 60);
    g.lineTo(x + 19, y - 72);
    g.moveTo(x - 19, y - 71);
    g.lineTo(x + 19, y - 71);
    g.stroke();

    // 顶棚
    g.fillStyle = '#6f5a35';
    g.beginPath();
    g.moveTo(x - 24, y - 74);
    g.quadraticCurveTo(x, y - 92, x + 24, y - 74);
    g.quadraticCurveTo(x, y - 82, x - 24, y - 74);
    g.closePath();
    g.fill();

    // 射手
    drawSoldier(g, x - 2, y - 58, 0.92, 1, {
      coat: RED_COAT, pants: RED_PANTS, cap: RED_CAP, phase: 0,
      rifle: false, star: true
    });
    drawRifleAim(g, x + 2, y - 84, t.aim, t.recoil, '#3d3529');

    // 旗
    drawFlag(g, x + 24, y - 58, 0.7, '#c8342a', true);
    g.restore();
  }

  function drawShellBox(g, x, y) {
    g.fillStyle = '#6f7a58';
    rrPath(g, x - 8, y - 8, 16, 12, 2);
    g.fill();
    g.strokeStyle = 'rgba(40,46,30,0.55)';
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = '#cbb26a';
    for (var i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(x - 4 + i * 4, y - 10, 1.6, 0, TAU);
      g.fill();
    }
  }

  /* ============================================================
   * 4. 特效
   * ============================================================ */

  function drawEffects(g) {
    var i, e;
    for (i = 0; i < S.fx.length; i++) {
      e = S.fx[i];
      var k = clamp(e.life / e.max, 0, 1);
      if (e.k === 'tracer') {
        g.strokeStyle = 'rgba(255,232,150,' + (k * 0.9).toFixed(2) + ')';
        g.lineWidth = 1.8;
        g.beginPath();
        g.moveTo(e.x1, e.y1);
        g.lineTo(e.x2, e.y2);
        g.stroke();
        g.fillStyle = 'rgba(255,255,220,' + (k * 0.9).toFixed(2) + ')';
        g.beginPath();
        g.arc(e.x2, e.y2, 2 + (1 - k) * 2, 0, TAU);
        g.fill();
      } else if (e.k === 'muzzle') {
        g.save();
        g.translate(e.x, e.y);
        g.rotate(e.ang);
        g.globalAlpha = k;
        g.fillStyle = '#ffe9a8';
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(9, -4);
        g.lineTo(15, 0);
        g.lineTo(9, 4);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(255,170,60,0.9)';
        g.beginPath();
        g.arc(2, 0, 3.4, 0, TAU);
        g.fill();
        g.restore();
      } else if (e.k === 'ring') {
        var r = lerp(e.r0, e.r1, 1 - k);
        g.strokeStyle = 'rgba(255,196,90,' + (k * 0.85).toFixed(2) + ')';
        g.lineWidth = 3 * k + 1;
        g.beginPath();
        g.arc(e.x, e.y, r, 0, TAU);
        g.stroke();
      } else if (e.k === 'boom') {
        var br = e.r * (0.45 + 0.55 * (1 - k));
        g.globalAlpha = k;
        g.fillStyle = 'rgba(255,214,120,0.9)';
        g.beginPath();
        g.arc(e.x, e.y, br * 0.55, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(248,140,50,0.75)';
        g.beginPath();
        g.arc(e.x, e.y, br * 0.8, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
      } else if (e.k === 'puff') {
        g.globalAlpha = k * 0.8;
        g.fillStyle = e.color || '#b9a98b';
        g.beginPath();
        g.arc(e.x, e.y, e.r * (0.5 + (1 - k) * 0.7), 0, TAU);
        g.fill();
        g.globalAlpha = 1;
      } else if (e.k === 'text') {
        g.globalAlpha = Math.min(1, k * 1.6);
        label(g, e.text, e.x, e.y, e.size || 14, e.color || '#ffe9a8', 'center', true);
        g.globalAlpha = 1;
      } else if (e.k === 'dust') {
        g.globalAlpha = k * 0.5;
        g.fillStyle = '#cbb083';
        g.beginPath();
        g.arc(e.x, e.y, e.r * (1.2 - k * 0.6), 0, TAU);
        g.fill();
        g.globalAlpha = 1;
      }
    }

    // 迫击炮弹
    for (i = 0; i < S.shells.length; i++) {
      var sh = S.shells[i];
      var kk = clamp(sh.t / sh.dur, 0, 1);
      var gx = lerp(sh.sx, sh.tx, kk);
      var gy = lerp(sh.sy, sh.ty, kk);
      var hgt = Math.sin(kk * Math.PI) * sh.arc;
      g.fillStyle = 'rgba(20,30,16,0.25)';
      g.beginPath();
      g.ellipse(gx, gy, 5, 2.2, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#3c3a30';
      g.beginPath();
      g.arc(gx, gy - hgt, 3.4, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(220,210,180,0.28)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(gx, gy - hgt);
      g.lineTo(gx - (sh.tx - sh.sx) * 0.02, gy - hgt + 6);
      g.stroke();
    }
  }

  /* ============================================================
   * 5. HUD 与浮层卡
   * ============================================================ */

  var HUD = {
    panel: { x: 16, y: 14, w: 318, h: 54 },
    btns: []
  };

  function panel(g, x, y, w, h, alpha) {
    g.fillStyle = 'rgba(24,30,26,' + (alpha == null ? 0.86 : alpha) + ')';
    rrPath(g, x, y, w, h, 12);
    g.fill();
    g.strokeStyle = 'rgba(238,214,160,0.45)';
    g.lineWidth = 1.6;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 1;
    rrPath(g, x + 1.5, y + 1.5, w - 3, h - 3, 10);
    g.stroke();
  }

  function heartPath(g, x, y, s) {
    g.beginPath();
    g.moveTo(x, y + s * 0.3);
    g.bezierCurveTo(x, y - s * 0.06, x - s * 0.5, y - s * 0.05, x - s * 0.5, y + s * 0.3);
    g.bezierCurveTo(x - s * 0.5, y + s * 0.62, x - s * 0.12, y + s * 0.8, x, y + s);
    g.bezierCurveTo(x + s * 0.12, y + s * 0.8, x + s * 0.5, y + s * 0.62, x + s * 0.5, y + s * 0.3);
    g.bezierCurveTo(x + s * 0.5, y - s * 0.05, x, y - s * 0.06, x, y + s * 0.3);
    g.closePath();
  }

  function drawCoin(g, x, y, r) {
    g.fillStyle = '#e0ab3a';
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.strokeStyle = '#96651c';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = '#f6d478';
    g.beginPath();
    g.arc(x - r * 0.2, y - r * 0.25, r * 0.55, 0, TAU);
    g.fill();
    g.fillStyle = '#a8741f';
    g.fillRect(x - r * 0.22, y - r * 0.22, r * 0.44, r * 0.44);
  }

  function drawHud(g) {
    var p = HUD.panel;
    panel(g, p.x, p.y, p.w, p.h, 0.84);

    // 心
    g.save();
    g.translate(40, 26);
    heartPath(g, 0, 0, 22);
    g.fillStyle = '#d94a3a';
    g.fill();
    g.strokeStyle = 'rgba(90,20,14,0.6)';
    g.lineWidth = 1.4;
    g.stroke();
    g.restore();
    label(g, String(Math.max(0, S.lives)), 60, 41, 21, '#ffe8c4', 'left', true);

    g.strokeStyle = 'rgba(238,214,160,0.25)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(104, 26);
    g.lineTo(104, 56);
    g.stroke();

    drawCoin(g, 126, 41, 11);
    label(g, String(S.coins), 144, 41, 21, '#ffe8c4', 'left', true);

    g.strokeStyle = 'rgba(238,214,160,0.25)';
    g.beginPath();
    g.moveTo(232, 26);
    g.lineTo(232, 56);
    g.stroke();

    // 波次旗
    g.strokeStyle = '#cbb083';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(248, 24);
    g.lineTo(248, 56);
    g.stroke();
    g.fillStyle = '#c8342a';
    g.beginPath();
    g.moveTo(249, 25);
    g.quadraticCurveTo(260, 22, 270, 27);
    g.quadraticCurveTo(262, 32, 270, 37);
    g.lineTo(249, 35);
    g.closePath();
    g.fill();

    var wn = Math.min(S.waveIndex + 1, WAVES.length);
    label(g, wn + '/' + WAVES.length, 280, 41, 19, '#ffe8c4', 'left', true);

    // 右上按钮
    HUD.btns = [];
    // 嵌在主程序里时，右上方要给「退出关卡」按钮留位置
    var bx = W - 62 - (isEmbedded() ? 132 : 0);
    var by = 14;
    var specs = [
      { id: 'mute', icon: 'sound' },
      { id: 'speed', icon: 'speed' },
      { id: 'pause', icon: 'pause' }
    ];
    for (var i = specs.length - 1; i >= 0; i--) {
      var b = { x: bx, y: by, w: 46, h: 46, id: specs[i].id };
      drawIconBtn(g, b, specs[i].icon);
      HUD.btns.push(b);
      bx -= 54;
    }
  }

  function drawIconBtn(g, b, icon) {
    g.fillStyle = S.hoverBtn === b.id ? 'rgba(58,70,52,0.95)' : 'rgba(24,30,26,0.84)';
    rrPath(g, b.x, b.y, b.w, b.h, 10);
    g.fill();
    g.strokeStyle = 'rgba(238,214,160,0.45)';
    g.lineWidth = 1.5;
    g.stroke();

    var cx = b.x + b.w / 2;
    var cy = b.y + b.h / 2;
    g.strokeStyle = '#e9d8ae';
    g.fillStyle = '#e9d8ae';
    g.lineWidth = 2.4;
    g.lineCap = 'round';

    if (icon === 'pause') {
      if (S.paused) {
        g.beginPath();
        g.moveTo(cx - 6, cy - 8);
        g.lineTo(cx + 8, cy);
        g.lineTo(cx - 6, cy + 8);
        g.closePath();
        g.fill();
      } else {
        g.fillRect(cx - 7, cy - 8, 4.5, 16);
        g.fillRect(cx + 2.5, cy - 8, 4.5, 16);
      }
    } else if (icon === 'speed') {
      var labelTxt = S.speed > 1 ? '2x' : '1x';
      label(g, labelTxt, cx, cy + 1, 17, S.speed > 1 ? '#ffd873' : '#e9d8ae', 'center', true);
    } else if (icon === 'sound') {
      g.beginPath();
      g.moveTo(cx - 9, cy - 4);
      g.lineTo(cx - 4, cy - 4);
      g.lineTo(cx + 2, cy - 9);
      g.lineTo(cx + 2, cy + 9);
      g.lineTo(cx - 4, cy + 4);
      g.lineTo(cx - 9, cy + 4);
      g.closePath();
      g.fill();
      if (S.muted) {
        g.strokeStyle = '#e07a62';
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(cx + 5, cy - 6);
        g.lineTo(cx + 13, cy + 6);
        g.moveTo(cx + 13, cy - 6);
        g.lineTo(cx + 5, cy + 6);
        g.stroke();
      } else {
        g.strokeStyle = '#e9d8ae';
        g.lineWidth = 1.8;
        g.beginPath();
        g.arc(cx + 4, cy, 7, -0.9, 0.9);
        g.stroke();
      }
    }
  }

  function drawPortrait(g) {
    var x = 16, y = H - 112, w = 96, h = 96;
    panel(g, x, y, w, h, 0.8);
    g.save();
    rrPath(g, x + 5, y + 5, w - 10, h - 10, 8);
    g.clip();

    var grd = g.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, '#8f3a2c');
    grd.addColorStop(1, '#5a241c');
    g.fillStyle = grd;
    g.fillRect(x, y, w, h);

    g.globalAlpha = 0.35;
    for (var i = 0; i < 5; i++) {
      g.fillStyle = '#f2d34c';
      starPath(g, x + 18 + i * 16, y + 22 + (i % 2) * 10, 5);
      g.fill();
    }
    g.globalAlpha = 1;

    drawSoldier(g, x + 48, y + 84, 1.35, 1, {
      coat: RED_COAT, pants: RED_PANTS, cap: RED_CAP, phase: 0,
      rifle: false, star: true, skin: '#f0cda4'
    });
    g.restore();

    label(g, '渡口守备队', x + w / 2, y + h - 9, 10, '#ffe6bb', 'center', true);
  }

  function drawWaveCall(g) {
    if (S.phase === 'prep' && S.started && !S.over) {
      var w = 214, h = 50;
      var x = W / 2 - w / 2, y = H - 72;
      var hover = S.hoverBtn === 'call';
      g.fillStyle = hover ? 'rgba(150,42,32,0.96)' : 'rgba(126,34,26,0.92)';
      rrPath(g, x, y, w, h, 12);
      g.fill();
      g.strokeStyle = 'rgba(255,214,150,0.75)';
      g.lineWidth = 2;
      g.stroke();

      label(g, '提前出战', x + 18, y + h / 2, 19, '#ffe9c2', 'left', true);
      label(g, '▶', x + 118, y + h / 2, 18, '#ffd873', 'center', true);
      label(g, '+' + EARLY_BONUS, x + w - 18, y + h / 2, 15, '#ffd873', 'right', true);
      label(g, '倒计时 ' + Math.ceil(Math.max(0, S.waveTimer)) + 's', x + w / 2, y - 12, 12, 'rgba(255,240,205,0.75)', 'center');

      S.hits.push({ x: x, y: y, w: w, h: h, action: { type: 'call' } });
    } else if (S.phase === 'wave' && !S.over) {
      var left = 0;
      for (var i = 0; i < S.spawnQueue.length; i++) left++;
      left += S.enemies.length;
      var txt = '第 ' + (S.waveIndex + 1) + ' 波 · 剩余 ' + left;
      g.font = '600 14px ' + FONT;
      var tw = g.measureText(txt).width + 34;
      g.fillStyle = 'rgba(24,30,26,0.8)';
      rrPath(g, W / 2 - tw / 2, 78, tw, 34, 17);
      g.fill();
      g.strokeStyle = 'rgba(238,214,160,0.35)';
      g.lineWidth = 1.4;
      g.stroke();
      label(g, txt, W / 2, 95, 14, '#ffe8c4', 'center', true);
    }
  }

  function cardRows() {
    if (!S.sel) return null;
    if (S.sel.tower) {
      var t = S.sel.tower;
      var def = TOWER_DEF[t.kind];
      var cur = def.rows[t.level - 1];
      var next = t.level < 3 ? def.rows[t.level] : null;
      var rows = [];
      rows.push({
        kind: 'upgrade',
        title: next ? ('升级为 ' + next.name) : '已升至最高',
        sub: next ? (t.kind === 'gun' ? ('伤害 ' + next.dmg + ' · 射速 ' + next.cd + 's') : ('伤害 ' + next.dmg + ' · 爆炸 ' + next.radius)) : '本级已满',
        cost: next ? next.cost : 0,
        disabled: !next || S.coins < next.cost
      });
      rows.push({
        kind: 'sell',
        title: '拆除工事',
        sub: '返还 ' + Math.floor(t.spent * 0.6) + ' 铜板',
        gain: Math.floor(t.spent * 0.6),
        disabled: false
      });
      return { rows: rows, title: cur.name + ' · Lv' + t.level, ref: t };
    }
    var p = S.sel.plot;
    return {
      title: '在此修建工事',
      rows: [
        {
          kind: 'build', key: 'gun', title: '枪手 · 步枪班', sub: '射速快 单体',
          cost: TOWER_DEF.gun.rows[0].cost, disabled: S.coins < TOWER_DEF.gun.rows[0].cost
        },
        {
          kind: 'build', key: 'cannon', title: '炮手 · 迫击炮', sub: '范围伤害 慢',
          cost: TOWER_DEF.cannon.rows[0].cost, disabled: S.coins < TOWER_DEF.cannon.rows[0].cost
        }
      ],
      ref: p
    };
  }

  function drawCards(g) {
    if (!S.sel) return;
    var info = cardRows();
    if (!info) return;

    var w = 232;
    var rowH = 50;
    var pad = 9;
    var headH = 22;
    var h = headH + info.rows.length * rowH + pad * 2;

    var ref = S.sel.tower || S.sel.plot;
    var x = ref.x + 42;
    var y = ref.y - h - 30;
    if (x + w > W - 12) x = ref.x - w - 42;
    if (y < 12) y = ref.y + 30;
    if (x < 12) x = 12;
    if (y + h > H - 12) y = H - h - 12;

    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = 14;
    g.shadowOffsetY = 4;
    panel(g, x, y, w, h, 0.94);
    g.restore();

    label(g, info.title, x + pad + 2, y + pad + 9, 12, '#d8cba9', 'left', true);

    for (var i = 0; i < info.rows.length; i++) {
      var r = info.rows[i];
      var ry = y + headH + pad + i * rowH;
      var rx = x + pad;
      var rw = w - pad * 2;

      g.fillStyle = S.hoverRow === i ? 'rgba(255,232,180,0.14)' : 'rgba(255,255,255,0.05)';
      rrPath(g, rx, ry, rw, rowH - 6, 8);
      g.fill();

      var cx = rx + 22;
      var cy = ry + (rowH - 6) / 2;
      var circleColor = r.kind === 'sell' ? '#8c5a3a' : (r.kind === 'build' && r.key === 'cannon' ? '#8a6034' : '#6a7a52');
      if (r.kind === 'upgrade') circleColor = '#5f7a48';
      if (r.kind === 'sell') circleColor = '#8a4a36';
      g.fillStyle = circleColor;
      g.beginPath();
      g.arc(cx, cy, 14, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(255,240,200,0.28)';
      g.lineWidth = 1.2;
      g.stroke();

      var glyph = '↑';
      if (r.kind === 'build') glyph = r.key === 'gun' ? '枪' : '炮';
      if (r.kind === 'sell') glyph = '¥';
      label(g, glyph, cx, cy + 1, 14, '#fdf2d6', 'center', true);

      var alpha = r.disabled ? 0.42 : 1;
      g.globalAlpha = alpha;
      label(g, r.title, rx + 44, ry + 16, 15, '#fff1d0', 'left', true);
      label(g, r.sub, rx + 44, ry + 34, 11, '#c9bda0', 'left');
      g.globalAlpha = 1;

      if (r.kind === 'sell') {
        label(g, '+' + r.gain, x + w - pad - 10, cy, 15, r.disabled ? '#8f8672' : '#ffd873', 'right', true);
      } else if (r.cost) {
        drawCoin(g, x + w - pad - 44, cy, 7);
        label(g, String(r.cost), x + w - pad - 10, cy, 15, r.disabled ? '#9a907c' : (S.coins >= r.cost ? '#ffe8b0' : '#b46a5a'), 'right', true);
      }

      S.hits.push({
        x: rx, y: ry, w: rw, h: rowH - 6,
        action: { type: r.kind, key: r.key, row: i }
      });
    }

    // 攻击范围预览
    var tower = S.sel.tower;
    var def = tower ? TOWER_DEF[tower.kind] : null;
    if (tower) {
      drawRange(g, tower.x, tower.y, def.rows[tower.level - 1].range, 'rgba(255,230,160,0.5)');
    }
  }

  function drawRange(g, x, y, r, color) {
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fillStyle = 'rgba(255,240,190,0.05)';
    g.fill();
    g.setLineDash([7, 7]);
    g.strokeStyle = color;
    g.lineWidth = 1.6;
    g.stroke();
    g.restore();
  }

  function drawBanner(g) {
    if (!S.banner) return;
    var k = S.banner.life / S.banner.max;
    var a = Math.min(1, k * 2.2);
    var rise = (1 - easeOut(Math.min(1, (1 - k) * 4))) * 10;
    g.globalAlpha = a;
    g.font = '700 40px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var ty = 154 + rise;
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(30,20,12,0.55)';
    g.strokeText(S.banner.text, W / 2, ty);
    g.fillStyle = '#ffe6b0';
    g.fillText(S.banner.text, W / 2, ty);
    g.font = '600 15px ' + FONT;
    g.fillStyle = 'rgba(255,232,190,0.85)';
    g.fillText(S.banner.sub || '', W / 2, ty + 34);
    g.globalAlpha = 1;
  }

  function drawTip(g) {
    if (!S.tip || S.tip.life <= 0 || S.banner || S.sel) return;
    var a = Math.min(1, S.tip.life / 1.2) * Math.min(1, (S.tip.max - S.tip.life) * 3);
    g.globalAlpha = clamp(a, 0, 1);
    g.font = '600 15px ' + FONT;
    var txt = '点击草地上的木牌 · 修建枪手或炮手';
    var tw = g.measureText(txt).width + 40;
    g.fillStyle = 'rgba(20,26,20,0.72)';
    rrPath(g, W / 2 - tw / 2, 82, tw, 34, 17);
    g.fill();
    label(g, txt, W / 2, 99, 15, '#ffeec8', 'center', true);
    g.globalAlpha = 1;
  }

  function drawPause(g) {
    if (!S.paused) return;
    g.fillStyle = 'rgba(10,16,10,0.62)';
    g.fillRect(0, 0, W, H);
    panel(g, W / 2 - 150, H / 2 - 80, 300, 160, 0.96);
    label(g, '暂停', W / 2, H / 2 - 38, 30, '#ffe8c0', 'center', true);
    label(g, '战场已冻结', W / 2, H / 2 - 4, 13, '#bdb19a', 'center');

    var bw = 176, bh = 46;
    var bx = W / 2 - bw / 2;
    var by = H / 2 + 18;
    g.fillStyle = S.hoverBtn === 'resume' ? 'rgba(150,42,32,0.96)' : 'rgba(126,34,26,0.94)';
    rrPath(g, bx, by, bw, bh, 10);
    g.fill();
    g.strokeStyle = 'rgba(255,214,150,0.7)';
    g.lineWidth = 1.8;
    g.stroke();
    label(g, '继续战斗', W / 2, by + bh / 2, 18, '#ffe9c2', 'center', true);
    S.hits.push({ x: bx, y: by, w: bw, h: bh, action: { type: 'resume' } });
  }

  function render() {
    if (!S || !S.g) return;
    var g = S.g;
    var scale = S.cv.width / W;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, W, H);

    var shake = S.shake > 0 ? S.shake : 0;
    if (shake > 0) {
      g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    if (MAP_CV) g.drawImage(MAP_CV, 0, 0, W, H);

    S.hits = [];

    // 选中塔的射程
    var i;
    if (S.sel && S.sel.tower) {
      var st = S.sel.tower;
      drawRange(g, st.x, st.y, TOWER_DEF[st.kind].rows[st.level - 1].range, 'rgba(255,230,160,0.55)');
    }
    if (S.hoverPlot && !S.hoverPlot.tower) {
      drawRange(g, S.hoverPlot.x, S.hoverPlot.y, TOWER_DEF.gun.rows[0].range, 'rgba(255,255,255,0.25)');
    }

    // 木牌 / 已建工事的地基
    for (i = 0; i < S.plots.length; i++) drawPlot(g, S.plots[i], i);

    // 塔 + 敌人按 y 排序
    var drawables = [];
    for (i = 0; i < S.towers.length; i++) drawables.push({ y: S.towers[i].y, kind: 't', o: S.towers[i] });
    for (i = 0; i < S.enemies.length; i++) drawables.push({ y: S.enemies[i].y, kind: 'e', o: S.enemies[i] });
    drawables.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < drawables.length; i++) {
      if (drawables[i].kind === 't') drawTower(g, drawables[i].o);
      else drawEnemy(g, drawables[i].o);
    }

    drawEffects(g);

    // 漏怪时屏幕边缘泛红
    if (S.flash > 0) {
      var rg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      rg.addColorStop(0, 'rgba(150,20,10,0)');
      rg.addColorStop(1, 'rgba(150,20,10,' + (S.flash * 0.5).toFixed(2) + ')');
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    }

    drawPortrait(g);
    drawWaveCall(g);
    drawHud(g);
    drawBanner(g);
    drawTip(g);
    drawCards(g);
    drawPause(g);

    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ============================================================
   * 6. 状态、音效、输入、循环
   * ============================================================ */

  var S = null;
  var HOST = {
    root: null, ctx: null, disposers: [], raf: 0, ro: null, last: 0, canvas: null,
    introEl: null, endEl: null, againBtn: null, exitBtn: null, doneTimer: 0
  };

  /* 新框架用 iframe 加载关卡：通关要 postMessage，返回面板发 cz:exit */
  function isEmbedded() {
    try { return !!(window.parent && window.parent !== window); }
    catch (e) { return false; }
  }

  function notifyHost(type) {
    if (!isEmbedded()) return false;
    try { window.parent.postMessage({ type: type }, '*'); return true; }
    catch (e) { return false; }
  }

  function postDone() {
    if (HOST.doneTimer) {
      clearTimeout(HOST.doneTimer);
      HOST.doneTimer = 0;
    }
    notifyHost('cz:done');
  }

  /* ---------- 极简合成音效：不引任何音频文件 ---------- */
  var SFX = {
    ac: null,
    muted: false,
    buf: null,
    ensure: function () {
      if (this.ac) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ac = new AC();
      } catch (e) { this.ac = null; }
    },
    noiseBuf: function () {
      if (this.buf || !this.ac) return this.buf;
      var len = Math.floor(this.ac.sampleRate * 0.5);
      var b = this.ac.createBuffer(1, len, this.ac.sampleRate);
      var d = b.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      this.buf = b;
      return b;
    },
    tone: function (f, dur, type, vol, to) {
      if (!this.ac || this.muted) return;
      try {
        var t0 = this.ac.currentTime;
        var o = this.ac.createOscillator();
        var g = this.ac.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(f, t0);
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(this.ac.destination);
        o.start(t0);
        o.stop(t0 + dur + 0.02);
      } catch (e) { /* 静默 */ }
    },
    burst: function (dur, vol, freq, type) {
      if (!this.ac || this.muted) return;
      try {
        var t0 = this.ac.currentTime;
        var src = this.ac.createBufferSource();
        src.buffer = this.noiseBuf();
        var f = this.ac.createBiquadFilter();
        f.type = type || 'lowpass';
        f.frequency.value = freq || 900;
        var g = this.ac.createGain();
        g.gain.setValueAtTime(vol || 0.08, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f);
        f.connect(g);
        g.connect(this.ac.destination);
        src.start(t0);
        src.stop(t0 + dur);
      } catch (e) { /* 静默 */ }
    },
    gun: function () { this.burst(0.09, 0.05, 1800, 'bandpass'); },
    cannon: function () { this.burst(0.34, 0.12, 420); this.tone(80, 0.22, 'sine', 0.09, 40); },
    boom: function () { this.burst(0.5, 0.10, 320); },
    coin: function () { this.tone(1180, 0.07, 'triangle', 0.035, 1560); },
    build: function () { this.tone(420, 0.09, 'square', 0.04, 620); this.burst(0.12, 0.05, 700); },
    upgrade: function () { this.tone(660, 0.1, 'triangle', 0.05, 990); },
    sell: function () { this.tone(520, 0.1, 'square', 0.04, 260); },
    leak: function () { this.tone(240, 0.35, 'sawtooth', 0.07, 110); },
    horn: function () { this.tone(196, 0.5, 'sawtooth', 0.04, 174); this.tone(294, 0.45, 'sine', 0.03, 262); },
    win: function () {
      var self = this;
      [523, 659, 784, 1046].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 0.22, 'triangle', 0.06); }, i * 140);
      });
    },
    lose: function () {
      var self = this;
      [392, 330, 262, 196].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 0.3, 'triangle', 0.06); }, i * 180);
      });
    }
  };

  /* ---------- 波次生成 ---------- */
  function buildSpawn(wave) {
    var list = [];
    var cursor = 0;
    for (var i = 0; i < wave.groups.length; i++) {
      var gr = wave.groups[i];
      var start = Math.max(cursor, gr.delay || 0);
      for (var j = 0; j < gr.n; j++) {
        list.push({ t: start + j * gr.gap, type: gr.type });
      }
      cursor = start + gr.n * gr.gap;
    }
    list.sort(function (a, b) { return a.t - b.t; });
    return list;
  }

  /* ---------- 状态 ---------- */
  function newState(canvas, g) {
    return {
      cv: canvas,
      g: g,
      coins: START_COINS,
      lives: START_LIVES,
      waveIndex: 0,
      phase: 'prep',
      waveTimer: PREP_FIRST,
      waveTime: 0,
      spawnQueue: [],
      time: 0,
      speed: 1,
      paused: false,
      started: false,
      over: null,
      towers: [],
      enemies: [],
      shells: [],
      fx: [],
      hits: [],
      sel: null,
      hoverPlot: null,
      hoverBtn: null,
      hoverRow: -1,
      shake: 0,
      flash: 0,
      kills: 0,
      leaked: 0,
      built: 0,
      banner: null,
      tip: null,
      muted: false,
      plots: PLOTS.map(function (p) { return { x: p.x, y: p.y, tower: null }; })
    };
  }

  /* ---------- 小反馈 ---------- */
  function addFx(e) {
    e.life = e.life || 0.4;
    e.max = e.life;
    S.fx.push(e);
  }
  function popText(x, y, text, color, size) {
    addFx({ k: 'text', x: x, y: y, text: text, color: color || '#ffe9a8', size: size || 14, life: 1.1 });
  }
  function dust(x, y, r, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU;
      var sp = 12 + Math.random() * 32;
      addFx({
        k: 'puff', x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 4,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 8,
        r: r * (0.4 + Math.random() * 0.6), life: 0.5 + Math.random() * 0.4,
        color: 'rgba(198,176,132,0.9)'
      });
    }
  }

  /* ---------- 塔：建 / 升 / 拆 ---------- */
  function buildAt(plot, kind) {
    var def = TOWER_DEF[kind];
    var cost = def.rows[0].cost;
    if (!plot || plot.tower || S.coins < cost) return false;
    S.coins -= cost;
    var t = {
      kind: kind, level: 1, x: plot.x, y: plot.y,
      aim: -1.2, cd: 0.2, recoil: 0, flash: 0, spent: cost
    };
    plot.tower = t;
    S.towers.push(t);
    S.built++;
    S.sel = { plot: plot, tower: t };
    S.tip = null;
    dust(plot.x, plot.y, 22, 8);
    popText(plot.x, plot.y - 46, '-' + cost, '#ffcf7a', 13);
    SFX.build();
    return t;
  }

  function upgradeTower(t) {
    var def = TOWER_DEF[t.kind];
    if (t.level >= 3) return false;
    var cost = def.rows[t.level].cost;
    if (S.coins < cost) return false;
    S.coins -= cost;
    t.spent += cost;
    t.level++;
    t.flash = 0.25;
    popText(t.x, t.y - 56, '-' + cost, '#ffcf7a', 13);
    addFx({ k: 'ring', x: t.x, y: t.y - 12, r0: 8, r1: 40, life: 0.45 });
    SFX.upgrade();
    return true;
  }

  function sellTower(t) {
    var refund = Math.floor(t.spent * 0.6);
    S.coins += refund;
    for (var i = 0; i < S.plots.length; i++) {
      if (S.plots[i].tower === t) {
        S.plots[i].tower = null;
        S.sel = { plot: S.plots[i] };
        break;
      }
    }
    var idx = S.towers.indexOf(t);
    if (idx >= 0) S.towers.splice(idx, 1);
    popText(t.x, t.y - 50, '+' + refund, '#ffe28a', 14);
    dust(t.x, t.y, 18, 6);
    SFX.sell();
  }

  /* ---------- 敌人 ---------- */
  function spawnEnemy(type) {
    var d = ENEMY_DEF[type];
    var p = pathAt(0);
    S.enemies.push({
      type: type,
      hp: d.hp,
      maxHp: d.hp,
      speed: d.speed * (0.94 + Math.random() * 0.12),
      reward: d.reward,
      leak: d.leak,
      size: d.size,
      boss: !!d.boss,
      s: 0,
      x: p.x,
      y: p.y,
      ang: p.a,
      flash: 0,
      alive: true
    });
  }

  function damageEnemy(e, dmg) {
    if (!e.alive) return;
    e.hp -= dmg;
    e.flash = 0.1;
    if (e.hp <= 0) {
      e.alive = false;
      e.hp = 0;
      S.coins += e.reward;
      S.kills++;
      popText(e.x, e.y - 44 * e.size, '+' + e.reward, '#ffe28a', 13);
      for (var i = 0; i < 6; i++) {
        var a = Math.random() * TAU;
        addFx({
          k: 'puff', x: e.x + Math.cos(a) * 6, y: e.y - 14 + Math.sin(a) * 6,
          vx: Math.cos(a) * 26, vy: -18 - Math.random() * 26,
          r: 4 + Math.random() * 5, life: 0.45 + Math.random() * 0.3,
          color: 'rgba(214,206,184,0.85)'
        });
      }
      if (e.boss) {
        S.shake = 6;
        addFx({ k: 'boom', x: e.x, y: e.y - 20, r: 40, life: 0.5 });
      }
      SFX.coin();
    }
  }

  function leakEnemy(e) {
    e.alive = false;
    S.lives -= e.leak;
    S.leaked += e.leak;
    S.shake = 7;
    S.flash = 0.5;
    popText(BASE.x, BASE.y - 60, '-' + e.leak, '#ff8f70', 18);
    addFx({ k: 'ring', x: BASE.x, y: BASE.y - 16, r0: 14, r1: 70, life: 0.55 });
    SFX.leak();
    if (S.lives <= 0) {
      S.lives = 0;
      defeat();
    }
  }

  /* ---------- 塔开火 ---------- */
  function pickTarget(t) {
    var def = TOWER_DEF[t.kind].rows[t.level - 1];
    var best = null;
    var bestS = -1;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (!e.alive) continue;
      if (dist(t.x, t.y, e.x, e.y) > def.range) continue;
      if (e.s > bestS) { bestS = e.s; best = e; }
    }
    return best;
  }

  function angleTo(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  }

  function angleLerp(a, b, k) {
    var d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a + d * k;
  }

  function fire(t, e) {
    var def = TOWER_DEF[t.kind].rows[t.level - 1];
    var m = muzzleOf(t);
    t.recoil = 1;
    t.flash = 0.08;
    addFx({ k: 'muzzle', x: m.x, y: m.y - 26, ang: t.aim, life: 0.09 });

    if (t.kind === 'gun') {
      damageEnemy(e, def.dmg);
      addFx({
        k: 'tracer', x1: m.x, y1: m.y - 26,
        x2: e.x + (Math.random() - 0.5) * 6, y2: e.y - 20 * e.size,
        life: 0.1
      });
      SFX.gun();
    } else {
      var d = dist(m.x, m.y, e.x, e.y);
      S.shells.push({
        sx: m.x, sy: m.y - 24, x: m.x, y: m.y - 24,
        tx: e.x, ty: e.y,
        t: 0, dur: clamp(d / 420, 0.35, 0.9),
        arc: 30 + d * 0.16,
        dmg: def.dmg, radius: def.radius
      });
      SFX.cannon();
    }
  }

  function explode(shell) {
    var dmg = shell.dmg;
    var rad = shell.radius;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (!e.alive) continue;
      var d = dist(shell.tx, shell.ty, e.x, e.y - 10);
      if (d <= rad + 6) {
        var falloff = d <= rad * 0.4 ? 1 : lerp(1, 0.55, clamp((d - rad * 0.4) / (rad * 0.6), 0, 1));
        damageEnemy(e, dmg * falloff);
      }
    }
    addFx({ k: 'boom', x: shell.tx, y: shell.ty - 8, r: rad, life: 0.4 });
    addFx({ k: 'ring', x: shell.tx, y: shell.ty - 4, r0: rad * 0.3, r1: rad * 1.05, life: 0.5 });
    for (i = 0; i < 7; i++) {
      var a = Math.random() * TAU;
      addFx({
        k: 'puff', x: shell.tx + Math.cos(a) * 8, y: shell.ty + Math.sin(a) * 6,
        vx: Math.cos(a) * 40, vy: -20 - Math.random() * 30,
        r: 6 + Math.random() * 8, life: 0.6 + Math.random() * 0.5,
        color: 'rgba(150,140,120,0.8)'
      });
    }
    S.shake = Math.max(S.shake, 3);
    SFX.boom();
  }

  /* ---------- 更新 ---------- */
  function update(dt) {
    S.time += dt;
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 26);
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2);

    if (S.banner) {
      S.banner.life -= dt;
      if (S.banner.life <= 0) S.banner = null;
    }
    if (S.tip) {
      S.tip.life -= dt;
      if (S.tip.life <= 0) S.tip = null;
    }

    if (S.phase === 'prep') {
      S.waveTimer -= dt;
      if (S.waveTimer <= 0) startWave();
    } else if (S.phase === 'wave') {
      S.waveTime += dt;
      while (S.spawnQueue.length && S.spawnQueue[0].t <= S.waveTime) {
        spawnEnemy(S.spawnQueue.shift().type);
      }
    }

    // 敌人
    var i, e;
    for (i = 0; i < S.enemies.length; i++) {
      e = S.enemies[i];
      if (!e.alive) continue;
      e.s += e.speed * dt;
      var p = pathAt(e.s);
      e.x = p.x;
      e.y = p.y;
      e.ang = p.a;
      e.flash = Math.max(0, e.flash - dt);
      if (e.s >= PATH.len) leakEnemy(e);
    }

    // 塔
    for (i = 0; i < S.towers.length; i++) {
      var t = S.towers[i];
      var def = TOWER_DEF[t.kind].rows[t.level - 1];
      t.cd -= dt;
      t.recoil = Math.max(0, t.recoil - dt * 3.6);
      t.flash = Math.max(0, t.flash - dt);
      if (t.cd > 0) continue;
      var target = pickTarget(t);
      if (!target) continue;
      var want = angleTo(t.x, t.y - 26, target.x, target.y - 18 * target.size);
      t.aim = angleLerp(t.aim, want, Math.min(1, dt * 12));
      fire(t, target);
      t.cd = def.cd;
    }

    // 炮弹
    for (i = 0; i < S.shells.length; i++) {
      var sh = S.shells[i];
      sh.t += dt;
      var k = clamp(sh.t / sh.dur, 0, 1);
      sh.x = lerp(sh.sx, sh.tx, k);
      sh.y = lerp(sh.sy, sh.ty, k);
      if (k >= 1) {
        explode(sh);
        S.shells.splice(i, 1);
        i--;
      }
    }

    // 特效
    for (i = 0; i < S.fx.length; i++) {
      var f = S.fx[i];
      f.life -= dt;
      if (f.vx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 26 * dt; f.vx *= 0.94; }
      if (f.life <= 0) { S.fx.splice(i, 1); i--; }
    }

    // 清理尸体
    var alive = [];
    for (i = 0; i < S.enemies.length; i++) {
      if (S.enemies[i].alive) alive.push(S.enemies[i]);
    }
    S.enemies = alive;

    // 通关判定
    if (S.phase === 'wave' && !S.spawnQueue.length && !S.enemies.length) waveCleared();
  }

  function startWave() {
    if (S.over) return;
    S.phase = 'wave';
    S.waveTime = 0;
    S.waveTimer = 0;
    S.spawnQueue = buildSpawn(WAVES[S.waveIndex]);
    S.banner = {
      text: '第 ' + (S.waveIndex + 1) + ' 波 来袭',
      sub: '敌军扑向湘江渡口',
      life: 2.4, max: 2.4
    };
    SFX.horn();
  }

  function waveCleared() {
    S.coins += WAVE_BONUS;
    S.waveIndex++;
    if (S.waveIndex >= WAVES.length) {
      victory();
      return;
    }
    S.phase = 'prep';
    S.waveTimer = PREP_BETWEEN;
    S.banner = {
      text: '第 ' + S.waveIndex + ' 波 已击退',
      sub: '补给 +' + WAVE_BONUS + ' 铜板 · 下一波 ' + PREP_BETWEEN + ' 秒后',
      life: 2.6, max: 2.6
    };
  }

  function showEnd(win) {
    var el = HOST.endEl;
    if (!el) return;
    el.querySelector('.mt-end-kicker').textContent = '1934.11 · 湘江';
    el.querySelector('.mt-end-title').textContent = win ? '中央纵队已渡过湘江' : '渡口失守';
    el.querySelector('.mt-end-desc').textContent = win
      ? '你带着守备队顶住了敌军的一次次冲锋。浮桥还在，队伍继续向西。'
      : '敌军突破了江岸防线。调整部署，把炮手压在拐弯处，再守一次。';
    el.querySelector('.mt-end-stat').innerHTML =
      '守军剩余 <b>' + Math.max(0, S.lives) + '</b> · 击退敌军 <b>' + S.kills +
      '</b> · 剩余铜板 <b>' + S.coins + '</b>';
    el.classList.toggle('mt-win', win);
    el.classList.toggle('mt-lose', !win);
    el.classList.remove('mt-hide');

    // 嵌在主程序里：胜利后主按钮负责“返回选关”，另一个按钮留着再战
    var embed = isEmbedded();
    if (HOST.againBtn) {
      HOST.againBtn.textContent = (win && embed) ? '返回选关' : '再战一次';
    }
    if (HOST.exitBtn) {
      HOST.exitBtn.classList.toggle('mt-hide', !embed);
      HOST.exitBtn.textContent = win ? '再战一次' : '退出关卡';
    }
  }

  function victory() {
    if (S.over) return;
    S.over = 'win';
    S.lives = Math.max(0, S.lives);
    showEnd(true);
    SFX.win();
    var score = S.kills * 10 + S.coins + S.lives * 20;
    if (HOST.ctx && typeof HOST.ctx.finish === 'function') {
      try { HOST.ctx.finish(score); } catch (e) { /* 引擎未就绪 */ }
    }

    /* 新框架：让玩家看一眼战果，再把 cz:done 发给主程序。
       主按钮可以立刻返回，等不及的也可以直接点。 */
    if (isEmbedded()) {
      if (HOST.doneTimer) clearTimeout(HOST.doneTimer);
      HOST.doneTimer = setTimeout(postDone, 3200);
    }
  }

  function defeat() {
    if (S.over) return;
    S.over = 'lose';
    showEnd(false);
    SFX.lose();
    if (HOST.ctx && typeof HOST.ctx.fail === 'function') {
      try { HOST.ctx.fail('渡口失守'); } catch (e) { /* 引擎未就绪 */ }
    }
  }

  function startRun() {
    if (!S) return;
    SFX.ensure();
    S.started = true;
    S.phase = 'prep';
    S.waveTimer = PREP_FIRST;
    S.tip = { life: 9, max: 9 };
    S.banner = { text: '守住渡口', sub: '掩护中央纵队过江', life: 2.2, max: 2.2 };
    if (HOST.introEl) HOST.introEl.classList.add('mt-hide');
    if (HOST.endEl) HOST.endEl.classList.add('mt-hide');
    if (HOST.canvas && HOST.canvas.focus) HOST.canvas.focus();
  }

  function resetRun() {
    if (!S) return;
    if (HOST.doneTimer) { clearTimeout(HOST.doneTimer); HOST.doneTimer = 0; }
    var cv = S.cv;
    var g = S.g;
    S = newState(cv, g);
    SFX.muted = false;
    if (HOST.endEl) HOST.endEl.classList.add('mt-hide');
  }

  /* ---------- 坐标与输入 ---------- */
  function pointOf(ev) {
    var r = HOST.canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * W / r.width,
      y: (ev.clientY - r.top) * H / r.height
    };
  }

  function hitRect(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  function plotAt(p) {
    var best = null;
    var bestD = 46;
    for (var i = 0; i < S.plots.length; i++) {
      var d = dist(p.x, p.y, S.plots[i].x, S.plots[i].y);
      if (d < bestD) { bestD = d; best = S.plots[i]; }
    }
    return best;
  }

  function refreshHover(p) {
    S.hoverBtn = null;
    S.hoverRow = -1;

    for (var i = 0; i < HUD.btns.length; i++) {
      if (hitRect(p, HUD.btns[i])) S.hoverBtn = HUD.btns[i].id;
    }
    if (!S.hoverBtn) {
      for (i = 0; i < S.hits.length; i++) {
        var h = S.hits[i];
        if (!hitRect(p, h)) continue;
        if (h.action.type === 'build' || h.action.type === 'upgrade' || h.action.type === 'sell') {
          S.hoverRow = h.action.row;
        } else if (h.action.type === 'call') S.hoverBtn = 'call';
        else if (h.action.type === 'resume') S.hoverBtn = 'resume';
      }
    }

    var plot = plotAt(p);
    S.hoverPlot = plot;
    var interactive = !!plot || !!S.hoverBtn || S.hoverRow >= 0;
    if (HOST.canvas) HOST.canvas.style.cursor = interactive ? 'pointer' : 'default';
  }

  function doAction(a) {
    if (!a) return;
    if (a.type === 'build') {
      if (S.sel && S.sel.plot) buildAt(S.sel.plot, a.key);
    } else if (a.type === 'upgrade') {
      if (S.sel && S.sel.tower) upgradeTower(S.sel.tower);
    } else if (a.type === 'sell') {
      if (S.sel && S.sel.tower) sellTower(S.sel.tower);
    } else if (a.type === 'call') {
      if (S.phase === 'prep' && !S.over) {
        S.coins += EARLY_BONUS;
        popText(W / 2, H - 92, '+' + EARLY_BONUS, '#ffe28a', 15);
        startWave();
      }
    } else if (a.type === 'resume') {
      S.paused = false;
    }
  }

  function onPointerMove(ev) {
    if (!S) return;
    var p = pointOf(ev);
    refreshHover(p);
  }

  function onPointerDown(ev) {
    if (!S) return;
    ev.preventDefault();
    tapAt(pointOf(ev));
  }

  function tapAt(p) {
    if (!S) return;
    SFX.ensure();

    // 右上三个按钮
    for (var i = 0; i < HUD.btns.length; i++) {
      if (!hitRect(p, HUD.btns[i])) continue;
      var id = HUD.btns[i].id;
      if (id === 'pause') S.paused = !S.paused;
      if (id === 'speed') S.speed = S.speed > 1 ? 1 : 2;
      if (id === 'mute') { S.muted = !S.muted; SFX.muted = S.muted; }
      return;
    }

    if (S.paused) {
      for (i = S.hits.length - 1; i >= 0; i--) {
        if (S.hits[i].action.type === 'resume' && hitRect(p, S.hits[i])) {
          S.paused = false;
          return;
        }
      }
      return;
    }

    // 卡片 / 出战按钮
    for (i = S.hits.length - 1; i >= 0; i--) {
      var h = S.hits[i];
      if (hitRect(p, h)) {
        doAction(h.action);
        return;
      }
    }

    var plot = plotAt(p);
    if (plot) {
      if (plot.tower) S.sel = { plot: plot, tower: plot.tower };
      else S.sel = { plot: plot };
      return;
    }
    S.sel = null;
  }

  function onKeyDown(ev) {
    if (!S) return;
    if (ev.key === ' ' || ev.key === 'Escape') {
      ev.preventDefault();
      S.paused = !S.paused;
    }
  }

  /* ---------- 尺寸 ---------- */
  function fitCanvas() {
    if (!S || !HOST.canvas) return;
    var rect = HOST.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.round(rect.width * dpr);
    var ch = Math.round(rect.height * dpr);
    if (HOST.canvas.width !== cw || HOST.canvas.height !== ch) {
      HOST.canvas.width = cw;
      HOST.canvas.height = ch;
    }
  }

  /* ---------- 主循环 ---------- */
  function tick(ts) {
    HOST.raf = requestAnimationFrame(tick);
    if (!S) return;
    var dt = HOST.last ? (ts - HOST.last) / 1000 : 0;
    HOST.last = ts;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.05);

    fitCanvas();

    if (S.started && !S.paused && !S.over) {
      update(dt * S.speed);
    } else if (S.started && !S.over) {
      if (S.tip) {
        S.tip.life -= dt;
        if (S.tip.life <= 0) S.tip = null;
      }
    }

    render();
  }

  /* ---------- 绑定 ---------- */
  function bind(el, ev, fn, opts) {
    if (!el) return;
    el.addEventListener(ev, fn, opts);
    HOST.disposers.push(function () { el.removeEventListener(ev, fn, opts); });
  }

  function buildMarkup() {
    return [
      '<div class="mt-stage">',
      '  <canvas class="mt-canvas" tabindex="0" aria-label="湘江战役渡口阻击战场"></canvas>',
      '  <div class="mt-overlay mt-intro">',
      '    <div class="mt-card">',
      '      <p class="mt-kicker">1934.11 · 湘江</p>',
      '      <h2 class="mt-title">湘江战役 · 渡口阻击战</h2>',
      '      <p class="mt-desc">中央红军抵达湘江，两岸都是重兵。渡口是唯一的生路——用枪手和炮手守住江岸，掩护中央纵队全部过江。</p>',
      '      <ul class="mt-tips">',
      '        <li>点击草地上的木牌，修建<strong>枪手</strong>或<strong>炮手</strong></li>',
      '        <li>枪手射速快、专打单个；炮手伤害高、炸一片</li>',
      '        <li>放敌人抵达渡口会损失守军，守军归零即失守</li>',
      '      </ul>',
      '      <button class="mt-btn mt-start" type="button">开赴阵地</button>',
      '    </div>',
      '  </div>',
      '  <div class="mt-overlay mt-end mt-hide">',
      '    <div class="mt-card">',
      '      <p class="mt-kicker mt-end-kicker">1934.11 · 湘江</p>',
      '      <h2 class="mt-title mt-end-title"></h2>',
      '      <p class="mt-desc mt-end-desc"></p>',
      '      <p class="mt-end-stat"></p>',
      '      <p class="mt-note">湘江一役，中央红军从 8.6 万余人锐减到 3 万余人。</p>',
      '      <div class="mt-actions">',
      '        <button class="mt-btn mt-again" type="button">再战一次</button>',
      '        <button class="mt-btn mt-btn-ghost mt-exit mt-hide" type="button">返回选关</button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function mount(root, ctx) {
    if (!root) return;
    if (S) unmount();

    HOST.root = root;
    HOST.ctx = ctx || null;
    HOST.disposers = [];

    root.classList.add('mt-root');
    root.innerHTML = buildMarkup();

    var canvas = root.querySelector('.mt-canvas');
    var intro = root.querySelector('.mt-intro');
    var end = root.querySelector('.mt-end');
    var startBtn = root.querySelector('.mt-start');
    var againBtn = root.querySelector('.mt-again');
    var exitBtn = root.querySelector('.mt-exit');

    HOST.canvas = canvas;
    HOST.introEl = intro;
    HOST.endEl = end;
    HOST.againBtn = againBtn;
    HOST.exitBtn = exitBtn;

    var g = canvas.getContext('2d');
    if (!MAP_CV) MAP_CV = paintMap();

    S = newState(canvas, g);
    SFX.muted = false;

    bind(canvas, 'pointermove', onPointerMove);
    bind(canvas, 'pointerdown', onPointerDown);
    bind(canvas, 'pointerleave', function () {
      if (!S) return;
      S.hoverPlot = null;
      S.hoverBtn = null;
      S.hoverRow = -1;
    });
    bind(canvas, 'keydown', onKeyDown);
    bind(window, 'resize', fitCanvas);
    bind(startBtn, 'click', startRun);
    bind(againBtn, 'click', function () {
      if (S && S.over === 'win' && isEmbedded()) {
        postDone();
        return;
      }
      resetRun();
      startRun();
    });
    bind(exitBtn, 'click', function () {
      if (S && S.over === 'win') {
        resetRun();
        startRun();
        return;
      }
      notifyHost('cz:exit');
    });

    if (typeof ResizeObserver === 'function') {
      HOST.ro = new ResizeObserver(function () { fitCanvas(); });
      HOST.ro.observe(root);
    }

    fitCanvas();
    HOST.last = 0;
    HOST.raf = requestAnimationFrame(tick);
    render();
  }

  function unmount() {
    if (HOST.raf) cancelAnimationFrame(HOST.raf);
    HOST.raf = 0;
    if (HOST.doneTimer) { clearTimeout(HOST.doneTimer); HOST.doneTimer = 0; }
    if (HOST.ro) { HOST.ro.disconnect(); HOST.ro = null; }
    for (var i = 0; i < HOST.disposers.length; i++) {
      try { HOST.disposers[i](); } catch (e) { /* 忽略 */ }
    }
    HOST.disposers = [];
    if (HOST.root) HOST.root.classList.remove('mt-root');
    HOST.root = null;
    HOST.ctx = null;
    HOST.canvas = null;
    HOST.introEl = null;
    HOST.endEl = null;
    HOST.againBtn = null;
    HOST.exitBtn = null;
    S = null;
  }

  /* ---------- 注册 ---------- */
  var registered = false;

  function register() {
    if (registered) return;
    if (window.CZ && typeof window.CZ.register === 'function') {
      registered = true;
      window.CZ.register({
        id: 'mt',
        mount: mount,
        unmount: unmount
      });
    }
  }

  register();

  // 万一 cz.js 比 level.js 晚一步加载，等 DOM 就绪再补一次注册
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register);
  }

  /* 新框架（iframe 版）：index.html 里只放一个 #stage，
     本文件自己挂上去；单独双击 index.html 也能直接玩。 */
  function autoMount() {
    var stage = document.getElementById('stage');
    if (!stage || stage.dataset.mounted) return;
    stage.dataset.mounted = '1';
    mount(stage, null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  window.LEVEL = { mount: mount, unmount: unmount };

  // 本地预览 / 调试入口；正式引擎走 CZ.register，这里不参与流程
  window.MT = window.MT || {};
  window.MT.mount = mount;
  window.MT.unmount = unmount;
  window.MT.register = register;
  window.MT.debug = {
    state: function () { return S; },
    def: function () { return TOWER_DEF; },
    summary: function () {
      if (!S) return null;
      return {
        wave: S.waveIndex, phase: S.phase, lives: S.lives, coins: S.coins,
        kills: S.kills, leaked: S.leaked, towers: S.towers.length,
        enemies: S.enemies.length, over: S.over
      };
    },
    start: startRun,
    tap: function (x, y) { tapAt({ x: x, y: y }); },
    render: render,
    build: function (kind, idx) {
      if (!S || !S.plots[idx]) return false;
      return !!buildAt(S.plots[idx], kind);
    },
    upgrade: function (idx) {
      if (!S || !S.plots[idx] || !S.plots[idx].tower) return false;
      return upgradeTower(S.plots[idx].tower);
    },
    coins: function (n) { if (S) S.coins = n; },
    clear: function () { if (S) S.sel = null; },
    select: function (idx) {
      if (!S || !S.plots[idx]) return;
      var p = S.plots[idx];
      S.sel = p.tower ? { plot: p, tower: p.tower } : { plot: p };
    },
    wave: function (n) {
      if (!S) return;
      S.waveIndex = clamp(n - 1, 0, WAVES.length - 1);
      S.phase = 'prep';
      S.waveTimer = 0.4;
    },
    call: function () { if (S && S.phase === 'prep') startWave(); },
    fastForward: function (sec) {
      if (!S) return;
      var steps = Math.round((sec || 1) * 60);
      for (var i = 0; i < steps; i++) {
        if (!S || S.over) break;
        update(1 / 60);
      }
    },
    win: function () { if (S) victory(); },
    lose: function () { if (S) defeat(); }
  };

})();
