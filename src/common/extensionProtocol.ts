export interface Request {
    id: string;
    service: string;
    method: string;
    args: any[];
}

export interface Response {
    requestId: string;
    result: Object;
}

export const BEFORE_DEBUG_START = "before-debug-start";
export const NS_DEBUG_ADAPTER_MESSAGE = "ns-debug-adapter-message";