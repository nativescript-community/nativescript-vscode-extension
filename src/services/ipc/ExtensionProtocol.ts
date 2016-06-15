export interface Request {
    id: string;
    method: string;
    args: Object;
}

export interface Response {
    requestId: string;
    result: Object;
}

export interface AnalyticsLaunchDebuggerArgs {
    request: string;
    platform: string;
    emulator: boolean;
}

export interface AnalyticsRunRunCommandArgs {
    platform: string;
    emulator: boolean;
}