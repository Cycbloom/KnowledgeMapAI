# 拆分 i18n 翻译文件 Spec

## Why

当前项目的翻译文件 `src/i18n/locales/en-US.json`（4180 行）和 `zh-CN.json`（4197 行）均为单一巨型 JSON 文件，包含 51 个顶层命名空间。这种结构带来三个维护痛点：

1. **定位困难**：修改某功能文案时需在 4000+ 行文件中搜索对应 key
2. **合并冲突高发**：多人同时修改不同功能文案时极易在同一文件产生冲突
3. **认知负担重**：浏览文件结构时被无关 namespace 干扰

业界标准做法是按顶层命名空间拆分为独立文件，通过 index.ts 合并导入。此方案对运行时零影响（key 路径不变），仅改善开发体验。

## What Changes

- **拆分翻译文件结构**：将 `src/i18n/locales/en-US.json` 拆分为 `src/i18n/locales/en-US/` 目录下 51 个独立 JSON 文件（每个对应一个顶层 namespace）
- **拆分中文翻译文件**：将 `src/i18n/locales/zh-CN.json` 同样拆分为 `src/i18n/locales/zh-CN/` 目录下 51 个独立 JSON 文件
- **新增合并入口**：在每个语言目录下创建 `index.ts`，导入所有 namespace 文件并合并为完整 translation 对象导出
- **更新 i18n 入口**：修改 `src/i18n/index.ts` 的 import 路径，从导入单个 JSON 文件改为导入语言目录的 index.ts
- **删除旧文件**：移除原有的 `en-US.json` 和 `zh-CN.json` 单体文件

## Impact

- **Affected specs**: 无（纯文件组织重构，不改变翻译内容或运行时行为）
- **Affected code**:
  - `src/i18n/locales/en-US.json`（删除，拆分为 `en-US/` 目录）
  - `src/i18n/locales/zh-CN.json`（删除，拆分为 `zh-CN/` 目录）
  - `src/i18n/locales/en-US/index.ts`（新建，合并所有英文 namespace）
  - `src/i18n/locales/zh-CN/index.ts`（新建，合并所有中文 namespace）
  - `src/i18n/locales/en-US/*.json`（新建，51 个 namespace 文件）
  - `src/i18n/locales/zh-CN/*.json`（新建，51 个 namespace 文件）
  - `src/i18n/index.ts`（修改 2 行 import 路径）
- **不受影响**：
  - 所有 100 个使用 `useTranslation` 的组件文件（key 路径如 `t('dashboard.title')` 完全不变）
  - i18next 配置逻辑（resources 结构不变）
  - 语言检测/切换逻辑

## ADDED Requirements

### Requirement: 按命名空间拆分翻译文件

系统 SHALL 将翻译文件按顶层命名空间拆分为独立 JSON 文件，每个文件仅包含一个顶层 namespace 的内容。文件名 MUST 与 namespace 名称一致。

#### Scenario: 拆分后的目录结构
- **WHEN** 开发者查看 `src/i18n/locales/en-US/` 目录
- **THEN** 看到 51 个 JSON 文件（如 `dashboard.json`、`study.json`、`settings.json` 等）和一个 `index.ts`，无单体 `en-US.json`

#### Scenario: 单个 namespace 文件内容
- **WHEN** 开发者打开 `src/i18n/locales/en-US/dashboard.json`
- **THEN** 文件内容为 `dashboard` namespace 的完整内容，顶层 key 不再包含 `dashboard` 前缀（即文件内容是 dashboard 对象的内部结构）

#### Scenario: 翻译 key 路径不变
- **WHEN** 组件调用 `t('dashboard.title')` 或 `t('study.review.nextReview')`
- **THEN** 翻译结果与拆分前完全一致，组件代码无需任何修改

### Requirement: 语言目录合并入口

每个语言目录（`en-US/`、`zh-CN/`）SHALL 提供 `index.ts` 文件，该文件导入目录下所有 namespace JSON 并合并为单一 translation 对象导出。

#### Scenario: index.ts 合并导出
- **WHEN** `src/i18n/index.ts` 导入语言资源
- **THEN** 通过 `import enUS from './locales/en-US'` 获取完整 translation 对象，结构与原 `en-US.json` 完全一致

#### Scenario: namespace 文件新增
- **WHEN** 未来新增一个翻译 namespace（如 `newFeature.json`）
- **THEN** 开发者只需在对应语言目录新建 JSON 文件并在 `index.ts` 追加一行 import + 合并即可

### Requirement: 中英文 namespace 对齐

拆分后的 `en-US/` 和 `zh-CN/` 目录 MUST 包含完全相同的 namespace 文件列表，确保每个翻译 key 在两种语言中都有对应。

#### Scenario: 文件列表一致性
- **WHEN** 对比 `en-US/` 和 `zh-CN/` 目录的文件名列表
- **THEN** 两个目录的 JSON 文件名完全一致（均为 51 个同名文件）

## MODIFIED Requirements

### Requirement: i18n 入口文件导入路径

`src/i18n/index.ts` SHALL 从语言目录导入 translation 资源，而非从单体 JSON 文件导入。

#### Scenario: 导入语句
- **WHEN** 查看 `src/i18n/index.ts` 第 5-6 行
- **THEN** 导入语句为 `import zhCN from './locales/zh-CN'` 和 `import enUS from './locales/en-US'`（无 `.json` 后缀，指向目录的 index.ts）

## REMOVED Requirements

### Requirement: 单体翻译 JSON 文件

**Reason**: `src/i18n/locales/en-US.json` 和 `zh-CN.json` 单体文件包含 51 个 namespace、4000+ 行，定位困难且易产生合并冲突，不符合可维护性要求。
**Migration**: 内容已完整迁移至对应语言目录下的 namespace 文件，原文件删除后无功能影响。
