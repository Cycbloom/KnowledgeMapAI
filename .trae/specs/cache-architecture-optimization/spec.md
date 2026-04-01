# 缓存架构优化 - Product Requirement Document

## Overview
- **Summary**: 对 KnowledgeMap 项目的缓存架构进行全面梳理和优化分析，解决 Electron 环境下 Redis 不可用的问题，提供统一、高效、可扩展的缓存方案。
- **Purpose**: 分析当前缓存架构的问题，识别 Electron 环境下的限制，提出优化方案，提高应用性能和用户体验。
- **Target Users**: 开发者、维护者、最终用户

## Goals
- 梳理当前缓存架构的现状和问题
- 解决 Electron 环境下 Redis 不可用的问题
- 提供统一的缓存层，简化缓存管理
- 优化缓存策略，提高缓存命中率
- 确保缓存一致性和可靠性

## Non-Goals (Out of Scope)
- 完全重写缓存系统（采用渐进式优化）
- 引入新的外部依赖（除了已有的 NodeCache）
- 修改数据库架构
- 大规模重构业务逻辑

## Background & Context
当前项目使用了三层缓存架构：
1. **后端缓存** (`api/services/common/cacheService.ts`)：支持 Redis + NodeCache 降级
2. **前端缓存** (`src/utils/dataCache.ts`)：使用内存 Map 缓存
3. **API 缓存封装** (`src/utils/cachedApi.ts`)：基于 dataCache 的 API 调用封装

**主要问题**：
- Electron 环境下没有配置 Redis，完全依赖 NodeCache
- Redis 在桌面应用中不切实际，需要额外的 Redis 服务
- 缓存一致性管理复杂，前后端缓存分离
- 缺乏持久化缓存机制
- 缓存失效策略不够智能

## Functional Requirements
- **FR-1**: 提供统一的缓存接口，支持多种缓存后端
- **FR-2**: 支持内存缓存和持久化缓存（Electron 环境）
- **FR-3**: 实现智能缓存失效策略
- **FR-4**: 提供缓存预热和监控功能
- **FR-5**: 简化缓存使用，减少重复代码

## Non-Functional Requirements
- **NFR-1**: 性能：缓存操作延迟 < 10ms
- **NFR-2**: 可靠性：缓存降级机制完善，无单点故障
- **NFR-3**: 可维护性：代码清晰，文档完善
- **NFR-4**: 兼容性：保持向后兼容，不破坏现有功能

## Constraints
- **Technical**: 保留现有 NodeCache 依赖，不引入新的大型依赖
- **Business**: 优化周期控制在 1-2 周内
- **Dependencies**: 依赖现有的项目结构和构建流程

## Assumptions
- Electron 环境下 Redis 确实不可用或不适合
- NodeCache 在单进程场景下性能足够
- 持久化缓存可以使用 Electron 的文件系统 API

## Acceptance Criteria

### AC-1: 缓存架构梳理完成
- **Given**: 项目当前的缓存实现
- **When**: 完成架构分析文档
- **Then**: 文档清晰描述当前缓存架构、问题和优化方向
- **Verification**: `human-judgment`
- **Notes**: 需要开发者审查架构分析文档

### AC-2: 统一缓存接口设计
- **Given**: 现有的缓存服务
- **When**: 设计统一的缓存接口
- **Then**: 接口支持多种后端，保持向后兼容
- **Verification**: `programmatic`

### AC-3: Electron 持久化缓存
- **Given**: Electron 桌面应用环境
- **When**: 实现持久化缓存
- **Then**: 缓存数据可以在应用重启后恢复
- **Verification**: `programmatic`

### AC-4: 智能缓存失效
- **Given**: 缓存的 key 和依赖关系
- **When**: 数据更新时
- **Then**: 相关缓存自动失效
- **Verification**: `programmatic`

### AC-5: 性能优化
- **Given**: 缓存优化方案
- **When**: 运行性能测试
- **Then**: 缓存命中率提升 > 10%，响应时间降低 > 15%
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要支持 LRU 等缓存淘汰策略？
- [ ] 持久化缓存的容量限制是多少？
- [ ] 是否需要缓存压缩功能？
- [ ] 多窗口/多进程场景下的缓存同步如何处理？
