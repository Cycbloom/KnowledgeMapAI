# 控制台清空个人数据功能 Spec

## Why

在开发调试过程中，开发者需要快速清除当前登录用户的个人数据（知识图谱、任务、学习记录等），以便重新测试功能或清理测试数据。目前没有便捷的方式完成此操作，每次都需要手动逐个删除或在数据库中执行 SQL，效率低下。

## What Changes

- 在控制台新增 `reset` 命令，用于清空当前登录用户的个人数据
- 新增后端 API 端点 `/data/reset` 支持按用户 ID 清除其所有关联数据
- 该命令标记为 **danger** 权限级别，需要输入确认文本才能执行
- 支持可选参数指定要清除的数据类型（图谱/任务/全部等）
- 执行前显示将要删除的数据统计信息供确认
- 执行后返回清除结果摘要

## Impact

- Affected specs: integrate-built-in-console (扩展)
- Affected code:
  - `src/services/console/commands/data.ts` - 新增 reset 命令
  - `api/routes/data.ts` - 新增 reset 端点
  - `src/services/console/commands/index.ts` - 导出新命令

## ADDED Requirements

### Requirement: 控制台 reset 命令

系统应在控制台提供 `reset` 命令用于清空当前用户的个人数据。

#### Scenario: 查看将清除的数据预览（dry-run）

- **WHEN** 用户输入 `reset --dry-run`
- **THEN** 系统列出当前用户各表中的数据条数，但不实际删除

#### Scenario: 清空全部个人数据

- **WHEN** 用户输入 `reset --confirm`
- **THEN**
  1. 系统首先显示 dry-run 统计信息
  2. 要求用户输入确认文本 "RESET" 或 "确认"
  3. 确认后按依赖顺序依次删除用户的所有关联数据
  4. 返回删除结果摘要

#### Scenario: 选择性清除特定类型数据

- **WHEN** 用户输入 `reset --type graphs --confirm`
- **THEN** 仅清除指定类型的用户数据（支持 types: graphs, tasks, study, all）

#### Scenario: 未提供确认参数时拒绝执行

- **WHEN** 用户仅输入 `reset` 不带 `--confirm`
- **THEN** 显示使用说明和警告，提示添加 `--dry-run` 预览或 `--confirm` 确认执行

### Requirement: 后端 Reset API

后端应提供安全的用户数据重置接口。

#### Scenario: Dry-run 模式

- **WHEN** 请求 `POST /data/reset?dry_run=true`
- **THEN** 返回当前用户各关联表的记录数统计，不执行删除

#### Scenario: 执行重置

- **WHEN** 请求 `POST /data/reset` 并携带确认信息
- **THEN** 按正确的外键依赖顺序删除用户数据，返回操作结果

#### Scenario: 删除顺序保证

- **GIVEN** 数据库存在外键约束（如 knowledge_graphs 的 ON DELETE CASCADE）
- **WHEN** 执行重置操作
- **THEN** 先删除无外键依赖的子表数据，再删除父表数据，避免约束冲突

## Technical Design

### 删除顺序（考虑外键依赖）

```
1. graph_collaborators     - 图谱协作者
2. learning_path_progress  - 学习路径进度
3. task_subtasks           - 任务子任务
4. task_links              - 任务链接
5. task_knowledge_points   - 任务知识点关联
6. task_dependencies       - 任务依赖
7. task_executions         - 任务执行记录
8. task_tags               - 任务标签
9. task_settings           - 任务设置
10. task_schedules          - 任务计划
11. task_progress_plans    - 任务进度计划
12. user_time_slots        - 用户时间段
13. user_achievements      - 用户成就
14. daily_tasks            - 每日任务
15. focus_sessions         - 专注会话
16. user_focus_stats       - 用户专注统计
17. user_efficiency_profile - 用户效率画像
18. user_pass_progress     - 用户通行证进度
19. periodic_passes        - 周期通行证
20. periodic_tasks         - 周期任务
21. task_reviews           - 任务复习
22. path_node_tasks       - 路径节点任务
23. knowledge_review_tasks - 知识复习任务
24. quiz_set_cards         - 测验卡片
25. study_cards            - 学习卡片
26. study_progress         - 学习进度
27. backup_snapshots       - 备份快照
28. queues                 - 队列
29. scheduled_tasks        - 计划任务
30. edges                  - 边（关系）
31. graph_nodes            - 图谱节点
32. graph_domains          - 图谱领域
33. graph_relations        - 图谱关系
34. learning_paths         - 学习路径
35. learning_path_nodes    - 学习路径节点
36. ai_actions             - AI 操作记录
37. prompt_templates       - 提示词模板（用户级）
38. templates              - 模板
39. achievements           - 成就（内置保留）
40. tasks                  - 异步任务
41. knowledge_points       - 知识点
42. knowledge_point_versions - 知识点版本
43. domains                - 领域
44. quiz_sets              - 测验集
45. knowledge_graphs       - 知识图谱
46. app_settings           - 应用设置（可选保留）
47. relationship_types     - 关系类型（保留内置）
```

### 命令定义

```typescript
const resetCommand: Command = {
  name: 'reset',
  description: '清空当前用户的个人数据（调试用途）',
  usage: 'reset [--type <all|graphs|tasks|study>] [--confirm] [--dry-run]',
  permission: 'danger',
  options: [
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: '数据类型: all(全部), graphs(图谱), tasks(任务), study(学习)',
      required: false,
      default: 'all'
    },
    {
      name: 'confirm',
      alias: 'c',
      type: 'boolean',
      description: '确认执行（危险操作）',
      required: false
    },
    {
      name: 'dry-run',
      alias: 'd',
      type: 'boolean',
      description: '仅预览将要删除的数据，不实际删除',
      required: false
    }
  ],
  handler: handleReset
};
```

### API 接口设计

```
POST /data/reset
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "confirm": true,           // 是否确认执行
  "dry_run": false,          // 是否仅预览
  "types": ["all"]           // 要清除的类型数组
}

Response:
{
  "success": true,
  "summary": {
    "total_deleted": 150,
    "tables": [
      { "table": "knowledge_graphs", "deleted": 5 },
      { "table": "tasks", "deleted": 30 }
    ]
  }
}
```
