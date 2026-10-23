# levels/jxf

**负责人：jxf**
关卡事件：待定
剧情顺序：不以文件夹名为准，只由 `core/route.js` 决定

---

## 这个格子归你

| 文件 / 目录 | 作用 | 是否入库 |
| --- | --- | --- |
| `level.js` | 关卡逻辑，导出 `mount(root, ctx)` | 入库 |
| `style.css` | 关卡样式，根选择器写 `:host` | 入库 |
| `assets/` | 别人 clone 下来必须有的素材 | 入库 |
| `_draft/` | 截图、试做贴图、参考图 | **不入库，随便扔** |

`level.js` 和 `style.css` 目前是空的，开工时**自己在 `levels/jxf/` 里新建**。
文件名大小写不要变：全小写。

## 边界

- 只改 `levels/jxf/` 里的东西
- `index.html`、`core/`、根 `assets/`、`docs/`、`.gitignore` 只读
- 别人的关卡能看能抄，不能提交任何改动
- 不改文件夹名，不改 `level.js` 里的 `id`

## 素材

判断标准一句话：**别人 clone 下来，你这关还能不能玩。**

- 需要 → 放 `assets/`，并且必须提交
- 不需要（草稿、截图、参考图）→ 放 `_draft/`，它已经被 `.gitignore` 忽略
- 单文件 ≤ 2MB，单关 `assets/` ≤ 8MB，全小写 ASCII + 连字符
- 禁视频、GIF、PSD

## 分支

```bash
git switch -c jxf
```

分支名就是你的缩写，和文件夹名一致。PR 提到 `develop`，不要提 `master`。
