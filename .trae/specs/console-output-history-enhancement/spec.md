# 控制台输出优化与历史命令快速访问 Spec

## Why
当前控制台存在两个主要问题影响用户体验：
1. 重新打开控制台时会显示所有历史日志，导致界面混乱且难以聚焦最新操作
2. 缺少通过键盘上下键快速访问历史命令的功能（目前上下键仅用于补全导航）

## What Changes
- **日志智能折叠**：打开控制台时自动折叠旧日志，只显示最新的 N 条记录
- **虚拟滚动/懒加载**：只有当用户主动向上滚动时才加载和显示更多历史日志
- **历史命令键盘导航**：在没有补全建议时，使用上下箭头键快速浏览和选择历史命令
- **视觉提示**：当有更多历史日志可查看时，显示"向上滚动查看更多"的提示

## Impact
- Affected specs: integrate-built-in-console (扩展)
- Affected code:
  - `src/components/Console/ConsoleOutput.tsx` - 添加折叠和懒加载逻辑
  - `src/components/Console/ConsoleInput.tsx` - 添加历史命令键盘导航
  - `src/hooks/useConsole.ts` - 可能需要调整状态管理
  - `src/store/useConsoleStore.ts` - 可能需要添加新状态

## ADDED Requirements

### Requirement: 日志智能折叠
系统 SHALL 在控制台打开时只显示最近的 N 条日志（默认为 20 条），其余日志应被隐藏。

#### Scenario: 打开控制台显示最新日志
- **WHEN** 用户打开控制台
- **THEN** 系统只显示最近 20 条日志记录
- **AND** 如果有更多历史日志，底部显示"向上滚动查看更多"的提示

#### Scenario: 向上滚动加载更多日志
- **WHEN** 用户向上滚动到可见区域顶部
- **THEN** 系统自动加载并显示更早的 N 条日志（如 50 条）
- **AND** 平滑过渡，无闪烁

#### Scenario: 新命令执行时的行为
- **WHEN** 用户执行新命令
- **THEN** 新的输出立即显示在底部
- **AND** 自动滚动到底部
- **AND** 如果之前已展开旧日志，保持展开状态

### Requirement: 历史命令键盘导航
系统 SHALL 支持使用键盘上下箭头键快速浏览和选择历史命令。

#### Scenario: 使用上箭头键浏览上一条命令
- **WHEN** 输入框为空或光标在起始位置时按下 ArrowUp 键
- **AND** 没有显示自动补全建议
- **THEN** 输入框内容替换为上一条历史命令
- **AND** 继续按 ArrowUp 可继续向前浏览

#### Scenario: 使用下箭头键浏览下一条命令
- **WHEN** 正在浏览历史命令时按下 ArrowDown 键
- **THEN** 输入框内容替换为下一条历史命令
- **AND** 如果已经到达最新位置，清空输入框

#### Scenario: 编辑后恢复浏览位置
- **WHEN** 用户正在浏览历史命令并编辑了输入内容
- **THEN** 再次按 ArrowUp 时从最后浏览的位置继续
- **AND** 编辑的内容保存为临时状态，可通过 ArrowDown 恢复

#### Scenario: 与自动补全的优先级
- **WHEN** 显示自动补全建议时按下 ArrowUp/ArrowDown
- **THEN** 优先导航补全建议列表
- **AND** 关闭补全建议后才响应历史命令导航

## MODIFIED Requirements

### Requirement: ConsoleOutput 组件增强
修改 ConsoleOutput 组件以支持：
1. 初始渲染时只显示部分日志（最近 20 条）
2. 监听滚动事件，动态加载更多历史日志
3. 添加"查看更多"的视觉提示
4. 保持滚动位置的平滑性

### Requirement: ConsoleInput 组件增强
修改 ConsoleInput 组件的键盘事件处理：
1. 添加历史命令索引跟踪
2. 在没有补全建议时拦截 ArrowUp/ArrowDown 用于历史导航
3. 管理临时输入状态的保存和恢复
4. 确保与现有补全功能的兼容性

## REMOVED Requirements
无

## Implementation Notes
1. **性能考虑**：使用虚拟化或分页加载避免大量 DOM 节点
2. **用户体验**：动画过渡要流畅，避免突兀的跳转
3. **可配置性**：初始显示数量、每次加载数量等参数应可配置
4. **兼容性**：不影响现有的 Ctrl+R 搜索历史功能
