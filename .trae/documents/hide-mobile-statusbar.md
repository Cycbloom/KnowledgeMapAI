# 隐藏移动端状态栏计划

## 问题分析

用户希望在移动端应用中隐藏顶部的系统状态栏（显示时间、电量、信号等的栏）。

当前状态：
- `capacitor.config.ts` 配置了 StatusBar 插件，设置了深色样式和白色背景
- `useMobileInit.ts` 在初始化时设置了状态栏样式
- `index.css` 中有 `html { padding-top: env(safe-area-inset-top, 0px); }` 为安全区域预留空间

## 解决方案

使用 Capacitor 的 StatusBar 插件的 `hide()` 方法来隐藏状态栏，实现全屏沉浸式体验。

## 实施步骤

### 步骤 1：修改 `useMobileInit.ts`

在移动端初始化时，调用 `StatusBar.hide()` 来隐藏状态栏：

```typescript
// 将原来的设置样式代码改为隐藏状态栏
await StatusBar.hide();
```

### 步骤 2：修改 `capacitor.config.ts`

移除或注释掉 StatusBar 的样式配置（因为要隐藏它，样式配置不再需要）：

```typescript
plugins: {
  SplashScreen: {
    // ... 保持不变
  },
  // 移除 StatusBar 配置
},
```

### 步骤 3：修改 `index.css`

移除 `html` 元素顶部的安全区域 padding，因为状态栏隐藏后不再需要：

```css
html {
  /* 移除这行：padding-top: env(safe-area-inset-top, 0px); */
  padding-bottom: env(safe-area-inset-bottom, 0px);
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
```

### 步骤 4：检查并调整相关组件

检查使用了 `safe-area-inset-top` 的组件，确保它们能正确处理状态栏隐藏后的布局：

- `Layout.tsx` - 移除 `pt-[var(--safe-area-inset-top)]`
- `OfflineStatusBar.tsx` - 移除 `pt-[var(--safe-area-inset-top)]`

## 涉及的文件

1. `src/hooks/useMobileInit.ts` - 隐藏状态栏
2. `capacitor.config.ts` - 移除 StatusBar 配置
3. `src/index.css` - 移除顶部安全区域 padding
4. `src/components/Layout/Layout.tsx` - 移除顶部安全区域 padding
5. `src/components/common/OfflineStatusBar.tsx` - 移除顶部安全区域 padding

## 注意事项

- 隐藏状态栏后，用户将无法看到时间、电量等信息
- 如果用户需要恢复状态栏，可以通过 `StatusBar.show()` 方法
- 某些 Android 设备可能有不同的行为表现
