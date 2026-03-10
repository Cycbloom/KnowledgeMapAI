# 学习路径详情页加载问题修复计划

## 问题描述

点击单个学习路径后，页面一直显示"加载学习路径..."，无法正常显示内容。

## 问题分析

### 根本原因

**前端路由参数名不匹配**

1. **路由定义**（[App.tsx:153](file:///d:/KnowledgeMap/src/App.tsx#L153)）：
   ```tsx
   <Route path="learning-paths/:id" element={<LearningPathDetail />} />
   ```
   路由参数名是 `:id`

2. **组件获取参数**（[LearningPathDetail.tsx:160](file:///d:/KnowledgeMap/src/pages/LearningPathDetail.tsx#L160)）：
   ```tsx
   const { pathId } = useParams<{ pathId: string }>();
   ```
   组件尝试获取名为 `pathId` 的参数

3. **问题**：React Router 会将 URL 参数存储为 `id`，但组件尝试获取 `pathId`，导致 `pathId` 为 `undefined`

### 影响链路

```
URL: /learning-paths/abc-123
     ↓
React Router 解析: params.id = "abc-123"
     ↓
组件获取: const { pathId } = useParams() → pathId = undefined
     ↓
API 调用: learningPathsApi.get(undefined) → 请求失败
     ↓
页面一直显示加载状态
```

## 解决方案

### 方案一：修改组件参数名（推荐）

修改 `LearningPathDetail.tsx` 中的参数名，使其与路由定义一致：

```tsx
// 修改前
const { pathId } = useParams<{ pathId: string }>();

// 修改后
const { id: pathId } = useParams<{ id: string }>();
```

**优点**：
- 只需修改一个文件
- 保持路由定义的一致性（其他路由也使用 `:id`）
- 改动最小，风险最低

### 方案二：修改路由定义

修改 `App.tsx` 中的路由参数名：

```tsx
// 修改前
<Route path="learning-paths/:id" element={<LearningPathDetail />} />

// 修改后
<Route path="learning-paths/:pathId" element={<LearningPathDetail />} />
```

**缺点**：
- 与项目中其他路由的命名风格不一致
- 需要确保所有相关代码都已更新

## 实施步骤

1. 修改 `src/pages/LearningPathDetail.tsx` 第 160 行
2. 运行类型检查 `npm run check`
3. 运行代码检查 `npm run lint`
4. 测试学习路径详情页是否正常加载

## 验证方法

1. 启动开发服务器
2. 进入学习路径列表页
3. 点击任意学习路径
4. 确认页面正常显示学习路径详情内容
