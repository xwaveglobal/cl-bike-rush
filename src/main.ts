import { Game } from './Game.ts';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const container = document.getElementById('game')!;
if (!webglAvailable()) {
  container.innerHTML =
    '<div style="position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;font:600 16px system-ui;color:#cfe7ff">Sky Roadster needs WebGL. Please enable hardware acceleration or try another browser.</div>';
} else {
  const game = new Game(container);
  game.boot().catch((e) => {
    console.error(e);
    container.insertAdjacentHTML('beforeend', `<pre style="position:absolute;left:8px;bottom:8px;color:#ff8a8a;font:11px monospace;white-space:pre-wrap">${String(e)}</pre>`);
  });
}
