# 组件组织结构重构 - 剩余任务计划

## 概述

继续执行组件组织结构重构的两个可选任务：
1. 提取可复用组件到 `common/`
2. 合并 `LearningMode` 和 `LearningPath` 目录

## 任务一：提取可复用组件到 common/

### 目标
将以下组件从 `GraphEditor/shared/` 移动到 `common/`，使其可被其他模块复用：
- `NodePreviewCard.tsx`
- `VirtualizedNodeList.tsx`
- `VirtualizedEdgeList.tsx`

### 实施步骤

1. **移动 NodePreviewCard.tsx**
   - 从 `src/components/GraphEditor/shared/NodePreviewCard.tsx` 移动到 `src/components/common/NodePreviewCard.tsx`
   - 更新导入路径：`../../../` → `../../`

2. **移动 VirtualizedNodeList.tsx**
   - 从 `src/components/GraphEditor/shared/VirtualizedNodeList.tsx` 移动到 `src/components/common/VirtualizedNodeList.tsx`
   - 更新导入路径：`../../../` → `../../`

3. **移动 VirtualizedEdgeList.tsx**
   - 从 `src/components/GraphEditor/shared/VirtualizedEdgeList.tsx` 移动到 `src/components/common/VirtualizedEdgeList.tsx`
   - 更新导入路径：`../../../` → `../../`

4. **更新 common/index.ts**
   - 添加新组件的导出

5. **更新引用这些组件的文件**
   - `MindMapCanvas.tsx` - 更新 NodePreviewCard 导入
   - `MobileNodePreviewCard.tsx` - 检查是否有依赖
   - 其他可能引用这些组件的文件

6. **验证**
   - 运行 `npm run check`
   - 运行 `npm run lint`

## 任务二：合并 LearningMode 和 LearningPath 目录

### 目标
将 `LearningMode/` 和 `LearningPath/` 合并为统一的 `Learning/` 目录。

### 当前结构
```
components/
├── LearningMode/
│   ├── GenerateCardsModal.tsx
│   ├── LearningPathEditor.tsx
│   └── LearningPathProgress.tsx
├── LearningPath/
│   ├── LearningPathOutline.tsx
│   ├── LearningPathPanel.tsx
│   └── LearningPathWizard.tsx
```

### 目标结构
```
components/
├── Learning/
│   ├── GenerateCardsModal.tsx
│   ├── LearningPathEditor.tsx
│   ├── LearningPathProgress.tsx
│   ├── LearningPathOutline.tsx
│   ├── LearningPathPanel.tsx
│   └── LearningPathWizard.tsx
```

### 实施步骤

1. **创建 Learning/ 目录**

2. **移动 LearningMode/ 下的组件**
   - 移动 `GenerateCardsModal.tsx`
   - 移动 `LearningPathEditor.tsx`
   - 移动 `LearningPathProgress.tsx`

3. **移动 LearningPath/ 下的组件**
   - 移动 `LearningPathOutline.tsx`
   - 移动 `LearningPathPanel.tsx`
   - 移动 `LearningPathWizard.tsx`

4. **更新导入路径**
   - 更新 `LearningMode.tsx` 页面中的导入
   - 更新其他引用这些组件的文件

5. **删除空目录**
   - 删除 `LearningMode/` 空目录
   - 删除 `LearningPath/` 空目录

6. **验证**
   - 运行 `npm run check`
   - 运行 `npm run lint`

## 风险评估

### 任务一风险
- **低风险**：这些组件相对独立，移动后只需更新导入路径
- 注意检查组件间的依赖关系

### 任务二风险
- **中等风险**：涉及多个文件的导入路径更新
- 需要仔细检查所有引用这些组件的地方

## 预计时间
- 任务一：约 15 分钟
- 任务二：约 10 分钟
- 总计：约 25 分钟

## 执行顺序
1. 先执行任务一（提取可复用组件）
2. 再执行任务二（合并 Learning 目录）
3. 最后统一验证
