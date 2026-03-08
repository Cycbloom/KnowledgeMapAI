# 下一阶段工作计划：类型定义统一与组件迁移

## 目标

1. 将前后端的类型定义统一到 `shared/types/` 目录
2. 进行组件的物理迁移，按功能域组织

---

## 任务一：类型定义统一

### 当前状态
- `shared/types/` 已存在基础类型定义
- 前端 `src/types/index.ts` 有重复定义
- 后端各服务文件中有独立的接口定义
- `src/services/api/modules/scheduler/` 中也有类型定义

### 实施步骤

#### 1. 完善 shared/types 文件
- 检查并补充缺失的类型定义
- 确保类型定义完整且准确

#### 2. 更新前端类型导入
- 更新 `src/types/index.ts` 从 `@shared/types` 重新导出
- 更新 `src/services/api/modules/scheduler/*.ts` 使用共享类型
- 更新其他使用本地类型的文件

#### 3. 更新后端类型导入
- 更新 `api/services/scheduler/*.ts` 使用共享类型
- 更新 `api/routes/scheduler/*.ts` 使用共享类型
- 更新其他服务文件

#### 4. 验证
- 运行 `npm run check` 确保类型正确
- 运行 `npm run lint` 确保代码规范

---

## 任务二：组件迁移

### 目标结构
```
src/components/
├── common/          # 通用组件
│   ├── ErrorBoundary.tsx
│   ├── LoadingBar.tsx
│   ├── Empty.tsx
│   └── ...
├── features/        # 功能组件
│   ├── Scheduler/
│   ├── GraphEditor/
│   ├── Study/
│   └── ...
└── layout/          # 布局组件
    ├── Layout.tsx
    ├── Breadcrumb.tsx
    └── ...
```

### 实施步骤

#### 1. 迁移通用组件
- 识别并迁移通用组件到 `common/`
- 更新索引文件

#### 2. 迁移功能组件
- 迁移 Scheduler 相关组件
- 迁移 GraphEditor 相关组件
- 迁移 Study 相关组件
- 迁移其他功能组件

#### 3. 迁移布局组件
- 迁移 Layout、Breadcrumb 等布局组件

#### 4. 更新导入路径
- 使用 IDE 批量更新导入路径
- 验证所有组件正常工作

---

## 风险和注意事项

1. **类型兼容性**：确保共享类型与现有代码兼容
2. **导入路径**：组件迁移后需要更新所有导入路径
3. **渐进式迁移**：可以按模块逐步迁移，避免大规模改动
4. **测试验证**：每次迁移后运行类型检查和功能测试

---

## 预期收益

- 类型定义统一，减少重复代码
- 组件按功能域组织，易于查找和维护
- 代码结构更加清晰
