export interface CommandOption {
  name: string;
  alias?: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ParsedArgs {
  command: string;
  subcommand?: string;
  options: Record<string, unknown>;
  positional: string[];
}

export interface CommandResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}

export interface CommandContext {
  userId: string;
  consoleId: string;
  navigate?: (path: string) => void;
}

export interface Command {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
  options: CommandOption[];
  subcommands?: Command[];
  permission: 'safe' | 'warning' | 'danger';
  handler: (args: ParsedArgs, context: CommandContext) => Promise<CommandResult>;
}

export interface CommandHistoryItem {
  id: string;
  command: string;
  timestamp: number;
  result?: CommandResult;
}

export interface AutocompleteSuggestion {
  value: string;
  description: string;
  type: 'command' | 'option' | 'value';
}

export type CommandPermission = 'safe' | 'warning' | 'danger';

export interface CommandMatch {
  command: Command;
  subcommand?: Command;
}

export interface ParseError {
  message: string;
  position?: number;
}

export interface Token {
  type: 'command' | 'subcommand' | 'option' | 'value' | 'positional';
  value: string;
  raw: string;
  position: number;
}

export type OptionValue = string | number | boolean | string[];
