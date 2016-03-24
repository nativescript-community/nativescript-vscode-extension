import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';

export interface TestsConfig {
    cliPath?: string;
    platforms?: string[];
    emulator?: boolean;
    port?: number;
    skipSuitePrepare?: boolean;
}

export class TestsContext {
    private _extensionRootPath: string;
    private _testdataPath: string;
    private _debugAdapterMainPath: string;
    private _testsConfig: TestsConfig;

    constructor() {
        this._extensionRootPath = path.resolve(__dirname, '../../');
        this._testdataPath = path.join(this._extensionRootPath, 'src/tests/testdata');
        this._debugAdapterMainPath = path.join(this._extensionRootPath, 'out/webkit/webkitDebug.js');
        this._testsConfig = TestsContext.computeTestsConfig();
    }

    public getTestdataPath() {
        return this._testdataPath;
    }

    public getDebugAdapterMainPath() {
        return this._debugAdapterMainPath;
    }

    public getTestsConfig() {
        return this._testsConfig;
    }

    public getAppPath(appName: string) {
        return path.join(this._testdataPath, appName);
    }

    public prepare() {
        TestsContext.removeRecursiveSync(this.getAppPath('JsApp'));
        TestsContext.removeRecursiveSync(this.getAppPath('TsApp'));
        this.createAppSync('JsApp', undefined);
        this.createAppSync('TsApp', 'typescript');
    }

    public createAppSync(appName: string, template?: string) {
        // create the app
        let createCommand = `${this._testsConfig.cliPath} create ${appName} --template ${template || "tns-template-hello-world"}`;
        console.log(createCommand);
        cp.execSync(createCommand, { cwd: this.getTestdataPath() });
        // add platforms
        this.getTestsConfig().platforms.forEach(platform => {
            cp.execFileSync(this._testsConfig.cliPath, ['platform', 'add', platform], {cwd: this.getAppPath(appName)});
        });
    }

    private static computeTestsConfig(): TestsConfig {
        let configs: TestsConfig = {};

        // Extend the default configurations with external config file, if exists
        for (let i = 0; i < process.argv.length; i++) {
            let str = process.argv[i];
            if (process.argv[i] == '--config' && i + 1 < process.argv.length) {
                configs = require(process.argv[i + 1]);
                break;
            }
        }

        configs.cliPath = configs.cliPath ? path.resolve(__dirname, configs.cliPath) : 'tns';
        return configs;
    }

    private static removeRecursiveSync(path) {
        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach(function(file,index) {
                var curPath = path + "/" + file;
                if (fs.lstatSync(curPath).isDirectory()) { // recurse
                    TestsContext.removeRecursiveSync(curPath);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(path);
        }
    }
}