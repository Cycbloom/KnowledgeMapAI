/**
 * 后端 i18next 资源包（方案 B）。
 *
 * 后端进程（api/）不加载前端 locale，此前 i18next.t() 全部返回原始 key
 * （见 api/utils/i18n.ts）。此处把后端实际用到的命名空间语言资源集中存放在
 * shared/（api/ 与 src/ 均只依赖 shared/），后端初始化时加载这些资源，
 * 使其 i18next.t() 返回真实翻译。
 *
 * 注意：这里只覆盖后端会用到的命名空间（scheduler、study、learningPath、
 * graphMap、quiz、notes、collaborators、relationshipTypes），与前端聚合器
 * src/i18n/locales/{zh-CN,en-US}/index.ts 从同一处 shared 文件读取，保证单一来源。
 */
import schedulerZh from './locales/zh-CN/scheduler.json';
import studyZh from './locales/zh-CN/study.json';
import learningPathZh from './locales/zh-CN/learningPath.json';
import graphMapZh from './locales/zh-CN/graphMap.json';
import quizZh from './locales/zh-CN/quiz.json';
import notesZh from './locales/zh-CN/notes.json';
import collaboratorsZh from './locales/zh-CN/collaborators.json';
import relationshipTypesZh from './locales/zh-CN/relationshipTypes.json';

import schedulerEn from './locales/en-US/scheduler.json';
import studyEn from './locales/en-US/study.json';
import learningPathEn from './locales/en-US/learningPath.json';
import graphMapEn from './locales/en-US/graphMap.json';
import quizEn from './locales/en-US/quiz.json';
import notesEn from './locales/en-US/notes.json';
import collaboratorsEn from './locales/en-US/collaborators.json';
import relationshipTypesEn from './locales/en-US/relationshipTypes.json';

/** 后端用到的命名空间集合，供初始化与校验 */
export const BACKEND_NAMESPACES = [
  'scheduler',
  'study',
  'learningPath',
  'graphMap',
  'quiz',
  'notes',
  'collaborators',
  'relationshipTypes',
] as const;

/**
 * 前端聚合器按语言使用这些命名空间对象（避免跨 composite 项目直接 import 单个
 * JSON 文件引发 TS6307）。前端 src/i18n/locales/{zh-CN,en-US}/index.ts 从中解构。
 */
export const zhNameSpaces = {
  scheduler: schedulerZh,
  study: studyZh,
  learningPath: learningPathZh,
  graphMap: graphMapZh,
  quiz: quizZh,
  notes: notesZh,
  collaborators: collaboratorsZh,
  relationshipTypes: relationshipTypesZh,
} as const;

export const enNameSpaces = {
  scheduler: schedulerEn,
  study: studyEn,
  learningPath: learningPathEn,
  graphMap: graphMapEn,
  quiz: quizEn,
  notes: notesEn,
  collaborators: collaboratorsEn,
  relationshipTypes: relationshipTypesEn,
} as const;

/**
 * 后端默认语言（与前端 DEFAULT_LANGUAGE 一致，避免 unicode 转义影响可读性）。
 * 实际资源注入由 api/utils/i18n.ts 用 addResourceBundle 基于 zhNameSpaces/enNameSpaces
 * 完成，此处不再单独导出 resources 结构，避免与 i18next 的 Resource 类型强耦合。
 */
export const BACKEND_DEFAULT_LANGUAGE = 'zh-CN';