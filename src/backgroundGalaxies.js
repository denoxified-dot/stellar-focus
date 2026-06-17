import * as THREE from 'three';
import { getParticleTexture } from './particleTexture.js';

// A field of many faint, distant galaxies scattered across deep 3D space. They
// give the background real depth and structure so the scene never feels empty,
// even before the user generates their own galaxy. Every distant galaxy is
// baked into a single merged Points object — they're far too distant to need
// individual animation, so one draw call keeps this cheap.

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

export function createBackgroundGalaxies(scene, { galaxies = 40, seed = 20260616 } = {}) {
  const rng = makeRng(seed);
  const perGalaxy = 650;
  const total = galaxies * perGalaxy;

  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);

  const tmp = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const inside = new THREE.Color();
  const outside = new THREE.Color();
  let p = 0;

  for (let g = 0; g < galaxies; g++) {
    // Scatter each galaxy across a wide volume, all in front of the camera
    // (negative z) so they're visible looking out into deep space.
    const cx = (rng() - 0.5) * 3800;
    const cy = (rng() - 0.5) * 2400;
    const cz = -900 - rng() * 2800;

    const gRadius = 50 + rng() * 150;
    const branches = 2 + Math.floor(rng() * 4);
    const spin = 0.6 + rng() * 1.5;

    // Random disc orientation so they don't all face the camera flat-on.
    euler.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    quat.setFromEuler(euler);

    // Faint, mostly cool tint with some purple/teal variety.
    const hue = 0.55 + (rng() - 0.5) * 0.34;
    inside.setHSL((hue + 0.45) % 1, 0.7, 0.55);
    outside.setHSL((hue + 1) % 1, 0.6, 0.32);
    const brightness = 0.18 + rng() * 0.22; // keep them dim and distant

    for (let i = 0; i < perGalaxy; i++) {
      const radius = Math.pow(rng(), 1.6) * gRadius;
      const branchAngle = ((i % branches) / branches) * Math.PI * 2;
      const spinAngle = radius * spin * 0.05;
      const scatter = () => Math.pow(rng(), 3) * (rng() < 0.5 ? 1 : -1) * 0.4 * radius;

      tmp.set(
        Math.cos(branchAngle + spinAngle) * radius + scatter(),
        scatter() * 0.4,
        Math.sin(branchAngle + spinAngle) * radius + scatter()
      );
      tmp.applyQuaternion(quat);

      const i3 = p * 3;
      positions[i3 + 0] = cx + tmp.x;
      positions[i3 + 1] = cy + tmp.y;
      positions[i3 + 2] = cz + tmp.z;

      const mixed = inside.clone().lerp(outside, radius / gRadius);
      colors[i3 + 0] = mixed.r * brightness;
      colors[i3 + 1] = mixed.g * brightness;
      colors[i3 + 2] = mixed.b * brightness;
      p++;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.7,
    sizeAttenuation: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    map: getParticleTexture(),
    alphaMap: getParticleTexture(),
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}
