# 前端架构

## 目录结构

```
src/
├── App.tsx             # 应用根组件
├── main.tsx            # 应用入口
├── index.css           # 全局样式
│
├── components/         # UI 组件
│   ├── common/         # 通用组件
│   ├── Layout/         # 布局组件
│   ├── GraphEditor/    # 图谱编辑器
│   ├── GraphMap/       # 图谱地图
│   ├── Scheduler/      # 调度模块
│   ├── Study/          # 学习模块
│   ├── Statistics/     # 统计模块
│   └── ...             # 其他功能模块
│
├── config/             # 前端配置
│   ├── graphConfig.ts
│   ├── nodeStyleConfig.ts
│   ├── relationshipTypes.ts
│   └── shortcuts.ts
│
├── hooks/              # React Hooks
│   ├── queries/        # React Query 查询
│   ├── mutations/      # React Query 变更
│   ├── graphAI/        # 图谱 AI 相关
│   ├── graphEditor/    # 图谱编辑器状态
│   └── *.ts            # 其他 hooks
│
├── lib/                # 工具库
│   ├── graph/          # 图谱算法
│   ├── graphUtils.ts
│   └── utils.ts
│
├── pages/              # 页面组件
│   ├── Dashboard.tsx
│   ├── GraphEditor.tsx
│   ├── Scheduler.tsx
│   └── ...
│
├── services/           # API 服务
│   ├── api/            # API 模块
│   │   ├── modules/    # 子模块
│   │   └── *.ts        # API 定义
│   └── api.ts
│
├── store/              # 状态管理 (Zustand)
│   ├── useStore.ts     # 主 Store
│   └── useXxxStore.ts  # 其他 Store
│
├── types/              # 类型定义
│   └── index.ts
│
├── utils/              # 工具函数
│   ├── layouts/        # 布局算法
│   ├── errors.ts
│   └── ...
│
└── __tests__/          # 测试文件
```

## 架构层次

1. **页面层 (pages/)**: 路由对应的页面组件
2. **组件层 (components/)**: 可复用的 UI 组件
3. **Hooks 层 (hooks/)**: 状态逻辑和副作用
4. **服务层 (services/)**: API 调用封装
5. **状态层 (store/)**: 全局状态管理

## 命名规范

- 组件文件: `PascalCase.tsx`
- Hook 文件: `useXxx.ts`
- API 模块: `xxx.ts` 或 `xxxApi.ts`
- Store 文件: `useXxxStore.ts`

## 导入规范

- 使用 `@/` 别名导入 src 目录下的模块
- 使用 `@shared/` 别名导入共享类型
