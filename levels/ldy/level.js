/* ============================================================
   第21关《星火相传》· 最终章 —— 关卡逻辑 v7
   ------------------------------------------------------------
   v7 变更（参考学习强国·纪念长征胜利90周年图解）：
     信物改为图解实物（步枪/地图/斗笠/船桨/铁索/草鞋/皮带/军号）
     并各配一条硬数据；关门弹信物收集卡；八门全通信物飞向中央
     集结成堆；门内文案更新数据；结尾字幕换数字总览+五句排比；
     留言彩蛋新增草鞋/奇迹回声。
   接入契约：CZ.register({ id:'ldy', mount, unmount })，ctx.finish(score)
   ============================================================ */
(function (global) {
  'use strict';

  var ID = 'ldy';

  /* 本文件所在目录（file:// 下 img 相对路径会随页面位置漂移，以脚本自身位置为准最稳） */
  var BASE = (function () {
    try {
      var s = global.document && (global.document.currentScript ||
        global.document.scripts[global.document.scripts.length - 1]);
      var src = (s && s.src) || '';
      return src.slice(0, src.lastIndexOf('/') + 1);
    } catch (e) { return ''; }
  })();

  /* ============ 八门数据（严格对应游戏 8 站，会宁会师收尾） ============ */
  var DOORS = [
    { num: '86,000 → 30,000', name: '血战湘江', press: true, relic: '步枪',
      relicData: '中央红军 29153 支步马枪，平均每百人 40 余支，每支配弹不足 56 发',
      text: '1934年11月底，湘江血战五昼夜。加上此前三道封锁线的消耗，8.6 万人只剩 3 万。长按数字，直面这场减员。' },
    { num: '转折', name: '遵义会议', game: 'gear', relic: '地图',
      relicData: '实事求是，从这里校正了方向',
      text: '1935年1月，遵义会议在危急关头挽救了党、挽救了红军、挽救了中国革命。' },
    { num: '3万 : 40万', name: '四渡赤水', game: 'cross', relic: '斗笠',
      relicData: '3 万余人牵动近 40 万敌军，150 多个团被拖着反复转向',
      text: '三万红军四渡赤水，声东击西，跳出四十万敌军的围追堵截。' },
    { num: '7 只小船', name: '巧渡金沙江', game: 'ferry7', relic: '船桨',
      relicData: '7 只小船 · 37 名船工 · 七天七夜',
      text: '7只小船、37名船工、七天七夜，两万余人渡过金沙江，未损一兵一卒。' },
    { num: '22 勇士', name: '飞夺泸定桥', game: 'bridge', relic: '铁索',
      relicData: '13 根铁索 · 一昼夜兼程 240 里',
      text: '昼夜兼程240里，22名勇士攀着13根铁索夺下泸定桥。铁索之上，是滚烫的信仰。' },
    { num: '4,000+ 米', name: '翻越夹金山', game: 'climb', relic: '草鞋',
      relicData: '翻越 40 余座高山，20 多座雪山海拔 4000 多米',
      text: '海拔四千余米，风雪交加。衣着单薄的官兵手拉着手，把雪山踩在了脚下。' },
    { num: '7 天 7 夜', name: '走出草地', game: 'grass', relic: '皮带',
      relicData: '穿越 1.52 万平方公里水草地，断粮之后，皮带煮软了分着吃',
      text: '松潘草地，方圆数百里的水草地。以野菜充饥、以皮带果腹，七天七夜走出绝境。' },
    { num: '1936.10', name: '会宁会师', game: 'union', relic: '军号',
      relicData: '10月9日会宁 · 10月22日将台堡，三大主力会师',
      text: '1936年10月，三大主力会宁、将台堡会师，长征胜利结束。他们用两年，走完了一条信仰之路。' }
  ];

  /* 留言彩蛋：输入里出现这些词，会额外浮现一句史料回声 */
  var ECHOES = [
    { keys: ['信仰', '理想', '信念'], say: '“长征是历史纪录上的第一次，长征是宣言书，长征是宣传队，长征是播种机。” —— 毛泽东，1935年12月。' },
    { keys: ['青春', '少年', '年轻'], say: '长征队伍里，指挥员平均年龄不足 25 岁，14 至 18 岁的战士占到四成。撕开黑夜的，是一群年轻人。' },
    { keys: ['向前', '前进', '坚持'], say: '“红军不怕远征难，万水千山只等闲。” —— 毛泽东《七律·长征》，1935 年 10 月。' },
    { keys: ['草鞋', '群众', '百姓', '支援'], say: '出发前，赣南苏区赶制了 20 万双草鞋，群众卸下自家门板给红军架浮桥、把房屋让给部队休整。长征路上，人民一直在接力支援。' },
    { keys: ['传承', '接力', '我们'], say: '“每一代人有每一代人的长征，每一代人都要走好自己的长征路。”' },
    { keys: ['山河', '祖国', '中国'], say: '两年，跨越近 100 条江河、翻越 40 余座高山险峰、经历 600 余战。山河为证。' },
    { keys: ['奇迹', '艰难'], say: '越是艰难，越见奇迹。20.6 万人出发，最后到达陕甘的只有 5.7 万人。其余的人，留在了路上。' }
  ];

  var GAME_TIPS = {
    xiangjiang: '按住数字，看他们一个一个离开',
    gear:   '先看清双方家底，再回答那个问题',
    cross:  '敌军在江边巡逻——趁它走远，点渡口过江（共四次）',
    ferry7: '船一靠岸就点它——七只船来回摆渡，把两万人送过江',
    bridge: '狂点「行军」冲向泸定桥！出现金色铁索时立刻抓住',
    climb:  '按住屏幕往上爬，松手会下滑——风雪来时先停一停',
    grass:  '点相邻格子前进，深色的是沼泽，把火种送到队尾',
    union:  '四条长征路——点一下，让它们汇聚到会宁'
  };

  var CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八'];
  var FOOT = '数据据学习强国 · 纪念长征胜利90周年图解及《红军长征史》整理';

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
    allDone:'八扇门都关上了。还有最后一扇——',
    ninth:  '前八扇门，是他们的路。这一扇，是你的。',
    relay:  '按住火种，拖到少年手心',
    draw:   '跟着亮光，画一颗星送给他们'
  };

  var CREDITS = [
    '历史书太小，',
    '装不下一个人的伟大一生。',
    '',
    '历史书又太大，',
    '装下了他们所有人的牺牲。',
    '',
    '许多人的烈士证明书上，',
    '只写着五个字——',
    '北上，无音讯。',
    '',
    '每一代人有每一代人的长征，',
    '每一代人都要走好自己的长征路。',
    '',
    '—— 星 火 相 传 · 吾 辈 自 强 ——',
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
    /* 八件信物：手绘线条 + 半透明填色；未获得时以剪影（currentColor）呈现 */
    relic: {
      '步枪': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 34 L38 11" stroke-width="4"/>' +
        '<path d="M36 13 L42 8" stroke-width="2.2"/>' +
        '<path d="M10 32 L6 37 L12 42 L17 36 Z" fill="currentColor" fill-opacity=".85" stroke="none"/>' +
        '<path d="M22 25 L26 29" stroke-width="3"/>' +
        '<path d="M31 16 L41 22" stroke-width="2.2"/>' +
        '<path d="M25 21 L29 17" stroke-width="1.4" opacity=".55"/>' +
        '</svg>',
      '地图': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linejoin="round">' +
        '<path d="M8 11 L19 8 L30 12 L40 9 L40 37 L30 40 L19 36 L8 39 Z" stroke-width="2.2" fill="currentColor" fill-opacity=".12"/>' +
        '<path d="M19 8 L19 36 M30 12 L30 40" stroke-width="1.4" opacity=".5"/>' +
        '<path d="M13 30 C17 24 21 27 25 21 C28 17 33 18 36 14" stroke-width="1.8" stroke-dasharray="3 3"/>' +
        '<circle cx="36.5" cy="13.5" r="2.8" fill="currentColor" stroke="none"/>' +
        '</svg>',
      '斗笠': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linejoin="round">' +
        '<path d="M24 11 C31 11 38 17 41 25 L7 25 C10 17 17 11 24 11 Z" stroke-width="2.2" fill="currentColor" fill-opacity=".2"/>' +
        '<path d="M6 25 C6 28 15 31 24 31 C33 31 42 28 42 25" stroke-width="2.2"/>' +
        '<path d="M24 11 L14 27 M24 11 L24 30 M24 11 L34 27" stroke-width="1.2" opacity=".5"/>' +
        '<path d="M24 6 L24 11" stroke-width="2"/>' +
        '</svg>',
      '船桨': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round">' +
        '<path d="M33 8 L18 32" stroke-width="3.4"/>' +
        '<path d="M18 30 C12 36 9 42 10 44 C14 44 20 42 24 36 Z" fill="currentColor" fill-opacity=".85" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="M35 6 L38 9" stroke-width="3"/>' +
        '<path d="M15 36 L20 38" stroke-width="1.2" opacity=".5"/>' +
        '</svg>',
      '铁索': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor">' +
        '<ellipse cx="13" cy="17" rx="5.6" ry="8.6" stroke-width="2.6" transform="rotate(-28 13 17)"/>' +
        '<ellipse cx="24" cy="24" rx="5.6" ry="8.6" stroke-width="2.6" transform="rotate(-28 24 24)"/>' +
        '<ellipse cx="35" cy="31" rx="5.6" ry="8.6" stroke-width="2.6" transform="rotate(-28 35 31)"/>' +
        '<path d="M30 38 L34 42 M20 31 L17 28" stroke-width="1.4" opacity=".45" stroke-linecap="round"/>' +
        '</svg>',
      '草鞋': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linejoin="round">' +
        '<path d="M12 20 C7 26 8 35 14 39 C20 43 31 43 36 37 C40 33 39 25 34 20 C29 15 17 15 12 20 Z" stroke-width="2.2" fill="currentColor" fill-opacity=".16"/>' +
        '<path d="M14 24 L34 22 M13 30 L36 28 M15 35 L34 33" stroke-width="1.5" opacity=".55"/>' +
        '<path d="M19 20 L23 34 M25 19 L28 34 M31 19 L33 32" stroke-width="1.1" opacity=".4"/>' +
        '<path d="M19 19 C21 13 28 13 30 18" stroke-width="1.7"/>' +
        '</svg>',
      '皮带': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linejoin="round">' +
        '<path d="M7 20 L33 20 C37 20 39 23 39 26 C39 29 37 32 33 32 L7 32" stroke-width="2.4" fill="currentColor" fill-opacity=".14"/>' +
        '<rect x="30" y="16.5" width="11" height="19" rx="2.6" stroke-width="2.2"/>' +
        '<path d="M35.5 16.5 L35.5 35.5" stroke-width="1.5"/>' +
        '<circle cx="12" cy="26" r="1.7" fill="currentColor" stroke="none"/>' +
        '<circle cx="18" cy="26" r="1.7" fill="currentColor" stroke="none"/>' +
        '<circle cx="24" cy="26" r="1.7" fill="currentColor" stroke="none"/>' +
        '</svg>',
      '军号': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 31 L21 31 C26 31 30 27 33 21 L38 12" stroke-width="3"/>' +
        '<path d="M33 21 L42 16 L45 27 L36 24 Z" fill="currentColor" fill-opacity=".8" stroke-width="1.3"/>' +
        '<path d="M9 31 C5 31 5 26 9 25 L16 23" stroke-width="2.4"/>' +
        '<path d="M19 35 C24 39 32 39 36 34" stroke-width="1.5" opacity=".45"/>' +
        '</svg>'
    },
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

  /* 门内照片：优先用 assets/door1~8.{webp,jpg,png,jpeg}，文件缺失自动回退到手绘插画 */
  var PHOTO_EXT = ['webp', 'jpg', 'png', 'jpeg'];
  function setPhoto(area, i) {
    area.innerHTML = '<div class="photo-stack">' + doorArt(i) + '<img class="door-photo" alt=""></div>';
    var img = area.querySelector('.door-photo');
    if (!img) return;
    var k = 0;
    function tryExt() {
      if (k >= PHOTO_EXT.length) {
        if (img.parentNode) img.parentNode.removeChild(img);
        return;
      }
      img.src = BASE + 'assets/door' + (i + 1) + '.' + PHOTO_EXT[k];
    }
    img.addEventListener('error', function () { k++; tryExt(); });
    tryExt();
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
  /* 军号（交接仪式：敬礼/升空时）——两音冲锋号质感 */
  function horn(soft) {
    if (!audio.ctx) return;
    try {
      var t = audio.ctx.currentTime;
      var seq = soft ? [[392, 0, .5], [523.25, .45, 1.1]] : [[392, 0, .4], [523.25, .38, .8]];
      seq.forEach(function (n) {
        var osc = audio.ctx.createOscillator();
        var g = audio.ctx.createGain();
        var lp = audio.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n[0] * 0.985, t + n[1]);
        osc.frequency.linearRampToValueAtTime(n[0], t + n[1] + 0.12);
        g.gain.setValueAtTime(0.0001, t + n[1]);
        g.gain.linearRampToValueAtTime(soft ? 0.05 : 0.09, t + n[1] + 0.06);
        g.gain.setValueAtTime(soft ? 0.05 : 0.09, t + n[1] + n[2] - 0.18);
        g.gain.exponentialRampToValueAtTime(0.001, t + n[1] + n[2]);
        osc.connect(lp); lp.connect(g); g.connect(audio.ctx.destination);
        osc.start(t + n[1]); osc.stop(t + n[1] + n[2] + 0.02);
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

  /* 远处炮声：噪声经低通 + 低频下坠，像隔着一片江水传来的闷响 */
  function boom(vol) {
    if (!audio.ctx || !audio.noise) return;
    try {
      var t = audio.ctx.currentTime;
      var src = audio.ctx.createBufferSource();
      src.buffer = audio.noise;
      src.playbackRate.value = 0.55;
      var lp = audio.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320, t);
      lp.frequency.exponentialRampToValueAtTime(90, t + 0.5);
      var g = audio.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.19, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
      src.connect(lp); lp.connect(g); g.connect(audio.ctx.destination);
      src.start(t); src.stop(t + 0.66);

      var osc = audio.ctx.createOscillator();
      var g2 = audio.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(58, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.42);
      g2.gain.setValueAtTime((vol || 0.19) * 0.9, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(g2); g2.connect(audio.ctx.destination);
      osc.start(t); osc.stop(t + 0.52);
    } catch (e) {}
  }

  /* 战地底噪：极低的持续隆隆声，营造“江对岸一直在打”的氛围 */
  var amb = { src: null, gain: null };
  function ambStart() {
    if (!audio.ctx || !audio.noise || amb.src) return;
    try {
      var ctx = audio.ctx;
      var src = ctx.createBufferSource();
      src.buffer = audio.noise;
      src.loop = true;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 30;
      var trem = ctx.createOscillator();
      var tremGain = ctx.createGain();
      trem.frequency.value = 0.22;
      tremGain.gain.value = 0.35;
      var g = ctx.createGain();
      g.gain.value = 0.05;
      trem.connect(tremGain); tremGain.connect(g.gain);
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(ctx.destination);
      src.start(); trem.start();
      amb = { src: src, gain: g, trem: trem };
    } catch (e) {}
  }
  function ambStop() {
    if (!amb.src) return;
    try {
      amb.gain.gain.cancelScheduledValues(audio.ctx.currentTime);
      amb.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.2);
      var s = amb.src, tm = amb.trem;
      setTimeout(function () { try { s.stop(); tm.stop(); } catch (e) {} }, 700);
    } catch (e) {}
    amb = { src: null, gain: null };
  }

  /* 沉下去的尾音：减员到底后的三个下行长音 */
  function sadTriad() {
    if (!audio.ctx) return;
    try {
      [174.6, 146.8, 116.5].forEach(function (f, k) {
        var t = audio.ctx.currentTime + k * 0.55;
        var osc = audio.ctx.createOscillator();
        var g = audio.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.075, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        osc.connect(g); g.connect(audio.ctx.destination);
        osc.start(t); osc.stop(t + 1.55);
      });
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

    /* ============ 手机/小屏适配 ============ */
    /* 舞台固定 1280×720，小屏整体等比缩放居中；触屏设备降载防卡 */
    var stageScale = 1;
    var isTouch = false;
    try {
      isTouch = !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
    } catch (e) {}
    if (isTouch) stage.classList.add('touch');

    function fitStage() {
      var vw = global.innerWidth || 1280, vh = global.innerHeight || 720;
      var s = Math.min(vw / 1280, vh / 720);
      if (s >= 0.995) {
        stageScale = 1;
        stage.style.position = '';
        stage.style.left = '0px';
        stage.style.top = '0px';
        stage.style.transform = 'none';
      } else {
        /* 小屏：脱离文档流，相对视口等比缩放居中（容器尺寸不可靠） */
        stageScale = s;
        stage.style.position = 'fixed';
        stage.style.left = '50%';
        stage.style.top = '50%';
        stage.style.transform = 'translate(-50%,-50%) scale(' + s.toFixed(4) + ')';
      }
    }
    fitStage();
    bind(global, 'resize', fitStage);
    bind(global, 'orientationchange', fitStage);

    /* 事件坐标 → 舞台坐标（缩放后 rect 已按比例变化，除回去即可） */
    function evStage(e) {
      var r = stage.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) / stageScale,
        y: (e.clientY - r.top) / stageScale
      };
    }

    var sceneIntro  = el('div', 'abs hidden');
    var sceneDoors  = el('div', 'abs hidden');
    var sceneRelay  = el('div', 'abs hidden');
    stage.appendChild(sceneIntro);
    stage.appendChild(sceneDoors);
    stage.appendChild(sceneRelay);

    /* ============ 第一幕：星空 ============ */
    function buildIntro() {
      sceneIntro.className = 'abs starfield';
      /* 银河带 + 三层视差星空（纯代码，可动）；触屏设备减量防卡 */
      sceneIntro.appendChild(el('div', 'milkyway'));
      var counts = isTouch ? [40, 24, 14] : [70, 46, 26];
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

      var phase = 0;              /* 0 未开始 · 1 二十颗星 · 2 打字 */
      var advanceMeet = null;     /* 星星段没播完时，再点一次可跳过 */

      bind(sceneIntro, 'click', function () {
        audioInit();
        if (phase === 0) {
          phase = 1;
          hint.classList.add('hidden');
          starMeet();
          return;
        }
        if (phase === 1 && advanceMeet) advanceMeet();
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

      /* ---------- 开场点名：二十颗星依次亮起，然后「二十个关卡，八段路」 ---------- */
      var EIGHT_ROADS = ['血战湘江', '遵义会议', '四渡赤水', '巧渡金沙江',
                         '飞夺泸定桥', '翻越夹金山', '走出草地', '会宁会师'];

      function starMeet() {
        var box = el('div', 'starmeet');
        sceneIntro.appendChild(box);

        var stars = [], names = [];
        for (var i = 0; i < 20; i++) {
          var t = i / 19;
          var sz = 11 + (i % 4) * 2.4;
          var st = el('div', 'ms', SVG.star4);
          /* 沿一条缓缓起伏的弧线铺开，像一条走过来的路 */
          st.style.left = (202 + i * 46 + (i % 3) * 5 - sz / 2) + 'px';
          st.style.top  = (198 + Math.sin(t * Math.PI * 1.5 - 0.35) * 62 + (i % 2 ? -16 : 12) - sz / 2) + 'px';
          st.style.width = sz + 'px';
          st.style.height = sz + 'px';
          box.appendChild(st);
          stars.push(st);
        }
        var cap = el('div', 'meet-cap', '二十个关卡，八段路。');
        box.appendChild(cap);
        var namesBox = el('div', 'meet-names');
        EIGHT_ROADS.forEach(function (n) {
          var s = el('span', '', n);
          namesBox.appendChild(s);
          names.push(s);
        });
        box.appendChild(namesBox);

        var k = 0, revealed = false;

        function startType() {
          if (box.parentNode) box.parentNode.removeChild(box);
          if (phase !== 1) return;
          phase = 2;
          typeLines(lines, 0, function () {
            after(500, function () { star.classList.add('show'); });
          });
        }

        function reveal(fast) {
          if (revealed) return;
          revealed = true;
          clearInterval(h);
          stars.forEach(function (s) { s.classList.add('on'); });

          if (fast) {
            cap.classList.add('show');
            names.forEach(function (n) { n.classList.add('on'); });
            after(380, function () { box.classList.add('gone'); });
            after(900, startType);
            return;
          }

          after(320, function () { cap.classList.add('show'); chime(); });
          after(700, function () {
            names.forEach(function (n, ni) {
              after(ni * 125, function () { n.classList.add('on'); });
            });
          });
          after(700 + names.length * 125 + 1350, function () { box.classList.add('gone'); });
          after(700 + names.length * 125 + 2150, startType);
        }

        var h = every(130, function () {
          if (k < stars.length) { stars[k++].classList.add('on'); return; }
          clearInterval(h);
          reveal(false);
        });
        advanceMeet = function () { reveal(true); };
      }
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
      /* 万火归一：火星从八扇门的方向升起，缓缓飘向中央火堆 */
      var embers = el('div', 'embers');
      DOORS.forEach(function (dd, di) {
        var ang = -Math.PI / 2 + (di / DOORS.length) * Math.PI * 2;
        for (var k = 0; k < (isTouch ? 1 : 2); k++) {
          var em = el('div', 'ember');
          var sx = 640 + Math.cos(ang) * 300 + (Math.random() * 56 - 28);
          var sy = 418 + Math.sin(ang) * 201 + (Math.random() * 44 - 22);
          em.style.left = sx + 'px';
          em.style.top = sy + 'px';
          em.style.setProperty('--tx', (640 - sx) + 'px');
          em.style.setProperty('--ty', (488 - sy) + 'px');
          em.style.animationDuration = (6.5 + Math.random() * 3.5) + 's';
          em.style.animationDelay = (Math.random() * 9) + 's';
          embers.appendChild(em);
        }
      });
      sceneDoors.appendChild(embers);
      sceneDoors.appendChild(el('div', 'grain'));
      sceneDoors.appendChild(el('div', 'vignette'));

      sceneDoors.appendChild(el('div', 'doors-title',
        '<em>火</em> <em>苗</em> 会 带 你 走 完 这 条 路'));

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

      var CX = 640, CY = 418, R = 300;
      DOORS.forEach(function (d, i) {
        var ang = -Math.PI / 2 + (i / DOORS.length) * Math.PI * 2;
        var x = CX + R * Math.cos(ang);
        var y = CY + R * 0.67 * Math.sin(ang);
        var door = el('div', 'door');
        door.style.left = x + 'px';
        door.style.top  = y + 'px';
        door.style.backgroundImage = 'url(' + BASE + 'assets/door-frame.png)';
        door.style.animationDelay = (i * 0.35) + 's, ' + (i * 0.4) + 's';
        door.innerHTML =
          '<div class="star-halo"></div>' +
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

      /* 视差：鼠标移动时火星与战士虚影轻微错位，画面有纵深（触屏关闭，省性能） */
      if (!isTouch) bind(stage, 'pointermove', function (e) {
        var r = stage.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        sceneDoors.style.setProperty('--px', px.toFixed(3));
        sceneDoors.style.setProperty('--py', py.toFixed(3));
      });

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
        var chip = el('div', 'relic',
          '<i></i><b class="r-art">' + (SVG.relic[d.relic] || '') + '</b>');
        chip.title = d.relic;
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
      /* 收集卡：关门时弹出，展示信物与它的数据 */
      var card = el('div', 'relic-card',
        '<div class="rc-k">获 得 信 物</div>' +
        '<div class="rc-art">' + (SVG.relic[DOORS[i].relic] || '') + '</div>' +
        '<div class="rc-name">' + DOORS[i].relic + '</div>' +
        '<div class="rc-data">' + DOORS[i].relicData + '</div>');
      sceneDoors.appendChild(card);
      after(60, function () { card.classList.add('show'); });
      after(2300, function () { card.classList.add('bye'); });
      after(3000, function () { if (card.parentNode) card.parentNode.removeChild(card); });
    }

    /* 八门全通：信物从行囊飞出，在中央火苗下集结成堆 */
    function gatherRelics() {
      var b = stage.getBoundingClientRect();
      var offs = [[0, 0], [-38, 12], [38, 14], [-66, 26], [66, 24], [-24, 42], [26, 44], [0, 60]];
      relicEls.forEach(function (chip, i) {
        if (!chip.classList.contains('got')) return;
        chip.classList.add('taken');
        var r = chip.getBoundingClientRect();
        var fly = el('div', 'relic-fly got', chip.innerHTML);
        fly.style.left = ((r.left - b.left) / stageScale) + 'px';
        fly.style.top  = ((r.top - b.top) / stageScale) + 'px';
        sceneDoors.appendChild(fly);
        after(260 + i * 150, function () {
          var o = offs[i];
          fly.style.left = (640 + o[0] - 20) + 'px';
          fly.style.top  = (505 + o[1] - 20) + 'px';
          fly.style.transform = 'rotate(' + (Math.random() * 26 - 13).toFixed(1) + 'deg)';
          typeClick();
        });
      });
    }

    /* 关门飞星：一颗火星从门里飞出，落进中央火堆 */
    function sparkToFlame(i) {
      var d = doorEls[i];
      if (!d) return;
      var x = parseFloat(d.style.left);
      var y = parseFloat(d.style.top) - 18;
      var s = el('div', 'door-spark');
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      sceneDoors.appendChild(s);
      after(60, function () { s.style.left = '640px'; s.style.top = '488px'; });
      after(1000, function () { if (s.parentNode) s.parentNode.removeChild(s); });
    }

    /* 每人通关一扇门，就多走进来一个同伴；火苗也随之变亮 */
    function refreshGhosts() {
      var gh = sceneDoors.querySelectorAll('.ghost');
      var n = doneCount();
      for (var i = 0; i < gh.length; i++) gh[i].classList.toggle('in', i <= n);
      var flame = sceneDoors.querySelector('.core-flame');
      if (flame) {
        var sc = 1 + n * 0.17;
        flame.style.transform = 'scale(' + sc + ')';
        flame.style.filter = 'drop-shadow(0 0 ' + (12 + n * 4) + 'px #ffca5f)';
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
      gatherRelics();
      after(1700, function () {
        spirit.style.left = '640px'; spirit.style.top = '180px';
        bubble.style.left = '680px'; bubble.style.top = '150px';
        bubble.textContent = SPIRIT_LINES.allDone;
        bubble.classList.add('show');
      });
      after(4600, ninthDoor);
    }

    /* ---------- 第九扇门：八门之后，留一扇给你自己 ---------- */
    function ninthDoor() {
      if (!live) return;
      if (bubble) bubble.classList.remove('show');
      /* 八门与火堆退成背景，只留这一扇空门 */
      sceneDoors.classList.add('ninth-mode');

      var wrap = el('div', 'ninth');
      var sky = '<div class="nd-sky">';
      for (var i = 0; i < (isTouch ? 12 : 22); i++) {
        sky += '<i style="left:' + (5 + Math.random() * 90).toFixed(1) + '%;top:' +
               (5 + Math.random() * 90).toFixed(1) + '%;animation-delay:' +
               (Math.random() * 3.4).toFixed(1) + 's"></i>';
      }
      sky += '</div>';
      wrap.innerHTML =
        '<div class="nd-door">' + sky + '</div>' +
        '<div class="nd-cap">这一扇，留给现在的你</div>' +
        '<div class="nd-tip">点 一 下</div>';
      wrap.querySelector('.nd-door').style.backgroundImage = 'url(' + BASE + 'assets/door-frame.png)';
      sceneDoors.appendChild(wrap);

      after(120, function () { wrap.classList.add('show'); });
      after(1400, function () {
        if (!live) return;
        spirit.style.left = '806px'; spirit.style.top = '152px';
        bubble.style.left = '852px'; bubble.style.top = '122px';
        bubble.textContent = SPIRIT_LINES.ninth;
        bubble.classList.add('show');
      });

      var opened = false;
      bind(wrap, 'click', function () {
        if (opened) return;
        opened = true;
        if (bubble) bubble.classList.remove('show');
        wrap.classList.add('open');
        chime();
        after(420, chime);
        after(1500, function () {
          wrap.classList.add('bye');
          after(900, function () {
            if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
            toRelay();
          });
        });
      });
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
      if (bubble) bubble.classList.remove('show');

      var gArea = modal.querySelector('.g-area');
      var tipEl = modal.querySelector('.g-tip');
      var textEl = modal.querySelector('.door-text');
      var closeBtn = modal.querySelector('.close-btn');
      var footEl = modal.querySelector('.footnote');

      var cleanupGame = null;
      var finishedTyping = false;

      function typeStory() {
        /* 照片区：assets/door1~8 有图就显示照片，没有就用手绘插画 */
        setPhoto(gArea, i);
        gArea.classList.add('photo');
        after(60, function () { gArea.classList.add('clear'); });
        var p = 0;
        var h = every(42, function () {
          textEl.textContent = d.text.slice(0, ++p);
          typeClick();
          if (p >= d.text.length) {
            clearInterval(h);
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
        sparkToFlame(i);
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
          gear: gameGear, cross: gameCross, bridge: gameBridge, grass: gameGrass,
          union: gameUnion, ferry7: gameFerry7, climb: gameClimb
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
      var xsTip = el('div', 'xs-tip', '88 个方阵，每格约一千人');
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
          ambStop();
          sadTriad();
          tip.textContent = '86,000 人出发，过了湘江，只剩 30,000 余人。';
          after(2200, win);
          return;
        }
        var s = stages[step++];
        killTo(s.keep);
        if (numEl) numEl.textContent = fmt(s.num);
        /* 一记闷雷 + 两下心跳，越往后越沉 */
        boom(0.2 + step * 0.02);
        thump();
        after(170, thump);
        flash.classList.add('on');
        after(180, function () { flash.classList.remove('on'); });
        grid.classList.add('shake-x');
        after(400, function () { grid.classList.remove('shake-x'); });
      }

      /* 底噪 + 零散炮声：长按期间江对岸一直在打 */
      var boomH = null;
      function start() {
        if (running) return;
        running = true;
        var numEl2 = area.parentNode.querySelector('.big-num');
        if (numEl2) numEl2.classList.add('blood');
        ambStart();
        boom(0.16);
        boomH = setInterval(function () {
          if (!live || !running) return;
          boom(0.07 + Math.random() * 0.08);
        }, 700 + Math.random() * 600);
        timers.push(boomH);
        nextStage();
        timer = setInterval(function () { if (live) nextStage(); }, 820);
        timers.push(timer);
      }

      bind(area, 'pointerdown', start);
      return function () {
        if (timer) clearInterval(timer);
        if (boomH) clearInterval(boomH);
        ambStop();
      };
    }

    /* ---------- 玩法1：装备对比与抉择（遵义会议） ---------- */
    function gameGear(area, tip, win) {
      area.classList.add('g-gear');
      var rows = [
        ['每连机枪', '不足 2 挺', '敌军每连', '9 挺'],
        ['全军迫击炮', '38 门', '敌军每营', '6 挺重机枪 · 2 门迫击炮'],
        ['可用战机', '0 架', '敌军', '全程掌握制空权']
      ];
      var box = el('div', 'gear-rows');
      rows.forEach(function (r) {
        var row = el('div', 'gear-row');
        row.innerHTML =
          '<div class="gear-cell us"><em>' + r[0] + '</em><b>' + r[1] + '</b></div>' +
          '<div class="vs">对 比</div>' +
          '<div class="gear-cell them"><em>' + r[2] + '</em><b>' + r[3] + '</b></div>';
        box.appendChild(row);
      });
      area.appendChild(box);
      area.appendChild(el('div', 'gear-ask', '装备差到这个地步，他们凭什么走到了最后？'));

      var opts = el('div', 'gear-opts');
      var picks = [
        { t: '更好的武器', fb: '那时他们几乎没有补给，每支步枪只剩约 49 发子弹。' },
        { t: '信念、纪律，和人民', ok: true },
        { t: '更充足的粮食', fb: '草地断粮时，他们煮皮带、吃草根，连皮鼓都煮了。' }
      ];
      var answered = false;
      picks.forEach(function (p) {
        var b = el('button', 'gear-opt', p.t);
        bind(b, 'click', function () {
          if (answered) return;
          if (p.ok) {
            answered = true;
            b.classList.add('ok');
            chime();
            tip.textContent = '不是武器，是信念，是纪律，是人民的支持。';
            after(1500, win);
          } else {
            buzz();
            b.classList.add('no');
            tip.textContent = p.fb;
          }
        });
        opts.appendChild(b);
      });
      area.appendChild(opts);
      return function () {};
    }

    /* ---------- 玩法：巧渡金沙江（七只船往返摆渡，抢运两万人） ---------- */
    function gameFerry7(area, tip, win) {
      area.classList.add('g-ferry7');
      var water = el('div', 'f7-water');
      area.appendChild(water);
      area.appendChild(el('div', 'f7-bank', '皎 平 渡 口'));

      var dots = el('div', 'f7-dots');
      var marks = [];
      for (var i = 0; i < 7; i++) {
        var m = el('div', 'f7-dot');
        dots.appendChild(m);
        marks.push(m);
      }
      area.appendChild(dots);

      var PER = 3000;
      function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
      var counter = el('div', 'f7-count', '已渡 0 / 21,000 人');
      area.appendChild(counter);

      var boats = [], got = 0, done = false;

      /* 七只船从一开始就在江上，来回摆渡 —— 不用等刷新 */
      for (var bi = 0; bi < 7; bi++) {
        (function (bi) {
          var b = el('div', 'f7-boat',
            '<svg viewBox="0 0 72 34" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M6 18 L66 18 L56 30 L16 30 Z" fill="#7a5a30"/>' +
              '<path d="M6 18 L66 18 L62 21 L10 21 Z" fill="#a1793f"/>' +
              '<rect x="34" y="2" width="3" height="16" fill="#6b4c26"/>' +
              '<path d="M37 3 L60 10 L37 14 Z" fill="#d8cba8" opacity=".85"/>' +
              '<rect x="20" y="11" width="5" height="9" rx="2" fill="#3c2c17"/>' +
              '<rect x="48" y="11" width="5" height="9" rx="2" fill="#3c2c17"/>' +
            '</svg>');
          var x = 508 - bi * 66 - Math.random() * 18;
          var y = 34 + (bi % 3) * 34 + Math.random() * 12;
          b.style.top = y + 'px';
          b.style.left = x + 'px';
          area.appendChild(b);
          var boat = { el: b, x: x, dir: -1, v: 2.4 + Math.random() * 1.0 };
          boats.push(boat);
          bind(b, 'pointerdown', function (e) {
            if (e.stopPropagation) e.stopPropagation();
            catchBoat(boat);
          });
        })(bi);
      }

      /* 船靠到渡口伸手接应：装满 3000 人过江，船工掉头再划回去 */
      function catchBoat(boat) {
        if (done) return;
        if (boat.dir > 0 || boat.x > 236) {
          buzz();
          tip.textContent = '它正往回划——等船靠到渡口再伸手。';
          return;
        }
        boat.dir = 1;
        got++;
        marks[got - 1].classList.add('got');
        counter.textContent = '已渡 ' + fmt(got * PER) + ' / 21,000 人';
        boat.el.classList.add('cargo');
        after(650, function () { boat.el.classList.remove('cargo'); });
        chime();
        if (got >= 7) {
          done = true;
          counter.textContent = '已渡 21,000 / 21,000 人';
          tip.textContent = '七只小船，三十七名船工，七天七夜，两万多人渡过金沙江。';
          after(1000, win);
        } else {
          tip.textContent = '第 ' + got + ' 只船满载 3,000 人离岸，船工掉头又划回去。';
        }
      }

      var h = every(30, function () {
        for (var k = 0; k < boats.length; k++) {
          var b = boats[k];
          b.x += b.dir * b.v;
          if (b.x < 46) { b.x = 46; b.dir = 1; }
          if (b.x > 508) { b.x = 508; b.dir = -1; }
          b.el.style.left = b.x + 'px';
        }
      });
      tip.textContent = '七只船都在江上，船一靠岸就伸手——它们要来回跑一整夜。';
      return function () { clearInterval(h); };
    }

    /* ---------- 玩法：翻越夹金山（按住上爬，风雪停手） ---------- */
    function gameClimb(area, tip, win) {
      area.classList.add('g-climb');
      var NS = 'http://www.w3.org/2000/svg';
      var mtn = global.document.createElementNS(NS, 'svg');
      mtn.setAttribute('viewBox', '0 0 560 268');
      mtn.setAttribute('class', 'climb-mtn');
      mtn.innerHTML =
        '<path d="M0 268 L150 44 L300 268 Z" fill="#2a303e"/>' +
        '<path d="M112 92 L150 44 L190 96 L172 88 L150 102 L128 86 Z" fill="#e6ebf3"/>' +
        '<path d="M280 268 L430 82 L560 268 Z" fill="#20252f"/>' +
        '<path d="M392 134 L430 82 L470 138 L450 128 L430 142 L410 126 Z" fill="#d7dee9"/>';
      area.appendChild(mtn);

      var team = el('div', 'climb-team', SVG.soldier);
      area.appendChild(team);
      var altEl = el('div', 'climb-alt', '海拔 3,000 米');
      area.appendChild(altEl);
      var bar = el('div', 'climb-bar');
      var fill = el('div', 'climb-fill');
      bar.appendChild(fill);
      area.appendChild(bar);

      var alt = 0, holding = false, gust = null, done = false;
      var guestLeft = 0;      /* 距离下一场风雪的毫秒数 */

      /* 单循环驱动：进度与风雪都在这里推进，不再额外开定时器 */
      var h = every(40, function () {
        if (done) return;

        /* ---- 风雪：从右往左扫过，约 1.4 秒走完 ---- */
        if (gust) {
          gust.left -= 30;
          gust.el.style.left = gust.left + 'px';
          if (gust.left < -260) {
            if (gust.el.parentNode) gust.el.parentNode.removeChild(gust.el);
            gust = null;
            tip.textContent = '风雪过去了，继续往上。';
          }
        } else if (alt > 8) {
          guestLeft -= 40;
          if (guestLeft <= 0) {
            var g = el('div', 'climb-gust');
            g.style.left = '580px';
            area.appendChild(g);
            gust = { el: g, left: 580 };
            guestLeft = 6200;               /* 下一场在 6.2 秒后 */
            tip.textContent = '风雪来了——先停一停，抓稳前面的人！';
          }
        }

        /* ---- 爬升 / 下滑 ---- */
        var d;
        if (gust) d = holding ? -0.18 : 0;    /* 风雪里硬爬会打滑，停手最稳 */
        else d = holding ? 0.72 : -0.22;      /* 平常：按住上爬，松手下滑 */
        alt = Math.max(0, Math.min(100, alt + d));
        team.style.bottom = (14 + alt * 1.55) + 'px';
        team.style.opacity = gust ? '.6' : '1';
        altEl.textContent = '海拔 ' + (3000 + Math.round(alt * 11.1)) + ' 米 / 4,110 米';
        fill.style.height = alt + '%';
        if (alt >= 100) {
          done = true;
          holding = false;
          if (gust) { if (gust.el.parentNode) gust.el.parentNode.removeChild(gust.el); gust = null; }
          altEl.textContent = '海拔 4,110 米 —— 把雪山踩在了脚下';
          chime();
          after(900, win);
        }
      });
      guestLeft = 4200;   /* 开局给 4.2 秒熟悉手感，再起第一场风雪 */

      bind(area, 'pointerdown', function () { holding = true; area.classList.add('pulling'); });
      bind(area, 'pointerup', function () { holding = false; area.classList.remove('pulling'); });
      bind(area, 'pointerleave', function () { holding = false; area.classList.remove('pulling'); });
      return function () { clearInterval(h); };
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

    /* ---------- 玩法5：四路红军会师（四条线汇聚到会宁） ---------- */
    function gameUnion(area, tip, win) {
      area.classList.add('g-union');
      var NS = 'http://www.w3.org/2000/svg';
      var routes = [
        { name: '中央红军', km: '2.5 万里', c: '#d8523f', d: 'M44 196 C132 128 196 214 278 134' },
        { name: '红二十五军', km: '近万里', c: '#5da368', d: 'M58 36 C146 78 200 58 278 134' },
        { name: '红四方面军', km: '1 万余里', c: '#c9a03c', d: 'M516 226 C420 196 364 168 278 134' },
        { name: '红二方面军', km: '2 万余里', c: '#5b8bbd', d: 'M518 42 C424 76 364 92 278 134' }
      ];
      var svg = global.document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 560 268');
      svg.setAttribute('class', 'union-svg');
      routes.forEach(function (r) {
        /* 淡色预览线：让玩家知道路在哪 */
        var pv = global.document.createElementNS(NS, 'path');
        pv.setAttribute('d', r.d);
        pv.setAttribute('fill', 'none');
        pv.setAttribute('stroke', r.c);
        pv.setAttribute('stroke-width', '2');
        pv.setAttribute('stroke-dasharray', '3 7');
        pv.setAttribute('opacity', '.22');
        svg.appendChild(pv);
        /* 实际行军线：点击后流动 */
        var p = global.document.createElementNS(NS, 'path');
        p.setAttribute('d', r.d);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', r.c);
        p.setAttribute('stroke-width', '3');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('opacity', '.9');
        svg.appendChild(p);
        r.path = p;
      });
      area.appendChild(svg);

      var star = el('div', 'union-star', SVG.goldStar);
      area.appendChild(star);

      var list = el('div', 'union-list');
      var done = 0, finished = false;
      routes.forEach(function (r) {
        var chip = el('div', 'union-chip',
          '<b>' + r.name + '</b><span>' + r.km + '</span>');
        chip.style.borderColor = r.c;
        bind(chip, 'click', function () {
          if (r.done || finished) return;
          r.done = true;
          chip.classList.add('ok');
          r.path.style.strokeDashoffset = 0;
          chime();
          done++;
          if (done < 4) {
            tip.textContent = '已有 ' + done + ' 路红军走向会宁……';
          } else {
            finished = true;
            tip.textContent = '四路红军，走到了一起。';
            star.classList.add('lit');
            after(1500, win);
          }
        });
        list.appendChild(chip);
      });
      area.appendChild(list);

      /* 路径长度要等布局完成才拿得到 */
      after(60, function () {
        routes.forEach(function (r) {
          var len = 420;
          try { len = r.path.getTotalLength() || 420; } catch (e) {}
          r.path.style.strokeDasharray = len;
          r.path.style.strokeDashoffset = len;
          r.path.style.transition = 'stroke-dashoffset 1.5s ease';
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
      sceneRelay.appendChild(el('div', 'relay-tip', '把 火 种 ，递 到 少 年 手 上'));
      var figs = el('div', 'figures');
      /* 双层图：fa = 常姿帧，fb = 动作帧（敬礼），换帧即交叉淡入 */
      var soldier = el('div', 'figure soldier',
        '<img class="fa" src="' + BASE + 'assets/soldier.png" alt="老兵">' +
        '<img class="fb" src="' + BASE + 'assets/soldier-salute.png" alt="">');
      var student = el('div', 'figure student',
        '<img class="fa" src="' + BASE + 'assets/student.png" alt="少年">' +
        '<img class="fb" src="' + BASE + 'assets/student-salute.png" alt="">');
      figs.appendChild(soldier);
      figs.appendChild(student);
      sceneRelay.appendChild(figs);

      var dlg = el('div', 'dlg');
      sceneRelay.appendChild(dlg);

      /* 少年手心的落点提示（脉动圆环），接住后熄灭 */
      var handHint = el('div', 'hand-hint');
      sceneRelay.appendChild(handHint);

      var flame = el('div', 'flame', SVG.flame);
      flame.style.left = '560px'; flame.style.top = '438px';
      sceneRelay.appendChild(flame);

      /* 目标：少年垂下右手的手心（figures 顶 118，少年 figure 起点 x≈805） */
      var target = { x: 886, y: 388, r: 95 };
      handHint.style.left = (target.x - 34) + 'px';
      handHint.style.top  = (target.y - 34) + 'px';
      var dragging = false, offX = 0, offY = 0;
      function down(e) {
        dragging = true;
        flame.classList.add('drag');
        var p = evStage(e);
        offX = p.x - parseFloat(flame.style.left);
        offY = p.y - parseFloat(flame.style.top);
        e.preventDefault();
      }
      function move(e) {
        if (!dragging) return;
        var p = evStage(e);
        flame.style.left = (p.x - offX) + 'px';
        flame.style.top  = (p.y - offY) + 'px';
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
          flame.style.left = (target.x - 23) + 'px';
          flame.style.top  = (target.y - 23) + 'px';
          chime();
          handHint.style.opacity = '0';
          var tips = sceneRelay.querySelectorAll('.relay-tip');
          for (var ti = 0; ti < tips.length; ti++) tips[ti].style.opacity = '.35';
          after(900, function () { ceremony(soldier, student, dlg, flame); });
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

    /* 帽徽闪光：在角色容器内指定位置炸开一颗星 */
    function spark(figure, x, y) {
      var s = el('div', 'spark');
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      figure.appendChild(s);
      after(1000, function () { if (s.parentNode) s.parentNode.removeChild(s); });
    }

    /* 火入心口：少年手心那团火缓缓升起、缩小，落进胸口——先接到手上，再记在心里 */
    function flameToChest(flame, student) {
      flame.classList.add('to-chest');
      after(40, function () {
        /* 胸口位置：少年 figure（起点 x≈805, y≈118）内 50%,44% */
        flame.style.left = '912px';
        flame.style.top  = '292px';
      });
      after(1150, function () {
        flame.classList.add('at-chest');
        student.classList.add('proud');
        chime();
        after(900, function () { student.classList.remove('proud'); });
      });
    }

    /* 化作星光升空：一串小光点从老兵位置飘向星空 */
    function ascendFX(figure) {
      var box = figure.parentNode || sceneRelay;
      var r = { x: 330, y: 240 };
      for (var i = 0; i < 8; i++) {
        (function (k) {
          var d = el('div', 'rise-dot');
          d.style.left = (r.x + 90 + (k % 4) * 22 - 33) + 'px';
          d.style.top = (r.y + 120 + Math.floor(k / 4) * 60) + 'px';
          d.style.animationDuration = (1.4 + (k % 3) * 0.35) + 's';
          d.style.animationDelay = (k * 0.12) + 's';
          box.appendChild(d);
          after(2600, function () { if (d.parentNode) d.parentNode.removeChild(d); });
        })(i);
      }
    }

    function ceremony(soldier, student, dlg, flame) {
      if (bubble) bubble.classList.remove('show');
      if (spirit) spirit.style.opacity = '0';

      /* 1. 老兵起步上前（走两步的顿挫起伏） */
      after(300, function () { soldier.classList.add('step-up'); });
      after(600, function () { say(dlg, '老兵：<b>这颗火种，就交到你们手上了。</b>', 3000); });

      /* 2. 少年注意到老兵走近，微微侧身相迎 */
      after(2300, function () { student.classList.add('attend'); });

      /* 3. 老兵站定蓄力半拍 → 敬礼 + 帽徽闪光 + 军号 + 轻推镜 */
      after(4000, function () { soldier.classList.add('brace'); });
      after(4350, function () {
        soldier.classList.remove('brace');
        soldier.classList.add('salute');
        horn(false);
        spark(soldier, 126, 58);
        var figs = soldier.parentNode;
        if (figs) {
          figs.classList.add('push');
          after(1100, function () { figs.classList.remove('push'); });
        }
      });

      /* 4. 少年愣了半拍——这一下迟疑是心里一动 */
      after(5300, function () { student.classList.add('startle'); });

      /* 5. 手心的火缓缓升入胸口（先接到手上，再记在心里），然后才举手回礼 */
      after(5700, function () { flameToChest(flame, student); });
      after(7300, function () {
        student.classList.add('salute');
      });

      /* 6. 少年的回答 */
      after(8800, function () {
        say(dlg, '少年：<b>请放心。</b>', 2200);
      });

      /* 7. 老兵放下手，转身走入雾中 */
      after(11300, function () {
        soldier.classList.remove('salute');
        soldier.classList.add('turn');
      });
      after(12000, function () {
        soldier.classList.remove('turn');
        soldier.classList.add('leave');
        after(700, function () { say(dlg, '<em>他没有回头。风把军号声吹得很远。</em>', 3000); });
      });

      /* 8. 雾边忽然回头，再敬一次礼 */
      after(14800, function () {
        soldier.classList.remove('leave');
        soldier.classList.add('look-back');
        soldier.classList.add('salute');
        spark(soldier, 126, 58);
        horn(true);
      });

      /* 9. 化作星光升空；少年久久保持敬礼，1.3 秒后才放下手（礼毕） */
      after(16800, function () {
        soldier.classList.add('ascend');
        ascendFX(soldier);
      });
      after(18100, function () {
        student.classList.remove('salute');
        student.classList.remove('attend');
      });

      /* 10. 留给观众的一句话 */
      after(18900, function () {
        say(dlg, '山会记得，水会记得，我们也会记得。', 3000);
      });

      /* 11. 画一颗星，送给他们 */
      after(21900, function () { drawStarEnding(student); });
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
        var p0 = evStage(e);
        var x = p0.x, y = p0.y;
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
      /* 画完一颗星，让星空静一会儿——比任何字幕都重 */
      after(6500, showCredits);
    }

    var creditsBox = null;

    function showCredits() {
      var box = el('div', 'credits');
      var roll = el('div', 'roll');
      CREDITS.forEach(function (line) {
        if (typeof line === 'string') roll.appendChild(el('div', '', line || '&nbsp;'));
        else roll.appendChild(el('div', 'small', line.small || ''));
      });
      box.appendChild(roll);
      sceneRelay.appendChild(box);
      creditsBox = box;
      after(14200, showToday);
    }

    /* ---------- 1936 → 2026：同一个年纪，不同的命运 ---------- */
    function showToday() {
      if (creditsBox) creditsBox.classList.add('gone');
      var box = el('div', 'today');
      box.innerHTML =
        '<div class="yrs"><span>1936</span><i></i><span>2026</span></div>' +
        '<div class="cols">' +
          '<div class="col"><h4>当 年</h4>' +
            '<p>14 至 18 岁的战士，占到全军四成</p><p>指挥员平均年龄不足 25 岁</p><p>他们中的大多数，没有留下姓名</p></div>' +
          '<div class="col"><h4>今 天</h4>' +
            '<p>这个年纪的人，坐在教室里</p><p>在球场上，在去明天的路上</p><p>正在读这段历史</p></div>' +
        '</div>' +
        '<div class="today-line">他们倒下时的年纪，正是我们现在的年纪。</div>';
      sceneRelay.appendChild(box);
      after(120, function () { box.classList.add('show'); });
      after(1500, function () {
        var ln = box.querySelector('.today-line');
        if (ln) ln.classList.add('show');
      });
      after(7000, function () { box.classList.add('bye'); });
      after(8200, buildGuestbook);
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
        sx = (r.left - b.left + r.width / 2) / stageScale;
        sy = (r.top - b.top + r.height / 2) / stageScale;
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
      var done = false;

      bind(btn, 'click', function () {
        if (done) return;
        done = true;
        var msg = (ta.value || '').trim() || '先烈们，这盛世如你所愿。';
        copyText(msg);
        ta.value = '';
        var echo = echoFor(msg);

        gb.classList.add('submitted');
        btn.classList.add('gone');
        ta.classList.add('gone');

        thanks.innerHTML =
          '<div class="thx-main">谢谢你，愿意停下来跟他们说一句话。</div>' +
          '<div class="thx-sub">你的话语已化作星光，将汇聚成我们共同的五星红旗。</div>' +
          (echo ? '<div class="echo">' + echo + '</div>' : '') +
          '<div class="thx-acts">' +
            '<button class="home-btn">返 回 主 页</button>' +
            '<span class="stay-tip">（也可以停在这里，多陪他们一会儿）</span>' +
          '</div>';
        thanks.classList.add('show');

        /* 这句话先浮在夜空里，停一会儿，再散成星光 */
        var word = el('div', 'msg-star',
          msg.length > 34 ? msg.slice(0, 34) + '……' : msg);
        sceneRelay.appendChild(word);
        after(80, function () { word.classList.add('show'); });
        after(5400, function () { word.classList.add('bye'); });
        after(7200, function () { if (word.parentNode) word.parentNode.removeChild(word); });

        sparkUp(gb);

        var home = thanks.querySelector('.home-btn');
        bind(home, 'click', function () {
          home.classList.add('pressed');
          after(420, function () { finish(); });
        });
        /* 兜底：停留超过 45 秒仍不点，也把这一关归档 */
        after(45000, function () { finish(); });
      });
    }

    function copyText(text) {
      /* 兜底：老式 execCommand 复制（临时输入框挂在自己的舞台里，不碰 body） */
      var legacy = function () {
        try {
          var tmp = el('textarea');
          tmp.value = text;
          tmp.style.position = 'fixed'; tmp.style.opacity = '0';
          stage.appendChild(tmp);
          tmp.focus();
          tmp.select();
          document.execCommand('copy');
          stage.removeChild(tmp);
        } catch (e) {}
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          /* file:// 下浏览器会拒绝写入剪贴板，必须接住这个 Promise，否则控制台报红 */
          navigator.clipboard.writeText(text).then(function () {}, legacy);
          return;
        }
      } catch (e) {}
      legacy();
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

  /* 独立打开（双击 index.html）时自己挂上去 */
  var soloStage = global.document.getElementById('stage');
  if (soloStage && !soloStage.dataset.mounted) {
    soloStage.dataset.mounted = '1';
    mount(soloStage, null);
  }
})(window);
