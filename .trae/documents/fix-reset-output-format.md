# 修复 reset 命令输出显示为 JSON 而非自然语言

## 问题分析

**根因：ConsoleOutput 的渲染逻辑优先展示 `data` 字段**

查看 [ConsoleOutput.tsx 第 116-158 行](file:///d:/KnowledgeMap/src/components/Console/ConsoleOutput.tsx#L116-L158)：

```
renderContent() 优先级：
1. hasError → 显示 error 文字
2. hasData (data !== undefined) → 如果是 object → formatValue(data) 渲染为 JSON
3. item.content → 显示 message 文字
```

而 [data.ts 第 361-364 行](file:///d:/KnowledgeMap/src/services/console/commands/data.ts#L361-L364) 返回的是：

```typescript
return {
  success: true,
  data: { preview: previewResult, result: deleteResult }, // ← 这里！object 类型
  message: output,  // ← 精心格式化的表格文字被忽略了
};
```

因为 `data` 是一个 object（包含 API 原始响应），ConsoleOutput 直接用 `formatValue()` 把它序列化成 JSON 展示，**完全忽略了格式化好的 `message` 字段**。

## 修复方案

**修改 `src/services/console/commands/data.ts` 中 handleReset 的返回值**

将 `data` 字段从原始 API 响应对象改为简洁的摘要信息（或设为 `undefined`），让 ConsoleOutput 走到 `item.content` 分支，展示我们精心格式化的表格文字。

### 具体改动

#### 1. Dry-run 模式返回值（第 312-316 行）

```typescript
// 修改前
return {
  success: true,
  data: { ...result, dryRun: true },  // ← 原始 API 响应，会被渲染为 JSON
  message: output,
};

// 修改后
return {
  success: true,
  data: { dryRun: true, totalRecords, type },  // 简洁摘要，不会被 formatValue 暴露细节
  message: output,
};
```

#### 2. 删除完成模式返回值（第 361-365 行）

```typescript
// 修改前
return {
  success: true,
  data: { preview: previewResult, result: deleteResult },  // ← 原始 API 响应
  message: output,
};

// 修改后
return {
  success: true,
  data: { deleted: previewTotal, type },  // 只保留关键数字
  message: output,
};
```

### 验证方式

执行 `reset --dry-run` 和 `reset`，确认控制台输出只显示格式化的表格文字，不再显示原始 JSON。
