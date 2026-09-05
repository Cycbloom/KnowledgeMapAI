# 共享类型定义

## 目录结构

```
shared/
├── constants/              # 常量定义
│   ├── backboneModulePresets.ts
│   ├── capture.ts
│   ├── fonts.ts
│   ├── masteryThresholds.ts
│   ├── studyModePresets.ts
│   ├── taskDefaults.ts
│   ├── taskTitles.ts
│   └── ttsVoices.ts
│
├── i18n/                   # 共享 i18n 资源
│   ├── index.ts
│   └── locales/
│
├── kernel/                 # 内核基础
│   ├── PluginLifecycleBase.ts
│   ├── types.ts
│   └── index.ts
│
├── sync/                   # 同步引擎
│   ├── conflictDetector.ts
│   ├── conflictResolver.ts
│   ├── operationMerger.ts
│   ├── types.ts
│   ├── index.ts
│   └── __tests__/
│
├── types/                  # 共享类型定义
│   ├── index.ts            # 统一导出
│   ├── common.ts           # 通用类型
│   ├── styles.ts           # 样式相关类型
│   ├── user.ts             # 用户相关类型
│   ├── graph.ts            # 图谱综合类型
│   ├── scheduler.ts        # 调度综合类型
│   ├── ai.ts               # AI 相关类型
│   ├── api.ts              # API 相关类型
│   ├── appError.ts         # 应用错误类型
│   ├── backlink.ts         # 反向链接类型
│   ├── database.ts         # 数据库类型
│   ├── database.generated.ts # 自动生成数据库类型
│   ├── errorCodes.ts       # 错误码类型
│   ├── events.ts           # 事件类型
│   ├── ipc.ts              # 进程通信类型
│   ├── note.ts             # 笔记类型
│   ├── performance.ts      # 性能类型
│   ├── quiz.ts             # 测验类型
│   ├── reviewTask.ts       # 复习任务类型
│   ├── settings.ts         # 设置类型
│   ├── graphVersion.ts     # 图谱版本类型
│   ├── graph-analysis.ts   # 图谱分析类型
│   ├── graph-collaboration.ts # 图谱协作类型
│   ├── graph-combined-view.ts  # 图谱组合视图类型
│   ├── graph-core.ts       # 图谱核心类型
│   ├── graph-discovery.ts  # 图谱发现类型
│   ├── graph-domain.ts     # 图谱领域类型
│   ├── graph-edge.ts       # 边类型
│   ├── graph-entity.ts     # 实体类型
│   ├── graph-knowledge-point.ts # 知识点类型
│   ├── graph-literature.ts # 文献类型
│   ├── graph-node.ts       # 节点类型
│   ├── graph-template.ts   # 模板类型
│   ├── learningMaterial.ts # 学习材料类型
│   ├── scheduler-achievement.ts  # 成就类型
│   ├── scheduler-core.ts   # 调度核心类型
│   ├── scheduler-focus.ts  # 专注模式类型
│   ├── scheduler-study.ts  # 调度学习类型
│   └── scheduler-task.ts   # 调度任务类型
│
└── utils/                  # 共享工具函数
    ├── blockRef.ts         # 笔记块引用解析
    ├── cards.ts            # 学习卡片辅助
    ├── dateFormat.ts       # 日期格式化
    ├── encryption.ts       # 数据加密
    ├── fsrs/               # FSRS 算法辅助（cardConversion, masteryContract）
    ├── indexMapping.ts
    ├── levelUtils.ts       # 节点等级工具
    ├── localization.ts     # 多语言文本类型
    ├── markdownParser.ts   # Markdown→图谱结构解析
    ├── nodeHelpers.ts      # 图节点构建与转换
    ├── passwordPolicy.ts   # 密码策略校验
    ├── retry.ts            # 重试机制
    ├── taskStatusTransitions.ts  # 任务状态机转换表
    ├── wikiLink.ts         # Wiki 链接解析
    └── __tests__/
```

## 使用规范

### 前端导入

```typescript
import { Graph, Node, Edge } from '@shared/types';
```

### 后端导入

```typescript
import { Graph, Node, Edge } from '../shared/types/index.js';
```

## 类型分类

### graph.ts
图谱核心类型：
- `Graph` - 图谱
- `Node` - 节点
- `Edge` - 边
- `KnowledgePoint` - 知识点
- `Template` - 模板
- `GraphRelation` - 图谱关系

### scheduler.ts
调度相关类型：
- `ScheduledTask` - 计划任务
- `TaskExecution` - 任务执行
- `Queue` - 队列
- `FocusSession` - 专注会话
- `Achievement` - 成就

### user.ts
用户相关类型：
- `User` - 用户
- `UserProfile` - 用户配置

### common.ts
通用类型：
- 分页
- 响应包装
- 通用枚举

## 注意事项

1. 所有前后端共享的类型必须定义在此目录
2. 仅前端使用的类型定义在 `src/types/`
3. 仅后端使用的类型定义在 `api/` 相应模块中
