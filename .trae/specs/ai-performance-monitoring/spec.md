# AI 性能监控功能 Spec

## Why

作为 KnowledgeMap 用户，在使用 AI 功能时需要了解 API 调用的成本和性能情况。当前系统缺少对 AI 请求的 token 使用量统计和成本追踪功能，用户无法评估 AI 功能的使用成本。通过添加性能监控中间件和控制台性能分页，用户可以实时监控 AI 请求的输入/输出 token 数量、成本估算、请求耗时等信息。

## What Changes

- 新增 AI 请求监控中间件，自动统计每次 AI 调用的 token 使用量
- 新增成本估算服务，根据不同模型定价计算费用
- 新增性能日志存储服务，记录 AI 请求的详细信息
- 在控制台组件中添加"性能"分页，展示 AI 监控数据
- 新增 API 端点获取性能统计数据

## Impact

- Affected specs: `integrate-built-in-console`
- Affected code:
  - `api/services/ai/` - 新增监控中间件和成本计算服务
  - `api/routes/ai/` - 新增性能统计 API
  - `src/components/Console/` - 添加性能分页组件
  - `src/store/` - 新增性能数据 store
  - `shared/types/` - 新增性能监控相关类型定义

## ADDED Requirements

### Requirement: AI 请求监控中间件

系统应在每次 AI 请求时自动收集性能数据。

#### Scenario: 记录请求基本信息
- **WHEN** AI 服务发起请求
- **THEN** 系统记录请求 ID、操作类型、模型名称、时间戳

#### Scenario: 统计 Token 使用量
- **WHEN** AI 请求完成
- **THEN** 系统从响应中提取 input_tokens 和 output_tokens

#### Scenario: 计算请求耗时
- **WHEN** AI 请求完成
- **THEN** 系统计算从请求发起到响应接收的时间差

#### Scenario: 估算请求成本
- **WHEN** AI 请求完成
- **THEN** 系统根据模型定价计算本次请求的预估成本

### Requirement: 成本估算服务

系统应提供准确的 AI 成本估算功能。

#### Scenario: 支持多模型定价
- **GIVEN** 不同 AI 模型有不同的定价策略
- **WHEN** 计算成本时
- **THEN** 系统根据模型类型选择正确的定价配置

#### Scenario: 定价配置可维护
- **GIVEN** AI 模型定价可能变化
- **WHEN** 需要更新定价时
- **THEN** 可通过配置文件或数据库更新定价信息

### Requirement: 性能日志存储

系统应持久化存储 AI 性能日志。

#### Scenario: 存储性能日志
- **WHEN** AI 请求完成
- **THEN** 性能数据保存到数据库或本地存储

#### Scenario: 查询历史日志
- **WHEN** 用户查看性能历史
- **THEN** 系统返回指定时间范围内的性能记录

#### Scenario: 日志聚合统计
- **WHEN** 用户查看统计概览
- **THEN** 系统展示总 token 数、总成本、请求数等聚合数据

### Requirement: 控制台性能分页

控制台应提供性能监控分页展示 AI 使用情况。

#### Scenario: 切换到性能分页
- **GIVEN** 控制台已打开
- **WHEN** 用户点击"性能"标签
- **THEN** 显示性能监控面板

#### Scenario: 查看实时监控数据
- **GIVEN** 性能分页已打开
- **WHEN** 有新的 AI 请求完成
- **THEN** 实时更新性能数据展示

#### Scenario: 查看请求详情
- **GIVEN** 性能分页显示请求列表
- **WHEN** 用户点击某条记录
- **THEN** 展示该请求的详细信息（输入输出内容摘要、耗时、成本等）

#### Scenario: 筛选和搜索
- **GIVEN** 性能分页已打开
- **WHEN** 用户选择筛选条件（时间范围、操作类型、模型）
- **THEN** 显示符合条件的记录

### Requirement: 性能统计 API

系统应提供 API 端点获取性能数据。

#### Scenario: 获取性能日志列表
- **WHEN** 请求 `GET /api/ai/performance/logs`
- **THEN** 返回分页的性能日志列表

#### Scenario: 获取聚合统计
- **WHEN** 请求 `GET /api/ai/performance/stats`
- **THEN** 返回总 token 数、总成本、按模型/操作分组的统计

#### Scenario: 清除历史日志
- **WHEN** 请求 `DELETE /api/ai/performance/logs`
- **THEN** 清除指定时间范围之前的日志

## Technical Design

### 数据结构

```typescript
interface AIPerformanceLog {
  id: string;
  timestamp: number;
  operation: string;           // chat, generateCards, expandKnowledge 等
  model: string;               // 使用的模型
  provider: AIProviderType;    // 服务提供商
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;       // 预估成本（人民币，单位：元）
  duration: number;            // 请求耗时（毫秒）
  success: boolean;
  errorMessage?: string;
  metadata?: {
    graphId?: string;
    nodeId?: string;
    userId?: string;
  };
}

interface AIModelPricing {
  provider: AIProviderType;
  model: string;
  inputPricePer1k: number;     // 每 1k token 输入价格（人民币，单位：元）
  outputPricePer1k: number;    // 每 1k token 输出价格（人民币，单位：元）
}
```

### 模型定价配置

```typescript
const MODEL_PRICING: AIModelPricing[] = [
  // DeepSeek 定价（人民币/元）
  { provider: 'deepseek', model: 'deepseek-chat', inputPricePer1k: 0.001, outputPricePer1k: 0.002 },
  { provider: 'deepseek', model: 'deepseek-reasoner', inputPricePer1k: 0.001, outputPricePer1k: 0.002 },
  // 火山引擎定价（人民币/元）
  { provider: 'volcengine', model: 'doubao-seed-1-8-251228', inputPricePer1k: 0.0008, outputPricePer1k: 0.0015 },
  // 阿里云定价（人民币/元）
  { provider: 'aliyun', model: 'qwen-long-latest', inputPricePer1k: 0.0005, outputPricePer1k: 0.002 },
  { provider: 'aliyun', model: 'qwen-vl-max', inputPricePer1k: 0.02, outputPricePer1k: 0.02 },
];
```

### 文件结构

```
api/services/ai/
├── performanceMonitor.ts    # 性能监控中间件
├── pricingService.ts        # 成本计算服务
└── aiService.ts             # 修改：集成监控

api/routes/ai/
└── performance.ts           # 性能统计 API

src/components/Console/
├── Console.tsx              # 修改：添加分页切换
├── PerformanceTab.tsx       # 新增：性能监控分页
└── ...

src/store/
└── usePerformanceStore.ts   # 新增：性能数据 store

shared/types/
└── performance.ts           # 新增：性能监控类型定义
```

### 监控中间件实现思路

在 `AIService` 的各个方法中，包装原始请求以收集性能数据：

```typescript
async withPerformanceTracking<T>(
  operation: string,
  fn: () => Promise<{ result: T; usage?: { prompt_tokens: number; completion_tokens: number } }>,
  metadata?: AIPerformanceLog['metadata']
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let usage = { prompt_tokens: 0, completion_tokens: 0 };

  try {
    const response = await fn();
    usage = response.usage || usage;
    return response.result;
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    await performanceMonitor.recordLog({
      operation,
      model: this.currentModel,
      provider: this.currentProvider,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      duration,
      success,
      errorMessage,
      metadata,
    });
  }
}
```
