export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

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

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const prefixStr = this.prefix ? ` [${this.prefix}]` : '';
    const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${prefixStr} ${message}${metaString}`;
  }

  info(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, meta));
    }
  }

  warn(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, meta));
    }
  }

  error(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, meta));
    }
  }

  debug(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, meta));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}

export const logger = new Logger();
