export type {
  CommandOption,
  ParsedArgs,
  CommandResult,
  CommandContext,
  Command,
  CommandHistoryItem,
  AutocompleteSuggestion,
  CommandPermission,
  CommandMatch,
  ParseError,
  Token,
  OptionValue,
} from "./types";

export { CommandParser, commandParser } from "./CommandParser";
export { CommandRegistry, commandRegistry } from "./CommandRegistry";
export {
  consoleLogger,
  type ConsoleLogEntry,
  type ConsoleLogQuery,
} from "./ConsoleLogger";

export {
  graphCommands,
  graphCommand,
  nodeCommand,
  taskCommands,
  taskCommand,
  aiCommands,
  aiCommand,
  dataCommands,
  exportCommand,
  importCommand,
  backupCommand,
  systemCommands,
  helpCommand,
  historyCommand,
  clearCommand,
  versionCommand,
  homeCommand,
  addToHistory,
  getHistory,
  auditCommands,
  auditCommand,
  navCommands,
  navCommand,
  findNavTarget,
  statsCommands,
  statsCommand,
  allCommands,
} from "./commands";
