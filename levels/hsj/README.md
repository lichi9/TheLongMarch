# levels/hsj

**负责人：hsj**
关卡：会宁会师 · 回忆拼图（终章）
剧情顺序：不以文件夹名为准，只看 `map.html` 里印章的排列

---

## 这一关是什么

五张历史照片拼图，从于都河出发一路拼到吴起镇会师。
每张图切成 3×3 九块，点两块交换位置。

- 只能从第一张开始拼，拼完一张解锁下一张
- 拼完一张会停 1 秒展示完整图片，再进历史知识面板
- 五张全拼完 →「查看总结」→ 点「完成长征 · 返回」才算通关

---

## 文件

| 文件 | 作用 | 是否入库 |
| --- | --- | --- |
| `index.html` | 入口页，主程序 iframe 加载的就是它 | 入库 |
| `level.js` | 关卡逻辑，普通 `<script>`，挂 `window.HSJ_LEVEL` | 入库 |
| `meta.js` | 卡片上的名字 | 入库 |
| `style.css` | 关卡样式，`html` / `body` + `#stage` | 入库 |
| `cover.webp` | 选关面板封面，480×320 | 入库 |
| `assets/` | 五张拼图原图 `puzzle-1..5` | 入库 |
| `_draft/` | 草稿、改造前的备份 | **不入库** |
| `test/` | 参考样例，别动 | 入库 |

---

## 几个约定

**不用 ES Module。**
这里是普通脚本 + IIFE，挂到 `window.HSJ_LEVEL` 上，`index.html` 用
`<script src="level.js">` 引。写成 `export` 会让整个文件不执行，页面白屏
（`file://` 下模块请求会被 CORS 拦）。

**画布自己建。**
`mount(stage)` 拿到的是 `#stage` 这个 div，不是 canvas。
函数里自己 `createElement('canvas')` 建 1280×720 的那块。

**通关发消息。**
在「长征胜利」那屏点「完成长征 · 返回」时才发：

```js
window.parent.postMessage({ type: 'cz:done' }, '*');
```

**关卡内的进度**存在 `cz.hsj.progress.<挡位号>`，跟地图的 8 个挡位一一对应，
换挡位重玩不会串进度。存的是「拼到第几张」，跟地图记的「整关通没通」是两回事。

---

## 改内容

五张图的文案集中在 `level.js` 顶部的 `LEVELS` 数组里，`name` / `date` /
`title` / `desc` / `fact` 都在那儿。换图就替换 `assets/puzzle-*.jpg`，文件名保持不变。

加减关卡只改 `LEVELS` 数组——解锁链和「全部拼完」的判断都跟着数组长度走，
别的地方不用动。

拼图规格是 `GRID = 3`，想改成 4×4 就动这一个常量。

---

## 边界

- 只改 `levels/hsj/` 里的东西
- `index.html`、`core/`、根 `assets/`、`docs/`、`.gitignore` 只读
- 别人的关卡能看能抄，不能提交任何改动

## 分支

```bash
git switch -c hsj
```

分支名就是你的缩写，和文件夹名一致。PR 提到 `develop`，不要提 `main`。
