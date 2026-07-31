# 前端架构

## 目录结构

```
src/
├── App.tsx             # 应用根组件
├── main.tsx            # 应用入口
├── index.css           # 全局样式
├── vite-env.d.ts       # Vite 类型声明
│
├── assets/             # 静态资源（图片、字体等）
│
├── components/         # UI 组件
│   ├── common/         # 通用组件（Button、Loading、Modal 等）
│   ├── Layout/         # 布局组件
│   ├── AutoGraph/      # 自动建图
│   ├── Console/        # 控制台/命令行
│   ├── Dashboard/      # 仪表盘
│   ├── GraphMap/       # 图谱地图
│   ├── Notes/          # 笔记编辑
│   ├── PromptConfig/   # Prompt 配置
│   ├── Quiz/           # 测验
│   ├── RAGChat/        # RAG 聊天
│   ├── Scheduler/      # 调度模块
│   ├── Settings/       # 设置
│   ├── Study/          # 学习模块
│   └── Workbench/      # 工作台
│
├── config/             # 前端配置
│   ├── authConfig.ts
│   ├── electronConfig.ts
│   ├── graphConfig.ts
│   ├── learningStatusColors.ts
│   ├── mobileApiConfig.ts
│   ├── nodeStyleConfig.ts
│   ├── relationshipTypes.ts
│   ├── shortcuts.ts
│   └── themePresets.ts
│
├── constants/          # 常量定义
│   ├── scheduler.ts
│   └── timer.ts
│
├── data/               # 预设数据
│   └── presetTemplates.ts
│
├── hooks/              # React Hooks
│   ├── ai/             # AI 相关 hooks
│   ├── calendar/       # 日历 hooks
│   ├── common/         # 通用 hooks（useAutoSave, useTheme, useWorker 等）
│   ├── console/        # 控制台 hooks
│   ├── dashboard/      # 仪表盘 hooks
│   ├── graphAI/        # 图谱 AI 相关 hooks
│   ├── graphEditor/    # 图谱编辑器 hooks
│   ├── mobile/         # 移动端 hooks
│   ├── mutations/      # React Query 变更
│   ├── notes/          # 笔记 hooks
│   ├── queries/        # React Query 查询
│   ├── quiz/           # 测验 hooks
│   ├── scheduler/      # 调度 hooks
│   └── study/          # 学习 hooks
│
├── i18n/               # 国际化
│   ├── locales/        # 语言包（en-US/、zh-CN/）
│   │   ├── en-US/      # 英文翻译
│   │   └── zh-CN/      # 中文翻译
│   ├── i18n.d.ts       # i18n 类型声明
│   └── index.ts        # i18n 初始化
│
├── pages/              # 页面组件
│   ├── GraphEditor/    # 图谱编辑器页面
│   ├── Notes/          # 笔记页面
│   ├── Achievements.tsx
│   ├── CalendarPage.tsx
│   ├── CombinedGraphView.tsx
│   ├── CombinedViewPage.tsx
│   ├── CurrentTask.tsx
│   ├── Dashboard.tsx
│   ├── GraphEditor.tsx
│   ├── GraphMap.tsx
│   ├── Home.tsx
│   ├── LearningMode.tsx
│   ├── LearningPathDetail.tsx
│   ├── LearningPaths.tsx
│   ├── LearningStatsCenter.tsx
│   ├── Login.tsx
│   ├── Profile.tsx
│   ├── QuizPractice.tsx
│   ├── QuizPreview.tsx
│   ├── RecycleBin.tsx
│   ├── Register.tsx
│   ├── Scheduler.tsx
│   ├── SchedulerStats.tsx
│   ├── Settings.tsx
│   ├── SetupWizard.tsx
│   ├── Statistics.tsx
│   ├── StatisticsCenter.tsx
│   ├── Study.tsx
│   ├── TaskDetailPage.tsx
│   ├── Tasks.tsx
│   ├── Templates.tsx
│   └── UnifiedWorkbench.tsx
│
├── services/           # API 服务
│   ├── api/            # API 客户端模块
│   │   ├── contracts/  # 接口契约
│   │   ├── mobile/     # 移动端 API
│   │   ├── client.ts
│   │   ├── createApiClient.ts
│   │   └── ...         # 各模块 API 定义
│   ├── console/        # 控制台服务
│   ├── kernel/         # 前端内核
│   ├── mobile/         # 移动端服务
│   ├── api.ts
│   ├── backboneValidator.ts
│   ├── celebrationService.ts
│   ├── FrontendEventTypes.ts
│   └── indexMapping.ts
│
├── shared/             # 前端共享工具
│   └── utils/
│       └── validators.ts
│
├── store/              # 状态管理 (Zustand)
│   ├── createPersistedStore.ts
│   ├── storeIntegrations.ts
│   ├── useConsoleStore.ts
│   ├── useFocusStore.ts
│   ├── useNoiseStore.ts
│   ├── useNotificationsStore.ts
│   ├── usePerformanceStore.ts
│   ├── usePreferencesStore.ts
│   ├── useShortcutStore.ts
│   ├── useStore.ts
│   ├── useThemeStore.ts
│   └── useTimerStore.ts
│
├── styles/             # 样式文件
│   └── scheduler.css
│
├── three/              # Three.js 3D 视图
│   ├── layout/         # 3D 布局算法
│   └── PlanetView.tsx
│
├── types/              # 类型定义
│   ├── calendar.ts
│   ├── global.d.ts
│   └── index.ts
│
├── utils/              # 工具函数（唯一工具函数目录，取代原 lib/）
│   ├── graph/          # 图算法
│   ├── layouts/        # 布局算法
│   ├── asyncConfirm.tsx
│   ├── formatters.ts
│   ├── logger.ts
│   ├── messageHelper.ts
│   └── ...             # 其他工具函数
│
└── setupTests.ts       # 测试设置
```

## 架构层次

1. **页面层 (pages/)**: 路由对应的页面组件
2. **组件层 (components/)**: 可复用的 UI 组件
3. **Hooks 层 (hooks/)**: 状态逻辑和副作用
4. **服务层 (services/)**: API 调用封装
5. **状态层 (store/)**: 全局状态管理 (Zustand)
6. **国际化层 (i18n/)**: 多语言翻译资源
7. **工具层 (utils/)**: 纯函数工具库
8. **配置层 (config/)**: 应用配置常量
9. **3D 视图层 (three/)**: Three.js 3D 渲染

## 命名规范

- 组件文件: `PascalCase.tsx`
- Hook 文件: `useXxx.ts`
- API 模块: `xxx.ts` 或 `xxxApi.ts`
- Store 文件: `useXxxStore.ts`

## 导入规范

- 使用 `@/` 别名导入 src 目录下的模块
- 使用 `@shared/` 别名导入共享类型
