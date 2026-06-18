// Enrichment pass: attaches a REAL, verified photograph to each Messier object
// in public/messier.json by querying the NASA Image and Video Library, and —
// crucially — only keeps an image when it genuinely depicts that object. Run
// AFTER `npm run fetch-messier` (which builds the catalog), with:
//   node scripts/fetch-messier-images.mjs    (or: npm run fetch-messier-images)
//
// API: https://images-api.nasa.gov/  (keyless, public domain imagery)
//
// Why the strict matching: a naive search for "Messier 3" happily returns the
// Pillars of Creation (which is M16) or an unrelated galaxy. Pairing those with
// M3 would be plainly wrong. So a result is accepted only when its TITLE or
// KEYWORDS actually reference the object — by its common name (e.g. "Crab
// Nebula") or its Messier designation as a whole token ("Messier 3" / "M3", not
// a loose mention buried in a paragraph about a different object). Objects with
// no genuine match get no image, and the app shows their data alone.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '..', 'public', 'messier.json');

const SEARCH = 'https://images-api.nasa.gov/search';
const ASSET = 'https://images-api.nasa.gov/asset';
const THROTTLE_MS = 150; // be polite to the public API between objects

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Lowercase, strip accents/punctuation, collapse whitespace — for phrase tests.
const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// A "real" name is a proper name like "Whirlpool Galaxy" — not a bare "Messier 51".
const hasRealName = (o) => o.name && o.name.trim() && !/^messier\b/i.test(o.name.trim());

// Matches this object's Messier number as a standalone token: "messier 3",
// "m 3", "m3" — but not "messier 30" / "m31" (a trailing digit breaks the word
// boundary), so M3 never matches an image that only mentions M30 or M31.
const designationRe = (n) => new RegExp(`\\b(?:messier\\s*0*${n}|m\\s*0*${n})\\b`, 'i');

/** True only if `item` genuinely depicts object `o`. */
function isGenuineMatch(o, item) {
  const dt = (item.data && item.data[0]) || {};
  const title = norm(dt.title);
  const keywords = norm((dt.keywords || []).join(' '));
  // Common name appearing in the title is an unambiguous, high-confidence hit.
  if (hasRealName(o) && title.includes(norm(o.name))) return true;
  // Otherwise require the exact Messier designation in the title or keywords
  // (the free-text description is too noisy — it often names other objects).
  const re = designationRe(o.messier);
  return re.test(title) || re.test(keywords);
}

/** Pick the best still-image rendition for a NASA asset (prefer ~medium). */
async function bestImageUrl(nasaId) {
  const res = await fetch(`${ASSET}/${encodeURIComponent(nasaId)}`);
  if (!res.ok) return null;
  const json = await res.json();
  const hrefs = ((json.collection && json.collection.items) || [])
    .map((i) => i.href)
    .filter((h) => /\.(jpg|jpeg|png)$/i.test(h))
    .map((h) => h.replace(/^http:/, 'https:')); // serve over https
  const pick =
    hrefs.find((h) => /~medium\./i.test(h)) ||
    hrefs.find((h) => /~small\./i.test(h)) ||
    hrefs.find((h) => /~orig\./i.test(h)) ||
    hrefs.find((h) => /~thumb\./i.test(h)) ||
    hrefs[0];
  return pick || null;
}

/** Find a verified image for one object, or null if none genuinely matches. */
async function findImage(o) {
  const query = hasRealName(o) ? o.name : `Messier ${o.messier}`;
  const url = `${SEARCH}?${new URLSearchParams({ q: query, media_type: 'image' })}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const json = await res.json();
  const items = (json.collection && json.collection.items) || [];

  const match = items.find((it) => isGenuineMatch(o, it));
  if (!match) return null;

  const dt = match.data[0];
  const imageUrl = await bestImageUrl(dt.nasa_id);
  if (!imageUrl) return null;

  const credit = ['NASA Image and Video Library', dt.center, dt.secondary_creator]
    .filter(Boolean)
    .join(' · ');

  return {
    url: imageUrl,
    title: dt.title || null,
    credit,
    description: dt.description || null,
    nasaId: dt.nasa_id,
  };
}

async function main() {
  const raw = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const objects = Array.isArray(raw) ? raw : raw.objects;
  if (!Array.isArray(objects) || objects.length === 0) {
    throw new Error('messier.json has no objects — run `npm run fetch-messier` first.');
  }

  console.log(`Matching real NASA imagery to ${objects.length} Messier objects…\n`);
  let matched = 0;

  for (const o of objects) {
    let image = null;
    try {
      image = await findImage(o);
    } catch (err) {
      console.log(`  M${o.messier}: lookup failed (${err.message}) — leaving without an image`);
    }

    if (image) {
      o.image = image; // verified — genuinely depicts this object
      matched++;
      console.log(`  M${o.messier} ${o.name || ''} ✓  ${image.title}`);
    } else {
      delete o.image; // no genuine match — keep the field absent (idempotent re-runs)
    }

    await sleep(THROTTLE_MS);
  }

  const payload = Array.isArray(raw)
    ? objects
    : { ...raw, builtAt: new Date().toISOString(), objects };

  await writeFile(DATA_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\nDone — ${matched}/${objects.length} objects now have a verified image.`);
}

main().catch((err) => {
  console.error('\nFailed to enrich Messier imagery:');
  console.error(err.message || err);
  process.exitCode = 1;
});
