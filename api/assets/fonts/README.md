# 字体文件目录

由于中文字体文件较大（通常 >10MB），不便包含在 npm 包或通过简单脚本下载。
为了使 PDF 导出功能在所有平台（Linux/Docker）上正确显示中文，请手动下载中文字体文件并放置在此目录。

## 推荐字体

1. **Noto Sans SC** (Google/Adobe)
   - 下载地址: https://fonts.google.com/specimen/Noto+Sans+SC
   - 文件名示例: `NotoSansSC-Regular.ttf`

2. **文泉驿微米黑** (WenQuanYi Micro Hei)
   - 适用于 Linux 环境

## 配置

系统会自动扫描此目录下的 `.ttf`, `.otf`, `.ttc` 文件并优先使用。
如果没有找到，系统将尝试回退到 Windows 系统字体 (`C:\Windows\Fonts\...`)。
