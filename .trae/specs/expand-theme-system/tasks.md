# Tasks

- [x] Task 1: 创建主题预设配置文件 `src/config/themePresets.ts`
  - [x] SubTask 1.1: 定义 ThemePreset 类型和 ThemePresetConfig 接口
  - [x] SubTask 1.2: 定义 7 个主题预设的完整色阶数据（default/ocean/forest/sunset/lavender/rose/midnight），每个包含 50-900 共 10 个色阶
  - [x] SubTask 1.3: 定义每个预设的辅助颜色（accent、surface 变量等）
  - [x] SubTask 1.4: 导出 THEME_PRESETS 常量和辅助函数（getThemePreset、getAvailablePresets）

- [x] Task 2: 重构 `src/hooks/common/useTheme.ts`
  - [x] SubTask 2.1: 扩展 ThemeContextType 接口，新增 themePreset、setThemePreset、availablePresets 字段
  - [x] SubTask 2.2: 在 ThemeProvider 中添加 themePreset 状态管理（localStorage 持久化）
  - [x] SubTask 2.3: 在 useEffect 中将 themePreset 对应的 class 应用到 `<html>` 元素
  - [x] SubTask 2.4: 保留所有原有字段和行为的向后兼容

- [x] Task 3: 更新 CSS 变量定义
  - [x] SubTask 3.1: 在 `src/index.css` 中为每个主题预设定义 `:root.theme-xxx` 选择器下的 CSS 变量（亮色变体）
  - [x] SubTask 3.2: 在 `src/index.css` 中为每个主题预设定义 `.dark.theme-xxx` 选择器下的 CSS 变量（暗色变体）
  - [x] SubTask 3.3: 更新 `src/styles/scheduler.css`，为主题预设添加变量覆盖

- [x] Task 4: 更新 Tailwind 配置 `tailwind.config.js`
  - [x] SubTask 4.1: 将 primary 色板改为引用 CSS 变量（如 `var(--primary-50)` 到 `var(--primary-900)`）

- [x] Task 5: 更新 Settings 页面 `src/pages/Settings.tsx`
  - [x] SubTask 5.1: 在外观设置区域下方新增主题预设选择器 UI
  - [x] SubTask 5.2: 每个预设以色块卡片展示，包含名称和主色调预览圆点
  - [x] SubTask 5.3: 当前选中预设卡片有高亮边框

- [x] Task 6: 更新 i18n 翻译文件
  - [x] SubTask 6.1: 在 `src/i18n/locales/zh-CN.json` 中添加主题预设名称翻译
  - [x] SubTask 6.2: 在 `src/i18n/locales/en-US.json` 中添加主题预设名称翻译

- [x] Task 7: 更新共享类型 `shared/types/styles.ts`
  - [x] SubTask 7.1: 更新 ThemePreset 类型定义，扩展为 7 个预设值

# Task Dependencies
- [Task 2] depends on [Task 1] — ThemeProvider 需要引用 themePresets 配置
- [Task 3] depends on [Task 1] — CSS 变量需要与 themePresets 配置中的色值一致
- [Task 4] depends on [Task 3] — Tailwind 配置依赖 CSS 变量已定义
- [Task 5] depends on [Task 2] — Settings 页面需要使用新的 useTheme 接口
- [Task 5] depends on [Task 6] — Settings 页面需要 i18n 翻译
- [Task 6] depends on [Task 7] — i18n 翻译需要知道预设名称列表
