/* ============================================================
 * levels/jxf/level.js —— 关卡：翻越夹金山（1935.06）
 *
 * 接入方式见 docs/level-api.md：
 *   - 主程序用 iframe 加载本文件夹的 index.html
 *   - 舞台固定 1280×720，位置按像素摆，不写响应式
 *   - 通关 postMessage({ type: 'cz:done' })
 *   - 主动退出 postMessage({ type: 'cz:exit' })
 *
 * 史实：1935 年 6 月，中央红军翻越夹金山。
 * 山上不能停、不能坐，坐下去就起不来；缺棉衣、缺氧、雪盲。
 * ============================================================ */
(function (global) {
  'use strict';

  /* ==========================================================
   * ① 内容配置：换文案只改这一段
   * ========================================================== */

  var MAX = 100;

  var TITLE = '翻越夹金山';
  var LEAD = '1935 年 6 月，夹金山。海拔四千多米，终年积雪。队伍大多是南方人，身上还是单衣。';

  var ROUNDS = [
    {
      q: '山下老乡拦住队伍：上山不能停、不能坐，坐下去就再也站不起来。他还说，最好每人先喝一口辣椒水。',
      a: {
        label: '听老乡的，停下分辣椒水再上山',
        d: { str: 4, sup: -8, bel: 8 },
        text: '多花了半个时辰，可每人的手都缓过来了。'
      },
      b: {
        label: '赶时间，边走边喝',
        d: { str: -5, sup: -2, bel: -10 },
        text: '辣椒水洒了一半，有人冻得握不住枪。'
      }
    },
    {
      q: '山腰有一段栈道，木板结着冰，下面就是几十丈的沟。走栈道能省一个时辰，绕山脊要多走半天。',
      a: {
        label: '走结冰的栈道，抓紧铁索',
        d: { str: -12, sup: -2, bel: 8 },
        text: '有人的绑腿磨破了，手却没松开前面那根腰带。'
      },
      b: {
        label: '绕山脊，多走半天稳当路',
        d: { str: -6, sup: -8, bel: 0 },
        text: '路是绕远了，可没有一个人往沟底下看。'
      }
    },
    {
      q: '雪面反光刺得人睁不开眼。前面的人开始看不清路，一步一滑。',
      a: {
        label: '用雪搓眼睛，硬撑着走',
        d: { str: -6, sup: 0, bel: 4 },
        text: '眼睛刺痛了一夜，第二天还是红得吓人。'
      },
      b: {
        label: '轮流闭眼，用绑腿布蒙住',
        d: { str: -4, sup: -6, bel: 10 },
        text: '队伍慢下来，却没有一个人走错方向。'
      }
    },
    {
      q: '半山腰，风雪突然压下来，能见度不到三步。前面有人喊：找个背风的地方坐一坐吧。',
      a: {
        label: '不许坐，原地踏步等风小',
        d: { str: -8, sup: -2, bel: 10 },
        text: '骂声、喘声、跺脚声，没有一个人坐下。'
      },
      b: {
        label: '靠岩壁坐下，歇十分钟',
        d: { str: -14, sup: -4, bel: -18 },
        text: '再起身时，有三个人的名字，队伍里再也没有喊到。'
      }
    },
    {
      q: '一名战士缺氧倒在雪窝里。担架要四个人抬，可路只剩一人宽。',
      a: {
        label: '轮流抬，一个都不能少',
        d: { str: -12, sup: -5, bel: 14 },
        text: '四个人换成八个人，轮到谁都不推。'
      },
      b: {
        label: '留两个人在后面慢慢走，主力先上山',
        d: { str: -3, sup: -2, bel: -16 },
        text: '你回头喊了一句「跟上」，风雪把话堵了回来。'
      }
    },
    {
      q: '向导是山下借来的，走到雪线就要回去。再往上，没人认得路。',
      a: {
        label: '把最后一点银元给他，请他再带一程',
        d: { str: 0, sup: -12, bel: 6 },
        text: '他把银元揣进怀里，又往前带了半里地。'
      },
      b: {
        label: '不强留，自己照着山脊摸上去',
        d: { str: -10, sup: 0, bel: -8 },
        text: '向导下山了。队伍在雪里站了很久，才有人抬脚。'
      }
    },
    {
      q: '最后一段风口，每人只剩半块干粮。',
      a: {
        label: '把干粮集中给扛旗的',
        d: { str: -6, sup: -12, bel: 16 },
        text: '旗子一直走在最前面，没有人掉队。'
      },
      b: {
        label: '各吃各的，自己扛过去',
        d: { str: 8, sup: -14, bel: -10 },
        text: '你走得更快了，身后的脚步声却稀了。'
      }
    },
    {
      q: '快到垭口，旗手倒在雪里，旗子被风卷住了。山脊就在前面三百步。',
      a: {
        label: '接过旗，走在最前面',
        d: { str: -8, sup: -4, bel: 16 },
        text: '旗子一直在飘，后面的人就跟着那一点红走。'
      },
      b: {
        label: '把旗裹进怀里，先带人翻过去',
        d: { str: -4, sup: -6, bel: -12 },
        text: '人是都过去了，只是回头时，看不到自己那面旗。'
      }
    }
  ];

  var START = { str: 80, sup: 76, bel: 60 };

  var LABEL = { str: '体力', sup: '物资', bel: '信念' };
  var KEYS = ['str', 'sup', 'bel'];

  var DEAD = {
    str: '体力耗尽，队伍在雪线上走不动了。',
    sup: '物资见底，队伍断了粮，也断了辣椒水。',
    bel: '信念散了。有人开始往回走，队伍在雪里停了下来。'
  };

  /* 收尾文案：按信念高低给三种结局 */
  var CLOSE = [
    { min: 70, text: '旗子上了垭口。雪没到膝盖，可队伍里没有一个人被落在山上。' },
    { min: 40, text: '你们翻过了垭口。回头看不见来路，只剩一串脚印，和几个空出来的位置。' },
    { min: 0, text: '垭口是过去了。只是从那以后，队伍里少了很多声音。' }
  ];

  /* 每个节点一张插画 + 海拔，用于左侧场景和爬坡过场 */
  var SCENES = [
    { img: 'assets/node-01-pepper.webp',     cap: '山下 · 老乡的规矩', alt: 2100 },
    { img: 'assets/node-02-plank.webp',      cap: '结冰的栈道',       alt: 2600 },
    { img: 'assets/node-03-snowblind.webp',  cap: '雪盲',             alt: 3100 },
    { img: 'assets/node-04-storm.webp',      cap: '风雪压下来',       alt: 3500 },
    { img: 'assets/node-05-stretcher.webp',  cap: '担架上的伤员',     alt: 3900 },
    { img: 'assets/node-06-guide.webp',      cap: '向导要回头',       alt: 4200 },
    { img: 'assets/node-07-ration.webp',     cap: '最后的干粮',       alt: 4500 },
    { img: 'assets/node-08-ridge.webp',      cap: '垭口的旗',         alt: 4800 }
  ];

  /* ==========================================================
   * ② 关卡本体
   * ========================================================== */

  function mount(root) {
    var st = { str: START.str, sup: START.sup, bel: START.bel };
    var idx = 0;
    var locked = false;
    var over = false;
    var embedded = false;
    try { embedded = !!(window.parent && window.parent !== window); } catch (e) { embedded = false; }

    root.innerHTML =
      '<div class="jxf">' +
      '  <img class="jxf-bg" alt="">' +
      '  <div class="jxf-scrim" aria-hidden="true"></div>' +
      '  <div class="jxf-snow" aria-hidden="true"></div>' +
      '  <header class="jxf-head">' +
      '    <h1 class="jxf-title"></h1>' +
      '    <p class="jxf-lead"></p>' +
      '  </header>' +
      '  <ul class="jxf-bars">' +
      '    <li class="jxf-bar" data-k="str">' +
      '      <span class="jxf-bar-name">体力</span>' +
      '      <span class="jxf-bar-num"></span>' +
      '      <span class="jxf-bar-track"><span class="jxf-bar-fill"></span></span>' +
      '    </li>' +
      '    <li class="jxf-bar" data-k="sup">' +
      '      <span class="jxf-bar-name">物资</span>' +
      '      <span class="jxf-bar-num"></span>' +
      '      <span class="jxf-bar-track"><span class="jxf-bar-fill"></span></span>' +
      '    </li>' +
      '    <li class="jxf-bar" data-k="bel">' +
      '      <span class="jxf-bar-name">信念</span>' +
      '      <span class="jxf-bar-num"></span>' +
      '      <span class="jxf-bar-track"><span class="jxf-bar-fill"></span></span>' +
      '    </li>' +
      '  </ul>' +
      '  <main class="jxf-main">' +
      '    <p class="jxf-q"></p>' +
      '    <div class="jxf-thoughts">' +
      '      <div class="jxf-man" aria-hidden="true">' +
      '        <svg viewBox="0 0 200 300">' +
      '          <ellipse class="man-shadow" cx="104" cy="291" rx="56" ry="8"/>' +
      '          <path class="man-pack" d="M52 130 q-16 8 -16 30 v58 q0 18 16 20 z"/>' +
      '          <path class="man-body" d="M78 112 q26 -14 54 0 l7 24 v52 q-34 12 -68 0 v-52 z"/>' +
      '          <path class="man-body" d="M80 190 h19 l-3 100 h-17 z"/>' +
      '          <path class="man-body" d="M105 190 h19 l1 100 h-17 z"/>' +
      '          <circle class="man-head" cx="104" cy="78" r="22"/>' +
      '          <path class="man-cap" d="M78 70 q4 -28 26 -28 q22 0 26 28 l17 3 q3 8 -5 9 h-76 q-8 -1 -5 -9 z"/>' +
      '          <path class="man-star" d="M104 60 l3 6 7 1 -5 5 2 7 -7 -4 -7 4 2 -7 -5 -5 7 -1 z"/>' +
      '        </svg>' +
      '      </div>' +
      '      <div class="jxf-bubbles"></div>' +
      '    </div>' +
      '  </main>' +
      '  <p class="jxf-fb"></p>' +
      '  <div class="jxf-chip"><span class="jxf-art-cap"></span></div>' +
      '  <footer class="jxf-foot"><span class="jxf-step"></span></footer>' +
      '  <div class="jxf-total" aria-hidden="true">' +
      '    <span class="jxf-total-fill"></span>' +
      '    <span class="jxf-total-ticks"></span>' +
      '    <span class="jxf-total-label"></span>' +
      '  </div>' +
      '  <div class="jxf-climb" aria-hidden="true">' +
      '    <svg class="jxf-climb-ridges" viewBox="0 0 1280 720" preserveAspectRatio="none">' +
      '      <polygon class="jxf-range-far" points="0,420 180,300 300,360 460,240 620,330 780,250 940,340 1100,260 1280,350 1280,720 0,720"/>' +
      '      <polygon class="jxf-range-mid" points="0,520 200,410 340,470 520,360 700,450 880,380 1060,470 1280,400 1280,720 0,720"/>' +
      '      <polygon class="jxf-range-near" points="0,640 240,540 420,600 640,500 860,590 1080,520 1280,600 1280,720 0,720"/>' +
      '      <path class="jxf-climb-path" d="M -40,660 L 180,570 L 150,480 L 380,410 L 350,330 L 620,260 L 600,180 L 860,120 L 900,70"/>' +
      '    </svg>' +
      '    <div class="jxf-storm" aria-hidden="true"></div>' +
      '    <div class="jxf-prints" aria-hidden="true"></div>' +
      '    <div class="jxf-climb-runner"><span class="jxf-climb-flag"></span></div>' +
      '    <div class="jxf-climb-info">' +
      '      <b class="jxf-climb-alt"></b>' +
      '      <span class="jxf-climb-cap"></span>' +
      '      <span class="jxf-climb-meta"></span>' +
      '      <span class="jxf-climb-progress"><i class="jxf-climb-bar-fill"></i></span>' +
      '      <span class="jxf-climb-step"></span>' +
      '    </div>' +
      '    <div class="jxf-climb-veil" aria-hidden="true"></div>' +
      '  </div>' +
      '</div>';

    var elRoot = root.querySelector('.jxf');
    var elTitle = root.querySelector('.jxf-title');
    var elLead = root.querySelector('.jxf-lead');
    var elQ = root.querySelector('.jxf-q');
    var elChoices = root.querySelector('.jxf-bubbles');
    var elFb = root.querySelector('.jxf-fb');
    var elStep = root.querySelector('.jxf-step');
    var elMain = root.querySelector('.jxf-main');
    var elArt = root.querySelector('.jxf-bg');
    var elArtCap = root.querySelector('.jxf-art-cap');
    var elClimb = root.querySelector('.jxf-climb');
    var elClimbAlt = root.querySelector('.jxf-climb-alt');
    var elClimbCap = root.querySelector('.jxf-climb-cap');
    var elClimbMeta = root.querySelector('.jxf-climb-meta');
    var elStorm = root.querySelector('.jxf-storm');
    var elPrints = root.querySelector('.jxf-prints');
    var elClimbStep = root.querySelector('.jxf-climb-step');
    var elTotalFill = root.querySelector('.jxf-total-fill');
    var elTotalLabel = root.querySelector('.jxf-total-label');

    elTitle.textContent = TITLE;
    elLead.textContent = LEAD;

    /* ---------- 工具 ---------- */

    function clamp(v) {
      if (v < 0) return 0;
      if (v > MAX) return MAX;
      return v;
    }

    /* 重新触发一段 CSS 动画 */
    function replay(node, cls) {
      node.classList.remove(cls);
      void node.offsetWidth;
      node.classList.add(cls);
    }

    /* 在资源条上飘出一个 +N / -N */
    function spawnFloat(li, v) {
      var f = document.createElement('span');
      f.className = 'jxf-float ' + (v < 0 ? 'is-neg' : 'is-pos');
      f.textContent = (v > 0 ? '+' : '') + v;
      li.appendChild(f);
      setTimeout(function () {
        if (f.parentNode) f.parentNode.removeChild(f);
      }, 1000);
    }

    function paintBars(delta) {
      for (var i = 0; i < KEYS.length; i++) {
        var k = KEYS[i];
        var li = root.querySelector('.jxf-bar[data-k="' + k + '"]');
        if (!li) continue;
        var v = st[k];
        li.querySelector('.jxf-bar-fill').style.width = (v * 100 / MAX) + '%';
        li.querySelector('.jxf-bar-num').textContent = v;
        li.setAttribute('data-low', v <= 20 ? '1' : '0');

        if (delta && delta[k]) {
          var cls = delta[k] < 0 ? 'is-down' : 'is-up';
          replay(li, cls);
          spawnFloat(li, delta[k]);
          (function (node, c) {
            setTimeout(function () { node.classList.remove(c); }, 620);
          })(li, cls);
        }
      }
    }

    /* 代价很重时，整屏红闪一下 */
    function hitFlash(delta) {
      var worst = 0;
      for (var i = 0; i < KEYS.length; i++) {
        if (delta[KEYS[i]] < worst) worst = delta[KEYS[i]];
      }
      if (worst > -10) return;

      replay(elRoot, 'is-hit');
      setTimeout(function () { elRoot.classList.remove('is-hit'); }, 460);
    }

    function effText(d) {
      var parts = [];
      for (var i = 0; i < KEYS.length; i++) {
        var k = KEYS[i];
        var v = d[k];
        if (!v) continue;
        parts.push(LABEL[k] + (v > 0 ? '+' : '') + v);
      }
      return parts.join('  ');
    }

    function btnHTML(side, opt, order) {
      return '<button class="jxf-bubble" type="button" data-side="' + side + '" style="--i:' + order + '">' +
             '  <span class="jxf-bubble-label">' + opt.label + '</span>' +
             '  <span class="jxf-bubble-eff">' + effText(opt.d) + '</span>' +
             '</button>';
    }

    function clearActions() {
      var old = elMain.querySelector('.jxf-actions');
      if (old) old.parentNode.removeChild(old);
    }

    function renderRound() {
      var r = ROUNDS[idx];
      clearActions();

      elRoot.classList.remove('is-over', 'is-fail');
      elMain.className = 'jxf-main';
      elQ.className = 'jxf-q';
      elQ.textContent = r.q;
      elStep.textContent = '第 ' + (idx + 1) + ' / ' + ROUNDS.length + ' 个抉择';
      elChoices.className = 'jxf-bubbles';
      elChoices.style.display = '';
      elChoices.innerHTML = btnHTML('a', r.a, 0) + btnHTML('b', r.b, 1);
      elFb.className = 'jxf-fb';
      elFb.textContent = '';

      setTotal(idx + 1, 0, '第 ' + (idx + 1) + ' / ' + ROUNDS.length + ' 段');

      /* 左侧换成本节点的插画 */
      var sc = SCENES[idx] || SCENES[SCENES.length - 1];
      elArt.src = sc.img;
      elArt.alt = sc.cap;
      elArtCap.textContent = sc.cap;

      /* 题面和两个选项依次浮上来 */
      replay(elMain, 'anim-in');
      locked = false;
    }

    /* 过场里飘的风线和踩出来的脚印（只建一次） */
    function buildClimbFx() {
      var i;
      for (i = 0; i < 16; i++) {
        var s = document.createElement('i');
        s.className = 'jxf-streak';
        s.style.top = (6 + (i * 37) % 88) + '%';
        s.style.width = (46 + (i * 29) % 110) + 'px';
        s.style.animationDuration = (0.75 + ((i * 13) % 9) / 10).toFixed(2) + 's';
        s.style.animationDelay = '-' + (((i * 17) % 23) / 10).toFixed(1) + 's';
        s.style.opacity = (0.3 + ((i * 7) % 6) / 10).toFixed(1);
        elStorm.appendChild(s);
      }

      for (i = 0; i < 10; i++) {
        var p = document.createElement('i');
        p.className = 'jxf-print';
        p.style.setProperty('--d', (4 + i * 9.4).toFixed(1) + '%');
        p.style.setProperty('--t', (i * 130) + 'ms');
        elPrints.appendChild(p);
      }
    }

    /* 总进度条：done 为已完成的节点数，ratio 为当前这一段走了多少（0~1） */
    function setTotal(done, ratio, label) {
      var pct = Math.max(0, Math.min(1, (done + (ratio || 0)) / ROUNDS.length));
      elTotalFill.style.width = (pct * 100).toFixed(2) + '%';
      elTotalLabel.textContent = label;
    }

    /* 海拔越高越冷 */
    function tempOf(alt) {
      return Math.round(-10 - (alt - 2100) / 300);
    }

    /* 选完之后：插画先换到下一节点，再播一段「向上爬」的过场 */
    function climb(next) {
      var sc = SCENES[idx] || SCENES[SCENES.length - 1];
      var from = idx > 0 && SCENES[idx - 1] ? SCENES[idx - 1].alt : sc.alt - 320;
      var total = 2200;

      elArt.src = sc.img;
      elArt.alt = sc.cap;
      elArtCap.textContent = sc.cap;

      elClimbCap.textContent = sc.cap;
      elClimbMeta.textContent = tempOf(sc.alt) + '℃ · 风雪迎面 · 每走十步歇一次';
      elClimbStep.textContent = '第 ' + Math.min(idx + 1, ROUNDS.length) + ' / ' + ROUNDS.length + ' 段';
      elClimbAlt.textContent = '海拔 ' + from + ' m';

      elClimb.classList.add('is-on');
      replay(elClimb, 'is-run');

      /* 海拔一路往上跳，越到后面越慢（体力在掉） */
      var t = 0;
      var tick = setInterval(function () {
        t += 55;
        var k = Math.min(1, t / total);
        var eased = k * k * (3 - 2 * k);
        elClimbAlt.textContent = '海拔 ' + Math.round(from + (sc.alt - from) * eased) + ' m';
        setTotal(idx, eased, '第 ' + Math.min(idx + 1, ROUNDS.length) + ' / ' + ROUNDS.length + ' 段');
        if (k >= 1) clearInterval(tick);
      }, 55);

      setTimeout(function () {
        clearInterval(tick);
        elClimb.classList.remove('is-on', 'is-run');
        next();
      }, total);
    }

    function firstDead() {
      for (var i = 0; i < KEYS.length; i++) {
        if (st[KEYS[i]] <= 0) return KEYS[i];
      }
      return null;
    }

    function closeText() {
      for (var i = 0; i < CLOSE.length; i++) {
        if (st.bel >= CLOSE[i].min) return CLOSE[i].text;
      }
      return CLOSE[CLOSE.length - 1].text;
    }

    /* ---------- 跳转 ---------- */

    /* 回到主界面（选关面板）
       - 嵌在主程序里：发消息让主程序关掉 iframe、回选关面板
         · markDone=true  → cz:done，记为通关
         · markDone=false → cz:exit，不算通关
       - 单独双击打开：没有主程序，直接跳回游戏主界面 */
    function backToMain(markDone) {
      try {
        if (embedded) {
          window.parent.postMessage({ type: markDone ? 'cz:done' : 'cz:exit' }, '*');
          return;
        }
      } catch (e) { /* 跨域等情况忽略，走下面的兜底 */ }

      try { window.location.href = '../../map.html'; } catch (e) { /* 忽略 */ }
    }

    function makeBtn(text, cls, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'jxf-action ' + cls;
      b.textContent = text;
      b.addEventListener('click', fn);
      return b;
    }

    /* ---------- 结束 ---------- */

    function showActions(buttons) {
      var bar = document.createElement('div');
      bar.className = 'jxf-actions';
      for (var i = 0; i < buttons.length; i++) bar.appendChild(buttons[i]);
      elMain.appendChild(bar);
      replay(bar, 'anim-in');
    }

    function finish() {
      if (over) return;
      over = true;

      var score = st.str + st.sup + st.bel;

      elRoot.classList.add('is-over');
      elMain.className = 'jxf-main is-ending';
      elChoices.style.display = 'none';
      elQ.textContent = closeText();
      elFb.className = 'jxf-fb is-show';
      elFb.textContent = '体力 ' + st.str + '　物资 ' + st.sup + '　信念 ' + st.bel +
                         '　（合计 ' + score + '）';
      elStep.textContent = '翻过垭口';
      setTotal(ROUNDS.length, 0, '已过垭口');

      var buttons = [];

      /* ★ 通关跳转按钮：回关卡选择界面 ★ */
      buttons.push(makeBtn('完成 · 返回选关', 'is-primary', function () {
        backToMain(true);
      }));

      buttons.push(makeBtn('再来一次', 'is-ghost', restart));

      showActions(buttons);
      replay(elMain, 'anim-in');
    }

    function fail(key) {
      if (over) return;
      over = true;

      elRoot.classList.add('is-fail');
      elMain.className = 'jxf-main is-ending is-failed';
      elChoices.style.display = 'none';
      elQ.textContent = DEAD[key];
      elFb.className = 'jxf-fb is-show';
      elFb.textContent = '队伍没能翻过夹金山';
      elStep.textContent = '行军中断';

      var buttons = [];
      buttons.push(makeBtn('再来一次', 'is-primary', restart));
      buttons.push(makeBtn('返回选关', 'is-ghost', function () { backToMain(false); }));

      showActions(buttons);
      replay(elMain, 'anim-in');
    }

    function restart() {
      st.str = START.str;
      st.sup = START.sup;
      st.bel = START.bel;
      idx = 0;
      over = false;
      locked = false;
      paintBars();
      renderRound();
    }

    /* ---------- 交互 ---------- */

    function choose(side) {
      if (locked || over) return;
      locked = true;

      var opt = ROUNDS[idx][side];

      st.str = clamp(st.str + opt.d.str);
      st.sup = clamp(st.sup + opt.d.sup);
      st.bel = clamp(st.bel + opt.d.bel);

      elFb.className = 'jxf-fb is-show';
      elFb.textContent = opt.text;
      replay(elFb, 'anim-in');
      paintBars(opt.d);
      hitFlash(opt.d);

      /* 选中的那个按钮亮一下，另一个暗下去 */
      var btns = elChoices.querySelectorAll('.jxf-bubble');
      for (var i = 0; i < btns.length; i++) {
        var on = btns[i].getAttribute('data-side') === side;
        btns[i].classList.add(on ? 'is-picked' : 'is-dim');
        btns[i].disabled = true;
      }

      /* 停留一下，再把题面和选项整体收走 */
      setTimeout(function () {
        elQ.classList.add('is-out');
        elChoices.classList.add('is-out');
      }, 520);

      var dead = firstDead();
      if (dead) {
        setTimeout(function () { fail(dead); }, 900);
        return;
      }

      idx = idx + 1;
      if (idx >= ROUNDS.length) {
        setTimeout(function () { climb(finish); }, 900);
        return;
      }
      setTimeout(function () { climb(renderRound); }, 900);
    }

    elChoices.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.jxf-bubble') : null;
      if (!btn) return;
      choose(btn.getAttribute('data-side'));
    });

    /* ---------- 启动 ---------- */
    buildClimbFx();
    paintBars();
    renderRound();
  }

  global.LEVEL = { mount: mount };

  /* 独立运行时自己挂上去（双击 index.html 也能玩） */
  var stage = document.getElementById('stage');
  if (stage && !stage.dataset.mounted) {
    stage.dataset.mounted = '1';
    mount(stage, null);
  }
})(window);
