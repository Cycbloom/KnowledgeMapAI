export { graphTools } from './graphTools';
export { analysisTools } from './analysisTools';
export { learningTools } from './learningTools';
export { nodeTools } from './nodeTools';
export { writeTools } from './writeTools';

import { graphTools } from './graphTools';
import { analysisTools } from './analysisTools';
import { learningTools } from './learningTools';
import { nodeTools } from './nodeTools';
import { writeTools } from './writeTools';
import type { AgentTool } from '../types';

export const allTools: AgentTool[] = [
  ...graphTools,
  ...analysisTools,
  ...learningTools,
  ...nodeTools,
  ...writeTools,
];
