// Writes out/ga-config.json from GA_MEASUREMENT_ID / GA_API_SECRET so release builds can send analytics.
// The API secret must never be committed; set it in the release environment (e.g. a CI secret).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'out', 'ga-config.json');
const measurementId = process.env.GA_MEASUREMENT_ID ?? '';
const apiSecret = process.env.GA_API_SECRET ?? '';

if (!measurementId || !apiSecret) {
  rmSync(outFile, { force: true });
  console.warn('GA_MEASUREMENT_ID or GA_API_SECRET not set; packaging without analytics.');
} else {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ measurementId, apiSecret }) + '\n');
  console.log(`Wrote analytics config for ${measurementId}.`);
}
