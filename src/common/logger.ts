enum LogLevel {
    Verbose = 0,
    Log = 1,
    Warn = 2,
    Error = 3,
    Stop = 4,
}

interface ILogger {
    log(msg: string, level?: LogLevel): void;
}

export { ILogger, LogLevel  }