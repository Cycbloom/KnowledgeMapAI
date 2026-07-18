import type {
  ParsedArgs,
  ParseError,
  Token,
  CommandOption,
  OptionValue,
} from './types';
import { AppError, SharedErrorCodes } from "@/utils/errors";

export class CommandParser {
  private input: string = '';
  private position: number = 0;
  private tokens: Token[] = [];

  parse(input: string): ParsedArgs | ParseError {
    this.input = input.trim();
    this.position = 0;
    this.tokens = [];

    if (!this.input) {
      return { message: 'Empty command', position: 0 };
    }

    try {
      this.tokenize();
      return this.buildParsedArgs();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      return { message, position: this.position };
    }
  }

  private tokenize(): void {
    while (this.position < this.input.length) {
      this.skipWhitespace();
      
      if (this.position >= this.input.length) break;

      const char = this.input[this.position];

      if (char === '-' && this.peek(1) === '-') {
        this.tokens.push(this.parseLongOption());
      } else if (char === '-') {
        this.tokens.push(this.parseShortOption());
      } else if (char === '"' || char === "'") {
        this.tokens.push(this.parseQuotedString());
      } else {
        this.tokens.push(this.parseWord());
      }
    }
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }
  }

  private peek(offset: number = 0): string {
    const pos = this.position + offset;
    return pos < this.input.length ? this.input[pos] : '';
  }

  private parseLongOption(): Token {
    const start = this.position;
    this.position += 2;

    let name = '';
    while (this.position < this.input.length && /[a-zA-Z0-9_-]/.test(this.input[this.position])) {
      name += this.input[this.position];
      this.position++;
    }

    if (!name) {
      throw new AppError('Invalid option name after --', SharedErrorCodes.VALIDATION_ERROR, 400);
    }

    return {
      type: 'option',
      value: name,
      raw: this.input.substring(start, this.position),
      position: start,
    };
  }

  private parseShortOption(): Token {
    const start = this.position;
    this.position += 1;

    const char = this.input[this.position];
    if (!char || !/[a-zA-Z]/.test(char)) {
      throw new AppError('Invalid short option', SharedErrorCodes.VALIDATION_ERROR, 400);
    }
    this.position++;

    return {
      type: 'option',
      value: char,
      raw: this.input.substring(start, this.position),
      position: start,
    };
  }

  private parseQuotedString(): Token {
    const start = this.position;
    const quote = this.input[this.position];
    this.position++;

    let value = '';
    let escaped = false;

    while (this.position < this.input.length) {
      const char = this.input[this.position];

      if (escaped) {
        value += char;
        escaped = false;
        this.position++;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        this.position++;
        continue;
      }

      if (char === quote) {
        this.position++;
        return {
          type: 'value',
          value,
          raw: this.input.substring(start, this.position),
          position: start,
        };
      }

      value += char;
      this.position++;
    }

    throw new AppError('Unterminated quoted string', SharedErrorCodes.VALIDATION_ERROR, 400);
  }

  private parseWord(): Token {
    const start = this.position;
    let value = '';

    while (this.position < this.input.length && !/\s/.test(this.input[this.position])) {
      value += this.input[this.position];
      this.position++;
    }

    return {
      type: 'value',
      value,
      raw: this.input.substring(start, this.position),
      position: start,
    };
  }

  private buildParsedArgs(): ParsedArgs {
    if (this.tokens.length === 0) {
      throw new AppError('No command provided', SharedErrorCodes.VALIDATION_ERROR, 400);
    }

    const firstToken = this.tokens[0];
    if (firstToken.type !== 'value' && firstToken.type !== 'command') {
      throw new AppError('Command must start with a command name', SharedErrorCodes.VALIDATION_ERROR, 400);
    }

    const command = firstToken.value;
    let subcommand: string | undefined;
    const options: Record<string, unknown> = {};
    const positional: string[] = [];

    let i = 1;
    let foundSubcommand = false;

    while (i < this.tokens.length) {
      const token = this.tokens[i];

      if (token.type === 'option') {
        const { name, value, consumed } = this.parseOptionValue(token, i);
        options[name] = value;
        i += consumed;
      } else if (token.type === 'value') {
        if (!foundSubcommand && !this.isOptionValue(token.value)) {
          subcommand = token.value;
          foundSubcommand = true;
        } else {
          positional.push(token.value);
        }
        i++;
      } else {
        i++;
      }
    }

    return {
      command,
      subcommand,
      options,
      positional,
    };
  }

  private isOptionValue(value: string): boolean {
    return value.startsWith('-');
  }

  private parseOptionValue(
    optionToken: Token,
    currentIndex: number
  ): { name: string; value: OptionValue; consumed: number } {
    const nextToken = this.tokens[currentIndex + 1];
    const name = optionToken.value;

    if (nextToken && nextToken.type === 'value' && !this.isOptionValue(nextToken.value)) {
      return {
        name,
        value: nextToken.value,
        consumed: 2,
      };
    }

    return {
      name,
      value: true,
      consumed: 1,
    };
  }

  applyOptionDefaults(
    parsedArgs: ParsedArgs,
    options: CommandOption[]
  ): ParsedArgs {
    const result = { ...parsedArgs };
    result.options = { ...parsedArgs.options };

    for (const option of options) {
      if (!(option.name in result.options) && option.default !== undefined) {
        result.options[option.name] = option.default;
      }
    }

    return result;
  }

  validateOptions(
    parsedArgs: ParsedArgs,
    options: CommandOption[]
  ): ParseError | null {
    for (const option of options) {
      if (option.required && !(option.name in parsedArgs.options)) {
        return {
          message: `Required option '${option.name}' is missing`,
        };
      }

      const value = parsedArgs.options[option.name];
      if (value !== undefined) {
        const typeError = this.validateOptionType(option, value);
        if (typeError) return typeError;
      }
    }

    return null;
  }

  private validateOptionType(
    option: CommandOption,
    value: unknown
  ): ParseError | null {
    switch (option.type) {
      case 'string':
        if (typeof value !== 'string') {
          return {
            message: `Option '${option.name}' must be a string`,
          };
        }
        break;
      case 'number':
        if (typeof value === 'string') {
          const num = Number(value);
          if (isNaN(num)) {
            return {
              message: `Option '${option.name}' must be a number`,
            };
          }
        } else if (typeof value !== 'number') {
          return {
            message: `Option '${option.name}' must be a number`,
          };
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return {
            message: `Option '${option.name}' must be a boolean`,
          };
        }
        break;
      case 'array':
        if (!Array.isArray(value) && typeof value !== 'string') {
          return {
            message: `Option '${option.name}' must be an array`,
          };
        }
        break;
    }

    return null;
  }

  convertOptionTypes(
    parsedArgs: ParsedArgs,
    options: CommandOption[]
  ): ParsedArgs {
    const result = { ...parsedArgs };
    result.options = { ...parsedArgs.options };

    for (const option of options) {
      const value = result.options[option.name];
      if (value === undefined) continue;

      switch (option.type) {
        case 'number':
          if (typeof value === 'string') {
            result.options[option.name] = Number(value);
          }
          break;
        case 'array':
          if (typeof value === 'string') {
            result.options[option.name] = [value];
          }
          break;
      }
    }

    return result;
  }
}

export const commandParser = new CommandParser();
