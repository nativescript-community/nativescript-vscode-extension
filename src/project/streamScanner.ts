import * as stream from 'stream';

export class StreamScanner {
	private _stream: stream.Readable;
	private _scanCallback: (data: string, stop: () => void) => void;

	constructor(stream: stream.Readable, scanCallback: (data: string, stop: () => void) => void) {
        this._stream = stream;
        this._scanCallback = scanCallback;
        this._stream.on("data", this.scan.bind(this));
	}

    public stop() {
        this._stream.removeListener("data", this.scan);
    }

    private scan(data: string | Buffer): void {
        this._scanCallback(data.toString(), this.stop);
    }
}

export type MatchFound = {
    chunk: string,
    matches: RegExpMatchArray | number[]
};

type MatchMeta = {
    promise: Promise<MatchFound>,
    resolve: (match: MatchFound) => void,
    reject: (err: Error) => void,
    test: string | RegExp
};

export class StringMatchingScanner extends StreamScanner {
    private _metas: MatchMeta[];

    constructor(stream: stream.Readable) {
        super(stream, (data: string, stop: () => void) => {
            this._metas.forEach((meta, metaIndex) => {
                if (meta.test instanceof RegExp) {
                    let result: RegExpMatchArray = data.match(<RegExp>meta.test);
                    if (result && result.length > 0) {
                        this.matchFound(metaIndex, { chunk: data, matches: result });
                    }
                }
                else if (typeof meta.test === 'string') {
                    let result: number[] = []; // matches indices
                    let dataIndex = -1;
                    while((dataIndex = data.indexOf(<string>meta.test, dataIndex + 1)) > -1) {
                        result.push(dataIndex);
                    }
                    if (result.length > 0) {
                        this.matchFound(metaIndex, { chunk: data, matches: result });
                    }
                }
                else {
                    throw new TypeError("Invalid type");
                }
            });
        });
        this._metas = [];
    }

    public nextMatch(test: string | RegExp): Promise<MatchFound> {
        let meta: MatchMeta = {
            test: test,
            resolve: null,
            reject: null,
            promise: null
        };
        meta.promise = new Promise<MatchFound>((resolve, reject) => {
            meta.resolve = resolve;
            meta.reject = reject;
        });
        this._metas.push(meta);
        return meta.promise;
    }

    private matchFound(matchMetaIndex: number, matchResult: MatchFound) {
        let meta: MatchMeta = this._metas[matchMetaIndex];
        this._metas.splice(matchMetaIndex, 1); // remove the meta
        meta.resolve(matchResult);
    }
}
