# Summary 字段 UI 展示增强计划（第一批：核心4项）

## 修改清单

### 1. NodeEditSidebar — 添加 summary 编辑入口
**文件**: `src/components/GraphEditor/sidebar/NodeEditSidebar.tsx`
- `NodeFormState` 接口添加 `summary: string`
- 初始化表单时从 `node.summary` 取值
- 在"标题"输入框下方添加 summary 输入框，placeholder: "20-30字短概述，用于图谱预览"，maxLength: 200
- 保存时将 summary 传入更新 API

### 2. NodeDetailSidebar — 添加 summary 副标题
**文件**: `src/components/GraphEditor/sidebar/NodeDetailSidebar.tsx`
- 在标题下方、元数据行之前，添加 summary 展示
- 样式：灰色小字（text-sm text-gray-500），类似副标题
- 仅当 `node.summary` 存在时显示

### 3. CombinedNodeDetailSidebar — 添加 summary 副标题
**文件**: `src/components/CombinedView/CombinedNodeDetailSidebar.tsx`
- 同 NodeDetailSidebar 的处理方式

### 4. SearchResults — 用 summary 替代 content 截断
**文件**: `src/components/common/SearchResults.tsx`
- 搜索结果预览文本改为：`node.summary || node.content?.slice(0, 50)`
- 后端搜索 API 需确认返回 summary 字段

## 验证步骤

1. `npm run check` 类型检查通过
2. `npm run lint` 代码规范通过
3. 选中节点，右侧详情面板显示 summary 副标题
4. 编辑节点，summary 输入框可编辑并保存
5. 搜索节点，结果优先显示 summary
