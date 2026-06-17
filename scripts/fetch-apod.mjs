// One-time data fetch: pulls real NASA "Astronomy Picture of the Day" (APOD)
// entries — the photographs and the astronomer-written explanations — and
// writes them to public/apod.json, which the app loads at runtime. Run with:
//   node scripts/fetch-apod.mjs        (or: npm run fetch-apod)
//
// API docs: https://api.nasa.gov/  (APOD section)
//
// The NASA API key is read from the NASA_API_KEY environment variable (loaded
// from a local, git-ignored .env file if present). If it isn't set, we fall
// back to NASA's shared DEMO_KEY. The key lives only in this server-side
// script — it is never bundled into the browser app.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'public', 'apod.json');
const ENV_PATH = resolve(__dirname, '..', '.env');

// Load .env if it exists (Node 20.12+). Absence is fine — we fall back below.
try {
  process.loadEnvFile(ENV_PATH);
} catch {
  /* no .env file — that's OK, we'll use the environment or DEMO_KEY */
}

const API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const COUNT = 50; // how many random APOD entries to pull in one request

const url =
  'https://api.nasa.gov/planetary/apod?' +
  new URLSearchParams({ api_key: API_KEY, count: String(COUNT), thumbs: 'true' }).toString();

async function main() {
  if (API_KEY === 'DEMO_KEY') {
    console.log('No NASA_API_KEY set — using shared DEMO_KEY (rate limited).');
    console.log('Get your own free key at https://api.nasa.gov/ and put it in .env\n');
  } else {
    console.log('Using NASA API key from environment.\n');
  }

  console.log(`Fetching ${COUNT} random NASA APOD entries…`);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `NASA APOD API returned HTTP ${res.status} ${res.statusText}\n${body.slice(0, 500)}`
    );
  }

  const entries = await res.json();
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('No entries returned from APOD — refusing to write an empty data file.');
  }

  // Keep only still images (skip videos), and normalize to the fields we show.
  const images = entries
    .filter((e) => e.media_type === 'image' && (e.url || e.hdurl))
    .map((e) => ({
      title: e.title ?? null,
      date: e.date ?? null,
      explanation: e.explanation ?? null, // the astronomer-written caption
      url: e.url ?? null,
      hdurl: e.hdurl ?? null,
      copyright: e.copyright ? e.copyright.trim() : null,
    }));

  if (images.length === 0) {
    throw new Error('APOD returned only non-image entries this time — try running again.');
  }

  const payload = {
    source: 'NASA Astronomy Picture of the Day (APOD) API',
    fetchedAt: new Date().toISOString(),
    count: images.length,
    images,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload), 'utf8');

  console.log(`\nSaved ${images.length} NASA images to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('\nFailed to fetch NASA APOD data:');
  console.error(err.message || err);
  process.exitCode = 1;
});
