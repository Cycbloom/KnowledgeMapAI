# 移动端原生体验优化 Spec

## Why
当前移动端体验存在以下问题：
1. 手势操作不够流畅，双指缩放和滑动切换体验不够原生
2. 离线模式下功能受限，无法在无网络时查看和编辑图谱
3. PWA 推送通知功能不完善，用户无法及时收到重要提醒

优化移动端体验可以大幅提升用户在移动设备上的使用体验，增加用户粘性。

## What Changes
- 增强手势操作支持（双指缩放优化、滑动切换视图、边缘滑动返回）
- 实现完整的离线模式（IndexedDB 存储、离线编辑队列、同步机制）
- 完善 PWA 推送通知（Web Push API、通知权限管理、后台同步）
- 新增移动端手势配置界面

## Impact
- Affected specs: 移动端交互、数据同步、通知系统
- Affected code: 
  - `src/components/GraphEditor/canvas/MindMapCanvas.tsx`
  - `src/utils/serviceWorker.ts`
  - `src/hooks/common/useNetworkStatus.ts`
  - `vite.config.ts` (PWA 配置)
  - `src/utils/schedulerNotifications.ts`
  - 新增 `src/hooks/common/useGestures.ts`
  - 新增 `src/utils/offlineStorage.ts`
  - 新增 `src/utils/backgroundSync.ts`

## ADDED Requirements

### Requirement: 手势操作优化
系统 SHALL 提供流畅的移动端手势操作体验。

#### Scenario: 双指缩放优化
- **WHEN** 用户在图谱画布上使用双指进行缩放
- **THEN** 系统应以画布中心或双指中心为锚点进行平滑缩放
- **AND** 缩放范围限制在 0.1x 到 4x 之间
- **AND** 缩放过程应有平滑动画效果

#### Scenario: 双指旋转
- **WHEN** 用户在图谱画布上使用双指进行旋转
- **THEN** 系统应支持图谱的旋转操作
- **AND** 旋转角度应有吸附效果（每 45 度吸附）

#### Scenario: 滑动切换视图
- **WHEN** 用户在图谱页面左右滑动
- **THEN** 系统应支持在不同视图模式间切换（思维导图、时间线、树形、星球视图）
- **AND** 滑动过程应有跟随效果
- **AND** 滑动距离超过阈值后完成切换

#### Scenario: 边缘滑动返回
- **WHEN** 用户从屏幕左边缘向右滑动
- **THEN** 系统应触发返回上一页操作
- **AND** 滑动过程应有页面跟随效果

#### Scenario: 快速滑动（Fling）
- **WHEN** 用户快速滑动画布后松手
- **THEN** 画布应继续滑动一段距离并逐渐减速
- **AND** 减速过程应有物理惯性效果

### Requirement: 离线模式增强
系统 SHALL 提供完整的离线功能支持。

#### Scenario: 离线数据存储
- **WHEN** 用户在有网络时访问图谱
- **THEN** 系统应自动将图谱数据缓存到 IndexedDB
- **AND** 缓存应包括节点、边、样式设置等完整数据

#### Scenario: 离线浏览
- **WHEN** 用户在无网络时打开应用
- **THEN** 系统应显示已缓存的图谱列表
- **AND** 用户可以正常查看和操作已缓存的图谱

#### Scenario: 离线编辑
- **WHEN** 用户在离线模式下编辑图谱
- **THEN** 系统应将编辑操作记录到离线队列
- **AND** 编辑应正常保存到本地存储
- **AND** 界面应显示离线状态指示器

#### Scenario: 自动同步
- **WHEN** 网络恢复连接
- **THEN** 系统应自动将离线编辑同步到服务器
- **AND** 同步过程应显示进度
- **AND** 同步冲突应提示用户选择解决方案

#### Scenario: 离线状态提示
- **WHEN** 用户处于离线状态
- **THEN** 系统应在界面顶部显示离线状态栏
- **AND** 显示待同步的操作数量
- **AND** 提供手动同步按钮

### Requirement: PWA 推送通知
系统 SHALL 提供完整的 PWA 推送通知功能。

#### Scenario: 通知权限请求
- **WHEN** 用户首次使用通知功能
- **THEN** 系统应显示友好的权限请求说明
- **AND** 用户同意后注册推送订阅

#### Scenario: 学习提醒推送
- **WHEN** 到达用户设定的学习提醒时间
- **THEN** 系统应发送推送通知提醒用户学习
- **AND** 通知应包含待复习的知识点数量

#### Scenario: 协作通知推送
- **WHEN** 其他用户邀请当前用户协作或修改了共享图谱
- **THEN** 系统应发送推送通知
- **AND** 点击通知应跳转到对应图谱

#### Scenario: 后台同步通知
- **WHEN** 后台同步完成或有冲突需要处理
- **THEN** 系统应发送推送通知告知用户
- **AND** 通知应包含同步结果摘要

#### Scenario: 通知管理
- **WHEN** 用户访问通知设置页面
- **THEN** 系统应提供通知类型开关
- **AND** 提供免打扰时段设置
- **AND** 提供通知声音选择

### Requirement: 手势配置界面
系统 SHALL 提供移动端手势配置选项。

#### Scenario: 手势设置入口
- **WHEN** 用户在移动端访问设置页面
- **THEN** 系统应显示手势设置选项

#### Scenario: 手势灵敏度调节
- **WHEN** 用户调节手势灵敏度
- **THEN** 系统应保存设置并立即生效

#### Scenario: 手势开关
- **WHEN** 用户关闭某项手势功能
- **THEN** 该手势应被禁用
- **AND** 系统应提供替代操作方式

## MODIFIED Requirements

### Requirement: PWA Manifest 配置
原有的 PWA manifest SHALL 更新以支持：
- 添加 `display: "standalone"` 以提供全屏体验
- 添加 `orientation` 支持横竖屏锁定
- 添加 `shortcuts` 快捷方式
- 添加 `share_target` 分享目标配置

### Requirement: Service Worker 缓存策略
原有的 Service Worker SHALL 更新缓存策略：
- 图谱数据使用 NetworkFirst 策略并缓存到 IndexedDB
- 静态资源使用 CacheFirst 策略
- API 请求添加离线队列支持

## REMOVED Requirements
无移除的需求。
