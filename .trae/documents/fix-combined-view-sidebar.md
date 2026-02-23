# 修复联立视图侧边栏布局问题

## 问题分析

在 `Layout.tsx` 第 29 行：
```javascript
const isFullScreenPage = location.pathname.startsWith('/graph/') || location.pathname === '/learning';
```

这个判断只包括了 `/graph/` 路径和 `/learning` 路径，但没有包括 `/combined-graphs/` 路径。

导致访问联立视图页面时：
1. 侧边栏会显示
2. 顶部 Header 也会显示
3. 页面标题栏被侧边栏挤压，向右偏移

## 解决方案

修改 `isFullScreenPage` 的判断条件，添加对 `/combined-graphs/` 路径的支持：

```javascript
const isFullScreenPage = 
  location.pathname.startsWith('/graph/') || 
  location.pathname.startsWith('/combined-graphs/') || 
  location.pathname === '/learning';
```

## 修改文件

- `d:\KnowledgeMap\src\components\Layout.tsx` - 第 29 行
