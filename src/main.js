import { StellarScene } from './scene.js';
import { StudyTimer } from './timer.js';

// Entry point: wires the DOM controls to the timer and the Three.js scene.

const canvas = document.getElementById('scene');
const scene = new StellarScene(canvas);

const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const display = document.getElementById('timer');
const hint = document.getElementById('hint');

const timer = new StudyTimer({
  display,
  onStart() {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    hint.textContent = 'Focus session in progress…';
    scene.reset(); // clear any galaxy from a previous session
  },
  onStop() {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    // Reward the end of the session: a fresh procedural galaxy.
    const seed = scene.spawnGalaxy();
    hint.textContent = `Session complete · galaxy seed ${seed}`;
  },
});

startBtn.addEventListener('click', () => timer.start());
stopBtn.addEventListener('click', () => timer.stop());
