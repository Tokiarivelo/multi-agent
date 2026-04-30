export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  service: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

export class Logger {
  constructor(private readonly context: LogContext) {}

  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...this.context,
        ...meta,
      };
      console.log(JSON.stringify(logEntry));
      return;
    }

    // Development/Readable format: [Service] PID - Date, Time LEVEL [Context] Message Meta
    const now = new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const pid = process.pid;
    const levelUpper = level.toUpperCase().padEnd(5);
    const service = this.context.service || 'App';
    const context = this.context.context || 'Default';
    
    const colorReset = '\x1b[0m';
    const colorGreen = '\x1b[32m';
    const colorYellow = '\x1b[33m';
    const colorRed = '\x1b[31m';
    const colorPurple = '\x1b[35m';
    const colorCyan = '\x1b[36m';

    let levelColor = colorGreen;
    let levelName = 'LOG';

    if (level === LogLevel.ERROR) {
      levelColor = colorRed;
      levelName = 'ERROR';
    } else if (level === LogLevel.WARN) {
      levelColor = colorYellow;
      levelName = 'WARN';
    } else if (level === LogLevel.DEBUG) {
      levelColor = colorPurple;
      levelName = 'DEBUG';
    }

    const metaStr = meta && Object.keys(meta).length > 0 
      ? ` ${colorCyan}${JSON.stringify(meta)}${colorReset}` 
      : '';

    console.log(
      `${colorGreen}[${service}]${colorReset} ${pid}  - ${now}     ${levelColor}${levelName.padEnd(5)}${colorReset} ${colorYellow}[${context}]${colorReset} ${message}${metaStr}`
    );
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, any>) {
    const errorObj = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : { error };

    this.log(LogLevel.ERROR, message, {
      ...meta,
      ...errorObj,
    });
  }
}
