# Vite HTML Proxy 错误修复计划

## 错误分析

```
No matching HTML proxy module found from D:/KnowledgeMap/index.html?html-proxy&index=0.js
```

### 错误原因

这个错误是 Vite 的 HTML 代理模块系统问题。`?html-proxy&index=0.js` 后缀表明 Vite 正在尝试将 HTML 文件中的内联脚本作为模块处理。

在 `index.html` 第 11-21 行有一个内联的 `<script type="module">`：

```html
<script type="module">
  if (import.meta.hot?.on) {
    import.meta.hot.on('vite:error', (error) => {
      // ...
    })
  }
</script>
```

这个内联脚本使用了 `import.meta.hot`（Vite HMR 功能）。错误通常由以下原因导致：

1. **Vite 缓存损坏** - `.vite` 缓存目录与实际文件不同步
2. **模块解析失败** - Vite 无法正确匹配 HTML 代理模块
3. **热更新状态不一致** - 开发服务器的 HMR 状态出现问题

## 修复步骤

### 步骤 1：清除 Vite 缓存
删除 `node_modules/.vite` 缓存目录，这是最常见的解决方案。

### 步骤 2：重启开发服务器
停止当前运行的开发服务器，然后重新启动。

### 步骤 3（备选）：完全重装依赖
如果上述步骤无效，删除 `node_modules` 并重新安装依赖。

## 执行命令

```bash
# 方案 1：清除 Vite 缓存（推荐首选）
rm -rf node_modules/.vite
npm run dev

# 方案 2：完全重装（如果方案 1 无效）
rm -rf node_modules
npm install
npm run dev
```

## 预防措施

1. 在修改 `index.html` 中的内联脚本后，考虑清除 `.vite` 缓存
2. 确保 `import.meta.hot` 的使用有适当的条件检查（当前代码已有 `?.on` 可选链）
