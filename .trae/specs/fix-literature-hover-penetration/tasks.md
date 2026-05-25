# Tasks

- [x] Task 1: 修复 GraphOutline.tsx 中文献条目的 hover 穿透问题
  - [x] 在 GraphOutline.tsx 中添加 hideTimerRef 和延迟隐藏逻辑（200ms）
  - [x] 将文献分组的 onMouseLeave 改为延迟设置 hoveredLiterature=null
  - [x] 将文献分组的 onMouseEnter 改为取消隐藏定时器 + 立即显示
- [x] Task 2: 清理 LiteratureMetadataCard.tsx 中的无用代码
  - [x] 移除之前错误添加的 handleMouseEnter/handleMouseLeave 和 hideTimerRef（因为控制权在父组件）
  - [x] 保留复制功能相关代码（handleCopy、formatCitationText、copied state）
- [x] Task 4: 修复 LiteratureHoverCard 自身的 hover 保持显示
  - [x] 在 LiteratureHoverCard 组件中添加 onMouseEnter/onMouseLeave props
  - [x] 在 GraphOutline.tsx 中给 LiteratureHoverCard 传入 onHover 回调以取消隐藏定时器
- [x] Task 3: 验证修复效果
  - [x] 运行 npm run check 确保类型检查通过
  - [x] 运行 npm run lint 确保代码规范通过

# Task Dependencies
- [Task 4] 依赖 [Task 1]
- [Task 3] 依赖 [Task 1]、[Task 2]
