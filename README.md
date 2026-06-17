# Stellar Focus

A study timer that takes place in the universe. Basically, you hit start, it counts up while you work, and when you stop a little spiral galaxy spins up in the background. The longer you spend studying, the bigger the galaxy is and the more of the universe you can traverse.

I kept getting distracted by my normal timer apps, and with my awe for the universe I wanted to create something new and bold. It's like an app you can leave on your monitor or computer when studying, and it will all pay off once you're done.

## Running it

You'll need Node (I'm on 20, anything recent is fine).

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The Vite config opens the browser for you, so it might already be there.

To build for production:

```bash
npm run build
npm run preview
```

## How it works

The whole thing is vanilla JS + Three.js, no framework. The pieces:

- **`src/timer.js`** – the count-up timer. It tracks elapsed time off `Date.now()` rather than just incrementing a counter, so it doesn't drift when the tab gets throttled in the background.
- **`src/starfield.js`** – three layers of star particles at different depths. Each layer drifts sideways at a different speed, which gives you the parallax (closer stars move faster). They wrap around when they reach the edge so it never thins out.
- **`src/galaxy.js`** – generates a spiral galaxy from a seed. Same seed always gives the same galaxy. It's the usual branches-plus-spin approach with the particles clustered toward the arms and a warm-to-cool color ramp from the core outward.
- **`src/particleTexture.js`** – a little radial-gradient sprite so the points are soft glowing dots instead of hard squares.
- **`src/scene.js`** – ties it together: renderer, the bloom pass, the render loop, and the camera drift when a galaxy spawns.
- **`src/main.js`** – wires the buttons to the timer and the scene.

Bloom is `UnrealBloomPass` from the Three.js examples, with the threshold set so only the brighter particles glow.

## Notes / things I might do later

- The galaxy seed is shown in the corner when a session ends. I might let you save/reload a seed you liked.
- Sound would be nice. Some ambient hum.
- No persistence yet — refresh and you lose the timer. I need to change this asap
- I want to include a 3D aspect so you can move around. I have a strong vision- not sure how to execute it yet lol

Built for fun!
