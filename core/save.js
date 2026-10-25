/* ============================================================
   存档 · core/save.js

   8 个挡位，全部存在浏览器本地（localStorage），不上传、不联网。
   开始页和地图页都引用这一份，保证两边读写规则一致。

   数据结构
     cz.saves  = [ null | { createdAt, playedAt, progress: ['hzh', ...] }, ... ]  // 固定 8 个
     cz.active = 当前在玩第几个挡位（1-8），0 表示没有

   注意：localStorage 在隐私模式、某些浏览器设置下会抛异常，
   所以每个入口都包了 try，读写失败就当没有存档，不让游戏崩掉。
   ============================================================ */
(function (global) {
  'use strict';

  var SAVES_KEY = 'cz.saves';
  var ACTIVE_KEY = 'cz.active';
  var SLOTS = 8;
  var TOTAL_LEVELS = 21;   // 全部关卡数，用来算进度

  function blankList() {
    var list = [];
    for (var i = 0; i < SLOTS; i++) list.push(null);
    return list;
  }

  /* ---------- 底层读写 ---------- */

  function readSaves() {
    try {
      var raw = global.localStorage.getItem(SAVES_KEY);
      var list = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(list)) return blankList();
      // 补齐到 8 个，防止手改或旧数据缺位
      while (list.length < SLOTS) list.push(null);
      return list.slice(0, SLOTS);
    } catch (e) {
      return blankList();
    }
  }

  function writeSaves(list) {
    try {
      global.localStorage.setItem(SAVES_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 当前挡位 ---------- */

  function getActive() {
    try {
      var v = parseInt(global.localStorage.getItem(ACTIVE_KEY), 10);
      return (v >= 1 && v <= SLOTS) ? v : 0;
    } catch (e) {
      return 0;
    }
  }

  function setActive(slot) {
    try {
      global.localStorage.setItem(ACTIVE_KEY, String(slot));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 挡位操作 ---------- */

  function read(slot) {
    return readSaves()[slot - 1] || null;
  }

  /** 新建（或覆盖）一个挡位，并切过去。
      写不进去时返回 null——调用方必须检查，否则玩家会以为建了档、
      实际下次进来是空的（隐私模式、存储被禁用时就会这样）。 */
  function create(slot) {
    var list = readSaves();
    var now = Date.now();
    list[slot - 1] = { createdAt: now, playedAt: now, progress: [] };
    if (!writeSaves(list)) return null;
    setActive(slot);
    return list[slot - 1];
  }

  /** 追加一个通关的关卡 id，顺手刷新 playedAt */
  function pushProgress(id) {
    var slot = getActive();
    if (!slot) return false;
    var list = readSaves();
    var s = list[slot - 1];
    if (!s) {
      // 挡位被外部清掉了，补一个，别把进度丢了
      s = { createdAt: Date.now(), playedAt: Date.now(), progress: [] };
    }
    if (s.progress.indexOf(id) < 0) s.progress.push(id);
    s.playedAt = Date.now();
    list[slot - 1] = s;
    writeSaves(list);
    return true;
  }

  /** 只刷新「上次游玩时间」，返回主界面时调 */
  function touch() {
    var slot = getActive();
    if (!slot) return;
    var list = readSaves();
    var s = list[slot - 1];
    if (!s) return;
    s.playedAt = Date.now();
    list[slot - 1] = s;
    writeSaves(list);
  }

  /** 整段覆盖当前挡位的进度（调试用，比如「全部解锁」） */
  function setProgress(list) {
    var slot = getActive();
    if (!slot) return false;
    var saves = readSaves();
    var s = saves[slot - 1] || { createdAt: Date.now(), playedAt: Date.now(), progress: [] };
    s.progress = Array.isArray(list) ? list.slice() : [];
    s.playedAt = Date.now();
    saves[slot - 1] = s;
    writeSaves(saves);
    return true;
  }

  /** 清空当前挡位的进度 */
  function clearProgress() {
    return setProgress([]);
  }

  /** 当前挡位的进度数组 */
  function activeProgress() {
    var slot = getActive();
    if (!slot) return [];
    var s = read(slot);
    return (s && Array.isArray(s.progress)) ? s.progress.slice() : [];
  }

  /** 有没有任何存档，给「继续」按钮判断能不能点 */
  function hasAny() {
    return readSaves().some(function (s) { return !!s; });
  }

  /* ---------- 给界面用的摘要 ---------- */

  function summary() {
    return readSaves().map(function (s, i) {
      return {
        slot: i + 1,
        empty: !s,
        progress: s ? s.progress.length : 0,
        total: TOTAL_LEVELS,
        createdAt: s ? s.createdAt : 0,
        playedAt: s ? s.playedAt : 0
      };
    });
  }

  global.CZSave = {
    SLOTS: SLOTS,
    TOTAL_LEVELS: TOTAL_LEVELS,
    readSaves: readSaves,
    read: read,
    create: create,
    getActive: getActive,
    setActive: setActive,
    pushProgress: pushProgress,
    touch: touch,
    activeProgress: activeProgress,
    setProgress: setProgress,
    clearProgress: clearProgress,
    hasAny: hasAny,
    summary: summary
  };
})(window);
