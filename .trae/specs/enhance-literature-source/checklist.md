# Checklist

## 类型定义

- [x] LiteratureInfo 类型已扩展，包含 journal, doi, keywords, abstract 等新字段
- [x] LiteratureType 类型已添加 "report" 和 "webpage"
- [x] ReferenceBook 类型已扩展，包含 year, journal, doi 等新字段

## 后端服务

- [x] literatureMetadataService.ts 已创建
- [x] 元数据提取 prompt 模板已实现
- [x] 文献类型自动识别逻辑已实现
- [x] POST /api/literature/metadata 接口已实现
- [x] POST /api/literature/extract 接口已增强，支持来源信息
- [x] POST /api/literature/apply 接口已增强，保存来源到图谱

## 前端组件

- [x] LiteratureMetadataForm 组件已创建
- [x] 来源信息区域可折叠展开
- [x] "自动识别"按钮功能正常
- [x] 识别结果可预览和编辑
- [x] LiteratureMetadataCard 组件已创建
- [x] LiteratureExtractPanel 已集成来源信息表单
- [x] 提取结果中显示来源信息卡片

## API 服务

- [x] 前端 extractMetadata 方法已实现
- [x] 前端 extractConcepts 方法已增强

## 国际化

- [x] 中文翻译已添加
- [x] 英文翻译已添加

## 功能验证

- [x] 手动输入来源信息功能正常
- [x] 从文本内容自动识别元数据功能正常
- [x] 从 URL 自动识别元数据功能正常
- [x] 从 PDF 文件自动识别元数据功能正常
- [x] 文献类型自动识别准确
- [x] 来源信息正确保存到图谱参考资料
- [x] 节点来源追溯功能正常
