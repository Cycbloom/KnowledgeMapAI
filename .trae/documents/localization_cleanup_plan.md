# 本地化文件精简计划

## 问题分析

通过分析 `en-US.json` 和 `zh-CN.json` 文件，发现以下重复问题：

### 1. 错误信息重复
在两个文件中，存在大量重复的错误信息条目，例如：
- `AUTH_TOKEN_MISSING` 和 `TOKEN_MISSING`
- `AUTH_TOKEN_INVALID` 和 `INVALID_TOKEN`
- `AUTH_TOKEN_EXPIRED` 和 `TOKEN_EXPIRED`
- `AUTH_UNAUTHORIZED` 和 `UNAUTHORIZED`
- `RESOURCE_NOT_FOUND` 和 `NOT_FOUND`
- 以及其他类似的重复错误信息

### 2. 功能模块重复
- `nodeSelector` 在两个地方重复定义
- `challenge` 在两个地方重复定义
- `learning` 和 `study` 部分有一些重复内容

## 解决方案

### 1. 错误信息精简
- 保留带有前缀的错误信息（如 `AUTH_*`, `RESOURCE_*`, `VALIDATION_*` 等）
- 删除不带前缀的重复错误信息
- 确保所有代码中使用的是保留的错误信息键

### 2. 功能模块精简
- 合并重复的 `nodeSelector` 定义
- 合并重复的 `challenge` 定义
- 清理 `learning` 和 `study` 部分的重复内容

### 3. 验证过程
- 运行 `npm run lint` 检查代码规范
- 运行 `npm run check` 检查类型错误
- 确保应用功能正常运行

## 实施步骤

1. **分析错误信息重复**：识别并列出所有重复的错误信息键
2. **确定保留的错误信息**：选择更具描述性的键名保留
3. **更新代码引用**：确保代码中使用的是保留的错误信息键
4. **清理重复模块**：合并重复的功能模块定义
5. **验证修改**：运行测试确保修改不影响功能

## 预期结果

- 减少本地化文件的体积
- 消除重复的错误信息和功能模块
- 保持代码的一致性和可维护性
- 确保应用功能不受影响