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
}

export interface AnalyticsRunRunCommandArgs {
    platform: string;
}

export interface InitSettingsResult {
    tnsPath: string;
}