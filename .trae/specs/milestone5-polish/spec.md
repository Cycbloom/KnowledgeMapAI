# Milestone 5 精益打磨 Spec

## Why
i18n key 存在严重不一致（statistics.json 中 en-US 有27个 key 而 zh-CN 仅6个），死代码占用维护成本，markdownUtils 命名产生歧义。

## What Changes
- **OPT-21 i18n key 编译时校验**：创建 CI 检查脚本，对比 en-US/zh-CN 所有 JSON 文件的 key 完整性
- **OPT-25 死代码清理**：删除 `useQuadrantViewState` hook（177行，零引用）
- **OPT-26 markdownUtils 重命名**：`src/utils/markdownUtils.ts` → `src/utils/markdownPreprocessor.ts`，消除与 `markdownParser.ts` 的命名混淆

## Impact
- Affected code: i18n JSON 文件、`src/hooks/useQuadrantViewState.ts`、`src/utils/markdownUtils.ts` + 3个导入文件
- 不影响任何运行时行为

## ADDED Requirements

### Requirement: i18n key 编译时校验
系统 SHALL 提供一个 Node.js 脚本，对比 en-US 和 zh-CN 所有 i18n JSON 文件的 key 集合，报告缺失和多余的 key。

#### Scenario: CI 检测到 key 缺失
- **WHEN** zh-CN 的 statistics.json 缺少 en-US 中的 key
- **THEN** 脚本以非零退出码退出，列出所有缺失 key

### Requirement: 死代码清理
系统 SHALL 移除无任何组件引用的 `useQuadrantViewState` hook 及其 barrel export。

### Requirement: markdownPreprocessor 命名
系统 SHALL 将 `markdownUtils.ts` 重命名为 `markdownPreprocessor.ts`，更新所有导入路径。

## REMOVED Requirements

### Requirement: OPT-17 PlanetView useFrame 优化
**Reason**: 已有10帧节流 + ref比较守卫，实际性能影响可忽略
**Migration**: 无需迁移

### Requirement: OPT-18 Vite 构建配置调优
**Reason**: Electron 主场景不敏感，manualChunks 策略已完善
**Migration**: 无需迁移

### Requirement: OPT-19 服务端并发能力增强
**Reason**: Electron 桌面应用单用户场景，PM2 集群完全不适配
**Migration**: 无需迁移

### Requirement: OPT-20 数据库迁移策略规范化
**Reason**: 模块化迁移是有意设计，当前阶段合理，已有 checksum 检测
**Migration**: 无需迁移

### Requirement: OPT-22 Debounce 模式统一
**Reason**: 3处实现属于不同模式，统一收益有限
**Migration**: 无需迁移

### Requirement: OPT-23 TaskCard 组合复用
**Reason**: 两个组件重叠<40%，组合复用反而降低可读性
**Migration**: 无需迁移

### Requirement: OPT-24 日志规范执行修复
**Reason**: 按当前规则 console.warn/error 允许使用，不存在违规
**Migration**: 无需迁移
