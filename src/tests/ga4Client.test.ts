import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ga4Client, loadGa4Config, toEventName } from '../analytics/ga4Client';

describe('toEventName', () => {
  it.each([
    ['debug', 'debug'],
    ['Debug-Launch ios', 'Debug_Launch_ios'],
    ['123_start', 'start'],
    ['_-.private', 'private'],
    ['', 'vscode_event'],
    ['1234', 'vscode_event'],
    ['a'.repeat(50), 'a'.repeat(40)],
  ])('normalizes %j to %j', (input, expected) => {
    expect(toEventName(input)).toBe(expected);
  });
});

describe('Ga4Client.sendEvent', () => {
  const config = { measurementId: 'G-ABC123', apiSecret: 'se/cret&key' };

  const createFetch = (response: Partial<Response> = { ok: true, status: 204 }) =>
    vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response as Response);

  it('posts the event to the Measurement Protocol endpoint', async () => {
    const fetchImpl = createFetch();
    const client = new Ga4Client(config, 'client-1', fetchImpl);

    await client.sendEvent('Debug-Launch', { platform: 'ios', count: 2, watch: true, missing: undefined });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://www.google-analytics.com/mp/collect?measurement_id=G-ABC123&api_secret=se%2Fcret%26key');
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(init!.body as string)).toEqual({
      client_id: 'client-1',
      non_personalized_ads: true,
      events: [
        {
          name: 'Debug_Launch',
          params: { engagement_time_msec: 1, platform: 'ios', count: 2, watch: true },
        },
      ],
    });
  });

  it('truncates long string params to 100 characters', async () => {
    const fetchImpl = createFetch();
    const client = new Ga4Client(config, 'client-1', fetchImpl);

    await client.sendEvent('error', { message: 'x'.repeat(250) });

    const body = JSON.parse(fetchImpl.mock.calls[0][1]!.body as string);
    expect(body.events[0].params.message).toBe('x'.repeat(100));
  });

  it('throws on a non-ok response', async () => {
    const client = new Ga4Client(config, 'client-1', createFetch({ ok: false, status: 400 }));

    await expect(client.sendEvent('debug', {})).rejects.toThrow('GA4 responded with HTTP 400');
  });

  it('propagates network errors', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });
    const client = new Ga4Client(config, 'client-1', fetchImpl);

    await expect(client.sendEvent('debug', {})).rejects.toThrow('offline');
  });
});

describe('loadGa4Config', () => {
  let dir: string;
  const configFile = () => path.join(dir, 'ga-config.json');

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-ga4-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns undefined when the file is missing', () => {
    expect(loadGa4Config(configFile())).toBeUndefined();
  });

  it('returns undefined for invalid JSON', () => {
    fs.writeFileSync(configFile(), '{ nope');
    expect(loadGa4Config(configFile())).toBeUndefined();
  });

  it.each([[{ measurementId: 'G-ABC123' }], [{ apiSecret: 'secret' }], [{ measurementId: '', apiSecret: 'secret' }]])(
    'returns undefined for partial config %j',
    (content) => {
      fs.writeFileSync(configFile(), JSON.stringify(content));
      expect(loadGa4Config(configFile())).toBeUndefined();
    },
  );

  it('returns only the known keys of a valid config', () => {
    fs.writeFileSync(configFile(), JSON.stringify({ measurementId: 'G-ABC123', apiSecret: 'secret', extra: 1 }));
    expect(loadGa4Config(configFile())).toEqual({ measurementId: 'G-ABC123', apiSecret: 'secret' });
  });
});
