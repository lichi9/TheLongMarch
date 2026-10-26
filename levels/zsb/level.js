/* ============================================================
   遵义会议 · 会场记录

   玩法：你是会议记录员。三天会议按四项议程推进，每一项要在
   几个说法里挑出与史实相符的那一条记下来；记错会留下涂改。

   接入方式（见 docs/level-api.md）：
     - 入口 levels/zsb/index.html
     - 通关必须 postMessage({ type: 'cz:done' })
     - 舞台固定 1280×720，不写响应式
     - 纯 ES5、无模块、无外链、无 fetch
   ============================================================ */
(function (global) {
  'use strict';

  var LETTERS = ['甲', '乙', '丙'];

  /* 四项议程。ok: true 的那条才是会议记录该写下的。 */
  var STEPS = [
    {
      no: '第一项',
      prompt: '博古作第五次反“围剿”的总结报告，把失利归因于敌强我弱。这一句怎么记？',
      options: [
        {
          t: '照原话记：责任在客观条件，军事指挥没有问题。',
          ok: false,
          why: '这是报告的口径。与会者多数不同意，分歧恰恰出在这里。'
        },
        {
          t: '记下分歧：多数同志认为，主因是军事指挥上的错误。',
          ok: true,
          why: '记下了。会议从这里转向对“左”倾军事路线的批评。'
        }
      ]
    },
    {
      no: '第二项',
      prompt: '周恩来作副报告，主动承担责任。接下来要有人系统批评军事路线，谁讲？',
      options: [
        {
          t: '张闻天（洛甫）作反报告，毛泽东随后作长篇发言。',
          ok: true,
          why: '两人的发言把军事指挥上的错误摆到了桌面上。'
        },
        {
          t: '请李德说明堡垒战术的道理。',
          ok: false,
          why: '李德是当事人，他的说明没能说服与会者。'
        },
        {
          t: '请博古再作一次总结。',
          ok: false,
          why: '重复原结论，只会让分歧更清楚。'
        }
      ]
    },
    {
      no: '第三项',
      prompt: '三天会下来，决议里最关键的一条是——',
      options: [
        {
          t: '增选毛泽东为政治局常委，取消“三人团”，仍由朱德、周恩来指挥军事。',
          ok: true,
          why: '这一条改变了此后红军的行军方式。'
        },
        {
          t: '撤销朱德、周恩来的指挥权，另派他人接手。',
          ok: false,
          why: '会上恰恰是肯定了他们的指挥，问题出在路线。'
        },
        {
          t: '维持原有领导，只作口头批评。',
          ok: false,
          why: '只批评不调整，等于什么也没定下来。'
        }
      ]
    },
    {
      no: '第四项',
      prompt: '会议要把总结写成正式决议。谁来起草？',
      options: [
        {
          t: '委托张闻天起草《中共中央关于反对敌人五次“围剿”的总结的决议》。',
          ok: true,
          why: '决议随后经政治局会议通过，成了全党的口径。'
        },
        {
          t: '由博古起草，维持原有结论。',
          ok: false,
          why: '原有结论正是这场会议要纠正的东西。'
        },
        {
          t: '暂不起草，等共产国际的指示。',
          ok: false,
          why: '会议要的是一份自己的总结。'
        }
      ]
    }
  ];

  var VERDICT = [
    '增选毛泽东为政治局常委',
    '取消长征前成立的“三人团”，仍由朱德、周恩来指挥军事',
    '委托张闻天起草会议决议'
  ];

  function shell() {
    return [
      '<div class="hall">',
      '  <aside class="spine">',
      '    <p class="spine-date">1935 · 1 · 15 — 17</p>',
      '    <h1 class="spine-title">遵义会议</h1>',
      '    <p class="spine-sub">贵州 · 遵义老城<br>政治局扩大会议</p>',
      '    <div class="seal" aria-hidden="true"><span>遵</span><span>义</span></div>',
      '  </aside>',
      '  <section class="desk">',
      '    <header class="desk-head">',
      '      <span class="step-no js-step">第一项</span>',
      '      <ol class="dots js-dots"></ol>',
      '      <span class="slips">涂改 <b class="js-err">0</b> 处</span>',
      '    </header>',
      '    <div class="sheet js-sheet">',
      '      <p class="prompt js-prompt"></p>',
      '      <div class="options js-options"></div>',
      '      <p class="note js-note" role="status" aria-live="polite"></p>',
      '      <button class="next js-next" type="button" hidden>下一项</button>',
      '    </div>',
      '  </section>',
      '</div>'
    ].join('');
  }

  function mount(root, ctx) {
    var state = { step: 0, mistakes: 0, answered: false, finished: false };
    var ui = {};

    root.innerHTML = shell();

    ui.step = root.querySelector('.js-step');
    ui.dots = root.querySelector('.js-dots');
    ui.err = root.querySelector('.js-err');
    ui.sheet = root.querySelector('.js-sheet');
    ui.prompt = root.querySelector('.js-prompt');
    ui.options = root.querySelector('.js-options');
    ui.note = root.querySelector('.js-note');
    ui.next = root.querySelector('.js-next');

    for (var i = 0; i < STEPS.length; i++) {
      ui.dots.appendChild(document.createElement('li'));
    }
    ui.dotItems = root.querySelectorAll('.dots li');

    ui.next.addEventListener('click', advance);

    renderStep();

    /* ---------- 渲染 ---------- */

    function renderStep() {
      var step = STEPS[state.step];
      var last = state.step === STEPS.length - 1;

      state.answered = false;
      ui.step.textContent = step.no;
      ui.prompt.textContent = step.prompt;
      ui.note.textContent = '';
      ui.note.className = 'note js-note';
      ui.next.hidden = true;
      ui.next.textContent = last ? '归档' : '下一项';

      ui.options.innerHTML = '';
      for (var k = 0; k < step.options.length; k++) {
        ui.options.appendChild(optionButton(step.options[k], k));
      }

      for (var d = 0; d < ui.dotItems.length; d++) {
        var cls = 'js-dot';
        if (d < state.step) cls += ' is-done';
        if (d === state.step) cls += ' is-now';
        ui.dotItems[d].className = cls;
      }
    }

    function optionButton(opt, index) {
      var btn = document.createElement('button');
      var mark = document.createElement('span');
      var text = document.createElement('span');

      btn.type = 'button';
      btn.className = 'opt';
      mark.className = 'mark';
      mark.textContent = LETTERS[index] || String(index + 1);
      text.className = 'opt-text';
      text.textContent = opt.t;

      btn.appendChild(mark);
      btn.appendChild(text);
      btn.addEventListener('click', function () { choose(opt, btn); });
      return btn;
    }

    /* ---------- 交互 ---------- */

    function choose(opt, btn) {
      if (state.answered || state.finished) return;

      if (!opt.ok) {
        state.mistakes += 1;
        ui.err.textContent = state.mistakes;
        btn.disabled = true;
        btn.className = 'opt is-wrong';
        say(opt.why, 'bad');
        return;
      }

      state.answered = true;
      btn.className = 'opt is-right';
      lockOptions();
      say(opt.why, 'good');
      ui.next.hidden = false;
      ui.next.focus();
    }

    function lockOptions() {
      var btns = ui.options.querySelectorAll('.opt');
      for (var i = 0; i < btns.length; i++) {
        btns[i].disabled = true;
      }
    }

    function say(text, kind) {
      ui.note.textContent = text;
      ui.note.className = 'note js-note is-' + kind;
    }

    function advance() {
      if (!state.answered || state.finished) return;
      state.step += 1;
      if (state.step >= STEPS.length) {
        showVerdict();
        return;
      }
      renderStep();
    }

    /* ---------- 收尾 ---------- */

    function showVerdict() {
      var grade;
      if (state.mistakes === 0) {
        grade = '一字未改——这三天，你记得很稳。';
      } else if (state.mistakes <= 2) {
        grade = '涂改 ' + state.mistakes + ' 处，关键的地方都记对了。';
      } else {
        grade = '涂改 ' + state.mistakes + ' 处——好在决议还是立住了。';
      }

      var html = ['<div class="verdict">',
        '<p class="verdict-eyebrow">一九三五年一月十七日 · 会议闭幕</p>',
        '<h2 class="verdict-title">决议立住了</h2>',
        '<ul class="verdict-list">'];
      for (var i = 0; i < VERDICT.length; i++) {
        html.push('<li>' + VERDICT[i] + '</li>');
      }
      html.push('</ul>');
      html.push('<p class="verdict-note js-grade"></p>');
      html.push('<button class="next js-finish" type="button">结束记录，继续行军</button>');
      html.push('</div>');

      ui.sheet.innerHTML = html.join('');
      ui.sheet.querySelector('.js-grade').textContent = grade;
      ui.sheet.querySelector('.js-finish').addEventListener('click', finish);

      for (var d = 0; d < ui.dotItems.length; d++) {
        ui.dotItems[d].className = 'js-dot is-done';
      }
    }

    function finish() {
      if (state.finished) return;
      state.finished = true;

      /* 嵌在主程序里：只发消息，过场由父页统一播 */
      if (global.parent && global.parent !== global) {
        global.parent.postMessage({ type: 'cz:done' }, '*');
        return;
      }

      /* 单独双击打开：自己收尾 */
      var hall = root.querySelector('.hall');
      if (hall) hall.className = 'hall is-done';
      var btn = ui.sheet.querySelector('.js-finish');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '已归档 · 通关';
      }
    }
  }

  global.LEVEL = { mount: mount };

  /* 独立打开 index.html 时自己挂上去 */
  var stage = document.getElementById('stage');
  if (stage && !stage.dataset.mounted) {
    stage.dataset.mounted = '1';
    mount(stage, null);
  }
})(window);
