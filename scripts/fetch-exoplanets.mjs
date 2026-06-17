// One-time data fetch: pulls real confirmed exoplanets from the NASA Exoplanet
// Archive and writes them to public/exoplanets.json, which the app loads at
// runtime. Run with:  node scripts/fetch-exoplanets.mjs   (or: npm run fetch-data)
//
// Source: NASA Exoplanet Archive TAP service, `pscomppars` table (the
// "Planetary Systems Composite Parameters" table — one row per planet, with a
// best-available value chosen for each column). Docs:
//   https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'public', 'exoplanets.json');

// Columns we pull, mapped to friendlier keys when we store them:
//   pl_name         planet name
//   hostname        host star name
//   pl_rade         planet radius   [Earth radii]
//   pl_bmasse       planet mass     [Earth masses]
//   pl_orbper       orbital period  [days]
//   disc_year       discovery year
//   discoverymethod discovery method
const ADQL = [
  'select pl_name, hostname, pl_rade, pl_bmasse, pl_orbper, disc_year, discoverymethod',
  'from pscomppars',
  'where pl_name is not null',
].join(' ');

const TAP_URL =
  'https://exoplanetarchive.ipac.caltech.edu/TAP/sync?' +
  new URLSearchParams({ query: ADQL, format: 'json' }).toString();

async function main() {
  console.log('Fetching confirmed exoplanets from the NASA Exoplanet Archive…');
  console.log('  query:', ADQL);

  const res = await fetch(TAP_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `NASA Exoplanet Archive returned HTTP ${res.status} ${res.statusText}\n${body.slice(0, 500)}`
    );
  }

  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No rows returned from the archive — refusing to write an empty data file.');
  }

  // Normalize: rename to friendly keys and coerce numeric fields to numbers or
  // null (the TAP JSON already gives numbers/nulls, but be defensive).
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const planets = rows.map((r) => ({
    name: r.pl_name ?? null,
    host: r.hostname ?? null,
    radiusEarth: num(r.pl_rade),
    massEarth: num(r.pl_bmasse),
    orbitalPeriodDays: num(r.pl_orbper),
    discoveryYear: num(r.disc_year),
    discoveryMethod: r.discoverymethod ?? null,
  }));

  const payload = {
    source: 'NASA Exoplanet Archive — pscomppars table',
    fetchedAt: new Date().toISOString(),
    count: planets.length,
    planets,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload), 'utf8');

  console.log(`\nSaved ${planets.length} exoplanets to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('\nFailed to fetch exoplanet data:');
  console.error(err.message || err);
  process.exitCode = 1;
});
