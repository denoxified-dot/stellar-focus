// Loads the Messier catalog (110 real deep-sky objects) from public/messier.json,
// produced by `npm run fetch-messier`. The data file is the source of truth; if
// it is missing, loadMessier() resolves to null and the discovery system falls
// back to whatever other data is available.

let cache; // undefined = not tried, null = unavailable, array = loaded

/**
 * Load and cache the Messier catalog from public/messier.json.
 * @returns {Promise<Array|null>} the objects, or null if the file is missing.
 */
export async function loadMessier() {
  if (cache !== undefined) return cache;
  try {
    const res = await fetch('/messier.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const objects = Array.isArray(data) ? data : data?.objects;
    cache = Array.isArray(objects) && objects.length ? objects : null;
  } catch {
    cache = null; // missing or unreadable — handled gracefully by callers.
  }
  return cache;
}
