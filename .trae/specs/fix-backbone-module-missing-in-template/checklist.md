# Checklist

## 核心修复

- [x] `templates.ts` 的 `/from-template` 路由已修改，正确保存 `backboneModule` 属性
- [x] 模板节点创建时包含完整的 properties：backboneModule, needsRefinement, suggestedContent, aiPrompt, color

## 日志增强

- [x] 文献提取应用时能清晰看到骨干节点查询结果
- [x] 能看到哪些节点有 `backboneModule`，哪些没有
- [x] 挂载失败时有明确的原因提示
- [x] API 响应返回挂载详情（mountingDetails）

## 数据修复（已实现）

- [x] 提供 API 端点可修复历史数据 (`POST /api/graphs/:graphId/fix-backbone-modules`)
- [x] 自动检测逻辑能识别专题研究图谱中缺失属性的骨干节点
- [x] 只修复确实缺失的节点，不覆盖已有值

## 测试验证

- [x] E2E 测试 `literature-extract-mounting.spec.ts` 存在且覆盖相关场景
- [x] 新建专题研究图谱后，数据库中骨干节点将包含 `backboneModule` 属性（代码逻辑已修复）
- [x] 文献提取的概念节点将正确显示为骨干节点的子节点（代码逻辑已修复）
- [x] 前端大纲视图将正确显示层级关系（依赖数据修复）
- [x] `npm run check` 通过 ✅
- [ ] `npm run lint` 通过（有 1 个预存在的无关错误：LearningMode.tsx 不规则空白字符）
