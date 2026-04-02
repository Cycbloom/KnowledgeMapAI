# 领域生成-从现有图谱拓展时领域关联修复 Spec

## Why

领域批量生成功能的「从现有图谱扩展」模式中，当用户选择了一个目标领域后，通过该功能新创建的图谱没有正确关联到用户选择的领域上。这是因为前端组件在调用批量创建 API 时，错误地传递了领域参数（使用了 `new` 模式的 `domain` 变量而非 `expand` 模式的 `expandDomain` 变量），导致后端创建图谱时 `domain` 字段为空或错误。

## What Changes

- **修复 `DomainGraphGenerator.tsx` 中 `handleBatchCreate` 函数的领域参数传递逻辑**
  - 在 `expand` 模式下，应传递 `expandDomain` 而非 `domain`
  - 确保 `onBatchCreate` 回调接收到正确的领域名称

## Impact

- Affected specs: 无
- Affected code:
  - `src/components/GraphMap/DomainGraphGenerator.tsx` — 核心修复点（第 254 行 `handleBatchCreate` 函数）
  - `src/pages/GraphMap.tsx` — 调用方（无需修改，已正确接收 domain 参数）
  - `api/routes/graphs.ts` — 后端 API（无需修改，已正确使用 domain 字段）

## ADDED Requirements

### Requirement: 领域拓展模式下正确传递领域参数

系统 SHALL 在「从现有图谱扩展」模式下，将用户选择的目标领域名称正确传递给后端批量创建接口。

#### Scenario: 从现有图谱拓展并选择领域时，新图谱应关联到所选领域

- **WHEN** 用户在领域图谱批量生成器中选择「从现有图谱扩展」模式
- **AND** 用户选择了一个目标领域（如「机器学习」）
- **AND** 用户生成了推荐图谱并执行批量创建
- **THEN** 后端接收到的 `domain` 参数应为用户选择的领域名称（如「机器学习」）
- **AND** 新创建的所有图谱的 `domain` 字段应正确设置为该领域名称

#### Scenario: 从现有图谱拓展但不选择领域时，新图谱不设置领域

- **WHEN** 用户在领域图谱批量生成器中选择「从现有图谱扩展」模式
- **AND** 用户未选择任何领域（仅选择了源图谱）
- **AND** 用户生成了推荐图谱并执行批量创建
- **THEN** 后端接收到的 `domain` 参数应为 `undefined` 或空字符串
- **AND** 新创建的图谱的 `domain` 字段为 `null`

#### Scenario: 从零开始模式不受影响

- **WHEN** 用户在领域图谱批量生成器中选择「从零开始」模式
- **AND** 用户输入了领域名称（如「前端开发」）
- **AND** 用户生成了推荐图谱并执行批量创建
- **THEN** 后端接收到的 `domain` 参数应为用户输入的领域名称
- **AND** 新创建的所有图谱的 `domain` 字段应正确设置为该领域名称（行为与修复前一致）

## MODIFIED Requirements

无

## REMOVED Requirements

无
