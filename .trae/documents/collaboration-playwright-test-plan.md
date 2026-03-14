# 协作功能完善与 Playwright 测试计划

## 背景

协作功能的基础实现已完成，包括：
- 数据库层：`graph_collaborators` 表、RLS 策略
- 后端 API：协作者服务、路由
- 前端组件：ShareDialog、CollaboratorList 等

需要完成的工作：
1. 确保数据库变更已应用
2. 在图谱编辑页面集成分享按钮
3. 使用 Playwright 编写 E2E 测试

## 实施步骤

### 阶段 1：数据库验证与重置

**Task 1.1: 重置数据库**
- 运行 `npx supabase db reset` 应用 schema 变更
- 验证 `graph_collaborators` 表已创建
- 验证 RLS 策略已生效

### 阶段 2：前端集成

**Task 2.1: 在 GraphEditor 页面添加分享按钮**
- 在 GraphToolbar 或页面头部添加分享按钮
- 点击按钮打开 ShareDialog
- 传递必要的参数（graphId, currentUserId, isOwner）

**Task 2.2: 显示协作者头像**
- 在图谱标题栏显示协作者头像列表
- 使用 Avatar 组件展示

**Task 2.3: 更新图谱列表显示协作图谱**
- 在 Home/Dashboard 页面显示用户作为协作者的图谱
- 使用不同的标识区分"我的图谱"和"协作图谱"

### 阶段 3：Playwright E2E 测试

**Task 3.1: 创建测试工具函数**
- 创建 `e2e/utils/auth.ts` - 登录辅助函数
- 创建 `e2e/utils/testData.ts` - 测试数据生成

**Task 3.2: 创建协作功能测试文件**
- 创建 `e2e/collaboration.spec.ts`

**Task 3.3: 编写测试用例**
1. **登录测试**
   - 用户可以正常登录

2. **创建图谱测试**
   - 用户可以创建新图谱
   - 图谱显示在列表中

3. **分享功能测试**
   - Owner 可以打开分享对话框
   - Owner 可以生成分享链接
   - 分享链接可以复制

4. **邀请协作者测试**
   - Owner 可以邀请协作者（通过邮箱）
   - 被邀请用户可以看到待处理邀请

5. **权限测试**
   - Owner 拥有完全控制权限
   - Editor 可以编辑节点和边
   - Viewer 只能查看

**Task 3.4: 运行测试**
- 运行 `npx playwright test --project=chromium`
- 检查测试报告
- 修复失败的测试

### 阶段 4：验证与清理

**Task 4.1: 运行 lint 和 typecheck**
- `npm run lint`
- `npm run check`

**Task 4.2: 手动验证**
- 启动开发服务器
- 手动测试协作流程

## 文件变更清单

### 需要修改的文件
1. `src/pages/GraphEditor.tsx` - 添加分享按钮
2. `src/pages/Home.tsx` 或 `src/pages/Dashboard.tsx` - 显示协作图谱

### 需要创建的文件
1. `e2e/utils/auth.ts` - 登录辅助函数
2. `e2e/utils/testData.ts` - 测试数据
3. `e2e/collaboration.spec.ts` - 协作功能测试

## 依赖关系
- Task 2.x 依赖 Task 1.1（数据库已就绪）
- Task 3.x 依赖 Task 2.x（前端集成完成）
- Task 4.x 依赖所有前置任务

## 风险与注意事项
1. 测试需要两个用户账号进行协作测试
2. 数据库重置会清除所有数据
3. Playwright 测试需要开发服务器运行
