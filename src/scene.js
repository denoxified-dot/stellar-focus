import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Starfield } from './starfield.js';
import { createGalaxy } from './galaxy.js';

// Owns the WebGL scene: the parallax starfield, post-processing bloom, the
// render loop, and (on demand) a procedurally generated galaxy that the
// camera slowly drifts toward.

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
      4000
    );
    this.camera.position.set(0, 0, 0);

    // --- Starfield (three parallax layers) ---
    this.starfield = new Starfield(this.scene);

    // --- Galaxy state (created on stop) ---
    this.galaxy = null;
    this.cameraDrift = null; // { target: Vector3, speed: number }

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
   * Spawn a procedural spiral galaxy from a random seed and begin drifting the
   * camera toward it. Replaces any previously generated galaxy.
   * @returns {number} the seed used, in case the caller wants to display it.
   */
  spawnGalaxy() {
    if (this.galaxy) {
      this.scene.remove(this.galaxy);
      this.galaxy.geometry.dispose();
      this.galaxy.material.dispose();
    }

    const seed = Math.floor(Math.random() * 1e9);
    this.galaxy = createGalaxy(seed);

    // Offset the galaxy to the upper-right and push it well into the
    // background so it never sits behind the centered timer/buttons.
    // Tilted for a 3/4 view.
    this.galaxy.position.set(170, 80, -560);
    this.galaxy.rotation.x = Math.PI * 0.18;
    this.galaxy.rotation.z = Math.PI * 0.05;
    this.scene.add(this.galaxy);

    // Drift the camera gently toward the galaxy, but stop well short and keep
    // it off to the side so the screen center (where the UI lives) stays clear.
    this.cameraDrift = {
      target: new THREE.Vector3(75, 35, -260),
      speed: 0.2, // fraction of remaining distance covered per second
    };

    return seed;
  }

  /** Stop the camera drift and remove the galaxy (used when restarting). */
  reset() {
    this.cameraDrift = null;
    if (this.galaxy) {
      this.scene.remove(this.galaxy);
      this.galaxy.geometry.dispose();
      this.galaxy.material.dispose();
      this.galaxy = null;
    }
    this.camera.position.set(0, 0, 0);
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

    if (this.galaxy) {
      this.galaxy.rotation.y += delta * 0.05; // gentle galactic spin
    }

    if (this.cameraDrift) {
      // Ease the camera toward its target (frame-rate independent).
      const t = 1 - Math.exp(-this.cameraDrift.speed * delta);
      this.camera.position.lerp(this.cameraDrift.target, t);
    }

    this.composer.render();
  }
}
