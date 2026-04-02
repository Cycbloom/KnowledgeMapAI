# Tasks

- [x] Task 1: 创建控制台基础架构
  - [x] Task 1.1: 创建命令系统类型定义 `src/services/console/types.ts`
  - [x] Task 1.2: 实现命令解析器 `src/services/console/CommandParser.ts`
  - [x] Task 1.3: 实现命令注册中心 `src/services/console/CommandRegistry.ts`
  - [x] Task 1.4: 创建控制台服务入口 `src/services/console/index.ts`

- [x] Task 2: 实现控制台 UI 组件
  - [x] Task 2.1: 创建控制台主组件 `src/components/Console/Console.tsx`
  - [x] Task 2.2: 实现命令输入组件 `src/components/Console/ConsoleInput.tsx`
  - [x] Task 2.3: 实现输出显示组件 `src/components/Console/ConsoleOutput.tsx`
  - [x] Task 2.4: 实现历史记录组件 `src/components/Console/ConsoleHistory.tsx`
  - [x] Task 2.5: 实现自动补全组件 `src/components/Console/CommandAutocomplete.tsx`

- [x] Task 3: 实现核心命令
  - [x] Task 3.1: 实现图谱操作命令 `src/services/console/commands/graph.ts`
  - [x] Task 3.2: 实现任务管理命令 `src/services/console/commands/task.ts`
  - [x] Task 3.3: 实现 AI 功能命令 `src/services/console/commands/ai.ts`
  - [x] Task 3.4: 实现数据导入导出命令 `src/services/console/commands/data.ts`
  - [x] Task 3.5: 实现系统命令（help, history, clear）`src/services/console/commands/system.ts`

- [x] Task 4: 集成控制台到应用
  - [x] Task 4.1: 创建控制台状态管理 hook `src/hooks/useConsole.ts`
  - [x] Task 4.2: 配置控制台快捷键 `src/config/shortcuts.ts`
  - [x] Task 4.3: 在 Layout 组件中集成控制台 `src/components/Layout/Layout.tsx`
  - [x] Task 4.4: 实现全局快捷键监听

- [x] Task 5: 实现权限控制和日志
  - [x] Task 5.1: 实现危险操作确认对话框
  - [x] Task 5.2: 实现命令执行日志记录
  - [x] Task 5.3: 实现操作审计功能

- [x] Task 6: 测试和文档
  - [x] Task 6.1: 编写命令解析器单元测试
  - [x] Task 6.2: 编写控制台组件测试
  - [x] Task 6.3: 编写 E2E 测试验证控制台功能

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1, Task 2]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5]
