# AI 测验生成功能 Checklist

## 数据库验证

- [x] quiz_sets 表创建成功，包含所有必要字段
- [x] quiz_set_cards 关联表创建成功
- [x] study_cards 表成功添加 quiz_set_id 字段
- [x] RLS 策略正确配置，用户只能访问自己的测验集合
- [x] 外键约束正确设置，级联删除正常工作

## 后端 API 验证

- [x] GET /quiz-sets 返回用户的测验集合列表
- [x] POST /quiz-sets 成功创建测验集合
- [x] GET /quiz-sets/:id 返回测验集合详情及所有题目
- [x] PUT /quiz-sets/:id 成功更新测验集合信息
- [x] DELETE /quiz-sets/:id 成功删除测验集合及关联卡片
- [x] POST /quiz-sets/generate 成功启动测验生成任务
- [x] POST /quiz-sets/:id/regenerate/:cardId 成功重新生成单题

## AI 生成功能验证

- [x] AI 生成的题目符合指定难度级别
- [x] 批量生成任务正确执行并追踪进度
- [x] 生成失败时正确处理错误并支持重试
- [x] 生成的题目内容质量符合预期

## 前端界面验证

- [x] 测验列表正确显示所有测验集合
- [x] 知识点选择器支持多选和按图谱筛选
- [x] 题型配置正确统计题目数量
- [x] 难度选择正确传递到生成请求
- [x] 生成进度正确显示
- [x] 测验预览正确显示所有题目
- [x] 题目编辑功能正常工作
- [x] 单题重新生成功能正常工作

## 测验练习验证

- [x] 测验练习模式正确显示题目
- [x] 进度条正确显示当前进度
- [x] 测验结果统计正确计算正确率
- [x] 错题重练功能正常工作

## 代码质量验证

- [x] `npm run lint` 通过无错误
- [x] `npm run check` 类型检查通过
- [ ] `npx playwright test` 所有测试通过
