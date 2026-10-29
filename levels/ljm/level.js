/* ============================================================
   四渡赤水 · 连线 —— levels/ljm/level.js

   玩法：左侧事件 ↔ 右侧结果，全部连对过关。

   接入约定（见 docs/level-api.md）：
     · index.html 被主程序装进 1280×720 的 iframe
     · 舞台尺寸固定，不写响应式、不读 window.innerWidth
     · 通关必须 postMessage({ type: 'cz:done' })，否则地图那边一直挂着

   直接双击 index.html 也能单独玩，不需要服务器、不需要构建。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 题库 ---------- */
  const pairs = [
    { id: 1, event: '一渡赤水：土城、元厚西渡', place: '川南扎西' },
    { id: 2, event: '二渡赤水：太平渡、二郎滩东渡', place: '重占遵义' },
    { id: 3, event: '三渡赤水：茅台镇西渡', place: '诱敌至川南' },
    { id: 4, event: '四渡赤水：二郎滩、太平渡东渡', place: '南下乌江、佯攻贵阳' }
  ];

  /* 画布按舞台实际尺寸写死，父级缩放只影响显示，不影响坐标 */
  const BOARD_W = 1120;
  const BOARD_H = 640;

  const board = document.getElementById('board');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const leftCol = document.getElementById('left');
  const rightCol = document.getElementById('right');
  const result = document.getElementById('result');

  let selectedLeft = null;
  let links = [];          /* 已画出的线：{ left, right, color } */
  let matched = 0;         /* 连对的数量，不能拿 links.length 判断（含错误线） */
  let revealed = false;    /* 是否已经「查看答案」 */
  let finished = false;
  let round = 0;           /* 局数，用来作废旧的回调 */
  let winTimer = 0;

  /* ---------- 工具 ---------- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function sameId(el, id) {
    return el.dataset.id === id;
  }

  /* ---------- 开局 / 重开 ---------- */
  function resetGame() {
    round += 1;
    clearTimeout(winTimer);
    winTimer = 0;

    leftCol.innerHTML = '';
    rightCol.innerHTML = '';
    links = [];
    matched = 0;
    selectedLeft = null;
    revealed = false;
    finished = false;
    result.textContent = '';
    board.classList.remove('is-done');

    shuffle(pairs).forEach(function (p) {
      leftCol.appendChild(makeCard(p, 'left', p.event));
    });
    shuffle(pairs).forEach(function (p) {
      rightCol.appendChild(makeCard(p, 'right', p.place));
    });

    drawLines();
  }

  function makeCard(pair, side, text) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.id = String(pair.id);
    el.dataset.side = side;
    el.textContent = text;
    el.addEventListener('click', function () {
      if (side === 'left') selectLeft(el);
      else selectRight(el);
    });
    return el;
  }

  /* ---------- 交互 ---------- */
  function selectLeft(el) {
    if (finished || revealed) return;
    if (el.classList.contains('correct')) return;

    Array.prototype.forEach.call(
      leftCol.querySelectorAll('.card'),
      function (c) { c.classList.remove('selected'); }
    );

    el.classList.add('selected');
    selectedLeft = el;
  }

  function selectRight(el) {
    if (finished || revealed || !selectedLeft) return;
    if (el.classList.contains('correct')) return;

    const left = selectedLeft;
    left.classList.remove('selected');
    selectedLeft = null;

    if (sameId(left, el.dataset.id)) {
      /* 连对 */
      left.classList.add('correct');
      el.classList.add('correct');
      links.push({ left: left, right: el, color: '#2c6e49' });
      matched += 1;
      drawLines();
      checkWin();
      return;
    }

    /* 连错：画一条红线，700ms 后收掉，不影响左侧重新选 */
    left.classList.add('wrong');
    el.classList.add('wrong');
    links.push({ left: left, right: el, color: '#a33a2c' });
    drawLines();

    const myRound = round;
    setTimeout(function () {
      if (myRound !== round) return;
      links = links.filter(function (l) {
        return !(l.left === left && l.right === el);
      });
      left.classList.remove('wrong');
      el.classList.remove('wrong');
      drawLines();
    }, 700);
  }

  /* ---------- 画线 ----------
     用 getBoundingClientRect 换算回 1120×640 的本地坐标，
     这样无论父级怎么缩放，线都会贴在卡片边缘。 */
  function drawLines() {
    const br = board.getBoundingClientRect();
    const scale = br.width ? br.width / BOARD_W : 1;

    ctx.clearRect(0, 0, BOARD_W, BOARD_H);

    links.forEach(function (link) {
      const r1 = link.left.getBoundingClientRect();
      const r2 = link.right.getBoundingClientRect();

      const x1 = (r1.right - br.left) / scale;
      const y1 = (r1.top + r1.height / 2 - br.top) / scale;
      const x2 = (r2.left - br.left) / scale;
      const y2 = (r2.top + r2.height / 2 - br.top) / scale;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = link.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    });
  }

  /* ---------- 判定 ---------- */
  function checkWin() {
    if (matched !== pairs.length) return;

    finished = true;
    board.classList.add('is-done');
    result.textContent = '四条连线全部正确 —— 过关！';

    /* 留一点时间让玩家看到绿色连线，再通知主程序 */
    winTimer = setTimeout(finish, 900);
  }

  function finish() {
    winTimer = 0;

    /* ★ 最重要的一行 ★
       嵌在游戏里时，通关必须通知主程序，否则地图那边不知道，关卡会一直挂着。 */
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'cz:done' }, '*');
        return;
      }
    } catch (e) {}

    /* 单独双击打开（没有主程序）时，自己收个尾 */
    result.textContent = '恭喜过关！四渡赤水路线已连成，点「重新开始」可以再玩一次。';
  }

  /* ---------- 查看答案：只演示，不算通关 ---------- */
  function showAnswer() {
    if (finished || revealed) return;

    revealed = true;
    const leftCards = Array.prototype.slice.call(leftCol.children);
    const rightCards = Array.prototype.slice.call(rightCol.children);

    leftCards.forEach(function (lc) {
      const rc = rightCards.find(function (c) { return sameId(c, lc.dataset.id); });
      if (!rc) return;
      lc.classList.remove('selected');
      lc.classList.add('correct');
      rc.classList.add('correct');
      links.push({ left: lc, right: rc, color: '#2c6e49' });
    });

    selectedLeft = null;
    drawLines();
    result.textContent = '已显示正确连线，点「重新开始」再挑战一次。';
  }

  /* ---------- 启动 ---------- */
  document.getElementById('resetBtn').addEventListener('click', resetGame);
  document.getElementById('answerBtn').addEventListener('click', showAnswer);

  /* 单独双击打开时窗口尺寸会变，线要跟着重画；
     嵌在 iframe 里舞台固定，不会触发。 */
  window.addEventListener('resize', drawLines);

  resetGame();
})();
