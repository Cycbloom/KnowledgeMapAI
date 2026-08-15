export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

const LEVEL_STYLES: Record<LogLevel, { color: string; icon: string; label: string }> = {
  [LogLevel.INFO]: { color: 'color: #00bcd4', icon: '●', label: 'INFO' },
  [LogLevel.WARN]: { color: 'color: #ff9800', icon: '⚠', label: 'WARN' },
  [LogLevel.ERROR]: { color: 'color: #f44336', icon: '✖', label: 'ERROR' },
  [LogLevel.DEBUG]: { color: 'color: #9e9e9e', icon: '○', label: 'DEBUG' },
};

// 模块级常量日志级别顺序，替代 shouldLog 每次调用重建数组
const LEVEL_ORDER = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];

const SENSITIVE_KEYS = [
  'apiKey', 'apikey', 'api_key',
  'token', 'accesstoken', 'refreshtoken', 'authtoken',
  'password', 'passwd', 'pwd',
  'secret', 'clientsecret',
  'authorization',
  'cookie',
  'sessionid', 'session_id',
] as const;

export class Logger {
  private level: LogLevel = LogLevel.INFO;
  private prefix?: string;

  constructor(prefix?: string) {
    this.prefix = prefix;
    const envLevel = import.meta.env.VITE_LOG_LEVEL as LogLevel;
    if (envLevel && Object.values(LogLevel).includes(envLevel)) {
      this.level = envLevel;
    } else if (import.meta.env.PROD) {
      this.level = LogLevel.WARN;
    } else {
      this.level = LogLevel.DEBUG;
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

  private formatMeta(meta?: unknown): unknown[] {
    if (!meta) return [];
    if (typeof meta !== 'object' || meta === null) return [meta];
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_KEYS.some((s) => lowerKey.includes(s.toLowerCase()));
      redacted[key] = isSensitive ? '[REDACTED]' : value;
    }
    return [redacted];
  }

  private log(level: LogLevel, message: string, meta?: unknown) {
    if (!this.shouldLog(level)) return;
    
    const style = LEVEL_STYLES[level];
    const timestamp = this.getTimestamp();
    const prefixStr = this.prefix ? ` [%c${this.prefix}%c]` : '';
    
    const header = `%c${style.icon} ${style.label}%c${prefixStr} %c${message}`;
    const styles = [
      style.color,
      'color: inherit',
      'color: #e91e63',
      'color: inherit',
      'color: #2196f3',
      'color: inherit',
    ].filter((_, i) => {
      if (!this.prefix && i >= 2) return false;
      return true;
    });
    
    const logArgs = [`${timestamp} ${header}`, ...styles, ...this.formatMeta(meta)];
    
    if (level === LogLevel.ERROR) {
      console.error(...logArgs);
    } else if (level === LogLevel.WARN) {
      console.warn(...logArgs);
    } else {
      // eslint-disable-next-line no-console
      console.debug(...logArgs);
    }
  }

  info(message: string, meta?: unknown) {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: unknown) {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: unknown) {
    this.log(LogLevel.ERROR, message, meta);
  }

  debug(message: string, meta?: unknown) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(this.level);
  }
}

export const logger = new Logger();

export const createLogger = (prefix: string) => new Logger(prefix);
