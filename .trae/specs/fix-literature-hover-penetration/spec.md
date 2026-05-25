# 文献元数据卡片 Hover 穿透修复 Spec

## Why

专题研究文献视图中，鼠标悬停文献条目会弹出 `LiteratureHoverCard`（fixed 定位），但用户无法将鼠标移到弹出卡片上——鼠标一旦离开条目，`GraphOutline.tsx` 的 `onMouseLeave` **立即**将 `hoveredLiterature` 置 null，导致弹出卡片从 DOM 中被移除。

之前的修复方向错误：在 `LiteratureMetadataCard` 子组件内部加延迟无效，因为**根因在父组件 `GraphOutline.tsx` 的立即清除逻辑**。

## What Changes

- **修改 `GraphOutline.tsx`**：文献条目的 `onMouseLeave` 改为延迟隐藏（~200ms），`onMouseEnter` 取消延迟定时器
- **保持 `LiteratureMetadataCard.tsx` 已有的复制功能不变**（已实现的复制按钮、formatCitationText、国际化等）
- 清理 `LiteratureMetadataCard.tsx` 中之前添加的无用延迟逻辑（因为真正控制显示/隐藏的是 GraphOutline）

## Impact

- Affected code:
  - `src/components/GraphEditor/panels/GraphOutline.tsx` — 核心修复点
  - `src/components/LiteratureExtract/LiteratureMetadataCard.tsx` — 清理无用代码
- 不影响其他使用 LiteratureMetadataCard 的场景

## ADDED Requirements

### Requirement: Hover 延迟隐藏

系统 SHALL 在用户鼠标离开文献条目时不立即隐藏弹出卡片，而是等待一小段时间以允许鼠标移动到卡片上。

#### Scenario: 鼠标从条目移动到弹出卡片

- **WHEN** 用户鼠标悬停在文献条目上，弹出卡片显示后，鼠标开始向弹出卡片移动
- **THEN** 鼠标经过条目边界时卡片不立即消失
- **AND** 如果鼠标在 200ms 内进入弹出卡片区域，卡片保持显示
- **AND** 用户可以在弹出卡片中点击复制按钮

#### Scenario: 鼠标真正离开

- **WHEN** 用户鼠标离开文献条目且 200ms 内未进入任何相关区域
- **THEN** 弹出卡片平滑隐藏

### Requirement: 复制功能

弹出卡片 SHALL 提供一键复制论文引用信息的功能。

- **WHEN** 用户点击复制按钮
- **THEN** 论文信息（作者、年份、标题、期刊、DOI）格式化为引用文本并复制到剪贴板
- **AND** 按钮显示"已复制"反馈 2 秒后恢复

## MODIFIED Requirements

### Requirement: 文献条目 hover 行为

`GraphOutline.tsx` 中文献分组的 `onMouseLeave` 回调 SHALL 使用延迟隐藏模式替代立即隐藏：
1. 启动 200ms 定时器
2. 定时器到期后才设置 `hoveredLiterature=null`
3. 如果定时器期间再次触发 `onMouseEnter`，取消定时器
