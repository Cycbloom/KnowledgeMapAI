import { logger } from '../../utils/logger.js';

export const cleanJsonString = (str: string): string => {
  let cleaned = str.trim();
  
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  return cleaned.trim();
};

export const parseAIResponse = <T>(content: string, context: string): T => {
  const cleaned = cleanJsonString(content);
  try {
    return JSON.parse(cleaned);
  } catch {
    logger.warn(`[AI] JSON Parse Error (${context}). Attempting regex fallback.`);
    const match = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        throw new Error(`Failed to parse AI response for ${context}`);
      }
    }
    throw new Error(`Failed to parse AI response for ${context}`);
  }
};

export const buildTutorContext = (context: {
  currentNodeId?: string;
  currentNodeTitle?: string;
  currentNodeContent?: string;
  existingNodes?: string[];
  userProgress?: { masteredCount?: number; dueCount?: number };
  learningPath?: string[];
}): string => {
  let contextStr = '';
  
  if (context.currentNodeId && context.currentNodeTitle) {
    contextStr += `\nCurrent Node:\n- Title: ${context.currentNodeTitle}\n- Content: ${context.currentNodeContent || '(No content)'}\n`;
  }
  
  if (context.existingNodes && context.existingNodes.length > 0) {
    contextStr += `\nExisting Nodes in Graph:\n${context.existingNodes.slice(0, 20).join(', ')}\n`;
  }
  
  if (context.userProgress) {
    contextStr += `\nUser Progress:\n- Mastered: ${context.userProgress.masteredCount || 0} nodes\n- Due for review: ${context.userProgress.dueCount || 0} nodes\n`;
  }
  
  if (context.learningPath && context.learningPath.length > 0) {
    contextStr += `\nSuggested Learning Path:\n${context.learningPath.join(' → ')}\n`;
  }
  
  return contextStr || 'No specific context provided.';
};
