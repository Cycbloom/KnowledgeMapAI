# 代码重复分析与重构规范

## Why
项目中存在大量重复的代码模式，包括 AI 配置注入、错误处理、相似知识点搜索、层级计算等。这些重复代码增加了维护成本，容易导致不一致的行为，并且违反了 DRY (Don't Repeat Yourself) 原则。通过提取公共工具函数和统一处理模式，可以显著提高代码质量和可维护性。

## What Changes
- 提取 AI 配置注入工具函数
- 创建统一的错误处理与消息提示封装
- 合并重复的相似知识点搜索逻辑
- 统一层级计算函数
- 提取分页查询工具函数
- 创建 RPC 回退模式封装
- 统一上下文构建工具

## Impact
- Affected specs: 无直接影响，属于内部重构
- Affected code:
  - `src/services/api/ai.ts` - 重构 AI 配置注入
  - `src/hooks/useGraphNodeOperations.ts` - 使用统一错误处理
  - `src/hooks/useGraphAIOperations.ts` - 使用统一错误处理
  - `src/hooks/useKnowledgePointOperations.ts` - 使用统一错误处理
  - `api/services/autoGraphService.ts` - 使用统一相似搜索
  - `api/services/knowledgePointService.ts` - 使用统一相似搜索
  - `api/services/graphService.ts` - 使用 RPC 回退封装
  - `api/services/taskProcessors/utils.ts` - 使用统一层级计算
  - `src/lib/graphUtils.ts` - 统一层级计算

## ADDED Requirements

### Requirement: AI 配置注入工具函数
系统 SHALL 提供统一的 AI 配置注入工具函数，自动合并用户配置和默认配置。

#### Scenario: 注入 AI 配置
- **WHEN** 调用 `injectAIConfig(payload, taskType)` 函数
- **THEN** 自动从用户设置中获取 provider 和 model，合并到 payload 中

#### Scenario: 配置优先级
- **WHEN** payload 已包含 provider 或 model
- **THEN** 保留原有值，不覆盖

### Requirement: 统一错误处理与消息封装
系统 SHALL 提供统一的异步操作错误处理封装，自动处理 loading 状态和消息提示。

#### Scenario: 成功操作
- **WHEN** 使用 `withErrorHandling` 封装异步操作
- **THEN** 成功时自动显示成功消息

#### Scenario: 失败操作
- **WHEN** 操作抛出异常
- **THEN** 自动显示错误消息并记录日志

#### Scenario: 网络错误识别
- **WHEN** 发生网络错误
- **THEN** 显示特定的网络错误消息

### Requirement: 相似知识点搜索工具
系统 SHALL 提供统一的相似知识点搜索工具函数，支持配置相似度阈值和结果数量。

#### Scenario: 搜索相似知识点
- **WHEN** 调用 `searchSimilarKnowledgePoints(supabase, userId, text, options)` 函数
- **THEN** 返回相似度排序的知识点列表

#### Scenario: 自动生成嵌入向量
- **WHEN** 提供文本内容
- **THEN** 自动生成嵌入向量用于相似度搜索

### Requirement: 层级计算工具函数
系统 SHALL 提供统一的节点层级计算函数，在前后端共享使用。

#### Scenario: 获取下一层级
- **WHEN** 调用 `getNextLevel(currentLevel)` 函数
- **THEN** 返回正确的下一层级名称

#### Scenario: 层级顺序
- **WHEN** 当前层级为 'root'
- **THEN** 下一层级为 'core'
- **WHEN** 当前层级为 'core'
- **THEN** 下一层级为 'sub'

### Requirement: 分页查询工具函数
系统 SHALL 提供统一的分页查询构建器，简化分页逻辑。

#### Scenario: 构建分页查询
- **WHEN** 调用 `buildPaginationQuery(query, options)` 函数
- **THEN** 自动应用分页参数到查询

#### Scenario: 默认分页参数
- **WHEN** 未指定分页参数
- **THEN** 使用默认值 limit=20, offset=0

### Requirement: RPC 回退模式封装
系统 SHALL 提供 RPC 调用回退模式封装，自动处理 RPC 失败后的手动查询回退。

#### Scenario: RPC 成功
- **WHEN** RPC 调用成功
- **THEN** 直接返回 RPC 结果

#### Scenario: RPC 失败回退
- **WHEN** RPC 调用失败
- **THEN** 自动执行回退查询并记录警告日志

### Requirement: 上下文构建工具
系统 SHALL 提供统一的上下文构建工具函数，用于 AI 相关操作。

#### Scenario: 构建节点上下文
- **WHEN** 调用 `buildNodeContext(node, options)` 函数
- **THEN** 返回格式化的节点上下文字符串

#### Scenario: 包含关联节点
- **WHEN** 选项中指定包含关联节点
- **THEN** 上下文中包含父子节点信息

## MODIFIED Requirements
无

## REMOVED Requirements
无

## 代码重复分析详情

### 1. AI 配置注入模式 (重复 15+ 次)
**位置**: `src/services/api/ai.ts`

**重复代码**:
```typescript
const config = getAIConfig('text');
const payload = { ...data };
if (!payload.provider && config.provider) payload.provider = config.provider;
if (!payload.model && config.model) payload.model = config.model;
```

**出现次数**: 15+ 处

### 2. 错误处理与消息模式 (重复 20+ 次)
**位置**: 
- `src/hooks/useGraphNodeOperations.ts`
- `src/hooks/useGraphAIOperations.ts`
- `src/hooks/useKnowledgePointOperations.ts`

**重复代码**:
```typescript
try {
  // 操作
  addMessage({ type: 'success', content: '...' });
} catch (err) {
  console.error(err);
  addMessage({ type: 'error', content: '...' });
} finally {
  setLoading(false);
}
```

### 3. 相似知识点搜索模式 (重复 3 次)
**位置**:
- `api/services/autoGraphService.ts`
- `api/services/knowledgePointService.ts`
- `src/hooks/useKnowledgePointOperations.ts`

**重复逻辑**: 生成嵌入向量 → 搜索相似知识点 → 返回结果

### 4. 层级计算模式 (重复 2 次)
**位置**:
- `api/services/taskProcessors/utils.ts`
- `src/lib/graphUtils.ts`

**重复代码**:
```typescript
function getNextLevel(currentLevel: string): string {
  switch (currentLevel) {
    case 'root': return 'core';
    case 'core': return 'sub';
    // ...
  }
}
```

### 5. 分页模式 (重复 5+ 次)
**位置**: 多个 service 文件

**重复代码**:
```typescript
const { limit = 20, offset = 0 } = options || {};
// ... query.range(offset, offset + limit - 1)
```

### 6. RPC 回退模式 (重复 2 次)
**位置**: `api/services/graphService.ts`

**重复逻辑**: 尝试 RPC → 失败时回退到手动查询

### 7. 上下文构建模式 (重复 3+ 次)
**位置**: 
- `api/services/ai/utils.ts`
- `api/services/ragService.ts`
- `src/hooks/useGraphAIOperations.ts`

**重复逻辑**: 从节点数据构建 AI 上下文字符串
