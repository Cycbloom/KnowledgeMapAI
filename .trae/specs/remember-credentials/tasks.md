# Tasks

- [x] Task 1: 在登录页面添加"记住账号密码"复选框
  - [x] SubTask 1.1: 在 Login.tsx 中添加 rememberMe 状态
  - [x] SubTask 1.2: 在表单中添加复选框 UI 组件
  - [x] SubTask 1.3: 添加复选框的样式适配（支持暗色模式）

- [x] Task 2: 实现账号密码的存储和读取逻辑
  - [x] SubTask 2.1: 创建凭据存储工具函数（支持 Web 和 Electron 环境）
  - [x] SubTask 2.2: 实现保存凭据函数（登录成功时调用）
  - [x] SubTask 2.3: 实现读取凭据函数（页面加载时调用）
  - [x] SubTask 2.4: 实现清除凭据函数（取消勾选时调用）

- [x] Task 3: 集成存储逻辑到登录流程
  - [x] SubTask 3.1: 页面加载时自动填充已保存的凭据
  - [x] SubTask 3.2: 登录成功时根据复选框状态保存或清除凭据
  - [x] SubTask 3.3: 复选框状态变化时处理凭据存储

- [x] Task 4: 测试验证
  - [x] SubTask 4.1: 测试勾选后登录成功，凭据被保存
  - [x] SubTask 4.2: 测试页面刷新后凭据自动填充
  - [x] SubTask 4.3: 测试取消勾选后凭据被清除
  - [x] SubTask 4.4: 测试登录失败时不保存凭据

# Task Dependencies
- Task 2 依赖 Task 1（需要先有复选框状态）
- Task 3 依赖 Task 2（需要存储逻辑）
- Task 4 依赖 Task 3（需要完整功能后测试）
