import type { Note, NoteTemplate, NoteType } from '@shared/types/note';
import { toLocalDateString } from '@shared/utils/dateFormat';

/**
 * notes 表 DB 行(snake_case,来自数据库)
 * 与 Note(camelCase)之间的转换由 mapRowToNote 完成
 */
export interface NoteRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: NoteType;
  date: string | null;
  template_id: string | null;
  tags: string[] | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NoteTemplateRow {
  id: string;
  user_id: string | null;
  name: string;
  content: string;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

/** Daily 模板渲染所需聚合数据(当日静态快照) */
export interface DailyAggregation {
  reviewedCards: number;
  completedTasks: number;
  focusTimeMinutes: number;
}

/** 列表查询返回(含分页元信息) */
export interface NoteListResult {
  items: Note[];
  total: number;
  page: number;
  pageSize: number;
}

/** Daily 自动创建返回 */
export interface GetOrCreateDailyResult {
  note: Note;
  created: boolean;
}

/**
 * 将数据库行(snake_case)映射为 Note 类型(camelCase)。
 * 字段映射与 shared/types/note.ts 的 Note 接口对齐。
 */
export const mapRowToNote = (row: NoteRow): Note => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  content: row.content,
  type: row.type,
  date: row.date,
  templateId: row.template_id,
  tags: row.tags,
  isPinned: row.is_pinned,
  isArchived: row.is_archived,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

export const mapRowToTemplate = (row: NoteTemplateRow): NoteTemplate => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  content: row.content,
  isDefault: row.is_default,
  isSystem: row.is_system,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * 获取本时区当日的 YYYY-MM-DD 字符串。
 * 委托 shared/utils/dateFormat 的 toLocalDateString（与前端 NotesListPage 共用）。
 */
export const getLocalDateString = (date: Date = new Date()): string =>
  toLocalDateString(date);

/**
 * 将 Date 转为本地时区的当日 00:00:00 ISO 字符串(用于范围查询起点)。
 */
export const getDayStartIso = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  return start.toISOString();
};

/**
 * 获取次日 00:00:00 ISO 字符串(范围查询上限,开区间)。
 */
export const getNextDayStartIso = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return next.toISOString();
};