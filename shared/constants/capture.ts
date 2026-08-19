/**
 * 捕获箱（Capture Inbox）相关常量
 *
 * 捕获箱复用于笔记体系：捕获即一条挂上保留 tag 的普通笔记，
 * AI 归档时复用 notes 的 extract-concepts + create-nodes 链路，把捕获内容建连进图谱。
 * 该文件为前后端共享的权威数据源，禁止在路由/组件内硬编码 tag 字符串。
 */

/** 捕获箱保留 tag：带此 tag 的笔记视为"未处理的捕获" */
export const CAPTURE_INBOX_TAG = 'inbox';

/** 单条捕获 AI 归档时，自动挑选的最大知识点数量 */
export const CAPTURE_DEFAULT_MAX_CONCEPTS = 3;

/** 单条捕获 AI 归档时，允许挑选的知识点数量上限 */
export const CAPTURE_MAX_CONCEPTS_LIMIT = 8;