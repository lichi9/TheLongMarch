/* ============================================================
 * 过草地 · 推字行军 —— levels/zbw/level.js
 * 结构沿用模板：LEVEL.mount + 独立运行自挂载 + finish() 通关通知。
 * 主程序用 iframe 加载 index.html；直接双击 index.html 也能玩。
 * ============================================================ */
(function (global) {
'use strict';

function mount(root, ctx) {
  var CHARS = ['战', '士', '们', '已', '行', '军', '三', '天', '三', '夜'];
  /* 军令通顺（排对顺序）出发 → 100 分；混乱出发 → 60 分 */
  var GOOD = { score: 100, rate: 0.02, text: '军令通顺，队伍稳步前进，减员放缓。' };
  var BAD  = { score: 60,  rate: 0.05, text: '军令混乱，队伍强行军，又有战士倒下。' };

  /* 开局乱序：随机打乱，直到和正确语序不同 */
  var arr = CHARS.slice();
  do {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  } while (arr.join('') === CHARS.join(''));

  var troops = 20000;
  /* over：结算后锁定操作；done：finish() 只许成功通知一次 */
  var drag = false, dragIdx = -1, sx = 0, sy = 0, charEl = null, over = false, done = false;

  /* ★ 最重要的一行在这里 ★
     嵌在游戏里时，通关必须 postMessage 通知主程序；
     单独双击打开（没有主程序）时，结算页已显示，本地收尾即可。 */
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

  function render() {
    var h = '<div class="bar">剩余人数：' + troops +
            '<span class="tip">拖动文字，把军令排通顺，再出发</span>' +
            '<span class="warn">你的每个决定都关乎着战士们的生死</span>' +
            '<button type="button" class="go">出 发</button></div><div class="row">';
    for (var i = 0; i < arr.length; i++) {
      h += '<span class="cell" data-i="' + i + '">' +
           '<span class="ch" data-i="' + i + '">' + arr[i] + '</span></span>';
    }
    root.innerHTML = h + '</div>';
    /* 所有字都可拖：记住被拖的是哪个位置的字 */
    Array.prototype.forEach.call(root.querySelectorAll('.ch'), function (el) {
      el.addEventListener('mousedown', function (e) {
        if (over) return;
        drag = true; dragIdx = +el.getAttribute('data-i');
        sx = e.clientX; sy = e.clientY; charEl = el;
        el.className = 'ch on';
        e.preventDefault();
      });
    });
    root.querySelector('.go').addEventListener('click', function () {
      if (!over) settle();
    });
  }

  window.addEventListener('mousemove', function (e) {
    if (!drag || !charEl) return;
    charEl.style.transform = 'translate(' + (e.clientX - sx) + 'px,' + (e.clientY - sy) + 'px)';
  });

  window.addEventListener('mouseup', function (e) {
    if (!drag || !charEl) return;
    drag = false;
    charEl.className = 'ch';
    charEl.style.transform = '';
    /* 吸附到最近的格子，和那格的字交换位置（所有格子都是落点） */
    var to = -1, bd = 90;
    Array.prototype.forEach.call(root.querySelectorAll('.cell'), function (c) {
      var r = c.getBoundingClientRect();
      var d = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
      if (d < bd) { bd = d; to = +c.getAttribute('data-i'); }
    });
    if (to < 0 || to === dragIdx) return;
    var tmp = arr[dragIdx]; arr[dragIdx] = arr[to]; arr[to] = tmp;
    render();
  });

  /* 结算：军令通顺 → 100 分；混乱出发 → 60 分 */
  function settle() {
    var ok = arr.join('') === CHARS.join('');
    var slot = ok ? GOOD : BAD;
    var loss = Math.round(troops * slot.rate);
    troops = troops - loss;
    over = true;
    root.innerHTML = '<div class="settle"><p class="big">得分：' + slot.score + '</p>' +
      '<p>剩余人数：' + troops + '（本次减员 ' + loss + ' 人）</p>' +
      '<p class="small">' + slot.text + '</p></div>';
    setTimeout(finish, 1000);
  }

  render();
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
