# 项目规则

## 数据库操作

### 禁止使用的命令

**绝对禁止使用以下命令：**

1. `npx supabase db reset` - 此命令会删除所有本地数据库数据，不可恢复
2. `supabase db reset` - 同上

### 安全的数据库迁移命令

对于本地 Supabase 数据库迁移，使用以下安全命令：

1. `npx supabase migration up` - 应用新的迁移文件
2. `npx supabase db push` - 推送迁移到远程数据库（需要先 link）

### 迁移失败处理

如果迁移失败，正确的处理方式：

1. 修改迁移文件修复问题
2. 如果是 RPC 函数返回类型变更，使用 `DROP FUNCTION IF EXISTS` 先删除再创建
3. 手动在数据库中执行修复 SQL
4. **永远不要使用 db reset 来解决迁移问题**

## 其他规则

（待补充）
