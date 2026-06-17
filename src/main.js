import { StellarScene } from './scene.js';
import { StudyTimer } from './timer.js';
import { loadExoplanets } from './exoplanets.js';
import { loadMessier } from './messier.js';
import { loadApod, pickRandomImage } from './apod.js';
import { chooseDiscovery, buildDiscoveryVisual, describeDiscovery } from './discovery.js';

// Entry point: wires the DOM controls to the timer and the Three.js scene.

const canvas = document.getElementById('scene');
const scene = new StellarScene(canvas);

const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const display = document.getElementById('timer');
const hint = document.getElementById('hint');

const discoveryEl = document.getElementById('discovery');
const discoveryLabel = document.getElementById('discovery-label');
const discoveryName = document.getElementById('discovery-name');
const discoveryStats = document.getElementById('discovery-stats');
const discoveryDesc = document.getElementById('discovery-desc');

const apodFigure = document.getElementById('apod');
const apodImg = document.getElementById('apod-img');
const apodTitle = document.getElementById('apod-title');
const apodCredit = document.getElementById('apod-credit');
const apodExplanation = document.getElementById('apod-explanation');

// Warm the data caches up front so the reveal is instant on Stop.
loadExoplanets();
loadMessier();
loadApod();

function hideDiscovery() {
  discoveryEl.hidden = true;
  apodFigure.hidden = true;
  apodImg.removeAttribute('src');
}

/** Attach a real NASA APOD photo + its caption, or skip it gracefully. */
async function showApod() {
  apodFigure.hidden = true;
  const images = await loadApod();
  if (!images) return; // no apod.json yet — discovery shows without an image.

  const img = pickRandomImage(images);
  apodImg.src = img.url;
  apodImg.alt = img.title || 'NASA Astronomy Picture of the Day';
  apodTitle.textContent = img.title || 'NASA Astronomy Picture of the Day';
  apodCredit.textContent = [
    'NASA APOD',
    img.date,
    img.copyright ? `© ${img.copyright}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  apodExplanation.textContent = img.explanation || '';
  // Reveal the figure only once the image actually loads; hide on error.
  apodImg.onload = () => {
    apodFigure.hidden = false;
  };
  apodImg.onerror = () => {
    apodFigure.hidden = true;
  };
}

/**
 * Pick a real object to discover — its type and size scaled by how long the
 * session lasted — render it as the scene's focal point, and describe it.
 * Falls back gracefully if no data files are present.
 */
async function revealDiscovery(intensity) {
  const [exoplanets, messier] = await Promise.all([loadExoplanets(), loadMessier()]);

  const choice = chooseDiscovery(intensity, { messier, exoplanets });
  if (!choice) {
    // No data files yet — keep working, just nudge toward fetching them.
    hint.textContent =
      'Session complete · run "npm run fetch-data" and "npm run fetch-messier" to discover real objects';
    return;
  }

  // Render the discovered object and ease the camera toward it.
  scene.spawnDiscovery(buildDiscoveryVisual(choice, intensity));

  const info = describeDiscovery(choice);
  discoveryLabel.textContent = info.label;
  discoveryName.textContent = info.name;
  discoveryStats.textContent = info.headline;
  discoveryDesc.textContent = info.description;
  discoveryEl.hidden = false;
  hint.textContent = 'Session complete';

  showApod(); // real NASA imagery alongside the discovery (if available)
}

const timer = new StudyTimer({
  display,
  onStart() {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    hint.textContent = 'Focus session in progress…';
    hideDiscovery();
    scene.reset(); // clear any object from a previous session
  },
  onStop(elapsedMs) {
    startBtn.disabled = false;
    stopBtn.disabled = true;
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
