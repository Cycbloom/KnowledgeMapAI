# 整理配置文件实施计划

## 目标

集中管理环境变量，统一配置加载方式，消除冗余和不一致。

## 当前问题分析

### 1. 环境变量验证重复

| 文件 | 功能 | 问题 |
|------|------|------|
| `api/utils/env.ts` | 简单的环境变量验证 | 功能简单，与 envValidator.ts 重复 |
| `api/utils/envValidator.ts` | 完整的环境变量验证和类型转换 | 功能更完善，但未被充分使用 |

**问题**：两个文件功能重叠，`server.ts` 使用的是简单的 `env.ts`，而 `envValidator.ts` 提供了更完善的功能但未被使用。

### 2. 错误码定义位置

| 文件 | 功能 | 决定 |
|------|------|------|
| `api/config/errorCodes.ts` | 错误码定义 | 保留（定义位置） |
| `api/constants/errorCodes.ts` | 重导出文件 | **保留**（作为统一导入入口，30 个文件使用） |

**决定**：保留 `constants/errorCodes.ts` 作为统一的导入入口，避免修改 30 个文件。

### 3. 环境变量使用分散

直接使用 `process.env` 的文件有 20 个，但 `envValidator.ts` 已提供便捷访问函数。

### 4. .env.example 不完整

当前 `.env.example` 缺少一些实际使用的环境变量。

## 实施步骤

### 步骤 1：统一环境变量验证

**操作**：
1. 删除 `api/utils/env.ts`（功能简单版本）
2. 更新 `server.ts` 使用 `envValidator.ts` 中的验证函数

**受影响文件**：
- `api/server.ts` - 更新导入路径

### 步骤 2：更新 .env.example

**操作**：
补充缺失的环境变量，确保与实际使用一致：

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Provider Configuration (At least one required)
DEEPSEEK_API_KEY=your_deepseek_key
VOLCENGINE_API_KEY=your_volcengine_key
ALIYUN_API_KEY=your_aliyun_key

# Cache Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Server Configuration (Optional)
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

# TTS Service Configuration (Optional)
TTS_SERVICE_URL=http://localhost:8001

# Test Configuration (Optional)
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test123456

# Rate Limit Configuration (Optional)
DISABLE_RATE_LIMIT=true
```

### 步骤 3：更新 ENV_SCHEMA

**操作**：
在 `envValidator.ts` 中补充缺失的环境变量定义：
- `VITE_SUPABASE_URL`（标记为必需）
- `SUPABASE_SERVICE_ROLE_KEY`（标记为必需）
- `TTS_SERVICE_URL`
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`
- `DISABLE_RATE_LIMIT`

## 文件变更清单

### 需要删除的文件
- `api/utils/env.ts`（功能与 envValidator.ts 重复）

### 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `api/server.ts` | 导入路径 `env.ts` → `envValidator.ts` |
| `api/utils/envValidator.ts` | 补充缺失的环境变量定义 |
| `.env.example` | 补充缺失的环境变量，添加注释说明 |

## 风险评估

- **风险等级**：低
- **影响范围**：仅涉及配置文件整理，不改变业务逻辑
- **回滚方案**：恢复删除的文件

## 预期结果

1. 环境变量验证统一使用 `envValidator.ts`
2. `.env.example` 完整反映实际需求
3. 配置加载方式统一，代码更易维护
