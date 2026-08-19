# 自托管字体目录

本目录用于放置 Electron 离线优先的 `.woff2` 字体文件。放置后无需额外配置，
`src/index.css` 中的 `@font-face` 会自动按文件名加载。

## 支持的字体 ID

| ID | Regular 文件名 | Bold 文件名 | 说明 |
|----|---------------|------------|------|
| `inter` | `inter-400.woff2` | `inter-700.woff2` | 英文 UI 主力字体 |
| `noto-sans-sc` | `noto-sans-sc-400.woff2` | `noto-sans-sc-700.woff2` | 中文无衬线主力 |
| `noto-serif-sc` | `noto-serif-sc-400.woff2` | `noto-serif-sc-700.woff2` | 中文衬线阅读字体 |
| `lxgw-wenkai` | `lxgw-wenkai-400.woff2` | `lxgw-wenkai-700.woff2` | 霞鹜文楷（沉浸式阅读） |
| `sarasa-gothic-sc` | `sarasa-gothic-sc-400.woff2` | `sarasa-gothic-sc-700.woff2` | 更纱黑体（代码混排） |
| `jetbrains-mono` | `jetbrains-mono-400.woff2` | `jetbrains-mono-700.woff2` | 代码块字体 |

> **中文字体 Subset 提示**：完整的思源/更纱 SC 通常 > 6MB。若需减小包体，推荐
> 使用 `fonttools` / `glyhps` 只保留 GB2312 / 常用字 8000 子集，再转 woff2
> 后通常可降到 1.5~2MB。

## 未放置文件时的行为

若对应文件不存在，`@font-face` 的 `local()` 与 `url()` 回退链路会自动使用：

- **macOS**：苹方 PingFang SC / 宋体 Songti SC
- **Windows**：微软雅黑 Microsoft YaHei / 楷体 KaiTi / 宋体 SimSun
- **Linux**：系统预装的 Noto CJK / 文泉驿

离线体验在 Windows / macOS 上完全可用；把 woff2 文件丢进来则在任何 Linux/Docker
环境下也能显示完全一致的字形。
