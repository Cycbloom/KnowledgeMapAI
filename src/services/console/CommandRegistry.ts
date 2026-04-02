import type {
  Command,
  CommandMatch,
  AutocompleteSuggestion,
  ParsedArgs,
  CommandContext,
  CommandResult,
} from './types';
import { commandParser } from './CommandParser';

export class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private aliases: Map<string, string> = new Map();

  register(command: Command): void {
    this.commands.set(command.name, command);

    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  unregister(name: string): boolean {
    const command = this.commands.get(name);
    if (!command) return false;

    this.commands.delete(name);

    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.delete(alias);
      }
    }

    return true;
  }

  find(name: string): Command | undefined {
    const command = this.commands.get(name);
    if (command) return command;

    const aliasedName = this.aliases.get(name);
    if (aliasedName) {
      return this.commands.get(aliasedName);
    }

    return undefined;
  }

  match(parsedArgs: ParsedArgs): CommandMatch | null {
    const command = this.find(parsedArgs.command);
    if (!command) return null;

    if (parsedArgs.subcommand && command.subcommands) {
      const subcommand = command.subcommands.find(
        (sub) => sub.name === parsedArgs.subcommand ||
                  (sub.aliases && sub.aliases.includes(parsedArgs.subcommand ?? ''))
      );
      return { command, subcommand };
    }

    return { command };
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  getNames(): string[] {
    return Array.from(this.commands.keys());
  }

  getHelp(name: string): string | null {
    const command = this.find(name);
    if (!command) return null;

    return this.formatHelp(command);
  }

  private formatHelp(command: Command): string {
    let help = `${command.name} - ${command.description}\n`;
    help += `Usage: ${command.usage}\n`;

    if (command.aliases && command.aliases.length > 0) {
      help += `Aliases: ${command.aliases.join(', ')}\n`;
    }

    if (command.options.length > 0) {
      help += '\nOptions:\n';
      for (const option of command.options) {
        const alias = option.alias ? `-${option.alias}, ` : '    ';
        const required = option.required ? ' (required)' : '';
        const defaultVal = option.default !== undefined ? ` [default: ${String(option.default)}]` : '';
        help += `  ${alias}--${option.name}${required}${defaultVal}\n`;
        help += `      ${option.description}\n`;
      }
    }

    if (command.subcommands && command.subcommands.length > 0) {
      help += '\nSubcommands:\n';
      for (const sub of command.subcommands) {
        help += `  ${sub.name.padEnd(15)} ${sub.description}\n`;
      }
    }

    help += `\nPermission: ${command.permission}`;

    return help;
  }

  getAutocompleteSuggestions(
    input: string,
    cursorPosition: number
  ): AutocompleteSuggestion[] {
    const beforeCursor = input.substring(0, cursorPosition);

    if (!beforeCursor.trim()) {
      return this.getCommandSuggestions();
    }

    const parsed = commandParser.parse(beforeCursor);
    if ('message' in parsed) {
      return this.getCommandSuggestions();
    }

    const lastWord = this.getLastWord(beforeCursor);

    if (lastWord.startsWith('--')) {
      return this.getOptionSuggestions(parsed.command, lastWord);
    }

    if (lastWord.startsWith('-') && lastWord.length === 1) {
      return this.getShortOptionSuggestions(parsed.command);
    }

    const command = this.find(parsed.command);
    if (!command) {
      return this.getCommandSuggestions(lastWord);
    }

    if (parsed.subcommand && command.subcommands) {
      const subcommand = command.subcommands.find(
        (sub) => sub.name === parsed.subcommand
      );
      if (subcommand) {
        return this.getOptionSuggestions(command.name, lastWord, subcommand.name);
      }
    }

    if (command.subcommands && command.subcommands.length > 0) {
      const subcommandSuggestions = this.getSubcommandSuggestions(
        command,
        lastWord
      );
      if (subcommandSuggestions.length > 0) {
        return subcommandSuggestions;
      }
    }

    return this.getOptionSuggestions(command.name, lastWord);
  }

  private getLastWord(input: string): string {
    const trimmed = input.trimEnd();
    const match = trimmed.match(/(\S+)$/);
    return match ? match[1] : '';
  }

  private getCommandSuggestions(prefix: string = ''): AutocompleteSuggestion[] {
    const suggestions: AutocompleteSuggestion[] = [];

    for (const command of this.commands.values()) {
      if (!prefix || command.name.startsWith(prefix)) {
        suggestions.push({
          value: command.name,
          description: command.description,
          type: 'command',
        });
      }

      if (command.aliases) {
        for (const alias of command.aliases) {
          if (!prefix || alias.startsWith(prefix)) {
            suggestions.push({
              value: alias,
              description: `Alias for ${command.name}`,
              type: 'command',
            });
          }
        }
      }
    }

    return suggestions;
  }

  private getOptionSuggestions(
    commandName: string,
    prefix: string,
    subcommandName?: string
  ): AutocompleteSuggestion[] {
    const command = this.find(commandName);
    if (!command) return [];

    const suggestions: AutocompleteSuggestion[] = [];
    let options = command.options;

    if (subcommandName && command.subcommands) {
      const subcommand = command.subcommands.find(
        (sub) => sub.name === subcommandName
      );
      if (subcommand) {
        options = subcommand.options;
      }
    }

    for (const option of options) {
      const longForm = `--${option.name}`;
      if (!prefix || longForm.startsWith(prefix)) {
        suggestions.push({
          value: longForm,
          description: option.description,
          type: 'option',
        });
      }
    }

    return suggestions;
  }

  private getShortOptionSuggestions(
    commandName: string
  ): AutocompleteSuggestion[] {
    const command = this.find(commandName);
    if (!command) return [];

    const suggestions: AutocompleteSuggestion[] = [];

    for (const option of command.options) {
      if (option.alias) {
        suggestions.push({
          value: `-${option.alias}`,
          description: option.description,
          type: 'option',
        });
      }
    }

    return suggestions;
  }

  private getSubcommandSuggestions(
    command: Command,
    prefix: string
  ): AutocompleteSuggestion[] {
    if (!command.subcommands) return [];

    const suggestions: AutocompleteSuggestion[] = [];

    for (const sub of command.subcommands) {
      if (!prefix || sub.name.startsWith(prefix)) {
        suggestions.push({
          value: sub.name,
          description: sub.description,
          type: 'command',
        });
      }
    }

    return suggestions;
  }

  async execute(
    input: string,
    context: CommandContext
  ): Promise<CommandResult> {
    const parsed = commandParser.parse(input);

    if ('message' in parsed) {
      return {
        success: false,
        error: parsed.message,
      };
    }

    const match = this.match(parsed);
    if (!match) {
      return {
        success: false,
        error: `Unknown command: ${parsed.command}`,
      };
    }

    const { command, subcommand } = match;
    const targetCommand = subcommand || command;

    let processedArgs = commandParser.applyOptionDefaults(
      parsed,
      targetCommand.options
    );

    const validationError = commandParser.validateOptions(
      processedArgs,
      targetCommand.options
    );
    if (validationError) {
      return {
        success: false,
        error: validationError.message,
      };
    }

    processedArgs = commandParser.convertOptionTypes(
      processedArgs,
      targetCommand.options
    );

    try {
      return await targetCommand.handler(processedArgs, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: message,
      };
    }
  }
}

export const commandRegistry = new CommandRegistry();
