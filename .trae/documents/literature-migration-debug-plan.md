# 文献信息不完整问题排查与修复计划

## 问题分析

用户反馈：数据库迁移完成后，悬浮卡片展示的信息仍然不完整。

### 🔍 根本原因

**核心问题：旧数据未迁移到新表**

1. ✅ 数据库 `literature_sources` 表已成功创建（schema 正确）
2. ❌ 但表中可能为空或数据很少
3. ❌ 原有文献信息只存储在节点的 `properties.sources` (JSON) 字段中
4. ⚠️ 只有**数据库迁移后新提取的文献**才会自动保存到 `literature_sources` 表

### 📊 当前数据流

```
[旧流程] 文件上传 → AI提取 → 保存到节点.properties.sources (JSON)
                                          ↓
                              [只包含基础字段: title, authors, year, url, fileName]

[新流程] 文件上传 → AI提取 → ① 保存到节点.properties.sources (原有)
                            → ② 保存到 literature_sources 表 (新增完整字段)
                                          ↓
                              [包含所有字段: +type, journal, doi, keywords, abstract...]
```

## 排查步骤

### 步骤 1：验证 literature_sources 表是否有数据

**方法 A：通过 Supabase Studio 查看**
1. 打开 http://127.0.0.1:54323 (本地 Supabase 管理界面)
2. 进入 Table Editor → literature_sources
3. 检查表中是否有记录

**方法 B：使用 SQL 查询**
```sql
SELECT COUNT(*) as total_records FROM literature_sources;
SELECT * FROM literature_sources LIMIT 5;
```

**预期结果：**
- 如果 count = 0 → 表明没有新数据被保存（正常，需要迁移旧数据）
- 如果 count > 0 → 查看这些记录是否包含完整字段

### 步骤 2：检查浏览器控制台日志

打开 Learning Mode 页面的文献视图，检查 Console：

**应该看到的日志：**
```javascript
// 成功查询到数据时无错误日志
// 失败时会显示:
// "Failed to fetch literature sources: {...}"
// "Error fetching literature sources: {...}"
```

### 步骤 3：验证 graphId 是否正确传递

在 GraphOutline 组件中添加临时调试日志（可选）：

```typescript
console.log("🔍 Debug:", {
  graphId,
  templateType,
  literatureSourcesMapSize: literatureSourcesMap.size,
  sampleData: literatureSourcesMap.size > 0 
    ? Array.from(literatureSourcesMap.values())[0] 
    : null
});
```

## 解决方案

### 方案 A：创建数据迁移脚本（推荐）

**目标：将现有节点的 sources 数据批量导入 literature_sources 表**

#### 实现方式 1：SQL 迁移脚本

创建文件：`supabase/migrations/59_migrate_literature_sources.sql`

```sql
-- 从现有节点的 properties.sources 中提取文献信息
-- 并插入到 literature_sources 表

INSERT INTO literature_sources (graph_id, title, authors, year, url, file_name, type)
SELECT DISTINCT
  kp.graph_id,
  source->>'title' as title,
  CASE 
    WHEN jsonb_typeof(source->'authors') = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(source->'authors'))
    ELSE NULL
  END as authors,
  (source->>'year')::INTEGER as year,
  source->>'url' as url,
  source->>'fileName' as file_name,
  'document' as type  -- 默认类型，因为旧数据没有此字段
FROM knowledge_points kp,
  LATERAL jsonb_array_elements(kp.properties->'sources') as source
WHERE kp.properties->'sources' IS NOT NULL
  AND jsonb_array_length(kp.properties->'sources') > 0
  AND NOT EXISTS (
    SELECT 1 FROM literature_sources ls
    WHERE ls.graph_id = kp.graph_id 
      AND ls.title = source->>'title'
  )
ON CONFLICT (graph_id, title, doi) DO NOTHING;

-- 验证迁移结果
SELECT COUNT(*) as migrated_count FROM literature_sources;
```

#### 实现方式 2：API 端点迁移接口

在 `api/routes/literature.ts` 中添加：

```typescript
// POST /api/literature/migrate-sources
export async function migrateExistingLiteratureSources(req: Request, res: Response) {
  const { graph_id } = req.body;
  
  // 1. 查询该图谱的所有节点
  const { data: nodes } = await supabase
    .from('knowledge_points')
    .select('id, properties')
    .eq('graph_id', graph_id);
  
  // 2. 提取所有唯一的 sources
  const uniqueSources = new Map<string, any>();
  
  for (const node of nodes || []) {
    const sources = node.properties?.sources || [];
    for (const source of sources) {
      if (!uniqueSources.has(source.title)) {
        uniqueSources.set(source.title, source);
      }
    }
  }
  
  // 3. 批量插入到 literature_sources
  const literatureData = Array.from(uniqueSources.values()).map(source => ({
    graph_id,
    title: source.title,
    authors: source.authors,
    year: source.year,
    url: source.url,
    file_name: source.fileName,
    type: 'document', // 旧数据默认值
  }));
  
  const { error } = await supabase
    .from('literature_sources')
    .upsert(literatureData, { onConflict: 'graph_id,title,doi' });
  
  res.json({ 
    success: !error, 
    migratedCount: literatureData.length,
    error: error?.message 
  });
}
```

#### 实现方式 3：前端 UI 触发迁移（最友好）

在 LiteratureExtractPanel 或 GraphOutline 中添加"同步文献元数据"按钮：

```tsx
<button onClick={handleMigrateLiteratureSources}>
  🔄 同步文献元数据
</button>
```

### 方案 B：临时调试方案（快速验证）

如果想快速验证功能是否工作，可以手动插入测试数据：

```sql
-- 手动插入一条测试数据
INSERT INTO literature_sources (
  graph_id, title, authors, year, type, journal, 
  doi, keywords, abstract
) VALUES (
  '<你的graph_id>',
  'Test Paper Title',
  ARRAY['Author One', 'Author Two'],
  2024,
  'paper',
  'Nature',
  '10.1038/test12345',
  ARRAY['AI', 'Machine Learning', 'Knowledge Graph'],
  'This is a test abstract for verifying the hover card functionality.'
);
```

然后在 UI 中验证悬浮卡片是否显示完整信息。

## 推荐实施顺序

### 阶段 1：立即验证（5分钟）
1. ✅ 检查 literature_sources 表是否为空
2. ✅ 在浏览器控制台查看错误日志
3. ✅ 可选：手动插入测试数据验证 UI 展示

### 阶段 2：实现迁移功能（30分钟）
4. 📝 创建 SQL 迁移脚本 `59_migrate_literature_sources.sql`
5. 🔧 或实现 API 迁移端点
6. 🎨 或添加 UI 同步按钮

### 阶段 3：完善与优化（15分钟）
7. ✅ 测试迁移后的数据显示
8. ✅ 移除临时调试代码
9. ✅ 更新文档说明

## 预期效果

完成迁移后：

| 场景 | 迁移前 | 迁移后 |
|------|--------|--------|
| **旧文献** | 只显示 title, authors, year, url | 显示所有可用字段 |
| **新文献** | 自动保存完整信息 | 显示所有字段 |
| **悬浮卡片** | 信息不完整 | 🎉 完整展示 |

## 下一步行动

请选择一个方案实施：

- **A**: 我帮你创建 SQL 迁移脚本（推荐，一次性解决）
- **B**: 我帮你实现 API 迁移接口（更灵活）
- **C**: 我帮你添加 UI 同步按钮（用户体验最好）
- **D**: 先手动插入测试数据验证功能是否正常

你希望采用哪种方案？
