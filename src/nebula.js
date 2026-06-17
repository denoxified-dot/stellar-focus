import * as THREE from 'three';
import { getParticleTexture } from './particleTexture.js';
import { makeRng, clamp, lerp } from './util.js';

// Renders a nebula as a glowing, volumetric-looking cloud of additive
// particles. The shape and palette depend on the real subtype:
//   Planetary nebula → a thin glowing shell/ring (a dying star's shed shell).
//   Everything else  → a clumpy, fractal-ish cloud built from several blobs.
// `size` (the object's real grandeur) and `intensity` (session length) drive
// the particle count and physical radius.

// Per-subtype colour: { core, edge } — core glows at the bright center, edge
// tints the diffuse outskirts. Additive blending brightens overlaps.
function paletteFor(subtype) {
  const C = (r, g, b) => new THREE.Color(r, g, b);
  if (/planetary/i.test(subtype)) return { core: C(0.85, 1.0, 0.9), edge: C(0.1, 0.8, 0.7) }; // teal/green
  if (/supernova/i.test(subtype)) return { core: C(1.0, 0.85, 0.55), edge: C(0.95, 0.2, 0.2) }; // orange→red
  if (/reflection/i.test(subtype) && !/emission/i.test(subtype))
    return { core: C(0.75, 0.88, 1.0), edge: C(0.2, 0.4, 0.95) }; // blue reflection
  if (/emission\/reflection/i.test(subtype)) return { core: C(1.0, 0.7, 0.85), edge: C(0.45, 0.3, 0.95) };
  return { core: C(1.0, 0.65, 0.78), edge: C(0.9, 0.12, 0.34) }; // emission red/magenta
}

export function createNebula({ subtype = 'Emission nebula', size = 0.5, intensity = 0.5, seed = 1 } = {}) {
  const rng = makeRng(seed);
  const eff = clamp(0.3 + 0.5 * size + 0.3 * intensity, 0, 1);
  const radius = lerp(30, 96, eff);
  const count = Math.floor(lerp(7000, 42000, eff));
  const planetary = /planetary/i.test(subtype);
  const { core, edge } = paletteFor(subtype);

  // Seed a handful of clump centers so the cloud has internal structure
  // instead of being a featureless blob.
  const clumpCount = planetary ? 1 : 3 + Math.floor(rng() * 4);
  const clumps = [];
  for (let k = 0; k < clumpCount; k++) {
    clumps.push({
      x: (rng() - 0.5) * radius * 0.9,
      y: (rng() - 0.5) * radius * 0.5,
      z: (rng() - 0.5) * radius * 0.9,
      r: radius * (0.35 + rng() * 0.5),
    });
  }

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    let x, y, z, distNorm;
    if (planetary) {
      // Thin glowing shell → reads as a ring from any angle.
      const u = rng() * 2 - 1;
      const theta = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const shell = radius * (0.78 + (rng() - 0.5) * 0.28);
      x = s * Math.cos(theta) * shell;
      y = u * shell * 0.85;
      z = s * Math.sin(theta) * shell;
      distNorm = 0.5 + 0.5 * rng();
    } else {
      // Cloudy clump: gaussian-ish falloff around a randomly chosen clump.
      const cl = clumps[Math.floor(rng() * clumps.length)];
      const u = rng() * 2 - 1;
      const theta = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const d = Math.pow(rng(), 1.7) * cl.r; // dense center, wispy edges
      x = cl.x + s * Math.cos(theta) * d;
      y = cl.y + u * d * 0.7;
      z = cl.z + s * Math.sin(theta) * d;
      distNorm = clamp(Math.hypot(x, y, z) / radius, 0, 1);
    }

    positions[i3 + 0] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    // Blend core→edge with distance, with a touch of jitter, and let the
    // center glow brighter so the cloud has a luminous heart.
    c.copy(core).lerp(edge, distNorm);
    const jitter = 0.85 + rng() * 0.3;
    const boost = (planetary ? 1.0 : 1 + (1 - distNorm) * 0.8) * jitter;
    colors[i3 + 0] = c.r * boost;
    colors[i3 + 1] = c.g * boost;
    colors[i3 + 2] = c.b * boost;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: lerp(1.4, 2.4, eff),
    sizeAttenuation: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    map: getParticleTexture(),
    alphaMap: getParticleTexture(),
  });

  const points = new THREE.Points(geometry, material);
  points.userData.radius = radius;
  return points;
}
