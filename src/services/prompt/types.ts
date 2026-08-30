export type PromptScope = 'system' | 'user' | 'graph';

export interface PromptTemplate {
  id: string;
  code: string;
  scope: PromptScope;
  user_id?: string;
  graph_id?: string;
  template_content: string;
  created_at: string;
  updated_at: string;
}

export interface PromptListOptions {
  scope?: PromptScope;
  userId?: string;
  graphId?: string;
}

export interface PromptCreateData {
  code: string;
  scope: PromptScope;
  template_content: string;
  user_id?: string;
  graph_id?: string;
}

export interface PromptUpdateData {
  template_content?: string;
  code?: string;
}
