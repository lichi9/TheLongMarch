/* ============================================================
   四渡赤水 · 连线 —— levels/ljm/level.js  （增强版）

   玩法：左侧事件 ↔ 右侧结果，全部连对过关。
   本版改动：
     · 节点由 4 条增至 5 条
     · 已移除右侧的错误诱导项（干扰卡片），右侧只保留正确结果
     · 移除「查看答案」功能
     · 连线改为带端点的贝塞尔曲线（对=绿色发光，错=红色虚线）
     · 每连对一个节点，下方史实面板即时展开史实与数据

   接入约定（见 docs/level-api.md）：
     · index.html 被主程序装进 1280×720 的 iframe
     · 舞台尺寸固定，不写响应式、不读 window.innerWidth
     · 通关必须 postMessage({ type: 'cz:done' })，否则地图那边一直挂着
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 题库：5 个正确节点 ---------- */
  const pairs = [
    { id: 1, event: '遵义会议（1935.1）',       place: '确立毛泽东领导地位' },
    { id: 2, event: '一渡赤水：土城·元厚西渡',   place: '北上川南 · 扎西整编' },
    { id: 3, event: '二渡赤水：太平渡·二郎滩东渡', place: '回师黔北 · 再占遵义' },
    { id: 4, event: '三渡赤水：茅台镇西渡',       place: '佯作北上 · 诱敌川南' },
    { id: 5, event: '四渡赤水：二郎滩·太平渡东渡', place: '佯攻贵阳 · 巧渡金沙江' }
  ];

  /* 史实数据：连对某个 id 时在史实面板展开 */
  const facts = {
    1: '【遵义会议】1935 年 1 月 15–17 日，遵义会议纠正了军事与组织上的错误，事实上确立了毛泽东在党中央和红军的领导地位，是党的历史上一个生死攸关的转折点。',
    2: '【一渡赤水】1935 年 1 月 29 日起，中央红军约 3 万人分路从土城、元厚西渡赤水河，向川南推进；2 月在云南扎西进行整编，轻装前进。',
    3: '【二渡赤水】2 月 18–21 日，红军从太平渡、二郎滩东渡赤水，突然回师黔北；2 月 28 日再占遵义，歼敌 2 个师又 8 个团、俘敌约 3000 人，取得长征以来最大的一次胜利。',
    4: '【三渡赤水】3 月 16–17 日，红军从茅台镇西渡赤水，佯作北渡长江，把数十万追敌引向川南，为四渡创造了条件。',
    5: '【四渡赤水】3 月 21–22 日，红军从二郎滩、太平渡等东渡赤水，随后南下乌江、佯攻贵阳，迫使蒋介石调滇军救黔，红军趁云南空虚巧渡金沙江，跳出围追堵截。'
  };

  const BOARD_W = 1120;
  const BOARD_H = 640;

  const board = document.getElementById('board');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const leftCol = document.getElementById('left');
  const rightCol = document.getElementById('right');
  const result = document.getElementById('result');
  const factBody = document.getElementById('factBody');

  let selectedLeft = null;
  let links = [];
  let matched = 0;
  let finished = false;
  let round = 0;
  let winTimer = 0;

  /* ---------- 工具 ---------- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function sameId(el, id) { return el.dataset.id === id; }

  /* ---------- 开局 / 重开 ---------- */
  function resetGame() {
    round += 1;
    clearTimeout(winTimer); winTimer = 0;

    leftCol.innerHTML = '';
    rightCol.innerHTML = '';
    links = [];
    matched = 0;
    selectedLeft = null;
    finished = false;
    result.textContent = '';
    if (factBody) factBody.textContent = '每连对一个正确节点，这里会展开对应的真实历史背景与数据。';
    board.classList.remove('is-done');

    shuffle(pairs).forEach(function (p) {
      leftCol.appendChild(makeCard(p, 'left', p.event));
    });

    /* 右侧 = 正确结果，打乱后渲染 */
    const rightPool = pairs.map(function (p) { return { id: p.id, place: p.place }; });
    shuffle(rightPool).forEach(function (p) {
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
    if (finished) return;
    if (el.classList.contains('correct')) return;
    Array.prototype.forEach.call(
      leftCol.querySelectorAll('.card'),
      function (c) { c.classList.remove('selected'); }
    );
    el.classList.add('selected');
    selectedLeft = el;
  }

  function selectRight(el) {
    if (finished || !selectedLeft) return;
    if (el.classList.contains('correct')) return;

    const left = selectedLeft;
    left.classList.remove('selected');
    selectedLeft = null;

    if (sameId(left, el.dataset.id)) {
      /* 连对 */
      left.classList.add('correct');
      el.classList.add('correct');
      links.push({ left: left, right: el, color: '#2c6e49', ok: true });
      matched += 1;
      revealFact(left.dataset.id);
      drawLines();
      checkWin();
      return;
    }

    /* 连错 */
    left.classList.add('wrong');
    el.classList.add('wrong');
    links.push({ left: left, right: el, color: '#a33a2c', ok: false });
    drawLines();

    const myRound = round;
    setTimeout(function () {
      if (myRound !== round) return;
      links = links.filter(function (l) { return !(l.left === left && l.right === el); });
      left.classList.remove('wrong');
      el.classList.remove('wrong');
      drawLines();
    }, 700);
  }

  /* ---------- 史实展开 ---------- */
  function revealFact(id) {
    if (!factBody) return;
    const text = facts[id];
    if (text) factBody.textContent = text;
  }

  /* ---------- 画线（贝塞尔曲线 + 端点圆点） ---------- */
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
      const cx = (x1 + x2) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash(link.ok ? [] : [8, 6]);
      if (link.ok) { ctx.shadowColor = 'rgba(44,110,73,.6)'; ctx.shadowBlur = 6; }
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(cx, y1, cx, y2, x2, y2);
      ctx.strokeStyle = link.color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      /* 端点圆点 */
      ctx.beginPath(); ctx.arc(x1, y1, 4, 0, Math.PI * 2);
      ctx.fillStyle = link.color; ctx.fill();
      ctx.beginPath(); ctx.arc(x2, y2, 4, 0, Math.PI * 2);
      ctx.fillStyle = link.color; ctx.fill();
    });
  }

  /* ---------- 判定 ---------- */
  function checkWin() {
    if (matched !== pairs.length) return;
    finished = true;
    board.classList.add('is-done');
    result.textContent = '五条连线全部正确 —— 四渡赤水，过关！';
    if (factBody) factBody.textContent = '四渡赤水历时约 3 个月，红军以约 3 万人机动穿插于 40 万敌军之间，转战 6 万余平方公里，被毛泽东称为军事指挥的「得意之笔」。';
    winTimer = setTimeout(finish, 900);
  }

  function finish() {
    winTimer = 0;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'cz:done' }, '*');
        return;
      }
    } catch (e) {}
    result.textContent = '恭喜过关！四渡赤水路线已连成，点「重新开始」可以再玩一次。';
  }

  /* ---------- 启动 ---------- */
  document.getElementById('resetBtn').addEventListener('click', resetGame);
  window.addEventListener('resize', drawLines);
  resetGame();
})();
