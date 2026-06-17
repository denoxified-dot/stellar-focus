import * as THREE from 'three';
import { getParticleTexture } from './particleTexture.js';
import { makeRng, clamp, lerp } from './util.js';

// Renders a star cluster as a dense group of glowing point-stars.
//   Globular clusters → a tightly concentrated sphere of old, warm-white stars.
//   Open clusters     → a looser, slightly flattened scatter of young blue-white
//                        stars with a few warm giants mixed in.
// `size` (0..1, the object's real grandeur) and `intensity` (0..1, the session
// length) together drive the star count and physical radius.

export function createCluster({ subtype = 'Globular cluster', size = 0.5, intensity = 0.5, seed = 1 } = {}) {
  const rng = makeRng(seed);
  const globular = /globular/i.test(subtype);
  const eff = clamp(0.3 + 0.5 * size + 0.3 * intensity, 0, 1);

  const radius = globular ? lerp(22, 78, eff) : lerp(14, 46, eff);
  const count = Math.floor(globular ? lerp(4000, 34000, eff) : lerp(600, 6000, eff));

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    // Uniform direction on a sphere.
    const u = rng() * 2 - 1;
    const theta = rng() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);

    // Radial distribution: globulars concentrate hard toward the center;
    // open clusters fill more evenly.
    const rNorm = globular ? Math.pow(rng(), 1.9) : Math.cbrt(rng());
    const r = rNorm * radius;

    positions[i3 + 0] = s * Math.cos(theta) * r;
    positions[i3 + 1] = u * r * (globular ? 1 : 0.7); // slight flatten for open
    positions[i3 + 2] = s * Math.sin(theta) * r;

    if (globular) {
      // Old, warm-white population; brighter toward the dense core.
      const boost = 1 + (1 - rNorm) * (1 - rNorm) * 1.4;
      c.setHSL(0.09 + rng() * 0.05, 0.45, 0.62);
      colors[i3 + 0] = c.r * boost;
      colors[i3 + 1] = c.g * boost;
      colors[i3 + 2] = c.b * boost;
    } else {
      // Young population: mostly blue-white, with the occasional warm giant.
      if (rng() < 0.12) c.setHSL(0.07 + rng() * 0.05, 0.7, 0.6); // red/orange giant
      else c.setHSL(0.58 + rng() * 0.08, 0.45, 0.72); // hot blue-white star
      colors[i3 + 0] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: globular ? lerp(0.9, 1.5, eff) : lerp(1.2, 2.0, eff),
    sizeAttenuation: true,
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    map: getParticleTexture(),
    alphaMap: getParticleTexture(),
  });

  const points = new THREE.Points(geometry, material);
  points.userData.radius = radius;
  return points;
}
