/**
 * 后端「落库任务标题」的集中构建函数。
 *
 * 背景：后端进程（api/）不加载前端 locale 资源，i18next.t() 对缺失 key 会返回
 * 原始 key 字符串（见 api/utils/i18n.ts 的 returnNull:false 设计），导致持久化到
 * `user_tasks.title` 的任务标题变成未经翻译的 `scheduler.graphTask.titles.studyGraph`
 * 这类 key。
 *
 * 落库数据应当是可直接显示的可读文案，因此这里在 shared/ 集中构建标题供 api/ 使用
 * （api/ 只能依赖 shared/，不能 import 前端 src/i18n/locales/*）。
 *
 * 文案与 src/i18n/locales/zh-CN 中对应 key 的值保持一致。
 */

/** 图谱学习大任务标题：`学习图谱: <图谱名>` */
export function formatStudyGraphTaskTitle(graphTitle: string): string {
  return `学习图谱: ${graphTitle}`;
}

/** 知识点学习任务标题：`学习: <知识点名/标题>` */
export function formatStudyTaskTitle(title: string): string {
  return `学习: ${title}`;
}

/** 知识点复习任务标题：`复习: <知识点名/标题>` */
export function formatReviewTaskTitle(title: string): string {
  return `复习: ${title}`;
}

/** 学习路径节点子任务标题：`学习路径节点: <节点标题>` */
export function formatPathNodeSubtaskTitle(title: string): string {
  return `学习路径节点: ${title}`;
}

/** 学习路径主任务标题：`[学习路径] <路径标题>` */
export function formatLearningPathTaskTitle(pathTitle: string): string {
  return `[学习路径] ${pathTitle}`;
}

/** 学习路径节点转为独立任务标题：`[学习] <节点标题>` */
export function formatNodeTaskTitle(nodeTitle: string): string {
  return `[学习] ${nodeTitle}`;
}

/** 学习路径的默认标题（自动生成路径时未见名则使用） */
export const DEFAULT_LEARNING_PATH_TITLE = "学习路径";

/** 测验集合标题：`测验: <知识点名>` */
export function formatQuizSetTitle(title: string): string {
  return `测验: ${title}`;
}