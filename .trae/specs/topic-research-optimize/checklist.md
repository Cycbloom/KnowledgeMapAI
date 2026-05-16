# Checklist

- [x] 创建 experiment_science Preset 图谱后，`graph_backbone_modules` 表包含实验设计、数据收集等正确模块
- [x] 默认 Preset（不选）创建图谱后，模块仍为 academic_research 的 6 个标准模块（向后兼容）
- [x] 文献概念提取时嵌入向量使用批量 API 生成，15 个概念仅 1-2 次 API 调用（非 15 次）
- [x] 批量嵌入失败时自动回退到逐个生成，流程不中断
- [x] 第二个 topic_research 图谱导入与第一个图谱相同的论文时，/extract 响应包含跨图谱相似概念标记
- [x] LiteratureExtractPanel 前端正确展示跨图谱相似概念的图谱名称和匹配度
- [x] GET /api/graphs/:id/research-progress 返回按模块统计的概念数、文献数
- [x] ResearchProgressPanel 识别并高亮标记概念数为 0 的模块为"研究空白"
- [x] GET /api/graphs/:id/analysis/module-gaps 对未分类概念 >=10 的图谱返回 needsNewModule: true
- [x] GET /api/graphs/:id/analysis/module-overlap 对有重叠的模块返回相似度数据
- [x] GET /api/graphs/:id/literature 返回去重后的文献列表，包含概念数和模块归属
- [x] LiteratureLibraryPanel 按 backboneModule 过滤文献功能正常
- [x] 类型检查通过（npm run check）
- [x] 代码检查通过（npm run lint）