/** 各资源携带某标签的记录数 */
export interface TagResourceCounts {
  graphs: number;
  notes: number;
  tasks: number;
}

/** 标签聚合条目（跨图谱/笔记/任务） */
export interface TagSummary {
  name: string;
  counts: TagResourceCounts;
  total: number;
}

export interface ITagsApi {
  list(): Promise<{ tags: TagSummary[] }>;

  rename(from: string, to: string): Promise<{ updated: TagResourceCounts }>;

  merge(sources: string[], target: string): Promise<{ updated: TagResourceCounts }>;

  delete(name: string): Promise<{ removed: TagResourceCounts }>;
}
