import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Starfield } from './starfield.js';
import { createBackgroundGalaxies } from './backgroundGalaxies.js';

// Owns the WebGL scene: the parallax starfield, post-processing bloom, the
// render loop, and (on demand) the procedurally rendered object the user just
// discovered — a galaxy, nebula, star cluster, or planet — which becomes the
// focal point the camera eases toward.

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

    // --- Post-processing: bloom makes bright particles glow ---
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.9, // strength
      0.5, // radius
      0.15 // threshold — only the brighter particles bloom
    );
    this.composer.addPass(this.bloomPass);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.clock = new THREE.Clock();

    window.addEventListener('resize', () => this._onResize());
    this._animate();
  }

  /**
   * Place a freshly built discovery (galaxy / nebula / cluster / planet) into
   * the scene and ease the camera toward it. Replaces any previous discovery.
   * @param {{ object3D: THREE.Object3D, radius: number, spin: number }} visual
   */
  spawnDiscovery(visual) {
    this._clearDiscovered();

    const { object3D, radius, spin } = visual;
    const dir = this._focusDir;

    // Place the object up and to the right, deep in the background, at a
    // distance that scales with its size so big objects don't crowd the frame.
    const dist = THREE.MathUtils.clamp(radius * 2.4 + 360, 480, 4600);
    object3D.position.copy(dir).multiplyScalar(dist);
    this.scene.add(object3D);
    this.discovered = object3D;
    this.discoveredSpin = spin;

    // Ease the camera along the same line toward the object, stopping a gap
    // short (the gap grows with the object's size) so it fills the view for a
    // sense of scale without sitting behind the centered UI.
    const gap = THREE.MathUtils.clamp(radius * 2.6 + 90, 140, dist * 0.72);
    this.cameraDrift = {
      target: dir.clone().multiplyScalar(dist - gap),
      speed: 0.25, // fraction of remaining distance covered per second
    };
  }

  /** Stop the camera drift and remove the discovered object (on restart). */
  reset() {
    this.cameraDrift = null;
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
