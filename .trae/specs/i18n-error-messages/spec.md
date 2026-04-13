# 错误信息多语言支持 Spec

## Why
当前错误信息硬编码为中文字符串，无法支持其他语言。需要实现多语言支持，让用户可以根据偏好选择界面语言，提升国际化用户体验。

## What Changes
- 引入 i18next 多语言框架
- 扩展现有错误码系统支持多语言
- 创建中英文语言资源文件
- API 返回错误码而非硬编码消息，前端根据语言设置显示对应消息
- 用户可在设置中切换语言

## Impact
- Affected specs: 错误处理系统、用户设置
- Affected code: 
  - `shared/types/errorCodes.ts` - 错误码定义
  - `api/middleware/errorHandler.ts` - 错误处理中间件
  - `src/utils/errors.ts` - 前端错误处理
  - `src/i18n/` - 新增多语言配置目录

## ADDED Requirements

### Requirement: 多语言错误消息
系统 SHALL 支持多语言错误消息显示。

#### Scenario: 中文用户查看错误
- **WHEN** 用户语言设置为中文
- **AND** 发生登录失败错误
- **THEN** 显示 "邮箱或密码错误"

#### Scenario: 英文用户查看错误
- **WHEN** 用户语言设置为英文
- **AND** 发生登录失败错误
- **THEN** 显示 "Invalid email or password"

### Requirement: 语言切换
系统 SHALL 允许用户在设置中切换界面语言。

#### Scenario: 切换语言
- **WHEN** 用户在设置中选择英文
- **THEN** 所有界面文本和错误消息切换为英文

### Requirement: API 错误响应格式
API 错误响应 SHALL 返回错误码和可选参数，而非硬编码消息。

#### Scenario: API 返回错误码
- **WHEN** 登录失败
- **THEN** API 返回 `{ code: "INVALID_CREDENTIALS", params: {} }`
- **AND** 前端根据用户语言显示对应消息

## MODIFIED Requirements

### Requirement: 错误码定义
扩展现有 `shared/types/errorCodes.ts`，添加更多细粒度错误码：

```typescript
// 新增登录相关错误码
INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
EMAIL_NOT_CONFIRMED: 'EMAIL_NOT_CONFIRMED',
TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
USER_NOT_FOUND: 'USER_NOT_FOUND',
```

## Technical Design

### 1. 目录结构
```
src/i18n/
  index.ts          # i18n 配置
  locales/
    zh-CN.json      # 中文翻译
    en-US.json      # 英文翻译
```

### 2. API 错误响应格式
```typescript
// 之前
{ error: "邮箱或密码错误" }

// 之后
{ 
  code: "INVALID_CREDENTIALS",
  message: "邮箱或密码错误",  // 后端默认语言消息（兼容）
  params: {}  // 可选参数用于消息插值
}
```

### 3. 前端错误处理
```typescript
// 使用 i18n 翻译错误码
const { t } = useTranslation();
const errorMessage = t(`errors.${errorCode}`, { defaultValue: error.message });
```
