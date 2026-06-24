# Tasks

- [x] Task 1: 迁移 .replace() 旧风格组件为 cn()（3 个文件）
  - [x] SubTask 1.1: 迁移 Button.tsx — 将 variantStyles/sizeStyles/fullWidth/className 拼接改为 cn() 调用
  - [x] SubTask 1.2: 迁移 FormError.tsx — 将模板字符串 + .replace() 改为 cn() 调用
  - [x] SubTask 1.3: 迁移 FormField.tsx — 将模板字符串 + .replace() 改为 cn() 调用

- [x] Task 2: 迁移裸模板字符串组件为 cn()（16 个文件）
  - [x] SubTask 2.1: 迁移 AudioVisualizer.tsx
  - [x] SubTask 2.2: 迁移 CodeBlock.tsx
  - [x] SubTask 2.3: 迁移 ConfirmationModal.tsx
  - [x] SubTask 2.4: 迁移 FocusTimer.tsx
  - [x] SubTask 2.5: 迁移 GlobalErrorBoundary.tsx
  - [x] SubTask 2.6: 迁移 GlobalSearch.tsx
  - [x] SubTask 2.7: 迁移 LazyImage.tsx
  - [x] SubTask 2.8: 迁移 MessageBar.tsx
  - [x] SubTask 2.9: 迁移 OfflineIndicator.tsx
  - [x] SubTask 2.10: 迁移 OfflineStatusBar.tsx
  - [x] SubTask 2.11: 迁移 PomodoroCycleBar.tsx
  - [x] SubTask 2.12: 迁移 ShortcutHelpPanel.tsx
  - [x] SubTask 2.13: 迁移 SSEStatusIndicator.tsx
  - [x] SubTask 2.14: 迁移 SyncStatusIndicator.tsx
  - [x] SubTask 2.15: 迁移 TagSystem.tsx
  - [x] SubTask 2.16: 迁移 VirtualList.tsx

- [x] Task 3: 验证迁移结果
  - [x] SubTask 3.1: 运行 TypeScript 类型检查确认无报错
  - [x] SubTask 3.2: 确认 common 目录不再有 .replace(/\s+/g, ' ').trim() 用法
  - [x] SubTask 3.3: 确认 common 目录所有动态 className 均使用 cn()

# Task Dependencies
- Task 2 依赖 Task 1（先完成 .replace() 迁移作为参考模式）
- Task 3 依赖 Task 1 和 Task 2
- SubTask 2.x 之间无依赖，可并行执行
