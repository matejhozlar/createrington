import path from "node:path";
import fs from "node:fs";
import util from "node:util";
import winston from "winston";
import config from "@/config";

const logDir = config.utils.logger.logDir;

class DailyFolderLogger {
  private currentDate: string;
  private logger: winston.Logger;
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.currentDate = this.getDateString();
    this.logger = this.createLoggerForDate(this.currentDate);
    this.monitorDateChange();
  }

  private getDateString(): string {
    const now = new Date();
    return now.toLocaleDateString("sv-SE");
  }

  private getLogPathForDate(date: string, filename: string): string {
    const datedDir = path.join(logDir, date);
    if (!fs.existsSync(datedDir)) {
      fs.mkdirSync(datedDir, { recursive: true });
    }
    return path.join(datedDir, filename);
  }

  /**
   * Gets a meaningful identifier for the caller by parsing the stack trace.
   * For index.ts files, includes the parent directory name (e.g., "app/index").
   * For other files, returns just the filename without extension (e.g., "server").
   */
  private getCallerFile(): string {
    const originalFunc = Error.prepareStackTrace;

    try {
      const err = new Error();
      Error.prepareStackTrace = (_, stack) => stack;

      const stack = err.stack as unknown as NodeJS.CallSite[];

      const caller = stack[3];

      if (caller) {
        const fileName = caller.getFileName();
        if (fileName) {
          const parsed = path.parse(fileName);
          const basename = parsed.name;

          if (basename === "index") {
            const parentDir = path.basename(parsed.dir);
            return `${parentDir}/index`;
          }

          return basename;
        }
      }

      return "unknown";
    } finally {
      Error.prepareStackTrace = originalFunc;
    }
  }

  private createLoggerForDate(date: string): winston.Logger {
    const isDev = process.env.NODE_ENV !== "production";

    const fileFormat = winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.printf((info) => {
        const { timestamp, level, message, filename } = info;
        const fileTag = filename ? `[${filename}]` : "";
        return `[${timestamp}]${fileTag}[${String(
          level,
        ).toUpperCase()}] ${message}`;
      }),
    );

    const consoleFormat = winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format((info) => {
        info.level = info.level.toUpperCase();
        return info;
      })(),
      winston.format.colorize({ all: true }),
      winston.format.printf((info) => {
        const { timestamp, level, message, filename } = info;
        const fileTag = filename ? `[${filename}]` : "";
        return `[${timestamp}]${fileTag}[${level}] ${message}`;
      }),
    );

    return winston.createLogger({
      level: isDev ? "debug" : "info",
      transports: [
        new winston.transports.File({
          filename: this.getLogPathForDate(date, "server.log"),
          level: "info",
          format: fileFormat,
        }),
        new winston.transports.File({
          filename: this.getLogPathForDate(date, "errors.log"),
          level: "error",
          format: fileFormat,
        }),
        ...(isDev
          ? [
              new winston.transports.File({
                filename: this.getLogPathForDate(date, "debug.log"),
                level: "debug",
                format: fileFormat,
              }),
            ]
          : []),
        new winston.transports.Console({
          level: isDev ? "debug" : "info",
          format: consoleFormat,
        }),
      ],
      exceptionHandlers: [
        new winston.transports.File({
          filename: this.getLogPathForDate(date, "exceptions.log"),
          format: fileFormat,
        }),
      ],
    });
  }

  private cleanOldLogFolders(daysToKeep: number): void {
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    fs.readdir(logDir, (error, folders) => {
      if (error) {
        console.error("Failed to read logDir:", error);
        return;
      }

      folders.forEach((folder) => {
        const folderPath = path.join(logDir, folder);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(folder)) return;

        const folderTime = new Date(folder).getTime();
        if (!Number.isNaN(folderTime) && folderTime < cutoff) {
          fs.rm(folderPath, { recursive: true, force: true }, (rmErr) => {
            if (rmErr) {
              console.log(`Failed to delete old log folder ${folder}`, rmErr);
            } else {
              console.log(`Deleted old log folder: ${folder}`);
            }
          });
        }
      });
    });
  }

  private monitorDateChange(): void {
    this.timer = setInterval(() => {
      const newDate = this.getDateString();
      if (newDate !== this.currentDate) {
        this.logger.close();
        this.currentDate = newDate;
        this.logger = this.createLoggerForDate(this.currentDate);
        this.cleanOldLogFolders(config.utils.logger.keepDays);
      }
    }, 60 * 1000);
  }

  public debug(...args: unknown[]): void {
    const filename = this.getCallerFile();
    (this.logger as winston.Logger).debug({
      message: util.format(...args),
      filename,
    });
  }

  public error(...args: unknown[]): void {
    const filename = this.getCallerFile();
    (this.logger as winston.Logger).error({
      message: util.format(...args),
      filename,
    });
  }

  public warn(...args: unknown[]): void {
    const filename = this.getCallerFile();
    (this.logger as winston.Logger).warn({
      message: util.format(...args),
      filename,
    });
  }

  public info(...args: unknown[]): void {
    const filename = this.getCallerFile();
    (this.logger as winston.Logger).info({
      message: util.format(...args),
      filename,
    });
  }

  public log(level: string, ...args: unknown[]): void {
    const filename = this.getCallerFile();
    (this.logger as winston.Logger).log(level, {
      message: util.format(...args),
      filename,
    });
  }

  public close(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.close();
  }
}

const loggerInstance = new DailyFolderLogger();
export default loggerInstance;
