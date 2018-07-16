export enum OperatingSystem {
    Windows,
    Linux,
    OSX,
    Other,
}

export interface IAnalyticsBaseInfo {
    operatingSystem: OperatingSystem;
    cliVersion: string;
    extensionVersion: string;
    clientId: string;
}
