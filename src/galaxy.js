import * as THREE from 'three';
import { getParticleTexture } from './particleTexture.js';

// Generates one procedural spiral galaxy from a numeric seed. The same seed
// always yields the same galaxy, so a session is reproducible if you keep the
// seed. Particles use additive blending and bright core colors so they read as
// "glowing" and get picked up by the bloom pass.
//
// The galaxy's scale is driven by `intensity` (0..1), derived from how long the
// study session lasted. A short session yields a small, modest galaxy; a long
// one yields a huge, dense, dramatic galaxy with a blazing core and richer,
// more varied color.

/**
 * Mulberry32 — a tiny, fast, seedable pseudo-random generator.
 * Returns a function producing floats in [0, 1).
 */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} seed       deterministic seed for the galaxy's shape/color.
 * @param {number} intensity  0..1 scale factor from study-session length.
 */
export function createGalaxy(seed = Math.floor(Math.random() * 1e9), intensity = 0.5) {
  const rng = makeRng(seed);
  const t = THREE.MathUtils.clamp(intensity, 0, 1);

  // Everything that conveys "spectacle" scales with the session length.
  // The ranges are deliberately wide so a 1-minute galaxy and a 30-minute
  // galaxy look like completely different objects.
  const params = {
    count: Math.floor(THREE.MathUtils.lerp(9000, 240000, t)),
    radius: THREE.MathUtils.lerp(34, 180, t),
    branches: 3 + Math.floor(rng() * 4), // 3–6 spiral arms
    spin: 0.8 + rng() * 1.4,
    randomness: 0.35,
    randomnessPower: 2.6,
    // Brighter, whiter-hot core as the session grows.
    coreLightness: THREE.MathUtils.lerp(0.55, 0.86, t),
    // Stronger central glow boost on longer sessions.
    coreGlow: THREE.MathUtils.lerp(0.35, 1.9, t),
    // Per-particle hue/saturation jitter grows with intensity → richer color.
    colorVariation: THREE.MathUtils.lerp(0.04, 0.22, t),
    size: THREE.MathUtils.lerp(1.05, 1.5, t),
    insideColor: new THREE.Color().setHSL(
      0.05 + rng() * 0.1,
      1.0,
      THREE.MathUtils.lerp(0.55, 0.86, t)
    ), // warm core
    outsideColor: new THREE.Color().setHSL(0.52 + rng() * 0.18, 0.9, 0.5), // cool rim
  };

  const positions = new Float32Array(params.count * 3);
  const colors = new Float32Array(params.count * 3);

  const colorInside = params.insideColor;
  const colorOutside = params.outsideColor;
  const hsl = { h: 0, s: 0, l: 0 };

  for (let i = 0; i < params.count; i++) {
    const i3 = i * 3;

    // Distance from the galactic center, biased toward the middle.
    const radius = Math.pow(rng(), 1.5) * params.radius;
    const radiusNorm = radius / params.radius;

    // Which spiral arm this particle belongs to, plus the arm's twist.
    const branchAngle = ((i % params.branches) / params.branches) * Math.PI * 2;
    const spinAngle = radius * params.spin * 0.05;

    // Scatter particles around the ideal arm position. Raising a [0,1) value
    // to a power clusters most particles tight to the arm with a few strays.
    const rand = () =>
      Math.pow(rng(), params.randomnessPower) *
      (rng() < 0.5 ? 1 : -1) *
      params.randomness *
      radius;

    positions[i3 + 0] = Math.cos(branchAngle + spinAngle) * radius + rand();
    positions[i3 + 1] = rand() * 0.5; // flatten vertically into a disc
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + rand();

    // Blend core color into rim color with distance.
    const mixed = colorInside.clone().lerp(colorOutside, radiusNorm);

    // Richer color variation on longer sessions: jitter hue & saturation.
    if (params.colorVariation > 0) {
      mixed.getHSL(hsl);
      const h = (hsl.h + (rng() - 0.5) * params.colorVariation + 1) % 1;
      const s = THREE.MathUtils.clamp(hsl.s + (rng() - 0.5) * params.colorVariation, 0, 1);
      mixed.setHSL(h, s, hsl.l);
    }

    // Brighten the core: particles near the center glow harder, more so the
    // longer the session. Bloom turns this into a dramatic blazing nucleus.
    const boost = 1 + (1 - radiusNorm) * (1 - radiusNorm) * params.coreGlow;
    colors[i3 + 0] = mixed.r * boost;
    colors[i3 + 1] = mixed.g * boost;
    colors[i3 + 2] = mixed.b * boost;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: params.size,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
    map: getParticleTexture(), // soft round sprite instead of a square
    alphaMap: getParticleTexture(), // fade alpha to transparent at the rim
  });

  const points = new THREE.Points(geometry, material);
  points.userData.seed = seed;
  points.userData.radius = params.radius;
  return points;
}
