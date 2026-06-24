import * as THREE from 'three';
import { makeRng, hashString, clamp, lerp } from './util.js';

// Renders an exoplanet as an artistic representation generated from its REAL
// measured properties — radius, mass, bulk density and equilibrium temperature
// (any of which may be missing). These are NOT photographs; no real images of
// exoplanets exist.
//
// The surface is generated procedurally ON THE GPU: value-noise fbm is evaluated
// per fragment inside a patched MeshStandardMaterial (via onBeforeCompile), so
// the detail is resolution-independent — crisp at any zoom, no blurry texture —
// and the material keeps three.js's real lighting, giving a clear lit side and a
// shadowed side with a proper day/night terminator. There is no atmosphere halo.
//
// Two axes of variation, both data-driven:
//   • TEMPERATURE drives colour — cold pale blue → temperate blue/teal →
//     warm tan/orange → hot red/brown.
//   • TYPE drives texture — banded, swirling belts (gas giants / mini-Neptunes),
//     smooth faint bands (ice giants), continents+oceans+ice caps (rocky), and
//     a cracked glowing crust (molten worlds).
// All colour decisions are made here in JS and handed to the shader as uniforms,
// so the GLSL stays small; the shader only blends those colours by noise.

// --- classification & temperature ------------------------------------------

/** Bucket a planet into a visual class from radius, density and mass. */
export function classify({ radiusEarth, densityCgs, massEarth }) {
  const r = radiusEarth ?? 1;
  if (r >= 6) return 'gasGiant';
  if (r >= 3.8) return 'iceGiant';
  if (r >= 1.7) {
    if (densityCgs != null) return densityCgs >= 3.3 ? 'rocky' : 'miniNeptune';
    if (massEarth != null) return massEarth / (r * r * r) >= 0.85 ? 'rocky' : 'miniNeptune';
    return 'miniNeptune';
  }
  return 'rocky';
}

/** A 0..1 "warmth" from equilibrium temperature, or a fallback from period. */
function warmth({ equilibriumTempK, orbitalPeriodDays }) {
  if (equilibriumTempK != null) return clamp((equilibriumTempK - 150) / (1400 - 150), 0, 1);
  if (orbitalPeriodDays != null) {
    const lp = Math.log10(clamp(orbitalPeriodDays, 0.3, 2000));
    return clamp(1 - (lp - Math.log10(2)) / (Math.log10(800) - Math.log10(2)), 0, 1);
  }
  return 0.45;
}

// --- palettes (all in JS; THREE.Color is linear with colour management on) ---

const C = (hex) => new THREE.Color(hex);
const mix = (a, b, t) => a.clone().lerp(b, clamp(t, 0, 1));

/** Blend a list of {w, ...colours} stops at warmth w; returns the named colours. */
function lerpStops(stops, w, keys) {
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (w >= stops[i].w && w <= stops[i + 1].w) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = (w - a.w) / Math.max(b.w - a.w, 1e-6);
  const out = {};
  for (const k of keys) out[k] = mix(a[k], b[k], t);
  return out;
}

/** Gas-giant palette: warm creams/ochres → red-brown when hot, plus a storm. */
function gasPalette(w) {
  const { belt, zone } = lerpStops([
    { w: 0.0, belt: C(0xb9905e), zone: C(0xe9dcc0) }, // cool: tan / pale gold
    { w: 0.5, belt: C(0x8c5a33), zone: C(0xe0c79a) }, // warm: brown / cream-ochre
    { w: 1.0, belt: C(0x5e2412), zone: C(0xd98a5a) }, // hot:  red-brown / ember
  ], w, ['belt', 'zone']);
  return { belt, zone, storm: mix(C(0xd24a2a), C(0x7a2410), w) };
}

/** Mini-Neptune palette: muted, hazy, low-saturation (steel/teal → taupe). */
function miniNeptunePalette(w) {
  const { a, b } = lerpStops([
    { w: 0.0, a: C(0x7f97ad), b: C(0xbecedb) }, // hazy steel blue
    { w: 0.5, a: C(0x789a9a), b: C(0xc1d2cf) }, // hazy pale teal
    { w: 1.0, a: C(0xa98a7a), b: C(0xd8c3b2) }, // hazy warm taupe
  ], w, ['a', 'b']);
  return { a, b, haze: mix(b, C(0xffffff), 0.45) };
}

/** Ice-giant palette: deep, saturated azure → teal, with a dark storm spot. */
function iceGiantPalette(w) {
  const a = mix(C(0x1f4f8c), C(0x2f8f96), w); // deep blue → teal
  const b = mix(C(0x6fb0e6), C(0x8fdada), w); // bright zone
  return { a, b, spot: a.clone().multiplyScalar(0.5), haze: mix(b, C(0xffffff), 0.35) };
}

/** Rocky-world palette: oceans/land/caps that shift strongly with temperature. */
function terrestrialPalette(w) {
  if (w < 0.3) {
    const t = w / 0.3; // icy → cool temperate
    return {
      ocean: mix(C(0x9fbed4), C(0x2f6f9c), t),
      landLow: mix(C(0xd2dadf), C(0x5f7d62), t),
      landHigh: mix(C(0xeef3f6), C(0x9a8f7a), t),
      cap: C(0xffffff),
      seaLevel: 0.5, capStart: lerp(0.18, 0.55, t), clouds: t > 0.5,
    };
  }
  if (w < 0.6) {
    const t = (w - 0.3) / 0.3; // temperate → warm
    return {
      ocean: mix(C(0x2f6f9c), C(0x215a86), t),
      landLow: mix(C(0x4f7d3a), C(0x86793a), t),
      landHigh: mix(C(0x9a8f6a), C(0xb59a6a), t),
      cap: C(0xeef5ff),
      seaLevel: 0.5, capStart: lerp(0.62, 0.84, t), clouds: true,
    };
  }
  const t = clamp((w - 0.6) / 0.4, 0, 1); // warm → scorching arid
  return {
    ocean: mix(C(0x215a86), C(0x5a3324), t),
    landLow: mix(C(0xb5763a), C(0xc4683a), t),
    landHigh: mix(C(0x8a4a2a), C(0x631f12), t),
    cap: C(0xd8c0a0),
    seaLevel: lerp(0.5, 0.42, t), capStart: 0.92, clouds: t < 0.4,
  };
}

// --- the procedural surface shader (injected into MeshStandardMaterial) -----

const SURFACE_GLSL = /* glsl */ `
varying vec3 vSurf;
uniform int uType;          // 0 gas, 1 mini-Neptune, 2 ice giant, 3 rocky, 4 molten
uniform vec3 uSeed;
uniform vec3 uColA;         // gas: dark belt | ice: dark | rocky: ocean | molten: basalt
uniform vec3 uColB;         // gas: light zone | ice: light | rocky: low land | molten: lava
uniform vec3 uColC;         // gas: storm | rocky: high land
uniform vec3 uColD;         // rocky: ice cap
uniform vec3 uLavaColor;    // molten emissive (zero otherwise)
uniform float uBands;
uniform float uContrast;
uniform float uSeaLevel;
uniform float uCapStart;
uniform float uClouds;
uniform vec4 uStorm;        // (centerY, centerLon, radiusY, radiusLon) — radiusY<=0 disables
uniform vec3 uHazeColor;    // atmospheric limb glow (zero for airless/rocky worlds)
uniform float uHazeStrength;

float ph_hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ph_vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ph_hash(i + vec3(0.0, 0.0, 0.0)), ph_hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                 mix(ph_hash(i + vec3(0.0, 1.0, 0.0)), ph_hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(ph_hash(i + vec3(0.0, 0.0, 1.0)), ph_hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                 mix(ph_hash(i + vec3(0.0, 1.0, 1.0)), ph_hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float ph_fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 6; i++) { s += a * ph_vnoise(p); p = p * 2.02 + vec3(1.7); a *= 0.5; }
  return s / 0.984;
}
float ph_ridged(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { float n = 1.0 - abs(2.0 * ph_vnoise(p) - 1.0); s += a * n * n; p = p * 2.0 + vec3(3.1); a *= 0.5; }
  return s / 0.969;
}

float ph_gLava;

vec3 ph_surface(vec3 dir) {
  vec3 p = dir * 2.0 + uSeed;

  if (uType == 0) {
    // Gas giant: many sharp, turbulent latitudinal belts sheared by storms,
    // plus a prominent oval storm. High contrast — reads as a striped giant.
    float turb = ph_fbm(p * 1.4) * 2.0 - 1.0;
    float swirl = ph_fbm(p * 0.7 + vec3(5.3)) * 2.0 - 1.0;
    float fine = ph_fbm(p * 7.0) * 2.0 - 1.0;
    float band = sin(dir.y * uBands * 3.14159 + turb * 1.8 + swirl * 2.0);
    band = sign(band) * pow(abs(band), 0.6); // crisp zone/belt boundaries
    vec3 c = mix(uColA, uColB, 0.5 + 0.5 * band);
    c += fine * uContrast;
    if (uStorm.z > 0.0) {
      float dlat = (dir.y - uStorm.x) / uStorm.z;
      float dl = atan(sin(atan(dir.z, dir.x) - uStorm.y), cos(atan(dir.z, dir.x) - uStorm.y)) / uStorm.w;
      float rr = dlat * dlat + dl * dl;
      if (rr < 1.0) {
        float k = 1.0 - rr;
        c = mix(c, uColC, k);
        c += sin(atan(dlat, dl) * 3.0 + rr * 9.0) * 0.04 * k; // inner swirl
      }
    }
    return c;
  } else if (uType == 1) {
    // Mini-Neptune: a thick, hazy atmosphere — soft and nearly featureless,
    // only the faintest broad bands showing through. Its character comes from
    // the limb glow added below, not surface detail.
    float mottle = ph_fbm(p * 2.2) - 0.5;
    float micro = ph_fbm(p * 6.0) - 0.5;
    float band = sin(dir.y * uBands * 3.14159);
    float k = clamp(0.5 + band * 0.16 + mottle * 0.45 + micro * 0.1, 0.0, 1.0);
    return mix(uColA, uColB, k);
  } else if (uType == 2) {
    // Ice giant: smooth deep blue with crisp faint bands and, often, a single
    // discrete dark storm spot (à la Neptune's Great Dark Spot).
    float mottle = ph_fbm(p * 3.0) - 0.5;
    float band = 0.5 + 0.5 * sin(dir.y * uBands);
    vec3 c = mix(uColA, uColB, clamp(band * 0.5 + mottle * 0.55 + 0.45, 0.0, 1.0));
    if (uStorm.z > 0.0) {
      float dlat = (dir.y - uStorm.x) / uStorm.z;
      float lon = atan(dir.z, dir.x);
      float dl = atan(sin(lon - uStorm.y), cos(lon - uStorm.y)) / uStorm.w;
      float rr = dlat * dlat + dl * dl;
      if (rr < 1.0) c = mix(c, uColC, (1.0 - rr) * 0.85);
    }
    return c;
  } else if (uType == 3) {
    // Rocky world: continents, oceans, polar caps and (temperate) clouds.
    float elev = ph_fbm(p * 1.1) + (ph_fbm(p * 3.6) - 0.5) * 0.2;
    vec3 c;
    if (elev < uSeaLevel) {
      float d = (uSeaLevel - elev) / max(uSeaLevel, 0.001);
      c = mix(uColA, uColA * 0.55, clamp(d, 0.0, 1.0));
    } else {
      float land = (elev - uSeaLevel) / max(1.0 - uSeaLevel, 0.001);
      c = mix(uColB, uColC, clamp(land * 1.2, 0.0, 1.0));
    }
    c = mix(c, uColD, smoothstep(uCapStart, uCapStart + 0.07, abs(dir.y)));
    if (uClouds > 0.5) {
      float cl = smoothstep(0.55, 0.78, ph_fbm(p * 1.7 + vec3(11.0)));
      c = mix(c, vec3(1.0), cl * 0.55);
    }
    return c;
  }
  // Molten: dark basalt cracked by glowing lava.
  float crust = ph_fbm(p * 1.6);
  float lava = smoothstep(0.58, 0.92, ph_ridged(p * 2.2));
  ph_gLava = lava;
  return mix(mix(uColA, uColA * 1.8, crust), uColB, lava);
}
`;

function patchMaterial(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSurf;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurf = position;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SURFACE_GLSL)
      .replace(
        '#include <map_fragment>',
        `
        ph_gLava = 0.0;
        diffuseColor.rgb = ph_surface(normalize(vSurf));
        `
      )
      .replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>
        totalEmissiveRadiance += uLavaColor * ph_gLava;
        // Atmospheric haze: a view-dependent Fresnel rim that glows at the limb,
        // reading as a thick atmosphere. 'normal' and vViewPosition are set by
        // the standard normal_fragment_begin chunk just above this point.
        float ph_rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
        totalEmissiveRadiance += uHazeColor * ph_rim * uHazeStrength;
        `
      );
  };
}

// --- assembly ---------------------------------------------------------------

export function createPlanet({
  radiusEarth = 1,
  massEarth = null,
  equilibriumTempK = null,
  densityCgs = null,
  orbitalPeriodDays = null,
  size = 0.5,
  intensity = 0.5,
  seed = 1,
  name = '',
} = {}) {
  const rng = makeRng(hashString(name) ^ seed);
  const eff = clamp(0.35 + 0.5 * size + 0.25 * intensity, 0, 1);
  const r = lerp(9, 32, eff);

  const data = { radiusEarth, massEarth, equilibriumTempK, densityCgs, orbitalPeriodDays };
  const type = classify(data);
  const w = warmth(data);

  // Per-type colour slots + material traits. uType maps name → shader branch.
  const black = C(0x000000);
  const noStorm = new THREE.Vector4(0, 0, 0, 1);
  const u = {
    uType: { value: 0 },
    uSeed: { value: new THREE.Vector3(rng() * 50, rng() * 50, rng() * 50) },
    uColA: { value: black.clone() },
    uColB: { value: black.clone() },
    uColC: { value: black.clone() },
    uColD: { value: black.clone() },
    uLavaColor: { value: black.clone() },
    uBands: { value: 8 },
    uContrast: { value: 0.05 },
    uSeaLevel: { value: 0.5 },
    uCapStart: { value: 0.8 },
    uClouds: { value: 0 },
    uStorm: { value: noStorm.clone() },
    uHazeColor: { value: black.clone() },
    uHazeStrength: { value: 0 },
  };
  let roughness = 0.9, metalness = 0;

  if (type === 'gasGiant') {
    const gp = gasPalette(w);
    u.uType.value = 0;
    u.uColA.value = gp.belt;
    u.uColB.value = gp.zone;
    u.uColC.value = gp.storm;
    u.uBands.value = 9 + Math.floor(rng() * 5); // 9..13 sharp belts
    u.uContrast.value = 0.06;
    u.uStorm.value = new THREE.Vector4(
      (rng() - 0.5) * 0.9, // centre latitude in dir.y units
      rng() * Math.PI * 2, // centre longitude (radians)
      0.1 + rng() * 0.06, // latitude radius
      0.22 + rng() * 0.14 // longitude radius (radians)
    );
    roughness = 0.95;
  } else if (type === 'miniNeptune') {
    const mp = miniNeptunePalette(w);
    u.uType.value = 1;
    u.uColA.value = mp.a;
    u.uColB.value = mp.b;
    u.uBands.value = 2 + Math.floor(rng() * 2); // 2..3 broad, soft bands
    u.uContrast.value = 0.02;
    u.uHazeColor.value = mp.haze; // thick atmosphere glows at the limb
    u.uHazeStrength.value = 0.6;
    roughness = 0.8;
  } else if (type === 'iceGiant') {
    const ip = iceGiantPalette(w);
    u.uType.value = 2;
    u.uColA.value = ip.a;
    u.uColB.value = ip.b;
    u.uColC.value = ip.spot;
    u.uBands.value = 5 + Math.floor(rng() * 3); // 5..7 faint bands
    u.uHazeColor.value = ip.haze;
    u.uHazeStrength.value = 0.3; // subtler haze than a mini-Neptune
    if (rng() < 0.6) {
      u.uStorm.value = new THREE.Vector4(
        (rng() - 0.5) * 0.8, // a single discrete dark spot
        rng() * Math.PI * 2,
        0.08 + rng() * 0.05,
        0.16 + rng() * 0.1
      );
    }
    roughness = 0.5; // glassier than the matte gas giant
  } else if (type === 'rocky') {
    const p = terrestrialPalette(w);
    u.uType.value = 3;
    u.uColA.value = p.ocean;
    u.uColB.value = p.landLow;
    u.uColC.value = p.landHigh;
    u.uColD.value = p.cap;
    u.uSeaLevel.value = p.seaLevel;
    u.uCapStart.value = p.capStart;
    u.uClouds.value = p.clouds ? 1 : 0;
    roughness = 0.92;
  }

  // Scorching rocky worlds are molten regardless of the rocky palette above.
  const molten =
    (type === 'rocky' && (w > 0.82 || (equilibriumTempK != null && equilibriumTempK >= 1100)));
  if (molten) {
    u.uType.value = 4;
    u.uColA.value = C(0x1a0f0a); // basalt
    u.uColB.value = C(0xff7a2a); // lava
    u.uLavaColor.value = C(0xff5a1e).multiplyScalar(2.2); // glows through bloom
    roughness = 0.7; metalness = 0.1;
  }

  const material = new THREE.MeshStandardMaterial({ roughness, metalness, emissive: 0x000000 });
  patchMaterial(material, u);

  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.SphereGeometry(r, 128, 128), material));

  // A little axial tilt for character; the scene spins the group slowly.
  group.rotation.z = (rng() - 0.5) * 0.7;
  group.rotation.x = (rng() - 0.5) * 0.25;
  group.userData.radius = r;
  return group;
}
