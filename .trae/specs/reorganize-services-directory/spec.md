# 重组服务层目录结构 Spec

## Why

服务层目录结构混乱，根目录下有 35 个服务文件，部分已有子目录（ai/, scheduler/, study/ 等）但未充分利用。重组后可提高代码可维护性和可发现性。

## What Changes

- 将根目录下的服务文件按功能域分类移动到对应子目录
- 统一导入路径，更新所有引用
- 完善子目录的 index.ts 导出

## Impact

- Affected specs: 整体 API 架构
- Affected code: api/services/, api/routes/, api/jobs/, api/middleware/

---

## 当前目录结构分析

### 已有的子目录（保留并完善）

| 目录 | 现有文件 | 说明 |
|------|----------|------|
| `ai/` | providers/, config.ts, factory.ts, index.ts, mock.ts, types.ts, utils.ts | AI 提供商适配 |
| `scheduler/` | achievementService.ts, executionService.ts, focusService.ts, settingsService.ts, statsService.ts, taskService.ts | 任务调度相关 |
| `study/` | index.ts (空) | 学习相关 |
| `common/` | index.ts (空) | 通用服务 |
| `core/` | index.ts (空) | 核心服务 |
| `graph/` | index.ts (空) | 图谱相关 |
| `taskProcessors/` | 6 个处理器文件 | 异步任务处理器 |

### 根目录下待分类的服务文件（35 个）

| 文件 | 建议目标目录 | 说明 |
|------|-------------|------|
| `aiService.ts` | ai/ | AI 服务入口 |
| `aiActionService.ts` | ai/ | AI 操作服务 |
| `promptService.ts` | ai/ | 提示词服务 |
| `embeddingService.ts` | ai/ | 向量嵌入服务 |
| `ragService.ts` | ai/ | RAG 服务 |
| `searchService.ts` | ai/ | 搜索服务（依赖向量） |
| `graphService.ts` | graph/ | 图谱服务 |
| `graphNodeService.ts` | graph/ | 图谱节点服务 |
| `graphRelationService.ts` | graph/ | 图谱关系服务 |
| `graphTemplateService.ts` | graph/ | 图谱模板服务 |
| `edgeService.ts` | graph/ | 边服务 |
| `knowledgePointService.ts` | graph/ | 知识点服务 |
| `relationshipTypeService.ts` | graph/ | 关系类型服务 |
| `autoGraphService.ts` | graph/ | 自动图谱服务 |
| `studyService.ts` | study/ | 学习服务 |
| `studyProgressService.ts` | study/ | 学习进度服务 |
| `reviewService.ts` | study/ | 复习服务 |
| `learningPathService.ts` | study/ | 学习路径服务 |
| `periodicTaskService.ts` | scheduler/ | 周期任务服务 |
| `achievementService.ts` | scheduler/ | 成就服务（重复，需合并） |
| `focusService.ts` | scheduler/ | 专注服务（重复，需合并） |
| `taskService.ts` | scheduler/ | 任务服务（重复，需合并） |
| `taskAnalyticsService.ts` | scheduler/ | 任务分析服务 |
| `taskRecommendationService.ts` | scheduler/ | 任务推荐服务 |
| `authService.ts` | core/ | 认证服务 |
| `settingsService.ts` | core/ | 设置服务 |
| `healthService.ts` | core/ | 健康检查服务 |
| `sseService.ts` | core/ | SSE 服务 |
| `cacheService.ts` | common/ | 缓存服务 |
| `queueService.ts` | common/ | 队列服务 |
| `backupService.ts` | common/ | 备份服务 |
| `backupSyncService.ts` | common/ | 备份同步服务 |
| `templateService.ts` | common/ | 模板服务 |
| `pdfService.ts` | common/ | PDF 服务 |
| `dashboardService.ts` | common/ | 仪表盘服务 |

---

## 目标目录结构

```
api/services/
├── ai/                      # AI 相关服务
│   ├── providers/           # AI 提供商适配
│   ├── aiService.ts         # AI 服务入口
│   ├── aiActionService.ts   # AI 操作服务
│   ├── promptService.ts     # 提示词服务
│   ├── embeddingService.ts  # 向量嵌入服务
│   ├── ragService.ts        # RAG 服务
│   ├── searchService.ts     # 搜索服务
│   ├── config.ts
│   ├── factory.ts
│   ├── index.ts
│   ├── mock.ts
│   ├── types.ts
│   └── utils.ts
├── graph/                   # 知识图谱服务
│   ├── graphService.ts
│   ├── graphNodeService.ts
│   ├── graphRelationService.ts
│   ├── graphTemplateService.ts
│   ├── edgeService.ts
│   ├── knowledgePointService.ts
│   ├── relationshipTypeService.ts
│   ├── autoGraphService.ts
│   └── index.ts
├── study/                   # 学习相关服务
│   ├── studyService.ts
│   ├── studyProgressService.ts
│   ├── reviewService.ts
│   ├── learningPathService.ts
│   └── index.ts
├── scheduler/               # 任务调度服务
│   ├── taskService.ts
│   ├── focusService.ts
│   ├── achievementService.ts
│   ├── periodicTaskService.ts
│   ├── executionService.ts
│   ├── settingsService.ts
│   ├── statsService.ts
│   ├── taskAnalyticsService.ts
│   ├── taskRecommendationService.ts
│   └── index.ts
├── core/                    # 核心服务
│   ├── authService.ts
│   ├── settingsService.ts
│   ├── healthService.ts
│   ├── sseService.ts
│   └── index.ts
├── common/                  # 通用服务
│   ├── cacheService.ts
│   ├── queueService.ts
│   ├── backupService.ts
│   ├── backupSyncService.ts
│   ├── templateService.ts
│   ├── pdfService.ts
│   ├── dashboardService.ts
│   └── index.ts
├── taskProcessors/          # 异步任务处理器（保持不变）
│   └── ...
└── index.ts                 # 统一导出入口
```

---

## 实施策略

### 阶段一：创建目标目录结构

1. 确保所有目标子目录存在
2. 为每个子目录创建/更新 index.ts 导出文件

### 阶段二：移动服务文件

按功能域分批移动，每批完成后验证：

1. **AI 相关**（6 个文件）
2. **图谱相关**（8 个文件）
3. **学习相关**（4 个文件）
4. **调度相关**（4 个新增文件，需处理重复）
5. **核心服务**（4 个文件）
6. **通用服务**（7 个文件）

### 阶段三：更新导入路径

更新所有引用这些服务的文件：
- `api/routes/` 下的路由文件
- `api/jobs/` 下的任务处理器
- `api/middleware/` 下的中间件
- 其他服务文件

### 阶段四：处理重复文件

`scheduler/` 目录下已有部分服务文件，需要：
- 合并功能相同的文件
- 或重命名避免冲突

### 阶段五：验证

1. 运行类型检查 `npm run check`
2. 运行代码检查 `npm run lint`
3. 运行测试确保功能正常

---

## 风险评估

- **风险等级**：中等
- **影响范围**：大量文件需要更新导入路径
- **回滚方案**：Git 版本控制可随时回滚

## 注意事项

1. **BREAKING**：所有导入这些服务的文件都需要更新路径
2. 建议分批提交，便于问题定位和回滚
3. 移动文件时保持文件内容不变，仅更新导入路径
