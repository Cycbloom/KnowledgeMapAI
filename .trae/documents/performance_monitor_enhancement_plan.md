# 性能监控增强计划

## 项目分析

通过分析代码库，发现以下需要改进的地方：

1. **元数据增强**：
   - 性能监控日志中已包含 `metadata` 字段，但部分AI操作未充分利用
   - 目前传递的元数据主要是技术性ID（如 `graphId`、`nodeId`），对用户来说意义不大
   - 需要确保元数据包含对用户有意义的信息

2. **本地化支持**：
   - 新添加的AI操作类型（如 `generateLearningMaterial`、`extractConcepts` 等）缺少本地化配置
   - 中英文本地化文件都需要更新

3. **需要修改的文件**：
   - `src/i18n/locales/zh-CN.json` - 添加中文本地化
   - `src/i18n/locales/en-US.json` - 添加英文本地化
   - 确保所有AI方法在调用性能监控时传递有意义的元数据

## 实施步骤

### 步骤 1：更新中文本地化配置
在 `src/i18n/locales/zh-CN.json` 的 `console.performance.operations` 部分添加新的操作类型：

```json
{
  "generateLearningMaterial": "生成学习材料",
  "extractConcepts": "提取概念",
  "analyzeCrossGraphConnections": "跨图谱连接分析",
  "generateTaskDetails": "生成任务详情",
  "getBranchSuggestions": "分支建议",
  "generateGraphFromImage": "从图像生成图谱",
  "suggestNextTopic": "建议下一个主题"
}
```

### 步骤 2：更新英文本地化配置
在 `src/i18n/locales/en-US.json` 的 `console.performance.operations` 部分添加新的操作类型：

```json
{
  "generateLearningMaterial": "Generate Learning Material",
  "extractConcepts": "Extract Concepts",
  "analyzeCrossGraphConnections": "Cross-Graph Connections Analysis",
  "generateTaskDetails": "Generate Task Details",
  "getBranchSuggestions": "Get Branch Suggestions",
  "generateGraphFromImage": "Generate Graph From Image",
  "suggestNextTopic": "Suggest Next Topic"
}
```

### 步骤 3：优化元数据传递
确保以下AI方法在调用 `withPerformanceTracking` 时传递有意义的元数据：

1. **generateLearningMaterial**：传递 `topic`（主题）、`userId`（用户ID）
2. **extractConcepts**：传递 `text`（文本摘要）
3. **analyzeCrossGraphConnections**：传递 `graph1.title`、`graph2.title`、`userId`
4. **generateTaskDetails**：传递 `title`（任务标题）、`userId`
5. **getBranchSuggestions**：传递 `nodeTitle`（节点标题）、`userId`
6. **generateGraphFromImage**：传递图片相关信息
7. **suggestNextTopic**：传递 `nodeTitle`（节点标题）

### 步骤 4：验证性能监控功能
- 运行项目并测试AI功能
- 检查性能监控面板是否显示新的操作类型
- 验证元数据是否正确显示有意义的信息
- 确保本地化翻译生效

## 风险评估

1. **风险**：本地化配置遗漏
   **对策**：仔细检查中英文本地化文件，确保所有新操作类型都有对应的翻译

2. **风险**：元数据传递错误
   **对策**：检查每个AI方法的元数据传递，确保传递的是有意义的信息

3. **风险**：性能监控显示异常
   **对策**：测试所有AI功能，确保性能监控面板正常显示

## 预期成果

1. 所有新添加的AI操作类型都有对应的本地化翻译
2. 性能监控面板能够显示有意义的元数据信息
3. 用户可以在不同语言环境下看到正确的操作类型名称
4. 元数据能够帮助用户更好地理解AI操作的上下文

## 技术要点

- **本地化键名**：使用与操作类型相同的键名，确保映射正确
- **元数据字段**：使用现有的 `metadata` 字段，传递有意义的信息而不是技术性ID
- **性能监控集成**：确保所有AI方法都使用 `withPerformanceTracking` 包装
- **测试覆盖**：测试不同语言环境下的性能监控显示
