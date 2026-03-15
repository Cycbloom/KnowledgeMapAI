# Tasks

- [x] Task 1: 修改 GraphEditor 组件，传递 isReadOnly 状态
  - [x] SubTask 1.1: 在 GraphEditor 中计算 isReadOnly 状态
  - [x] SubTask 1.2: 将 isReadOnly 传递到 GraphOutline 组件
  - [x] SubTask 1.3: 将 isReadOnly 传递到 NodeDetailSidebar 组件
  - [x] SubTask 1.4: 确保 isReadOnly 传递到其他相关子组件

- [x] Task 2: 修改 NodeDetailSidebar 组件支持只读模式
  - [x] SubTask 2.1: 添加 isReadOnly 属性到组件接口
  - [x] SubTask 2.2: 只读模式下隐藏编辑按钮
  - [x] SubTask 2.3: 只读模式下隐藏删除按钮
  - [x] SubTask 2.4: 只读模式下隐藏 AI 生成相关按钮（生成描述、深度分析、生成测验、后台生成）
  - [x] SubTask 2.5: 只读模式下隐藏学习相关按钮（开始学习、开始测试、生成卡片）
  - [x] SubTask 2.6: 在侧边栏顶部添加只读模式提示

- [x] Task 3: 修改 GraphOutline 组件支持只读模式
  - [x] SubTask 3.1: 添加 isReadOnly 属性到组件接口
  - [x] SubTask 3.2: 只读模式下隐藏添加节点按钮
  - [x] SubTask 3.3: 只读模式下隐藏批量操作按钮（批量删除、批量生成）
  - [x] SubTask 3.4: 只读模式下禁用多选模式
  - [x] SubTask 3.5: 只读模式下隐藏连接发现功能
  - [x] SubTask 3.6: 只读模式下禁用节点删除操作
- [x] Task 4: 修改 GraphEditor 处理只读模式下的节点操作
  - [x] SubTask 4.1: 只读模式下双击节点显示详情而非编辑
  - [x] SubTask 4.2: 只读模式下禁用节点拖拽
  - [x] SubTask 4.3: 只读模式下禁用边编辑
- [x] Task 5: 测试验证
  - [x] SubTask 5.1: 运行 npm run lint 和 npm run check
  - [x] SubTask 5.2: 手动测试只读模式下各组件功能
  - [x] SubTask 5.3: 验证编辑模式下功能正常

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4]
