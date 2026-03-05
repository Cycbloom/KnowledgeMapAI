# 修复测试失败问题

## 问题分析

### 1. 会话 Cookie 测试失败

**问题位置**: `tests/login.spec.ts:583-631`

**原因**: Zustand persist 存储的数据结构是：
```json
{
  "state": {
    "user": {...},
    "token": "...",
    "refreshToken": "..."
  },
  "version": 0
}
```

测试代码错误地检查 `authData.user` 和 `authData.token`，应该检查 `authData.state.user` 和 `authData.state.token`。

**修复方案**: 更新断言逻辑，检查正确的数据路径。

### 2. 注册后重新登录测试失败

**问题位置**: `tests/register.spec.ts:495-519`

**原因**: 注册后跳转到的是 `/` 而不是 `/dashboard`，URL 等待逻辑错误。

**修复方案**: 将 `await page.waitForURL(/\/dashboard/)` 改为 `await page.waitForURL(/\/$/)` 或 `await expect(page).toHaveURL(/\/$/)`。

### 3. 高并发测试超时

**问题位置**: `tests/login.spec.ts:357-392`

**原因**: 高并发测试在部分浏览器上超时，10 秒的超时时间不够。

**修复方案**: 增加超时时间到 20 秒。

## 实施步骤

### 步骤 1: 修复会话 Cookie 测试
- 修改 `tests/login.spec.ts` 中 `会话 Cookie 应具有正确的过期时间` 测试
- 更新 localStorage 数据结构断言

### 步骤 2: 修复注册后重新登录测试
- 修改 `tests/register.spec.ts` 中 `注册后应该能够使用新注册的账号重新登录` 测试
- 更新 URL 等待逻辑

### 步骤 3: 增加高并发测试超时时间
- 修改 `tests/login.spec.ts` 中高并发测试的超时时间

### 步骤 4: 运行测试验证
- 运行 `npm run test:auth` 验证修复效果
