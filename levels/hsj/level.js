// ============================================================
// 长征拼图 · 关卡（levels/hsj）
//
// 接入方式见 docs/level-api.md：
//   · index.html 用普通 <script> 引本文件，挂在 window.HSJ_LEVEL 上
//   · 舞台固定 1280×720，下面自己建同尺寸的画布
//   · 五关拼完、玩家点「查看总结」时发 cz:done
//
// 这个项目全局禁用 ES Module —— 双击 index.html 打开时
// type="module" 会被 CORS 拦成白屏，所以这里是普通脚本 + IIFE。
// ============================================================

(function (global) {
  'use strict';

  // 下面的路径本身就是 assets/ 开头的相对路径，这里不用再拼前缀
  var assetBase = '';

// 关卡数据：5个长征关键节点
const LEVELS = [
  {
    name: '于都河出发',
    date: '1934年10月',
    image: assetBase + 'assets/puzzle-1-yudu.jpg',
    title: '长征启程',
    desc: '1934年10月，中共中央、中革军委率中央红军主力8.6万余人，从江西瑞金于都河畔出发，踏上了战略转移的漫漫征程。于都河是红军长征渡过的第一条大河，苏区人民连夜拆下600多块门板搭建浮桥，送别亲人踏上征途。',
    fact: '出发时兵力：约8.6万人',
  },
  {
    name: '遵义会议',
    date: '1935年1月',
    image: assetBase + 'assets/puzzle-2-zunyi.jpg',
    title: '伟大转折',
    desc: '1935年1月15日至17日，中共中央在贵州遵义召开政治局扩大会议。会议集中全力纠正了博古、李德等人在军事上和组织上的错误，确立了毛泽东同志在党中央和红军的领导地位。遵义会议是党的历史上一个生死攸关的转折点。',
    fact: '会议时长：3天',
  },
  {
    name: '飞夺泸定桥',
    date: '1935年5月',
    image: assetBase + 'assets/puzzle-3-luding.jpg',
    title: '天险突破',
    desc: '1935年5月29日，红军先头部队抵达大渡河泸定桥。22名红军突击队队员手持武器，攀着光溜溜的铁索，冒着敌人的枪林弹雨奋勇前进，成功夺取泸定桥，为红军北上打开了通道。',
    fact: '泸定桥：13根铁索，全长103.67米',
  },
  {
    name: '翻越夹金山',
    date: '1935年6月',
    image: assetBase + 'assets/puzzle-4-jiajin.jpg',
    title: '雪山征途',
    desc: '夹金山位于四川宝兴县，海拔4114米，是红军长征翻越的第一座大雪山。山上终年积雪，空气稀薄，气候变幻无常，时而狂风大作，时而冰雹倾泻。红军战士以坚韧不拔的意志，相互搀扶，成功翻越这座"神山"。',
    fact: '夹金山海拔：4114米',
  },
  {
    name: '吴起镇会师',
    date: '1935年10月',
    image: assetBase + 'assets/puzzle-5-wuqizhen.jpg',
    title: '胜利会师',
    desc: '1935年10月19日，中央红军到达陕北吴起镇，与陕北红军胜利会师。至此，中央红军历时12个月，途经11个省，行程二万五千里的长征胜利结束。长征的胜利，是中国革命转危为安的关键，铸就了伟大的长征精神。',
    fact: '长征里程：二万五千里',
  },
];

// 游戏状态
const STATE = {
  MENU: 'menu',           // 主菜单
  LOADING: 'loading',     // 加载中
  PLAY: 'play',           // 拼图游戏中
  REVEAL: 'reveal',       // 拼合完成，完整图片展示 1 秒
  COMPLETE: 'complete',   // 单关完成
  ALL_DONE: 'all_done',   // 全部通关
};

// 拼图规格：3×3 = 9块
const GRID = 3;
const TOTAL_TILES = GRID * GRID;

// 关卡内的解锁进度存在本地，中途关掉页面再进来能接着拼。
// 后面拼上地图的挡位号，换挡位重玩时不至于串到别人的进度。
const SAVE_PREFIX = 'cz.hsj.progress.';

// 拼完后完整图片的停留时长（毫秒）
const REVEAL_MS = 1000;

/* ---------- 关卡内的进度 ----------
   注意这和地图那边的存档是两回事：
   地图记的是「这一整关通没通」，这里记的是「五张拼图拼到第几张」。

   光按挡位号存是不够的：挡位号是 1–8 的槽位，玩家在开始页选「覆盖」
   重开一局时，槽位号还是那个号，进度却该从头算了。所以每条记录里
   额外存一份挡位的 createdAt 当指纹——覆盖存档会重置它，
   指纹一对不上就把旧进度作废。 */
function progressKey() {
  var slot = '0';
  try { slot = localStorage.getItem('cz.active') || '0'; } catch (e) {}
  return SAVE_PREFIX + slot;
}

/* 当前挡位的「出生时间」。没有存档（直接双击关卡）时返回空串。 */
function slotStamp() {
  try {
    var slot = parseInt(localStorage.getItem('cz.active'), 10);
    if (!(slot >= 1)) return '';
    var raw = localStorage.getItem('cz.saves');
    var list = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(list)) return '';
    var s = list[slot - 1];
    return s && typeof s.createdAt === 'number' ? String(s.createdAt) : '';
  } catch (e) {
    return '';
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(progressKey());
    if (!raw) return new Set();
    const data = JSON.parse(raw);
    /* 老格式（直接存数组）认不出是谁的，直接丢，反正只有测试数据会是那样 */
    if (!data || !Array.isArray(data.list)) return new Set();
    if (data.stamp !== slotStamp()) return new Set();   // 存档被覆盖过，从头拼
    return new Set(data.list.filter(function (n) {
      return typeof n === 'number' && n >= 0 && n < LEVELS.length;
    }));
  } catch (e) {
    return new Set();
  }
}

function saveProgress(set) {
  try {
    localStorage.setItem(progressKey(), JSON.stringify({
      stamp: slotStamp(),
      list: Array.from(set)
    }));
  } catch (e) { /* 存不进去就算了，不影响这一局 */ }
}

function mount(stage) {
  // ============================================================
  // 初始化
  // ============================================================
  /* 项目约定交给 mount 的是 #stage 这个 div，不是 canvas。
     这里自己建一块 1280×720 的画布塞进去，铺满由 style.css 负责。 */
  stage.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  stage.appendChild(canvas);

  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // 游戏数据
  let gameState = STATE.LOADING;
  let images = [];          // 加载完成的图片
  let currentLevel = 0;     // 当前关卡索引
  let completedLevels = loadProgress(); // 已拼完的关卡（进关时从本地恢复）
  let tiles = [];           // 当前拼图块数组
  let selectedTile = -1;    // 当前选中的拼图块索引
  let moves = 0;           // 步数
  let startTime = 0;        // 开始时间
  let elapsedTime = 0;      // 已用时间
  let revealStart = 0;      // 完整图片展示的起点
  let animFrame = null;

  /* 第 i 关能不能进：
     拼完的可以重玩，没拼过的只有前一关拼完了才解锁。
     第一关永远开着，所以任何时候进来都有事做。 */
  function isUnlocked(i) {
    if (completedLevels.has(i)) return true;
    if (i === 0) return true;
    return completedLevels.has(i - 1);
  }

  // UI 元素区域（用于点击检测）
  let uiRegions = [];

  // ============================================================
  // 资源加载
  // ============================================================
  function loadImages() {
    let settled = 0;

    /* 一张处理完就来这里对账。
       注意失败的那张也得算数，否则少一张图就永远进不了菜单。 */
    function settle() {
      settled++;
      if (settled === LEVELS.length) gameState = STATE.MENU;
    }

    LEVELS.forEach((level, i) => {
      const img = new Image();
      img.onload = () => {
        images[i] = img;
        settle();
      };
      img.onerror = () => {
        console.error('加载图片失败:', level.image);
        settle();
      };
      img.src = level.image;
    });

    /* 兜底：file:// 下文件不存在时，个别情况下既不触发 onload
       也不触发 onerror，请求就那么悬着。最多等 5 秒就放行，
       缺的那张由 drawPlay 自己弹提示，总比一直停在「加载中」强。 */
    setTimeout(function () {
      if (gameState === STATE.LOADING) gameState = STATE.MENU;
    }, 5000);
  }

  // ============================================================
  // 拼图初始化：打乱拼图块
  // ============================================================
  function initPuzzle(levelIdx) {
    currentLevel = levelIdx;
    moves = 0;
    selectedTile = -1;
    startTime = Date.now();

    // 生成正确顺序的数组 [0,1,2,...,8]
    tiles = [];
    for (let i = 0; i < TOTAL_TILES; i++) {
      tiles.push(i);
    }

    // 洗牌（Fisher-Yates）
    do {
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
    } while (isSolved()); // 确保不是一开始就拼好的

    gameState = STATE.PLAY;
  }

  function isSolved() {
    for (let i = 0; i < TOTAL_TILES; i++) {
      if (tiles[i] !== i) return false;
    }
    return true;
  }

  // ============================================================
  // 绘制函数
  // ============================================================

  // 绘制背景
  function drawBackground() {
    // 深红渐变背景
    const gradient = g.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#8B0000');
    gradient.addColorStop(1, '#4A0000');
    g.fillStyle = gradient;
    g.fillRect(0, 0, W, H);
  }

  // 绘制主菜单
  function drawMenu() {
    uiRegions = [];

    // 标题
    g.fillStyle = '#FFD700';
    g.font = 'bold 48px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('长征拼图', W / 2, 80);

    // 副标题
    g.fillStyle = '#FFE4B5';
    g.font = '20px "Microsoft YaHei", sans-serif';
    g.fillText('— 重走长征路 · 拼图学历史 —', W / 2, 120);

    // 关卡按钮列表
    const btnW = 320;
    const btnH = 70;
    const startY = 180;
    const gap = 16;

    LEVELS.forEach((level, i) => {
      const y = startY + i * (btnH + gap);
      const x = (W - btnW) / 2;
      const isDone = completedLevels.has(i);
      const isOpen = isUnlocked(i);

      // 按钮背景：已通关绿 / 可拼金 / 没解锁压暗
      if (isDone) g.fillStyle = '#2E7D32';
      else if (isOpen) g.fillStyle = 'rgba(255,255,255,0.15)';
      else g.fillStyle = 'rgba(0,0,0,0.38)';
      g.fillRect(x, y, btnW, btnH);

      // 按钮边框
      g.strokeStyle = isDone ? '#4CAF50' : (isOpen ? '#FFD700' : 'rgba(255,255,255,0.16)');
      g.lineWidth = isOpen ? 2 : 1;
      g.strokeRect(x, y, btnW, btnH);

      // 关卡编号 + 名字
      g.fillStyle = isOpen ? '#FFD700' : 'rgba(255,255,255,0.32)';
      g.font = 'bold 22px "Microsoft YaHei", sans-serif';
      g.textAlign = 'left';
      g.fillText(`${i + 1}. ${level.name}`, x + 20, y + btnH / 2);

      // 右侧：已通关 / 日期 / 未解锁
      g.fillStyle = isOpen ? '#FFE4B5' : 'rgba(255,255,255,0.26)';
      g.font = '16px "Microsoft YaHei", sans-serif';
      g.textAlign = 'right';
      g.fillText(isDone ? '✓ 已通关' : (isOpen ? level.date : '未解锁'), x + btnW - 20, y + btnH / 2);

      // 只有解锁了的才响应点击，锁着的不记录热区
      if (isOpen) {
        uiRegions.push({ x, y, w: btnW, h: btnH, action: 'select_level', levelIdx: i });
      }
    });

    // 底部提示
    let tipText = '从第一关开始，拼完一关解锁下一关';
    if (completedLevels.size >= LEVELS.length) tipText = '全部拼完，随时可以重玩任意一关';
    else if (completedLevels.size > 0) tipText = '拼完一关解锁下一关，已通关的可以重玩';

    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.font = '14px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.fillText(tipText, W / 2, H - 30);
  }

  // 绘制加载中
  function drawLoading() {
    g.fillStyle = '#FFD700';
    g.font = '24px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('加载中...', W / 2, H / 2);
  }

  // 绘制拼图游戏界面
  function drawPlay() {
    uiRegions = [];
    const level = LEVELS[currentLevel];
    const img = images[currentLevel];

    /* 这张图没加载成功就别往下走了：
       下面全程在用 img.width，undefined 会抛 TypeError，
       而且抛错点在 requestAnimationFrame 之前，渲染循环会整个停住——
       画面冻在最后一帧，连返回按钮都点不动。 */
    if (!img) {
      g.fillStyle = 'rgba(0, 0, 0, 0.55)';
      g.fillRect(0, 0, W, H);

      g.fillStyle = '#FFD700';
      g.font = 'bold 26px "Microsoft YaHei", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('这张图没能加载出来', W / 2, H / 2 - 44);

      g.fillStyle = 'rgba(255, 255, 255, 0.72)';
      g.font = '16px "Microsoft YaHei", sans-serif';
      g.fillText('检查 assets/' + level.image.split('/').pop() + ' 还在不在', W / 2, H / 2 + 2);

      const btnW = 180;
      const btnH = 48;
      const btnX = (W - btnW) / 2;
      const btnY = H / 2 + 56;

      g.fillStyle = '#8B0000';
      g.fillRect(btnX, btnY, btnW, btnH);
      g.strokeStyle = '#FFD700';
      g.lineWidth = 2;
      g.strokeRect(btnX, btnY, btnW, btnH);
      g.fillStyle = '#FFD700';
      g.font = 'bold 18px "Microsoft YaHei", sans-serif';
      g.fillText('返回选关', W / 2, btnY + btnH / 2);

      uiRegions.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: 'back_menu' });
      return;
    }

    // 顶部信息栏
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, 0, W, 60);

    // 返回按钮
    g.fillStyle = '#FFD700';
    g.font = '18px "Microsoft YaHei", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('← 返回', 20, 30);
    uiRegions.push({ x: 0, y: 0, w: 80, h: 60, action: 'back_menu' });

    // 关卡名称
    g.fillStyle = '#FFD700';
    g.font = 'bold 20px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.fillText(level.name, W / 2, 30);

    // 步数和时间
    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsedTime / 60);
    const secs = elapsedTime % 60;
    g.fillStyle = '#FFE4B5';
    g.font = '16px "Microsoft YaHei", sans-serif';
    g.textAlign = 'right';
    g.fillText(`步数: ${moves}  时间: ${mins}:${secs.toString().padStart(2, '0')}`, W - 20, 30);

    // 拼图区域
    const puzzleSize = Math.min(W - 40, H - 160);
    const puzzleX = (W - puzzleSize) / 2;
    const puzzleY = 80;
    const tileSize = puzzleSize / GRID;

    // 拼图背景
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(puzzleX, puzzleY, puzzleSize, puzzleSize);

    // 绘制每个拼图块
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const idx = row * GRID + col;      // 当前位置
        const tileNum = tiles[idx];         // 这块图片是第几块
        const srcRow = Math.floor(tileNum / GRID);
        const srcCol = tileNum % GRID;

        const dx = puzzleX + col * tileSize;
        const dy = puzzleY + row * tileSize;
        const sx = srcCol * (img.width / GRID);
        const sy = srcRow * (img.height / GRID);
        const sw = img.width / GRID;
        const sh = img.height / GRID;

        // 绘制图片块
        g.drawImage(img, sx, sy, sw, sh, dx, dy, tileSize, tileSize);

        // 选中高亮
        if (selectedTile === idx) {
          g.strokeStyle = '#FFD700';
          g.lineWidth = 4;
          g.strokeRect(dx + 2, dy + 2, tileSize - 4, tileSize - 4);
        }

        // 网格线
        g.strokeStyle = 'rgba(0,0,0,0.3)';
        g.lineWidth = 1;
        g.strokeRect(dx, dy, tileSize, tileSize);

        // 记录点击区域
        uiRegions.push({
          x: dx, y: dy, w: tileSize, h: tileSize,
          action: 'tile_click', tileIdx: idx
        });
      }
    }

    // 底部：原图预览
    const previewSize = 80;
    const previewX = 20;
    const previewY = H - previewSize - 20;

    g.fillStyle = '#FFD700';
    g.font = '14px "Microsoft YaHei", sans-serif';
    g.textAlign = 'left';
    g.fillText('原图参考：', previewX, previewY - 8);

    g.drawImage(img, previewX, previewY, previewSize, previewSize);
    g.strokeStyle = '#FFD700';
    g.lineWidth = 2;
    g.strokeRect(previewX, previewY, previewSize, previewSize);

    // 提示文字
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = '14px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.fillText('点击两块拼图交换位置，拼出完整画面', W / 2, H - 30);
  }

  /* 拼合完成 · 完整图片展示 1 秒
     这一秒纯粹是给玩家「看一眼自己拼出了什么」的，
     所以不摆按钮：整张图铺出来，配一圈由外向内收拢的金边，
     关卡标题从中间浮上来。1 秒后 render 自动切到完成面板。 */
  function drawReveal() {
    /* 这一屏不接受点击：不清热区的话，上一帧拼图格子的热区还在，
       玩家手快点一下就会把刚拼好的图又换乱。 */
    uiRegions = [];

    const level = LEVELS[currentLevel];
    const img = images[currentLevel];
    const puzzleSize = Math.min(W - 40, H - 160);
    const puzzleX = (W - puzzleSize) / 2;
    const puzzleY = 80;

    // 0 → 1 的进度，缓出一下，收边不会太突兀
    const t = Math.min(1, (performance.now() - revealStart) / REVEAL_MS);
    const ease = 1 - Math.pow(1 - t, 2);

    if (img) g.drawImage(img, puzzleX, puzzleY, puzzleSize, puzzleSize);

    // 金边从外面 36px 处收到贴合图片
    const inset = (1 - ease) * 36;
    g.strokeStyle = 'rgba(255, 215, 0, ' + (0.35 + 0.65 * ease) + ')';
    g.lineWidth = 3 + 2 * ease;
    g.strokeRect(puzzleX - inset, puzzleY - inset, puzzleSize + inset * 2, puzzleSize + inset * 2);

    // 标题条：稍等一拍再淡入，别和收边抢
    const fade = Math.min(1, Math.max(0, (t - 0.12) / 0.3));
    if (fade > 0) {
      const barH = 96;
      const barY = puzzleY + puzzleSize / 2 - barH / 2;

      g.globalAlpha = fade * 0.62;
      g.fillStyle = '#000';
      g.fillRect(0, barY, W, barH);

      g.globalAlpha = fade;
      g.fillStyle = '#FFD700';
      g.font = 'bold 36px "Microsoft YaHei", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(level.title, W / 2, barY + barH / 2);

      g.globalAlpha = 1;
    }
  }

  // 绘制单关完成界面
  function drawComplete() {
    uiRegions = [];
    const level = LEVELS[currentLevel];

    // 半透明遮罩
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(0, 0, W, H);

    // 完成面板
    const panelW = 420;
    const panelH = 480;
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;

    g.fillStyle = '#FFF8DC';
    g.fillRect(panelX, panelY, panelW, panelH);

    g.strokeStyle = '#8B0000';
    g.lineWidth = 3;
    g.strokeRect(panelX, panelY, panelW, panelH);

    // 标题
    g.fillStyle = '#8B0000';
    g.font = 'bold 28px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('恭喜通关！', W / 2, panelY + 50);

    // 关卡名称
    g.font = 'bold 20px "Microsoft YaHei", sans-serif';
    g.fillStyle = '#333';
    g.fillText(`${level.name} · ${level.date}`, W / 2, panelY + 90);

    // 分隔线
    g.strokeStyle = '#8B0000';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(panelX + 30, panelY + 120);
    g.lineTo(panelX + panelW - 30, panelY + 120);
    g.stroke();

    // 历史知识标题
    g.fillStyle = '#8B0000';
    g.font = 'bold 18px "Microsoft YaHei", sans-serif';
    g.textAlign = 'left';
    g.fillText(`【${level.title}】`, panelX + 30, panelY + 150);

    // 历史描述（自动换行）
    g.fillStyle = '#333';
    g.font = '15px "Microsoft YaHei", sans-serif';
    wrapText(level.desc, panelX + 30, panelY + 180, panelW - 60, 24);

    // 数据亮点
    g.fillStyle = '#B8860B';
    g.font = 'bold 16px "Microsoft YaHei", sans-serif';
    g.fillText(`📊 ${level.fact}`, panelX + 30, panelY + panelH - 100);

    // 成绩
    g.fillStyle = '#666';
    g.font = '14px "Microsoft YaHei", sans-serif';
    g.fillText(`用时：${Math.floor(elapsedTime / 60)}分${elapsedTime % 60}秒  步数：${moves}`, panelX + 30, panelY + panelH - 70);

    // 下一关按钮
    const btnW = 160;
    const btnH = 40;
    const btnX = (W - btnW) / 2;
    const btnY = panelY + panelH - 50;

    /* 全部拼完才给「查看总结」。
       不是靠「到了最后一关」判断——那样万一以后加减关卡还得改这里。 */
    const allDone = completedLevels.size >= LEVELS.length;
    g.fillStyle = '#8B0000';
    g.fillRect(btnX, btnY, btnW, btnH);
    g.fillStyle = '#FFD700';
    g.font = 'bold 16px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.fillText(allDone ? '查看总结' : '下一关 →', W / 2, btnY + btnH / 2);

    uiRegions.push({
      x: btnX, y: btnY, w: btnW, h: btnH,
      action: allDone ? 'all_done' : 'next_level'
    });
  }

  // 绘制全部通关界面
  function drawAllDone() {
    uiRegions = [];

    // 金色背景
    const gradient = g.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#B8860B');
    gradient.addColorStop(1, '#8B0000');
    g.fillStyle = gradient;
    g.fillRect(0, 0, W, H);

    // 标题
    g.fillStyle = '#FFD700';
    g.font = 'bold 42px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🏆 长征胜利！', W / 2, 120);

    // 总结文字
    g.fillStyle = '#FFF8DC';
    g.font = '18px "Microsoft YaHei", sans-serif';
    g.fillText('你已完成全部5个长征关卡！', W / 2, 180);

    // 长征总结
    g.font = '16px "Microsoft YaHei", sans-serif';
    g.fillText('红军长征历时两年，途经14个省，', W / 2, 240);
    g.fillText('翻越40余座海拔4000米以上的雪山，', W / 2, 270);
    g.fillText('跨过百条江河，行程二万五千里。', W / 2, 300);
    g.fillText('长征是宣言书，长征是宣传队，长征是播种机。', W / 2, 340);

    // 重新开始按钮
    const btnW = 200;
    const btnH = 50;
    const btnX = (W - btnW) / 2;
    const btnY = H - 120;

    g.fillStyle = '#FFD700';
    g.fillRect(btnX, btnY, btnW, btnH);
    g.fillStyle = '#8B0000';
    g.font = 'bold 20px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.fillText('完成长征 · 返回', W / 2, btnY + btnH / 2);

    uiRegions.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: 'back_menu' });
  }

  // 文字自动换行辅助函数
  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split('');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n];
      const metrics = g.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        g.fillText(line, x, currentY);
        line = words[n];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    g.fillText(line, x, currentY);
  }

  // ============================================================
  // 主渲染循环
  // ============================================================
  function render() {
    drawBackground();

    switch (gameState) {
      case STATE.LOADING:
        drawLoading();
        break;
      case STATE.MENU:
        drawMenu();
        break;
      case STATE.PLAY:
        drawPlay();
        break;
      case STATE.REVEAL:
        drawReveal();
        /* 展示满 1 秒就进完成面板。
           放在这里而不是 setTimeout，是因为 render 本来就在跑，
           不用再管一个定时器的清理。 */
        if (performance.now() - revealStart >= REVEAL_MS) {
          gameState = STATE.COMPLETE;
        }
        break;
      case STATE.COMPLETE:
        drawPlay(); // 底层还是拼图画面
        drawComplete();
        break;
      case STATE.ALL_DONE:
        drawAllDone();
        break;
    }

    animFrame = requestAnimationFrame(render);
  }

  // ============================================================
  // 交互处理
  // ============================================================
  function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // 遍历 UI 区域，检测点击
    for (const region of uiRegions) {
      if (x >= region.x && x <= region.x + region.w &&
          y >= region.y && y <= region.y + region.h) {
        onAction(region.action, region);
        return;
      }
    }
  }

  function onAction(action, region) {
    switch (action) {
      case 'select_level':
        if (!isUnlocked(region.levelIdx)) break;  // 热区里本来就没有锁着的，兜一层
        initPuzzle(region.levelIdx);
        break;

      case 'back_menu':
        /* 从「长征胜利」那一屏返回，说明玩家看完了总结，
           这时候才通知地图。在主菜单直接返回不算，免得没拼完就误判。 */
        if (gameState === STATE.ALL_DONE) finish();
        gameState = STATE.MENU;
        break;

      case 'tile_click':
        handleTileClick(region.tileIdx);
        break;

      case 'next_level':
        if (currentLevel + 1 < LEVELS.length) initPuzzle(currentLevel + 1);
        break;

      case 'all_done':
        gameState = STATE.ALL_DONE;
        break;
    }
  }

  function handleTileClick(tileIdx) {
    if (gameState !== STATE.PLAY) return;   // 展示那一秒、完成面板上都不该换块

    if (selectedTile === -1) {
      // 第一次点击：选中
      selectedTile = tileIdx;
    } else if (selectedTile === tileIdx) {
      // 再次点击同一块：取消选中
      selectedTile = -1;
    } else {
      // 第二次点击：交换两块
      [tiles[selectedTile], tiles[tileIdx]] = [tiles[tileIdx], tiles[selectedTile]];
      selectedTile = -1;
      moves++;

      // 拼好了：先记进度，再放 1 秒完整图，最后才进完成面板
      if (isSolved()) {
        completedLevels.add(currentLevel);
        saveProgress(completedLevels);
        revealStart = performance.now();
        gameState = STATE.REVEAL;
      }
    }
  }

  // ============================================================
  // 启动
  // ============================================================
  loadImages();
  render();

  // 事件监听
  canvas.addEventListener('click', handleClick);

  // 返回清理函数（如果框架需要）
  return function cleanup() {
    if (animFrame) cancelAnimationFrame(animFrame);
    canvas.removeEventListener('click', handleClick);
  };
}

/* ---------- 通关通知 ----------
   每次进关 iframe 都是新文档，这个标记天然重置，不用额外清。 */
var doneSent = false;

function finish() {
  if (doneSent) return;
  doneSent = true;
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'cz:done' }, '*');
      return;
    }
  } catch (e) { /* 跨窗口被拦就算了，自己这张总结画面还在 */ }
  /* 单独双击打开时没有父窗口，停在自己的画面上就好 */
}

global.HSJ_LEVEL = { mount: mount };

/* ---------- 调试：?reset=1 ----------
   清掉本关的拼图进度，回到「只有第一关能拼」的状态。
   和 map.html 的 ?reset=1 不是一回事——那个清的是地图存档里「整关通没通」，
   这个只清关卡内「五张拼到第几张」，所以在关卡页上加。

   必须在 mount 之前执行，mount 里第一件事就是 loadProgress()。 */
if (/[?&]reset=1\b/.test(location.search)) {
  try { localStorage.removeItem(progressKey()); } catch (e) {}
}

/* index.html 里只有一行 <script src="level.js">，没人来调 mount，
   所以这里自己挂到 #stage 上。dataset 标记防止重复挂同一个舞台。 */
var stageEl = document.getElementById('stage');
if (stageEl && !stageEl.dataset.mounted) {
  stageEl.dataset.mounted = '1';
  mount(stageEl);
}

})(window);
