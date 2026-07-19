# 贡献指南

感谢您对 KnowledgeMap 项目的关注！本文档规范了贡献流程、分支策略、Commit Message 规范、PR 要求与代码审查流程。

> 本文档关注 **贡献流程**。开发环境搭建、测试命令详解与调试技巧请参考 [DEVELOPMENT.md](./DEVELOPMENT.md)。

## 1. 贡献流程

### 1.1 Fork 与 Clone

1. 在 GitHub 上 Fork 本仓库到自己的账号下
2. Clone Fork 后的仓库到本地：

   ```bash
   git clone https://github.com/<你的用户名>/knowledgemap-app.git
   cd knowledgemap-app
   ```

3. 添加上游仓库以便后续同步：

   ```bash
   git remote add upstream https://github.com/knowledgemap/knowledgemap-app.git
   ```

### 1.2 同步上游

在开始新工作前，确保本地分支与上游保持同步：

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

### 1.3 创建分支

```bash
git checkout -b feature/your-feature
```

### 1.4 提交更改

```bash
git add <相关文件>
git commit -m 'feat: add amazing feature'
```

> pre-commit 钩子会自动运行 `lint-staged` 增量检查（ESLint + TypeScript）。如需在提交前运行单元测试，请设置环境变量 `RUN_TESTS=1`。

### 1.5 推送并创建 PR

```bash
git push origin feature/your-feature
```

推送后，在 GitHub 上向 `main` 分支发起 Pull Request，填写 PR 描述模板（见 [第 4 节](#4-pr-要求)）。

## 2. 分支策略

| 分支 | 用途 |
|------|------|
| `main` | 稳定发布分支，仅通过 PR 合并，禁止直接推送 |
| `develop` | 开发集成分支（如使用），用于汇总各 feature 分支 |
| `feature/*` | 新功能分支，如 `feature/graph-export` |
| `fix/*` | Bug 修复分支，如 `fix/login-redirect` |
| `refactor/*` | 重构分支（无功能变化），如 `refactor/graph-service` |
| `docs/*` | 文档更新分支，如 `docs/api-readme` |
| `chore/*` | 杂项分支（依赖升级、配置调整等），如 `chore/upgrade-vite` |

**分支命名规范**：
- 使用 kebab-case（小写 + 连字符）
- 名称应简洁且具描述性
- 避免使用个人姓名或无关信息

## 3. Commit Message 规范

本项目采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### 3.1 Type 列表

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（无功能变化） |
| `docs` | 文档更新 |
| `test` | 测试相关 |
| `chore` | 杂项（依赖、配置） |
| `style` | 代码格式（不影响逻辑） |
| `perf` | 性能优化 |
| `ci` | CI/CD 相关 |
| `build` | 构建系统相关 |

### 3.2 Scope 建议

`scope` 为可选项，用于标识影响范围，建议使用模块名（如 `graph-editor`、`auth`、`scheduler`、`notes`、`study`、`quiz`、`api`、`electron`、`mobile`）。

### 3.3 示例

```
feat(graph-editor): add node drag-and-drop support

- Support dragging nodes to new positions
- Update edges automatically when nodes move
- Add undo/redo for position changes

Closes #123
```

```
fix(auth): resolve token refresh failure on expiry

Closes #456
```

```
docs(contributing): add PR template and code review guidelines
```

## 4. PR 要求

### 4.1 提交前检查

在创建 PR 前，请确保以下命令全部通过：

```bash
npm run check          # TypeScript 类型检查（增量）
npm run lint           # ESLint 检查（带缓存）
npm run test:run       # 单元测试（Vitest 单次运行）
```

> - pre-commit 钩子会自动运行 `lint-staged` 对暂存文件进行增量检查（ESLint + `tsc --build --incremental`）。
> - 完整的测试命令说明（覆盖率、E2E、CI 流程）请参考 [DEVELOPMENT.md](./DEVELOPMENT.md) 与 [docs/testing-guidelines.md](./docs/testing-guidelines.md)。

### 4.2 自审清单

在提交 PR 前，请逐项确认：

- [ ] 代码通过 `npm run check` 与 `npm run lint`
- [ ] 新功能有对应的单元/集成测试
- [ ] 没有引入 `any` 类型或非空断言 `!`
- [ ] 没有在 `src/` 使用 `console.log` / `console.info`（允许 `warn` / `error`）
- [ ] 没有在 `api/` 使用 `console.*`（必须使用 `logger` 工具）
- [ ] Commit message 遵循 Conventional Commits 规范
- [ ] PR 描述清晰，关联相关 issue
- [ ] 没有提交 `.env`、密钥或敏感信息

### 4.3 PR 描述模板

```markdown
## 变更说明
<!-- 简述本次变更的目的和内容 -->

## 变更类型
- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 重构 (refactor)
- [ ] 文档 (docs)
- [ ] 测试 (test)
- [ ] 杂项 (chore)

## 测试
- [ ] 已添加/更新单元测试
- [ ] 已添加/更新集成测试
- [ ] 已通过 `npm run check` 与 `npm run lint`
- [ ] 已通过 `npm run test:run`

## 关联 Issue
Closes #
```

## 5. 代码审查

### 5.1 审查流程

- CODEOWNERS 会自动分配 reviewer（详见 `.github/CODEOWNERS`）
- PR 至少需要 **1 名 reviewer** 批准后方可合并
- 重大变更（架构调整、核心模块修改）建议至少 2 名 reviewer 批准

### 5.2 审查标准

reviewer 会重点关注以下方面：

- 代码是否符合项目规范（见 `.trae/rules/`）
- 是否存在 `any` 类型、非空断言 `!`、`console.*` 违规
- 测试覆盖是否充分（关键模块 85%+，整体 70%+）
- 命名是否符合 [API 命名规范](./.trae/rules/api-naming-conventions.md)
- 是否有过度工程化（避免不必要的抽象与冗余的错误处理）
- 是否引入了安全风险（如硬编码密钥、SQL 注入、XSS 等）
- 数据库 schema 变更是否同步更新了 `shared/types/database.generated.ts`

### 5.3 提交者回应

- 收到 review 意见后，请逐条回复或修复
- 修复后推送新提交，避免 force push 抹去历史（除非 reviewer 要求）
- 讨论意见较长时，建议在 PR 评论中清晰分隔每个话题

## 6. Issue 报告

### 6.1 Bug Report 模板

```markdown
## Bug 描述
<!-- 简述 bug 现象 -->

## 复现步骤
1. 进入 '...'
2. 点击 '...'
3. 看到 '...'

## 期望行为
<!-- 应该发生什么 -->

## 实际行为
<!-- 实际发生了什么 -->

## 环境
- OS: [e.g. Windows 11, macOS 14]
- 应用版本: [e.g. 1.0.0]
- 是否桌面应用: [是/否]

## 截图/日志
<!-- 如有 -->
```

### 6.2 Feature Request 模板

```markdown
## 功能需求描述
<!-- 想要什么功能 -->

## 使用场景
<!-- 为什么需要这个功能 -->

## 建议方案
<!-- 如有实现思路 -->

## 是否愿意贡献
- [ ] 我愿意为这个功能提交 PR
```

### 6.3 Issue 提交建议

- 提交前请搜索现有 issue，避免重复
- Bug 报告请尽量提供完整的复现步骤与环境信息
- Feature Request 请清晰描述使用场景，避免过早讨论实现细节
