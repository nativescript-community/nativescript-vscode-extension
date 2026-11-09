import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { ILogger } from '../common/logger';
import { WorkspaceConfigService } from '../common/workspaceConfigService';
import { Ga4Client, Ga4Config, Ga4Params, loadGa4Config } from './ga4Client';

const PROMPT_SHOWN_KEY = 'nativescript.hasAnalyticsPromptShown';
const CLIENT_ID_KEY = 'nativescript.analyticsClientId';
const DOCS_LINK =
  'https://github.com/nativescript-community/nativescript-vscode-extension/blob/master/README.md#how-to-disable-the-analytics';
const PROMPT_MESSAGE = `Help improve the NativeScript extension by sending anonymous usage statistics? You can [disable it](${DOCS_LINK}) at any time.`;
const ACCEPT = 'Yes';
const DENY = 'No';

export class AnalyticsService {
  private client: Ga4Client | undefined;
  private readonly sessionId = randomUUID();
  private cliVersion: string | undefined;

  constructor(
    private readonly globalState: vscode.Memento,
    private readonly workspaceConfig: WorkspaceConfigService,
    private readonly logger: ILogger,
    private readonly extensionVersion: string,
    private readonly config: Ga4Config | undefined = loadGa4Config(),
  ) {}

  public initialize(cliVersion: string): void {
    this.cliVersion = cliVersion;

    // Nothing to ask for when this build can't send anything.
    if (!this.config || !vscode.env.isTelemetryEnabled) return;

    if (!this.globalState.get<boolean>(PROMPT_SHOWN_KEY)) {
      void vscode.window.showInformationMessage(PROMPT_MESSAGE, ACCEPT, DENY).then(async (result) => {
        await this.globalState.update(PROMPT_SHOWN_KEY, true);
        await this.workspaceConfig.setAnalyticsEnabled(result === ACCEPT);
      });
    }
  }

  public trackDebug(request: string, platform: string): Promise<void> {
    return this.track('debug', { request, platform });
  }

  public trackRun(platform: string): Promise<void> {
    return this.track('run', { platform });
  }

  private async track(name: string, params: Ga4Params): Promise<void> {
    // Respect both our own opt-in and VS Code's global telemetry setting.
    if (!this.config || !vscode.env.isTelemetryEnabled || !this.workspaceConfig.isAnalyticsEnabled) return;

    try {
      this.client ??= new Ga4Client(this.config, await this.getOrCreateClientId());
      await this.client.sendEvent(name, {
        event_category: 'VSCode',
        client: 'VSCode',
        cli_version: this.cliVersion,
        extension_version: this.extensionVersion,
        vscode_version: vscode.version,
        os: process.platform,
        session_id: this.sessionId,
        ...params,
      });
    } catch (e) {
      this.logger.log(`Analytics error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async getOrCreateClientId(): Promise<string> {
    let clientId = this.globalState.get<string>(CLIENT_ID_KEY);
    if (!clientId) {
      clientId = randomUUID();
      await this.globalState.update(CLIENT_ID_KEY, clientId);
    }
    return clientId;
  }
}
