/* ============================================================
 * levels/jxf/level.js —— 关卡：翻越夹金山（1935.06）
 *
 * 接入方式见 docs/level-api.md：
 *   - 主程序用 iframe 加载本文件夹的 index.html
 *   - 舞台固定 1280×720，位置按像素摆，不写响应式
 *   - 通关必须 postMessage({ type: 'cz:done' })
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

  var START = { str: 70, sup: 66, bel: 55 };

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

  /* ==========================================================
   * ② 关卡本体
   * ========================================================== */

  function mount(root, ctx) {
    var st = { str: START.str, sup: START.sup, bel: START.bel };
    var idx = 0;
    var locked = false;
    var over = false;

    root.innerHTML =
      '<div class="jxf">' +
      '  <header class="jxf-head">' +
      '    <h1 class="jxf-title"></h1>' +
      '    <p class="jxf-lead"></p>' +
      '  </header>' +
      '  <ul class="jxf-bars">' +
      '    <li class="jxf-bar" data-k="str">' +
      '      <span class="jxf-bar-name">体力</span>' +
      '      <span class="jxf-bar-track"><span class="jxf-bar-fill"></span></span>' +
      '      <span class="jxf-bar-num"></span>' +
      '    </li>' +
      '    <li class="jxf-bar" data-k="sup">' +
      '      <span class="jxf-bar-name">物资</span>' +
      '      <span class="jxf-bar-track"><span class="jxf-bar-fill"></span></span>' +
      '      <span class="jxf-bar-num"></span>' +
      '    </li>' +
      '    <li class="jxf-bar" data-k="bel">' +
      '      <span class="jxf-bar-name">信念</span>' +
      '      <span class="jxf-bar-track"><span class="jxf-bar-fill"></span></span>' +
      '      <span class="jxf-bar-num"></span>' +
      '    </li>' +
      '  </ul>' +
      '  <main class="jxf-main">' +
      '    <p class="jxf-q"></p>' +
      '    <div class="jxf-choices"></div>' +
      '    <p class="jxf-fb"></p>' +
      '  </main>' +
      '  <footer class="jxf-foot"><span class="jxf-step"></span></footer>' +
      '</div>';

    var elTitle = root.querySelector('.jxf-title');
    var elLead = root.querySelector('.jxf-lead');
    var elQ = root.querySelector('.jxf-q');
    var elChoices = root.querySelector('.jxf-choices');
    var elFb = root.querySelector('.jxf-fb');
    var elStep = root.querySelector('.jxf-step');
    var elMain = root.querySelector('.jxf-main');
    var elRoot = root.querySelector('.jxf');

    elTitle.textContent = TITLE;
    elLead.textContent = LEAD;

    /* ---------- 工具 ---------- */

    function clamp(v) {
      if (v < 0) return 0;
      if (v > MAX) return MAX;
      return v;
    }

    function paintBars() {
      for (var i = 0; i < KEYS.length; i++) {
        var k = KEYS[i];
        var li = root.querySelector('.jxf-bar[data-k="' + k + '"]');
        if (!li) continue;
        var v = st[k];
        li.querySelector('.jxf-bar-fill').style.width = (v * 100 / MAX) + '%';
        li.querySelector('.jxf-bar-num').textContent = v;
        li.setAttribute('data-low', v <= 20 ? '1' : '0');
      }
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

    function btnHTML(side, opt) {
      return '<button class="jxf-btn" type="button" data-side="' + side + '">' +
             '  <span class="jxf-btn-label">' + opt.label + '</span>' +
             '  <span class="jxf-btn-eff">' + effText(opt.d) + '</span>' +
             '</button>';
    }

    function renderRound() {
      var r = ROUNDS[idx];
      elRoot.classList.remove('is-over', 'is-fail');
      elMain.className = 'jxf-main';
      elQ.textContent = r.q;
      elStep.textContent = '第 ' + (idx + 1) + ' / ' + ROUNDS.length + ' 个抉择';
      elChoices.style.display = '';
      elChoices.innerHTML = btnHTML('a', r.a) + btnHTML('b', r.b);
      elFb.textContent = '';
      elFb.className = 'jxf-fb';
      locked = false;
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

    /* ---------- 结束 ---------- */

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

      /* ★ 通关必须通知主程序，否则地图那边一直挂着 ★ */
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'cz:done' }, '*');
          return;
        }
      } catch (e) { /* 跨域时忽略，走下面的独立收尾 */ }

      /* 单独双击打开时自己收尾 */
      elFb.textContent += '　—　通关';
    }

    function fail(key) {
      if (over) return;
      over = true;

      elRoot.classList.add('is-fail');
      elMain.className = 'jxf-main is-ending';
      elChoices.style.display = 'none';
      elQ.textContent = DEAD[key];
      elFb.className = 'jxf-fb is-show';
      elFb.textContent = '队伍没能翻过夹金山';
      elStep.textContent = '行军中断';

      /* 结束画面给一个重来入口，避免卡死在这里 */
      var again = document.createElement('button');
      again.type = 'button';
      again.className = 'jxf-again';
      again.textContent = '再来一次';
      again.addEventListener('click', restart);
      elMain.appendChild(again);
    }

    function restart() {
      st.str = START.str;
      st.sup = START.sup;
      st.bel = START.bel;
      idx = 0;
      over = false;
      locked = false;
      var again = elMain.querySelector('.jxf-again');
      if (again) again.parentNode.removeChild(again);
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
      paintBars();

      var dead = firstDead();
      if (dead) {
        setTimeout(function () { fail(dead); }, 900);
        return;
      }

      idx = idx + 1;
      if (idx >= ROUNDS.length) {
        setTimeout(finish, 900);
        return;
      }
      setTimeout(renderRound, 900);
    }

    elChoices.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.jxf-btn') : null;
      if (!btn) return;
      choose(btn.getAttribute('data-side'));
    });

    /* ---------- 启动 ---------- */

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
