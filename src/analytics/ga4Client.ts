import * as fs from 'fs';
import * as path from 'path';

export interface Ga4Config {
  measurementId: string;
  apiSecret: string;
}

export type Ga4Params = Record<string, string | number | boolean | undefined>;

/** Written by scripts/write-ga-config.mjs at package time; absent in dev builds, which disables analytics. */
export const GA_CONFIG_FILE = path.join(__dirname, '..', 'ga-config.json');

const ENDPOINT = 'https://www.google-analytics.com/mp/collect';
// GA4 Measurement Protocol limits.
const MAX_EVENT_NAME_LENGTH = 40;
const MAX_PARAM_VALUE_LENGTH = 100;

export function loadGa4Config(file = GA_CONFIG_FILE): Ga4Config | undefined {
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Ga4Config>;
    return config.measurementId && config.apiSecret
      ? { measurementId: config.measurementId, apiSecret: config.apiSecret }
      : undefined;
  } catch {
    return undefined;
  }
}

/** Same normalization as the CLI's google-analytics-provider so event names line up across both. */
export function toEventName(name: string): string {
  const normalized = name
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/^[^A-Za-z]+/, '')
    .slice(0, MAX_EVENT_NAME_LENGTH);
  return normalized || 'vscode_event';
}

export class Ga4Client {
  constructor(
    private readonly config: Ga4Config,
    private readonly clientId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  public async sendEvent(name: string, params: Ga4Params): Promise<void> {
    const url = `${ENDPOINT}?measurement_id=${encodeURIComponent(this.config.measurementId)}&api_secret=${encodeURIComponent(this.config.apiSecret)}`;

    const eventParams: Record<string, string | number | boolean> = { engagement_time_msec: 1 };
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      eventParams[key] = typeof value === 'string' ? value.slice(0, MAX_PARAM_VALUE_LENGTH) : value;
    }

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        non_personalized_ads: true,
        events: [{ name: toEventName(name), params: eventParams }],
      }),
    });

    if (!response.ok) {
      throw new Error(`GA4 responded with HTTP ${response.status}`);
    }
  }
}
