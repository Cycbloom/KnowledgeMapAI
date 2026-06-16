export interface ITasksApi {
  create(data: { type: string; payload: unknown }): Promise<unknown>;

  list(status?: string, limit?: number, offset?: number): Promise<unknown>;

  retry(id: string): Promise<unknown>;

  delete(id: string): Promise<unknown>;
}

export interface ISearchApi {
  query(q: string, type?: 'keyword' | 'semantic' | 'hybrid'): Promise<unknown>;
}

export interface IDataApi {
  export(graphId: string, format: 'json' | 'pdf' | 'markdown'): Promise<Blob>;

  import(data: unknown): Promise<unknown>;
}
