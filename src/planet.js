import * as THREE from 'three';
import { makeRng, hashString, clamp, lerp } from './util.js';

// Renders an exoplanet as a shaded sphere with a soft atmospheric glow. Unlike
// the additive point-cloud objects, this is a lit MeshStandardMaterial, so the
// scene provides a directional "sun" — the planet shows a lit limb and a dark
// terminator for a real sense of a world hanging in space.
//
// The colour is chosen from the planet's real radius (rocky / super-Earth /
// ice giant / gas giant), and the visual size scales with both that radius and
// the session length.

function planetColors(radiusEarth, rng) {
  const r = radiusEarth ?? 1;
  let surface;
  if (r < 1.6) surface = new THREE.Color().setHSL(0.07 + rng() * 0.04, 0.5, 0.42); // rocky tan/brown
  else if (r < 4) surface = new THREE.Color().setHSL(0.48 + rng() * 0.08, 0.5, 0.5); // teal super-Earth
  else if (r < 10) surface = new THREE.Color().setHSL(0.58 + rng() * 0.05, 0.6, 0.5); // blue ice giant
  else surface = new THREE.Color().setHSL(0.06 + rng() * 0.06, 0.55, 0.52); // orange gas giant
  const atmosphere = surface.clone().lerp(new THREE.Color(0x9fd8ff), 0.55);
  return { surface, atmosphere };
}

export function createPlanet({ radiusEarth = 1, size = 0.5, intensity = 0.5, seed = 1, name = '' } = {}) {
  const rng = makeRng(hashString(name) ^ seed);
  const eff = clamp(0.35 + 0.5 * size + 0.25 * intensity, 0, 1);
  const r = lerp(8, 30, eff);
  const { surface, atmosphere } = planetColors(radiusEarth, rng);

  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(r, 48, 48),
    new THREE.MeshStandardMaterial({
      color: surface,
      roughness: 0.9,
      metalness: 0.0,
      emissive: surface.clone().multiplyScalar(0.05), // faint self-glow so the dark side isn't pure black
    })
  );
  group.add(body);

  // Atmospheric rim: a slightly larger back-facing additive shell.
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.14, 48, 48),
    new THREE.MeshBasicMaterial({
      color: atmosphere,
      transparent: true,
      opacity: 0.28,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(glow);

  // A little axial tilt for character.
  group.rotation.z = (rng() - 0.5) * 0.6;
  group.userData.radius = r * 1.14;
  return group;
}
