# core/ —— 引擎层

**只有负责人改这里。** 21 个成员对 `core/` 只读。

---

## 这里有什么

| 文件 | 职责 |
| --- | --- |
| `menu.css` | 开始页的全部样式，含 1280×720 舞台缩放 |
| `map.css` | 行军图页的样式：地图、印章、选关面板、关卡容器、尾声 |
| `save.js` | 存档：8 个挡位，以及「哪些关卡算数」的 `CZSave.SHIPPED` 清单 |
| `transits/` | 预留：单关卡定制过场（目前是空的，没有代码读它） |

> 早期设计里有 `cz.js`、`route.js`、`transit.js`，那套「注册表 + 路由 + 过场」的方案
> **没有实现**，也不打算实现了。现在关卡是 iframe 隔离的，
> 接入方式见 [`docs/level-api.md`](../docs/level-api.md)。

---

## 三个页面怎么串

```
index.html              开始页：标题、开始 / 继续 / 退出、存档面板
   ↓ 建好挡位后跳转
map.html                行军图：8 个地点、选关面板、iframe 关卡容器、尾声
   ↓ 点卡片
levels/<id>/index.html  关卡本体，跑在 1280×720 的 iframe 里
```

开始页和地图页都引 `core/save.js`，所以存读规则只有一份。

---

## 存档

`localStorage` 两个键：

| 键 | 内容 |
| --- | --- |
| `cz.saves` | 固定 8 个挡位，`[null \| { createdAt, playedAt, progress: ['mt', …] }, …]` |
| `cz.active` | 当前在玩第几个挡位（1–8），0 表示没有 |

`progress` 里存的是**成员 id**，不是序号——所以调整关卡顺序不会让存档错乱。

### `CZSave.SHIPPED`：哪些关卡算数

`save.js` 顶上有一份清单，决定哪些关卡会出现在地图上、计入进度。

没列进去的关卡，文件照旧留在 `levels/` 里，只是玩家看不到也点不进；
做完之后把 id 加进数组、刷新页面就放出来了——解锁链、进度分母、
「全部通关播尾声」的判定都跟着这个数组走，别处不用改。

一关都没放出的站点会在地图上标成灰色虚线，不参与解锁链，
所以半成品不会把后面的站点卡死。

---

## 关卡契约

关卡跑在 **iframe** 里，是独立文档：

- 入口固定 `levels/<id>/index.html`
- 通关 `window.parent.postMessage({ type: 'cz:done' }, '*')`
- 主动退出 `window.parent.postMessage({ type: 'cz:exit' }, '*')`
- 关卡名写在 `levels/<id>/meta.js`
- 封面是 `levels/<id>/cover.webp`，480×320

主程序收到 `cz:done` 会立刻销毁 iframe、记通关、回到选关面板。
所以关卡里要播的动画、要展示的总结，都得在发消息**之前**播完。

完整说明见 [`docs/level-api.md`](../docs/level-api.md)。

---

## 三条不能破的约束

**1. 不用 ES Module。**

整个项目是经典 `<script>`。`type="module"` 在 `file://` 下会被 CORS 拦成白屏，
所以 `export` / `import` / `import.meta` 一律不能出现在关卡代码里。
要模块化就用 IIFE 挂 `window`，`levels/hsj/level.js` 是个现成例子。

**2. 不引外部资源。**

零 CDN、零 webfont、零外链图，断网必须能玩。
需要 React 这类库就下载到本关 `assets/` 里再引本地路径（`levels/lyc/` 就是这么做的）。

**3. 关卡在 iframe 里。**

所以 `html` / `body` 是关卡自己的，可以放心写；主程序的样式也进不来。
代价是**碰不到主程序的 DOM**——`parent.document` 一律别用，只走 `postMessage`。

（早期文档写的「关卡在 Shadow DOM 里、根选择器用 `:host`」是另一套没落地的方案，
现在不要照着写，写了样式会整个失效。）
