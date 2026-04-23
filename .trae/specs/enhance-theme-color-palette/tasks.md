# Tasks

- [x] Task 1: 扩展类型定义和接口
  - [x] SubTask 1.1: 在 `src/types/index.ts` 中扩展 ThemePresetConfig 接口，新增 secondary 和 tertiary 色阶字段
  - [x] SubTask 1.2: 将 previewColor 改为 previewColors 数组类型

- [x] Task 2: 更新主题预设配置
  - [x] SubTask 2.1: 为每个主题预设定义 secondary 色阶（相近色）
  - [x] SubTask 2.2: 为每个主题预设定义 tertiary 色阶（协调色）
  - [x] SubTask 2.3: 更新 previewColors 为三色数组
  - [x] SubTask 2.4: 确保色系颜色在色轮上相邻，视觉协调

- [x] Task 3: 扩展 CSS 变量定义
  - [x] SubTask 3.1: 在 `src/index.css` 中为每个主题预设添加 `--secondary-*` 变量（亮色变体）
  - [x] SubTask 3.2: 在 `src/index.css` 中为每个主题预设添加 `--tertiary-*` 变量（亮色变体）
  - [x] SubTask 3.3: 在 `src/index.css` 中为每个主题预设添加暗色模式的 secondary 变量
  - [x] SubTask 3.4: 在 `src/index.css` 中为每个主题预设添加暗色模式的 tertiary 变量

- [x] Task 4: 更新 Tailwind 配置
  - [x] SubTask 4.1: 在 `tailwind.config.js` 中添加 secondary 颜色配置（引用 CSS 变量）
  - [x] SubTask 4.2: 在 `tailwind.config.js` 中添加 tertiary 颜色配置（引用 CSS 变量）

- [x] Task 5: 更新 Settings 页面主题选择器
  - [x] SubTask 5.1: 修改主题预览组件，显示三个色块而非单一色块
  - [x] SubTask 5.2: 调整布局，确保三个色块水平排列且美观
  - [x] SubTask 5.3: 更新选中状态的边框样式

- [x] Task 6: 更新 useTheme hook
  - [x] SubTask 6.1: 更新 availablePresets 返回值，包含 previewColors 数组

- [x] Task 7: 测试和验证
  - [x] SubTask 7.1: 运行 `npm run lint` 确保代码规范
  - [x] SubTask 7.2: 运行 `npm run check` 确保类型正确
  - [x] SubTask 7.3: 手动测试各主题色系切换效果

# Task Dependencies
- [Task 2] depends on [Task 1] — 配置更新需要类型定义先完成
- [Task 3] depends on [Task 2] — CSS 变量需要与配置中的色值一致
- [Task 4] depends on [Task 3] — Tailwind 配置依赖 CSS 变量已定义
- [Task 5] depends on [Task 6] — Settings 页面需要使用更新后的 useTheme 接口
- [Task 7] depends on [Task 1-6] — 测试需要在所有实现完成后进行
