import { Readable } from 'stream';

export class StreamScanner {
    private _stream: Readable;
    private _scanCallback: (data: string, stop: () => void) => void;

    constructor(stream: Readable, scanCallback: (data: string, stop: () => void) => void) {
        this._stream = stream;
        this._scanCallback = scanCallback;
        this._stream.on('data', this.scan.bind(this));
    }

    public stop() {
        this._stream.removeListener('data', this.scan);
    }

    private scan(data: string | Buffer): void {
        this._scanCallback(data.toString(), this.stop);
    }
}

export interface IMatchFound {
    chunk: string;
    matches: RegExpMatchArray | number[];
}

interface IMatchMeta {
    promise: Promise<IMatchFound>;
    resolve: (match: IMatchFound) => void;
    reject: (err: Error) => void;
    test: string | RegExp;
}

export class StringMatchingScanner extends StreamScanner {
    private metas: IMatchMeta[];

    constructor(stream: Readable) {
        super(stream, (data: string, stop: () => void) => {
            this.metas.forEach((meta, metaIndex) => {
                if (meta.test instanceof RegExp) {
                    const result: RegExpMatchArray = data.match(meta.test as RegExp);

                    if (result && result.length > 0) {
                        this.matchFound(metaIndex, { chunk: data, matches: result });
                    }
                } else if (typeof meta.test === 'string') {
                    const result: number[] = []; // matches indices
                    let dataIndex = data.indexOf(meta.test as string, 0);

                    while (dataIndex > -1) {
                        result.push(dataIndex);
                        dataIndex = data.indexOf(meta.test as string, dataIndex + 1);
                    }
                    if (result.length > 0) {
                        this.matchFound(metaIndex, { chunk: data, matches: result });
                    }
                } else {
                    throw new TypeError('Invalid type');
                }
            });
        });

        this.metas = [];
    }

    public onEveryMatch(test: string | RegExp, handler: (result: IMatchFound) => void) {
        const handlerWrapper = (result: IMatchFound) => {
            handler(result);
            this.nextMatch(test).then(handlerWrapper);
        };

        this.nextMatch(test).then(handlerWrapper);
    }

    public nextMatch(test: string | RegExp): Promise<IMatchFound> {
        const meta: IMatchMeta = {
            promise: null,
            reject: null,
            resolve: null,
            test,
        };

        meta.promise = new Promise<IMatchFound>((resolve, reject) => {
            meta.resolve = resolve;
            meta.reject = reject;
        });
        this.metas.push(meta);

        return meta.promise;
    }

    private matchFound(matchMetaIndex: number, matchResult: IMatchFound) {
        const meta: IMatchMeta = this.metas[matchMetaIndex];

        this.metas.splice(matchMetaIndex, 1); // remove the meta
        meta.resolve(matchResult);
    }
}
