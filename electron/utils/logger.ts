export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

export interface StructuredLogData {
  timestamp?: string;
  level: LogLevel;
  message: string;
  module?: string;
  context?: Record<string, unknown>;
  stack?: string;
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

/**
 * Electron 主进程日志器。
 *
 * 与 api/utils/logger.ts 的核心接口保持兼容（info/warn/error/debug 签名一致），
 * 但去除了 HTTP 请求上下文相关方法（request/errorWithRequest），因为 Electron
 * 主进程没有 HTTP 请求上下文。logger 内部最终调用 console.* 是允许的，这是
 * logger 的实现层；项目规则禁止的是业务代码中的 console.*。
 */
export class Logger {
  private level: LogLevel = LogLevel.INFO;
  private prefix?: string;
  private isProduction: boolean;

  constructor(prefix?: string) {
    this.prefix = prefix;
    this.isProduction = process.env.NODE_ENV === 'production';
    const envLevel = process.env.LOG_LEVEL as LogLevel;
    if (envLevel && Object.values(LogLevel).includes(envLevel)) {
      this.level = envLevel;
    } else if (this.isProduction) {
      this.level = LogLevel.WARN;
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
      return ` ${COLORS.dim}Stack: ${meta.stack?.split('\n').slice(1, 4).join(' | ')}${COLORS.reset}`;
    }

    if (typeof meta === 'object') {
      try {
        return ` ${COLORS.dim}${JSON.stringify(meta)}${COLORS.reset}`;
      } catch {
        return ` ${COLORS.dim}[Object]${COLORS.reset}`;
      }
    }

    return ` ${COLORS.dim}${String(meta)}${COLORS.reset}`;
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
    const style = LEVEL_STYLES[level];
    const timestamp = this.getTimestamp();
    const prefixStr = this.prefix ? ` ${COLORS.magenta}[${this.prefix}]${COLORS.reset}` : '';

    const header = `${style.color}${style.icon} ${style.label}${COLORS.reset}${prefixStr}`;
    const time = `${COLORS.dim}${timestamp}${COLORS.reset}`;
    const metaStr = this.formatMeta(meta);

    return `${time} ${header} ${COLORS.bright}${message}${COLORS.reset}${metaStr}`;
  }

  info(message: string, meta?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, meta));
    }
  }

  warn(message: string, meta?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, meta));
    }
  }

  error(message: string, meta?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, meta));
    }
  }

  debug(message: string, meta?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, meta));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  separator(char: string = '─', length: number = 60): void {
    console.log(`\n${COLORS.dim}${char.repeat(length)}${COLORS.reset}`);
  }

  box(title: string, content?: string): void {
    const width = Math.max(title.length + 4, 40);
    const top = `┌${'─'.repeat(width - 2)}┐`;
    const bottom = `└${'─'.repeat(width - 2)}┘`;
    const titleLine = `│ ${title.padEnd(width - 4)} │`;

    console.log(`\n${COLORS.cyan}${top}${COLORS.reset}`);
    console.log(`${COLORS.cyan}${titleLine}${COLORS.reset}`);

    if (content) {
      const lines = content.split('\n');
      lines.forEach((line) => {
        console.log(`${COLORS.cyan}│ ${COLORS.reset}${line.padEnd(width - 4)}${COLORS.cyan} │${COLORS.reset}`);
      });
    }

    console.log(`${COLORS.cyan}${bottom}${COLORS.reset}\n`);
  }

  logStructured(
    level: LogLevel,
    message: string,
    data?: Partial<Omit<StructuredLogData, 'timestamp' | 'level' | 'message'>>,
  ): void {
    const logData: StructuredLogData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
    };

    if (this.isProduction) {
      console.log(JSON.stringify(logData));
      return;
    }

    this[level](message, data);
  }
}

export const logger = new Logger();
