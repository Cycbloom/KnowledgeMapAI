# 修复 Dashboard 测试错误

## 问题分析

### 1. Mobile Safari 创建图谱弹窗无法打开

**错误信息**：
```
TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
waiting for locator('input[placeholder*="例如"]') to be visible
```

**原因**：在移动端，需要先点击 FAB（浮动操作按钮）展开菜单，然后点击"新建图谱"菜单项。

**修复方案**：
- 更新 `openCreateGraphModal()` 方法，检测是否存在 FAB 按钮
- 如果存在 FAB，先点击 FAB 展开菜单，再点击"新建图谱"菜单项
- 增加超时时间到 15 秒

### 2. 标签筛选测试选择器问题

**原因**：标签云组件在移动端可能不可见或选择器不正确。

**修复方案**：
- 已更新选择器为 `div:has(h3:has-text("标签云")) + div button[class*="rounded-full"]`
- 测试中已有条件判断，如果没有标签则跳过

## 实施步骤

### 步骤 1: 修复 DashboardPage.ts 的 openCreateGraphModal 方法
- ✅ 添加 FAB 按钮检测逻辑
- ✅ 增加等待时间和重试逻辑

### 步骤 2: 运行测试验证
- 运行 `npm run test:dashboard` 验证修复效果
