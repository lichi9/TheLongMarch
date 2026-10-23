# core/ —— 引擎层

**只有部长改这里。** 21 个成员对 `core/` 只读。

---

## 计划中的文件

| 文件 | 职责 | 状态 |
| --- | --- | --- |
| `menu.css` | 开始页面的全部样式，含 1280×720 舞台缩放 | 已写 |
| `cz.js` | 注册表、舞台缩放、关卡挂载与卸载、`ctx` 的构造 | 待写 |
| `route.js` | 关卡顺序数组，**剧情顺序的唯一真相** | 待写 |
| `transit.js` | 默认过场动画（缩场 → 地图推进 → 淡出） | 待写 |
| `transits/` | 单个关卡的定制过场，按名字被 `route.js` 引用 | 空 |

---

## `route.js` 的形状

顺序只在这一个数组里。调顺序 = 挪一行。

```js
CZ.ROUTE = [
  // id 就是 levels/ 下的文件夹名；日期和里程只喂给过场动画
  { id: 'mt',  date: '1934.10.21', name: '待定', km: 0 },
  { id: 'hsj', date: '1934.11.27', name: '待定', km: 0 },
];
```

约定：

- `id` 必须等于 `levels/` 下的文件夹名，等于 `level.js` 里注册的 `id`
- **不写 `order` 字段**，数组下标就是顺序，成员不需要知道自己是第几关
- 数组里出现哪个 `id`，就按哪个顺序播；没列进去的不参与流程（方便分阶段联调）
- 过场要定制时，加一个 `transit: '名字'` 字段，对应 `transits/名字.js`；不加就用默认过场

---

## 关卡契约

每个 `levels/<缩写>/level.js` 必须导出两样东西：

```js
CZ.register({
  id: 'mt',
  mount(root, ctx) { /* 画界面、绑事件 */ },
  unmount() { /* 可选：清理自己额外挂在外面东西 */ }
});
```

`root` 是一个**普通 div**（`.cz-box`），不是 ShadowRoot。
往里写 `root.innerHTML = ...` 不会冲掉引擎注入的样式表——这一点是硬约束，
改传 ShadowRoot 会让 21 个人的样式在某种写法下集体失效。

`ctx` 是成员唯一能用的入口：

| 干什么 | 用什么 |
| --- | --- |
| 查元素 | `ctx.$` / `ctx.$$` |
| 绑事件 | `ctx.on(元素, 'click', fn)` |
| 定时 | `ctx.timer.every` / `ctx.timer.after` |
| 逐帧 | `ctx.raf` |
| 弹提示 | `ctx.hint` |
| 取素材 | `ctx.assets('bg.png')` |
| 通关 | `ctx.finish(score)` |
| 失败 | `ctx.fail('原因')` |

这些入口的返回句柄都挂在当前关卡上，`unmount` 时统一回收。
成员自己 `setInterval` / `document.addEventListener`，切关后上一关还在跑——
这是最常见的「第二关声音叠着第一关」事故来源。

---

## 三条不能破的约束

1. **不用 ES Module。** 整个项目是经典 `<script>`，`type="module"` 会让双击打开直接白屏。
2. **不引外部资源。** 零 CDN、零 webfont、零外链图，断网必须能玩。
3. **关卡在 Shadow DOM 里。** 所以 `:root` / `html` / `body` 不存在，根选择器是 `:host`；
   `document.querySelector` 看不到关卡内的元素，但能误伤主壳。
