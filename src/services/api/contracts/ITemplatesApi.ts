import type {
  Template,
  TemplateCategory,
  TemplateNode,
  TemplateEdge,
  TemplateLayout,
  TemplateDifficulty,
  LayoutSuggestion,
  UpdateTemplateData,
} from "@shared/types";

export interface SaveTemplateData {
  name: string;
  description?: string;
  category?: TemplateCategory;
  nodes: TemplateNode[];
  edges?: TemplateEdge[];
  layout?: TemplateLayout;
  tags?: string[];
  difficulty?: TemplateDifficulty;
  estimated_nodes?: number;
  layout_suggestion?: LayoutSuggestion;
}

export interface ITemplatesApi {
  list(category?: TemplateCategory): Promise<Template[]>;
  get(id: string): Promise<Template>;
  create(data: SaveTemplateData): Promise<Template>;
  update(id: string, data: UpdateTemplateData): Promise<Template>;
  delete(id: string): Promise<{ message: string }>;
  saveTemplate(data: SaveTemplateData): Promise<Template>;
  updateTemplate(id: string, data: UpdateTemplateData): Promise<Template>;
}

export interface IPromptsApi {
  list(graphId?: string): Promise<unknown>;
  save(data: {
    code: string;
    scope: "user" | "graph";
    template_content: string;
    graph_id?: string;
  }): Promise<unknown>;
  reset(id: string): Promise<unknown>;
  optimize(data: {
    template_content: string;
    instruction?: string;
  }): Promise<unknown>;
}

export interface IFocusApi {
  saveSession(data: {
    duration: number;
    mode: string;
    start_time: string;
    end_time: string;
    task_id?: string;
  }): Promise<unknown>;
  getStats(): Promise<unknown>;
  getTodayStats(): Promise<unknown>;
}
