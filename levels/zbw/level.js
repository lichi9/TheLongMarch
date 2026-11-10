/* ============================================================
 * 过草地 · 两程行军 —— levels/zbw/level.js
 * 这一个文件里装着两关，靠下面的 mount() 串起来：
 *   第一程「推字行军」：浓雾盖着草地，棋盘上的字走近才现形；找到「友」，
 *                       听他话里那个能带走的字（火），借光摸到「营」。
 *   第二程「涉水行军」：没有雾，但白河两格宽、没有桥，涉一步减员近千；
 *                       草下藏着看不见的泥沼，也藏着前队留在西岸的一条木筏。
 * 分数：第一关结算分（满分 100，按步数与踩沼扣）直接带进第二关，
 *       第二关再用本关减员换算，最终分 = 第一关分 − 本关减员/50。
 * 通关：两关都走完才 postMessage({ type: 'cz:done' })，中间不通知主程序。
 * 操作：电脑 WASD / 方向键；手机左下角虚拟摇杆。
 * ============================================================ */
(function (global) {
'use strict';

/* ---------- 小屏幕 / 手机：整盘等比缩到一屏放得下 ----------
   主程序里 #stage 固定 1280×720，算下来 s=1，等于没动；
   单独打开（手机横屏）时把棋盘、顶栏、摇杆一起缩，保证不用滚屏。 */
function fitStage(root) {
  var board = root.querySelector('.board');
  if (!board) { root.style.transform = ''; return; }
  var d = document.documentElement;
  var W = d.clientWidth || window.innerWidth;
  var H = d.clientHeight || window.innerHeight;
  var cw = board.offsetWidth + 48;
  var ch = board.offsetTop + board.offsetHeight + 28;
  var s = Math.min(1, W / cw, H / ch);
  root.style.transformOrigin = '50% 50%';
  root.style.transform = s < 0.995 ? 'scale(' + (Math.floor(s * 1000) / 1000) + ')' : '';
}
function watchFit(root) {
  if (root.__fitBound) return;
  root.__fitBound = 1;
  var on = function () { setTimeout(function () { fitStage(root); }, 60); };
  window.addEventListener('resize', on);
  window.addEventListener('orientationchange', on);
}

/* ---------- 第一程：过草地（浓雾 / 友 / 火） ---------- */
function stage1(root, onDone) {
  var ROWS = 11, COLS = 16;
  /* # 山(墙)  . 草(地面)  W 沼泽  E 营(出口)
     左半是碎石滩：石峰东一块西一块，绕行才走得通；
     右半是山里的蛇形石缝：唯一的入口在东北 (2,10)，进去以后左拐右拐，
     营藏在东南角 (8,14) 的死角里，雾里得摸到跟前才认得出来。 */
  var MAP_SRC = [
    '################',
    '#.....#.#.#.####',
    '#..WW..........#',
    '#....##.#.#.####',
    '#....#....#...##',
    '#....#....##.###',
    '#..WW...#.#...##',
    '#......##.#.####',
    '#.........#...E#',
    '#..#.#....#.####',
    '################'
  ];
  var TERRAIN_CHAR = { '#': '山', '.': '草', 'W': '沼', 'E': '营' };
  /* 地形 → CSS 类名（第一程专用，和雾的深浅拉开层次，别让满屏都是纯白） */
  var TERRAIN_CLS = { '#': 'c1h', '.': 'c1g', 'W': 'tW', 'E': 'tE' };
  /* NPC「友」靠在左场的草里，撞上去或按空格听他说话 */
  var NPC = { r: 2, c: 2, ch: '友' };
  /* 他的话就是谜面：整句里只有一个「火」字 */
  var FRIEND_LINE = '我不走了，这条腿追不上队伍。走了七天七夜，倒下的人比草还多……' +
                    '你替我把火带过去。北边霧重，别让它灭了。';
  /* 火已经拿走之后，再说一句——只是鼓励，没有可带走的字 */
  var FRIEND_LINE2 = '走吧，别回头。东西在你手里，路就在脚底下。' +
                     '草地那边还有活路——我在这儿歇一会儿，等队伍都过去了，我再慢慢跟上来。';
  var TARGET = '火';          /* 能从话里带走的那个字 */
  var PUNC = '，。、；：？！—…';

  var STEP_LOSS = 100;    /* 行军消耗：每走一步减员（冻饿、掉队） */
  var STEP_EVERY = 1;     /* 几步减一次 */
  var SWAMP_LOSS = 700;   /* 踩一次沼额外减员——陷进去就拉不出来 */
  var PAR = 120;          /* 免罚步数 */
  var STEP_COST = 1;      /* 超出后每步扣分 */
  var SWAMP_COST = 5;     /* 每踩一次沼扣分 */
  var KEYSTEP = 110;      /* 键盘连按节流 */
  var HINT_MS = 60000;    /* 一分钟还没走出去就给提示 */

  var terrain = [], me = { r: 5, c: 2 };
  var troops = 20000, steps = 0, swampHits = 0;
  var hasFire = false, over = false, done = false, lastStep = 0;
  var talking = false, cursor = 0, msg = '', flashMsg = '';
  var slowHint = false, hintTimer = null;
  var screen = 'cover';   /* cover | story | brief | play */

  var HISTORY = '1935年8月，红军进入松潘草地。红一方面军过草地前约2万人，' +
                '走出草地时约1.3万人。七天行军中，饥饿、沼泽与严寒造成了惨重减员。';

  /* ---------- 地图 ---------- */
  function reset() {
    var r, c;
    terrain = [];
    for (r = 0; r < ROWS; r++) {
      terrain[r] = [];
      for (c = 0; c < COLS; c++) terrain[r][c] = MAP_SRC[r].charAt(c);
    }
    me = { r: 5, c: 2 };
    troops = 20000; steps = 0; swampHits = 0;
    hasFire = false; over = false;
    talking = false; cursor = 0; msg = ''; flashMsg = '';
  }

  function inside(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
  function isNpc(r, c) { return r === NPC.r && c === NPC.c; }
  function nearNpc() { return Math.abs(me.r - NPC.r) + Math.abs(me.c - NPC.c) === 1; }
  /* 到「友」的相对方位与距离——开局雾太大，直接告诉玩家往哪走 */
  function npcDir() {
    var dr = NPC.r - me.r, dc = NPC.c - me.c, v = '', hz = '';
    if (dr < 0) v = '上'; else if (dr > 0) v = '下';
    if (dc < 0) hz = '左'; else if (dc > 0) hz = '右';
    return (v + hz) || '原地';
  }
  function npcDist() { return Math.abs(me.r - NPC.r) + Math.abs(me.c - NPC.c); }

  /* 雾里的视野：以「我」为中心，切比雪夫距离内才看得见字。
     没有火种时只看得到身边一圈（3×3）；接过火种之后照得远得多。 */
  var SIGHT_R = 1;
  var FIRE_R = 4;
  function visRadius() { return hasFire ? FIRE_R : SIGHT_R; }
  function visibleAt(r, c) {
    var R = visRadius();
    return Math.max(Math.abs(r - me.r), Math.abs(c - me.c)) <= R;
  }
  function playerCanEnter(r, c) {
    if (!inside(r, c) || isNpc(r, c)) return false;
    return terrain[r][c] !== '#'; /* 草 / 沼 / 营 */
  }

  /* ★ 通关通知 */
  /* 第一关走完：把分数和剩下的人数一起交给容器，接着挂第二关（不在这里 postMessage） */
  function finish(score, left) {
    if (done) return;
    done = true;
    onDone(score, left);
  }

  function calcScore() {
    var s = 100 - swampHits * SWAMP_COST - Math.max(0, steps - PAR) * STEP_COST;
    return Math.max(0, s);
  }

  function settle(fail) {
    over = true;
    clearTimeout(hintTimer);
    var score = fail ? 0 : calcScore();
    var title = fail ? '全军覆没' : '走出草地';
    var text = fail
      ? '队伍没能走出草地。这片沼泽，吞下了所有脚印。'
      : '走了 ' + steps + ' 步、踩了 ' + swampHits + ' 次沼泽，剩下 ' + troops +
        ' 人走出草地。';
    root.innerHTML = '<div class="settle"><p class="big">' + title + '　得分：' + score + '</p>' +
      '<p>剩余人数：' + troops + '</p>' +
      '<p class="small">' + text + '</p>' +
      '<p class="small">队伍还得往前——白河还在前面。</p></div>';
    setTimeout(function () { finish(score, troops); }, 1200);
  }

  /* ---------- 一分钟提示 ---------- */
  function startHintTimer() {
    clearTimeout(hintTimer);
    slowHint = false;
    hintTimer = setTimeout(function () {
      if (screen !== 'play' || over) return;
      slowHint = true;
      if (!talking) render();
    }, HINT_MS);
  }
  function slowHintText() {
    if (hasFire) return '火照得远些了：石缝在东北，穿过去往东南摸。';
    if (nearNpc()) return '按空格，听「友」把话说完。';
    return '「友」在你' + npcDir() + '方，约 ' + npcDist() + ' 步。';
  }

  /* ---------- 界外：铺满「山」「草」字的野地 ---------- */
  var FIELD_ROWS = 13, FIELD_COLS = 24;
  function fieldHTML() {
    var out = '', i, ch;
    for (i = 0; i < FIELD_ROWS * FIELD_COLS; i++) {
      ch = ((i * 7 + (i % FIELD_COLS) * 5) % 7 === 0) ? '山' : '草';
      out += '<span class="' + (ch === '山' ? 'f-s' : 'f-c') + '">' + ch + '</span>';
    }
    return out;
  }

  /* ---------- 与「友」对话 ---------- */
  function talkHTML() {
    /* 已经拿过火种：换一句鼓励的话，句子里没有能带走的东西 */
    var line = hasFire ? FRIEND_LINE2 : FRIEND_LINE;
    var defMsg = hasFire ? '他摆摆手，让你往前走。' : '他话里有一个字，能带走。';
    var out = '<div class="talk"><p class="talk-who">友</p><p class="talk-line">', i, ch, p;
    for (i = 0; i < line.length; i++) {
      ch = line.charAt(i);
      p = PUNC.indexOf(ch) >= 0;
      out += '<span class="' + (p ? 'p' : 'w') + '">' + ch + '</span>';
    }
    out += '</p><p class="talk-msg">' + (msg || defMsg) + '</p>' +
           (hasFire ? '' : '<p class="talk-hint">W / S 换行　A / D 换字　Enter 取字</p>') +
           '<button type="button" class="talk-close">先不问了</button></div>';
    return out;
  }

  function paintCursor() {
    var ws = root.querySelectorAll('.talk .w'), i;
    /* 已经拿过火种，这句只是话，不再有可取的字，也就不画光标 */
    for (i = 0; i < ws.length; i++) ws[i].classList.toggle('cur', !hasFire && i === cursor);
  }
  function moveCursor(d) {
    var n = root.querySelectorAll('.talk .w').length;
    if (!n) return;
    cursor = (cursor + d + n) % n;
    paintCursor();
  }
  /* W / S：按实际排版换行，落到上一行/下一行横向最近的那个字 */
  function moveCursorRow(dir) {
    var ws = root.querySelectorAll('.talk .w'), i, r, target = null, best = -1, bestDx = 1e9;
    if (!ws.length) return;
    var cr = ws[Math.min(cursor, ws.length - 1)].getBoundingClientRect();
    for (i = 0; i < ws.length; i++) {
      r = ws[i].getBoundingClientRect();
      if (dir < 0 && r.top < cr.top - 5) { if (target === null || r.top > target) target = r.top; }
      if (dir > 0 && r.top > cr.top + 5) { if (target === null || r.top < target) target = r.top; }
    }
    if (target === null) return;
    for (i = 0; i < ws.length; i++) {
      r = ws[i].getBoundingClientRect();
      if (Math.abs(r.top - target) < 2) {
        var dx = Math.abs((r.left + r.width / 2) - (cr.left + cr.width / 2));
        if (dx < bestDx) { bestDx = dx; best = i; }
      }
    }
    if (best >= 0) { cursor = best; paintCursor(); }
  }
  function takeCursor() {
    var ws = root.querySelectorAll('.talk .w');
    if (!ws.length) return;
    take(ws[Math.min(cursor, ws.length - 1)].textContent);
  }
  function take(ch) {
    /* 火种已经拿走：再点任何字都只是句子里的话，拿不走 */
    if (hasFire) {
      msg = '他摇摇头：该带的都带上了，快走。';
      var mt = root.querySelector('.talk-msg');
      if (mt) mt.textContent = msg;
      return;
    }
    if (ch === TARGET) {
      hasFire = true; talking = false; msg = '';
      flashMsg = '接过火种了。火照得更远了。';
      render();
      return;
    }
    msg = '「' + ch + '」只是句话里的字，拿不走。';
    var m = root.querySelector('.talk-msg');
    if (m) m.textContent = msg;
  }
  function openTalk() {
    talking = true; cursor = 0; msg = ''; flashMsg = '';
    render();
  }
  function bindTalk() {
    var ws = root.querySelectorAll('.talk .w'), i;
    for (i = 0; i < ws.length; i++) {
      (function (el) {
        el.addEventListener('click', function () { take(el.textContent); });
      })(ws[i]);
    }
    root.querySelector('.talk-close').addEventListener('click', function () {
      talking = false; msg = ''; render();
    });
    paintCursor();
  }

  /* ---------- 渲染（按 screen 分发） ---------- */
  function render() {
    if (screen === 'cover') {
      root.innerHTML =
        '<div class="screen cover">' +
        '  <p class="kicker">1935 年 8 月 · 松潘草地</p>' +
        '  <h1 class="cover-title">过草地 · 推字行军</h1>' +
        '  <p class="cover-sub">这个世界，是由汉字组成的</p>' +
        '  <button type="button" class="btn">开始游戏</button>' +
        '</div>';
      root.querySelector('.btn').addEventListener('click', function () { screen = 'story'; render(); });
      return;
    }
    if (screen === 'story') {
      root.innerHTML =
        '<div class="screen story">' +
        '  <h2 class="story-title">松潘草地</h2>' +
        '  <p class="story-text">' + HISTORY + '</p>' +
        '  <button type="button" class="btn">继续</button>' +
        '</div>';
      root.querySelector('.btn').addEventListener('click', function () { screen = 'brief'; render(); });
      return;
    }
    if (screen === 'brief') {
      root.innerHTML =
        '<div class="screen brief">' +
        '  <p class="brief-lead">你是一名红军指挥员。</p>' +
        '  <p class="brief-text">七天七夜，草地把路藏进了字里。<br>' +
        '  雾从脚边一直漫到天边，只有走近，才看得见脚下是什么；<br>草里还坐着一个走不动的人——去听他说完，把他手里的那点东西带上。</p>' +
        '  <p class="brief-goal">第一步：在雾里找到草中的「友」</p>' +
        '  <p class="brief-warn">你的每个决定都关乎着战士们的生死</p>' +
        '  <button type="button" class="btn">开始行军</button>' +
        '</div>';
      root.querySelector('.btn').addEventListener('click', function () {
        screen = 'play'; startHintTimer(); render();
      });
      return;
    }
    renderPlay();
  }

  function renderPlay() {
    var hint, tipCls = 'tip';
    if (hasFire) {
      hint = '火照得远些了——东北有石缝，穿过去往东南摸';
    } else if (nearNpc()) {
      hint = '「友」就在旁边 —— 按空格，听他把话说完';
      tipCls += ' strong';
    } else {
      hint = '雾太浓，先找草里的「友」：他在你' + npcDir() + '方，约 ' + npcDist() + ' 步';
      tipCls += ' strong';
    }
    var h = '<div class="field">' + fieldHTML() + '</div>' +
            '<div class="bar">步数：' + steps + '　｜　剩余人数：' + troops +
            '<span class="' + tipCls + '">' + hint + '</span>' +
            '<span class="warn">你的每个决定都关乎着战士们的生死</span>' +
            '<button type="button" class="again">重 来</button>' +
            '</div><div class="board">';
    for (var r = 0; r < ROWS; r++) {
      h += '<div class="line">';
      for (var c = 0; c < COLS; c++) {
        var t = terrain[r][c];
        var ch = '', cls = 'cell2';
        var seen = visibleAt(r, c);
        if (me.r === r && me.c === c) {
          ch = '我'; cls += ' me';
        } else if (!seen) {
          /* 雾里什么都看不清，连山也是「霧」 */
          ch = '霧'; cls += ' fog';
        } else if (isNpc(r, c)) {
          ch = NPC.ch; cls += ' npc';
        } else if (t === 'E') {
          ch = '营'; cls += ' tE';
        } else {
          ch = TERRAIN_CHAR[t]; cls += ' ' + TERRAIN_CLS[t];
        }
        /* 火照亮的那一圈：边框亮一点，标出视野边界 */
        if (hasFire && seen && !(me.r === r && me.c === c)) cls += ' lit';
        h += '<span class="' + cls + '">' + ch + '</span>';
      }
      h += '</div>';
    }
    h += '</div><div class="pad"><span class="knob"></span></div>';
    /* 提示条浮在底部，不占顶栏高度，棋盘不会被挤出画面 */
    h += '<div class="toast">' +
         (flashMsg ? '<span>' + flashMsg + '</span>' : '') +
         (slowHint ? '<span class="hint">' + slowHintText() + '</span>' : '') +
         '</div>';
    if (talking) h += talkHTML();
    root.innerHTML = h;
    root.querySelector('.again').addEventListener('click', function () {
      if (over) return;
      reset(); startHintTimer(); render();
    });
    if (talking) bindTalk();
    bindPad();
    watchFit(root);
    fitStage(root);
  }

  /* ---------- 走一步 ---------- */
  function step(dr, dc) {
    if (over || screen !== 'play' || talking) return;
    flashMsg = '';
    var nr = me.r + dr, nc = me.c + dc;
    if (!inside(nr, nc)) return;

    if (isNpc(nr, nc)) { openTalk(); return; }   /* 撞上「友」就说话 */

    if (terrain[nr][nc] === '#') { flashMsg = '是山，过不去。'; render(); return; }

    me.r = nr; me.c = nc;
    steps++;

    /* 行军消耗：每走两步减员 */
    if (steps % STEP_EVERY === 0) troops -= STEP_LOSS;

    if (terrain[me.r][me.c] === 'W') { /* 踩进沼：额外减员 */
      swampHits++;
      troops -= SWAMP_LOSS;
    }
    if (troops <= 0) { render(); settle(true); return; }
    if (terrain[me.r][me.c] === 'E') { render(); settle(false); return; }
    render();
  }

  /* ---------- 电脑：WASD / 方向键 ---------- */
  var KEYS = {
    w: [-1, 0], a: [0, -1], s: [1, 0], d: [0, 1],
    arrowup: [-1, 0], arrowleft: [0, -1], arrowdown: [1, 0], arrowright: [0, 1]
  };
  window.addEventListener('keydown', function (e) {
    var key = String(e.key).toLowerCase();
    if (screen !== 'play' || over) return;

    /* 对话中：W/S 换行、A/D 换字、Enter 取字，Esc 关掉 */
    if (talking) {
      if (key === 'a' || key === 'arrowleft') { e.preventDefault(); moveCursor(-1); }
      else if (key === 'd' || key === 'arrowright') { e.preventDefault(); moveCursor(1); }
      else if (key === 'w' || key === 'arrowup') { e.preventDefault(); moveCursorRow(-1); }
      else if (key === 's' || key === 'arrowdown') { e.preventDefault(); moveCursorRow(1); }
      else if (key === 'enter' || key === ' ') { e.preventDefault(); takeCursor(); }
      else if (key === 'escape' || key === 'q') { e.preventDefault(); talking = false; msg = ''; render(); }
      return;
    }

    /* 空格：站在「友」旁边就开口 */
    if (key === ' ' || key === 'enter') {
      e.preventDefault();
      if (nearNpc()) openTalk();
      return;
    }

    var k = KEYS[key];
    if (!k) return;
    e.preventDefault();
    var now = Date.now();
    if (now - lastStep < KEYSTEP) return;
    lastStep = now;
    step(k[0], k[1]);
  });

  /* ---------- 手机：虚拟摇杆 ---------- */
  function bindPad() {
    var pad = root.querySelector('.pad');
    var knob = pad.querySelector('.knob');
    var active = false, timer = null, dr = 0, dc = 0, MAXR = 30;
    function readDir(e, rect) {
      var dx = e.clientX - (rect.left + rect.width / 2);
      var dy = e.clientY - (rect.top + rect.height / 2);
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var k = len > MAXR ? MAXR / len : 1;
      knob.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)';
      if (len < 12) { dr = 0; dc = 0; return; }
      if (Math.abs(dx) > Math.abs(dy)) { dr = 0; dc = dx > 0 ? 1 : -1; }
      else { dr = dy > 0 ? 1 : -1; dc = 0; }
    }
    function stop() {
      active = false; clearInterval(timer);
      knob.style.transform = ''; dr = 0; dc = 0;
    }
    pad.addEventListener('pointerdown', function (e) {
      active = true;
      try { if (pad.setPointerCapture) pad.setPointerCapture(e.pointerId); } catch (err) {}
      readDir(e, pad.getBoundingClientRect());
      step(dr, dc);
      clearInterval(timer);
      timer = setInterval(function () { if (active) step(dr, dc); }, 170);
      e.preventDefault();
    });
    pad.addEventListener('pointermove', function (e) {
      if (active) readDir(e, pad.getBoundingClientRect());
    });
    pad.addEventListener('pointerup', stop);
    pad.addEventListener('pointercancel', stop);
    pad.addEventListener('pointerleave', stop);
  }

  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    root.classList.add('touch');
  }

  reset();
  render();
}

/* ---------- 第二程：涉水（白河 / 泥沼 / 木筏） ---------- */
function stage2(root, onDone, base, fromPrev, startTroops) {
  var ROWS = 11, COLS = 16;
  /* # 山(乱石)  . 草(地面)  W 沼泽(明面)  ~ 河(可走，每步-800)  E 营(宿营地)
     白河两格宽，纵贯第 9、10 列，没有桥——要么涉水连走两步（-1600），
     要么先在西岸草下摸到木筏，从哪儿下水都不减员。 */
  var MAP_SRC = [
    '################',
    '#..WW....~~...W#',
    '#........~~....#',
    '#...W....~~..W.#',
    '#........~~....#',
    '#...W....~~...E#',
    '#........~~....#',
    '#...W....~~....#',
    '#..W.....~~.W..#',
    '#...W....~~..W.#',
    '################'
  ];
  var TERRAIN_CHAR = { '#': '山', '.': '草', 'W': '沼', '~': '河', 'E': '营' };
  /* 地形 → CSS 类名（用纯 ASCII，避免 # ~ 这类字符进选择器） */
  var TERRAIN_CLS = { '#': 'th', '.': 'tg', 'W': 'tw', '~': 'tr', 'E': 'te' };
  /* 藏在草下的暗沼：踩上去才变成「沼」，并永久留痕 */
  var HIDDEN = [[2, 6], [4, 3], [6, 12], [8, 6], [9, 11], [1, 12], [4, 12]];
  /* 前队留下的筏：压在河西岸的草下（(6,8) 贴着河，捡到就能下水） */
  var RAFT = { r: 6, c: 8 };

  var START_TROOPS = (typeof startTroops === 'number' && startTroops > 0) ? startTroops : 20000;
  var ORIGIN_TROOPS = 20000;   /* 出发时的全军人数，用来换算存活率 */
  var STEP_LOSS = 100;    /* 每走一步减员（行军消耗） */
  var STEP_EVERY = 1;
  var SWAMP_LOSS = 700;   /* 踩一次沼（明面或暗藏）减员 */
  var RIVER_LOSS = 800;   /* 河里每走一步减员 */
  var KEYSTEP = 110;      /* 键盘连按节流 */
  var HINT_MS = 60000;    /* 一分钟还没走出去就给提示 */

  /* 起始分数 = 第一关的结算分数，由容器直接传进来；单独跑这一关时按满分 100 */
  var baseScore = (typeof base === 'number' && base >= 0) ? base : 100;

  var terrain = [], me = { r: 5, c: 2 };
  var troops = START_TROOPS, steps = 0, swampHits = 0, riverSteps = 0;
  var hasRaft = false, over = false, done = false, lastStep = 0;
  var flashMsg = '', slowHint = false, hintTimer = null;
  /* 摸到筏的那条大提示单独计时：不跟着走步消失，停够时间再收 */
  var RAFT_TIP_MS = 8000;
  var raftTip = false, raftPop = false, raftTimer = null;
  var screen = fromPrev ? 'brief' : 'cover';   /* cover | story | brief | play */

  var HISTORY = '1935年8月，红军进入松潘草地。草地五百余里，遍布沼泽泥潭，' +
                '一脚踏错就陷了下去；白河、黑河横亘其间，水冷刺骨，无桥也无船。' +
                '前有泥沼，后有追兵——队伍只能一步一步往前趟。';

  /* ---------- 地图 ---------- */
  function isHidden(r, c) {
    for (var i = 0; i < HIDDEN.length; i++) {
      if (HIDDEN[i][0] === r && HIDDEN[i][1] === c) return true;
    }
    return false;
  }
  function reset() {
    var r, c;
    terrain = [];
    for (r = 0; r < ROWS; r++) {
      terrain[r] = [];
      for (c = 0; c < COLS; c++) terrain[r][c] = MAP_SRC[r].charAt(c);
    }
    me = { r: 5, c: 2 };
    troops = START_TROOPS; steps = 0; swampHits = 0; riverSteps = 0;
    hasRaft = false; over = false;
    flashMsg = '';
    clearTimeout(raftTimer);
    raftTip = false; raftPop = false;
  }

  function inside(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  /* ★ 通关通知 */
  function finish() {
    if (done) return;
    done = true;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'cz:done' }, '*');
        return;
      }
    } catch (e) {}
  }

  function calcScore() {
    /* 得分 = 第一程的分 × 存活比例：两万人出发，剩多少人就拿几成 */
    return Math.max(0, Math.round(baseScore * troops / ORIGIN_TROOPS));
  }

  function settle(fail) {
    over = true;
    clearTimeout(hintTimer);
    clearTimeout(raftTimer);
    var score = fail ? 0 : calcScore();
    /* 分数写回，下一关接着用 */
    try { global.localStorage.setItem('cz_last_score', String(score)); } catch (err) {}
    var title = fail ? '全军覆没' : '涉过白河';
    var text = fail
      ? '一支队伍陷进了泥沼。有人伸手去拉，也被一起拖了下去。'
      : '两程共减员 ' + (ORIGIN_TROOPS - troops) + ' 人（涉水 ' + riverSteps + ' 步、踩沼 ' +
        swampHits + ' 次），剩下 ' + troops + ' 人，存活率 ' +
        Math.round(troops / ORIGIN_TROOPS * 100) + '%，最终得分 ' + score + '。';
    root.innerHTML = '<div class="settle"><p class="big">' + title + '　得分：' + score + '</p>' +
      '<p>剩余人数：' + troops + '</p>' +
      '<p class="small">' + text + '</p></div>';
    setTimeout(finish, 1200);
  }

  /* ---------- 一分钟提示 ---------- */
  function startHintTimer() {
    clearTimeout(hintTimer);
    slowHint = false;
    hintTimer = setTimeout(function () {
      if (screen !== 'play' || over) return;
      slowHint = true;
      render();
    }, HINT_MS);
  }
  function slowHintText() {
    if (hasRaft) return '筏在你手里——从哪儿下水都不减员，去河东找「营」。';
    return '筏就压在河西岸的草里——紧贴河沿的那一格，往东走到水边就摸着。';
  }

  /* ---------- 界外：铺满「山」「草」字的野地 ---------- */
  var FIELD_ROWS = 13, FIELD_COLS = 24;
  function fieldHTML() {
    var out = '', i, ch;
    for (i = 0; i < FIELD_ROWS * FIELD_COLS; i++) {
      ch = ((i * 7 + (i % FIELD_COLS) * 5) % 7 === 0) ? '山' : '草';
      out += '<span class="' + (ch === '山' ? 'f-s' : 'f-c') + '">' + ch + '</span>';
    }
    return out;
  }

  /* ---------- 渲染（按 screen 分发） ---------- */
  function render() {
    if (screen === 'cover') {
      root.innerHTML =
        '<div class="screen cover">' +
        '  <p class="kicker">1935 年 8 月 · 松潘草地</p>' +
        '  <h1 class="cover-title">过草地 · 涉水行军</h1>' +
        '  <p class="cover-sub">泥沼，也是由汉字组成的</p>' +
        '  <button type="button" class="btn">开始游戏</button>' +
        '</div>';
      root.querySelector('.btn').addEventListener('click', function () { screen = 'story'; render(); });
      return;
    }
    if (screen === 'story') {
      root.innerHTML =
        '<div class="screen story">' +
        '  <h2 class="story-title">松潘草地</h2>' +
        '  <p class="story-text">' + HISTORY + '</p>' +
        '  <button type="button" class="btn">继续</button>' +
        '</div>';
      root.querySelector('.btn').addEventListener('click', function () { screen = 'brief'; render(); });
      return;
    }
    if (screen === 'brief') {
      root.innerHTML =
        '<div class="screen brief">' +
        '  <p class="brief-lead">走出那片泥沼，白河又横在面前。</p>' +
        '  <p class="brief-text">白河两格宽，横在队伍面前，水冷刺骨——直接涉水，每走一步就被卷走 ' + RIVER_LOSS + ' 名战士，过河要连走两步；<br>' +
        '  河上没有桥，只有水。草丛下还埋着看不见的泥沼，踩上去才现形。<br>' +
        '  前队留下一条木筏，压在西岸河沿的草里。</p>' +
        '  <p class="brief-goal">第一步：沿河沿的草里摸到「筏」</p>' +
        '  <p class="brief-warn">你的每个决定都关乎着战士们的生死</p>' +
        '  <button type="button" class="btn">开始行军</button>' +
        '</div>';
      root.querySelector('.btn').addEventListener('click', function () {
        screen = 'play'; startHintTimer(); render();
      });
      return;
    }
    renderPlay();
  }

  function renderPlay() {
    var hint, tipCls = 'tip';
    if (hasRaft) {
      hint = '筏在手——从哪儿下水都不减员，涉水去河东找「营」';
    } else {
      hint = '河水冰冷：涉一步减员 ' + RIVER_LOSS + '。先去西岸河沿的草里摸「筏」';
      tipCls += ' strong';
    }
    var h = '<div class="field">' + fieldHTML() + '</div>' +
            '<div class="bar">步数：' + steps + '　｜　剩余人数：' + troops +
            (hasRaft ? '<span class="raftTag">筏 · 已得</span>' : '') +
            '<span class="' + tipCls + '">' + hint + '</span>' +
            '<span class="warn">你的每个决定都关乎着战士们的生死</span>' +
            '<button type="button" class="again">重 来</button>' +
            '</div><div class="board">';
    for (var r = 0; r < ROWS; r++) {
      h += '<div class="line">';
      for (var c = 0; c < COLS; c++) {
        var t = terrain[r][c];
        var ch = TERRAIN_CHAR[t], cls = 'cell2 ' + TERRAIN_CLS[t];
        if (me.r === r && me.c === c) {
          ch = '我'; cls = 'cell2 me';
        }
        h += '<span class="' + cls + '">' + ch + '</span>';
      }
      h += '</div>';
    }
    h += '</div><div class="pad"><span class="knob"></span></div>';
    /* 提示条浮在底部，不占顶栏高度，棋盘不会被挤出画面 */
    h += '<div class="toast">' +
         (flashMsg ? '<span>' + flashMsg + '</span>' : '') +
         (raftTip ? '<span class="raft' + (raftPop ? ' pop' : '') + '">' +
                    '摸到木筏了！——从这儿下水，一个人也不会少</span>' : '') +
         (slowHint ? '<span class="hint">' + slowHintText() + '</span>' : '') +
         '</div>';
    root.innerHTML = h;
    raftPop = false;   /* 弹出动画只做一次，之后每走一步都静着挂在那儿 */
    root.querySelector('.again').addEventListener('click', function () {
      if (over) return;
      reset(); startHintTimer(); render();
    });
    bindPad();
    watchFit(root);
    fitStage(root);
  }

  /* ---------- 走一步 ---------- */
  function step(dr, dc) {
    if (over || screen !== 'play') return;
    flashMsg = '';
    var nr = me.r + dr, nc = me.c + dc;
    if (!inside(nr, nc)) return;

    if (terrain[nr][nc] === '#') { flashMsg = '是山，过不去。'; render(); return; }

    me.r = nr; me.c = nc;
    steps++;

    /* 行军消耗：每走两步减员 */
    if (steps % STEP_EVERY === 0) troops -= STEP_LOSS;

    /* 草下摸出筏 */
    if (!hasRaft && me.r === RAFT.r && me.c === RAFT.c) {
      hasRaft = true;
      raftTip = true; raftPop = true;
      clearTimeout(raftTimer);
      raftTimer = setTimeout(function () {
        raftTip = false;
        if (screen === 'play' && !over) render();
      }, RAFT_TIP_MS);
    }

    var t = terrain[me.r][me.c];
    if (t === '~' && !hasRaft) {          /* 涉水：每步减员 */
      riverSteps++;
      troops -= RIVER_LOSS;
      flashMsg = '水冷得刺骨，一批战士倒在河里——快上岸！';
    } else if (t === 'W') {               /* 明面的沼泽 */
      swampHits++;
      troops -= SWAMP_LOSS;
      flashMsg = '踩进沼泽了！';
    } else if (isHidden(me.r, me.c)) {    /* 草下的暗沼：现形并留痕 */
      terrain[me.r][me.c] = 'W';
      swampHits++;
      troops -= SWAMP_LOSS;
      flashMsg = '草下竟是沼泽！记住这个位置。';
    }

    if (troops <= 0) { render(); settle(true); return; }
    if (t === 'E') { render(); settle(false); return; }
    render();
  }

  /* ---------- 电脑：WASD / 方向键 ---------- */
  var KEYS = {
    w: [-1, 0], a: [0, -1], s: [1, 0], d: [0, 1],
    arrowup: [-1, 0], arrowleft: [0, -1], arrowdown: [1, 0], arrowright: [0, 1]
  };
  window.addEventListener('keydown', function (e) {
    if (screen !== 'play' || over) return;
    var k = KEYS[String(e.key).toLowerCase()];
    if (!k) return;
    e.preventDefault();
    var now = Date.now();
    if (now - lastStep < KEYSTEP) return;
    lastStep = now;
    step(k[0], k[1]);
  });

  /* ---------- 手机：虚拟摇杆 ---------- */
  function bindPad() {
    var pad = root.querySelector('.pad');
    if (!pad) return;
    var knob = pad.querySelector('.knob');
    var active = false, timer = null, dr = 0, dc = 0, MAXR = 30;
    function readDir(e, rect) {
      var dx = e.clientX - (rect.left + rect.width / 2);
      var dy = e.clientY - (rect.top + rect.height / 2);
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var k = len > MAXR ? MAXR / len : 1;
      knob.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)';
      if (len < 12) { dr = 0; dc = 0; return; }
      if (Math.abs(dx) > Math.abs(dy)) { dr = 0; dc = dx > 0 ? 1 : -1; }
      else { dr = dy > 0 ? 1 : -1; dc = 0; }
    }
    function stop() {
      active = false; clearInterval(timer);
      knob.style.transform = ''; dr = 0; dc = 0;
    }
    pad.addEventListener('pointerdown', function (e) {
      active = true;
      try { if (pad.setPointerCapture) pad.setPointerCapture(e.pointerId); } catch (err) {}
      readDir(e, pad.getBoundingClientRect());
      step(dr, dc);
      clearInterval(timer);
      timer = setInterval(function () { if (active) step(dr, dc); }, 170);
      e.preventDefault();
    });
    pad.addEventListener('pointermove', function (e) {
      if (active) readDir(e, pad.getBoundingClientRect());
    });
    pad.addEventListener('pointerup', stop);
    pad.addEventListener('pointercancel', stop);
    pad.addEventListener('pointerleave', stop);
  }

  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    root.classList.add('touch');
  }

  reset();
  render();
}

/* ---------- 容器：先挂第一关，结算后接第二关 ---------- */
function mount(root, ctx) {
  stage1(root, function (score, left) {
    var carry = (typeof score === 'number' && score >= 0) ? score : 100;
    var leftN = (typeof left === 'number' && left > 0) ? left : 20000;
    stage2(root, function () {}, carry, true, leftN);
  });
}

global.LEVEL = { mount: mount };

/* 独立运行时自己挂上去 */
var stage = document.getElementById('stage');
if (stage && !stage.dataset.mounted) {
  stage.dataset.mounted = '1';
  mount(stage, null);
}
})(window);

/* 想加「返回地图」按钮：window.parent.postMessage({ type: 'cz:exit' }, '*') */
