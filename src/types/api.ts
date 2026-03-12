export interface AIActionVariables {
  includeParent?: boolean;
  includeSiblings?: boolean;
  includeChildren?: boolean;
}

export interface AIAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  target_mode: 'show_result' | 'update_node' | 'spawn_children';
  scope: 'system' | 'user' | 'graph';
  user_id?: string;
  graph_id?: string;
  prompt_template: string;
  variables?: AIActionVariables;
}
