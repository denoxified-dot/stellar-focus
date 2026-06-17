import * as THREE from 'three';
import { getParticleTexture } from './particleTexture.js';

// Generates one procedural spiral galaxy from a numeric seed. The same seed
// always yields the same galaxy, so a session is reproducible if you keep the
// seed. Particles use additive blending and bright core colors so they read as
// "glowing" and get picked up by the bloom pass.

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

export function createGalaxy(seed = Math.floor(Math.random() * 1e9)) {
  const rng = makeRng(seed);

  // Randomize the galaxy's character a little based on the seed.
  const params = {
    count: 60000,
    radius: 80,
    branches: 3 + Math.floor(rng() * 4), // 3–6 spiral arms
    spin: 0.8 + rng() * 1.4,
    randomness: 0.35,
    randomnessPower: 2.6,
    insideColor: new THREE.Color().setHSL(0.08 + rng() * 0.08, 1.0, 0.6), // warm core
    outsideColor: new THREE.Color().setHSL(0.55 + rng() * 0.15, 0.9, 0.5), // cool rim
  };

  const positions = new Float32Array(params.count * 3);
  const colors = new Float32Array(params.count * 3);

  const colorInside = params.insideColor;
  const colorOutside = params.outsideColor;

  for (let i = 0; i < params.count; i++) {
    const i3 = i * 3;

    // Distance from the galactic center, biased toward the middle.
    const radius = Math.pow(rng(), 1.5) * params.radius;

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
    const mixed = colorInside.clone().lerp(colorOutside, radius / params.radius);
    colors[i3 + 0] = mixed.r;
    colors[i3 + 1] = mixed.g;
    colors[i3 + 2] = mixed.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.2,
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
  return points;
}
