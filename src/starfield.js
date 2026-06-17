import * as THREE from 'three';
import { getParticleTexture } from './particleTexture.js';

// Three layers of star particles at increasing depth. Each layer drifts
// sideways at a speed inversely proportional to its distance, so nearer
// stars appear to move faster than far ones — a classic parallax effect.

const LAYERS = [
  // depth (z), count, size, color,        driftSpeed (world units / second)
  { z: -120, count: 3200, size: 2.4, color: 0xffffff, speed: 6.0 },
  { z: -320, count: 5200, size: 1.7, color: 0xbcd4ff, speed: 3.0 },
  { z: -650, count: 7600, size: 1.2, color: 0x8aa0d8, speed: 1.2 },
  { z: -1150, count: 11000, size: 0.85, color: 0x6a7fc0, speed: 0.5 }, // deep, faint haze
];

// Half-width of the region stars occupy on each axis. Stars that drift past
// +SPREAD wrap back around to -SPREAD so the field never empties out.
const SPREAD = 1400;

export class Starfield {
  constructor(scene) {
    this.layers = [];

    for (const cfg of LAYERS) {
      const positions = new Float32Array(cfg.count * 3);
      for (let i = 0; i < cfg.count; i++) {
        positions[i * 3 + 0] = THREE.MathUtils.randFloatSpread(SPREAD * 2);
        positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(SPREAD * 2);
        // Give each layer a little depth variation around its base z.
        positions[i * 3 + 2] = cfg.z + THREE.MathUtils.randFloatSpread(80);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: cfg.color,
        size: cfg.size,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        map: getParticleTexture(), // soft round sprite instead of a square
        alphaMap: getParticleTexture(), // fade alpha to transparent at the rim
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);
      this.layers.push({ points, speed: cfg.speed, positions });
    }
  }

  /** Advance the drift. `delta` is seconds since the previous frame. */
  update(delta) {
    for (const layer of this.layers) {
      const pos = layer.positions;
      const dx = layer.speed * delta;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] += dx;
        if (pos[i] > SPREAD) pos[i] -= SPREAD * 2; // wrap around
      }
      layer.points.geometry.attributes.position.needsUpdate = true;
    }
  }
}
