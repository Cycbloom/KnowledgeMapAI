# 修复任务详情页空白问题

## 问题总结

点击"查看详情"后能跳转到 `/scheduler/task/{id}`，但页面内容为空（或几乎看不到内容）。

## 根因分析

**路由层级错误——TaskDetailPage 被渲染在 Layout 内部的滚动容器中**

### 当前路由结构

```
App.tsx:
├── /login          ← 独立页面
├── /setup          ← 独立页面
├── /graph/:id      ← 独立全屏页面（GraphEditor）
└── /               ← Layout 包裹
    ├── dashboard
    ├── scheduler
    ├── scheduler/task/:taskId   ← ❌ 错误：在 Layout 内部！
    └── ...
```

### 为什么会空白

1. `TaskDetailPage.tsx` 渲染 `TaskWorkbench` 组件，使用 `h-full overflow-hidden`
2. 但它被渲染在 [Layout.tsx](file:///d:/KnowledgeMap/src/components/Layout/Layout.tsx#L437-L443) 的滚动容器内：
   ```tsx
   <div className="flex-1 overflow-y-auto custom-scrollbar relative ...">
     <AnimatedOutlet />  {/* TaskDetailPage 在这里 */}
   </div>
   ```
3. `TaskWorkbench` 是一个**全屏应用式组件**（自带 header、左侧面板、标签页、底部操作栏），类似 GraphEditor
4. 它被嵌套在 Layout 的 `overflow-y-auto` 滚动容器中，`h-full` 无法正确获取高度，导致内容被压缩或不可见
5. 对比：`/graph/:id` 的 GraphEditor 路由在 Layout **外部**定义（[App.tsx:236](file:///d:/KnowledgeMap/src/App.tsx#L236)），所以正常显示

## 修复方案

将 `scheduler/task/:taskId` 路由从 Layout 内部移到外部，与 `/graph/:id` 同级。

### 修改文件

**`d:\KnowledgeMap\src\App.tsx`**

1. 删除第 266 行的 `<Route path="scheduler/task/:taskId" element={<TaskDetailPage />} />`（Layout 内部）
2. 在第 236 行（`/graph/:id` 路由之后）添加：
   ```tsx
   <Route path="/scheduler/task/:taskId" element={<ProtectedRoute><TaskDetailPage /></ProtectedRoute>} />
   ```

## 验证步骤

1. 启动开发服务器
2. 进入任务调度器 → 智能推荐卡片 → 点击"查看详情"
3. 确认任务详情页以全屏方式正确展示（无侧边栏、无顶部导航栏遮挡）
4. 确认返回按钮能回到调度器页面
