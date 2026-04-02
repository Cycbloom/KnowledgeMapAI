export { graphCommands, graphCommand, nodeCommand } from './graph';
export { taskCommands, taskCommand } from './task';
export { aiCommands, aiCommand } from './ai';
export { dataCommands, exportCommand, importCommand, backupCommand } from './data';
export { systemCommands, helpCommand, historyCommand, clearCommand, versionCommand, homeCommand, addToHistory, getHistory } from './system';
export { auditCommands, auditCommand } from './audit';

import { graphCommands } from './graph';
import { taskCommands } from './task';
import { aiCommands } from './ai';
import { dataCommands } from './data';
import { systemCommands } from './system';
import { auditCommands } from './audit';
import type { Command } from '../types';

export const allCommands: Command[] = [
  ...graphCommands,
  ...taskCommands,
  ...aiCommands,
  ...dataCommands,
  ...systemCommands,
  ...auditCommands,
];
