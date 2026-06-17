// A simple count-up study timer with Start/Stop controls.
// Uses Date.now() deltas (not a naive interval counter) so the elapsed time
// stays accurate even if the browser throttles timers in a background tab.

export class StudyTimer {
  constructor({ display, onStart, onStop } = {}) {
    this.display = display;
    this.onStart = onStart;
    this.onStop = onStop;

    this.running = false;
    this.startedAt = 0; // timestamp (ms) when the current run began
    this.elapsed = 0; // accumulated ms across previous runs
    this._tickHandle = null;

    this._render(0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();
    // Update the display a few times a second for smooth seconds rollover.
    this._tickHandle = setInterval(() => this._tick(), 250);
    this.onStart?.();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.elapsed += Date.now() - this.startedAt;
    clearInterval(this._tickHandle);
    this._tickHandle = null;
    this._render(this.elapsed);
    this.onStop?.(this.elapsed);
  }

  /** Total elapsed milliseconds, including the in-progress run. */
  get totalMs() {
    return this.elapsed + (this.running ? Date.now() - this.startedAt : 0);
  }

  _tick() {
    this._render(this.totalMs);
  }

  _render(ms) {
    if (this.display) this.display.textContent = formatDuration(ms);
  }
}

/** Format milliseconds as HH:MM:SS. */
export function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
