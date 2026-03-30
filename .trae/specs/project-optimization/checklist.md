# Checklist

## 代码质量

- [x] 前端 `src/` 目录无调试用 console.log 调用
- [x] 后端 `api/` 目录所有日志使用 logger 工具
- [x] ESLint 规则禁止 console.log（允许 warn/error）
- [x] `@typescript-eslint/no-explicit-any` 规则级别为 warn（逐步修复）
- [x] `@typescript-eslint/no-non-null-assertion` 规则级别为 warn（逐步修复）

## TypeScript 配置

- [x] `noImplicitOverride` 选项已启用
- [ ] `noImplicitReturns` 选项已启用（暂缓）
- [x] `npm run check` 无错误
- [x] `npm run check:electron` 无错误

## 测试覆盖

- [ ] 核心 hooks 有单元测试覆盖
- [ ] 核心服务有单元测试覆盖
- [ ] 核心工具函数有单元测试覆盖
- [ ] 图谱创建/编辑流程有 E2E 测试
- [ ] 学习模式有 E2E 测试
- [ ] 任务管理有 E2E 测试
- [ ] `npm test` 全部通过
- [ ] `npm run test:e2e` 全部通过

## CI/CD

- [x] CI 包含 Electron 类型检查步骤
- [x] CI 包含依赖安全审计步骤
- [x] CI 包含构建产物大小记录
- [x] CI 所有步骤通过

## 文档

- [x] 项目规则文档包含日志使用规范
- [x] 项目规则文档包含类型安全规范
- [x] 项目规则文档包含测试编写规范
- [x] 项目规则文档包含 CI/CD 流程说明

## 验证

- [x] `npm run lint` 无错误
- [x] `npm run check` 无错误
- [ ] `npm run build` 成功（需要验证）
- [ ] `npm run build:electron` 成功（需要验证）