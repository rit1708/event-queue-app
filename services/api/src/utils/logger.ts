import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  pid: number;
  data?: unknown;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

const DEFAULT_LOG_DIR = path.resolve(process.cwd(), 'services/api/logs');

function resolveLogDir(): string {
  const dir = process.env.LOG_DIR || DEFAULT_LOG_DIR;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

class Logger {
  private level: LogLevel;
  private combinedStream: fs.WriteStream;
  private errorStream: fs.WriteStream;
  private serviceName = 'queue-api';

  constructor() {
    const envLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    const nodeEnv = process.env.NODE_ENV || 'development';
    this.level = nodeEnv === 'development' ? 'debug' : envLevel;

    const logDir = resolveLogDir();
    this.combinedStream = fs.createWriteStream(path.join(logDir, 'combined.log'), {
      flags: 'a',
    });
    this.errorStream = fs.createWriteStream(path.join(logDir, 'error.log'), {
      flags: 'a',
    });
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
  }

  private formatEntry(level: LogLevel, message: string, data?: unknown, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      pid: process.pid,
      ...(data && { data }),
      ...(error && { error: { message: error.message, stack: error.stack, name: error.name } }),
    };
  }

  private write(level: LogLevel, message: string, data?: unknown, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.formatEntry(level, message, data, error);
    const line = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(line);
        }
        break;
      default:
        console.log(line);
    }

    this.combinedStream.write(`${line}\n`);
    if (level === 'error' || level === 'warn') {
      this.errorStream.write(`${line}\n`);
    }
  }

  debug(message: string, data?: unknown): void {
    this.write('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.write('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.write('warn', message, data);
  }

  error(message: string, error?: Error, data?: unknown): void {
    this.write('error', message, data, error);
  }
}

export const logger = new Logger();

