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
    private _handlers: TaggedLoggerHandler[];

    constructor() {
        this._handlers = [];
    }

    private handleMessage(message: string, type: LoggerMessageType = LoggerMessageType.Log, tag: string = null) {
        for (let handler of this._handlers) {
            if (!handler.tags || handler.tags.length == 0 || handler.tags.indexOf(tag) > -1) {
                handler.handler({ message: message, type: type });
            }
        }
    }

    public log(message: string, tag: string = null): void {
        this.handleMessage(message, LoggerMessageType.Log, tag);
    }

    public info(message: string, tag: string = null): void {
        this.handleMessage(message, LoggerMessageType.Info, tag);
    }

    public warn(message: string, tag: string = null): void {
        this.handleMessage(message, LoggerMessageType.Warning, tag);
    }

    public error(message: string, tag: string = null): void {
        this.handleMessage(message, LoggerMessageType.Error, tag);
    }

    public addHandler(handler: LoggerHandler, tags: string[] = null) {
        tags = tags || [];
        this._handlers.push({ handler: handler, tags: tags });
    }

    /**
     * Removes all occurrence of this handler, ignoring the associated tags
     */
    public removeHandler(handlerToRemove: LoggerHandler) {
        let i = this._handlers.length;
        while (i--) {
            if (this._handlers[i].handler == handlerToRemove) {
                this._handlers.splice(i, 1);
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