# Supabase 迁移文件整合计划

## 目标
将现有的 36 个迁移文件合并成一个完整的 schema 文件，并在本地 Docker 运行全新的 Supabase 实例。

## 步骤

### 1. 启动本地 Supabase
- 使用 `npx supabase init` 初始化本地配置（如需要）
- 使用 `npx supabase start` 启动本地 Docker 实例
- 本地 Supabase 自带图形化界面（Studio），访问 http://localhost:54323

### 2. 分析现有迁移文件
- 读取所有 36 个迁移文件
- 理解每个表、索引、函数、策略的定义
- 识别并解决冲突（如 `state` 字段被删除后又引用的问题）

### 3. 创建合并后的 schema 文件
- 创建一个 `00000000000000_initial_schema.sql` 文件
- 包含所有表的最终状态定义
- 包含所有索引、函数、RLS 策略
- 删除所有旧的迁移文件

### 4. 重置本地数据库
- 停止并清理本地 Supabase 数据
- 使用新的 schema 文件初始化数据库

### 5. 验证
- 确保所有表结构正确
- 确保学习卡片保存功能正常工作

## 本地 Supabase 图形化界面
是的，本地 Supabase 支持 Studio 图形化界面：
- 地址: http://localhost:54323
- 功能: 表编辑器、SQL 编辑器、数据浏览、认证管理等

## 注意事项
- 本地 Supabase 数据与云端独立
- 需要重新创建测试数据
- 环境变量需要更新为本地地址
