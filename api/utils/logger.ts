export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

const LEVEL_STYLES: Record<LogLevel, { color: string; icon: string; label: string }> = {
  [LogLevel.INFO]: { color: COLORS.cyan, icon: '●', label: 'INFO' },
  [LogLevel.WARN]: { color: COLORS.yellow, icon: '⚠', label: 'WARN' },
  [LogLevel.ERROR]: { color: COLORS.red, icon: '✖', label: 'ERROR' },
  [LogLevel.DEBUG]: { color: COLORS.dim, icon: '○', label: 'DEBUG' },
};

export class Logger {
  private level: LogLevel = LogLevel.INFO;
  private prefix?: string;

  constructor(prefix?: string) {
    this.prefix = prefix;
    const envLevel = process.env.LOG_LEVEL as LogLevel;
    if (envLevel && Object.values(LogLevel).includes(envLevel)) {
      this.level = envLevel;
    }
  }

  private getTimestamp(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  private formatMeta(meta?: unknown): string {
    if (!meta) return '';
    
    if (meta instanceof Error) {
      return `\n${COLORS.dim}├─ Stack:${COLORS.reset}\n${COLORS.dim}${meta.stack?.split('\n').slice(1, 4).join('\n')}${COLORS.reset}`;
    }
    
    if (typeof meta === 'object') {
      try {
        const formatted = JSON.stringify(meta, null, 2);
        const lines = formatted.split('\n');
        if (lines.length > 10) {
          return `\n${COLORS.dim}├─ Data:${COLORS.reset}\n${lines.slice(0, 10).join('\n')}\n${COLORS.dim}... (${lines.length - 10} more lines)${COLORS.reset}`;
        }
        return `\n${COLORS.dim}├─ Data:${COLORS.reset}\n${formatted}`;
      } catch {
        return `\n${COLORS.dim}├─ Data: [Object]${COLORS.reset}`;
      }
    }
    
    return `\n${COLORS.dim}├─ ${meta}${COLORS.reset}`;
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
    const style = LEVEL_STYLES[level];
    const timestamp = this.getTimestamp();
    const prefixStr = this.prefix ? ` ${COLORS.magenta}[${this.prefix}]${COLORS.reset}` : '';
    
    const header = `${style.color}${style.icon} ${style.label}${COLORS.reset}${prefixStr}`;
    const time = `${COLORS.dim}${timestamp}${COLORS.reset}`;
    const metaStr = this.formatMeta(meta);
    
    return `\n${time} ${header}\n${COLORS.bright}${message}${COLORS.reset}${metaStr}`;
  }

  private formatSimple(level: LogLevel, message: string, meta?: unknown): string {
    const style = LEVEL_STYLES[level];
    const timestamp = new Date().toISOString();
    const prefixStr = this.prefix ? ` [${this.prefix}]` : '';
    const metaString = meta ? ` ${typeof meta === 'object' ? JSON.stringify(meta) : meta}` : '';
    return `[${timestamp}] [${style.label}]${prefixStr} ${message}${metaString}`;
  }

  info(message: string, meta?: unknown) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, meta));
    }
  }

  warn(message: string, meta?: unknown) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, meta));
    }
  }

  error(message: string, meta?: unknown) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, meta));
    }
  }

  debug(message: string, meta?: unknown) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, meta));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  separator(char: string = '─', length: number = 60) {
    console.log(`\n${COLORS.dim}${char.repeat(length)}${COLORS.reset}`);
  }

  box(title: string, content?: string) {
    const width = Math.max(title.length + 4, 40);
    const top = `┌${'─'.repeat(width - 2)}┐`;
    const bottom = `└${'─'.repeat(width - 2)}┘`;
    const titleLine = `│ ${title.padEnd(width - 4)} │`;
    
    console.log(`\n${COLORS.cyan}${top}${COLORS.reset}`);
    console.log(`${COLORS.cyan}${titleLine}${COLORS.reset}`);
    
    if (content) {
      const lines = content.split('\n');
      lines.forEach(line => {
        console.log(`${COLORS.cyan}│ ${COLORS.reset}${line.padEnd(width - 4)}${COLORS.cyan} │${COLORS.reset}`);
      });
    }
    
    console.log(`${COLORS.cyan}${bottom}${COLORS.reset}\n`);
  }

  request(method: string, path: string, status: number, duration: number) {
    const statusColor = status >= 400 ? COLORS.red : status >= 300 ? COLORS.yellow : COLORS.green;
    const methodColor = method === 'GET' ? COLORS.green : method === 'POST' ? COLORS.blue : method === 'DELETE' ? COLORS.red : COLORS.yellow;
    
    console.log(
      `${COLORS.dim}${this.getTimestamp()}${COLORS.reset} ` +
      `${methodColor}${method.padEnd(6)}${COLORS.reset} ` +
      `${path} ` +
      `${statusColor}${status}${COLORS.reset} ` +
      `${COLORS.dim}${duration}ms${COLORS.reset}`
    );
  }
}

export const logger = new Logger();
