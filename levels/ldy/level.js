/* ============================================================
   第21关《星火相传》· 最终章 —— 关卡逻辑 v6
   ------------------------------------------------------------
   v6 打磨：修复五星红旗（此前 SVG.flag 缺失）、补旗杆与风声、
     进八门前的呼吸引导黑场、八件「记忆信物」收集面板、
     关门时的旧胶片抖动+快门、留言关键词史料回声、留言化星光
   接入契约：CZ.register({ id:'ldy', mount, unmount })，ctx.finish(score)
   ============================================================ */
(function (global) {
  'use strict';

  var ID = 'ldy';

  /* ============ 八门数据（严格对应游戏 8 站，会宁会师收尾） ============ */
  var DOORS = [
    { num: '86,000 → 30,000', name: '血战湘江', press: true, relic: '弹壳',
      text: '1934年11月底，湘江血战五昼夜，撕开封锁线。长按数字，直面这场减员。' },
    { num: '转折', name: '遵义会议', relic: '钢笔',
      text: '1935年1月，遵义会议在危急关头挽救了党、挽救了红军、挽救了中国革命。' },
    { num: '3万 : 40万', name: '四渡赤水', game: 'cross', relic: '竹筏',
      text: '三万红军四渡赤水，声东击西，跳出四十万敌军的围追堵截。' },
    { num: '7 只小船', name: '巧渡金沙江', relic: '船桨',
      text: '7只小船、37名船工、九天九夜，两万余人马渡过金沙江，未损一兵一卒。' },
    { num: '22 勇士', name: '飞夺泸定桥', game: 'bridge', relic: '铁索',
      text: '昼夜兼程240里，22名勇士攀着13根铁索夺下泸定桥。铁索之上，是滚烫的信仰。' },
    { num: '4,000+ 米', name: '翻越夹金山', relic: '草鞋',
      text: '海拔四千余米，风雪交加。衣着单薄的官兵手拉着手，把雪山踩在了脚下。' },
    { num: '7 天 7 夜', name: '走出草地', game: 'grass', relic: '皮带',
      text: '松潘草地六百里沼泽，以野菜充饥、以皮带果腹，七天七夜走出绝境。' },
    { num: '1936.10', name: '会宁会师', relic: '军号',
      text: '1936年10月，三大主力会宁会师，长征胜利结束。他们用两年，走完了一条信仰之路。' }
  ];

  /* 留言彩蛋：输入里出现这些词，会额外浮现一句史料回声 */
  var ECHOES = [
    { keys: ['信仰', '理想', '信念'], say: '“我们是幸存者，也是播种机。” —— 长征路上，宣传员把标语写在门板上、石壁上，走到哪里，火种就落在哪里。' },
    { keys: ['青春', '少年', '年轻'], say: '长征队伍里，指挥员平均年龄不足 25 岁，14 至 18 岁的战士占到四成。撕开黑夜的，是一群年轻人。' },
    { keys: ['向前', '前进', '坚持'], say: '“红军不怕远征难，万水千山只等闲。” —— 毛泽东《七律·长征》，1935 年 10 月。' },
    { keys: ['人民', '百姓', '群众'], say: '“长征是历史纪录上的第一次，长征是宣言书，长征是宣传队，长征是播种机。” —— 毛泽东，1935 年 12 月。' },
    { keys: ['传承', '接力', '我们'], say: '“每一代人有每一代人的长征，每一代人都要走好自己的长征路。”' },
    { keys: ['山河', '祖国', '中国'], say: '两万五千里，途经 14 个省，翻越 20 余座大山，渡过 30 多条河流。山河为证。' }
  ];

  var GAME_TIPS = {
    xiangjiang: '按住数字，看他们一个一个离开',
    cross:  '敌军在江边巡逻——趁它走远，点渡口过江（共四次）',
    bridge: '狂点「行军」冲向泸定桥！出现金色铁索时立刻抓住',
    grass:  '点相邻格子前进，深色的是沼泽，把火种送到队尾'
  };

  var CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八'];
  var FOOT = '据《红军长征史》《中国共产党简史》等整理';

  var PRESS_FROM = 86000, PRESS_TO = 30000;   /* 湘江：出发与幸存人数 */

  var INTRO_LINES = [
    '前20关的征途，你已走过千山万水。',
    '但第21关的胜利，并不是这段历史的终点。',
    '现在，请调暗房间的灯光，静下心来。',
    '最后一段路，没有胜负，只有回望。',
    '点亮那颗星星，去见见那些最可爱的人吧。'
  ];

  var SPIRIT_LINES = {
    door:   '跟我来，第一扇门亮了',
    doorN:  '下一扇门在等你',
    last:   '最后一扇门了……',
    allDone:'八扇门都关上了。现在——把火种交出去吧。',
    relay:  '按住火种，拖到少年手心',
    draw:   '跟着亮光，画一颗星送给他们'
  };

  var CREDITS = [
    '历史书太小，装不下一个人的伟大一生；',
    '历史书又太大，装下了他们所有人的牺牲。',
    '',
    '每一代人有每一代人的长征，',
    '每一代人都要走好自己的长征路。',
    '',
    '—— 星火相传，吾辈自强 ——',
    { small: '佛山大学易班技术部 · 长征：拾光 · 最终章' }
  ];

  /* ============ SVG 素材（原创代码绘制） ============ */
  /* 生成五角星顶点（rot=0 时尖角朝上；用于国旗上四颗小星各指向大星） */
  function starPoly(cx, cy, R, rot) {
    var pts = [];
    for (var k = 0; k < 10; k++) {
      var ang = -Math.PI / 2 + (rot || 0) + k * Math.PI / 5;
      var rad = (k % 2 === 0) ? R : R * 0.382;
      pts.push((cx + rad * Math.cos(ang)).toFixed(2) + ',' + (cy + rad * Math.sin(ang)).toFixed(2));
    }
    return pts.join(' ');
  }

  /* 五星红旗（按 GB 12982 比例绘制：旗面 30×20，大星中心 (5,5) r=3，四小星 r=1） */
  var FLAG_SVG = (function () {
    var W = 300, H = 200, U = W / 30;   /* 1 个单位 = 10px */
    var bigC = [5 * U, 5 * U], bigR = 3 * U;
    var smalls = [[10, 2], [12, 4], [12, 7], [10, 9]];
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">' +
      '<defs><linearGradient id="ldyFlag" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#d8261a"/><stop offset="45%" stop-color="#cf1b12"/>' +
      '<stop offset="100%" stop-color="#b3120c"/></linearGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#ldyFlag)"/>';
    /* 布面褶影：几条极淡的竖向暗带，让旗不至于像一块色块 */
    for (var f = 0; f < 5; f++) {
      s += '<rect x="' + (18 + f * 58) + '" y="0" width="' + (10 + f * 3) + '" height="' + H +
           '" fill="#000" opacity="' + (0.05 + f * 0.008) + '"/>';
    }
    s += '<polygon points="' + starPoly(bigC[0], bigC[1], bigR, 0) + '" fill="#ffde00"/>';
    smalls.forEach(function (p) {
      var cx = p[0] * U, cy = p[1] * U;
      var rot = Math.atan2(bigC[1] - cy, bigC[0] - cx) + Math.PI / 2;
      s += '<polygon points="' + starPoly(cx, cy, U, rot) + '" fill="#ffde00"/>';
    });
    return s + '</svg>';
  })();

  var SVG = {
    flag: FLAG_SVG,
    star4: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill="#ffe9a8"/></svg>',
    goldStar: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 1 L15 8.5 L23 9.3 L17 14.5 L18.8 22.4 L12 18.2 L5.2 22.4 L7 14.5 L1 9.3 L9 8.5 Z" fill="#ffd76e"/></svg>',
    spirit: '<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M22 4 C28 12 34 17 34 26 A12 12 0 0 1 10 26 C10 17 16 12 22 4 Z" fill="#ffb84a"/>' +
      '<path d="M22 14 C26 19 29 22 29 27 A7 7 0 0 1 15 27 C15 22 18 19 22 14 Z" fill="#ffe9a8"/>' +
      '<circle cx="18" cy="27" r="1.8" fill="#5a370f"/><circle cx="26" cy="27" r="1.8" fill="#5a370f"/>' +
      '</svg>',
    flame: '<svg viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M23 3 C30 12 38 18 38 29 A15 15 0 0 1 8 29 C8 18 16 12 23 3 Z" fill="#ff9a3a"/>' +
      '<path d="M23 14 C28 20 32 24 32 30 A9 9 0 0 1 14 30 C14 24 18 20 23 14 Z" fill="#ffe9a8"/>' +
      '</svg>',
    soldier: '<svg viewBox="0 0 220 420" xmlns="http://www.w3.org/2000/svg">' +
      '<g fill="#3f6b46">' +
      '<circle cx="110" cy="64" r="34"/>' +
      '<path d="M74 60 Q110 18 146 60 L146 50 Q110 10 74 50 Z" fill="#2e4f34"/>' +
      '<path d="M60 110 Q110 92 160 110 L172 250 Q110 268 48 250 Z"/>' +
      '<path d="M64 250 L78 400 L98 400 L96 258 Z"/>' +
      '<path d="M156 250 L142 400 L122 400 L124 258 Z"/>' +
      '<path d="M56 118 L30 220 L42 228 L70 140 Z"/>' +
      '<g class="soldier-arm"><path d="M164 118 L190 200 L176 210 L150 138 Z"/></g>' +
      '</g>' +
      '<rect x="66" y="120" width="88" height="8" rx="4" fill="#c9b06a"/>' +
      '</svg>',
    student: '<svg viewBox="0 0 220 420" xmlns="http://www.w3.org/2000/svg">' +
      '<g fill="#8c3130">' +
      '<circle cx="110" cy="70" r="32"/>' +
      '<path d="M78 112 L142 112 L168 260 Q110 278 52 260 Z"/>' +
      '<path d="M80 260 L92 406 L110 406 L110 268 Z"/>' +
      '<path d="M140 260 L128 406 L110 406 L110 268 Z"/>' +
      '</g>' +
      '<g class="student-arm" fill="#8c3130">' +
      '<path d="M142 122 L196 96 L200 110 L150 140 Z"/>' +
      '<circle cx="198" cy="100" r="11"/>' +
      '</g>' +
      '<path d="M92 138 L128 138 L128 148 L110 158 L92 148 Z" fill="#d8b64a"/>' +
      '</svg>'
  };

  /* 门内插画占位（后续替换真实历史照片：换成 '<img src="assets/xxx.jpg">'） */
  function doorArt(i) {
    var kinds = ['battle','meeting','river','boat','bridge','snow','grass','union'];
    var kind = kinds[i];
    var bg = '<rect width="640" height="260" fill="#0e0b07"/>';
    var ink = '#6e6248', moon = '#cbbd93';
    var map = {
      battle: '<path d="M0 220 L640 190 L640 260 L0 260 Z" fill="' + ink + '" opacity=".6"/><path d="M80 60 L120 200 M200 40 L240 180 M360 70 L400 200 M500 50 L540 170" stroke="' + moon + '" stroke-width="6" opacity=".65"/>',
      meeting:'<rect x="120" y="80" width="400" height="140" fill="none" stroke="' + moon + '" stroke-width="5" opacity=".8"/><rect x="200" y="140" width="240" height="18" rx="6" fill="' + ink + '"/>',
      river:  '<path d="M0 200 Q160 180 320 200 T640 200 L640 260 L0 260 Z" fill="' + ink + '" opacity=".5"/><circle cx="520" cy="60" r="26" fill="' + moon + '" opacity=".8"/>',
      boat:   '<path d="M0 210 L640 210 L640 260 L0 260 Z" fill="' + ink + '" opacity=".5"/><path d="M240 190 L400 190 L370 220 L270 220 Z" fill="' + moon + '" opacity=".85"/>',
      bridge: '<path d="M40 120 L600 120 M40 160 L600 160 M40 200 L600 200" stroke="' + moon + '" stroke-width="5" opacity=".8"/><path d="M40 110 L40 210 M600 110 L600 210" stroke="' + ink + '" stroke-width="12"/>',
      snow:   '<path d="M0 240 L180 120 L320 210 L460 100 L640 230 L640 260 L0 260 Z" fill="' + ink + '" opacity=".75"/>',
      grass:  '<path d="M0 200 Q80 170 160 200 T320 200 T480 200 T640 200 L640 260 L0 260 Z" fill="' + ink + '" opacity=".6"/><circle cx="540" cy="70" r="18" fill="' + moon + '" opacity=".7"/>',
      union:  '<path d="M60 230 Q200 120 320 150 M580 230 Q440 120 320 150" stroke="' + moon + '" stroke-width="6" fill="none" opacity=".8"/><path d="M320 150 L320 90" stroke="' + moon + '" stroke-width="5"/><path d="M320 90 L356 100 L320 112 Z" fill="#b04a3a"/>'
    };
    return '<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">' + bg + (map[kind] || map.river) + '</svg>';
  }

  /* ============ Web Audio：拟真打字机 / 音效 ============ */
  var audio = { ctx: null, noise: null };
  function audioInit() {
    if (audio.ctx) return;
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      var len = Math.floor(audio.ctx.sampleRate * 0.03);
      var buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      audio.noise = buf;
    } catch (e) { audio.ctx = null; }
  }
  function typeClick() {
    if (!audio.ctx || !audio.noise) return;
    try {
      var t = audio.ctx.currentTime;
      var src = audio.ctx.createBufferSource();
      src.buffer = audio.noise;
      var hp = audio.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800 + Math.random() * 900;
      var bp = audio.ctx.createBiquadFilter();
      bp.type = 'peaking';
      bp.frequency.value = 3200; bp.gain.value = 8;
      var g = audio.ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(audio.ctx.destination);
      src.start(t); src.stop(t + 0.04);
      var osc = audio.ctx.createOscillator();
      var g2 = audio.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, t);
      g2.gain.setValueAtTime(0.05, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(g2); g2.connect(audio.ctx.destination);
      osc.start(t); osc.stop(t + 0.07);
    } catch (e) {}
  }
  function typeReturn() {
    if (!audio.ctx) return;
    try {
      var t = audio.ctx.currentTime;
      var osc = audio.ctx.createOscillator();
      var g = audio.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1320, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.18);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(g); g.connect(audio.ctx.destination);
      osc.start(t); osc.stop(t + 0.22);
    } catch (e) {}
  }
  function chime() {
    if (!audio.ctx) return;
    try {
      var t = audio.ctx.currentTime;
      [523.25, 784].forEach(function (f, k) {
        var osc = audio.ctx.createOscillator();
        var g = audio.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + k * 0.09);
        g.gain.exponentialRampToValueAtTime(0.08, t + k * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + k * 0.09 + 0.9);
        osc.connect(g); g.connect(audio.ctx.destination);
        osc.start(t + k * 0.09); osc.stop(t + k * 0.09 + 1);
      });
    } catch (e) {}
  }
  function buzz() { /* 失败/被发现 */
    if (!audio.ctx) return;
    try {
      var t = audio.ctx.currentTime;
      var osc = audio.ctx.createOscillator();
      var g = audio.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(g); g.connect(audio.ctx.destination);
      osc.start(t); osc.stop(t + 0.26);
    } catch (e) {}
  }
  /* 心跳 / 沉重鼓点（湘江减员用） */
  function thump() {
    if (!audio.ctx) return;
    try {
      var t = audio.ctx.currentTime;
      var osc = audio.ctx.createOscillator();
      var g = audio.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(62, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.35);
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(g); g.connect(audio.ctx.destination);
      osc.start(t); osc.stop(t + 0.45);
    } catch (e) {}
  }

  /* 快门声：旧胶片过片的一记“咔哒” */
  function shutter() {
    if (!audio.ctx || !audio.noise) return;
    try {
      var t = audio.ctx.currentTime;
      var src = audio.ctx.createBufferSource();
      src.buffer = audio.noise;
      var bp = audio.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
      var g = audio.ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      src.connect(bp); bp.connect(g); g.connect(audio.ctx.destination);
      src.start(t); src.stop(t + 0.07);
      var os = audio.ctx.createOscillator();
      var g2 = audio.ctx.createGain();
      os.type = 'square';
      os.frequency.setValueAtTime(150, t);
      g2.gain.setValueAtTime(0.05, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      os.connect(g2); g2.connect(audio.ctx.destination);
      os.start(t); os.stop(t + 0.1);
    } catch (e) {}
  }

  /* 极轻的环境风（一直循环，音量压得很低，营造旷野感） */
  function windStart() {
    if (!audio.ctx || !audio.noise || audio.wind) return;
    try {
      var len = Math.floor(audio.ctx.sampleRate * 3);
      var buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      var d = buf.getChannelData(0), last = 0;
      for (var i = 0; i < len; i++) {           /* 低通后的噪声 = 风声 */
        last = last * 0.96 + (Math.random() * 2 - 1) * 0.04;
        d[i] = last * 6;
      }
      var src = audio.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      var lp = audio.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 520;
      var g = audio.ctx.createGain();
      g.gain.value = 0.035;
      src.connect(lp); lp.connect(g); g.connect(audio.ctx.destination);
      src.start();
      audio.wind = src;
    } catch (e) {}
  }
  function windStop() {
    if (!audio.wind) return;
    try { audio.wind.stop(); } catch (e) {}
    audio.wind = null;
  }

  /* ============ 工具 ============ */
  function el(tag, cls, html) {
    var d = global.document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ============ 关卡主体 ============ */
  function mount(root, ctx) {
    var timers = [];
    var live = true;

    function after(ms, fn) { timers.push(setTimeout(function () { if (live) fn(); }, ms)); }
    function every(ms, fn) {
      var h = setInterval(function () { if (live) fn(); }, ms);
      timers.push(h); return h;
    }
    function bind(node, ev, fn) {
      node.addEventListener(ev, fn);
      timers.push({ remove: function () { node.removeEventListener(ev, fn); } });
    }
    function clearOne(h) {
      if (typeof h === 'number') { clearTimeout(h); clearInterval(h); }
      else if (h && typeof h.remove === 'function') h.remove();
    }

    /* 旧胶片转场：全场抖一下 + 一道横向过片亮线 */
    function filmCut() {
      stage.classList.add('film-cut');
      after(460, function () { stage.classList.remove('film-cut'); });
    }

    var stage = el('div', 'ldy21');
    root.appendChild(stage);

    var sceneIntro  = el('div', 'abs hidden');
    var sceneDoors  = el('div', 'abs hidden');
    var sceneRelay  = el('div', 'abs hidden');
    stage.appendChild(sceneIntro);
    stage.appendChild(sceneDoors);
    stage.appendChild(sceneRelay);

    /* ============ 第一幕：星空 ============ */
    function buildIntro() {
      sceneIntro.className = 'abs starfield';
      /* 银河带 + 三层视差星空（纯代码，可动） */
      sceneIntro.appendChild(el('div', 'milkyway'));
      var counts = [70, 46, 26];
      counts.forEach(function (n, layer) {
        var ly = el('div', 'starlayer l' + (layer + 1));
        for (var i = 0; i < n; i++) {
          var s = el('div', 'star');
          var size = layer === 0 ? 1.4 : (layer === 1 ? 2 : 2.8);
          s.style.width = size + 'px';
          s.style.height = size + 'px';
          s.style.left = (Math.random() * 100) + '%';
          s.style.top  = (Math.random() * 100) + '%';
          s.style.animationDelay = (Math.random() * 4) + 's';
          s.style.opacity = (0.2 + Math.random() * 0.5).toFixed(2);
          ly.appendChild(s);
        }
        sceneIntro.appendChild(ly);
      });
      sceneIntro.appendChild(el('div', 'grain'));
      sceneIntro.appendChild(el('div', 'vignette'));

      var lines = el('div', 'intro-lines');
      INTRO_LINES.forEach(function () { lines.appendChild(el('div', 'line', '&nbsp;')); });
      sceneIntro.appendChild(lines);
      var hint = el('div', 'tap-hint', '轻 触 屏 幕 ，唤 醒 记 忆');
      sceneIntro.appendChild(hint);

      var star = el('div', 'morning-star', SVG.star4);
      sceneIntro.appendChild(star);

      var started = false;
      bind(sceneIntro, 'click', function () {
        audioInit();
        if (started) return;
        started = true;
        hint.classList.add('hidden');
        typeLines(lines, 0, function () {
          after(500, function () { star.classList.add('show'); });
        });
      });

      bind(star, 'click', function (e) {
        e.stopPropagation();
        if (!star.classList.contains('show')) return;
        var fly = el('div', 'fly-star', SVG.star4);
        fly.style.left = '614px';
        fly.style.top  = '470px';
        sceneIntro.appendChild(fly);
        star.classList.remove('show');
        star.classList.add('hidden');
        lines.classList.add('hidden');
        void fly.offsetHeight;
        fly.style.left = '610px';
        fly.style.top  = '180px';
        fly.classList.add('arrive');
        after(2100, function () {
          if (fly.parentNode) fly.parentNode.removeChild(fly);
          riseFlag();
        });
      });
    }

    function typeLines(box, idx, done) {
      if (idx >= INTRO_LINES.length) { after(500, done); return; }
      var row = box.children[idx];
      row.classList.add('show');
      var text = INTRO_LINES[idx];
      var p = 0;
      var h = every(62, function () {
        row.textContent = text.slice(0, ++p);
        typeClick();
        if (p >= text.length) {
          clearInterval(h);
          typeReturn();
          after(420, function () { typeLines(box, idx + 1, done); });
        }
      });
    }

    function riseFlag() {
      var wrap = el('div', 'flag-wrap');
      wrap.appendChild(el('div', 'pole'));
      wrap.appendChild(el('div', 'flag', SVG.flag + '<div class="wave"></div>'));
      sceneIntro.appendChild(wrap);
      windStart();
      void wrap.offsetHeight;
      wrap.classList.add('risen');
      chime();
      after(5200, function () {
        sceneIntro.classList.add('hidden');
        buildDoors();
      });
    }

    /* ============ 第二幕：环绕八门 + 精灵 ============ */
    var doorEls = [], spirit = null, bubble = null;
    var relicEls = [], relicsBox = null, breatheBox = null;

    function buildDoors() {
      sceneDoors.className = 'abs doors-scene';
      /* 漂浮火星 */
      var embers = el('div', 'embers');
      for (var e = 0; e < 26; e++) {
        var em = el('div', 'ember');
        em.style.left = (Math.random() * 100) + '%';
        em.style.top  = (55 + Math.random() * 45) + '%';
        em.style.animationDuration = (7 + Math.random() * 7) + 's';
        em.style.animationDelay = (Math.random() * 8) + 's';
        embers.appendChild(em);
      }
      sceneDoors.appendChild(embers);
      sceneDoors.appendChild(el('div', 'grain'));
      sceneDoors.appendChild(el('div', 'vignette'));

      sceneDoors.appendChild(el('div', 'doors-title', '火 苗 会 带 你 走 完 这 条 路'));

      /* 中央：一小队战士虚影（随通关逐个数出现）+ 火苗 */
      var ghosts = el('div', 'ghosts');
      var ghostSlots = [
        [24, 96], [84, 70], [144, 96], [204, 70], [264, 96],
        [54, 150], [144, 156], [234, 150]
      ];
      ghostSlots.forEach(function (pos, gi) {
        var g = el('div', 'ghost', SVG.soldier);
        g.style.left = pos[0] + 'px';
        g.style.top  = pos[1] + 'px';
        g.style.animationDelay = (gi * 0.4) + 's';
        ghosts.appendChild(g);
      });
      sceneDoors.appendChild(ghosts);
      var coreFlame = el('div', 'core-flame', SVG.flame);
      sceneDoors.appendChild(coreFlame);
      refreshGhosts();

      var CX = 640, CY = 424, R = 300;
      DOORS.forEach(function (d, i) {
        var ang = -Math.PI / 2 + (i / DOORS.length) * Math.PI * 2;
        var x = CX + R * Math.cos(ang);
        var y = CY + R * 0.72 * Math.sin(ang);
        var door = el('div', 'door');
        door.style.left = x + 'px';
        door.style.top  = y + 'px';
        door.style.animationDelay = (i * 0.35) + 's, ' + (i * 0.4) + 's';
        door.innerHTML =
          '<div class="num">' + d.num + '</div>' +
          '<div class="name">' + d.name + '</div>' +
          '<div class="gold-star">' + SVG.goldStar + '</div>';
        bind(door, 'click', function () {
          if (!door.classList.contains('locked-anim')) return;
          openDoor(i);
        });
        sceneDoors.appendChild(door);
        doorEls.push(door);
      });

      spirit = el('div', 'spirit', '<div class="bob">' + SVG.spirit + '</div>');
      spirit.style.left = '640px'; spirit.style.top = '262px';
      spirit.style.opacity = '0';
      sceneDoors.appendChild(spirit);
      bubble = el('div', 'bubble');
      sceneDoors.appendChild(bubble);

      buildRelics();

      /* 呼吸引导：进八门前先黑场三秒，把情绪按下去 */
      breatheBox = el('div', 'breathe', '<span>深呼吸。<br><em>我们回到 1934 年。</em></span>');
      sceneDoors.appendChild(breatheBox);
      after(260, function () { breatheBox.classList.add('show'); });
      after(2500, function () { breatheBox.classList.add('fade'); });
      after(3500, function () {
        if (breatheBox && breatheBox.parentNode) breatheBox.parentNode.removeChild(breatheBox);
        breatheBox = null;
      });

      after(2900, function () {
        spirit.style.opacity = '1';
        highlightNext(true);
      });
    }

    /* ---------- 记忆信物：每看一扇门，行囊里多一件 ---------- */
    function buildRelics() {
      relicsBox = el('div', 'relics');
      relicsBox.appendChild(el('div', 'relics-title', '行 囊 · 记 忆 信 物'));
      var row = el('div', 'relics-row');
      DOORS.forEach(function (d) {
        var chip = el('div', 'relic', '<i></i><span>' + d.relic + '</span>');
        row.appendChild(chip);
        relicEls.push(chip);
      });
      relicsBox.appendChild(row);
      relicsBox.appendChild(el('div', 'relics-count', '0 / ' + DOORS.length));
      sceneDoors.appendChild(relicsBox);
    }

    function addRelic(i) {
      var chip = relicEls[i];
      if (!chip || chip.classList.contains('got')) return;
      chip.classList.add('got');
      var n = sceneDoors.querySelectorAll('.relic.got').length;
      var c = sceneDoors.querySelector('.relics-count');
      if (c) c.textContent = n + ' / ' + DOORS.length;
      if (n === DOORS.length && relicsBox) {
        relicsBox.classList.add('full');
        if (c) c.textContent = '行 囊 已 满';
      }
    }

    /* 每人通关一扇门，就多走进来一个同伴；火苗也随之变亮 */
    function refreshGhosts() {
      var gh = sceneDoors.querySelectorAll('.ghost');
      var n = doneCount();
      for (var i = 0; i < gh.length; i++) gh[i].classList.toggle('in', i <= n);
      var flame = sceneDoors.querySelector('.core-flame');
      if (flame) {
        var sc = 1 + n * 0.12;
        flame.style.transform = 'scale(' + sc + ')';
        flame.style.filter = 'drop-shadow(0 0 ' + (10 + n * 3) + 'px #ffca5f)';
      }
    }

    function spiritGo(i, say) {
      var d = doorEls[i];
      var x = parseFloat(d.style.left), y = parseFloat(d.style.top);
      var ang = (i / DOORS.length) * Math.PI * 2 - Math.PI / 2;
      spirit.style.left = (x + Math.cos(ang) * 40 + 44) + 'px';
      spirit.style.top  = (y + Math.sin(ang) * 40 + 62) + 'px';
      if (say != null) {
        bubble.classList.remove('show');
        after(700, function () {
          if (!live) return;
          bubble.textContent = say;
          bubble.style.left = (x + 84) + 'px';
          bubble.style.top  = (y - 66) + 'px';
          bubble.classList.add('show');
        });
      }
    }

    function doneCount() {
      var n = 0;
      doorEls.forEach(function (d) { if (d.classList.contains('done')) n++; });
      return n;
    }

    function highlightNext(first) {
      doorEls.forEach(function (d) { d.classList.remove('locked-anim'); });
      for (var i = 0; i < DOORS.length; i++) {
        if (!doorEls[i].classList.contains('done')) {
          doorEls[i].classList.add('locked-anim');
          var remain = DOORS.length - doneCount();
          var say;
          if (first) say = SPIRIT_LINES.door;
          else if (remain === 1) say = SPIRIT_LINES.last;
          else say = SPIRIT_LINES.doorN + '（还剩 ' + remain + ' 扇）';
          spiritGo(i, say);
          return;
        }
      }
      spirit.style.left = '640px'; spirit.style.top = '180px';
      bubble.style.left = '680px'; bubble.style.top = '150px';
      bubble.textContent = SPIRIT_LINES.allDone;
      bubble.classList.add('show');
      after(2600, toRelay);
    }

    /* ---------- 门模态框：玩法 → 故事 ---------- */
    function openDoor(i) {
      var d = DOORS[i];
      var modal = el('div', 'door-modal');
      modal.innerHTML =
        '<div class="kicker">第 ' + CN_NUM[i] + ' 扇 门</div>' +
        '<div class="watermark">' + ('0' + (i + 1)).slice(-2) + '</div>' +
        '<div class="title-row"><div class="door-name">' + d.name + '</div>' +
        '<div class="seal">史料</div></div>' +
        '<div class="big-num">' + d.num + '</div>' +
        '<div class="g-area"></div>' +
        '<div class="g-tip">' + ((d.press || d.game) ? GAME_TIPS[d.press ? 'xiangjiang' : d.game] : '') + '</div>' +
        '<div class="door-text"></div>' +
        '<div class="footnote">' + FOOT + '</div>' +
        '<button class="close-btn hidden">合 上 这 扇 门</button>' +
        '<div class="m-vig"></div>';
      sceneDoors.appendChild(modal);
      bubble.classList.remove('show');

      var gArea = modal.querySelector('.g-area');
      var tipEl = modal.querySelector('.g-tip');
      var textEl = modal.querySelector('.door-text');
      var closeBtn = modal.querySelector('.close-btn');
      var footEl = modal.querySelector('.footnote');

      var cleanupGame = null;
      var finishedTyping = false;

      function typeStory() {
        /* ★ 照片区：后续把 doorArt(i) 换成历史照片 <img src="assets/xxx.jpg"> 即可 */
        gArea.innerHTML = doorArt(i);
        gArea.classList.add('photo');
        after(60, function () { gArea.classList.add('clear'); });
        var p = 0;
        var h = every(42, function () {
          textEl.textContent = d.text.slice(0, ++p);
          typeClick();
          if (p >= d.text.length) {
            clearInterval(h);
            typeReturn();
            finishedTyping = true;
            footEl.classList.add('show');
            closeBtn.classList.remove('hidden');
          }
        });
      }

      /* 玩法成功后的奖励：画面 + 故事 + 关门 */
      function onWin() {
        chime();
        if (cleanupGame) { cleanupGame(); cleanupGame = null; }
        typeStory();
      }

      var closed = false;
      function close() {
        if (closed || !finishedTyping) return;
        closed = true;
        if (cleanupGame) cleanupGame();
        sceneDoors.removeChild(modal);
        doorEls[i].classList.remove('locked-anim');
        doorEls[i].classList.add('done');
        refreshGhosts();
        addRelic(i);
        filmCut();
        shutter();
        chime();
        highlightNext(false);
      }
      bind(closeBtn, 'click', close);

      /* ---------- 各玩法 ---------- */
      if (d.press) {
        cleanupGame = gameXiangjiang(gArea, tipEl, onWin);
        return;
      }

      if (d.game) {
        var games = {
          cross: gameCross, bridge: gameBridge, grass: gameGrass
        };
        cleanupGame = games[d.game](gArea, tipEl, onWin);
        return;
      }

      typeStory();
    }

    /* ---------- 玩法0：血战湘江（人影方阵 + 骤降心跳） ---------- */
    function gameXiangjiang(area, tip, win) {
      var grid = el('div', 'xs-grid');
      var TOTAL = 88;
      for (var i = 0; i < TOTAL; i++) grid.appendChild(el('div', 'xs', '<i></i>'));
      var xsTip = el('div', 'xs-tip', '88 个方阵，每格一千人');
      area.appendChild(grid);
      area.appendChild(xsTip);
      var flash = el('div', 'red-flash');
      area.appendChild(flash);

      var icons = grid.querySelectorAll('.xs');
      var lit = TOTAL;
      var numEl = area.parentNode.querySelector('.big-num');

      /* 五个阶段：86,000 → 62,000 → 48,000 → 36,000 → 30,000 */
      var stages = [
        { num: 62000, keep: 63 },
        { num: 48000, keep: 49 },
        { num: 36000, keep: 36 },
        { num: 30000, keep: 30 }
      ];
      var step = 0, timer = null, running = false;

      function killTo(keep) {
        var guard = 0;
        while (lit > keep && guard < 500) {
          var idx = Math.floor(Math.random() * TOTAL);
          if (!icons[idx].classList.contains('dead')) {
            icons[idx].classList.add('dead');
            lit--;
          }
          guard++;
        }
      }

      function nextStage() {
        if (step >= stages.length) {
          clearInterval(timer); timer = null;
          tip.textContent = '86,000 人出发，过了湘江，只剩 30,000 余人。';
          after(2200, win);
          return;
        }
        var s = stages[step++];
        killTo(s.keep);
        if (numEl) numEl.textContent = fmt(s.num);
        thump();
        flash.classList.add('on');
        after(180, function () { flash.classList.remove('on'); });
        grid.classList.add('shake-x');
        after(400, function () { grid.classList.remove('shake-x'); });
      }

      function start() {
        if (running) return;
        running = true;
        var numEl2 = area.parentNode.querySelector('.big-num');
        if (numEl2) numEl2.classList.add('blood');
        nextStage();
        timer = setInterval(function () { if (live) nextStage(); }, 820);
        timers.push(timer);
      }

      bind(area, 'pointerdown', start);
      return function () { if (timer) clearInterval(timer); };
    }

    /* ---------- 玩法2：四渡赤水（躲巡逻点渡口） ---------- */
    function gameCross(area, tip, win) {
      area.classList.add('g-cross');
      var river = el('div', 'cross-river');
      area.appendChild(river);
      var enemy = el('div', 'cross-enemy');
      area.appendChild(enemy);
      var crossings = [];
      var done = 0;
      [70, 200, 330, 460].forEach(function (x, k) {
        var c = el('div', 'cross-point', '<span>' + '一二三四'[k] + '</span>');
        c.style.left = x + 'px';
        c.style.top  = '128px';
        area.appendChild(c);
        crossings.push({ el: c, x: x + 24 });
        bind(c, 'click', function () {
          if (c.classList.contains('ok')) return;
          if (Math.abs(enemyX - c.offsetLeft - 24) < 95) {
            buzz();
            tip.textContent = '被发现了！等敌人走远再渡';
          } else {
            c.classList.add('ok');
            chime();
            done++;
            tip.textContent = '第「' + '一二三四'[done - 1] + '渡」成功！' + (done < 4 ? '还剩 ' + (4 - done) + ' 次' : '');
            if (done >= 4) win();
          }
        });
      });
      var enemyX = 40, dir = 1;
      var h = every(30, function () {
        enemyX += dir * 3.2;
        if (enemyX > 470) { enemyX = 470; dir = -1; }
        if (enemyX < 40)  { enemyX = 40;  dir = 1; }
        enemy.style.left = enemyX + 'px';
      });
      return function () { clearInterval(h); };
    }

    /* ---------- 玩法3：飞夺泸定桥（狂点疾行） ---------- */
    function gameBridge(area, tip, win) {
      area.classList.add('g-bridge');
      var links = el('div', 'bridge-links');
      for (var i = 0; i < 12; i++) links.appendChild(el('div', 'blink'));
      area.appendChild(links);
      var bar = el('div', 'bridge-bar');
      var fill = el('div', 'bridge-fill');
      bar.appendChild(fill);
      area.appendChild(bar);
      var label = el('div', 'bridge-label', '行军 0 里 / 240 里');
      area.appendChild(label);
      var grab = el('div', 'bridge-grab hidden', '抓 稳 铁 索 !');
      area.appendChild(grab);

      var li = 0;   /* 0~24 */
      var grabH = null;
      function maybeGrab() {
        if (li === 8 || li === 16) {
          grab.classList.remove('hidden');
          grab.classList.add('flash');
          var taken = false;
          bind(grab, 'pointerdown', function g() {
            if (taken) return;
            taken = true;
            grab.classList.add('hidden');
            chime();
            li = Math.min(24, li + 2);
          });
          grabH = setTimeout(function () {
            if (!taken && live) {
              grab.classList.add('hidden');
              li = Math.max(0, li - 4);
              buzz();
              tip.textContent = '手一滑，退了几里！继续！';
            }
          }, 1100);
          timers.push(grabH);
        }
      }
      bind(area, 'pointerdown', function (e) {
        if (li >= 24) return;
        if (!grab.classList.contains('hidden')) return;
        li++;
        typeClick();
        if (li >= 24) { label.textContent = '到达桥头！'; win(); return; }
        label.textContent = '行军 ' + (li * 10) + ' 里 / 240 里';
        maybeGrab();
        var links = area.querySelectorAll('.blink');
        for (var k = 0; k < 12; k++) {
          links[k].classList.toggle('lit', k < Math.ceil(li / 2));
        }
        fill.style.width = (li / 24 * 100) + '%';
      });
      return function () { if (grabH) clearTimeout(grabH); };
    }

    /* ---------- 玩法4：走出草地（走格子避沼泽） ---------- */
    function gameGrass(area, tip, win) {
      area.classList.add('g-grass');
      var COLS = 5, ROWS = 3, CW = 96, CH = 86, OX = 20, OY = 10;
      var grid = el('div', 'grass-grid');
      area.appendChild(grid);
      var cells = [];
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var cell = el('div', 'gcell');
          cell.style.left = (OX + c * CW) + 'px';
          cell.style.top  = (OY + r * CH) + 'px';
          grid.appendChild(cell);
          cells.push({ el: cell, r: r, c: c, swamp: false });
        }
      }
      /* 随机沼泽：避开起点(0,1)终点(4,1)及其邻格 */
      var forbidden = { '0,1': 1, '1,1': 1, '3,1': 1, '4,1': 1 };
      var placed = 0;
      while (placed < 4) {
        var r = Math.floor(Math.random() * ROWS), c = Math.floor(Math.random() * COLS);
        if (forbidden[c + ',' + r]) continue;
        var cell = cells[r * COLS + c];
        if (cell.swamp) continue;
        cell.swamp = true;
        cell.el.classList.add('swamp');
        placed++;
      }
      var exitCell = cells[1 * COLS + 4];
      exitCell.el.classList.add('exit');
      exitCell.el.innerHTML = SVG.flame;

      var me = { r: 1, c: 0 };
      var token = el('div', 'grass-token');
      grid.appendChild(token);
      function place() {
        token.style.left = (OX + me.c * CW + 24) + 'px';
        token.style.top  = (OY + me.r * CH + 20) + 'px';
      }
      /* 高亮当前可走的相邻格，解决"不知道能点哪" */
      function paintReach() {
        cells.forEach(function (cell) {
          var dr = Math.abs(cell.r - me.r), dc = Math.abs(cell.c - me.c);
          cell.el.classList.toggle('can', dr + dc === 1);
        });
      }
      place();
      paintReach();

      cells.forEach(function (cell) {
        bind(cell.el, 'click', function () {
          var dr = Math.abs(cell.r - me.r), dc = Math.abs(cell.c - me.c);
          if (dr + dc !== 1) return;   /* 只能走相邻格 */
          me.r = cell.r; me.c = cell.c;
          place();
          paintReach();
          typeClick();
          if (cell.swamp) {
            buzz();
            cell.el.classList.add('stuck');
            tip.textContent = '陷进泥沼了！战友把你拉了出来……小心深色格子';
            after(500, function () { cell.el.classList.remove('stuck'); });
          }
          if (me.c === 4 && me.r === 1) win();
        });
      });
      return function () {};
    }

    /* ============ 第三幕：火种接力 + 画星光 ============ */
    function toRelay() {
      if (bubble) bubble.classList.remove('show');
      sceneDoors.classList.add('hidden');
      sceneRelay.className = 'abs relay-scene';

      sceneRelay.appendChild(el('div', 'horizon'));
      sceneRelay.appendChild(el('div', 'grain'));
      sceneRelay.appendChild(el('div', 'vignette'));
      sceneRelay.appendChild(el('div', 'relay-tip', '把 火 种 ，交 给 下 一 代'));
      var figs = el('div', 'figures');
      var soldier = el('div', 'figure soldier', SVG.soldier);
      var student = el('div', 'figure student', SVG.student);
      figs.appendChild(soldier);
      figs.appendChild(student);
      sceneRelay.appendChild(figs);

      var dlg = el('div', 'dlg');
      sceneRelay.appendChild(dlg);

      var flame = el('div', 'flame', SVG.flame);
      flame.style.left = '330px'; flame.style.top = '250px';
      sceneRelay.appendChild(flame);

      var target = { x: 950, y: 250, r: 90 };
      var dragging = false, offX = 0, offY = 0;
      function down(e) {
        dragging = true;
        flame.classList.add('drag');
        var r = stage.getBoundingClientRect();
        offX = e.clientX - r.left - parseFloat(flame.style.left);
        offY = e.clientY - r.top  - parseFloat(flame.style.top);
        e.preventDefault();
      }
      function move(e) {
        if (!dragging) return;
        var r = stage.getBoundingClientRect();
        flame.style.left = (e.clientX - r.left - offX) + 'px';
        flame.style.top  = (e.clientY - r.top  - offY) + 'px';
        e.preventDefault();
      }
      function up() {
        if (!dragging) return;
        dragging = false;
        flame.classList.remove('drag');
        var x = parseFloat(flame.style.left), y = parseFloat(flame.style.top);
        var dx = x - target.x, dy = y - target.y;
        if (Math.sqrt(dx * dx + dy * dy) < target.r) {
          flame.classList.add('homed');
          flame.style.left = (target.x - 63) + 'px';
          flame.style.top  = (target.y + 60) + 'px';
          chime();
          var tips = sceneRelay.querySelectorAll('.relay-tip');
          for (var ti = 0; ti < tips.length; ti++) tips[ti].style.opacity = '.35';
          after(900, function () { ceremony(soldier, student, dlg); });
        }
      }
      bind(flame, 'pointerdown', down);
      bind(stage, 'pointermove', move);
      bind(stage, 'pointerup', up);

      spirit = el('div', 'spirit', '<div class="bob">' + SVG.spirit + '</div>');
      spirit.style.left = '540px'; spirit.style.top = '120px';
      sceneRelay.appendChild(spirit);
      bubble = el('div', 'bubble');
      bubble.style.left = '585px'; bubble.style.top = '90px';
      bubble.textContent = SPIRIT_LINES.relay;
      sceneRelay.appendChild(bubble);
      after(400, function () { bubble.classList.add('show'); });
    }

    /* ---------- 交接仪式：递火 → 敬礼 → 转身走入雾中 → 画星光 ---------- */
    function say(dlg, text, ms) {
      dlg.classList.remove('show');
      after(500, function () {
        dlg.innerHTML = text;
        dlg.classList.add('show');
        if (ms) after(ms, function () { dlg.classList.remove('show'); });
      });
    }

    function ceremony(soldier, student, dlg) {
      if (bubble) bubble.classList.remove('show');
      if (spirit) spirit.style.opacity = '0';

      /* 1. 老兵托付 */
      say(dlg, '老兵：<b>这面旗，就交到你们手上了。</b>', 3200);

      /* 2. 双方敬礼 */
      after(900, function () { soldier.classList.add('salute'); });
      after(1700, function () { student.classList.add('salute'); });

      /* 3. 少年的回答 */
      after(4000, function () { say(dlg, '少年：<b>请放心。</b>', 2200); });

      /* 4. 老兵转身，走进雾里 */
      after(6600, function () {
        soldier.classList.remove('salute');
        soldier.classList.add('walk');
        after(700, function () { say(dlg, '<em>他没有回头。风把军号声吹得很远。</em>', 3000); });
      });

      /* 5. 留给观众的一句话 */
      after(10400, function () {
        say(dlg, '山会记得，水会记得，我们也会记得。', 3000);
      });

      /* 6. 画一颗星，送给他们 */
      after(13600, function () { drawStarEnding(student); });
    }

    /* ---------- 画星光：沿虚线描出五角星 ---------- */
    function starPoints(cx, cy, R, r) {
      var pts = [];
      for (var k = 0; k < 10; k++) {
        var ang = -Math.PI / 2 + k * Math.PI / 5;
        var rad = (k % 2 === 0) ? R : r;
        pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
      }
      return pts;
    }

    function drawStarEnding(student) {
      if (bubble) bubble.classList.remove('show');
      spirit.style.left = '150px'; spirit.style.top = '150px'; spirit.style.opacity = '.5';
      bubble.style.left = '195px'; bubble.style.top = '120px';
      bubble.textContent = SPIRIT_LINES.draw;
      bubble.classList.add('show');

      var panel = el('div', 'draw-panel');
      var CX = 640, CY = 330, R = 150, r = 60;
      var pts = starPoints(CX, CY, R, r);
      var poly = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + ' ' +
                 pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
      panel.innerHTML =
        '<svg class="draw-svg" viewBox="0 0 1280 720">' +
        '<polygon points="' + poly + '" fill="none" stroke="rgba(255,222,120,.5)" stroke-width="3" stroke-dasharray="10 12"/>' +
        '<circle class="draw-start" cx="' + pts[0][0] + '" cy="' + pts[0][1] + '" r="14" fill="rgba(255,233,168,.25)" stroke="#ffe9a8" stroke-width="2"/>' +
        '<polygon class="draw-fill" points="' + poly + '" fill="rgba(255,222,120,0)" stroke="rgba(255,233,168,.9)" stroke-width="4" style="opacity:0"/>' +
        '</svg>' +
        '<div class="draw-hint">从亮起的圆点开始，沿着虚线画一颗星</div>';
      sceneRelay.appendChild(panel);

      /* 依次经过 10 个顶点（顺序），半径容差 38px */
      var idx = 0, dots = [];
      var svg = panel.querySelector('svg');
      pts.forEach(function (p, k) {
        var dot = el('div', 'draw-dot' + (k === 0 ? ' now' : ''));
        dot.style.left = p[0] + 'px';
        dot.style.top  = p[1] + 'px';
        panel.appendChild(dot);
        dots.push(dot);
      });
      /* 第 0 点即起点，进入即计数 */
      function hit(e) {
        var rect = stage.getBoundingClientRect();
        var x = e.clientX - rect.left, y = e.clientY - rect.top;
        var p = pts[idx];
        if (Math.sqrt((x - p[0]) * (x - p[0]) + (y - p[1]) * (y - p[1])) < 38) {
          dots[idx].classList.add('hit');
          dots[idx].classList.remove('now');
          idx++;
          typeClick();
          if (idx < 10) dots[idx].classList.add('now');
          if (idx >= 10) {
            panel.querySelector('.draw-fill').style.opacity = '1';
            chime();
            after(1200, function () {
              if (panel.parentNode) panel.parentNode.removeChild(panel);
              bigEnding(student);
            });
          }
        }
      }
      bind(stage, 'pointermove', hit);
    }

    function bigEnding(student) {
      for (var k = 0; k < 6; k++) {
        after(k * 240, function () {
          var rs = el('div', 'rise-star', SVG.star4);
          var sx = 560 + Math.random() * 160;
          rs.style.left = sx + 'px';
          rs.style.top  = '330px';
          sceneRelay.appendChild(rs);
          void rs.offsetHeight;
          rs.style.left = (sx + (Math.random() * 80 - 40)) + 'px';
          rs.style.top  = (-60 - Math.random() * 100) + 'px';
          rs.style.opacity = '0';
          after(2400, function () { if (rs.parentNode) rs.parentNode.removeChild(rs); });
        });
      }
      after(2200, showCredits);
    }

    function showCredits() {
      var box = el('div', 'credits');
      var roll = el('div', 'roll');
      CREDITS.forEach(function (line) {
        if (typeof line === 'string') roll.appendChild(el('div', '', line || '&nbsp;'));
        else roll.appendChild(el('div', 'small', line.small || ''));
      });
      box.appendChild(roll);
      sceneRelay.appendChild(box);
      after(12500, buildGuestbook);
    }

    /* ============ 第四幕：留言簿 ============ */
    function echoFor(msg) {
      for (var i = 0; i < ECHOES.length; i++) {
        for (var k = 0; k < ECHOES[i].keys.length; k++) {
          if (msg.indexOf(ECHOES[i].keys[k]) !== -1) return ECHOES[i].say;
        }
      }
      return null;
    }

    /* 留言化作光点，向上飞入夜空 */
    function sparkUp(fromEl) {
      var sx = 640, sy = 460;
      try {
        var r = fromEl.getBoundingClientRect(), b = stage.getBoundingClientRect();
        sx = r.left - b.left + r.width / 2;
        sy = r.top - b.top + r.height / 2;
      } catch (e) {}
      sx = Math.max(140, Math.min(1140, sx));
      sy = Math.max(140, Math.min(620, sy));
      for (var k = 0; k < 34; k++) {
        (function (k) {
          after(k * 48, function () {
            var s = el('div', 'spark');
            s.style.left = (sx + Math.random() * 80 - 40) + 'px';
            s.style.top  = (sy + Math.random() * 40 - 20) + 'px';
            stage.appendChild(s);
            void s.offsetHeight;
            s.style.left = (sx + Math.random() * 360 - 180) + 'px';
            s.style.top  = (40 + Math.random() * 150) + 'px';
            s.style.opacity = '0';
            after(2800, function () { if (s.parentNode) s.parentNode.removeChild(s); });
          });
        })(k);
      }
    }

    function buildGuestbook() {
      var gb = el('div', 'guestbook');
      gb.innerHTML =
        '<h2>星 火 留 言 簿</h2>' +
        '<div class="sub">写下你最想对先烈们说的一句话</div>' +
        '<textarea placeholder="此刻，你想说什么……"></textarea>' +
        '<button class="submit-btn">化 作 星 光</button>' +
        '<div class="thanks"></div>';
      sceneRelay.appendChild(gb);

      var ta = gb.querySelector('textarea');
      var btn = gb.querySelector('.submit-btn');
      var thanks = gb.querySelector('.thanks');

      bind(btn, 'click', function () {
        var msg = (ta.value || '').trim() || '先烈们，这盛世如你所愿。';
        copyText(msg);
        ta.value = '';
        var echo = echoFor(msg);
        thanks.innerHTML =
          '<span class="main">你的话语已化作星光，将汇聚成我们共同的五星红旗。</span>' +
          (echo ? '<span class="echo">' + echo + '</span>' : '');
        thanks.classList.add('show');
        sparkUp(gb);
        after(echo ? 7600 : 4200, function () { finish(); });
      });
    }

    function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text); return;
        }
      } catch (e) {}
      try {
        var tmp = el('textarea');
        tmp.value = text;
        tmp.style.position = 'fixed'; tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
      } catch (e) {}
    }

    function finish() {
      if (!live) return;
      if (ctx && typeof ctx.finish === 'function') { ctx.finish(100); return; }
      try {
        if (global.parent && global.parent !== global) {
          global.parent.postMessage({ type: 'cz:done' }, '*');
        }
      } catch (e) {}
    }

    /* ---------- 启动 ---------- */
    buildIntro();
    sceneIntro.classList.remove('hidden');

    /* ---------- 卸载 ---------- */
    return {
      unmount: function () {
        live = false;
        timers.forEach(clearOne);
        timers = [];
        windStop();
        if (stage.parentNode) stage.parentNode.removeChild(stage);
      }
    };
  }

  /* ============ 注册导出 ============ */
  if (global.CZ && typeof global.CZ.register === 'function') {
    global.CZ.register({ id: ID, mount: mount });
  }
  global.LEVEL = { mount: mount };
})(window);
