/* levels/zzy/level.js
 * 《过草地-1935》—— 1935 年 8 月 21 日至 27 日，红一方面军一个连队过松潘草地。
 *
 * 主程序用 iframe 加载 levels/zzy/index.html，本文件是 classic script。
 * 入口：mount(root, ctx)，root 是 #stage，ctx 可空。
 * 通关时向父窗口 postMessage({ type: 'cz:done' })。
 * 只用传入的 canvas ctx；不使用外部图片/字体/音频。
 */
(function (global) {
  'use strict';

/* ============================================================================
 * 《过草地》1935 · 长征单关小游戏
 * ----------------------------------------------------------------------------
 * 契约
 *   宿主调用：Grassland.boot(ctxCanvas2D)  ->  { destroy() }
 *   ctx 必须是标准 CanvasRenderingContext2D
 *
 * 约束（严格遵守）
 *   · 绘制只用 ctx 的 2D API：fillRect / beginPath / moveTo / lineTo /
 *     bezierCurveTo / arc / fillText / measureText / createLinearGradient /
 *     setTransform / save / restore / translate / rotate
 *   · 不使用 document / window / Image / fetch / Audio / querySelector
 *   · 不加载任何外部资源（图片、字体、音频、网络请求）
 *   · 唯一 DOM 接触点：ctx.canvas 的 addEventListener / width / height /
 *     getBoundingClientRect
 *
 * 设计稿 960×600，按 min(cw/960, ch/600) 等比缩放居中。
 * ========================================================================== */
var Grassland = (function () {
  'use strict';

  var W = 960, H = 600;
  var FS = 1;   /* 小屏字号补偿系数，resize 时按显示宽度算 */

  /* ---------------------------------------------------------------- 主题 */
  /* C 是可变对象：切主题时只改它的值、不换引用，
     所有绘制函数里的 C.xxx 自动跟着变，一行都不用作废。 */
  var C = {};

  function mkTheme(o) {
    return {
      bg: o.bg,
      paper: o.paper,
      panel: o.panel,
      line: o.line,
      lineHi: o.lineHi,
      red: o.red,
      redD: o.redD,
      gold: o.gold,
      ink: o.ink,
      ink2: o.ink2,
      ink3: o.ink3,
      warm: o.warm,
      mud: o.mud || '#3B352D',
      mudHi: o.mudHi || '#4A443A',
      skin: '#C09E80',
      hair: '#221E19',
      cloth: '#57544C',
      folder: o.folder || '#4E4433',
      folderD: o.folderD || '#2E281E',
      folderHi: o.folderHi || '#655840',
      thread: o.thread || '#B9B09B'
    };
  }

  var THEMES = {
    /* 封面：夜里的一张档案 */
    cover: mkTheme({
      bg: '#0B0908', paper: '#322719', panel: '#383022', line: '#4A4033', lineHi: '#5C5040',
      red: '#B4402F', redD: '#7E2A20', gold: '#C39B4E',
      ink: '#E9E1D0', ink2: '#A99F8C', ink3: '#6F6558',
      warm: 'rgba(196,140,60,0.055)',
      folder: '#6E593C', folderD: '#3A2F1F', folderHi: '#93794F', thread: '#DCD3BC'
    }),
    /* 毛儿盖出发：暖一点 */
    march: mkTheme({
      bg: '#0D0B09', paper: '#362A19', panel: '#3C3427', line: '#4E4433', lineHi: '#605440',
      red: '#B4402F', redD: '#7E2A20', gold: '#C39B4E',
      ink: '#E9E1D0', ink2: '#A99F8C', ink3: '#6F6558',
      warm: 'rgba(200,146,62,0.07)',
      folder: '#705E42', folderD: '#3C3122', folderHi: '#977F53', thread: '#DFD6BF'
    }),
    /* 断粮：偏黄绿，像干草 */
    famine: mkTheme({
      bg: '#0C0A07', paper: '#2D2416', panel: '#322B20', line: '#443929', lineHi: '#554836',
      red: '#A8432E', redD: '#74301F', gold: '#B08A3E',
      ink: '#DDD3BF', ink2: '#9C927E', ink3: '#675F51',
      warm: 'rgba(168,140,60,0.06)',
      folder: '#6C5A38', folderD: '#382E1D', folderHi: '#907A4C', thread: '#D8CDB1'
    }),
    /* 泥沼：几乎无光 */
    mud: mkTheme({
      bg: '#0A0908', paper: '#241F17', panel: '#2A2620', line: '#3A352E', lineHi: '#483F35',
      red: '#A8402F', redD: '#72291E', gold: '#9E7F42',
      ink: '#D6CDBC', ink2: '#93897A', ink3: '#615A4E',
      warm: 'rgba(140,120,80,0.04)',
      folder: '#5E523E', folderD: '#2E281E', folderHi: '#7A6B4C', thread: '#C6BDA8',
      mud: '#3B352D', mudHi: '#4A443A'
    }),
    /* 夜宿：偏蓝，雨 */
    night: mkTheme({
      bg: '#08090C', paper: '#1E232C', panel: '#262C36', line: '#38404B', lineHi: '#47525F',
      red: '#A63A34', redD: '#72241F', gold: '#9E8E62',
      ink: '#DCE2EA', ink2: '#95A0AE', ink3: '#5F6975',
      warm: 'rgba(120,150,200,0.035)',
      folder: '#565C68', folderD: '#282C33', folderHi: '#707886', thread: '#D1D7E0'
    }),
    /* 班佑河：最蓝 */
    river: mkTheme({
      bg: '#070A0E', paper: '#1A222C', panel: '#222B37', line: '#323E4C', lineHi: '#404E5D',
      red: '#9E3830', redD: '#6C231D', gold: '#96895F',
      ink: '#CDD6DF', ink2: '#8B97A4', ink3: '#57616D',
      warm: 'rgba(110,150,205,0.03)',
      folder: '#4D5764', folderD: '#232A31', folderHi: '#67727F', thread: '#CAD3DD'
    }),
    /* 遗言：全站最黑，只有一圈暖光 */
    elegy: mkTheme({
      bg: '#050404', paper: '#100D0B', panel: '#17140F', line: '#252018', lineHi: '#322B21',
      red: '#AC3A30', redD: '#6E241E', gold: '#9A7E45',
      ink: '#D8CFBE', ink2: '#8C8375', ink3: '#565046',
      warm: 'rgba(196,140,60,0.02)',
      folder: '#2A251D', folderD: '#15120E', folderHi: '#3A342A', thread: '#8A8378'
    }),
    /* 结算：从夜里回到档案室 */
    report: mkTheme({
      bg: '#0D0B09', paper: '#30271A', panel: '#352E24', line: '#473D31', lineHi: '#594D3B',
      red: '#B4402F', redD: '#7E2A20', gold: '#C09A4E',
      ink: '#E4DBC9', ink2: '#A2988A', ink3: '#6E6456',
      warm: 'rgba(196,140,60,0.06)',
      folder: '#70603F', folderD: '#3A3022', folderHi: '#967E52', thread: '#E0D7C0'
    })
  };

  var ACTIVE_THEME = '';
  function applyTheme(name) {
    if (ACTIVE_THEME === name) return;
    var t = THEMES[name] || THEMES.march;
    ACTIVE_THEME = name;
    for (var k in t) if (t.hasOwnProperty(k)) C[k] = t[k];
  }
  applyTheme('cover');

  var SERIF = '"Songti SC","STSong","SimSun","Noto Serif CJK SC","Source Han Serif SC",serif';
  var SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  var NUM = '"Bahnschrift","DIN Alternate","Segoe UI","Helvetica Neue",sans-serif';

  function F(size, fam, weight) {
    return (weight || 'normal') + ' ' + size + 'px ' + fam;
  }

  /* ---------------------------------------------------------------- 工具 */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function n2(x) { return x < 10 ? '0' + x : '' + x; }
  var CN_NUM = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九'];
  var DAY_LABELS = ['8.21', '8.22', '8.23', '8.24', '8.25', '8.26', '8.27'];
  function dayLabelOf(day) { return DAY_LABELS[clamp(day - 1, 0, 6)]; }

  /* 把 #RRGGBB 拆成带透明度的 rgba，让所有新图层都能从主题色派生 */
  function hexA(hex, a) {
    var h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    if (h.length === 3) h = h.charAt(0)+h.charAt(0)+h.charAt(1)+h.charAt(1)+h.charAt(2)+h.charAt(2);
    var n = parseInt(h, 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* --------------------------------------------------------- 中文换行 */
  var NO_HEAD = '，。、；：？！）》」』%”’…·';
  var NO_TAIL = '（《「『“‘';

  function wrapCN(ctx, text, maxW) {
    var lines = [], line = '', w = 0;
    var chars = Array.from(text);
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch === '\n') { lines.push(line); line = ''; w = 0; continue; }
      var cw = ctx.measureText(ch).width;
      if (w + cw > maxW && line.length) {
        if (NO_HEAD.indexOf(ch) >= 0) { line += ch; w += cw; continue; }
        var last = line.charAt(line.length - 1);
        if (NO_TAIL.indexOf(last) >= 0) {
          line = line.slice(0, -1);
          lines.push(line);
          line = last + ch;
          w = ctx.measureText(line).width;
          continue;
        }
        lines.push(line); line = ch; w = cw;
      } else {
        line += ch; w += cw;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /* ------------------------------------------------------ 打字机时间轴 */
  function makeTimeline(text, cps) {
    var chars = Array.from(text), times = [], t = 0, gap = 1000 / cps;
    for (var i = 0; i < chars.length; i++) {
      times.push(t);
      t += gap;
      if ('。！？'.indexOf(chars[i]) >= 0) t += 170;
      else if ('，、；：'.indexOf(chars[i]) >= 0) t += 80;
    }
    return { chars: chars, times: times, total: t };
  }

  function shownCount(tl, ms) {
    var n = 0;
    for (var i = 0; i < tl.times.length; i++) {
      if (ms >= tl.times[i]) n = i + 1; else break;
    }
    return n;
  }

  /* ================================================================ 数据 */
  var SOLDIERS = [
    { id: 'shi', name: '石大勇', age: 28, role: '副连长', hp: 78, load: 2, tags: ['党员'] },
    { id: 'he', name: '何永福', age: 34, role: '司务长', hp: 68, load: 2, tags: ['党员'] },
    { id: 'wang', name: '王二柱', age: 20, role: '机枪手', hp: 86, load: 3, tags: ['会水'] },
    { id: 'lin', name: '林　秋', age: 21, role: '卫生员', hp: 58, load: 1, tags: [] },
    { id: 'awang', name: '阿　旺', age: 51, role: '通　司', hp: 50, load: 0, tags: ['藏语'] },
    { id: 'shitou', name: '石　头', age: 16, role: '通信员', hp: 44, load: 0, tags: [] }
  ];


  /* ============================================================ 像素头像 */
  /* 16×16 字符网格。'.'=透明，1..5 对应 pal[1..5] */
  var AVATAR = {
    shi: {                                   /* 石大勇 28 副连长 · 八角帽红五星 · 胡茬 */
      pal: ['', '#CBA07A', '#221E19', '#6E6E63', '#59564B', '#B2422F', '#A5805E'],
      map: [
        '................',
        '....33333333....',
        '...3333333333...',
        '..333555333333..',
        '.33333333333333.',
        '..222222222222..',
        '....11111111....',
        '....11211121....',
        '....61111116....',
        '....62222226....',
        '.....1666661....',
        '......1111......',
        '....44444444....',
        '...4444444444...',
        '...44.4444.44...',
        '......4444......'
      ]
    },
    he: {                                    /* 何永福 34 司务长 · 圆脸 · 领口油渍 */
      pal: ['', '#D0A67E', '#221E19', '#66665C', '#5E5A4E', '#3A352C', '#AA8560'],
      map: [
        '................',
        '....33333333....',
        '...3333333333...',
        '..333333333333..',
        '.33333333333333.',
        '..222222222222..',
        '....11111111....',
        '....11211121....',
        '....11111111....',
        '....61111116....',
        '.....1111111....',
        '......1111......',
        '....44444444....',
        '...4444444444...',
        '...44.4444.44...',
        '.....644444.....'
      ]
    },
    wang: {                                  /* 王二柱 20 机枪手 · 寸头 · 肩最宽 */
      pal: ['', '#BE8B60', '#1E1A16', '#5E5E55', '#565247', '#000000', '#9C704C'],
      map: [
        '................',
        '.....2222222....',
        '....222222222...',
        '...22222222222..',
        '....11111111....',
        '....11211121....',
        '....61111116....',
        '....61111116....',
        '.....1666661....',
        '......1111......',
        '..444444444444..',
        '.44444444444444.',
        '.44444444444444.',
        '.4444.4444.4444.',
        '......4444......',
        '................'
      ]
    },
    lin: {                                   /* 林秋 21 卫生员 · 齐耳短发 · 领口红十字 */
      pal: ['', '#D6AF8B', '#26221C', '#68685D', '#5C5A53', '#B2422F', '#B08C66'],
      map: [
        '................',
        '.....2222222....',
        '....222222222...',
        '...22222222222..',
        '...2211111122...',
        '...2112111212...',
        '...2611111162...',
        '....61111116....',
        '.....1666661....',
        '......1111......',
        '....44444444....',
        '....444554444...',
        '....44444444....',
        '.....444444.....',
        '................',
        '................'
      ]
    },
    awang: {                                 /* 阿旺 51 藏族通司 · 宽檐毡帽 · 白胡子 */
      pal: ['', '#AE8059', '#221E19', '#5C5C51', '#4E463C', '#DCD6C8', '#8C6748'],
      map: [
        '................',
        '....33333333....',
        '..333333333333..',
        '.33333333333333.',
        '..111111111111..',
        '....11211121....',
        '....11111111....',
        '....11111111....',
        '.....1555551....',
        '......1111......',
        '....44444444....',
        '...4444444444...',
        '...44.4444.44...',
        '......4444......',
        '................',
        '................'
      ]
    },
    shitou: {                                  /* 石头 16 通信员 · 帽子太大 · 脸圆 */
      pal: ['', '#D4AA86', '#221E19', '#6A6A5F', '#56544A', '#000000', '#B08C66'],
      map: [
        '................',
        '...3333333333...',
        '..333333333333..',
        '.33333333333333.',
        '..222222222222..',
        '....11111111....',
        '....11211121....',
        '....61111116....',
        '.....1666661....',
        '......1111......',
        '....44444444....',
        '...4444444444...',
        '...44.4444.44...',
        '......4444......',
        '................',
        '................'
      ]
    }
  };

  /* size 必须是 16 的整数倍，保证格子不落在半像素上 */

  /* 泥沼特写：只画头到肩的前 N 行，水下部分交给调用方裁切 */
  function drawAvatarHead(ctx, id, x, y, cell, rows) {
    var a = AVATAR[id];
    if (!a) return;
    for (var r = 0; r < (rows || 11); r++) {
      var row = a.map[r];
      if (!row) continue;
      for (var c = 0; c < 16; c++) {
        var ch = row.charAt(c);
        if (ch === '.') continue;
        var col = a.pal[+ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x + c * cell, y + r * cell, cell + 0.5, cell + 0.5);
      }
    }
  }
  function drawAvatar(ctx, id, x, y, size, dead) {
    var a = AVATAR[id];
    if (!a) return;
    var cell = size / 16, r, c, ch, col;
    for (r = 0; r < 16; r++) {
      var row = a.map[r];
      for (c = 0; c < 16; c++) {
        ch = row.charAt(c);
        if (ch === '.') continue;
        col = a.pal[+ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x + c * cell, y + r * cell, cell + 0.4, cell + 0.4);
      }
    }
    if (dead) {
      /* 去色：蒙一层纸色，脸还看得见，但没了活气 */
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = C.paper;
      ctx.fillRect(x, y, size, size);
      ctx.globalAlpha = 1;
      if (size >= 32) {
        ctx.strokeStyle = C.red;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3);
        ctx.lineTo(x + size - 3, y + size - 3);
        ctx.stroke();
      }
    }
  }

  var SOURCES = [
    '杨成武《忆长征》：当我们熬过一个夜晚，离开宿营地继续前进时，有的战友就长眠在我们共同躺过的营地上。',
    '郑金煜，十七岁，进草地第四天：我在政治上像块钢铁，但我的腿不管用，我要掉队了。',
    '红三军团某连九个炊事员全部牺牲，全连无一人因饥饿死亡。到陕北时，那口铜锅还在司务长肩上。',
    '周广才全班七人七根皮带，吃到第六根时他不肯交最后一根，在皮带背面烫下两个字：长征记。',
    '徐国珍回忆：进草地第二天，那天还没走到露营点，我就掩埋了十九位同志。',
    '藏民称红军为“撒马尔”——藏语里“吃”的意思。什么东西都吃的队伍。',
    '王平回忆班佑河：河滩上坐着至少有七八百人，都静静地背靠背，一动不动。我俯下身子逐个查看，全都没气了。'
  ];

  var ENDINGS = [
    { min: 0, max: 0, title: '无一人归队', cond: '0 人走出',
      lede: '8 月 28 日清晨，班佑河以南，这个连队没有一个人站起来。',
      desc: '这样的连队，不止一个。班佑河那一夜，七八百人背靠背坐着，天亮时都没有再站起来。' },
    { min: 1, max: 2, title: '减员过半', cond: '1—2 人走出',
      lede: '六个人进草地，{n}个人走出来。这不是最坏的一支部队。',
      desc: '红一方面军过草地前近两万人，出草地一万三千人。减员三分之一，是这条路的平均价。' },
    { min: 3, max: 5, title: '走出草地', cond: '3—5 人走出',
      lede: '8 月 27 日，班佑。走出草地的，是红一方面军一万三千人中的一个连。',
      desc: '走到班佑不等于走完。前面还有腊子口，还有六盘山，还有一整年的路。' },
    { min: 6, max: 6, title: '一个不少', cond: '6 人走出',
      lede: '六个人进去，六个人出来。1935 年 8 月的草地上，这种情况很少。',
      desc: '多数连队没有这样幸运。你做到了，但这不说明你比他们强，只说明你运气好，或者算得准。' }
  ];


  /* ============================================================ 最后的话 */
  /* 死法带「泥沼」「冲走」「滑落」的，走静默分支：不编台词 */
  /* ============================================================ 选择的反应 */
  /* 每个选项之后，有人会说话。谁开口、说什么，跟着选择走 */
  var REACTIONS = {
    a1: {
      full: [
        ['he', '一天十二斤。三天见底。'],
        ['shi', '命令是十五斤，我们只有六斤。按实数吃，别瞒。'],
        ['he', '三天以后呢？'],
        ['shi', '三天以后，吃野菜，吃皮带。']
      ],
      half: [
        ['he', '一天六斤。能吃到第七天。'],
        ['lin', '半饱走路，人会先垮。'],
        ['shi', '垮也得走。粮就这么多。']
      ],
      sick: [
        ['lin', '阿旺五十一了。石头十六。'],
        ['he', '那就先紧着他们两个。'],
        ['wang', '我扛得住。我不饿。']
      ]
    },
    a2: {
      weed: [
        ['shi', '我先尝。尝完了再分。'],
        ['he', function (st) {
          return '才第三天。粮只剩 ' + Math.round(st.grain) + ' 斤了。';
        }],
        ['shi', '等吃完再找，就晚了。先头部队已经动身了。']
      ],
      belt: [
        ['he', '六条。三天一条，能吃到班佑。'],
        ['wang', '我这条是新的。'],
        ['he', '新的也是牛皮。']
      ],
      horse: [
        ['he', '骡子驮着阿旺的担架。'],
        ['shi', '杀了。阿旺我背。'],
        ['awang', '我自己走。不用背。']
      ]
    },
    a3: {
      party: [
        ['shi', '我是党员。我先。'],
        ['he', '你倒了，全连谁带？'],
        ['shi', '你带。']
      ],
      all: [
        ['he', '党员先喝第一口。第一口我的，第二口老石。全连同一锅。'],
        ['lin', '真要有毒，谁负责？'],
        ['shi', '要死，先死我们几个党员。'],
        ['he', '我负责。出了事，第一个名字写我。']
      ],
      none: [
        ['he', '倒了？……可惜了。'],
        ['shi', '吃死了，一顿就是最后一顿。'],
        ['he', '……那倒吧。']
      ]
    },
    a5: {
      sit: [
        ['shi', function (st) {
          var n = aliveList(st).length;
          return '背靠背坐紧些。' + (n >= 2 ? '两人守夜。' : '火别灭。');
        }],
        ['he', function (st) {
          return st.fuel > 0 ? '柴只够烧' + (CN_NUM[st.fuel] || st.fuel) + '夜。' : '柴不够了。';
        }],
        ['shi', '今夜先烧。']
      ],
      crowd: [
        ['he', '省柴。都挤过来。'],
        ['lin', '没人守夜，睡死了都不知道。'],
        ['he', '……挤紧点。谁醒着，谁听动静。']
      ],
      weak: [
        ['lin', function (st) {
          var ids = st.campWeak || [], names = [], i, m;
          for (i = 0; i < ids.length; i++) {
            m = members(st, ids[i]);
            if (m) names.push(m.name.replace(/\s/g, ''));
          }
          return (names.join('和') || '他们') + '撑不住了。让他们躺平。';
        }],
        ['shi', '躺下就湿透了。'],
        ['lin', '坐着，他们也熬不过今夜。']
      ],
      lie: [
        ['he', '火生起来，都躺下。'],
        ['shi', '这里没有干地。'],
        ['he', '火能顶一阵。']
      ]
    },
    a6: {
      wait: [
        ['shi', '天黑，水情不明。等天亮。'],
        ['wang', '我会水。我先探。'],
        ['shi', '等。这是命令。']
      ],
      rush: [
        ['wang', '我会水，我打头。'],
        ['he', '绳子呢？'],
        ['shi', '来不及了。下水。党员在前。']
      ],
      rope: [
        ['shi', function (st) {
          var n = aliveList(st).length;
          return '绑腿解下来，搓成绳。' + (n >= 3 ? '三人一批。' : '一起过。');
        }],
        ['lin', '我先过，探水。'],
        ['shi', '一起。']
      ],
      up: [
        ['awang', '上游三里，可能有浅滩。'],
        ['shi', '三里，来回六里。天要黑了。'],
        ['awang', '总比瞎下水强。']
      ]
    }
  };

  /* 死法不同，最后一幕也不同：泥沼、河水、睡熟、夜里失温不能共用一套场景 */
  var CAMP_SCENES = {
    weak: '躺在湿草上。后半夜，身下的水一点一点渗了上来。',
    crowd: '没有人守夜。天亮时，最外面那个已经硬了。',
    lie: '火只暖一面。背上的衣服结了冰。'
  };
  var RIVER_SCENES = {
    wait: '南岸没有遮拦。背靠背坐着，雨下了一夜。',
    up: '上游没有浅滩。跟着队伍往回走，天黑在河坎上，雨没停。'
  };
  var STARVE_SCENES = {
    shi: '他走在队伍最后，名单攥在手里。雪落上去，字化了。',
    he: '他背着锅，走一段，歇一段。锅先落了地。',
    wang: '他扛着枪走在队尾。枪先倒在草里。',
    lin: '她背着药包走在最后。前面的人回头时，她已经坐下了。',
    awang: '他拄着竹棍落在最后。北边看不见了。',
    shitou: '他走在最后，鞋陷在泥里。他没有力气拔出来。'
  };
  var RESCUE_SCENE = '伸手去拉，草皮塌了。两个人一起往下沉。';

  var CAMP_WORDS = {
    shi: { sit: '火别灭。……我守到天亮。', crowd: '没人守夜。……我该醒着的。',
           weak: '躺下……就起不来了。', lie: '火只暖一面。……背上是水。' },
    he:  { sit: '锅在火上。……别让它灭了。', crowd: '都挤在一起。……谁也没醒。',
           weak: '地上是水。……我不该让他们躺。', lie: '柴烧完了。……后半夜最冷。' },
    wang:{ sit: '我值后半夜。……没撑住。', crowd: '睡过去……就没人叫了。',
           weak: '坐着还能活。……躺下就完了。', lie: '火灭了。……我该添柴。' },
    lin: { sit: '火边还有位置。……你们坐。', crowd: '我该醒着。……都睡死了。',
           weak: '我是卫生员。……我知道不能躺。', lie: '都躺下了。……火一灭就完了。' },
    awang:{ sit: '我听见雨停了。……天快亮了。', crowd: '我听见泥响。……没人应。',
           weak: '我老了。……不该占那块干草。', lie: '火烤着胸口。……背后是泥。' },
    shitou:{ sit: '我守着火。……没守住。', crowd: '我喊了。……没人听见。',
           weak: '他们说躺下暖和。……骗人。', lie: '我靠着火。……还是冷。' }
  };

  var RIVER_WORDS = {
    shi: { wait: '我说等天亮。……天亮得太晚了。', up: '三里。多走了三里。……还是没过去。' },
    he:  { wait: '锅里还有一把米。……明早煮。', up: '锅还在。……人没了。' },
    wang:{ wait: '我会水。该我先下。……不该等。', up: '上游没浅滩。……我不该信。' },
    lin: { wait: '都冻透了。……搓不热。', up: '谁也没想到。……会冻死在这条河边。' },
    awang:{ wait: '我说往北。没说等。', up: '我记错了。……不是这里。' },
    shitou:{ wait: '天亮了吗？……我脚没知觉了。', up: '还要走多远？……我走不动了。' }
  };

  var STARVE_WORDS = {
    shi: { full: '粮早就见底了。……按实数吃，没错。', half: '半饱走了七天。……腿不听使唤。', sick: '病号先吃。……我没事。' },
    he:  { full: '最后一把米，我数着下的。……还是不够。', half: '半饱。……锅里越来越清。', sick: '先紧着他们。……我不饿。' },
    wang:{ full: '按实数吃。……我扛得住。', half: '半饱也能扛枪。……今天扛不动了。', sick: '我不用先吃。……给石头。' },
    lin: { full: '粮断了。……我这里没有药，也没有吃的。', half: '半饱。……人先垮的是腿。', sick: '病号先吃。……我还能走。' },
    awang:{ full: '粮断了。……我认得野菜，可我走不动了。', half: '半饱。……草地不给人留力气。', sick: '先紧着孩子。……我老了，不亏。' },
    shitou:{ full: '粮断了。……我还能走。', half: '半饱。……我脚小，走得慢。', sick: '我先吃。……哥，你别省给我。' }
  };

  var POISON_ALL = {
    shi: '一起喝的……不怪谁。',
    he: '一锅都喝了。……别怪谁。',
    wang: '一人一碗。……不怪司务长。',
    lin: '都喝了。我数过，六个人。……我救不了。',
    awang: '这锅菜是我看着采的。……怪我。',
    shitou: '大家都喝了。……我也不疼。'
  };
  var POISON_BELT = {
    shi: '先尝的是我。皮带汤没事，是野菜。',
    he: '皮带汤……野菜是后撒的。不怪皮带。',
    wang: '皮带汤我喝了两碗。……野菜一口。',
    lin: '皮带汤没毒。是那把野菜。……记住。',
    awang: '野菜是我认的。皮带没错。',
    shitou: '皮带汤是咸的。野菜是苦的。'
  };
  var POISON_HORSE = {
    shi: '先尝的是我。骡肉没事，是野菜。',
    he: '骡肉汤……野菜是后撒的。肉没问题。',
    wang: '骡肉我吃了两天。……不亏。',
    lin: '骡肉汤没毒。是野菜。……记下来。',
    awang: '骡子没了。……我也不该怪这锅菜。',
    shitou: '有肉。好久没吃肉了。……不怪肉。'
  };

  var LAST_WORDS = {
    shi: {
      relic: '党证。夹层里压着一片干了的野菜叶。',
      poison: { scene: '他吐了一地绿水，手肿得握不住东西。',
                words: '告诉他们……是我先尝的。跟野菜没关系。' },
      bog:    { scene: '泥没到胸口。他没挣，先把手举起来，让后面的人停。',
                words: '别拉我。你们走。前面还有四天。' },
      cold:   { scene: '天亮前他还在数人头。数到第五个，没有声了。',
                words: '一、二、三……你们走。我数完就来。' },
      river:  { scene: '水到胸口。他把党证举过头顶，脚下一空。' },
      slip:   { scene: '他在河坎上探路，脚下一滑，人就没进水里。后面的人没看见。' },
      sleep:  { scene: '天亮前他还坐着。再去看，泥面上只剩一道压痕。' }
    },
    he: {
      relic: '一口铜锅。锅底结着一层野菜汤的印子，刮不掉了。',
      poison: { scene: '他蹲在锅边，勺子插回锅里，插了两次才插稳。',
                words: '火别灭。锅里还有。……我不饿。' },
      bog:    { scene: '他先把锅从背上解下来，往硬地上推，人还在往下走。',
                words: '锅接住。别让它进水。' },
      cold:   { scene: '后半夜他坐起来，把锅盖在两个人膝上，又坐下。',
                words: '明天少下两把米。看着他们吃。' },
      river:  { scene: '他把锅举过头顶，水先没过了锅沿。' },
      slip:   { scene: '他背着锅走在岸上，脚下一滑，连人带锅滚进河里。' },
      sleep:  { scene: '他把锅抱在怀里睡着。锅还在，人陷下去了。' }
    },
    wang: {
      relic: '一条牛皮机枪背带。后来被切成段，煮了。',
      poison: { scene: '他吐完了，仰面躺着，手在身侧抓草，抓了两把都是空的。',
                words: '没事。明天……明天我扛得动枪。' },
      bog:    { scene: '泥面合得很快。他没有喊，先回过头看了后面一眼。',
                words: '别过来。这底下……都是软的。' },
      cold:   { scene: '他把雨布扯下来盖在别人背上，自己靠着枪坐下。',
                words: '天亮叫我。我就眯一会儿。' },
      river:  { scene: '他会水，游到中间，回头看了一眼。' },
      slip:   { scene: '他走在最前面探浅滩，岸边的草皮塌了。' },
      sleep:  { scene: '他靠着枪睡熟，翻身时滚进了泥里。没有人察觉。' }
    },
    lin: {
      relic: '两片奎宁，油纸包着。纸上有她的字：阿旺，一日两次。',
      poison: { scene: '她给自己催吐，吐到只剩苦水，人往旁边倒。',
                words: '药包第三层。两片白的。给阿旺。' },
      bog:    { scene: '她被拖住的时候，先把背上的药包甩到了岸上。',
                words: '先拿药包。别管我。' },
      cold:   { scene: '她最后一个坐下，手还搭在旁边人的腕子上，搭着搭着不动了。',
                words: '都有脉……都还在。' },
      river:  { scene: '她把药包顶在头上，绳子从手里滑出去。' },
      slip:   { scene: '她跟着队伍往上游走，踩滑了河坎。' },
      sleep:  { scene: '她最后一个睡。手还伸向旁边的人，人已经陷下去了。' }
    },
    awang: {
      relic: '一根削尖的竹棍。握的那一头磨得发亮。',
      poison: { scene: '他把嚼过的草吐在手心，看了很久，扔进泥里。',
                words: '这个草我没见过。……怪我。' },
      bog:    { scene: '他把竹棍横过来卡在泥面上，人一点一点往下坠。',
                words: '踩我肩膀。上去一个是一个。' },
      cold:   { scene: '他朝北坐着，一只手抬起来指着前面，没有放下去。',
                words: '往北。别绕。绕就出不去。' },
      river:  { scene: '他抓着竹棍探底，竹棍被水冲斜了。' },
      slip:   { scene: '他拿竹棍探着河岸，竹棍先滑，人跟着下去。' },
      sleep:  { scene: '他朝北坐着睡过去。竹棍倒在泥面上。' }
    },
    shitou: {
      relic: '一双布鞋，白布底，纳了七层。',
      poison: { scene: '他把鞋脱下来抱在怀里，人蜷成一团。',
                words: '我娘说，走不动就脱鞋。脚就不疼了。' },
      bog:    { scene: '他一只手举着，举得很直，像在报告。',
                words: '报告……我陷住了。' },
      cold:   { scene: '他把两只鞋摆在草墩上，摆得整整齐齐，脚缩到身子底下。',
                words: '我鞋。我娘纳的底。捎回去。' },
      river:  { scene: '他个子最矮，水先没过肩膀。他没有喊。' },
      slip:   { scene: '他走在队伍最后，脚下一滑，没人听见。' },
      sleep:  { scene: '他把鞋抱在怀里睡着。鞋还在草墩上。' }
    }
  };

  /* 死因归类：中毒 → 泥沼/落水 → 冻饿（最后是兜底） */
  function causeClass(cause) {
    if (!cause) return 'cold';
    if (cause.indexOf('中毒') >= 0) return 'poison';
    if (cause.indexOf('泥沼') >= 0 || cause.indexOf('陷落') >= 0 ||
        cause.indexOf('冲走') >= 0 || cause.indexOf('滑落') >= 0) return 'bog';
    return 'cold';
  }

  /* 同一死因，也要看是哪一步把人推到这里的 */
  function poisonWords(id, w, st) {
    if (st && st.weedTaste === 'all') {
      if (id === 'shi') {
        return { scene: '他吐得最厉害。第一碗是他端给别人的。',
                 words: POISON_ALL.shi };
      }
      return { scene: w.poison.scene, words: POISON_ALL[id] || w.poison.words };
    }
    if (st && st.extra === 'belt') {
      return { scene: w.poison.scene, words: POISON_BELT[id] || w.poison.words };
    }
    if (st && st.extra === 'horse') {
      return { scene: w.poison.scene, words: POISON_HORSE[id] || w.poison.words };
    }
    return w.poison;
  }

  function campWords(id, w, st) {
    var camp = st && st.camp;
    if (!camp || !CAMP_WORDS[id] || !CAMP_WORDS[id][camp]) return w.cold;
    return {
      scene: camp === 'sit' ? w.cold.scene : (CAMP_SCENES[camp] || w.cold.scene),
      words: CAMP_WORDS[id][camp]
    };
  }

  function riverWords(id, w, st) {
    var r = st && st.river;
    if (r === 'up') {
      return { scene: RIVER_SCENES.up, words: (RIVER_WORDS[id] && RIVER_WORDS[id].up) || w.cold.words };
    }
    return { scene: RIVER_SCENES.wait, words: (RIVER_WORDS[id] && RIVER_WORDS[id].wait) || w.cold.words };
  }

  function starveWords(id, w, st) {
    var ration = st && st.ration;
    var words = (STARVE_WORDS[id] && STARVE_WORDS[id][ration]) || w.cold.words;
    return { scene: STARVE_SCENES[id] || w.cold.scene, words: words };
  }

  function lastWordsFor(id, cause, st) {
    var w = LAST_WORDS[id];
    if (!w) return null;
    var c = cause || '';
    if (c.indexOf('冲走') >= 0) return { scene: w.river.scene, words: null };
    if (c.indexOf('滑落') >= 0) return { scene: w.slip.scene, words: null };
    if (c.indexOf('睡熟') >= 0) return { scene: w.sleep.scene, words: null };
    if (c.indexOf('伸手去拉') >= 0) return { scene: RESCUE_SCENE, words: null };
    if (c.indexOf('中毒') >= 0) return poisonWords(id, w, st);
    if (c.indexOf('南岸') >= 0) return riverWords(id, w, st);
    if (c.indexOf('夜间失温') >= 0) return campWords(id, w, st);
    if (c.indexOf('掉队') >= 0) {
      if (id === 'awang' && st && st.horse === 0) {
        return { scene: '他一直落在最后面。没有人驮他了。',
                 words: '骡子……不该杀。我不是怪你。' };
      }
      return starveWords(id, w, st);
    }
    return w[causeClass(c)] || w.cold;
  }

  var SILENT_CAUSES = ['冲走', '滑落', '睡熟', '伸手去拉'];
  function isSilent(cause) {
    if (!cause) return false;
    for (var i = 0; i < SILENT_CAUSES.length; i++) {
      if (cause.indexOf(SILENT_CAUSES[i]) >= 0) return true;
    }
    return false;
  }


  /* ================================================================ 剧本 */
  /* settle：进入这一幕前先结算几天 */
  var BEATS = [

    /* ---------- 幕一 · 毛儿盖 ---------- */
    {
      id: 'a1', dayLabel: '8.21', place: '毛儿盖', li: 0, settle: 0, theme: 'march', deco: null,
      pages: [
        '出发的命令写得很清楚：每人备足干粮十五斤，一捆干柴。',
        '实际筹到的，每人六斤。多一两也没有。六个人，三十六斤。',
        '按每人一天二斤算，三天。第四天之后，就要开始吃别的东西。'
      ],
      source: '杨成武《忆长征》；《红军长征·表册》',
      choice: {
        q: '口粮定多少',
        hint: '定下去就不再改。',
        opts: [
          {
            key: 'full', no: '壹', title: '足量：每人每天二斤',
            sub: '三天吃完，第五天断粮',
            apply: function (st) { st.ration = 'full'; }
          },
          {
            key: 'half', no: '贰', title: '半量：每人每天一斤',
            sub: '能吃六天，但六天都是半饥',
            apply: function (st) { st.ration = 'half'; }
          },
          {
            key: 'sick', no: '叁', title: '病号优先',
            sub: '伤员、老人、孩子先吃，其余减半',
            apply: function (st) { st.ration = 'sick'; }
          }
        ]
      }
    },

    /* ---------- 幕二 · 断粮 ---------- */
    {
      id: 'a2', dayLabel: '8.23', place: '草地腹地', li: 140, settle: 2, theme: 'famine', deco: 'ash',
      pages: [
        function (st) {
          if (st.grain <= 0) return '第三天下午，炒面袋翻过来，抖了三下。没有了。';
          var rest = projectNeed(st, 4);          /* 到班佑还有四天 */
          var left = Math.round(st.grain);
          if (st.grain >= rest) {
            return '第三天下午，炒面还剩 ' + left + ' 斤。照现在这么吃，刚好走到班佑，一天余量都没有。';
          }
          return '第三天下午，炒面还剩 ' + left + ' 斤。照现在这么吃，还差 ' +
                 Math.round(rest - st.grain) + ' 斤才够走到班佑。';
        },
        '走到班佑，一共七天。中间一天都耽搁不起。',
        '先头部队已经在挖野菜了。再晚，连草根都剩不下。'
      ],
      source: '红一方面军过草地前近二万人，出草地一万三千人',
      choice: {
        q: '今天除了干粮，还动哪一样',
        hint: '先动掉的，后面就没有了。',
        opts: [
          {
            key: 'weed', no: '壹', title: '拿野菜顶一部分口粮',
            sub: '口粮省四成，人吃不饱。皮带和骡子留着。',
            apply: function (st) { st.extra = 'none'; st.forage = true; st.forageEver = true; }
          },
          {
            key: 'belt', no: '贰', title: '煮皮带顶一部分口粮',
            sub: '口粮省三成，不挨饿。六条皮带，三天一条。',
            apply: function (st) { st.extra = 'belt'; st.forage = false; st.fuel = Math.max(0, st.fuel - 1); }
          },
          {
            key: 'horse', no: '叁', title: '杀骡子顶一部分口粮',
            sub: '口粮省六成，还能吃两天肉。伤号没人驮了。',
            apply: function (st) { st.extra = 'horse'; st.forage = false; st.horse = 0; st.meatDays = 2; }
          }
        ]
      }
    },

    /* ---------- 幕三 · 谁先尝 ---------- */
    {
      id: 'a3', dayLabel: '8.24', place: '草地腹地', li: 200, settle: 1, theme: 'famine', deco: 'ash',
      pages: [
        function (st) {
          if (st.forage) return '第四天上午，锅里的野菜汤煮开了。';
          if (st.extra === 'belt') return '第四天上午，皮带汤煮开了。何永福把皮带汤盛在一边，另煮了一锅野菜——今天要试的是野菜。';
          return '第四天上午，骡肉汤煮开了。肉只够两天，何永福把肉留给阿旺和石头，另煮了一锅野菜——今天要试的是野菜。';
        },
        function (st) {
          var left = st.grain;
          if (left <= 0) {
            if (st.extra === 'belt') return '干粮吃光了。皮带汤是今天的主食，野菜是配的。';
            if (st.extra === 'horse') return '干粮吃光了。骡肉汤是今天的主食，野菜是配的。';
            return '干粮昨天就吃光了。这一锅就是全连今天全部的东西。';
          }
          return '干粮还剩 ' + Math.round(left) + ' 斤。可这条路要走几天，谁也说不准。';
        },
        function (st) {
          var t = st.forage
            ? '野菜是掺着粮食吃的。今天这一锅，就是拿来顶那四成口粮的。没有人知道它有没有毒——上个月已经有连队因为这个，一个班没了。'
            : '野菜是配着吃的，不是拿来顶饭的。没有人知道这一锅有没有毒——上个月已经有连队因为这个，一个班没了。';
          var aw = members(st, 'awang');
          if (st.horse === 0 && aw && aw.alive) t += '阿旺落在最后面。骡子没了，他得自己走。';
          else if (st.extra === 'belt') t += '皮带还剩 ' + st.belt + ' 条。何永福每天数一遍。';
          return t;
        }
      ],
      source: '红军过草地时各连的野菜检验办法；杨成武《忆长征》',
      choice: {
        q: '谁先尝第一口',
        hint: '',
        opts: [
          {
            key: 'party', no: '壹', title: '党员干部先尝',
            sub: '石大勇站出来。他二十八岁，党员。',
            apply: function (st) { st.weedTaste = 'party'; }
          },
          {
            key: 'all', no: '贰', title: '党员先喝第一口，全连一起喝',
            sub: '不另设试毒。党员先喝第一口，全连同一锅一起喝。',
            apply: function (st) { st.weedTaste = 'all'; }
          },
          {
            key: 'none', no: '叁',
            title: function (st) {
              if (st.extra === 'belt') return '倒掉野菜锅，皮带汤照吃';
              if (st.extra === 'horse') return '倒掉野菜锅，骡肉汤照吃';
              return st.grain > 0 ? '倒掉，这一锅不吃' : '倒掉，今天饿着';
            },
            sub: function (st) {
              if (st.extra === 'belt') return '不冒险。皮带汤是安全的。';
              if (st.extra === 'horse') return '不冒险。骡肉是安全的。';
              return st.grain > 0 ? '不冒险。锅倒掉，干粮照吃。' : '不冒险。今天没有吃的。';
            },
            apply: function (st) { st.weedTaste = 'none'; }
          }
        ]
      }
    },

    /* ---------- 幕四 · 泥沼 ---------- */
    {
      id: 'a4', dayLabel: '8.24', place: '沼泽带', li: 215, settle: 0, then: 'bog', theme: 'mud', deco: 'mist',
      pages: [
        function (st) {
          var v = pickVictim(st);
          return '下午，' + (v ? v.name.replace(/\s/g, '') : '有人') + '走在最前面，一脚踩空。';
        },
        '泥面合上了，只露出一副肩膀和头。没有喊，只是看着你们。'
      ],
      source: '张云晓回忆：陷者立即趴下，其他人伸一根杆子或扔一条绳子拉出'
    },

    /* ---------- 幕五 · 宿营 ---------- */
    {
      id: 'a5', dayLabel: '8.24', place: '无名宿营地', li: 215, settle: 0, theme: 'night', deco: 'rain',
      pages: [
        '天黑之前，雨下起来了。',
        function (st) {
          var t = '这一片没有一块干地。草甸下面是水，人躺下去，衣服就湿透了。';
          var low = [];
          for (var i = 0; i < st.roster.length; i++) {
            if (st.roster[i].alive && st.roster[i].hp <= 20) low.push(st.roster[i].name.replace(/\s/g, ''));
          }
          if (low.length) t += low.join('、') + ' 已经一天没怎么吃东西了。';
          return t;
        }
      ],
      source: '杨成武：我们只能硬挺挺地坐着，背靠着背，半醒不睡地坐着，给雨淋着',
      choice: {
        q: '今晚怎么过',
        hint: '',
        opts: [
          {
            key: 'sit', no: '壹', title: '全连背靠背坐着，轮岗，生一堆火',
            sub: '费柴。睡不好。',
            apply: function (st) { st.camp = 'sit'; }
          },
          {
            key: 'crowd', no: '贰', title: '挤在一起睡，不点火',
            sub: '省柴。没有人守夜。',
            apply: function (st) { st.camp = 'crowd'; }
          },
          {
            key: 'weak', no: '叁',
            title: function (st) {
              var n = aliveList(st).length;
              return n >= 2 ? '让体力最差的两个人躺下，其余坐着' : '让最后一个人躺下';
            },
            sub: '他们撑不住了，该让他们好好睡一觉。',
            apply: function (st) { st.camp = 'weak'; }
          },
          {
            key: 'lie', no: '肆', title: '生火，全都躺下',
            sub: '火能顶一阵。',
            apply: function (st) { st.camp = 'lie'; }
          }
        ]
      }
    },

    /* ---------- 幕六 · 班佑河 ---------- */
    {
      id: 'a6', dayLabel: '8.27', place: '班佑河途中', li: 500, settle: 3, theme: 'river', deco: 'rain',
      pages: [
        '8 月 27 日黄昏。班佑河。',
        '河面二十多米。暴雨之后，水涨到齐腰。对岸就是班佑——走出草地的地方。',
        '身后还有部队。我们是后卫。',
        '天黑得很快。雨没有停的意思。'
      ],
      source: '王平回忆；中央党史和文献研究院',
      choice: {
        q: '渡，还是不渡',
        hint: '',
        opts: [
          {
            key: 'wait', no: '壹', title: '今夜不过，原地休息，天亮再渡',
            sub: '参谋意见：水情不明，不宜夜间下水。南岸无遮无拦。',
            apply: function (st) { st.river = 'wait'; }
          },
          {
            key: 'rush', no: '贰', title: '立即全连渡河，一次过完',
            sub: function (st) {
              var n = aliveList(st).length;
              return '参谋估算：预计冲走 ' + Math.min(2, Math.max(0, n - 1)) + ' 人。';
            },
            apply: function (st) { st.river = 'rush'; }
          },
          {
            key: 'rope', no: '叁',
            title: function (st) {
              var n = aliveList(st).length;
              return '先派' + CN_NUM[Math.min(3, n || 1)] + '人试渡，绑腿搓绳固定，再分批过';
            },
            sub: '参谋估算：不会有人被冲走。多耗半个时辰。',
            apply: function (st) { st.river = 'rope'; }
          },
          {
            key: 'up', no: '肆', title: '沿河上游找浅滩',
            sub: '情况不明。',
            apply: function (st) { st.river = 'up'; }
          }
        ]
      }
    }
  ];

  var CARD_SEED = 0;
  var ENDING_SEEN = {};

  /* 无音效：仓库规定不使用 WebAudio，遗言页只保留视觉节奏 */

  /* ================================================================ 状态 */
  function cloneRoster() {
    var out = [];
    for (var i = 0; i < SOLDIERS.length; i++) {
      var s = SOLDIERS[i];
      out.push({
        id: s.id, name: s.name, age: s.age, role: s.role,
        hp: s.hp, load: s.load, tags: s.tags.slice(),
        alive: true, sick: false, poison: 0,
        deathDay: null, deathCause: null, deathPlace: null
      });
    }
    return out;
  }

  function createState() {
    return {
      scene: 'cover',
      beat: -1,
      page: 0,
      sub: 'text',
      lock: 0,
      hover: null,
      press: null,
      t: 0,
      tl: null,
      tlKey: '',

      day: 1, dayLabel: '8.21', place: '毛儿盖', li: 0,
      grain: 36, fuel: 4, belt: 6, pole: 6, horse: 1,
      hungry: 0,
      ration: 'full',
      extra: null,
      forage: false,
      meatDays: 0,
      weedTaste: null,
      crop: null,
      camp: null,
      campWeak: null,
      river: null,

      roster: cloneRoster(),
      delta: null,
      log: [],
      bog: null,
      pendingWords: [],
      wordsFrom: 'beat',
      wordsEnterAt: 0,
      wordsSeen: 0,
      heartFor: null,
      reaction: null,
      pendingResolve: null,
      showEndings: false,
      forageEver: false,
      resultCards: null,
      confirmUntil: 0
    };
  }

  /* -------------------------------------------------------- 战斗减员 */
  function kill(st, id, cause) {
    for (var i = 0; i < st.roster.length; i++) {
      var s = st.roster[i];
      if (s.id === id && s.alive) {
        s.alive = false;
        s.hp = 0;
        s.deathDay = st.dayLabel;
        s.deathPlace = st.place;
        s.deathCause = cause;
        st.log.push({ day: st.dayLabel, text: s.name + '：' + cause });
        if (st.pendingWords) st.pendingWords.push(id);
        return s;
      }
    }
    return null;
  }

  function aliveList(st) {
    var a = [];
    for (var i = 0; i < st.roster.length; i++) if (st.roster[i].alive) a.push(st.roster[i]);
    return a;
  }

  function lowest(st) {
    var a = aliveList(st), m = null;
    for (var i = 0; i < a.length; i++) if (!m || a[i].hp < m.hp) m = a[i];
    return m;
  }

  function members(st, id) {
    for (var i = 0; i < st.roster.length; i++) if (st.roster[i].id === id) return st.roster[i];
    return null;
  }

  /* ------------------------------------------------------------ 每日结算 */
  /* 病号优先不只按体力：老人和孩子也算 —— 阿旺五十一，石头十六 */
  function isSick(s) {
    return s.hp < 45 || s.age >= 50 || s.age <= 16;
  }

  function dailyGrain(st) {
    var n = aliveList(st).length, need = 0, i;
    if (st.ration === 'full') need = n * 2;
    else if (st.ration === 'half') need = n * 1;
    else {
      var a = aliveList(st);
      for (i = 0; i < a.length; i++) need += (isSick(a[i]) ? 1.8 : 0.7);
    }
    return need;
  }

  /* 往后 N 天要多少粮。病号优先会随着人变弱越吃越多，不能拿今天的数乘天数 */
  function projectNeed(st, days) {
    var n = aliveList(st).length, i, d;
    if (st.ration === 'full') return n * 2 * days;
    if (st.ration === 'half') return n * 1 * days;

    var roster = [];
    for (i = 0; i < st.roster.length; i++) {
      var src = st.roster[i];
      roster.push({ alive: src.alive, hp: src.hp, age: src.age, load: src.load });
    }
    var total = 0;
    for (d = 0; d < days; d++) {
      var a = [], dayNeed = 0;
      for (i = 0; i < roster.length; i++) {
        if (!roster[i].alive) continue;
        dayNeed += isSick(roster[i]) ? 1.8 : 0.7;
        a.push(roster[i]);
      }
      total += dayNeed;
      for (i = 0; i < a.length; i++) {
        var p = a[i];
        var dd = -5 - (p.load >= 3 ? 1 : 0);
        if (!isSick(p)) dd -= 1;
        if (st.horse === 0 && p.hp < 40) dd -= 1;
        p.hp = clamp(p.hp + dd, 0, 100);
        if (st.day + d + 1 === 4) p.hp = clamp(p.hp - 2, 0, 100);
        if (p.hp <= 0) p.alive = false;
      }
    }
    return total;
  }

  function settleDay(st, rng) {
    st.day += 1;
    st.dayLabel = dayLabelOf(st.day);
    var i, s, a = aliveList(st);

    var gain = 0;
    var need = dailyGrain(st);
    var hasMeat = (st.extra === 'horse' && st.meatDays > 0);
    var hasBelt = (st.extra === 'belt' && st.belt > 0);

    if (st.grain >= need && st.grain > 0) {
      /* 有干粮，但替代食物能顶掉一部分 —— 这就是第三天的真决策 */
      var eat = need;
      if (st.forage) eat *= 0.6;
      else if (hasBelt) eat *= 0.7;
      else if (hasMeat) eat *= 0.4;

      st.grain = Math.max(0, Math.round((st.grain - eat) * 10) / 10);
      st.hungry = 0;
      gain = st.ration === 'full' ? 4 : (st.ration === 'half' ? 1 : 0);
      if (st.ration === 'sick') gain = 0;
      if (st.forage) gain = Math.max(0, gain - 2);   /* 野菜没多少热量，省粮的代价是吃不饱 */
      if (hasMeat) gain += 1;                        /* 骡肉有油水 */
    } else {
      if (st.grain > 0) st.grain = 0;
      st.hungry += 1;
      if (hasMeat) gain = 6;
      else if (hasBelt) gain = 4;
      else if (st.weedTaste === 'none') gain = -3 - st.hungry * 2;
      else if (st.forage || st.extra === 'none') gain = 2 - st.hungry;
      else gain = 2 - st.hungry;
    }

    /* --- 行军消耗 --- */
    var march = 5;
    for (i = 0; i < a.length; i++) {
      s = a[i];
      var d = gain - march - (s.load >= 3 ? 1 : 0);
      if (st.ration === 'sick' && !isSick(s)) d -= 1;
      if (st.horse === 0 && s.hp < 40) d -= 1;   /* 没了骡子，走不动的只能自己扛 */
      s.hp = clamp(s.hp + d, 0, 100);
      if (s.poison > 0) s.poison -= 1;
      if (s.hp <= 0) kill(st, s.id, '掉队，冻饿');
    }

    /* --- 消耗 --- */
    if (hasBelt && st.day % 3 === 0) st.belt = Math.max(0, st.belt - 1);
    if (st.meatDays > 0) st.meatDays -= 1;
    return gain;
  }

  /* ------------------------------------------------------------ 夜间判定 */
  function nightCheck(st, rng) {
    var a = aliveList(st), i, s, dead = [], sleep = null;
    var fire = (st.camp === 'sit' || st.camp === 'lie') && st.fuel > 0;
    var weakIds = st.campWeak || [];

    /* "让体力最差的两个人躺下"——就真的只让这两个人躺下 */
    if (st.camp === 'weak' && !weakIds.length) {
      var sorted = a.slice().sort(function (x, y) { return x.hp - y.hp; });
      weakIds = sorted.slice(0, 2).map(function (x) { return x.id; });
      st.campWeak = weakIds;
    }

    for (i = 0; i < a.length; i++) {
      s = a[i];
      var loss = 10;
      loss += 8;                       /* 雨夹雪 */
      if (s.hp < 40) loss += 6;
      if (s.poison > 0) loss += 4;

      if (st.camp === 'sit') {
        if (fire) loss -= 14;
      } else if (st.camp === 'weak') {
        if (weakIds.indexOf(s.id) >= 0) loss += 15;
        else loss -= 6;
      } else if (st.camp === 'lie') {
        loss += 15;
        if (fire) loss -= 5;
      }
      /* 站岗的人多受一份冷 */
      if (st.camp === 'sit' && s.hp >= 55 && s.id === 'wang') loss += 6;

      loss = clamp(loss, 0, 60);
      s.hp = clamp(s.hp - loss, 0, 100);
      if (s.hp <= 0) { kill(st, s.id, '夜间失温'); dead.push(s.id); }
    }

    /* 无人守夜 → 有人睡熟滚进泥沼 */
    if ((st.camp === 'crowd' || st.camp === 'lie') && rng() < 0.35) {
      var v = lowest(st);
      if (v) {
        kill(st, v.id, '睡熟滚入泥沼，无人察觉');
        sleep = v.id;
        dead.push(v.id);
      }
    }
    /* 柴火消耗：只有真的生起火才烧柴 */
    if (fire) st.fuel = Math.max(0, st.fuel - 1);
    return { dead: dead, sleep: sleep, fire: fire };
  }

  /* ------------------------------------------------------------ 野菜中毒 */
  function weedCheck(st, rng) {
    /* 这一锅有没有毒，不告诉玩家。史实上大多数时候没事，但没人事先知道。 */
    var poisoned = rng() < 0.34;
    var a, i, sickCount = 0, dead = [];
    if (!poisoned) {
      if (st.weedTaste === 'party') { var shi = members(st, 'shi'); if (shi && shi.alive) shi.hp = clamp(shi.hp - 4, 0, 100); }
      return { poisoned: false, dead: dead, sickCount: 0 };
    }
    if (st.weedTaste === 'party') {
      var p = members(st, 'shi');
      if (p && p.alive) {
        p.hp = clamp(p.hp - 35, 0, 100);
        p.poison = 2;
        sickCount = 1;
        if (p.hp <= 0 || (p.hp < 38 && rng() < 0.5)) { kill(st, p.id, '试吃野菜中毒'); dead.push(p.id); }
      }
    } else if (st.weedTaste === 'all') {
      a = aliveList(st);
      var cnt = 3 + Math.floor(rng() * 2);
      /* 从随机位置起，别总是先毒到排头的人 */
      var st0 = a.length ? Math.floor(rng() * a.length) : 0;
      for (i = 0; i < a.length && cnt > 0; i++) {
        var pick2 = a[(st0 + i) % a.length];
        if (pick2.alive && rng() < 0.7) {
          pick2.hp = clamp(pick2.hp - 30, 0, 100);
          pick2.poison = 2;
          sickCount++;
          cnt--;
          if (pick2.hp <= 0 || (pick2.hp < 45 && rng() < 0.35)) { kill(st, pick2.id, '野菜中毒'); dead.push(pick2.id); }
        }
      }
    }
    return { poisoned: true, dead: dead, sickCount: sickCount };
  }

  /* ============================================================== 绘制层 */
  var noise = null;
  function buildNoise() {
    var rng = mulberry32(9174), out = { light: [], dark: [], fiber: [] }, i;
    for (i = 0; i < 380; i++) out.light.push({ x: (rng() * W) | 0, y: (rng() * H) | 0, a: 0.010 + rng() * 0.026 });
    for (i = 0; i < 240; i++) out.dark.push({ x: (rng() * W) | 0, y: (rng() * H) | 0, a: 0.012 + rng() * 0.030 });
    for (i = 0; i < 96; i++) {
      out.fiber.push({ x: rng() * W, y: rng() * H, l: 5 + rng() * 14,
                       r: (rng() - 0.5) * 0.22, a: 0.020 + rng() * 0.035 });
    }
    return out;
  }

  /* 档案袋内面（正文所在的这块纸）与左脊 */
  var BX0 = 46, BY0 = 22, BX1 = 908, BY1 = 578;
  var TIE_X = 23, TIE_A = 150, TIE_B = 250;

  /* 一个拉长的 8 字：去程鼓一侧，回程鼓另一侧，中段交叉 */
  function tieLoop(ctx, cx, yA, yB, d, sgn) {
    ctx.beginPath();
    ctx.moveTo(cx - 4, yA);
    ctx.bezierCurveTo(cx + sgn * d, yA + 28, cx + sgn * d, yB - 28, cx - 4, yB);
    ctx.bezierCurveTo(cx - sgn * d, yB - 30, cx - sgn * d, yA + 30, cx - 4, yA);
    ctx.stroke();
  }

  /* 绕线扣：两个盘 + 三圈棉线。位置卡在 y150-250，是为了活过泥沼页（泥面从 260 起） */
  function drawTie(ctx, strength, loose) {
    var cx = TIE_X, yA = TIE_A, yB = TIE_B;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3.4;
    tieLoop(ctx, cx, yA, yB, 15, -1);

    ctx.strokeStyle = C.thread;
    ctx.globalAlpha = 0.78 * strength; ctx.lineWidth = 1.6;
    tieLoop(ctx, cx, yA, yB, 15, 1);
    ctx.globalAlpha = 0.62 * strength; ctx.lineWidth = 1.2;
    tieLoop(ctx, cx, yA, yB, 10, -1);
    ctx.globalAlpha = 0.50 * strength; ctx.lineWidth = 1.0;
    tieLoop(ctx, cx, yA, yB, 6, 1);
    ctx.globalAlpha = 1;

    for (var k = 0; k < 2; k++) {
      var cy = k ? yB : yA;
      ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 6.2832);
      ctx.fillStyle = C.folderHi; ctx.fill();
      ctx.strokeStyle = C.folderD; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 7.4, Math.PI * 0.15, Math.PI * 0.85);
      ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, 6.2832);
      ctx.fillStyle = 'rgba(10,7,5,0.88)'; ctx.fill();
    }

    ctx.beginPath();
    if (loose) {
      ctx.moveTo(19, 252);
      ctx.bezierCurveTo(6, 290, 32, 330, 14, 372);
      ctx.bezierCurveTo(6, 390, 20, 396, 26, 404);
    } else {
      ctx.moveTo(19, 252);
      ctx.bezierCurveTo(16, 260, 20, 266, 17, 269);
    }
    ctx.strokeStyle = C.thread;
    ctx.globalAlpha = 0.62 * strength; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(loose ? 26 : 17, loose ? 404 : 269, 1.9, 0, 6.2832);
    ctx.fillStyle = C.thread; ctx.fill();

    ctx.restore();
  }

  /* 封面右上：袋口掀开一角，露出第二层纸。只在右脊 x>=908 内，一个字都碰不到 */
  function drawCornerFlap(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(BX1, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 72); ctx.closePath();
    ctx.fillStyle = 'rgba(199,183,154,0.14)';
    ctx.fill();
    ctx.strokeStyle = hexA(C.folderHi, 0.38);
    ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(BX1 + 6, 0); ctx.lineTo(W, 66);
    ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  /* 结算页归档章：土黄上红色实印看不见，改用钢印（亮边+暗边错位） */
  function drawSealMark(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.10);
    ctx.strokeStyle = 'rgba(255,240,215,0.12)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0.8, 0.8, 19, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(-0.8, -0.8, 19, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = hexA(C.red, 0.10);
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  /* 正文页可以是一句话，也可以是个按当前状态算的函数 */
  function pageOf(beat, i, st) {
    var p = beat.pages[i];
    return typeof p === 'function' ? p(st) : (p || '');
  }

  /* ------------------------------------------------------------ 档案袋 */
  function drawPaper(ctx, opt) {
    opt = opt || {};
    var k = opt.lite ? 0.35 : 1;
    var i, p, sx;

    /* 01 袋体 */
    ctx.fillStyle = C.folder;
    ctx.fillRect(0, 0, W, H);

    /* 02 内面：被摸过、被泥蹭过的那块 */
    ctx.fillStyle = C.paper;
    ctx.fillRect(BX0, BY0, BX1 - BX0, BY1 - BY0);

    /* 03 斑驳：让黄漫进内面，但只到 13% */
    var mott = [[150, 90, 430], [820, 150, 380], [690, 520, 440], [330, 470, 400]];
    for (i = 0; i < mott.length; i++) {
      var mg = ctx.createRadialGradient(mott[i][0], mott[i][1], 10, mott[i][0], mott[i][1], mott[i][2]);
      mg.addColorStop(0, hexA(C.folder, 0.13 * k));
      mg.addColorStop(0.55, hexA(C.folder, 0.07 * k));
      mg.addColorStop(1, hexA(C.folder, 0));
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, W, H);
    }

    /* 04 颗粒 + 纤维（必须跨过分界线，否则袋子看着像个框） */
    if (!noise) noise = buildNoise();
    for (i = 0; i < noise.light.length; i++) {
      p = noise.light[i];
      ctx.fillStyle = hexA(C.ink, p.a * 0.55);
      ctx.fillRect(p.x, p.y, 1, 1);
    }
    for (i = 0; i < noise.dark.length; i++) {
      p = noise.dark[i];
      ctx.fillStyle = 'rgba(0,0,0,' + p.a.toFixed(3) + ')';
      ctx.fillRect(p.x, p.y, 1, 1);
    }
    ctx.lineWidth = 1;
    for (i = 0; i < noise.fiber.length; i++) {
      p = noise.fiber[i];
      ctx.strokeStyle = hexA(C.folderHi, p.a * k);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.r) * p.l, p.y + Math.sin(p.r) * p.l);
      ctx.stroke();
    }

    /* 05 上暖下暗（底部用暖黑，不要纯黑） */
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.warm);
    g.addColorStop(0.45, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(26,17,9,0.30)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* 06 左上灯罩光：让左脊和绕线扣发亮 */
    var lg = ctx.createRadialGradient(60, -70, 0, 60, -70, 620);
    lg.addColorStop(0, hexA(C.folderHi, 0.16 * k));
    lg.addColorStop(0.5, hexA(C.folderHi, 0.05 * k));
    lg.addColorStop(1, hexA(C.folderHi, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H);

    /* 07 暗角 */
    var vg = ctx.createRadialGradient(W * 0.5, H * 0.44, 170, W * 0.5, H * 0.44, 640);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.65, 'rgba(0,0,0,0.18)');
    vg.addColorStop(1, opt.lite ? 'rgba(14,9,5,0.58)' : 'rgba(14,9,5,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    /* 08 内面分界：一道折痕 + 外侧受光唇边 */
    ctx.strokeStyle = 'rgba(0,0,0,0.52)';
    ctx.lineWidth = 1;
    ctx.strokeRect(BX0 + 0.5, BY0 + 0.5, BX1 - BX0 - 1, BY1 - BY0 - 1);
    ctx.strokeStyle = hexA(C.folderHi, 0.20);
    ctx.strokeRect(BX0 - 0.5, BY0 - 0.5, BX1 - BX0 + 1, BY1 - BY0 + 1);

    /* 09 内面上沿投影：这一笔让"背景色"变成"有厚度的东西" */
    var sg = ctx.createLinearGradient(0, BY0, 0, BY0 + 7);
    sg.addColorStop(0, 'rgba(0,0,0,0.30)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(BX0, BY0, BX1 - BX0, 7);

    /* 10 顶袋口缝线 */
    if (!opt.lite) {
      ctx.strokeStyle = 'rgba(0,0,0,0.30)';
      ctx.lineWidth = 1;
      for (sx = 10; sx < 950; sx += 16) {
        ctx.beginPath(); ctx.moveTo(sx, 11.5); ctx.lineTo(sx + 7, 11.5); ctx.stroke();
      }
      ctx.strokeStyle = hexA(C.folderHi, 0.16);
      for (sx = 10; sx < 950; sx += 16) {
        ctx.beginPath(); ctx.moveTo(sx, 13); ctx.lineTo(sx + 7, 13); ctx.stroke();
      }
    }

    /* 11 右脊：第二层纸边 */
    var rg = ctx.createLinearGradient(BX1, 0, BX1 + 26, 0);
    rg.addColorStop(0, 'rgba(0,0,0,0.30)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(BX1, BY0, 26, BY1 - BY0);

    /* 12 左脊：外缘受光 + 两道褶痕（只在 0-46 内） */
    var eg = ctx.createLinearGradient(0, 0, 52, 0);
    eg.addColorStop(0, hexA(C.folderHi, 0.12 * k));
    eg.addColorStop(0.6, hexA(C.folderHi, 0.04 * k));
    eg.addColorStop(1, hexA(C.folderHi, 0));
    ctx.fillStyle = eg;
    ctx.fillRect(0, BY0, 52, BY1 - BY0);
    var fg = ctx.createLinearGradient(24, 0, 46, 0);
    fg.addColorStop(0, 'rgba(0,0,0,0)');
    fg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = fg;
    ctx.fillRect(24, BY0, 22, BY1 - BY0);
    hair(ctx, 0, 330, 46, 352, 'rgba(0,0,0,0.26)', 1);
    hair(ctx, 0, 331, 46, 353, hexA(C.folderHi, 0.14), 1);
    hair(ctx, 0, 452, 46, 470, 'rgba(0,0,0,0.22)', 1);

    /* 13 竖排档号：土黄带上只有 C.ink 能用，ink3/red 在这里等于不存在 */
    if (!opt.lite) {
      ctx.font = F(9, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = hexA(C.ink, 0.42);
      ctx.fillText('0', 30, 66);
      ctx.fillText('2', 30, 78);
      ctx.fillText('6', 30, 90);
      ctx.textAlign = 'left';
    }

    /* 14 绕线扣 */
    drawTie(ctx, opt.lite ? 0.45 : 1, opt.loose);

    /* 15 封面折角 */
    if (opt.flap) drawCornerFlap(ctx);

    /* 16 归档章 */
    if (opt.stamp) drawSealMark(ctx, 24, 46);
  }

  /* ------------------------------------------------------------ 环境粒子 */
  var decoP = null;
  function buildDeco() {
    var rng = mulberry32(5531), i;
    var d = { rain: [], snow: [], mist: [], ash: [] };
    for (i = 0; i < 90; i++) d.rain.push({ x: rng() * (W + 240), y: rng() * (H + 60), l: 13 + rng() * 24, s: 0.5 + rng() * 0.7 });
    for (i = 0; i < 45; i++) d.snow.push({ x: rng() * W, y: rng() * (H + 40), r: 0.8 + rng() * 1.3, s: 0.05 + rng() * 0.08, w: rng() * 6.28 });
    for (i = 0; i < 4; i++) d.mist.push({ y: 70 + rng() * 460, h: 46 + rng() * 80, s: 0.15 + rng() * 0.35, o: 0.018 + rng() * 0.026, w: rng() * 6.28 });
    for (i = 0; i < 34; i++) d.ash.push({ x: rng() * W, y: rng() * H, r: 0.55 + rng() * 1, s: 0.03 + rng() * 0.05, w: rng() * 6.28 });
    return d;
  }

  function drawDeco(ctx, kind, t) {
    if (!kind) return;
    if (!decoP) decoP = buildDeco();
    var i, p, x, y;

    if (kind === 'rain') {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.11;
      for (i = 0; i < decoP.rain.length; i++) {
        p = decoP.rain[i];
        y = (p.y + t * p.s * 0.05) % (H + 60) - 40;
        x = (p.x - t * p.s * 0.008 + W + 240) % (W + 240) - 40;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y + p.l);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = C.ink;
      ctx.globalAlpha = 0.05;
      for (i = 0; i < 7; i++) {
        var wy = 400 + i * 30;
        var wx = ((t * 0.012 + i * 130) % (W + 200)) - 100;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + 30, wy - 3, wx + 60, wy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (kind === 'snow') {
      ctx.fillStyle = C.ink;
      for (i = 0; i < decoP.snow.length; i++) {
        p = decoP.snow[i];
        y = (p.y + t * p.s * 0.05) % (H + 40) - 20;
        x = p.x + Math.sin(t * 0.0004 + p.w) * 12;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (kind === 'mist') {
      for (i = 0; i < decoP.mist.length; i++) {
        p = decoP.mist[i];
        var off = Math.sin(t * 0.00022 * p.s + p.w) * 26;
        var lg = ctx.createLinearGradient(0, 0, W, 0);
        lg.addColorStop(0, 'rgba(0,0,0,0)');
        lg.addColorStop(0.3, C.ink);
        lg.addColorStop(0.7, C.ink);
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = p.o;
        ctx.fillStyle = lg;
        ctx.fillRect(off - 60, p.y, W, p.h);
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (kind === 'ash') {
      ctx.fillStyle = C.gold;
      for (i = 0; i < decoP.ash.length; i++) {
        p = decoP.ash[i];
        y = (p.y - t * p.s * 0.05 + H * 2) % H;
        x = p.x + Math.sin(t * 0.00035 + p.w) * 9;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function hair(ctx, x1, y1, x2, y2, color, lw) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color || C.line;
    ctx.lineWidth = lw || 1;
    ctx.stroke();
  }

  function text(ctx, str, x, y, size, fam, color, weight, align) {
    ctx.font = F(size * FS, fam || SERIF, weight);
    ctx.fillStyle = color || C.ink;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
    ctx.textAlign = 'left';
  }

  /* 逐字印刷：换行固定，按已显示字数截断 */
  function typed(ctx, str, x, y, maxW, shown, opt) {
    opt = opt || {};
    var size = (opt.size || 17) * FS, lh = (opt.lh || 30) * FS, color = opt.color || C.ink;
    ctx.font = F(size, SERIF, opt.weight);
    var lines = wrapCN(ctx, str, maxW);
    var cnt = 0;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (var i = 0; i < lines.length; i++) {
      if (cnt >= shown) break;
      var line = lines[i];
      var avail = shown - cnt;
      var s = avail >= line.length ? line : line.slice(0, avail);
      ctx.fillText(s, x, y + i * lh);
      cnt += line.length;
    }
    return lines.length;
  }

  function seal(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.07);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 2.6;
    ctx.strokeRect(-30, -30, 60, 60);
    ctx.globalAlpha = 0.72;
    ctx.font = F(15, SERIF, 'bold');
    ctx.fillStyle = C.red;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.charAt(0), 0, -14);
    ctx.fillText(s.charAt(1), 0, 6);
    ctx.restore();
  }

  /* --------------------------------------------------------- 档案栏组件 */
  function drawHeader(ctx, st) {
    text(ctx, '档 号 0 2 6', 56, 34, 10, SANS, C.ink3, 'normal');
    text(ctx, '一九三五年八月', 904, 34, 10, SANS, C.ink3, 'normal', 'right');
    hair(ctx, 56, 46, 904, 46, C.line, 1);
  }

  function drawMeta(ctx, st) {
    var dayNo = ['一', '二', '三', '四', '五', '六', '七'][clamp(st.day - 1, 0, 6)];
    text(ctx, '第 ' + dayNo + ' 天', 56, 68, 11, SANS, C.red, 'bold');
    text(ctx, st.dayLabel + '　·　' + st.place, 122, 68, 11, SANS, C.ink2);
    text(ctx, '累计 ' + st.li + ' 里', 904, 68, 11, SANS, C.ink3, 'normal', 'right');
    hair(ctx, 56, 80, 904, 80, C.line, 1);
  }

  function drawTicks(ctx, st) {
    var labels = ['21', '22', '23', '24', '25', '26', '27'];
    var x0 = 60, gap = 96, y = 96;
    for (var i = 0; i < 7; i++) {
      var x = x0 + i * gap;
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, 6.2832);
      if (i + 1 <= st.day) {
        ctx.fillStyle = C.red; ctx.fill();
      } else {
        ctx.strokeStyle = C.line; ctx.lineWidth = 1.4; ctx.stroke();
      }
      text(ctx, labels[i], x, y + 18, 9, NUM, C.ink3, 'normal', 'center');
    }
    text(ctx, '8 月', 56, y + 18, 9, SANS, C.ink3);
  }

  function rosterState(s) {
    if (!s.alive) return 'dead';
    if (s.hp > 50) return 'ok';
    if (s.hp > 20) return 'weak';
    return 'bad';
  }

  function drawRoster(ctx, st, ts) {
    var x0 = 660, y0 = 118, rh = 32, i, s;
    var alive = aliveList(st).length;
    text(ctx, '兵　力', x0, y0, 9, SANS, C.ink2);
    text(ctx, alive + ' / ' + st.roster.length, x0 + 236, y0 - 1, 13, NUM, C.ink, 'normal', 'right');

    var top = y0 + 12;
    for (i = 0; i < st.roster.length; i++) {
      s = st.roster[i];
      var ry = top + i * rh;
      drawAvatar(ctx, s.id, x0, ry, 32, !s.alive);
      var stt = rosterState(s);
      if (stt === 'bad') {
        var pulse = 0.5 + 0.5 * Math.sin((ts || 0) * 0.006);
        ctx.strokeStyle = C.red;
        ctx.lineWidth = 1.5 + pulse * 1.5;
        ctx.globalAlpha = 0.5 + pulse * 0.5;
        ctx.strokeRect(x0 + 0.5, ry + 0.5, 31, 31);
        ctx.globalAlpha = 1;
      }
      text(ctx, s.name, x0 + 42, ry + 21, 11, SANS, stt === 'bad' ? C.red : (s.alive ? C.ink2 : C.ink3));
      if (s.alive) {
        var bw = 120, bh = 3;
        ctx.fillStyle = C.panel;
        ctx.fillRect(x0 + 116, ry + 14, bw, bh);
        ctx.fillStyle = s.hp > 50 ? C.red : (s.hp > 20 ? C.gold : C.redD);
        ctx.fillRect(x0 + 116, ry + 14, bw * clamp(s.hp / 100, 0, 1), bh);
      } else {
        text(ctx, s.deathDay || '—', x0 + 236, ry + 19, 10, NUM, C.ink3, 'normal', 'right');
      }
    }
    return top + st.roster.length * rh;
  }

  /* 正文下方：谁快不行了，红字提醒一句 */
  function drawDangerAlert(ctx, st) {
    var names = [];
    for (var i = 0; i < st.roster.length; i++) {
      var d = st.roster[i];
      if (d.alive && d.hp <= 20) names.push(d.name.replace(/\s/g, ''));
    }
    if (!names.length) return;
    text(ctx, names.join('、') + ' 快走不动了。', 56, 490, 12.5, SERIF, C.red);
  }

  function drawGrain(ctx, st) {
    var x0 = 660, y = 350;
    text(ctx, '口　粮', x0, y - 11, 9, SANS, C.ink2);
    var v = Math.max(0, st.grain);
    text(ctx, v.toFixed(1), x0 + 206, y - 11, 13, NUM, C.ink, 'normal', 'right');
    text(ctx, '斤', x0 + 236, y - 11, 9, SANS, C.ink3, 'normal', 'right');
    ctx.fillStyle = C.panel;
    ctx.fillRect(x0, y, 236, 10);
    ctx.fillStyle = v > 0 ? C.red : C.ink3;
    ctx.fillRect(x0, y, 236 * clamp(v / 36, 0, 1), 10);
    for (var i = 1; i < 4; i++) {
      hair(ctx, x0 + 236 / 4 * i, y, x0 + 236 / 4 * i, y + 10, C.paper, 1);
    }

    var y2 = y + 44;
    text(ctx, '柴　火', x0, y2 - 11, 9, SANS, C.ink2);
    for (i = 0; i < 4; i++) {
      var bx = x0 + 44 + i * 18;
      if (i < st.fuel) { ctx.fillStyle = C.gold; ctx.fillRect(bx, y2 - 8, 12, 12); }
      else { ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, y2 - 7.5, 11, 11); }
    }

    var y3 = y2 + 34;
    text(ctx, '皮带 ' + st.belt, x0, y3, 11, SANS, C.ink2);
    text(ctx, '骡马 ' + st.horse, x0 + 78, y3, 11, SANS, C.ink2);
    text(ctx, '竹棍 ' + st.pole, x0 + 156, y3, 11, SANS, C.ink2);
  }

  /* --------------------------------------------------------- 选项列表 */
  function drawChoices(ctx, st, choice, y0) {
    var x = 56, w = 564, h = 58, gap = 9;
    text(ctx, choice.q, x, y0 - 22, 15, SERIF, C.ink, 'bold');
    if (choice.hint) {
      text(ctx, choice.hint, 620, y0 - 22, 11, SANS, C.ink3, 'normal', 'right');
    }
    for (var i = 0; i < choice.opts.length; i++) {
      var o = choice.opts[i];
      var y = y0 + i * (h + gap);
      var hot = st.hover === 'opt' + i;
      var pressed = st.press && st.press.id === 'opt' + i;
      var title = typeof o.title === 'function' ? o.title(st) : o.title;
      var sub = typeof o.sub === 'function' ? o.sub(st) : o.sub;

      ctx.fillStyle = hot ? C.panel : 'rgba(0,0,0,0)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = hot ? C.red : C.lineHi;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

      ctx.fillStyle = hot ? C.red : C.line;
      ctx.fillRect(x, y, 3, h);

      var ox = hot ? 6 : 3;
      text(ctx, o.no, x + 16 + ox, y + 25, 12, SERIF, C.red, 'bold');
      text(ctx, title, x + 40 + ox, y + 25, 18, SERIF, pressed ? C.redD : C.ink);
      if (sub) text(ctx, sub, x + 40 + ox, y + 46, 11.5, SERIF, C.ink3);

      HOT.push({ id: 'opt' + i, x: x, y: y, w: w, h: h, k: i });
    }
  }

  /* --------------------------------------------------------- 账本插页 */
  function drawDelta(ctx, st) {
    var d = st.delta;
    if (!d) return;

    text(ctx, '变　化', 56, 152, 11, SANS, C.red, 'bold');
    text(ctx, '刚才那个决定', 904, 152, 10, SANS, C.ink3, 'normal', 'right');
    hair(ctx, 56, 166, 904, 166, C.ink, 1.4);

    var rowH = d.rows.length > 5 ? 28 : 40;
    var y = d.rows.length > 5 ? 196 : 206;
    for (var i = 0; i < d.rows.length; i++) {
      var r = d.rows[i];
      text(ctx, r.label, 56, y, 12, SANS, C.ink3);
      ctx.font = F(15, SERIF);
      ctx.fillStyle = r.bad ? C.redD : (r.good ? C.gold : C.ink);
      ctx.textAlign = 'left';
      ctx.fillText(r.value, 268, y);
      if (r.note) text(ctx, r.note, 640, y, 11, SANS, C.ink3);
      y += rowH;
      hair(ctx, 56, y - 14, 904, y - 14, C.line, 1);
    }

    if (d.quote) {
      y += 14;
      ctx.fillStyle = C.red;
      ctx.fillRect(56, y - 13, 2, 46);
      ctx.font = F(12.5, SERIF);
      var lines = wrapCN(ctx, d.quote, 790);
      ctx.fillStyle = C.ink2;
      ctx.textAlign = 'left';
      for (var k = 0; k < lines.length && k < 3; k++) {
        ctx.fillText(lines[k], 68, y + k * 19);
      }
    }

    text(ctx, '点击继续', 56, 552, 10, SANS, C.red);
    text(ctx, '— ' + n2(st.beat + 1) + ' —', 904, 552, 10, NUM, C.ink3, 'normal', 'right');
    HOT.push({ id: 'next', x: 0, y: 0, w: W, h: H, k: -1 });
  }

  /* --------------------------------------------------------- 泥沼场景 */
  /* 剧本钦定王二柱走最前；他要是先没了，就挑体力最弱的那个陷 */
  function pickVictim(st) {
    var w = members(st, 'wang');
    if (w && w.alive) return w;
    var a = aliveList(st), m = null;
    for (var i = 0; i < a.length; i++) if (!m || a[i].hp < m.hp) m = a[i];
    return m;
  }

  /* 谁会伸手：按职务排，不能是自己，快死的人不会去拉人 */
  var PULL_ORDER = ['shi', 'he', 'wang', 'lin', 'awang', 'shitou'];
  function pickRescuer(st, victimId) {
    for (var i = 0; i < PULL_ORDER.length; i++) {
      var id = PULL_ORDER[i], s = members(st, id);
      if (!s || !s.alive || s.id === victimId || s.hp < 20) continue;
      return s.id;
    }
    return null;
  }

  function bogCreate(st) {
    var victim = pickVictim(st);
    return {
      victim: victim ? victim.id : null,
      victimName: victim ? victim.name : '',
      sink: 20,
      prone: false,
      foothold: false,
      poleUsed: false,
      handTried: 0,
      second: null,
      outcome: null,
      msg: '陷者先趴下。救援的人不能用手拉。'
    };
  }

  function bogAction(st, k) {
    var b = st.bog;
    if (!b || b.outcome) return;
    b.sink += 8;

    if (k === 0) {                       /* 叫他趴下 */
      if (!b.prone) { b.prone = true; b.sink -= 18; b.msg = '身子摊开了。下沉慢下来。'; }
      else { b.msg = '已经趴下了。再说一遍没有用。'; }
    } else if (k === 1) {                /* 先试草墩 */
      b.foothold = true;
      b.msg = '用脚试出一块硬草墩，站住了。';
    } else if (k === 2) {                /* 递竹棍 */
      if (st.pole <= 0) {
        b.msg = '竹棍用完了。';
      } else {
        st.pole = Math.max(0, st.pole - 1);
        b.poleUsed = true;
        if (b.foothold) { b.sink -= 12; b.msg = '竹棍递过去了。抓住了。'; }
        else { b.sink += 4; b.msg = '脚下没踩实，使不上劲。'; }
      }
    } else if (k === 3) {                /* 伸手去拉 */
      b.sink += 25;
      b.handTried += 1;
      if (!b.second) {
        b.second = pickRescuer(st, b.victim);
        b.msg = b.second ? '手刚够到，脚下的草皮也塌了。' : '没有人敢再伸手。';
      } else {
        b.msg = '两个人一起往下沉。';
      }
    } else if (k === 4) {                /* 放弃 */
      kill(st, b.victim, '陷入泥沼');
      b.outcome = 'lost';
      b.msg = '';
      st.sub = 'bogEnd';
      return;
    }

    if (b.sink >= 100) {
      kill(st, b.victim, '陷入泥沼');
      if (b.second) kill(st, b.second, '伸手去拉，一同陷落');
      b.outcome = 'lost';
      st.sub = 'bogEnd';
      return;
    }
    if (b.sink <= 14 && b.prone && b.poleUsed) {
      b.outcome = 'saved';
      st.sub = 'bogEnd';
      return;
    }
    if (b.sink > 78) b.msg = b.msg + '　快没到胸口了。';
  }

  function drawBog(ctx, st, t) {
    var b = st.bog;
    if (!b || !b.victim) return;
    var top = 260;

    /* 上半：描述 */
    ctx.font = F(17, SERIF);
    var l0 = wrapCN(ctx, '泥面已经合上了。只剩一副肩膀和头露在外面，没有喊。', 580);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    for (var i = 0; i < l0.length; i++) ctx.fillText(l0[i], 56, 148 + i * 30);

    text(ctx, '每做一个动作，人就往下沉一点。', 56, 240, 10.5, SANS, C.ink3);

    var depth = clamp(b.sink / 100, 0, 1);
    var cx = 420;
    var headY = top - (1 - depth) * 95;   /* 头顶：下沉时往下移 */

    /* 脸周围一圈微光 */
    var fg = ctx.createRadialGradient(cx, top + 20, 8, cx, top + 20, 110);
    fg.addColorStop(0, 'rgba(214,182,142,0.14)');
    fg.addColorStop(1, 'rgba(214,182,142,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(cx - 120, top - 90, 240, 230);

    /* 人物：先画完整，后面的泥面会盖住下半身 —— 这才是"陷进去" */
    drawAvatar(ctx, b.victim, cx - 56, headY, 112, false);

    /* 泥面：盖住 top 以下，把身体吞掉 */
    ctx.fillStyle = C.mud;
    ctx.fillRect(0, top, W, H - top);
    ctx.beginPath();
    ctx.moveTo(0, top);
    for (var x = 0; x <= W; x += 26) {
      ctx.lineTo(x, top + Math.sin((x + 40) * 0.045) * 3.5);
    }
    ctx.lineTo(W, top + 8);
    ctx.lineTo(0, top + 8);
    ctx.closePath();
    ctx.fillStyle = C.mudHi;
    ctx.fill();

    /* 断口处一圈泥浆，把脸和泥面接起来 */
    ctx.beginPath();
    ctx.ellipse(cx, top + 2, 64 - depth * 30, 5, 0, 0, 6.2832);
    ctx.fillStyle = C.mudHi;
    ctx.fill();

    /* 水面漂移 */
    for (i = 0; i < 9; i++) {
      var yy = top + 34 + i * 26;
      var xx = 40 + ((i * 151 + Math.sin(t * 0.0007 + i * 1.7) * 50) % 560);
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = C.ink;
      ctx.fillRect(xx, yy, 52, 1.3);
      ctx.globalAlpha = 1;
    }

    /* 动态反馈：泥面左下，跟人同侧，视线不用再跳回左上 */
    if (b.msg) {
      ctx.font = F(14, SERIF);
      var l1 = wrapCN(ctx, b.msg, 280);
      ctx.fillStyle = 'rgba(236,226,206,0.92)';
      ctx.textAlign = 'left';
      for (i = 0; i < l1.length && i < 3; i++) ctx.fillText(l1[i], 56, 332 + i * 22);
    }

    var nameY = Math.min(headY - 14, 232);
    text(ctx, b.victimName, cx, nameY, 11, SANS, C.ink2, 'normal', 'center');

    /* 沉没条 */
    var bx = 616, by = top + 40, bh = 210, bw = 9;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    var fillH = bh * depth;
    ctx.fillStyle = b.sink > 72 ? C.red : C.ink3;
    ctx.fillRect(bx, by + bh - fillH, bw, fillH);
    text(ctx, '下沉', bx + 4, by + 18, 9, SANS, C.ink3, 'normal', 'center');

    /* 动作按钮 */
    var acts = ['让陷者趴下，摊开身子', '先试出一块硬草墩', '递竹棍过去', '伸手去拉', '放弃'];
    var ax = 676, ay = 288;
    for (i = 0; i < acts.length; i++) {
      var y = ay + i * 50;
      var hot = st.hover === 'bog' + i;
      ctx.fillStyle = hot ? C.panel : C.paper;
      ctx.fillRect(ax, y, 208, 42);
      ctx.strokeStyle = hot ? C.red : C.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(ax + 0.5, y + 0.5, 207, 41);
      if (hot) { ctx.fillStyle = C.red; ctx.fillRect(ax, y, 2, 42); }
      text(ctx, acts[i], ax + 14, y + 26, 12, SANS, C.ink);
      HOT.push({ id: 'bog' + i, x: ax, y: y, w: 208, h: 42, k: i });
    }
  }

  function drawBogEnd(ctx, st) {
    var ok = st.bog.outcome === 'saved';
    drawHeader(ctx, st);
    var title = ok ? '拉出来了' : '没有拉出来';
    text(ctx, title, 56, 120, 26, SERIF, ok ? C.ink : C.redD, 'bold');
    var body = ok
      ? ['旁边的人趴在泥面上，把竹棍递过去。抓住了，一点一点被拖上来。',
         '标准做法：陷者先趴下，摊开体重；救援的人用脚试出硬草墩站稳；',
         '用一根杆子或一条绳子拉。不许用手直接拉。']
      : ['泥面合上了。',
         '工兵连二排长丁华齐，刚喊了一声救命，转眼就被深泥潭吞没。',
         '在草地上，掉队基本等于死亡，除非有战友搭救。'];
    for (var i = 0; i < body.length; i++) {
      text(ctx, body[i], 56, 170 + i * 32, 15, SERIF, C.ink2);
    }
    text(ctx, '张云晓回忆《过草地》', 56, 300, 11, SANS, C.ink3);
    text(ctx, '点击继续', 56, 552, 10, SANS, C.ink3);
    HOT.push({ id: 'next', x: 0, y: 0, w: W, h: H, k: -1 });
  }

  /* --------------------------------------------------------- 封面 */
  function drawCover(ctx, st) {
    drawPaper(ctx, { loose: 1, flap: 1 });
    drawHeader(ctx, st);

    /* 竖排标题 */
    var chars = ['过', '草', '地'];
    for (var i = 0; i < 3; i++) {
      text(ctx, chars[i], 300, 190 + i * 62, 52, SERIF, C.ink, 'bold', 'center');
    }
    hair(ctx, 344, 150, 344, 330, C.red, 1.4);

    text(ctx, '松潘草地　·　海拔 3400 米', 376, 176, 13, SANS, C.ink2);
    text(ctx, '1935 年 8 月 21 日 — 8 月 27 日', 376, 202, 13, SANS, C.ink2);

    ctx.fillStyle = C.red;
    ctx.fillRect(376, 236, 2, 62);
    var q = ['当我们熬过一个夜晚，离开宿营地', '继续前进时，有的战友就长眠在', '我们共同躺过的营地上。'];
    for (i = 0; i < 3; i++) text(ctx, q[i], 392, 254 + i * 24, 14, SERIF, C.ink2);
    text(ctx, '—— 杨成武《忆长征》', 392, 330, 11, SANS, C.ink3);

    seal(ctx, 840, 180, '草地');

    /* 开始按钮 */
    var bx = 376, by = 400, bw = 200, bh = 46;
    var hot = st.hover === 'start';
    ctx.fillStyle = hot ? C.red : 'rgba(0,0,0,0)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    text(ctx, '进 入 草 地', bx + bw / 2, by + 29, 15, SANS, hot ? C.paper : C.red, 'bold', 'center');
    HOT.push({ id: 'start', x: bx, y: by, w: bw, h: bh, k: 0 });

    text(ctx, '本关只写一个连队的七天。', 56, 552, 11, SANS, C.ink3);
    text(ctx, '六人 · 三十六斤 · 五百里', 904, 552, 11, SANS, C.ink3, 'normal', 'right');
  }

  /* --------------------------------------------------------- 结算页 */
  /* ------------------------------------------------------------ 遗言页 */
  function centerPar(ctx, str, cy, maxW, size, color, lh, fam) {
    size *= FS; lh *= FS;
    ctx.font = F(size, fam || SERIF);
    var lines = wrapCN(ctx, str, maxW);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    var y0 = cy - (lines.length - 1) * lh / 2;
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], W / 2, y0 + i * lh);
    ctx.textAlign = 'left';
    return lines.length;
  }

  function drawLastWords(ctx, st, ts) {
    var id = st.pendingWords[0];
    var s = members(st, id);
    var rec = LAST_WORDS[id];
    var w = lastWordsFor(id, s ? s.deathCause : null, st);
    if (!s || !rec || !w) return;

    drawPaper(ctx, { lite: 1 });

    /* 过场：第一页慢一点，连续翻页时加快 */
    var el = ts - (st.wordsEnterAt || ts);
    var D = st.wordsSeen > 0 ? 360 : 900;
    var step = function (t0, dur) { return clamp((el - t0) / dur, 0, 1); };

    /* 顶部日期 */
    var place = s.deathDay || st.dayLabel || '';
    var loc = s.deathPlace || '松潘草地';
    ctx.globalAlpha = step(0, D * 0.33);
    text(ctx, place + '　·　' + loc, W / 2, 44, 9.5, SANS, C.ink3, 'normal', 'center');
    ctx.globalAlpha = 1;
    hair(ctx, 396, 56, 564, 56, C.line, 1);

    /* 暖光 + 头像：从下方浮起，慢慢显出来 */
    var k0 = step(D * 0.09, D * 0.45);
    var ay = 76 + (1 - k0) * 22;
    var g = ctx.createRadialGradient(W / 2, ay + 60, 6, W / 2, ay + 60, 132);
    g.addColorStop(0, 'rgba(208,154,72,0.17)');
    g.addColorStop(0.55, 'rgba(208,154,72,0.055)');
    g.addColorStop(1, 'rgba(208,154,72,0)');
    ctx.globalAlpha = k0 * 0.85;
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - 190, ay - 70, 380, 264);
    ctx.globalAlpha = k0;
    drawAvatar(ctx, id, (W - 128) / 2, ay, 128, false);
    ctx.globalAlpha = 1;

    var nm = s.name.replace(/\s/g, '').split('').join('　');
    var k1 = step(D * 0.40, D * 0.29);
    ctx.globalAlpha = k1;
    text(ctx, nm, W / 2, 250, 25, SERIF, C.ink, 'bold', 'center');
    text(ctx, s.age + ' 岁 · ' + s.role.replace(/\s/g, ''), W / 2, 276, 11.5, SANS, C.ink3, 'normal', 'center');
    ctx.globalAlpha = 1;

    /* 死前那一刻 */
    var k2 = step(D * 0.58, D * 0.26);
    ctx.globalAlpha = k2;
    centerPar(ctx, w.scene, 318, 520, 14, C.ink2, 24);
    ctx.globalAlpha = 1;

    /* 遗言，或者沉默 */
    var k3 = step(D * 0.71, D * 0.29);
    ctx.globalAlpha = k3;
    if (isSilent(s.deathCause) || !w.words) {
      centerPar(ctx, '没有留下话。', 388, 520, 17, C.ink3, 28);
    } else {
      centerPar(ctx, '「' + w.words + '」', 390, 540, 18, C.ink, 30);
    }
    ctx.globalAlpha = 1;

    /* 遗物 + 底部 */
    var k4 = step(D * 0.82, D * 0.30);
    ctx.globalAlpha = k4;
    text(ctx, '遗　物', W / 2, 452, 9, SANS, C.red, 'bold', 'center');
    centerPar(ctx, rec.relic, 478, 560, 12.5, C.ink2, 20);
    ctx.globalAlpha = 1;

    hair(ctx, 396, 524, 564, 524, C.line, 1);
    if (st.pendingWords.length > 1) {
      text(ctx, '点击继续　·　还有 ' + (st.pendingWords.length - 1) + ' 个', W / 2, 550, 10.5, SANS, C.ink2, 'normal', 'center');
    } else {
      text(ctx, '点击继续', W / 2, 550, 10.5, SANS, C.ink2, 'normal', 'center');
    }

    HOT.push({ id: 'next', x: 0, y: 0, w: W, h: H, k: -1 });
  }

  /* ------------------------------------------------------------ 说话页 */
  function drawReaction(ctx, st, ts) {
    var list = st.reaction;
    if (!list || !list.length) return;

    drawPaper(ctx);

    var el = ts - (st.wordsEnterAt || ts);
    var step = function (t0, dur) { return clamp((el - t0) / dur, 0, 1); };

    ctx.globalAlpha = step(0, 240);
    text(ctx, '他　们　说', 56, 110, 11, SANS, C.red, 'bold');
    hair(ctx, 56, 122, 904, 122, C.line, 1);
    ctx.globalAlpha = 1;

    var y = 172;
    for (var i = 0; i < list.length; i++) {
      var k = step(160 + i * 190, 300);
      if (k <= 0) break;
      var who = list[i][0], raw = list[i][1];
      var sp = members(st, who);
      if (!sp || !sp.alive) continue;
      var line = typeof raw === 'function' ? raw(st) : raw;

      ctx.globalAlpha = k;
      drawAvatar(ctx, who, 56, y - 24, 32, false);
      text(ctx, sp.name.replace(/\s/g, ''), 98, y - 4, 10.5, SANS, C.ink3);

      ctx.font = F(15, SERIF);
      var lines = wrapCN(ctx, '「' + line + '」', 500);
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'left';
      for (var j = 0; j < lines.length && j < 3; j++) {
        ctx.fillText(lines[j], 98, y + 18 + j * 24);
      }
      ctx.globalAlpha = 1;

      y += 34 + lines.length * 24 + 22;
      if (y > 470) break;
    }

    text(ctx, '点击继续', 56, 552, 10, SANS, C.red);
    HOT.push({ id: 'next', x: 0, y: 0, w: W, h: H, k: -1 });
  }

  /* ------------------------------------------------------------ 结局图鉴 */
  function drawEndingsOverlay(ctx, st) {
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, W, H);

    var bx = 150, by = 60, bw = 660, bh = 480;
    ctx.fillStyle = C.paper;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = C.lineHi;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

    text(ctx, '四　个　结　局', bx + 40, by + 48, 13, SANS, C.red, 'bold');
    var seen = 0;
    for (var i = 0; i < ENDINGS.length; i++) if (ENDING_SEEN[ENDINGS[i].title]) seen++;
    text(ctx, seen + ' / 4', bx + bw - 40, by + 48, 13, NUM, C.ink3, 'normal', 'right');
    hair(ctx, bx + 40, by + 62, bx + bw - 40, by + 62, C.line, 1);

    for (i = 0; i < ENDINGS.length; i++) {
      var e = ENDINGS[i], y = by + 100 + i * 96;
      var got = !!ENDING_SEEN[e.title];
      text(ctx, got ? e.title : '？　？　？', bx + 40, y, 17, SERIF, got ? C.ink : C.ink3, 'bold');
      text(ctx, e.cond, bx + bw - 40, y, 10, SANS, C.ink3, 'normal', 'right');
      if (got) {
        ctx.font = F(11.5, SERIF);
        var dl = wrapCN(ctx, e.desc, 560);
        ctx.fillStyle = C.ink2;
        for (var j = 0; j < dl.length && j < 2; j++) ctx.fillText(dl[j], bx + 40, y + 22 + j * 18);
      } else {
        text(ctx, '还没走到过。', bx + 40, y + 22, 11.5, SERIF, C.ink3);
      }
      hair(ctx, bx + 40, y + 52, bx + bw - 40, y + 52, C.line, 1);
    }

    text(ctx, '点击任意处关闭', bx + bw / 2, by + bh - 22, 10, SANS, C.ink3, 'normal', 'center');
    HOT.push({ id: 'closeEndings', x: 0, y: 0, w: W, h: H, k: 0 });
  }

  /* 当前该用哪套主题 */
  function sceneTheme(st) {
    if (st.scene === 'cover') return { name: 'cover', deco: null };
    if (st.scene === 'result') return { name: 'report', deco: null };
    if (st.sub === 'lastWords') return { name: 'elegy', deco: null };
    var b = BEATS[st.beat];
    if (!b) return { name: 'march', deco: null };
    return { name: b.theme || 'march', deco: b.deco || null };
  }

  function buildResult(st) {
    var alive = aliveList(st).length;
    var e = ENDINGS[0];
    for (var i = 0; i < ENDINGS.length; i++) {
      if (alive >= ENDINGS[i].min && alive <= ENDINGS[i].max) { e = ENDINGS[i]; break; }
    }
    var rng = mulberry32(st.day * 31 + alive * 7 + (CARD_SEED++));
    var pool = SOURCES.slice(), cards = [];
    for (i = 0; i < 2 && pool.length; i++) {
      cards.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    return {
      alive: alive,
      title: e.title,
      lede: e.lede.replace('{n}', CN_NUM[alive] || String(alive)),
      cards: cards
    };
  }

  function drawResult(ctx, st, t) {
    drawPaper(ctx, { stamp: 1 });
    drawHeader(ctx, st);
    var r = st.resultCards;

    /* 结局标题 */
    text(ctx, r.title, 56, 102, 28, SERIF, r.alive === 0 ? C.redD : C.ink, 'bold');
    var seenN = Object.keys(ENDING_SEEN).length;
    text(ctx, '结局 ' + seenN + ' / 4　查看', 904, 102, 10, SANS, seenN < 4 ? C.red : C.ink3, 'normal', 'right');
    HOT.push({ id: 'endings', x: 800, y: 86, w: 110, h: 22, k: 0 });
    ctx.font = F(12.5, SERIF);
    var ls = wrapCN(ctx, r.lede, 640);
    ctx.fillStyle = C.ink2;
    for (var i = 0; i < ls.length && i < 2; i++) ctx.fillText(ls[i], 56, 128 + i * 20);

    /* 档案表：一人一行，左边一张脸 */
    var ty = 164;
    hair(ctx, 56, ty, 904, ty, C.ink, 1.4);
    text(ctx, '姓　名', 88, ty + 15, 9, SANS, C.ink3);
    text(ctx, '年龄', 200, ty + 15, 9, SANS, C.ink3);
    text(ctx, '身份', 250, ty + 15, 9, SANS, C.ink3);
    text(ctx, '日期', 336, ty + 15, 9, SANS, C.ink3);
    text(ctx, '记　录', 416, ty + 15, 9, SANS, C.ink3);
    hair(ctx, 56, ty + 23, 904, ty + 23, C.line, 1);

    for (i = 0; i < st.roster.length; i++) {
      var s = st.roster[i], y = ty + 46 + i * 30;
      var col = s.alive ? C.ink : C.ink3;
      drawAvatar(ctx, s.id, 56, y - 19, 24, !s.alive);
      text(ctx, s.name, 88, y, 12, SERIF, col);
      text(ctx, String(s.age), 200, y, 11, NUM, col);
      text(ctx, s.role.replace(/\s/g, ''), 250, y, 11, SANS, col);
      text(ctx, s.alive ? '—' : (s.deathDay || '—'), 336, y, 11, NUM, s.alive ? C.ink3 : C.red);
      text(ctx, s.alive ? '走出草地' : (s.deathCause || '牺牲'), 416, y, 11, SANS, col);
      if (!s.alive) hair(ctx, 88, y - 4, 150, y - 4, C.red, 0.8);
    }
    hair(ctx, 56, ty + 46 + 6 * 30 - 10, 904, ty + 46 + 6 * 30 - 10, C.line, 1);

    /* 数据对照 */
    var dy = 382;
    text(ctx, '本　连', 56, dy, 9, SANS, C.ink3);
    ctx.fillStyle = C.panel; ctx.fillRect(112, dy - 8, 280, 9);
    ctx.fillStyle = C.red; ctx.fillRect(112, dy - 8, 280 * (r.alive / 6), 9);
    text(ctx, r.alive + ' / 6', 404, dy, 12, NUM, C.ink);

    text(ctx, '一方面军', 56, dy + 20, 9, SANS, C.ink3);
    ctx.fillStyle = C.panel; ctx.fillRect(112, dy + 12, 280, 9);
    ctx.fillStyle = C.ink3; ctx.fillRect(112, dy + 12, 280 * (13000 / 20000), 9);
    text(ctx, '13000 / 20000', 404, dy + 20, 12, NUM, C.ink3);

    text(ctx, '五百里　·　海拔 3400 米　·　七天七夜', 904, dy + 6, 10, SANS, C.ink3, 'normal', 'right');

    /* 遗物：只列没走出来的人 */
    var ry0 = 424;
    hair(ctx, 56, ry0, 904, ry0, C.line, 1);
    text(ctx, '遗　物', 56, ry0 + 18, 9, SANS, C.red, 'bold');

    var relics = [], j;
    for (j = 0; j < st.roster.length; j++) {
      if (!st.roster[j].alive && LAST_WORDS[st.roster[j].id]) {
        relics.push({ name: st.roster[j].name, relic: LAST_WORDS[st.roster[j].id].relic });
      }
    }
    if (!relics.length) {
      text(ctx, '没有遗物。六个人都走出来了。', 56, ry0 + 42, 11.5, SERIF, C.ink2);
    } else {
      for (j = 0; j < relics.length && j < 6; j++) {
        var cx2 = 56 + (j < 3 ? 0 : 442);
        var cy2 = ry0 + 40 + (j % 3) * 21;
        text(ctx, relics[j].name, cx2, cy2, 9.5, SANS, C.ink2);
        text(ctx, relics[j].relic, cx2 + 46, cy2, 10.5, SERIF, C.ink2);
      }
    }

    /* 重开 */
    var bx = 748, by = 516, bw = 156, bh = 36;
    var hot = st.hover === 'restart';
    var armed = t < st.confirmUntil;
    ctx.fillStyle = hot ? C.red : 'rgba(0,0,0,0)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = C.red; ctx.lineWidth = 1.2;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    text(ctx, armed ? '再点一次确认' : '重新入草地', bx + bw / 2, by + 24, 12.5, SANS, hot ? C.paper : C.red, 'bold', 'center');
    HOT.push({ id: 'restart', x: bx, y: by, w: bw, h: bh, k: 0 });

    var ach = [];
    if (r.alive === 6) ach.push('一个不少');
    if (st.bog && st.bog.outcome === 'saved') ach.push('泥里捞人');
    if (!st.forageEver && r.alive === 6) ach.push('没拿野菜顶粮');
    if (ach.length) text(ctx, '成就　' + ach.join('　·　'), 56, 550, 10, SANS, C.gold);

    text(ctx, '本关只写一个连队的七天。', 56, 572, 10, SANS, C.ink2);
    text(ctx, '— 完 —', 700, 572, 10, NUM, C.ink2, 'normal', 'right');
  }

  /* ============================================================== 主控 */
  var HOT = [];

  function boot(ctx, bootOpts) {
    var canvas = ctx.canvas;
    var st = createState();
    var raf = 0, last = 0, running = true;
    var view = { k: 1, ox: 0, oy: 0 };
    var seedBase = (bootOpts && typeof bootOpts.seed === 'number') ? bootOpts.seed : 20260821;
    var rng = mulberry32(seedBase);
    var t0 = 0;

    /* ---------- 缩放 ---------- */
    var fsTick = 0, fsLast = 0;
    function resize() {
      var cw = canvas.width, ch = canvas.height;
      var k = Math.min(cw / W, ch / H);
      view.k = k;
      view.ox = (cw - W * k) / 2;
      view.oy = (ch - H * k) / 2;
      /* 小屏放大字号：每 500ms 才查一次显示尺寸，避免每帧 reflow */
      fsTick++;
      var nowTs = now();
      if (fsTick < 30 || nowTs - fsLast < 500) return;
      fsLast = nowTs;
      var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
      if (rect && rect.width > 0 && rect.width < 900) {
        FS = Math.min(1.35, 960 / rect.width * 0.9);
      } else {
        FS = 1;
      }
    }

    /* ---------- 场景流转 ---------- */
    function enterBeat(i) {
      if (i >= BEATS.length) { st.sub = 'end'; finish(); return; }
      if (aliveList(st).length === 0) { finish(); return; }
      st.beat = i;
      st.page = 0;
      st.sub = 'text';
      st.tl = null;
      st.tlKey = '';
      var b = BEATS[i];
      st.dayLabel = b.dayLabel;
      st.place = b.place;
      st.li = b.li;
      if (b.settle) {
        for (var d = 0; d < b.settle; d++) {
          settleDay(st, rng);
          if (st.day === 3 || st.day === 4) nightCheckSoft(st);
        }
      }
      /* 走完最后三天，才算到了班佑河边 */
      if (b.id === 'a6') st.place = '班佑河';
      /* 路上死光了，就不再进这一幕的正文 */
      if (aliveList(st).length === 0) {
        if (st.pendingWords.length) {
          st.wordsFrom = 'beat';
          st.sub = 'lastWords';
          st.wordsEnterAt = now();
          st.lock = now() + 320;
        } else {
          finish();
        }
        return;
      }
      st.lock = now() + 240;
    }

    /* 中途的夜间只做轻微结算，避免数值失控 */
    function nightCheckSoft(s) {
      var a = aliveList(s);
      for (var i = 0; i < a.length; i++) {
        a[i].hp = clamp(a[i].hp - 2, 0, 100);
        if (a[i].hp <= 0) kill(s, a[i].id, '夜间失温');
      }
    }

    function finish() {
      st.scene = 'result';
      st.sub = 'result';
      st.resultCards = buildResult(st);
      if (st.resultCards) ENDING_SEEN[st.resultCards.title] = 1;
      st.confirmUntil = 0;
      st.lock = now() + 400;
    }

    function restart() {
      var fresh = createState();
      for (var key in fresh) if (fresh.hasOwnProperty(key)) st[key] = fresh[key];
      st.beat = -1;
      st.scene = 'cover';
      st.sub = 'text';
      st.delta = null;
      st.bog = null;
      st.tl = null;
      st.tlKey = '';
      rng = mulberry32(seedBase + Math.floor(Math.random() * 9999));
      enterCover();
    }

    function enterCover() {
      st.scene = 'cover';
      st.sub = 'text';
      st.tl = null;
      st.tlKey = '';
      st.lock = now() + 200;
    }

    /* ---------- 应用选择 ---------- */
    /* 先只落选项本身，让「他们说」发生在结果之前 */
    function applyOption(beat, idx) {
      var o = beat.choice.opts[idx];
      o.apply(st);

      if (beat.id === 'a5') {
        if (st.camp === 'weak') {
          var arr = aliveList(st).slice().sort(function (a, b) { return a.hp - b.hp; });
          st.campWeak = arr.slice(0, 2).map(function (s) { return s.id; });
        } else {
          st.campWeak = null;
        }
      }

      st.reaction = null;
      var rb = REACTIONS[beat.id];
      if (rb) {
        var rk = o.key;
        if (rb[rk]) {
          var list = [], i, who, m;
          for (i = 0; i < rb[rk].length; i++) {
            who = rb[rk][i][0];
            m = members(st, who);
            if (m && m.alive) list.push(rb[rk][i]);
          }
          if (list.length) st.reaction = list;
        }
      }

      st.pendingResolve = { beatId: beat.id, idx: idx };
      if (st.reaction) {
        st.sub = 'reaction';
        st.wordsEnterAt = now();
        st.lock = now() + 300;
      } else {
        resolveChoice(beat, idx);
      }
    }

    /* ---------- 结算选择 ---------- */
    function resolveChoice(beat, idx) {
      var rows = [];
      var i, j, s, n, dead = [], lost = 0;

      if (beat.id === 'a1') {
        rows.push({ label: '口粮定量', value: idx === 0 ? '每人每天二斤' : (idx === 1 ? '每人每天一斤' : '伤员、老人、孩子先吃') });
        rows.push({ label: '预计断粮', value: idx === 0 ? '第 5 天' : (idx === 1 ? '走完草地（第 8 天）' : '第 7 天'), bad: idx === 0 });
      } else if (beat.id === 'a2') {
        if (idx === 0) rows.push({ label: '今天的补给', value: '只有野菜', note: '皮带、骡子留着' });
        else if (idx === 1) rows.push({ label: '今天的补给', value: '野菜 + 皮带', note: '柴火 −1' });
        else rows.push({ label: '今天的补给', value: '野菜 + 骡肉', note: '伤号没人驮' });
      } else if (beat.id === 'a3') {
        var r = weedCheck(st, rng);
        var keep = st.extra === 'belt' ? '皮带汤照吃' : (st.extra === 'horse' ? '骡肉汤照吃' : '');
        if (!r.poisoned) {
          rows.push({ label: '这一锅', value: '没有毒', good: true });
          if (idx === 0) rows.push({ label: '代价', value: '石大勇仍坚持先尝，体力 −4' });
          else if (idx === 2) {
            if (keep) rows.push({ label: '结果', value: keep + '，野菜锅倒掉' });
            else rows.push({ label: '结果', value: st.grain > 0 ? '全连吃干粮，锅倒掉' : '全连饿一天', bad: st.grain <= 0 });
          }
          else rows.push({ label: '代价', value: '无' });
        } else {
          rows.push({ label: '这一锅', value: '有毒', bad: true });
          rows.push({ label: '中毒症状', value: '胃胀、拉绿水、手脚发肿、四肢麻木' });
          if (idx === 0) rows.push({ label: '结果', value: r.sickCount ? '石大勇一人中毒' : '没有人中毒', bad: !!r.sickCount });
          else if (idx === 1) rows.push({ label: '结果', value: r.sickCount ? r.sickCount + ' 人中毒' : '没有人出现症状', bad: !!r.sickCount });
          else {
            if (keep) rows.push({ label: '结果', value: '无人中毒。' + keep + '，野菜锅倒掉' });
            else rows.push({ label: '结果', value: st.grain > 0 ? '无人中毒。锅倒掉' : '无人中毒。全连饿一天', bad: st.grain <= 0 });
          }
          for (i = 0; i < r.dead.length; i++) {
            s = members(st, r.dead[i]);
            if (s) rows.push({ label: '减员', value: s.name + ' 停止呼吸', bad: true });
          }
        }
      } else if (beat.id === 'a5') {
        var res = nightCheck(st, rng);
        dead = res.dead;
        rows.push({ label: '夜间气温', value: '0 ℃', note: '雨夹雪' });
        if (idx === 0) {
          rows.push({ label: '结果', value: dead.length ? '一夜没睡好，有人没醒过来' : '一夜没睡好，但都活着', bad: dead.length > 0, good: dead.length === 0 });
        } else if (idx === 1) {
          if (res.sleep) {
            s = members(st, res.sleep);
            rows.push({ label: '结果', value: (s ? s.name : '有人') + ' 睡熟滚进泥沼', bad: true });
          } else {
            rows.push({ label: '结果', value: dead.length ? '没有人滚落，但有人没撑住' : '没有人滚落，但都冻得够呛', bad: true });
          }
        } else if (idx === 2) {
          var weakIds = st.campWeak || [];
          var weakNames = [], weakDead = 0, otherDead = 0;
          for (i = 0; i < weakIds.length; i++) {
            s = members(st, weakIds[i]);
            if (s) weakNames.push(s.name.replace(/\s/g, ''));
          }
          for (i = 0; i < dead.length; i++) {
            if (weakIds.indexOf(dead[i]) >= 0) weakDead++;
            else otherDead++;
          }
          rows.push({ label: '躺下的人', value: weakNames.join('、') || '—' });
          var wtxt;
          if (!dead.length) wtxt = '躺下的人都撑到了天亮';
          else if (weakDead === weakIds.length && !otherDead) wtxt = weakIds.length >= 2 ? '躺下的两个人再没起来' : '躺下的人再没起来';
          else if (weakDead === weakIds.length) wtxt = '躺下的人全没起来，坐着的也有人倒下';
          else if (weakDead) wtxt = otherDead ? '躺下的人没起来，坐着的也有人倒下' : '躺下的人只起来一个';
          else wtxt = '躺下的人撑住了，坐着的没撑住';
          rows.push({ label: '结果', value: wtxt, bad: dead.length > 0, good: dead.length === 0 });
        } else {
          rows.push({ label: '结果', value: (res.fire ? '火只暖一面' : '柴不够，火没生起来') + (dead.length ? '，有人没撑到天亮' : '，都湿透了'), bad: true });
        }
        for (i = 0; i < dead.length; i++) {
          s = members(st, dead[i]);
          if (s) rows.push({ label: '减员', value: s.name + '：' + s.deathCause, bad: true });
        }
      } else if (beat.id === 'a6') {
        if (idx === 0) {
          /* 全关最强反转 */
          var a = aliveList(st);
          for (i = 0; i < a.length; i++) {
            a[i].hp = clamp(a[i].hp - 55, 0, 100);
            if (a[i].hp <= 0) { kill(st, a[i].id, '南岸坐等一夜，冻饿失温'); dead.push(a[i].id); }
          }
          rows.push({ label: '这一夜', value: '全连在南岸背靠背坐下', bad: true });
          rows.push({ label: '天亮时', value: aliveList(st).length + ' 个人还能站起来', bad: aliveList(st).length === 0 });
        } else if (idx === 2) {
          n = aliveList(st).length;
          var first = Math.min(3, n);
          var batches = Math.max(1, Math.ceil(n / 3));
          rows.push({ label: '做法', value: first + ' 人先下水，竹棍探底，绑腿搓绳', good: true });
          rows.push({ label: '结果', value: (batches === 1 ? '一次过完' : '分 ' + batches + ' 批过完') + '，没有人被冲走', good: true });
        } else if (idx === 1) {
          n = aliveList(st).length;
          lost = Math.min(2, Math.max(0, n - 1));
          for (j = 0; j < lost; j++) {
            var v = lowest(st);
            if (v) { kill(st, v.id, '渡河时被水冲走'); dead.push(v.id); }
          }
          rows.push({ label: '结果', value: lost ? lost + ' 人被水冲走' : '没有人被冲走', bad: lost > 0 });
        } else {
          var up = lowest(st);
          if (up) { kill(st, up.id, '岸边滑落，无人看见'); dead.push(up.id); }
          var c2 = aliveList(st);
          for (i = 0; i < c2.length; i++) {
            c2[i].hp = clamp(c2[i].hp - 55, 0, 100);
            if (c2[i].hp <= 0) { kill(st, c2[i].id, '南岸坐等一夜，冻饿失温'); dead.push(c2[i].id); }
          }
          rows.push({ label: '结果', value: '上游三里，没有浅滩。天黑了。', bad: true });
          rows.push({ label: '天亮时', value: aliveList(st).length + ' 个人还能站起来', bad: aliveList(st).length === 0 });
        }
        for (i = 0; i < dead.length; i++) {
          s = members(st, dead[i]);
          if (s) rows.push({ label: '减员', value: s.name + '：' + s.deathCause, bad: true });
        }
      }

      st.delta = {
        title: '变　化',
        rows: rows,
        quote: beat.id === 'a3' ? '1935 年 8 月，红军各连在草地试吃野菜：党员、干部先尝，确认无毒再分给全连。不少党员干部因此献出生命。'
          : (beat.id === 'a6' && (idx === 0 || idx === 3)
          ? '王平回忆：河滩上坐着至少有七八百人，都静静地背靠背，一动不动。他俯下身子逐个查看，全都没气了。'
          : '')
      };
      st.pendingResolve = null;
      st.sub = 'delta';
      st.lock = now() + 320;
    }

    /* ---------- 每帧绘制 ---------- */
    function render(ts) {
      var TH = sceneTheme(st);
      applyTheme(TH.name);

      var cw = canvas.width, ch = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, cw, ch);
      resize();
      ctx.setTransform(view.k, 0, 0, view.k, view.ox, view.oy);

      HOT.length = 0;

      if (st.scene === 'cover') {
        drawCover(ctx, st);
        drawDeco(ctx, TH.deco, ts);
      } else if (st.scene === 'story') {
        if (st.sub === 'lastWords') {
          drawLastWords(ctx, st, ts);
          return;
        }
        if (st.sub === 'reaction') {
          drawReaction(ctx, st, ts);
          return;
        }
        drawPaper(ctx);
        drawHeader(ctx, st);
        drawMeta(ctx, st);
        drawTicks(ctx, st);

        if (st.sub === 'bog') {
          drawBog(ctx, st, ts - t0);
          drawDeco(ctx, TH.deco, ts);
          return;
        }
        if (st.sub === 'bogEnd') {
          drawBogEnd(ctx, st);
          drawDeco(ctx, TH.deco, ts);
          return;
        }
        if (st.sub === 'delta') {
          drawDelta(ctx, st);
          drawDeco(ctx, TH.deco, ts);
          return;
        }

        /* 正文页 */
        var beat = BEATS[st.beat];
        var bodyX = 56, bodyW = 566, bodyY = 152, lh = 34;

        if (st.sub === 'text') {
          /* 前面的句子留在纸上变灰，新句压在下面 —— 像同一页不断添写 */
          var yy = bodyY, pp, nn;
          for (pp = 0; pp <= st.page; pp++) {
            var ptxt = pageOf(beat, pp, st);
            if (pp === st.page) {
              var key = beat.id + '#' + pp;
              if (st.tlKey !== key) { st.tl = makeTimeline(ptxt, 42); st.tlKey = key; st.tlStart = ts; }
              var shown = shownCount(st.tl, ts - st.tlStart);
              nn = typed(ctx, ptxt, bodyX, yy, bodyW, shown, { size: 18, lh: lh, color: C.ink });
            } else {
              nn = typed(ctx, ptxt, bodyX, yy, bodyW, 9999, { size: 18, lh: lh, color: C.ink3 });
            }
            yy += nn * lh + 18;
          }

          /* 页脚 */
          hair(ctx, 56, 508, 904, 508, C.line, 1);
          text(ctx, '出处：' + (beat.source || ''), 56, 530, 10, SANS, C.ink3);
          text(ctx, '点击继续', 56, 556, 10, SANS, C.red);
          text(ctx, '— ' + (st.page + 1) + ' / ' + beat.pages.length + ' —', 904, 556, 10, NUM, C.ink3, 'normal', 'right');
          HOT.push({ id: 'body', x: 0, y: 0, w: W, h: 500, k: 0 });
          drawRoster(ctx, st, ts);
          drawGrain(ctx, st);
          drawDangerAlert(ctx, st);
        } else if (st.sub === 'choice') {
          /* 保留题干 */
          var q = pageOf(beat, beat.pages.length - 1, st);
          typed(ctx, q, bodyX, 138, bodyW, 9999, { size: 15, lh: 26, color: C.ink2 });
          drawChoices(ctx, st, beat.choice, 210);
          hair(ctx, 56, 508, 904, 508, C.line, 1);
          text(ctx, '出处：' + (beat.source || ''), 56, 530, 10, SANS, C.ink3);
          drawRoster(ctx, st, ts);
          drawGrain(ctx, st);
          drawDangerAlert(ctx, st);
        }
      } else if (st.scene === 'result') {
        drawResult(ctx, st, ts);
        if (st.showEndings) drawEndingsOverlay(ctx, st);
      }
    }

    /* delta 页的简化档案栏 */
    function drawRosterSmall(ctx, s) {
      var x0 = 660, y0 = 180;
      text(ctx, '兵　力', x0, y0 - 10, 9, SANS, C.ink3);
      var alive = aliveList(s).length;
      text(ctx, alive + ' / ' + s.roster.length, x0 + 236, y0 - 10, 12, NUM, C.ink, 'normal', 'right');
      for (var i = 0; i < s.roster.length; i++) {
        var p = s.roster[i], stt = rosterState(p);
        var cx = x0 + (i % 3) * 28, cy = y0 + Math.floor(i / 3) * 28;
        if (stt === 'ok') { ctx.fillStyle = C.red; ctx.fillRect(cx, cy, 22, 22); }
        else if (stt === 'weak') { ctx.globalAlpha = 0.42; ctx.fillStyle = C.red; ctx.fillRect(cx, cy, 22, 22); ctx.globalAlpha = 1; }
        else if (stt === 'bad') { ctx.strokeStyle = C.red; ctx.lineWidth = 1.4; ctx.strokeRect(cx + 0.5, cy + 0.5, 21, 21); }
        else { ctx.strokeStyle = C.ink3; ctx.lineWidth = 1; ctx.strokeRect(cx + 0.5, cy + 0.5, 21, 21); hair(ctx, cx + 2, cy + 2, cx + 20, cy + 20, C.ink3, 1); }
      }
    }

    /* ---------- 循环 ---------- */
    function now() {
      return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    }

    function frame(ts) {
      if (!running) return;
      render(ts);
      raf = requestFrame(frame);
    }

    function requestFrame(fn) {
      if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
      return setTimeout(function () { fn(now()); }, 16);
    }

    function cancelFrame(id) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
      else clearTimeout(id);
    }

    /* ---------- 输入 ---------- */
    function toDesign(ev) {
      var r;
      if (canvas.getBoundingClientRect) r = canvas.getBoundingClientRect();
      else r = { left: 0, top: 0, width: canvas.width, height: canvas.height };
      var cx = (ev.clientX - r.left) * (canvas.width / r.width);
      var cy = (ev.clientY - r.top) * (canvas.height / r.height);
      return { x: (cx - view.ox) / view.k, y: (cy - view.oy) / view.k };
    }

    function hitAt(p) {
      for (var i = HOT.length - 1; i >= 0; i--) {
        var h = HOT[i];
        if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h;
      }
      return null;
    }

    function onDown(ev) {
      var p = toDesign(ev);
      var h = hitAt(p);
      st.press = h ? { id: h.id, x: p.x, y: p.y, t: now() } : null;
      if (h && h.id.indexOf('opt') === 0) st.hover = h.id;
    }

    function onUp(ev) {
      var p = toDesign(ev);
      var h = hitAt(p);
      var pr = st.press;
      st.press = null;
      if (!h || !pr || pr.id !== h.id) return;
      if (now() - pr.t < 16) return;
      if (now() < st.lock) return;
      act(h, ev);
    }

    function onMove(ev) {
      var p = toDesign(ev);
      var h = hitAt(p);
      st.hover = h ? h.id : null;
    }

    function act(h, ev) {
      /* 封面 */
      if (st.scene === 'cover') {
        if (h.id === 'start') { st.scene = 'story'; enterBeat(0); }
        return;
      }
      /* 结算 */
      if (st.scene === 'result') {
        if (st.showEndings) {
          if (h.id === 'closeEndings') { st.showEndings = false; st.lock = now() + 200; }
          return;
        }
        if (h.id === 'endings') { st.showEndings = true; st.lock = now() + 220; return; }
        if (h.id === 'restart') {
          if (now() < st.confirmUntil) { restart(); }
          else { st.confirmUntil = now() + 3000; }
        }
        return;
      }
      /* 泥沼 */
      if (st.sub === 'bog') {
        if (h.id.indexOf('bog') === 0) { bogAction(st, h.k); }
        return;
      }
      if (st.sub === 'bogEnd') {
        if (h.id === 'next') {
          if (st.pendingWords.length) { st.wordsFrom = 'delta'; st.sub = 'lastWords'; st.wordsEnterAt = now(); st.lock = now() + 320; }
          else nextBeat();
        }
        return;
      }
      /* 账本 */
      if (st.sub === 'delta') {
        if (h.id === 'next') {
          if (st.pendingWords.length) { st.wordsFrom = 'delta'; st.sub = 'lastWords'; st.wordsEnterAt = now(); st.lock = now() + 320; }
          else nextBeat();
        }
        return;
      }
      /* 说话页：先说完，再结算 */
      if (st.sub === 'reaction') {
        if (h.id === 'next') {
          st.reaction = null;
          var pr = st.pendingResolve;
          st.pendingResolve = null;
          if (pr) resolveChoice(BEATS[st.beat], pr.idx);
          else nextBeat();
        }
        return;
      }
      /* 遗言：一页一个人，翻完了再往下走 */
      if (st.sub === 'lastWords') {
        if (h.id === 'next') {
          st.pendingWords.shift();
          st.lock = now() + 300;
          st.wordsSeen += 1;
          if (st.pendingWords.length) { st.wordsEnterAt = now(); return; }
          if (st.wordsFrom === 'delta') nextBeat();
          else proceedAfterBeat(BEATS[st.beat]);
        }
        return;
      }
      /* 正文 */
      if (st.sub === 'text') {
        if (h.id === 'body') {
          var beat = BEATS[st.beat];
          var txt = pageOf(beat, st.page, st);
          var total = Array.from(txt).length;
          var shown = shownCount(st.tl, now() - st.tlStart);
          if (shown < total) {
            st.tlStart = now() - st.tl.total - 1;
            return;
          }
          st.page += 1;
          if (st.page >= beat.pages.length) {
            if (st.pendingWords.length) { st.wordsFrom = 'beat'; st.sub = 'lastWords'; st.wordsEnterAt = now(); st.lock = now() + 320; return; }
            proceedAfterBeat(beat);
          }
        }
        return;
      }
      /* 选项 */
      if (st.sub === 'choice') {
        if (h.id.indexOf('opt') === 0) {
          applyOption(BEATS[st.beat], h.k);
        }
        return;
      }
    }

    function proceedAfterBeat(beat) {
      if (aliveList(st).length === 0) { finish(); return; }
      if (beat.choice) { st.sub = 'choice'; st.lock = now() + 220; }
      else if (beat.then === 'bog') { st.bog = bogCreate(st); st.sub = 'bog'; st.lock = now() + 400; }
      else nextBeat();
    }

    function nextBeat() {
      var i = st.beat + 1;
      if (i >= BEATS.length || aliveList(st).length === 0) { finish(); return; }
      enterBeat(i);
    }

    /* ---------- 启动 ---------- */
    function onLeave() { st.hover = null; }
    function onTouchStart(e) {
      if (e.touches && e.touches[0]) onDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }
    function onTouchEnd(e) {
      if (e.changedTouches && e.changedTouches[0]) onUp({ clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY });
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    if (typeof canvas.addEventListener === 'function' && canvas.onpointerdown === undefined) {
      canvas.addEventListener('touchstart', onTouchStart, { passive: true });
      canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    enterCover();
    resize();
    raf = requestFrame(frame);

    return {
      destroy: function () {
        running = false;
        cancelFrame(raf);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchend', onTouchEnd);
      },
      /* 以下仅供调试与自动化测试，宿主可忽略 */
      _state: st,
      _hot: HOT
    };
  }

  return { boot: boot };
})();

  function mount(root, ctx) {
    root.innerHTML = '';

    var canvas = document.createElement('canvas');
    var w = root.clientWidth || 1280;
    var h = root.clientHeight || 720;
    canvas.width = w;
    canvas.height = h;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.outline = 'none';
    root.appendChild(canvas);

    var game = Grassland.boot(canvas.getContext('2d'));
    var finished = false;
    var timer = setInterval(function () {
      if (finished || !game || !game._state) return;
      if (game._state.scene === 'result') {
        finished = true;
        clearInterval(timer);

        if (ctx && typeof ctx.complete === 'function') {
          ctx.complete();
          return;
        }

        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'cz:done' }, '*');
          }
        } catch (e) {}
      }
    }, 120);

    function cleanup() {
      clearInterval(timer);
      if (game && typeof game.destroy === 'function') game.destroy();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    return cleanup;
  }

  global.LEVEL = { mount: mount };

  var stage = document.getElementById('stage');
  if (stage && !stage.dataset.mounted) {
    stage.dataset.mounted = '1';
    mount(stage, null);
  }
})(window);
