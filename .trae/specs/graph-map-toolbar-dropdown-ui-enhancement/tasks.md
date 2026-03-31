# Tasks

## UI优化实现

- [x] Task 1: 优化触发按钮样式
  - [x] SubTask 1.1: 添加渐变背景 (from-purple-500 to-indigo-600)
  - [x] SubTask 1.2: 添加阴影效果 (shadow-md)
  - [x] SubTask 1.3: 添加hover状态增强 (hover:shadow-lg, hover:from-purple-600)
  - [x] SubTask 1.4: 添加下拉箭头旋转动画
  - [x] SubTask 1.5: 统一桌面端和紧凑模式的按钮样式

- [x] Task 2: 优化下拉菜单容器样式
  - [x] SubTask 2.1: 增加圆角 (rounded-xl)
  - [x] SubTask 2.2: 增强阴影 (shadow-xl)
  - [x] SubTask 2.3: 优化边框颜色 (border-gray-100)
  - [x] SubTask 2.4: 添加内边距 (p-2)
  - [x] SubTask 2.5: 添加入场动画类

- [x] Task 3: 优化选项卡片样式
  - [x] SubTask 3.1: 添加图标容器 (w-8 h-8 rounded-lg)
  - [x] SubTask 3.2: 为两个选项设置不同的主题色 (紫色/靛蓝色)
  - [x] SubTask 3.3: 优化hover背景和边框效果
  - [x] SubTask 3.4: 调整内边距和间距 (p-3)
  - [x] SubTask 3.5: 添加过渡动画 (transition-all duration-150)

- [x] Task 4: 优化文字排版
  - [x] SubTask 4.1: 标题使用 font-semibold
  - [x] SubTask 4.2: 描述使用 text-xs 和 text-gray-500
  - [x] SubTask 4.3: 添加 leading-relaxed 改善行高

- [x] Task 5: 深色模式适配
  - [x] SubTask 5.1: 确保所有颜色都有 dark: 变体
  - [x] SubTask 5.2: 验证深色模式下的对比度
  - [x] SubTask 5.3: 验证阴影和边框在深色模式下可见

- [x] Task 6: 移动端适配
  - [x] SubTask 6.1: 更新移动端"更多"菜单中的分析选项样式
  - [x] SubTask 6.2: 确保移动端紧凑布局

## 验证

- [x] Task 7: 代码检查
  - [x] SubTask 7.1: 运行 `npm run check` 验证 TypeScript 类型
  - [x] SubTask 7.2: 运行 `npm run lint` 验证代码风格

---

# Task Dependencies

- Task 2-5 依赖 Task 1（需要先有触发按钮才能优化菜单）
- Task 6 依赖 Task 1-5（移动端适配需要桌面端样式完成）
- Task 7 依赖所有实现任务完成

# Parallelizable Work

以下任务可以并行执行：
- Task 1、Task 2、Task 3 可以一起实现（同一组件的不同部分）
- Task 4、Task 5 可以在 Task 3 完成后并行进行
