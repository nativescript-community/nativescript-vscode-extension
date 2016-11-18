import * as fs from 'fs';

export enum LoggerMessageType {
    Log,
    Info,
    Warning,
    Error
}

export interface LoggerMessageEventArgs {
    message: string,
    type: LoggerMessageType
}

export type LoggerHandler = ((args: LoggerMessageEventArgs) => void);
type TaggedLoggerHandler = { handler: LoggerHandler, tags: string[] };

/**
 * The logger is a singleton.
 */
export class Logger {
    private static _instance: Logger;

    private _handlers: TaggedLoggerHandler[];

    constructor() {
        this._handlers = [];
    }

    private static get instance(): Logger {
        this._instance = this._instance || new Logger();
        return this._instance;
    }

    private static handleMessage(message: string, type: LoggerMessageType = LoggerMessageType.Log, tag: string = null) {
        for (let handler of this.instance._handlers) {
            if (!handler.tags || handler.tags.length == 0 || handler.tags.indexOf(tag) > -1) {
                handler.handler({ message: message, type: type });
            }
        }
    }

    public static log(message: string, tag: string = null): void {
        this.handleMessage(message, LoggerMessageType.Log, tag);
    }

    public static info(message: string, tag: string = null): void {
        this.handleMessage(message, LoggerMessageType.Info, tag);
    }

    public static warn(message: string, tag: string = null): void {
        this.handleMessage(message, LoggerMessageType.Warning, tag);
    }

    public static error(message: string, tag: string = null): void {
        this.handleMessage(message, LoggerMessageType.Error, tag);
    }

    public static addHandler(handler: LoggerHandler, tags: string[] = null) {
        tags = tags || [];
        this.instance._handlers.push({ handler: handler, tags: tags });
    }

    /**
     * Removes all occurrence of this handler, ignoring the associated tags
     */
    public static removeHandler(handlerToRemove: LoggerHandler) {
        let i = this.instance._handlers.length;
        while (i--) {
            if (this.instance._handlers[i].handler == handlerToRemove) {
                this.instance._handlers.splice(i, 1);
            }
        }
    }
}

export namespace Tags {
    export const FrontendMessage: string = "LoggerTag.FrontendMessage";
}

export namespace Handlers {
    export function stdStreamsHandler(args: LoggerMessageEventArgs) {
        switch(args.type) {
            case LoggerMessageType.Log:
                console.log(args.message);
                break;
            case LoggerMessageType.Info:
                console.info(args.message);
                break;
            case LoggerMessageType.Warning:
                console.warn(args.message);
                break;
            case LoggerMessageType.Error:
                console.error(args.message);
                break;
        }
    };

    export function createStreamHandler(stream: fs.WriteStream, encoding: string = 'utf8'): LoggerHandler {
        let isStreamClosed = false;
        stream.on('close', () => { isStreamClosed = true; });
        return (args: LoggerMessageEventArgs) => {
            if (stream && !isStreamClosed) {
                stream.write(args.message, encoding);
            }
        }
    }
}