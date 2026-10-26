/* ============================================================
   遵义会议 · 会场记录

   玩法：你是会议记录员。会议按议程一项项推进，每一项要在几个
   说法里挑出与史实相符的那一条记下来；记错会留下涂改。
   六项议程走完，会议纪要归档，通关。

   接入方式（见 docs/level-api.md）：
     - 入口 levels/zsb/index.html
     - 通关必须 postMessage({ type: 'cz:done' })
     - 舞台固定 1280×720，不写响应式
     - 纯 ES5、无模块、无外链、无 fetch
   ============================================================ */
(function (global) {
  'use strict';

  var LETTERS = ['甲', '乙', '丙'];

  /* 六项议程。ok: true 的那条才是会议记录该写下的；
     recap 是收尾时「会议纪要」那一行。 */
  var STEPS = [
    {
      no: '会前',
      day: '一九三四年十二月 — 一九三五年一月',
      prompt: '湘江一战，中央红军从八万六千人减到三万余人。进贵州后一路都在争：仗该怎么打？',
      options: [
        {
          t: '先开个会，把第五次反“围剿”以来的军事路线摊开谈。',
          ok: true,
          why: '从通道到黎平、猴场，争论一路没停；到遵义，终于坐下来开政治局扩大会议。',
          recap: '会前争论不休，到遵义才坐下来总结'
        },
        {
          t: '按原计划北上，与红二、六军团会合。',
          ok: false,
          why: '原定路线正撞进敌军重兵，黎平会议已经改了方向。'
        },
        {
          t: '先等共产国际回电，再定下一步。',
          ok: false,
          why: '电台联系早已中断，等不来指示。'
        }
      ]
    },
    {
      no: '第一项',
      day: '一月十五日',
      prompt: '博古作关于第五次反“围剿”的总结报告，把失利归因于敌强我弱。这一句怎么记？',
      options: [
        {
          t: '照原话记：责任在客观条件，军事指挥没有问题。',
          ok: false,
          why: '这是报告的口径。与会者多数不同意，分歧恰恰出在这里。'
        },
        {
          t: '记下分歧：多数同志认为，主因是军事指挥上的错误。',
          ok: true,
          why: '记下了。会议从这里转向对“左”倾军事路线的批评。',
          recap: '主报告强调客观困难，多数同志不同意'
        }
      ]
    },
    {
      no: '第二项',
      day: '一月十五日',
      prompt: '周恩来作副报告，主动承担责任。随后要有人系统批评军事路线，谁来讲？',
      options: [
        {
          t: '张闻天（洛甫）作反报告，毛泽东随后作长篇发言。',
          ok: true,
          why: '两人的发言把军事指挥上的错误摆到了桌面上。',
          recap: '周恩来主动担责，张闻天反报告，毛泽东长篇发言'
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
      day: '一月十五日',
      prompt: '毛泽东讲完，会场沉默了一会儿。接下来谁先开口？',
      options: [
        {
          t: '王稼祥先表态支持，朱德、陈云、刘少奇等随后发言。',
          ok: true,
          why: '王稼祥的明确支持，后来被毛泽东称作“关键的一票”。',
          recap: '王稼祥首先表态，朱德、陈云等相继支持'
        },
        {
          t: '无人表态，会议草草收场。',
          ok: false,
          why: '会场不是冷的——支持的声音很快就起来了。'
        },
        {
          t: '李德起立反驳，会议转去争论战术细节。',
          ok: false,
          why: '李德为自己的方案辩解，但没能扭转会场。'
        }
      ]
    },
    {
      no: '第四项',
      day: '一月十六日',
      prompt: '会议进入组织问题。最关键的一条是——',
      options: [
        {
          t: '增选毛泽东为政治局常委，取消“三人团”，仍由朱德、周恩来指挥军事。',
          ok: true,
          why: '这一条改变了此后红军的行军方式。',
          recap: '增选毛泽东为政治局常委，取消“三人团”'
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
      no: '第五项',
      day: '一月十七日',
      prompt: '会议闭幕前还有两件收尾的事：决议由谁起草，会后由谁负总责？',
      options: [
        {
          t: '委托张闻天起草决议；会后常委分工，由张闻天代替博古负总责。',
          ok: true,
          why: '决议随后经政治局会议通过；中央的日常工作改由张闻天主持。',
          recap: '张闻天起草决议，会后代替博古负总责'
        },
        {
          t: '由博古起草，仍由他负总责。',
          ok: false,
          why: '原有结论正是这场会议要纠正的东西。'
        },
        {
          t: '决议暂缓，等共产国际批准。',
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
      '    <p class="roster-cap">出席（部分）</p>',
      '    <ul class="roster">',
      '      <li><b>博古</b><span>临时中央总负责人</span></li>',
      '      <li><b>周恩来</b><span>中革军委副主席</span></li>',
      '      <li><b>张闻天</b><span>政治局委员</span></li>',
      '      <li><b>毛泽东</b><span>政治局委员</span></li>',
      '      <li><b>朱德</b><span>红军总司令</span></li>',
      '      <li><b>王稼祥</b><span>政治局候补委员</span></li>',
      '    </ul>',
      '    <div class="seal" aria-hidden="true"><span>遵</span><span>义</span></div>',
      '  </aside>',
      '  <section class="desk">',
      '    <header class="desk-head">',
      '      <span class="step-no js-step">会前</span>',
      '      <span class="day js-day"></span>',
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
    var state = { step: 0, mistakes: 0, answered: false, finished: false, records: [] };
    var ui = {};

    root.innerHTML = shell();

    ui.step = root.querySelector('.js-step');
    ui.day = root.querySelector('.js-day');
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
    global.document.addEventListener('keydown', onKey);

    renderStep();

    /* ---------- 渲染 ---------- */

    function renderStep() {
      var step = STEPS[state.step];
      var last = state.step === STEPS.length - 1;

      state.answered = false;
      ui.step.textContent = step.no;
      ui.day.textContent = step.day;
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
      state.records[state.step] = opt.recap;
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

    function onKey(e) {
      if (state.finished) return;
      var k = e.key;
      if (k === 'Enter' && !ui.next.hidden) {
        e.preventDefault();
        advance();
        return;
      }
      if (k < '1' || k > '3') return;
      var idx = Number(k) - 1;
      var btns = ui.options.querySelectorAll('.opt');
      if (btns[idx] && !btns[idx].disabled) {
        e.preventDefault();
        btns[idx].click();
      }
    }

    /* ---------- 收尾 ---------- */

    function showVerdict() {
      var grade;
      if (state.mistakes === 0) {
        grade = '一字未改——这三天，你记得很稳。';
      } else if (state.mistakes <= 2) {
        grade = '涂改 ' + state.mistakes + ' 处，关键的地方都记对了。';
      } else {
        grade = '涂改 ' + state.mistakes + ' 处——好在纪要还是立住了。';
      }

      var html = ['<div class="verdict">',
        '<p class="verdict-eyebrow">一九三五年一月十七日 · 会议闭幕</p>',
        '<h2 class="verdict-title">会议纪要</h2>',
        '<ol class="recap">'];
      for (var i = 0; i < STEPS.length; i++) {
        html.push('<li><span class="rec-no">' + STEPS[i].no + '</span>'
          + '<span class="rec-text">' + (state.records[i] || '') + '</span></li>');
      }
      html.push('</ol>');
      html.push('<p class="verdict-note js-grade"></p>');
      html.push('<button class="next js-finish" type="button">结束记录，继续行军</button>');
      html.push('</div>');

      ui.sheet.innerHTML = html.join('');
      ui.sheet.querySelector('.js-grade').textContent = grade + '　决议：' + VERDICT.join('；') + '。';
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
