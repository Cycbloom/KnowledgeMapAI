# 学习模式 - AI用量监控与定价信息显示功能计划

## 问题背景

用户在学习模式中生成学习教材时，无法看到AI调用的**用量监控信息**（Token使用量）和**定价信息**（成本费用）。虽然后端已经完整记录了这些数据，但前端LearningMode页面完全没有展示。

## 调研结果

### 现有实现状态

#### ✅ 后端（已完成）
1. **性能监控系统完整**
   - 文件：[performanceMonitor.ts](../../api/services/ai/performanceMonitor.ts)
   - 功能：记录所有AI调用的token用量、定价、性能数据
   - 存储：`ai_performance_logs` 数据库表

2. **自动跟踪机制**
   - 文件：[performanceTracker.ts](../../api/services/ai/utils/performanceTracker.ts)
   - 函数：`withAIPerformanceTracking()`
   - `generateLearningMaterial` 方法（[aiService.ts:1066](../../api/services/ai/aiService.ts#L1066)）已集成
   - 自动记录：inputTokens, outputTokens, estimatedCost, duration等

3. **定价计算服务**
   - 文件：`pricingService.ts`
   - 功能：根据provider/model/token计算详细成本

#### ✅ API层（已完成）
- 文件：[performance.ts](../../src/services/api/performance.ts)
- 接口：
  - `getLogs()` - 获取性能日志
  - `getStats()` - 获取统计数据
  - `clearLogs()` - 清理日志

#### ✅ UI组件（已存在）
- 文件：[PerformanceTab.tsx](../../src/components/Console/PerformanceTab.tsx)
- 功能：完整的性能数据展示组件
- 位置：仅在开发者控制台（Console）中使用

#### ❌ LearningMode（缺失）
- 文件：[LearningMode.tsx](../../src/pages/LearningMode.tsx)
- 问题：
  1. 调用 `generateLearningMaterial` 后只使用 `response.content` 和 `response.keywords`
  2. **没有显示任何用量或定价信息**
  3. 没有调用 `performanceApi` 获取历史数据
  4. 用户完全不知道生成了多少花费了多少

### 关键代码位置

**后端生成学习材料**：
```typescript
// aiService.ts:1066-1142
return withAIPerformanceTracking(
  {
    operation: "generateLearningMaterial",
    provider: provider.providerType,
    model,
    metadata: { topic, userId: options.userId },
  },
  async () => {
    // ... AI调用逻辑
    return {
      result: { content, keywords },
      usage: completion.usage,  // ← usage信息已返回但前端未使用
    };
  }
);
```

**前端调用位置**：
```typescript
// LearningMode.tsx:403 & 684
const response = await api.ai.generateLearningMaterial({
  topic: node.title || "",
  context: node.content,
  level: node.level,
  graph_id: graphId,
  language: aiLanguage,
});
// ❌ 只使用了 response.content 和 response.keywords
// ❌ 没有显示用量和定价信息
```

## 解决方案

### 方案选择：实时显示 + 历史查询（推荐）

在学习模式页面中添加**两层展示**：

1. **实时显示**：生成完成后立即显示本次的用量和成本
2. **历史面板**：可展开查看该节点的所有生成历史和累计数据

---

## 实施步骤

### 第一步：修改后端API - 返回用量信息

**目标**：让 `generateLearningMaterial` API直接返回usage数据给前端

**文件**：`api/routes/ai.ts` 或相关路由文件

**修改内容**：
```typescript
// 当前返回格式
{
  content: string;
  keywords: Keyword[];
}

// 修改为
{
  content: string;
  keywords: Keyword[];
  usage?: {  // 新增
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost?: number;  // 可选：直接返回计算好的成本
  };
}
```

**验证点**：
- [ ] API响应包含usage字段
- [ ] cost计算正确（使用pricingService）

---

### 第二步：创建用量显示组件

**目标**：创建可复用的AI用量信息展示组件

**新建文件**：`src/components/Learning/AIUsageDisplay.tsx`

**功能**：
1. 显示单次生成的用量信息
2. 展示内容：
   - 📊 Token使用量（输入/输出/总计）
   - 💰 预估成本（人民币格式）
   - ⏱️ 生成耗时
   - 🤖 使用的模型名称

**UI设计**：
```
┌─────────────────────────────────────┐
│  📊 AI 用量信息                      │
├─────────────────────────────────────┤
│  模型: GPT-4o                       │
│  Token: 输入 1.2K / 输出 3.5K       │
│  总计: 4.7K tokens                  │
│  成本: ¥0.023                       │
│  耗时: 2.3s                         │
└─────────────────────────────────────┘
```

**Props接口**：
```typescript
interface AIUsageDisplayProps {
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost?: number;
    duration?: number;
    model?: string;
    provider?: string;
  };
  isDark?: boolean;
  compact?: boolean;  // 紧凑模式（用于行内显示）
}
```

**验证点**：
- [ ] 组件正确显示所有字段
- [ ] 支持深色/浅色主题
- [ ] 支持紧凑模式和完整模式
- [ ] 数字格式化正确（K/M单位、¥符号）
- [ ] 无数据时不报错（优雅降级）

---

### 第三步：集成到LearningMode页面

**目标**：在生成学习材料后显示用量信息

**文件**：`src/pages/LearningMode.tsx`

**修改位置1 - 初始加载（第403-461行）**：
```typescript
const response = await api.ai.generateLearningMaterial({...});

if (response.content) {
  setArticleContent(response.content);
  setKeywords(responseKeywords);

  // ✅ 新增：保存用量信息到state
  if (response.usage) {
    setLastGenerationUsage({
      ...response.usage,
      duration: Date.now() - startTime,  // 记录耗时
      model: currentModel,
    });
  }

  // ... 其余逻辑
}
```

**修改位置2 - 重新生成（第684-726行）**：
```typescript
const response = await api.ai.generateLearningMaterial({...});

if (response.content) {
  // ✅ 同样添加usage保存逻辑
  if (response.usage) {
    setLastGenerationUsage({...});
  }
}
```

**新增State**：
```typescript
const [lastGenerationUsage, setLastGenerationUsage] = useState<{
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost?: number;
  duration?: number;
  model?: string;
} | null>(null);
```

**UI集成位置**：
- 在文章内容区域下方（articleContent之后）
- 在"重新生成"按钮附近
- 条件渲染：`lastGenerationUsage && <AIUsageDisplay usage={lastGenerationUsage} />`

**验证点**：
- [ ] 首次加载生成后显示用量
- [ ] 重新生成后更新用量信息
- [ ] 生成失败时不显示（或显示错误状态）
- [ ] 用量信息位置合理，不影响阅读

---

### 第四步：（可选）添加历史用量面板

**目标**：查看当前节点的所有生成历史

**新建文件**：`src/components/Learning/AIUsageHistoryPanel.tsx`

**功能**：
1. 调用 `performanceApi.getLogs({operation: "generateLearningMaterial"})`
2. 过滤当前节点的记录（通过metadata.topic或sessionId）
3. 显示历史列表：
   - 生成时间
   - Token用量
   - 成本
   - 状态（成功/失败）

**触发方式**：
- 点击用量卡片上的"历史记录"按钮
- 或在设置面板中添加tab

**验证点**：
- [ ] 正确过滤当前节点的记录
- [ ] 分页或滚动加载
- [ ] 支持按时间/成本排序

---

### 第五步：国际化支持

**文件**：
- `src/i18n/locales/zh-CN.json`
- `src/i18n/locales/en-US.json`

**新增翻译键**：
```json
{
  "learning": {
    "usage": {
      "title": "AI 用量信息",
      "model": "模型",
      "tokens": "Token用量",
      "input": "输入",
      "output": "输出",
      "total": "总计",
      "cost": "预估成本",
      "duration": "耗时",
      "history": "历史记录",
      "noData": "暂无用量数据"
    }
  }
}
```

**验证点**：
- [ ] 中英文翻译完整
- [ ] 所有文本使用i18n

---

## 技术细节

### 数据流图

```
用户点击"生成教材"
    ↓
LearningMode调用 api.ai.generateLearningMaterial()
    ↓
后端AI服务调用 withAIPerformanceTracking()
    ↓┌──────────────────────────────┐
  │  1. 调用AI API                 │
  │  2. 提取 usage 信息            │
  │  3. 计算 cost (pricingService) │
  │  4. 记录到 performanceMonitor  │
  └↓──────────────────────────────┘
返回 { content, keywords, usage }  ← 新增usage
    ↓
前端保存到 lastGenerationUsage state
    ↓
渲染 <AIUsageDisplay usage={lastGenerationUsage} />
    ↓
用户看到用量信息和成本
```

### 成本计算示例

```typescript
// pricingService.calculateCost(provider, model, inputTokens, outputTokens)
// 示例：GPT-4o
// Input: $2.50 / 1M tokens
// Output: $10.00 / 1M tokens

输入 1200 tokens → 1200 * 2.50 / 1000000 = $0.003
输出 3500 tokens → 3500 * 10.00 / 1000000 = $0.035
总计 ≈ ¥0.27 (按汇率7.2换算)
```

### 注意事项

1. **性能影响**：
   - usage数据已经在AI响应中，无需额外请求
   - cost计算在后端完成，不增加前端负担

2. **错误处理**：
   - 如果usage为空，组件应该优雅降级（显示"--"或不显示）
   - 网络错误时不阻塞主流程（用量信息是辅助信息）

3. **隐私考虑**：
   - 成本信息可以让用户了解AI使用开销
   - 不显示敏感信息（如API key等）

4. **缓存兼容**：
   - 如果使用了dedupedRequest（请求去重），缓存的响应可能没有usage
   - 需要处理这种情况

---

## 测试计划

### 单元测试
- [ ] `AIUsageDisplay` 组件渲染测试
- [ ] 数字格式化函数测试
- [ ] 空数据处理测试

### 集成测试
- [ ] 生成学习材料后检查API响应包含usage
- [ ] 页面正确显示用量信息
- [ ] 重新生成后更新用量数据

### E2E测试（Playwright）
```typescript
test('生成学习材料后应显示用量信息', async ({ page }) => {
  await page.goto('/learning?node_id=xxx&graph_id=yyy');
  await page.click('[data-testid="generate-material"]');
  await page.waitForSelector('[data-testid="ai-usage-display"]');
  await expect(page.locator('[data-testid="usage-cost"]')).toBeVisible();
});
```

---

## 实施优先级

### P0 - 必须实现（核心功能）
1. ✅ 第一步：修改后端API返回usage
2. ✅ 第二步：创建AIUsageDisplay组件
3. ✅ 第三步：集成到LearningMode

### P1 - 应该实现（增强体验）
4. 第四步：历史用量面板
5. 第五步：完善国际化

### P2 - 可以实现（锦上添花）
6. 用量预警（超过阈值提示）
7. 导出用量报告
8. 对比不同模型的成本效率

---

## 预期效果

### 用户体验改进

**改进前**：
```
┌─────────────────────────────┐
│  [生成教材] 按钮             │
         ↓ 点击
│  教材内容...                │
│  [重新生成]                 │
│  （不知道花了多少）          │
└─────────────────────────────┘
```

**改进后**：
```
┌─────────────────────────────┐
│  [生成教材] 按钮             │
         ↓ 点击
│  教材内容...                │
│                             │
│  ┌─────────────────────┐   │
│  │ 📊 本次生成用量      │   │
│  │ Token: 4.7K         │   │
│  │ 成本: ¥0.023        │   │
│  │ 耗时: 2.3s          │   │
│  │ [📜 历史记录]        │   │
│  └─────────────────────┘   │
│                             │
│  [重新生成]                 │
└─────────────────────────────┘
```

---

## 相关文件清单

### 需要修改的文件
1. `api/services/ai/aiService.ts` - 确保返回usage（可能已包含）
2. `api/routes/ai.ts` - 检查路由层是否透传usage
3. `src/pages/LearningMode.tsx` - 集成用量显示
4. `src/i18n/locales/zh-CN.json` - 添加中文翻译
5. `src/i18n/locales/en-US.json` - 添加英文翻译

### 需要新建的文件
1. `src/components/Learning/AIUsageDisplay.tsx` - 用量显示组件
2. `src/components/Learning/AIUsageHistoryPanel.tsx` - 历史面板（可选）

### 参考文件（无需修改）
- `api/services/ai/performanceMonitor.ts` - 监控实现
- `api/services/ai/utils/performanceTracker.ts` - 跟踪器
- `api/services/ai/pricingService.ts` - 定价服务
- `src/services/api/performance.ts` - 前端API
- `src/components/Console/PerformanceTab.tsx` - 参考UI

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 后端API不返回usage | 无法显示用量 | 检查并修改路由层透传 |
| 性能数据延迟 | 显示过时数据 | 使用实时数据而非查询 |
| 组件样式冲突 | UI异常 | 使用隔离的CSS类名 |
| i18n遗漏 | 英文环境乱码 | 全面检查翻译文件 |

---

## 时间估算

- **第一步**（后端修改）：30分钟
- **第二步**（组件开发）：1-2小时
- **第三步**（页面集成）：1小时
- **第四步**（历史面板）：2-3小时（可选）
- **第五步**（国际化）：30分钟
- **测试调试**：1小时

**总计（P0必须项）**：约3-4小时
**总计（全部）**：约6-8小时

---

## 下一步行动

1. ✅ 确认计划并获得批准
2. 🔲 开始实施第一步：检查并修改后端API
3. 🔲 创建AIUsageDisplay组件
4. 🔲 集成到LearningMode页面
5. 🔲 测试完整流程
6. 🔨 可选：添加历史面板功能
