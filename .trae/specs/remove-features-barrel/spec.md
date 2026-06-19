# 移除 components/features 空壳抽象层 Spec

## Why
`src/components/features/` 目录仅包含一个 `index.ts` 文件，内容为 `export * from "../Scheduler/index"`，但全项目无任何文件从此目录导入。该目录是未完成的实验性重构残留，增加了认知负担且与项目整体组件导入模式不一致。

## What Changes
- 删除 `src/components/features/index.ts`
- 删除 `src/components/features/` 目录

## Impact
- Affected code: `src/components/features/index.ts`（唯一文件）
- 无任何消费者受影响（零导入）

## REMOVED Requirements
### Requirement: features 抽象层
**Reason**: 该抽象层从未被使用，无设计意图记录，与项目其他组件组的导入模式不一致（GraphEditor、Quiz、RAGChat、Console 等均直接导入，无 features 包装）
**Migration**: 无需迁移，无消费者
