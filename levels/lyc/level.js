// 因为不能修改 index.html，所以我们在这里动态加载 React
(function loadReact(callback) {
  if (window.React && window.ReactDOM) return callback();
  const loadScript = (src, onload) => {
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous'; s.onload = onload;
    document.head.appendChild(s);
  };
  loadScript("https://unpkg.com/react@18.3.1/umd/react.production.min.js", () => {
    loadScript("https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js", callback);
  });
})(function() {
  // ====== 以下为游戏逻辑 ======
  const { useReducer, useEffect } = React;
  const CONFIG = {
    resource: { maxHp: 100, initialHp: 100, maxFood: 100, initialFood: 60, maxCold: 100, initialCold: 40, maxWarmth: 100, initialWarmth: 30, maxDistance: 100, maxTurn: 20 },
    actionPoint: { base: 9, min: 5, moraleBonus: 2 },
    coldPenaltyTable: [ { min: 0, max: 30, penalty: 0 }, { min: 31, max: 55, penalty: 1 }, { min: 56, max: 80, penalty: 2 }, { min: 81, max: 100, penalty: 3 } ],
    hungerPenaltyTable: [ { min: 40, max: 100, penalty: 0 }, { min: 20, max: 39, penalty: 2 }, { min: 0, max: 19, penalty: 4 } ],
    action: { march: { ap: 5, food: 7 }, forage: { ap: 4, food: 5 }, rest: { ap: 3, food: 4 }, cook: { ap: 0, food: 0 } },
    baseFoodCostPerTurn: 5,
    forage: { successChance: 0.5, gainMin: 12, gainMax: 18, failStatusPenalty: 5 },
    rest: { statusBonus: 10, coldReduction: 8, instantStatus: 10, heal: 2, duration: 1 },
    cook: { foodGain: 20, warmthLoss: 10, showBelowFood: 25 },
    marchBaseDistance: 10,
    statusTiers: [ { name: "充沛", min: 75, max: 100, coefficient: 1.5 }, { name: "尚可", min: 55, max: 74, coefficient: 1.2 }, { name: "疲惫", min: 35, max: 54, coefficient: 0.9 }, { name: "虚弱", min: 15, max: 34, coefficient: 0.5 }, { name: "濒危", min: 0, max: 14, coefficient: 0.3 } ],
    status: { base: 60, min: 0, max: 100, foodHighThreshold: 40, foodHighCoefficient: 0.3, foodHighCap: 18, foodLowCoefficient: 0.6, foodLowFloor: -24, coldThreshold: 50, coldCoefficient: 0.5, coldFloor: -25, eventModifier: { frost: -15, pursuer: -10, blizzard: -10 }, moraleBonus: 25, moraleDuration: 2 },
    coldGrowth: { min: 8, max: 15, fallback: 3, frostMultiplier: 1.5, frostDuration: 2 },
    pursuer: { damageBase: 25, damageMin: 5, moraleChance: 0.2 },
    danger: { statusThreshold: 15, hpLoss: 5 },
    exposure: { frostbite: { coldAbove: 80, hpLoss: 5 }, starvation: { foodBelow: 10, hpLoss: 5 } },
    warning: { coldAbove: 70 },
    eventChance: 0.5,
    events: { movedWeight: [ { key: "frost", weight: 0.30 }, { key: "pursuer", weight: 0.10 }, { key: "blizzard", weight: 0.25 }, { key: "supply", weight: 0.35 } ], stayedWeight: [ { key: "frost", weight: 0.10 }, { key: "pursuer", weight: 0.60 }, { key: "blizzard", weight: 0.10 }, { key: "supply", weight: 0.20 } ] },
    blizzardColdGain: 20, supplyFoodGain: 15,
    ui: { progressBlocks: 12, logMaxEntries: 50, logDisplayCount: 3 },
  };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  function penaltyFromTable(table, value) {
    for (const row of table) { if (value >= row.min && value <= row.max) return row.penalty; }
    return table[table.length - 1].penalty;
  }
  const coldPenalty = (cold) => penaltyFromTable(CONFIG.coldPenaltyTable, cold);
  const hungerPenalty = (food) => penaltyFromTable(CONFIG.hungerPenaltyTable, food);

  function getStatusTier(status) {
    for (const t of CONFIG.statusTiers) { if (status >= t.min && status <= t.max) return t; }
    return CONFIG.statusTiers[CONFIG.statusTiers.length - 1];
  }
  function pushLog(logs, text, kind = "info") {
    const next = logs.concat([{ text, kind }]);
    return next.length > CONFIG.ui.logMaxEntries ? next.slice(next.length - CONFIG.ui.logMaxEntries) : next;
  }
  function pickEvent(didMove, didForage) {
    let table = didMove ? CONFIG.events.movedWeight : CONFIG.events.stayedWeight;
    if (didForage) table = table.filter((e) => e.key !== "supply");
    const total = table.reduce((sum, e) => sum + e.weight, 0);
    let r = Math.random() * total;
    for (const e of table) { if (r < e.weight) return e.key; r -= e.weight; }
    return table[table.length - 1].key;
  }
  function calcActionPoints(s) {
    const base = Math.max(CONFIG.actionPoint.min, CONFIG.actionPoint.base - coldPenalty(s.cold) - hungerPenalty(s.food));
    return base + (s.moraleBuff > 0 ? CONFIG.actionPoint.moraleBonus : 0);
  }
  function calcStatus(s) {
    let foodMod;
    if (s.food >= CONFIG.status.foodHighThreshold) {
      foodMod = Math.min(CONFIG.status.foodHighCap, (s.food - CONFIG.status.foodHighThreshold) * CONFIG.status.foodHighCoefficient);
    } else {
      foodMod = Math.max(CONFIG.status.foodLowFloor, -(CONFIG.status.foodHighThreshold - s.food) * CONFIG.status.foodLowCoefficient);
    }
    let coldMod = 0;
    if (s.cold > CONFIG.status.coldThreshold) {
      coldMod = Math.max(CONFIG.status.coldFloor, -(s.cold - CONFIG.status.coldThreshold) * CONFIG.status.coldCoefficient);
    }
    let tempBonus = 0;
    if (s.restBuff > 0) tempBonus += CONFIG.rest.statusBonus;
    if (s.moraleBuff > 0) tempBonus += CONFIG.status.moraleBonus;
    return clamp(CONFIG.status.base + foodMod + coldMod + s.eventStatusMod + tempBonus, CONFIG.status.min, CONFIG.status.max);
  }
  function calcDistance(s) { return CONFIG.marchBaseDistance * getStatusTier(s.status).coefficient; }

  function makeInitialState() {
    const s = {
      hp: CONFIG.resource.initialHp, food: CONFIG.resource.initialFood, cold: CONFIG.resource.initialCold, warmth: CONFIG.resource.initialWarmth,
      distance: 0, turn: 1, actionPoints: 0, restBuff: 0, moraleBuff: 0, frostBuff: 0, eventStatusMod: 0,
      status: 0, prevStatus: 0, statusTrend: "→", lastColdGrowth: null, nextColdRandom: null, weatherForecast: "持平",
      gameStatus: "playing", loseReason: null, didMove: false, didForage: false, showIntro: true, logs: [],
    };
    s.status = calcStatus(s); s.prevStatus = s.status; s.actionPoints = calcActionPoints(s);
    return s;
  }

  function applyEvent(s, event) {
    switch (event) {
      case "frost":
        s.frostBuff = CONFIG.coldGrowth.frostDuration;
        s.eventStatusMod = CONFIG.status.eventModifier.frost;
        s.logs = pushLog(s.logs, "遭遇严寒，寒冷增长加剧", "harm");
        break;
      case "pursuer":
        const damage = Math.max(CONFIG.pursuer.damageMin, CONFIG.pursuer.damageBase * (1 - s.status / CONFIG.status.max));
        s.hp -= damage;
        s.eventStatusMod = CONFIG.status.eventModifier.pursuer;
        s.logs = pushLog(s.logs, s.didMove ? `遭遇追兵，损失 ${fmt(damage)} 血` : `行军停滞，敌军追兵咬了上来！损失 ${fmt(damage)} 血`, "harm");
        if (Math.random() < CONFIG.pursuer.moraleChance) {
          s.moraleBuff = CONFIG.status.moraleDuration;
          s.logs = pushLog(s.logs, `士气大涨，状态 +${CONFIG.status.moraleBonus}，行动点 +${CONFIG.actionPoint.moraleBonus}`, "good");
        }
        break;
      case "blizzard":
        s.cold = clamp(s.cold + CONFIG.blizzardColdGain, 0, CONFIG.resource.maxCold);
        s.eventStatusMod = CONFIG.status.eventModifier.blizzard;
        s.logs = pushLog(s.logs, `暴风雪来袭，寒冷 +${CONFIG.blizzardColdGain}`, "harm");
        break;
      case "supply":
        s.food = clamp(s.food + CONFIG.supplyFoodGain, 0, CONFIG.resource.maxFood);
        s.logs = pushLog(s.logs, `发现物资，饱食度 +${CONFIG.supplyFoodGain}`, "good");
        break;
    }
  }

  function tickTempBuffs(s) {
    s.restBuff = Math.max(0, s.restBuff - 1);
    s.moraleBuff = Math.max(0, s.moraleBuff - 1);
    s.frostBuff = Math.max(0, s.frostBuff - 1);
  }

  function previewNextColdTrend(s) {
    const nextRandom = randInt(CONFIG.coldGrowth.min, CONFIG.coldGrowth.max);
    s.nextColdRandom = nextRandom;
    const frostMult = s.frostBuff > 0 ? CONFIG.coldGrowth.frostMultiplier : 1;
    const nextGrowth = Math.max(0, nextRandom * (1 - s.warmth / CONFIG.resource.maxWarmth) * frostMult - CONFIG.coldGrowth.fallback);
    const currentGrowth = s.lastColdGrowth != null ? s.lastColdGrowth : 0;
    if (nextGrowth > currentGrowth) return "加剧";
    if (nextGrowth < currentGrowth) return "减弱";
    return "持平";
  }

  function endTurn(state) {
    if (state.gameStatus !== "playing") return state;
    const s = { ...state, logs: state.logs.slice() };
    s.food = clamp(s.food - CONFIG.baseFoodCostPerTurn, 0, CONFIG.resource.maxFood);
    if (Math.random() < CONFIG.eventChance) applyEvent(s, pickEvent(s.didMove, s.didForage));
    const frostMult = s.frostBuff > 0 ? CONFIG.coldGrowth.frostMultiplier : 1;
    const coldRandom = s.nextColdRandom != null ? s.nextColdRandom : randInt(CONFIG.coldGrowth.min, CONFIG.coldGrowth.max);
    s.nextColdRandom = null;
    const coldGain = Math.max(0, coldRandom * (1 - s.warmth / CONFIG.resource.maxWarmth) * frostMult - CONFIG.coldGrowth.fallback);
    s.cold = clamp(s.cold + coldGain, 0, CONFIG.resource.maxCold);
    s.lastColdGrowth = coldGain;
    const prev = s.status;
    s.status = calcStatus(s);
    s.statusTrend = s.status > prev ? "↑" : s.status < prev ? "↓" : "→";
    s.prevStatus = prev;
    s.eventStatusMod = 0;
    if (s.cold >= CONFIG.exposure.frostbite.coldAbove) { s.hp -= CONFIG.exposure.frostbite.hpLoss; s.logs = pushLog(s.logs, `极度严寒，队伍正在掉血！损失 ${CONFIG.exposure.frostbite.hpLoss} 血`, "warn"); }
    if (s.food <= CONFIG.exposure.starvation.foodBelow) { s.hp -= CONFIG.exposure.starvation.hpLoss; s.logs = pushLog(s.logs, `极度饥饿，队伍正在掉血！损失 ${CONFIG.exposure.starvation.hpLoss} 血`, "warn"); }
    if (s.status < CONFIG.danger.statusThreshold) { s.hp -= CONFIG.danger.hpLoss; s.logs = pushLog(s.logs, `状态濒危，损失 ${CONFIG.danger.hpLoss} 血`, "harm"); }
    if (s.hp <= 0 || s.turn >= CONFIG.resource.maxTurn) { s.gameStatus = "lose"; s.loseReason = s.hp <= 0 ? "hp" : "turn"; return s; }
    if (s.distance >= CONFIG.resource.maxDistance) { s.gameStatus = "win"; return s; }
    s.turn += 1; s.didMove = false; s.didForage = false;
    s.actionPoints = calcActionPoints(s);
    tickTempBuffs(s);
    s.weatherForecast = previewNextColdTrend(s);
    return s;
  }

  function reducer(state, action) {
    if (state.gameStatus === "playing" && state.hp <= 0) return { ...state, gameStatus: "lose", loseReason: "hp" };
    switch (action.type) {
      case "START": return { ...state, showIntro: false };
      case "MARCH": {
        if (state.gameStatus !== "playing" || state.actionPoints < CONFIG.action.march.ap) return state;
        const distance = calcDistance(state);
        const next = { ...state, logs: state.logs.slice() };
        next.actionPoints -= CONFIG.action.march.ap;
        next.food = clamp(next.food - CONFIG.action.march.food, 0, CONFIG.resource.maxFood);
        next.distance += distance; next.didMove = true;
        next.logs = pushLog(next.logs, `前进，距离 +${fmt(distance)}`);
        if (next.distance >= CONFIG.resource.maxDistance) next.gameStatus = "win";
        return next;
      }
      case "FORAGE": {
        if (state.gameStatus !== "playing" || state.actionPoints < CONFIG.action.forage.ap) return state;
        const success = Math.random() < CONFIG.forage.successChance;
        const gain = success ? randInt(CONFIG.forage.gainMin, CONFIG.forage.gainMax) : 0;
        const next = { ...state, logs: state.logs.slice() };
        next.actionPoints -= CONFIG.action.forage.ap;
        next.food = clamp(next.food - CONFIG.action.forage.food + gain, 0, CONFIG.resource.maxFood);
        next.didForage = true;
        if (success) next.logs = pushLog(next.logs, `收集到食物，饱食度 +${gain}`, "good");
        else { next.status = clamp(state.status - CONFIG.forage.failStatusPenalty, CONFIG.status.min, CONFIG.status.max); next.statusTrend = "↓"; next.logs = pushLog(next.logs, `收集食物空手而归，士气受挫，状态 -${CONFIG.forage.failStatusPenalty}`, "harm"); }
        return next;
      }
      case "REST": {
        if (state.gameStatus !== "playing" || state.actionPoints < CONFIG.action.rest.ap) return state;
        const next = { ...state, logs: state.logs.slice() };
        next.actionPoints -= CONFIG.action.rest.ap;
        next.food = clamp(next.food - CONFIG.action.rest.food, 0, CONFIG.resource.maxFood);
        next.cold = clamp(next.cold - CONFIG.rest.coldReduction, 0, CONFIG.resource.maxCold);
        next.hp = clamp(next.hp + CONFIG.rest.heal, 0, CONFIG.resource.maxHp);
        next.status = clamp(next.status + CONFIG.rest.instantStatus, CONFIG.status.min, CONFIG.status.max);
        next.statusTrend = "↑"; next.restBuff = CONFIG.rest.duration;
        next.logs = pushLog(next.logs, "队伍停下休整，稍微暖和了一点，体力微微恢复。", "good");
        return next;
      }
      case "COOK": {
        if (state.gameStatus !== "playing" || state.food >= CONFIG.cook.showBelowFood || state.warmth <= 0) return state;
        const next = { ...state, logs: state.logs.slice() };
        next.food = clamp(next.food + CONFIG.cook.foodGain, 0, CONFIG.resource.maxFood);
        next.warmth = clamp(next.warmth - CONFIG.cook.warmthLoss, 0, CONFIG.resource.maxWarmth);
        next.logs = pushLog(next.logs, `煮衣物充饥，饱食 +${CONFIG.cook.foodGain}，保暖 -${CONFIG.cook.warmthLoss}（不可逆）`, "good");
        return next;
      }
      case "END_TURN": return endTurn(state);
      case "RESET": return makeInitialState();
      default: return state;
    }
  }

  // 通关：通知主程序记录进度（每次进关 iframe 都是全新的，闭包变量即可防重复）
  let __czDone = false;
  function finish() {
    if (__czDone) return;
    __czDone = true;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'cz:done' }, '*');
        return;
      }
    } catch (e) {}
  }

  const h = React.createElement;

  function Intro({ onStart }) {
    return h("div", { className: "intro-overlay" },
      h("div", { className: "intro-card" },
        h("h2", null, "【风雪夹金山·长征绝境】"),
        h("p", null, "指挥员同志，前方就是海拔四千米的夹金山。鸟儿飞不过，神仙也难攀。你的队伍物资匮乏，衣衫单薄，而敌人的追兵就在身后。"),
        h("h3", null, "【生存法则】"),
        h("p", null, `- 目标：在 ${CONFIG.resource.maxTurn} 个回合内，前进 ${CONFIG.resource.maxDistance} 距离，翻越雪山。`),
        h("p", null, "- 资源：时刻关注队伍的【血量】、【饱食度】、【寒冷值】与【保暖值】。极度的饥饿与严寒会直接吞噬战士们的生命。"),
        h("p", null, "- 行动：每回合发放的【行动点】代表队伍的体力。体力极差时，哪怕只是迈出一步都会极其困难。"),
        h("h3", null, "【铁血军规】"),
        h("p", null, "- 兵贵神速：前进是唯一的出路。如果你停下脚步（休息、收集食物），敌军追兵极大概率会咬上来。"),
        h("p", null, '- 绝境求生：当饥饿濒临极限时，系统会开放"煮衣物充饥"。但请记住，烧掉保暖的衣物，意味着你将更难抵御接下来的严寒，且不可逆。'),
        h("button", { className: "start-btn", onClick: onStart }, "【 开始长征 】")
      )
    );
  }

  function Game({ state, dispatch }) {
    const tier = getStatusTier(state.status);
    const blocks = CONFIG.ui.progressBlocks;
    const filled = Math.min(blocks, Math.floor((state.distance / CONFIG.resource.maxDistance) * blocks));
    const bar = "█".repeat(filled) + "░".repeat(blocks - filled);
    const distNum = Math.min(CONFIG.resource.maxDistance, Math.floor(state.distance));
    const weatherArrow = state.weatherForecast === "加剧" ? "↑" : state.weatherForecast === "减弱" ? "↓" : "→";
    const playing = state.gameStatus === "playing";
    const canCook = playing && state.food < CONFIG.cook.showBelowFood && state.warmth > 0;
    const coldDanger = state.cold >= CONFIG.warning.coldAbove;
    const recentLogs = state.logs.slice(-CONFIG.ui.logDisplayCount);
    const marchDisabled = !playing || state.actionPoints < CONFIG.action.march.ap;
    const forageDisabled = !playing || state.actionPoints < CONFIG.action.forage.ap;
    const restDisabled = !playing || state.actionPoints < CONFIG.action.rest.ap;

    return h("div", { className: "game" },
      h("div", { className: "top" },
        h("div", { className: "progress" }, h("span", null, bar), h("span", { className: "dist" }, distNum, "/", CONFIG.resource.maxDistance)),
        h("div", { className: "weather" }, "明日天气：风雪", state.weatherForecast, " ", weatherArrow),
        h("div", { className: "turn" }, "第 ", state.turn, " / ", CONFIG.resource.maxTurn, " 回合")
      ),
      h("div", { className: "section" },
        h("div", { className: "log-title" }, "事件日志（最近 ", CONFIG.ui.logDisplayCount, " 条，滚动）"),
        h("div", { className: "log-box", ref: (el) => { if (el) el.scrollTop = el.scrollHeight; } },
          recentLogs.length === 0 ? h("div", { className: "log-empty" }, "（暂无事件）") :
          recentLogs.map((entry, i) => h("div", { key: i, className: `log-line ${entry.kind}` }, entry.text))
        )
      ),
      h("div", { className: "section" },
        h("div", { className: "res-row" },
          h("span", null, "血量 ", h("b", null, Math.floor(state.hp)), "/", CONFIG.resource.maxHp),
          h("span", null, "行动点 ", h("b", null, state.actionPoints))
        ),
        h("div", { className: "res-row" },
          h("span", null, "饱食度 ", h("b", null, Math.floor(state.food)), "/", CONFIG.resource.maxFood),
          h("span", null, "寒冷值 ", h("b", { className: coldDanger ? "danger" : undefined }, Math.floor(state.cold)), "/", CONFIG.resource.maxCold),
          h("span", { className: "warmth" }, "保暖值 ", h("b", null, Math.floor(state.warmth)))
        ),
        h("div", { className: "status-line" }, "队伍状态：", tier.name, " ", state.statusTrend)
      ),
      h("div", { className: "section buttons" },
        h("button", { disabled: marchDisabled, onClick: () => dispatch({ type: "MARCH" }) }, `前进（-${CONFIG.action.march.ap}行动点，-${CONFIG.action.march.food}饱食）`),
        h("button", { disabled: forageDisabled, onClick: () => dispatch({ type: "FORAGE" }) }, `收集食物（-${CONFIG.action.forage.ap}行动点，-${CONFIG.action.forage.food}饱食）`),
        h("button", { disabled: restDisabled, onClick: () => dispatch({ type: "REST" }) }, `休息（-${CONFIG.action.rest.ap}行动点，-${CONFIG.action.rest.food}饱食，降温回血）`),
        canCook && h("button", { className: "cook", onClick: () => dispatch({ type: "COOK" }) }, `煮衣物充饥（+${CONFIG.cook.foodGain}饱食，-${CONFIG.cook.warmthLoss}保暖·不可逆）`),
        h("button", { className: "end-turn", disabled: !playing, onClick: () => dispatch({ type: "END_TURN" }) }, "结束回合（进入结算）")
      ),
      !playing && h("div", { className: "overlay" },
        h("div", { className: "overlay-card" },
          h("div", { className: `result ${state.gameStatus === "win" ? "win" : "lose"}` },
            state.gameStatus === "win" ? "胜利！成功翻越夹金山" :
            state.loseReason === "hp" ? "失败：队伍血量归零" : "失败：超过回合上限"
          ),
          h("div", { className: "overlay-sub" },
            state.gameStatus === "win" ? `用时 ${state.turn} 回合` : `止步于第 ${state.turn} 回合`
          ),
          h("button", { className: "restart", onClick: () => dispatch({ type: "RESET" }) }, "重开")
        )
      )
    );
  }

  function App() {
    const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
    useEffect(() => {
      if (state.gameStatus === "win") finish();
    }, [state.gameStatus]);
    if (state.showIntro) return h(Intro, { onStart: () => dispatch({ type: "START" }) });
    return h(Game, { state: state, dispatch: dispatch });
  }

  // 注意：这里挂载到模板自带的 id="stage" 上
  ReactDOM.createRoot(document.getElementById("stage")).render(h(App));
});