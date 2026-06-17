// Loads the real NASA APOD imagery and serves up one random photo (with its
// astronomer-written caption) to accompany a discovery.
//
// The data file (public/apod.json) is produced by `npm run fetch-apod`. It is
// the source of truth. If it does not exist yet, loadApod() resolves to null
// and callers simply skip the image — the discovery still works.

let cache; // undefined = not tried, null = unavailable, array = loaded

/**
 * Load and cache the APOD image list from public/apod.json.
 * @returns {Promise<Array|null>} the images, or null if the file is missing.
 */
export async function loadApod() {
  if (cache !== undefined) return cache;
  try {
    const res = await fetch('/apod.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const images = Array.isArray(data) ? data : data?.images;
    cache = Array.isArray(images) && images.length ? images : null;
  } catch {
    cache = null; // missing or unreadable — handled gracefully by callers.
  }
  return cache;
}

/** Pick one image uniformly at random from the loaded list. */
export function pickRandomImage(images) {
  return images[Math.floor(Math.random() * images.length)];
}
