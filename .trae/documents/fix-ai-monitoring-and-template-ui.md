# 修复计划：AI 监控 Token 三档分析 + 模板选择 UI 简化

## 问题 1：AI 监控缺少 Token 三档详细分析

### 现状
- `aiService.ts` 使用 `withPerformanceTracking` 包装器，记录了完整的三档 token 分析：
  - **输入 Token 缓存命中** (`cachedInputTokens`) — 从提供商 prompt 缓存提供的 token
  - **输入 Token 未命中缓存** (`uncachedInputTokens`) — 需要全新处理的 token
  - **输出 Token** (`outputTokens`) — 生成的补全 token
  - 以及 `cacheHitRate`、`costBreakdown`（区分缓存/非缓存定价）
- `autoGraph.ts` 路由有 `withAutoGraphTracking`，同样记录三档分析
- **`templateGeneratorService.ts` 完全没有性能监控** — 不导入 `performanceMonitor`、`pricingService`，不调用任何记录方法

### 修复方案
在 `templateGeneratorService.ts` 的 `callAI` 方法中添加性能监控，使用已有的 `withAutoGraphTracking` 模式：

1. **在 `callAI` 方法中**：让方法返回 `usage` 数据（包含 `prompt_tokens_details` 和 `completion_tokens_details`）
2. **在 `generateTemplates` 方法中**：使用 `withAutoGraphTracking` 包装 `callAI` 调用，记录三档 token 分析
3. **在路由 `autoGraph.ts` 的 `/generate-templates` 处理中**：使用 `withAutoGraphTracking` 替代手动的 `startTime`/`duration` 日志

### 具体步骤

#### Step 1: 修改 `templateGeneratorService.ts`
- 导入 `performanceMonitor` 和 `pricingService`
- 修改 `callAI` 返回类型，包含 `usage` 对象（含 `prompt_tokens_details` 和 `completion_tokens_details`）
- 修改 `generateTemplates` 方法，在调用 `callAI` 后记录性能数据到 `performanceMonitor`

#### Step 2: 修改 `autoGraph.ts` 路由
- 在 `/generate-templates` 路由中使用 `withAutoGraphTracking` 包装 `templateGeneratorService.generateTemplates` 调用
- 移除手动的 `startTime`/`duration` 日志（已被 `withAutoGraphTracking` 覆盖）

---

## 问题 2：模板选择 UI 应合并到表单中，不要分步

### 现状
- AutoGraphGenerator 使用 4 步流程：①选择模板 → ②输入主题 → ③生成方案 → ④选择风格
- 用户需要先在步骤 1 选择模板类型，然后才能进入步骤 2 输入主题
- 用户觉得分步流程不方便

### 修复方案
将模板选择从独立步骤改为表单中的一个字段行，类似"生成风格"选择器在表单中的呈现方式：

1. **移除步骤指示器**（StepIndicator 组件）
2. **移除 `currentStep` 状态管理**，不再有步骤切换
3. **将模板类型选择器嵌入到主题输入表单中**，作为表单顶部的一个可折叠/展开的选择区域
4. **默认收起模板选择器**，显示当前选中的模板类型（默认"空白图谱"），点击可展开选择
5. **保留所有模板类型选项**（4 大类 + 具体模板 + 空白图谱）

### 具体步骤

#### Step 3: 重构 AutoGraphGenerator UI
- 移除 `StepIndicator` 组件和 `currentStep` 状态
- 移除 `renderStep1()` 和 `renderStep2()` 的步骤切换逻辑
- 创建一个统一的表单布局：
  - 顶部：模板类型选择行（可折叠，默认收起，显示当前选择）
  - 主题输入框
  - 背景信息文本框
  - 生成风格选择器
  - 参考来源（高级选项）
  - 开始生成按钮
- 模板类型选择行样式：类似一个下拉选择器或可折叠面板，点击展开显示 4 大类卡片 + 具体模板

---

## 修改文件清单

| 文件 | 变更 |
|------|------|
| `api/services/ai/templateGeneratorService.ts` | 添加性能监控（三档 token 分析） |
| `api/routes/autoGraph.ts` | `/generate-templates` 路由使用 `withAutoGraphTracking` |
| `src/components/AutoGraph/AutoGraphGenerator.tsx` | 移除步骤流程，模板选择合并到表单中 |
