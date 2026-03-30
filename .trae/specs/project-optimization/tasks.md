# Tasks

## 阶段 1：代码质量优化

- [x] Task 1.1: 清理前端 console 日志调用
  - [x] 审计 `src/` 目录下的 console.log/warn/error/info 调用
  - [x] 移除调试用的 console.log
  - [x] 保留必要的 console.warn/error，或替换为 logger 工具
  - [x] 更新 ESLint 规则禁止 console.log（允许 warn/error）

- [x] Task 1.2: 清理后端 console 日志调用
  - [x] 审计 `api/` 目录下的 console 调用
  - [x] 将所有日志调用替换为 `logger` 工具
  - [x] 确保生产环境日志格式正确

- [x] Task 1.3: 减少 any 类型使用并更新 ESLint 规则
  - [x] 审计使用 `any` 类型的文件
  - [x] 为高频使用的 any 类型定义具体接口
  - [x] 更新 ESLint 规则（保持 warn 级别，逐步修复）

## 阶段 2：TypeScript 配置加强

- [x] Task 2.1: 启用更严格的 TypeScript 选项
  - [x] 启用 `noImplicitOverride`
  - [x] 修复因新选项产生的类型错误
  - [x] 运行 `npm run check` 确保无错误
  - [ ] 启用 `noImplicitReturns`（暂缓，需要大量修改）

## 阶段 3：测试覆盖提升

- [ ] Task 3.1: 增加单元测试
  - [ ] 为 `src/hooks/` 下的核心 hooks 添加测试
  - [ ] 为 `src/services/` 下的核心服务添加测试
  - [ ] 为 `src/utils/` 下的工具函数添加测试

- [ ] Task 3.2: 增加 E2E 测试
  - [ ] 添加图谱创建和编辑流程测试
  - [ ] 添加学习模式流程测试
  - [ ] 添加任务管理流程测试

## 阶段 4：CI/CD 流程完善

- [x] Task 4.1: 添加 Electron 构建验证
  - [x] 在 CI 中添加 `npm run check:electron` 步骤

- [x] Task 4.2: 添加依赖安全审计
  - [x] 在 CI 中添加 `npm audit` 步骤
  - [x] 配置审计失败时的处理策略（continue-on-error: true）

- [x] Task 4.3: 添加构建产物监控
  - [x] 记录构建产物大小
  - [x] 设置大小阈值告警

## 阶段 5：文档和规范

- [x] Task 5.1: 更新项目规则文档
  - [x] 添加日志使用规范
  - [x] 添加类型安全规范
  - [x] 添加测试编写规范
  - [x] 添加 CI/CD 流程说明

# Task Dependencies
- [Task 2.1] depends on [Task 1.3] (修复 any 类型后再启用严格选项)
- [Task 3.1] depends on [Task 1.1, Task 1.2] (清理日志后再添加测试)
- [Task 4.1, 4.2, 4.3] 可并行执行