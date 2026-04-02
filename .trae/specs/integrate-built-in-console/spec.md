# 内置控制台功能 Spec

## Why

作为程序员用户，在使用 KnowledgeMap 时可能需要快速执行一些高级操作，如批量处理数据、调试功能、快速访问系统功能等。通过内置控制台，可以提供一个类似终端的交互界面，让用户通过命令行方式快速完成各种操作，而无需通过 UI 层层点击。

## What Changes

- 新增控制台组件，支持快捷键唤起（类似 VS Code 命令面板）
- 实现命令解析引擎，支持命令行风格的输入格式
- 提供图谱操作、任务管理、AI 功能、数据导入导出等核心命令
- 实现命令历史记录功能，支持搜索和重新执行
- 实现分级权限控制，危险操作需要二次确认

## Impact

- Affected specs: 无（新功能）
- Affected code:
  - `src/components/` - 新增控制台组件
  - `src/hooks/` - 新增控制台相关 hooks
  - `src/services/` - 可能需要新增命令执行服务
  - `src/config/shortcuts.ts` - 新增快捷键配置

## ADDED Requirements

### Requirement: 控制台 UI 组件

系统应提供一个可快捷键唤起的控制台界面。

#### Scenario: 快捷键唤起控制台
- **WHEN** 用户按下预设快捷键（如 `Ctrl+Shift+P` 或 `Cmd+Shift+P`）
- **THEN** 控制台面板从屏幕顶部/底部弹出，获得焦点

#### Scenario: 关闭控制台
- **WHEN** 用户按下 `Escape` 键或点击控制台外部区域
- **THEN** 控制台面板关闭

#### Scenario: 控制台界面布局
- **GIVEN** 控制台已打开
- **THEN** 显示命令输入框、命令历史列表、输出区域

### Requirement: 命令解析引擎

系统应支持命令行风格的命令输入和解析。

#### Scenario: 命令格式
- **GIVEN** 用户在控制台输入命令
- **WHEN** 输入格式为 `command [subcommand] [options] [arguments]`
- **THEN** 系统正确解析命令、子命令、选项和参数

#### Scenario: 命令自动补全
- **GIVEN** 用户正在输入命令
- **WHEN** 用户按下 `Tab` 键
- **THEN** 系统显示可用的命令/选项补全建议

#### Scenario: 命令帮助
- **GIVEN** 用户输入 `help [command]` 或 `command --help`
- **THEN** 显示该命令的使用说明和参数列表

### Requirement: 图谱操作命令

系统应提供图谱相关的控制台命令。

#### Scenario: 创建图谱
- **WHEN** 用户输入 `graph create --name "图谱名称" --description "描述"`
- **THEN** 创建新图谱并返回图谱 ID

#### Scenario: 删除图谱
- **WHEN** 用户输入 `graph delete <graph-id>`
- **THEN** 显示确认对话框，确认后删除图谱

#### Scenario: 列出图谱
- **WHEN** 用户输入 `graph list [--page 1] [--limit 10]`
- **THEN** 显示图谱列表

#### Scenario: 批量操作节点
- **WHEN** 用户输入 `node batch --graph <graph-id> --action create --file nodes.json`
- **THEN** 从文件批量创建节点

### Requirement: 任务管理命令

系统应提供任务相关的控制台命令。

#### Scenario: 创建任务
- **WHEN** 用户输入 `task create --title "任务标题" --priority high`
- **THEN** 创建新任务并返回任务 ID

#### Scenario: 批量修改任务状态
- **WHEN** 用户输入 `task status --ids <id1,id2,id3> --status completed`
- **THEN** 批量更新任务状态

#### Scenario: 查询任务
- **WHEN** 用户输入 `task query --status pending --due today`
- **THEN** 显示符合条件的任务列表

### Requirement: AI 功能命令

系统应提供 AI 相关的控制台命令。

#### Scenario: AI 分析图谱
- **WHEN** 用户输入 `ai analyze --graph <graph-id> --type structure`
- **THEN** 调用 AI 分析图谱结构并显示结果

#### Scenario: AI 生成内容
- **WHEN** 用户输入 `ai generate --type summary --node <node-id>`
- **THEN** 调用 AI 生成节点摘要

#### Scenario: AI 批量处理
- **WHEN** 用户输入 `ai batch --graph <graph-id> --operation expand`
- **THEN** 批量调用 AI 扩展图谱节点

### Requirement: 数据导入导出命令

系统应提供数据导入导出的控制台命令。

#### Scenario: 导出图谱
- **WHEN** 用户输入 `export graph <graph-id> --format json --output ./exports/`
- **THEN** 导出图谱数据到指定路径

#### Scenario: 导入数据
- **WHEN** 用户输入 `import --file ./data/nodes.json --type nodes`
- **THEN** 从文件导入数据

#### Scenario: 备份数据库
- **WHEN** 用户输入 `backup create --tables graphs,nodes,tasks`
- **THEN** 创建指定表的备份

### Requirement: 命令历史记录

系统应保存命令执行历史。

#### Scenario: 查看历史
- **GIVEN** 控制台已打开
- **WHEN** 用户按上/下方向键
- **THEN** 遍历历史命令

#### Scenario: 搜索历史
- **WHEN** 用户在输入框输入部分命令后按 `Ctrl+R`
- **THEN** 进入历史搜索模式，显示匹配的历史命令

#### Scenario: 清除历史
- **WHEN** 用户输入 `history clear`
- **THEN** 清除所有命令历史

### Requirement: 分级权限控制

系统应对危险操作实施权限控制。

#### Scenario: 危险操作确认
- **WHEN** 用户执行删除、批量修改等危险操作
- **THEN** 显示确认对话框，需要用户确认才能执行

#### Scenario: 权限级别说明
- **GIVEN** 命令有不同的权限级别
- **WHEN** 用户查看命令帮助
- **THEN** 显示该命令的权限级别（safe/warning/danger）

#### Scenario: 操作日志
- **WHEN** 用户执行任何控制台命令
- **THEN** 记录操作日志，包括命令内容、执行时间、结果

### Requirement: 输出格式化

系统应提供清晰的命令输出格式。

#### Scenario: 成功输出
- **WHEN** 命令执行成功
- **THEN** 显示绿色成功标识和结果数据

#### Scenario: 错误输出
- **WHEN** 命令执行失败
- **THEN** 显示红色错误标识和错误信息

#### Scenario: 表格输出
- **WHEN** 命令返回列表数据
- **THEN** 以表格形式展示数据

#### Scenario: JSON 输出
- **WHEN** 用户添加 `--json` 选项
- **THEN** 以 JSON 格式输出结果

## Technical Design

### 组件结构

```
src/components/Console/
├── Console.tsx              # 主控制台组件
├── ConsoleInput.tsx         # 命令输入组件
├── ConsoleOutput.tsx        # 输出显示组件
├── ConsoleHistory.tsx       # 历史记录组件
├── CommandAutocomplete.tsx  # 自动补全组件
└── index.ts
```

### 命令系统架构

```
src/services/console/
├── CommandRegistry.ts       # 命令注册中心
├── CommandParser.ts         # 命令解析器
├── commands/
│   ├── graph.ts            # 图谱命令
│   ├── task.ts             # 任务命令
│   ├── ai.ts               # AI 命令
│   ├── data.ts             # 数据导入导出命令
│   └── index.ts
├── types.ts                 # 类型定义
└── index.ts
```

### 命令类型定义

```typescript
interface Command {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
  options: CommandOption[];
  subcommands?: Command[];
  permission: 'safe' | 'warning' | 'danger';
  handler: (args: ParsedArgs, context: CommandContext) => Promise<CommandResult>;
}

interface CommandOption {
  name: string;
  alias?: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  default?: unknown;
}

interface CommandResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}
```

### 快捷键配置

```typescript
{
  console: {
    toggle: 'Ctrl+Shift+P' | 'Cmd+Shift+P',
    historyUp: 'ArrowUp',
    historyDown: 'ArrowDown',
    autocomplete: 'Tab',
    searchHistory: 'Ctrl+R',
    execute: 'Enter',
    close: 'Escape'
  }
}
```
