# Tasks

- [x] Task 1: 新增暗色模式主题 CSS 变量
  - [x] SubTask 1.1: 在 `src/index.css` 中为 `default` 主题添加 `.dark.theme-default` 选择器下的暗色变体 CSS 变量
  - [x] SubTask 1.2: 为 `ocean` 主题添加 `.dark.theme-ocean` 暗色变体
  - [x] SubTask 1.3: 为 `forest` 主题添加 `.dark.theme-forest` 暗色变体
  - [x] SubTask 1.4: 为 `sunset` 主题添加 `.dark.theme-sunset` 暗色变体
  - [x] SubTask 1.5: 为 `lavender` 主题添加 `.dark.theme-lavender` 暗色变体
  - [x] SubTask 1.6: 为 `rose` 主题添加 `.dark.theme-rose` 暗色变体
  - [x] SubTask 1.7: 为 `midnight` 主题添加 `.dark.theme-midnight` 暗色变体

- [x] Task 2: 迁移页面组件（src/pages/）中的硬编码颜色为 primary-*
  - [x] SubTask 2.1-2.18: 所有 pages 目录下的硬编码颜色已迁移（27 个文件，1024 处替换）

- [x] Task 3: 迁移 GraphEditor 组件中的硬编码颜色为 primary-*
  - [x] SubTask 3.1-3.16: 所有 GraphEditor 目录下的硬编码颜色已迁移（25+ 个文件，560 处替换）

- [x] Task 4: 迁移 GraphMap 组件中的硬编码颜色为 primary-*
  - [x] SubTask 4.1-4.10: 所有 GraphMap 目录下的硬编码颜色已迁移（25 个文件，434 处替换）

- [x] Task 5: 迁移 Templates/Scheduler 组件中的硬编码颜色为 primary-*
  - [x] SubTask 5.1-5.14: 所有 Templates/Scheduler 目录下的硬编码颜色已迁移（64 个文件，1077 处替换）

- [x] Task 6: 迁移其他组件中的硬编码颜色为 primary-*
  - [x] SubTask 6.1-6.14: 所有其他组件目录下的硬编码颜色已迁移（82 个文件，1242 处替换）

- [x] Task 7: 更新 scheduler.css 中的硬编码颜色
  - [x] SubTask 7.1: 将 scheduler.css 中作为主交互色的硬编码 cyan 颜色替换为 `var(--primary-500)` 等 CSS 变量引用
  - [x] SubTask 7.2: 保留队列功能性颜色（q0/q1/q2）不变

- [x] Task 8: 验证迁移结果
  - [x] SubTask 8.1: 运行 `npm run lint` 确保无代码规范错误
  - [x] SubTask 8.2: 运行 `npm run check` 确保无类型错误
  - [x] SubTask 8.3: 全局搜索确认无遗漏的 blue-*/purple-*/indigo-*/cyan-* 主题色（排除排除项中列出的场景）

# Task Dependencies
- [Task 1] 无依赖，可最先执行
- [Task 2-7] 可并行执行，各文件独立迁移
- [Task 8] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7] — 验证需在所有迁移完成后进行
