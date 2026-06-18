import { StellarScene } from './scene.js';
import { StudyTimer } from './timer.js';
import { loadExoplanets } from './exoplanets.js';
import { loadMessier } from './messier.js';
import { chooseDiscovery, buildDiscoveryVisual, describeDiscovery } from './discovery.js';

// Entry point: wires the DOM controls to the timer and the Three.js scene.

const canvas = document.getElementById('scene');
const scene = new StellarScene(canvas);

const ui = document.getElementById('ui');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const display = document.getElementById('timer');
const hint = document.getElementById('hint');

const discoveryEl = document.getElementById('discovery');
const discoveryLabel = document.getElementById('discovery-label');
const discoveryName = document.getElementById('discovery-name');
const discoveryStats = document.getElementById('discovery-stats');
const discoveryDesc = document.getElementById('discovery-desc');
const discoveryNote = document.getElementById('discovery-note');

const objectFigure = document.getElementById('object-image');
const objectImg = document.getElementById('object-img');
const objectCredit = document.getElementById('object-credit');
const objectExplanation = document.getElementById('object-explanation');

// Warm the data caches up front so the reveal is instant on Stop.
loadExoplanets();
loadMessier();

function hideDiscovery() {
  discoveryEl.hidden = true;
  objectFigure.hidden = true;
  objectImg.removeAttribute('src');
}

/**
 * Show a real photograph of the discovered object — but ONLY when one that
 * genuinely depicts it exists. Messier objects carry a verified `image` (added
 * by `npm run fetch-messier-images`); exoplanets never do, since no real photos
 * of them exist. With no genuine image the figure stays hidden and the card
 * shows the accurate data alone.
 */
function showObjectImage(choice) {
  objectFigure.hidden = true;
  const image = choice.object.image;
  if (!image || !image.url) return; // no verified image — never pair an unrelated one.

  objectImg.src = image.url;
  objectImg.alt = `NASA photograph of ${choice.object.name || `Messier ${choice.object.messier}`}`;
  objectCredit.textContent = image.credit || 'NASA Image and Video Library';
  objectExplanation.textContent = image.description || '';
  // Reveal the figure only once the image actually loads; hide on error so a
  // broken link never leaves an empty frame beside the data.
  objectImg.onload = () => {
    objectFigure.hidden = false;
  };
  objectImg.onerror = () => {
    objectFigure.hidden = true;
  };
}

/** Reveal the data once the supernova animation has finished. */
function presentDiscovery(choice) {
  const info = describeDiscovery(choice);
  discoveryLabel.textContent = info.label;
  discoveryName.textContent = info.name;
  discoveryStats.textContent = info.headline;
  discoveryDesc.textContent = info.description;
  discoveryNote.textContent = info.note || '';
  discoveryNote.hidden = !info.note;
  discoveryEl.hidden = false;
  showObjectImage(choice); // a real photo of THIS object, or nothing at all

  ui.classList.remove('revealing'); // bring the timer/controls back
  hint.textContent = 'Session complete';
  startBtn.disabled = false;
}

/**
 * Pick a real object to discover — its type and size scaled by how long the
 * session lasted — play the supernova reveal, then present its data.
 * Falls back gracefully if no data files are present.
 */
async function revealDiscovery(intensity) {
  const [exoplanets, messier] = await Promise.all([loadExoplanets(), loadMessier()]);

  const choice = chooseDiscovery(intensity, { messier, exoplanets });
  if (!choice) {
    // No data files yet — keep working, just nudge toward fetching them.
    ui.classList.remove('revealing');
    hint.textContent =
      'Session complete · run "npm run fetch-data" and "npm run fetch-messier" to discover real objects';
    startBtn.disabled = false;
    return;
  }

  // Detonate the supernova at the discovery location; once it fades and the
  // object has formed, present the timer/controls and the info card.
  scene.playReveal(buildDiscoveryVisual(choice, intensity), () => presentDiscovery(choice));
}

const timer = new StudyTimer({
  display,
  onStart() {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    hint.textContent = 'Focus session in progress…';
    ui.classList.remove('revealing');
    hideDiscovery();
    scene.reset(); // clear any object (or in-flight reveal) from a previous session
  },
  onStop(elapsedMs) {
    // Keep both buttons disabled and fade the timer/controls out so the
    // supernova has the stage; they return when the reveal completes.
    startBtn.disabled = true;
    stopBtn.disabled = true;
    ui.classList.add('revealing');
    // The longer you focused, the grander the object you discover: a short
    // session finds an exoplanet or small cluster; a long one finds a big
    // nebula or galaxy. ~30 minutes reaches full grandeur.
    const minutes = elapsedMs / 60000;
    const intensity = Math.min(1, Math.max(0, minutes / 30));
    revealDiscovery(intensity);
  },
});

startBtn.addEventListener('click', () => timer.start());
stopBtn.addEventListener('click', () => timer.stop());
