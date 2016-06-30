export enum OperatingSystem {
    Windows,
    Linux,
    OSX,
    Other
}

export interface AnalyticsBaseInfo {
    operatingSystem: OperatingSystem,
    cliVersion: string,
    extensionVersion: string,
    userId: string
}