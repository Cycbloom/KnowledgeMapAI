export interface NodeContextOptions {
  includeContent?: boolean;
  includeProperties?: boolean;
  includeLearningMaterial?: boolean;
  maxContentLength?: number;
}

export interface NodeData {
  title?: string;
  content?: string;
  learning_material?: string;
  properties?: Record<string, unknown>;
}

export function buildNodeContext(
  node: NodeData,
  options: NodeContextOptions = {}
): string {
  const { 
    includeContent = true, 
    includeProperties = false, 
    includeLearningMaterial = false, 
    maxContentLength = 500 
  } = options;
  
  const parts: string[] = [];
  
  if (node.title) {
    parts.push(`标题: ${node.title}`);
  }
  
  if (includeContent && node.content) {
    const content = node.content.length > maxContentLength
      ? `${node.content.substring(0, maxContentLength)}...`
      : node.content;
    parts.push(`内容: ${content}`);
  }
  
  if (includeLearningMaterial && node.learning_material) {
    parts.push(`学习材料: ${node.learning_material}`);
  }
  
  if (includeProperties && node.properties) {
    const tags = node.properties.tags as string[];
    if (tags && tags.length > 0) {
      parts.push(`标签: ${tags.join(', ')}`);
    }
  }
  
  return parts.join('\n');
}

export function buildNodesContext(
  nodes: NodeData[],
  options: NodeContextOptions = {}
): string {
  return nodes.map((n, i) => `[${i + 1}] ${buildNodeContext(n, options)}`).join('\n\n');
}

export interface TutorContextOptions {
  currentNodeId?: string;
  currentNodeTitle?: string;
  currentNodeContent?: string;
  existingNodes?: string[];
  userProgress?: { masteredCount?: number; dueCount?: number };
  learningPath?: string[];
}

export function buildTutorContext(context: TutorContextOptions): string {
  let contextStr = '';
  
  if (context.currentNodeId && context.currentNodeTitle) {
    contextStr += `\n当前节点:\n- 标题: ${context.currentNodeTitle}\n- 内容: ${context.currentNodeContent || '(无内容)'}\n`;
  }
  
  if (context.existingNodes && context.existingNodes.length > 0) {
    contextStr += `\n图谱中的现有节点:\n${context.existingNodes.slice(0, 20).join(', ')}\n`;
  }
  
  if (context.userProgress) {
    contextStr += `\n用户进度:\n- 已掌握: ${context.userProgress.masteredCount || 0} 个节点\n- 待复习: ${context.userProgress.dueCount || 0} 个节点\n`;
  }
  
  if (context.learningPath && context.learningPath.length > 0) {
    contextStr += `\n建议学习路径:\n${context.learningPath.join(' → ')}\n`;
  }
  
  return contextStr || '暂无特定上下文。';
}
