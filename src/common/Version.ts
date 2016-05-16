export class Version {
    public static parse(versionStr: string): number[] {
        if (versionStr === null) {
            return null;
        }
        let version: number[] = versionStr.split('.').map<number>((str, index, array) => parseInt(str));
        for(let i = version.length; i < 3; i++) {
            version.push(0);
        }
        return version;
    }

    public static stringify(version: number[]): string {
        return `${version[0]}.${version[1]}.${version[2]}`;
    }

    public static compareBySubminor(v1, v2): number {
        return (v1[0] - v2[0] != 0) ? (v1[0] - v2[0]) : (v1[1] - v2[1] != 0) ? v1[1] - v2[1] : v1[2] - v2[2];
    }
}