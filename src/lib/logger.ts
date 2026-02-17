/**
 * Logger utility for consistent logging across the application
 * Supports different log levels and can be controlled via environment variables
 */

/* eslint-disable no-console */
type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix?: string;
}

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      enabled:
        process.env.NODE_ENV !== 'production' ||
        process.env.NEXT_PUBLIC_DEBUG === 'true',
      level: 'debug',
      ...config,
    };
  }

  private doLog(level: LogLevel, ...args: unknown[]): void {
    if (!this.config.enabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix ? `[${this.config.prefix}]` : '';
    const message = `${timestamp} ${prefix}`;

    switch (level) {
      case 'log':
        console.log(message, ...args);
        break;
      case 'info':
        console.info(message, ...args);
        break;
      case 'warn':
        console.warn(message, ...args);
        break;
      case 'error':
        console.error(message, ...args);
        break;
      case 'debug':
        if (this.config.level === 'debug') {
          console.debug(message, ...args);
        }
        break;
    }
  }

  log(...args: unknown[]): void {
    this.doLog('log', ...args);
  }

  info(...args: unknown[]): void {
    this.doLog('info', ...args);
  }

  warn(...args: unknown[]): void {
    this.doLog('warn', ...args);
  }

  error(...args: unknown[]): void {
    this.doLog('error', ...args);
  }

  debug(...args: unknown[]): void {
    this.doLog('debug', ...args);
  }
}

// Default logger instance
export const logger = new Logger();

// Create a logger with a specific prefix
export function createLogger(prefix: string): Logger {
  return new Logger({ prefix });
}
