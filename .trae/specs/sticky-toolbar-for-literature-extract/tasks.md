# Tasks

## Task 1: 创建固定顶部工具栏组件结构

- [x] 1.1 在 `LiteratureExtractPanel.tsx` 中新增 `renderStickyToolbar()` 方法
- [x] 1.2 实现工具栏的 sticky 定位样式（`sticky top-0 z-10` + backdrop-blur）
- [x] 1.3 将工具栏放置在面板 return 的最顶部（在来源卡片之前）
- [x] 1.4 添加条件渲染：输入阶段 vs 结果阶段显示不同按钮组

## Task 2: 实现输入阶段工具栏

- [x] 2.1 实现 `renderInputToolbar()` 方法
- [x] 2.2 添加"📋 粘贴"按钮 - 从剪贴板读取文本并填充到输入框
- [x] 2.3 添加"⚙️ 选项"按钮 - 切换高级选项展开/收起
- [x] 2.4 添加"❌ 关闭"按钮 - 调用 `onClose()`
- [x] 2.5 按钮使用统一样式，移动端只显示图标

## Task 3: 实现结果阶段工具栏

- [x] 3.1 实现 `renderResultToolbar()` 方法
- [x] 3.2 迁移现有按钮：查看/收起、重置、保存到图谱
- [x] 3.3 新增"📥 导出"按钮 - 导出 JSON 文件下载功能
- [x] 3.4 新增"📋 复制"按钮 - 复制摘要到剪贴板功能
- [x] 3.5 使用分隔线对按钮进行逻辑分组

## Task 4: 实现导出功能

- [x] 4.1 创建 `handleExport()` 方法
- [x] 4.2 构建导出数据结构（metadata + concepts + relations + timestamp）
- [x] 4.3 使用 Blob + URL.createObjectURL 实现文件下载
- [x] 4.4 文件名格式：`literature-extract-{timestamp}.json`

## Task 5: 实现复制功能

- [x] 5.1 创建 `handleCopySummary()` 方法
- [x] 5.2 格式化摘要文本（标题、作者、统计信息）
- [x] 5.3 调用 `navigator.clipboard.writeText()` 写入剪贴板
- [x] 5.4 显示短暂的 Toast 提示"已复制到剪贴板"

## Task 6: 实现粘贴功能

- [x] 6.1 创建 `handlePasteFromClipboard()` 方法
- [x] 6.2 调用 `navigator.clipboard.readText()` 读取内容
- [x] 6.3 自动切换到文本模式并填充内容
- [x] 6.4 错误处理：权限拒绝时显示友好提示

## Task 7: 重构现有布局

- [x] 7.1 删除旧的 `renderToolbar()` 方法（已迁移到 sticky toolbar）
- [x] 7.2 保留 `renderResultSummary()` 作为独立状态栏
- [x] 7.3 确保布局顺序：工具栏 → 来源卡片 → 状态栏(可选) → 内容区
- [x] 7.4 验证滚动时工具栏保持固定

## Task 8: 国际化支持

- [x] 8.1 在 zh-CN.json 中添加新工具栏相关文案
- [x] 8.2 在 en-US.json 中添加对应英文翻译
- [x] 8.3 包括：粘贴、选项、导出、复制、已复制提示等

## Task 9: 测试与验证

- [x] 9.1 TypeScript 类型检查通过
- [x] 9.2 ESLint 检查通过
- [x] 9.3 输入阶段工具栏正确显示
- [x] 9.4 结果阶段工具栏正确显示
- [x] 9.5 滚动时工具栏保持固定可见
- [x] 9.6 导出功能正常工作
- [x] 9.7 复制功能正常工作
- [x] 9.8 粘贴功能正常工作
- [x] 9.9 移动端响应式正常

# Task Dependencies

- [Task 2, 3] depends on [Task 1]
- [Task 4, 5, 6] depends on [Task 3]
- [Task 7] depends on [Task 2, 3]
- [Task 8] can be parallel with [Task 1-7]
- [Task 9] depends on all other tasks
