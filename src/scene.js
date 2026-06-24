import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Starfield } from './starfield.js';
import { createBackgroundGalaxies } from './backgroundGalaxies.js';
import { getParticleTexture } from './particleTexture.js';

// Owns the WebGL scene: the parallax starfield, post-processing bloom, the
// render loop, and (on demand) the procedurally rendered object the user just
// discovered — a galaxy, nebula, star cluster, or planet — which becomes the
// focal point the camera eases toward.

// How long the supernova reveal runs, in seconds. Kept short and punchy.
const REVEAL_DURATION = 1.9;
// Fraction of the timeline at which the blast has cleared enough for the
// discovered object to begin forming (and the camera to start drifting).
const FORM_START = 0.4;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export class StellarScene {
  constructor(canvas) {
    this.canvas = canvas;

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // --- Scene & camera ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000); // black space

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      7000 // deep far plane so distant galaxies and nebulae stay visible
    );
    this.camera.position.set(0, 0, 0);

    // --- Deep background: a field of distant galaxies ---
    // Built once and left static so the void has depth from the very first
    // frame. The space between them stays true black, like real
    // astrophotography — no colored haze.
    this.backgroundGalaxies = createBackgroundGalaxies(this.scene);

    // --- Starfield (parallax layers) ---
    this.starfield = new Starfield(this.scene);

    // --- Lighting: a "sun" so discovered planets are shaded (point clouds are
    // unlit and ignore these). A dim ambient keeps the dark side from going
    // fully black. ---
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(-1, 0.55, 0.5);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x223344, 0.5));

    // --- Discovered-object state (created on stop) ---
    this.discovered = null; // THREE.Object3D
    this.discoveredSpin = 0; // radians/second about Y
    this.cameraDrift = null; // { target: Vector3, speed: number }
    this._focusDir = new THREE.Vector3(170, 80, -560).normalize();

    // --- Reveal animation state (the supernova that precedes a discovery) ---
    this.reveal = null; // { elapsed, duration, object3D, spin, cameraTarget, ... }
    this.revealFx = null; // { group, shell, flash, dirs, speeds, count, blastRadius }

    // --- Post-processing: bloom makes bright particles glow ---
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.9, // strength
      0.5, // radius
      // Threshold: only genuinely bright sources bloom. Kept high so a lit
      // planet's surface (a solid, mid-bright hemisphere) is NOT bloomed into a
      // white wash that hides its colour — while the far brighter additive
      // particle clouds (starfield, supernova, discovered galaxies/nebulae) and
      // the emissive atmosphere/lava still glow as before.
      0.6
    );
    this.composer.addPass(this.bloomPass);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.clock = new THREE.Clock();

    window.addEventListener('resize', () => this._onResize());
    this._animate();
  }

  /**
   * Where a discovery of the given radius sits, and where the camera should
   * ease to. Placed up and to the right, deep in the background, at a distance
   * that scales with its size so big objects don't crowd the frame. The camera
   * stops a gap short (the gap grows with size) so it fills the view for a
   * sense of scale without sitting behind the centered UI.
   * @returns {{ position: THREE.Vector3, cameraTarget: THREE.Vector3 }}
   */
  _placement(radius) {
    const dir = this._focusDir;
    const dist = THREE.MathUtils.clamp(radius * 2.4 + 360, 480, 4600);
    const gap = THREE.MathUtils.clamp(radius * 2.6 + 90, 140, dist * 0.72);
    return {
      position: dir.clone().multiplyScalar(dist),
      cameraTarget: dir.clone().multiplyScalar(dist - gap),
    };
  }

  /**
   * Place a freshly built discovery (galaxy / nebula / cluster / planet) into
   * the scene and ease the camera toward it. Replaces any previous discovery.
   * @param {{ object3D: THREE.Object3D, radius: number, spin: number }} visual
   */
  spawnDiscovery(visual) {
    this._clearDiscovered();
    const { object3D, radius, spin } = visual;
    const { position, cameraTarget } = this._placement(radius);
    object3D.position.copy(position);
    this.scene.add(object3D);
    this.discovered = object3D;
    this.discoveredSpin = spin;
    this.cameraDrift = { target: cameraTarget, speed: 0.25 };
  }

  /**
   * Cinematic reveal: detonate a supernova at the discovery location — a bright
   * point that flares up and bursts into an expanding shell of glowing
   * particles — and, as the blast fades, form the discovered object in its
   * place. `onComplete` fires when the animation finishes so the UI can present
   * the data afterward.
   * @param {{ object3D: THREE.Object3D, radius: number, spin: number }} visual
   * @param {() => void} [onComplete]
   */
  playReveal(visual, onComplete) {
    this._clearReveal();
    this._clearDiscovered();

    const { object3D, radius, spin } = visual;
    const { position, cameraTarget } = this._placement(radius);

    // Stage the object at its spot but fully transparent and motionless — it
    // fades in as the blast clears.
    object3D.position.copy(position);
    this._prepareFadeIn(object3D);
    this.scene.add(object3D);
    this.discovered = object3D;
    this.discoveredSpin = 0; // no spin until it forms
    this.cameraDrift = null; // camera holds until it forms

    // Detonate the supernova at the same location.
    const blastRadius = THREE.MathUtils.clamp(radius * 1.8, 70, 1000);
    this.revealFx = this._createSupernova(position, blastRadius);
    this.scene.add(this.revealFx.group);

    this.reveal = {
      elapsed: 0,
      duration: REVEAL_DURATION,
      object3D,
      spin,
      cameraTarget,
      formingStarted: false,
      onComplete,
    };
  }

  /** Stop the camera drift and remove the discovered object (on restart). */
  reset() {
    this.cameraDrift = null;
    this._clearReveal();
    this._clearDiscovered();
    this.camera.position.set(0, 0, 0);
  }

  /** Remove and fully dispose the current discovered object, if any. */
  _clearDiscovered() {
    if (!this.discovered) return;
    this.scene.remove(this.discovered);
    this.discovered.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const m of mats) m.dispose(); // shared particle texture is cached, not disposed
      }
    });
    this.discovered = null;
    this.discoveredSpin = 0;
  }

  // --- Supernova reveal -------------------------------------------------------

  /**
   * Build the supernova effect at `position`: a cloud of particles that all
   * start at the center and burst outward into a glowing shell, plus a bright
   * central flash sprite. Returned for per-frame animation by _updateSupernova.
   */
  _createSupernova(position, blastRadius) {
    const count = 1500;
    const positions = new Float32Array(count * 3); // every particle starts at center
    const colors = new Float32Array(count * 3);
    const dirs = new Float32Array(count * 3); // unit outward direction per particle
    const speeds = new Float32Array(count); // varied so the shell has thickness

    const hot = new THREE.Color(0xffffff);
    const warm = new THREE.Color(1.0, 0.75, 0.45);
    const ember = new THREE.Color(1.0, 0.35, 0.18);
    const c = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Uniform random direction on the unit sphere.
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      dirs[i3 + 0] = s * Math.cos(th);
      dirs[i3 + 1] = u;
      dirs[i3 + 2] = s * Math.sin(th);
      speeds[i] = 0.45 + Math.random() * 0.55;

      // Mostly white-hot, with a fiery fraction tinted warm/ember.
      const mix = Math.random();
      c.copy(hot).lerp(mix < 0.5 ? warm : ember, Math.pow(Math.random(), 0.6) * (0.3 + mix * 0.6));
      colors[i3 + 0] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const shell = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: blastRadius * 0.06,
        sizeAttenuation: true,
        depthWrite: false,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        map: getParticleTexture(),
        alphaMap: getParticleTexture(),
      })
    );

    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getParticleTexture(),
        color: 0xbfe0ff,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      })
    );
    flash.scale.setScalar(blastRadius * 0.5);

    const group = new THREE.Group();
    group.position.copy(position);
    group.add(shell);
    group.add(flash);

    return { group, shell, flash, dirs, speeds, count, blastRadius };
  }

  /** Advance the supernova to timeline fraction `p` (0..1). */
  _updateSupernova(fx, p) {
    const { shell, flash, dirs, speeds, count, blastRadius } = fx;

    // Central flash: flares up almost instantly, then fades as the shell takes
    // over. Bloom turns even a small bright sprite into a brilliant burst.
    const flare = easeOutCubic(THREE.MathUtils.clamp(p / 0.14, 0, 1));
    flash.material.opacity = 1 - THREE.MathUtils.smoothstep(p, 0.14, 0.55);
    flash.scale.setScalar(blastRadius * (0.4 + 2.6 * flare + 1.2 * p));

    // Expanding shell: after a brief beat, particles rush outward along their
    // directions with an ease-out so the burst is fast then decelerates.
    const reach = easeOutCubic(THREE.MathUtils.clamp((p - 0.08) / 0.92, 0, 1)) * blastRadius;
    const posArr = shell.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const d = reach * speeds[i];
      posArr[i3 + 0] = dirs[i3 + 0] * d;
      posArr[i3 + 1] = dirs[i3 + 1] * d;
      posArr[i3 + 2] = dirs[i3 + 2] * d;
    }
    shell.geometry.attributes.position.needsUpdate = true;

    // Thin the particles, cool the colour from white toward ember, and fade.
    shell.material.size = blastRadius * THREE.MathUtils.lerp(0.06, 0.015, p);
    shell.material.color.setRGB(1, THREE.MathUtils.lerp(1, 0.5, p), THREE.MathUtils.lerp(1, 0.32, p));
    shell.material.opacity = 1 - THREE.MathUtils.smoothstep(p, 0.4, 1.0);
  }

  /** Step the reveal each frame; spawns/forms the object and fires onComplete. */
  _updateReveal(delta) {
    const rv = this.reveal;
    rv.elapsed += delta;
    const p = THREE.MathUtils.clamp(rv.elapsed / rv.duration, 0, 1);

    this._updateSupernova(this.revealFx, p);

    // The object materialises out of the fading blast.
    const formP = easeOutCubic(THREE.MathUtils.clamp((p - FORM_START) / (1 - FORM_START), 0, 1));
    this._applyFadeIn(rv.object3D, formP);

    // Once it starts forming, let it spin and ease the camera in.
    if (!rv.formingStarted && p >= FORM_START) {
      rv.formingStarted = true;
      this.discoveredSpin = rv.spin;
      this.cameraDrift = { target: rv.cameraTarget, speed: 0.25 };
    }

    if (p >= 1) {
      this._finishFadeIn(rv.object3D);
      const done = rv.onComplete;
      this.reveal = null;
      this._disposeRevealFx();
      done?.();
    }
  }

  /** Record each material's target opacity, then start it fully transparent. */
  _prepareFadeIn(object3D) {
    const records = [];
    object3D.traverse((node) => {
      if (!node.material) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of mats) {
        records.push({ m, target: m.opacity ?? 1, wasTransparent: m.transparent });
        m.transparent = true;
        m.opacity = 0;
      }
    });
    object3D.userData._fadeRecords = records;
  }

  /** Set fade progress (0..1) across all of the object's materials. */
  _applyFadeIn(object3D, t) {
    const records = object3D.userData._fadeRecords;
    if (!records) return;
    for (const r of records) r.m.opacity = r.target * t;
  }

  /** Restore final opacity and each material's original transparency flag. */
  _finishFadeIn(object3D) {
    const records = object3D.userData._fadeRecords;
    if (!records) return;
    for (const r of records) {
      r.m.opacity = r.target;
      r.m.transparent = r.wasTransparent;
      r.m.needsUpdate = true;
    }
    delete object3D.userData._fadeRecords;
  }

  /** Cancel any in-flight reveal and dispose its effect. */
  _clearReveal() {
    this.reveal = null;
    this._disposeRevealFx();
  }

  _disposeRevealFx() {
    if (!this.revealFx) return;
    this.scene.remove(this.revealFx.group);
    this.revealFx.shell.geometry.dispose();
    this.revealFx.shell.material.dispose();
    this.revealFx.flash.material.dispose(); // shared particle texture is cached, not disposed
    this.revealFx = null;
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(w, h);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const delta = this.clock.getDelta();

    this.starfield.update(delta);

    if (this.reveal) this._updateReveal(delta);

    if (this.discovered) {
      this.discovered.rotation.y += delta * this.discoveredSpin; // gentle spin
    }

    if (this.cameraDrift) {
      // Ease the camera toward its target (frame-rate independent).
      const t = 1 - Math.exp(-this.cameraDrift.speed * delta);
      this.camera.position.lerp(this.cameraDrift.target, t);
    }

    this.composer.render();
  }
}
