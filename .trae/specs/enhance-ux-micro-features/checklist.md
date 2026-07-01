## Tier 1 检查点
- [x] AI 消息上显示 Copy 按钮，点击后复制文本并短暂显示"已复制"
- [x] 复习卡片界面支持 `1/2/3/4` 键触发 Again/Hard/Good/Easy，`Space/Enter` 触发 Good
- [x] 评分按钮显示对应数字键提示
- [x] 测验界面支持 `A/B/C/D` 或 `1/2/3/4` 键选择选项
- [x] 选项按钮显示对应字母/数字键提示
- [x] 测验进度栏显示 mm:ss 会话计时器
- [x] 最近一条 AI 消息显示 Regenerate 按钮，点击后重新生成回复
- [x] 选中节点后按 `Shift+F` 键，画布视图聚焦到选中节点（使用 Shift+F 避免与 toggleFocusMode 的 `f` 冲突）

## Tier 2 检查点
- [x] 工具栏显示当前缩放百分比，并提供 +/- 缩放按钮
- [x] 点击缩放百分比可重置为 100%
- [x] 工具栏提供"简化边/隐藏边标签"全局切换
- [x] 复习会话完成页显示卡片数/耗时/准确率统计
- [x] CardReviewView 显示未来 7 日复习量预测（明日/本周）
- [x] 测验中可标记题目为"待复查"，进度栏显示已标记数
- [x] QuizResult 显示总耗时/平均耗时/最快最慢题
- [x] AI 流式生成期间发送按钮切换为 Stop 按钮，点击可中止
- [x] Dashboard 提供排序下拉选择器（标题/创建时间/更新时间/节点数）
- [x] Dashboard 提供状态与时间范围筛选 chips

## Tier 3 检查点
- [x] 画布空白处 Shift+拖拽可框选多个节点，选中节点显示 multiSelected 样式（使用 Shift+drag 避免与平移冲突；Shift 按住时为追加选择）
- [x] 节点编辑侧边栏提供"编辑/预览"切换 toggle
- [x] 预览模式正确渲染 Markdown
- [x] 编辑模式显示格式工具栏（加粗/斜体/标题/链接/代码块），点击插入对应语法
- [x] 用户消息显示 Edit 按钮，点击可 inline 编辑
- [x] 编辑用户消息后重发，截断该消息之后的所有消息
- [x] Settings 页面显示图谱编辑器偏好设置区块
- [x] 图谱编辑器偏好持久化到 localStorage 并作为初始值生效
- [x] Settings 页面显示通知偏好设置区块
- [x] 通知偏好按类型静音，NotificationCenter 过滤已静音类型

## 全局验证
- [x] `npm run check:full` 通过
- [x] `npm run lint:full` 通过
- [x] 无新增 `any` 类型、无非空断言 `!`、前端无 `console.log/info`
