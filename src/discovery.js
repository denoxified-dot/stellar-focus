import { createGalaxy } from './galaxy.js';
import { createCluster } from './cluster.js';
import { createNebula } from './nebula.js';
import { createPlanet } from './planet.js';
import { describePlanet } from './exoplanets.js';
import { hashString, clamp } from './util.js';

// The discovery system: given how long the user studied (intensity 0..1), pick
// a REAL object to discover, build its visual, and describe it.
//
// Both the TYPE and the SIZE scale with the session:
//   • short sessions → small/close things (exoplanets, small clusters)
//   • long sessions  → grand things (big nebulae, large galaxies)
// Type is chosen first (each category has a "grandeur" center it sits near on
// the duration axis); then within that category we favour objects whose own
// size matches the session, so a long galaxy session finds a big bright galaxy.

// How "grand" each deep-sky subtype reads, 0..1. Used to rank objects within a
// category by their intrinsic size.
const SUBTYPE_GRANDEUR = {
  'Open cluster': 0.30,
  'Globular cluster': 0.45,
  'Planetary nebula': 0.40,
  'Reflection nebula': 0.55,
  'Supernova remnant': 0.58,
  'Emission nebula': 0.66,
  'Emission/reflection nebula': 0.66,
  'Emission nebula with cluster': 0.68,
  'Dwarf elliptical galaxy': 0.6,
  'Lenticular galaxy': 0.75,
  'Spiral galaxy': 0.82,
  'Barred spiral galaxy': 0.82,
  'Starburst galaxy': 0.8,
  'Elliptical galaxy': 0.86,
};

const gaussian = (x, s) => Math.exp(-(x * x) / (2 * s * s));

function weightedPick(items, weights, rng = Math.random) {
  let total = 0;
  for (const w of weights) total += w;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Intrinsic "size" of a candidate on the 0..1 grandeur axis. */
function sizeProxy(kind, o) {
  if (kind === 'planet') {
    const r = o.radiusEarth ?? 1;
    return clamp(Math.log10(r + 1) / Math.log10(25), 0, 1); // tiny→0, Jupiter-class→~1
  }
  const base = SUBTYPE_GRANDEUR[o.subtype] ?? 0.5;
  const brightness = clamp((11 - o.magnitude) / 11, 0, 1); // brighter showpieces read bigger
  return clamp(0.55 * base + 0.45 * brightness, 0, 1);
}

/**
 * Choose a real object to discover for a session of the given intensity.
 * @returns {{ kind, object, size } | null} null if no data is available at all.
 */
export function chooseDiscovery(intensity, { messier, exoplanets } = {}) {
  const t = clamp(intensity, 0, 1);

  const categories = [
    { kind: 'planet', center: 0.08, pool: exoplanets ?? [] },
    { kind: 'cluster', center: 0.38, pool: (messier ?? []).filter((o) => o.type === 'Cluster') },
    { kind: 'nebula', center: 0.62, pool: (messier ?? []).filter((o) => o.type === 'Nebula') },
    { kind: 'galaxy', center: 0.88, pool: (messier ?? []).filter((o) => o.type === 'Galaxy') },
  ].filter((c) => c.pool.length > 0);

  if (categories.length === 0) return null;

  // Pick the category whose grandeur center sits nearest the session length.
  const catWeights = categories.map((c) => gaussian(c.center - t, 0.24));
  const cat = weightedPick(categories, catWeights);

  // Within that category, favour objects whose own size matches the session.
  const sized = cat.pool.map((o) => ({ o, size: sizeProxy(cat.kind, o) }));
  const objWeights = sized.map((s) => gaussian(s.size - t, 0.3) + 0.02);
  const picked = weightedPick(sized, objWeights);

  return { kind: cat.kind, object: picked.o, size: picked.size };
}

/**
 * Build the THREE visual for a discovery.
 * @returns {{ object3D, radius, spin, kind }}
 */
export function buildDiscoveryVisual(choice, intensity) {
  const { kind, object, size } = choice;
  const seed = hashString(object.name || `M${object.messier}` || 'object');

  if (kind === 'galaxy') {
    const eff = clamp(0.25 + 0.55 * size + 0.3 * intensity, 0, 1);
    const obj = createGalaxy(seed, eff);
    obj.rotation.x = Math.PI * 0.18; // 3/4 tilt
    obj.rotation.z = Math.PI * 0.05;
    return { object3D: obj, radius: obj.userData.radius, spin: 0.05, kind };
  }
  if (kind === 'cluster') {
    const obj = createCluster({ subtype: object.subtype, size, intensity, seed });
    return { object3D: obj, radius: obj.userData.radius, spin: 0.03, kind };
  }
  if (kind === 'nebula') {
    const obj = createNebula({ subtype: object.subtype, size, intensity, seed });
    return { object3D: obj, radius: obj.userData.radius, spin: 0.02, kind };
  }
  // planet
  const obj = createPlanet({ radiusEarth: object.radiusEarth, size, intensity, seed, name: object.name });
  return { object3D: obj, radius: obj.userData.radius, spin: 0.25, kind };
}

// --- description for the discovery card -------------------------------------

function formatLy(ly) {
  if (ly == null) return null;
  if (ly >= 1e6) return `${Math.round((ly / 1e6) * 10) / 10} million light-years`;
  return `${Math.round(ly).toLocaleString()} light-years`;
}

const LABELS = {
  galaxy: 'Galaxy discovered',
  nebula: 'Nebula discovered',
  cluster: 'Star cluster discovered',
  planet: 'Exoplanet discovered',
};

/**
 * Readable description for the discovery card.
 * @returns {{ label, name, headline, description }}
 */
export function describeDiscovery(choice) {
  const { kind, object } = choice;

  if (kind === 'planet') {
    return { label: LABELS.planet, ...describePlanet(object) };
  }

  const name = object.name || `Messier ${object.messier}`;
  const headline = [
    `M${object.messier}`,
    object.subtype,
    object.constellation,
    formatLy(object.distanceLy),
    `mag ${object.magnitude}`,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const description =
    `${object.description} It lies about ${formatLy(object.distanceLy)} away` +
    `${object.constellation ? `, in the constellation ${object.constellation}` : ''}.`;

  return { label: LABELS[kind], name, headline, description };
}
