export class Version {
    private _version: number[];

    public static parse(versionStr: string): Version {
        if (versionStr === null) {
            return null;
        }
        let version: number[] = versionStr.split('.').map<number>((str, index, array) => parseInt(str));
        for(let i = version.length; i < 3; i++) {
            version.push(0);
        }
        return new Version(version);
    }

    constructor(version: number[]) {
        this._version = version;
    }

    public toString(): string {
        return `${this._version[0]}.${this._version[1]}.${this._version[2]}`;
    }

    public compareBySubminorTo(other: Version): number {
        let v1 = this._version;
        let v2 = other._version;
        return (v1[0] - v2[0] != 0) ? (v1[0] - v2[0]) : (v1[1] - v2[1] != 0) ? v1[1] - v2[1] : v1[2] - v2[2];
    }
}
