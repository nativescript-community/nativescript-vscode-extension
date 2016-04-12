import * as assert from 'assert';
import {DebugProtocol} from 'vscode-debugprotocol';
import {DebugClient} from 'vscode-debugadapter-testsupport';

export class NsDebugClient extends DebugClient {
    private _timeout: number = 90000;

    public getTimeout(): number {
        return this._timeout;
    }

    public setTimeout(timeout: number) {
        this._timeout = timeout;
    }

    // The method adds the following enhancements to its base implementation
    // 1. It has no hardcoded value for the timeout
    // 2. It removes the event listener after it is no needed anymore
    public waitForEvent(eventType: string, timeout?: number): Promise<DebugProtocol.Event> {
        timeout = timeout || this._timeout;
        return new Promise<DebugProtocol.Event>((resolve, reject) => {
            let eventListener: (event: DebugProtocol.Event) => any = (event) => {
                resolve(event);
                this.removeListener(eventType, eventListener);
            };
            this.on(eventType, eventListener);
            if (timeout) {
                setTimeout(() => {
                     reject(new Error("no event '" + eventType + "' received after " + timeout + " ms"));
                }, timeout);
            }
        });
    }

    public onNextTime(event: string): Promise<DebugProtocol.Event> {
        return this.waitForEvent(event);
    }

    public onNthTime(n: number, event: string): Promise<DebugProtocol.Event> {
        return n == 1 ?
            this.onNextTime(event) :
            this.onNextTime(event).then(e => this.onNthTime(--n, event));
    }

    public assertSetBreakpoints(path: string, breakpoints: { line: number, condition?: string }[]): Promise<{}> {
        return this.setBreakpointsRequest({
            lines: breakpoints.map(b => b.line),
            breakpoints: breakpoints,
            source: { path: path }
        })
        .then(response => {
            response.body.breakpoints.forEach((bp, i, a) => {
                assert.equal(bp.verified, true, 'breakpoint verification mismatch: verified');
                assert.equal(bp.line, breakpoints[i].line, 'breakpoint verification mismatch: line');
                //assert.equal(bp.column, breakpointColumn, 'breakpoint verification mismatch: column');
            });
            return Promise.resolve();
        });
    }

    public assertNthStoppedLocation(n: number, reason: string, expected: { path?: string; line?: number; column?: number; })
    : Promise<DebugProtocol.StackTraceResponse> {
        return n == 1 ?
            this.assertStoppedLocation(reason, expected) :
            this.onNextTime('stopped').then(e => this.assertNthStoppedLocation(--n, reason, expected));
    }
}