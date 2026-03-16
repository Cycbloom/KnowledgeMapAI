# 知识图谱首页批量删除功能实现计划（续）

## 当前进度

### ✅ 已完成
1. **后端服务** - `graphService.ts` 添加了 `deleteGraphs` 方法
2. **后端路由** - `routes/graphs.ts` 添加了 `POST /graphs/batch/delete` 接口
3. **前端 API** - `graphs.ts` 添加了 `batchDelete` 方法
4. **前端 Mutation** - `useGraphMutations.ts` 添加了 `useBatchDeleteGraphsMutation`
5. **Dashboard 导入** - 已添加必要的导入（CheckSquare, Square, Check 等）

### 🔄 进行中
**Dashboard.tsx UI 修改** - 需要添加以下内容：

#### 1. 添加选择相关状态（已添加）
```typescript
const [isSelectMode, setIsSelectMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

#### 2. 添加选择操作函数
```typescript
const toggleSelect = (id: string) => { ... }
const toggleSelectAll = () => { ... }
const clearSelection = () => { ... }
const handleBatchDelete = () => { ... }
```

#### 3. 修改删除确认状态
扩展 `deleteConfirm` 状态以支持批量删除

#### 4. 添加批量操作工具栏
在选择模式下显示工具栏，包含：
- 全选/取消全选按钮
- 已选数量显示
- 批量删除按钮
- 取消选择按钮

#### 5. 添加"选择"入口按钮
在操作按钮区域添加进入选择模式的按钮

#### 6. 修改图谱卡片
- 选择模式下显示复选框
- 点击卡片切换选中状态（不跳转）
- 选中状态有视觉反馈

## 剩余文件修改

| 文件 | 修改内容 | 状态 |
|------|----------|------|
| `api/routes/graphs.ts` | 添加批量删除路由 | ✅ 完成 |
| `api/services/graph/graphService.ts` | 添加批量删除服务方法 | ✅ 完成 |
| `src/services/api/graphs.ts` | 添加批量删除 API | ✅ 完成 |
| `src/hooks/mutations/useGraphMutations.ts` | 添加批量删除 mutation | ✅ 完成 |
| `src/pages/Dashboard.tsx` | 添加批量选择和删除 UI | 🔄 进行中 |

## 下一步操作

继续修改 `Dashboard.tsx`：
1. 添加选择操作函数
2. 添加批量删除确认弹窗逻辑
3. 在工具栏区域添加"选择"按钮
4. 添加批量操作工具栏组件
5. 修改图谱卡片支持选择模式
