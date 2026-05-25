# 实现检查清单

## 代码修改验证
- [ ] `api/routes/literature.ts` 第954行的 SELECT 查询包含 `level` 字段
- [ ] 遍历 backboneNodes 时检查 `gn.level === 'root' || gn.level === 'core'`
- [ ] 非核心级别节点被跳过并记录 warn 日志
- [ ] 同模块多候选节点时优先选择 core > root
- [ ] 最终选择的骨干节点信息被记录到日志

## 功能验证
- [ ] 文献提取后新概念的 parentId 指向骨干模块的 core/root 节点
- [ ] 不再出现连接到 normal/leaf 级别子节点的情况
- [ ] 日志输出清晰显示每个模块的最终选择结果

## 代码质量
- [ ] TypeScript 类型检查通过（`npm run check:incremental`）
- [ ] ESLint 检查通过（`npm run lint`）
- [ ] 无新增的 `any` 类型使用
