# Checklist

## GraphEditor 组件
- [x] GraphEditor 正确计算 isReadOnly 状态
- [x] isReadOnly 状态传递到 GraphOutline
- [x] isReadOnly 状态传递到 NodeDetailSidebar
- [x] isReadOnly 状态传递到其他相关子组件

## NodeDetailSidebar 组件
- [x] isReadOnly 属性已添加到组件接口
- [x] 只读模式下隐藏编辑按钮
- [x] 只读模式下隐藏删除按钮
- [x] 只读模式下隐藏 AI 生成相关按钮
- [x] 只读模式下隐藏学习相关按钮
- [x] 只读模式下显示只读提示

## GraphOutline 组件
- [x] isReadOnly 属性已添加到组件接口
- [x] 只读模式下隐藏添加节点按钮
- [x] 只读模式下隐藏批量操作按钮
- [x] 只读模式下禁用多选模式
- [x] 只读模式下隐藏连接发现功能
- [x] 只读模式下禁用节点删除操作

## GraphEditor 节点操作
- [x] 只读模式下双击节点显示详情
- [x] 只读模式下禁用节点拖拽
- [x] 只读模式下禁用边编辑

## 测试验证
- [x] npm run lint 通过
- [x] npm run check 通过
- [x] 只读模式下各组件功能正常
- [ ] 编辑模式下功能正常
