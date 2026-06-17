// Loads the real NASA exoplanet data and turns one record into a short,
// readable "discovery" for the end of a focus session.
//
// The data file (public/exoplanets.json) is produced by the one-time fetch
// script (`npm run fetch-data`). It is the single source of truth. If it does
// not exist yet, loadExoplanets() resolves to null and callers fall back
// gracefully — the app still works, it just can't show a real planet.

let cache; // undefined = not tried yet, null = unavailable, array = loaded

/**
 * Load and cache the exoplanet list from public/exoplanets.json.
 * @returns {Promise<Array|null>} the planets, or null if the file is missing.
 */
export async function loadExoplanets() {
  if (cache !== undefined) return cache;
  try {
    const res = await fetch('/exoplanets.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Accept either a bare array or the { planets: [...] } wrapper the script
    // writes.
    const planets = Array.isArray(data) ? data : data?.planets;
    cache = Array.isArray(planets) && planets.length ? planets : null;
  } catch {
    cache = null; // missing or unreadable — handled gracefully by callers.
  }
  return cache;
}

/** Pick one planet uniformly at random from the loaded list. */
export function pickRandomPlanet(planets) {
  return planets[Math.floor(Math.random() * planets.length)];
}

// --- formatting helpers -----------------------------------------------------

function round(n, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Earth-relative radius, with a couple of human-friendly size labels. */
function radiusPhrase(r) {
  if (r == null) return null;
  let kind = '';
  if (r < 1.6) kind = ' (rocky, roughly Earth-sized)';
  else if (r < 4) kind = ' (a super-Earth / mini-Neptune)';
  else if (r < 10) kind = ' (a Neptune-like world)';
  else kind = ' (a gas giant)';
  return `${round(r, 2)}× Earth's radius${kind}`;
}

function massPhrase(m) {
  if (m == null) return null;
  if (m >= 100) return `${round(m / 317.8, 2)}× Jupiter's mass`;
  return `${round(m, 1)}× Earth's mass`;
}

function periodPhrase(days) {
  if (days == null) return null;
  if (days < 1) return `once every ${round(days * 24, 1)} hours`;
  if (days < 100) return `once every ${round(days, 1)} days`;
  return `once every ${round(days, 0)} days (${round(days / 365.25, 1)} years)`;
}

/**
 * Build a short, readable description of a planet from its real properties.
 * Skips any fields the archive doesn't have a value for.
 * @returns {{ name, host, headline, description }}
 */
export function describePlanet(p) {
  const radius = radiusPhrase(p.radiusEarth);
  const mass = massPhrase(p.massEarth);
  const period = periodPhrase(p.orbitalPeriodDays);

  const sentences = [];

  // Opening sentence describes the planet and its star.
  if (p.host) {
    const traits = [radius, mass].filter(Boolean).join(', ');
    sentences.push(
      traits
        ? `${p.name} is a world ${traits}, orbiting the star ${p.host}.`
        : `${p.name} is a confirmed exoplanet orbiting the star ${p.host}.`
    );
  } else {
    sentences.push(`${p.name} is a confirmed exoplanet.`);
  }

  if (period) sentences.push(`It completes an orbit ${period}.`);

  // Discovery provenance.
  if (p.discoveryYear && p.discoveryMethod) {
    sentences.push(`Discovered in ${p.discoveryYear} via the ${p.discoveryMethod} method.`);
  } else if (p.discoveryYear) {
    sentences.push(`Discovered in ${p.discoveryYear}.`);
  } else if (p.discoveryMethod) {
    sentences.push(`Found using the ${p.discoveryMethod} method.`);
  }

  // A compact stat line for the headline row (only the known facts).
  const stats = [];
  if (p.host) stats.push(`Host: ${p.host}`);
  if (p.radiusEarth != null) stats.push(`${round(p.radiusEarth, 2)} R⊕`);
  if (p.massEarth != null) stats.push(`${round(p.massEarth, 1)} M⊕`);
  if (p.orbitalPeriodDays != null) stats.push(`${round(p.orbitalPeriodDays, 1)} d period`);
  if (p.discoveryYear != null) stats.push(`${p.discoveryYear}`);

  return {
    name: p.name,
    host: p.host,
    headline: stats.join('  ·  '),
    description: sentences.join(' '),
  };
}
