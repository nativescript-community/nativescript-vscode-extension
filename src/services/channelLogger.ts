import { ILogger, LogLevel  } from '../common/logger';
import { OutputChannel } from 'vscode';

export class ChannelLogger implements ILogger {
    private minLogLevel: LogLevel = LogLevel.Log;
    private channel: OutputChannel;

    constructor(channel: OutputChannel) {
        this.channel = channel;
    }

    log(msg: string, level: LogLevel = LogLevel.Log): void {
        if (level >= this.minLogLevel) {
			this.channel.appendLine(msg);
		}
    }
}