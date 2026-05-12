# Tasks

- [x] Task 1: 扩展类型定义和常量
  - [x] SubTask 1.1: 在 `shared/types/graph.ts` 中添加 `quadrant` 到 `GraphViewMode` 类型
  - [x] SubTask 1.2: 定义 `CustomRegion` 接口
  - [x] SubTask 1.3: 定义 `QuadrantViewState` 接口
  - [x] SubTask 1.4: 定义 `RegionInfo` 接口

- [x] Task 2: 创建象限视图核心组件
  - [x] SubTask 2.1: 创建 `QuadrantCanvas` 主画布组件
  - [x] SubTask 2.2: 创建 `RegionBackground` 区域背景组件
  - [x] SubTask 2.3: 创建 `RegionHeader` 区域标题组件
  - [x] SubTask 2.4: 创建 `QuadrantNode` 区域内节点组件

- [x] Task 3: 实现极坐标布局算法
  - [x] SubTask 3.1: 创建 `quadrantLayout.ts` 布局工具文件
  - [x] SubTask 3.2: 实现区域角度计算函数
  - [x] SubTask 3.3: 实现节点重要性计算函数
  - [x] SubTask 3.4: 实现节点位置分配算法
  - [x] SubTask 3.5: 实现节点碰撞避免算法

- [x] Task 4: 实现视图切换功能
  - [x] SubTask 4.1: 在 `GraphToolbar` 中添加视图切换下拉菜单
  - [x] SubTask 4.2: 实现视图模式状态管理
  - [x] SubTask 4.3: 实现视图切换逻辑
  - [x] SubTask 4.4: 添加视图切换的国际化文本

- [x] Task 5: 实现区域折叠/展开功能
  - [x] SubTask 5.1: 实现区域折叠状态管理
  - [x] SubTask 5.2: 实现折叠动画效果
  - [x] SubTask 5.3: 实现折叠状态的持久化

- [x] Task 6: 实现自定义区域分组功能
  - [x] SubTask 6.1: 创建 `RegionManagePanel` 区域管理面板组件
  - [x] SubTask 6.2: 实现创建区域分组的对话框
  - [x] SubTask 6.3: 实现区域分组的编辑功能
  - [x] SubTask 6.4: 实现区域分组的删除功能
  - [x] SubTask 6.5: 实现节点添加/移除功能

- [x] Task 7: 实现数据持久化
  - [x] SubTask 7.1: 扩展图谱设置 API 支持象限视图状态
  - [x] SubTask 7.2: 实现区域分组 CRUD API
  - [x] SubTask 7.3: 实现视图状态保存和恢复逻辑

- [x] Task 8: 集成到图谱编辑器
  - [x] SubTask 8.1: 在 `GraphEditor` 中集成象限视图
  - [x] SubTask 8.2: 实现与其他视图的切换逻辑
  - [x] SubTask 8.3: 确保节点编辑、连线等功能正常工作

- [x] Task 9: 编写测试
  - [x] SubTask 9.1: 编写布局算法单元测试
  - [x] SubTask 9.2: 编写象限视图组件测试
  - [x] SubTask 9.3: 编写 E2E 测试验证视图切换和区域交互

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 2]
- [Task 6] depends on [Task 1], [Task 2]
- [Task 7] depends on [Task 1], [Task 5], [Task 6]
- [Task 8] depends on [Task 2], [Task 3], [Task 4], [Task 5], [Task 6], [Task 7]
- [Task 9] depends on [Task 8]
