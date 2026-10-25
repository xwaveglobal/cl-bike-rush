import * as THREE from 'three';
import logoFullUrl from '../assets/images/xwave-logo.png';
import logoMarkUrl from '../assets/images/xwave-mark.png';

/**
 * Procedural canvas textures. Everything visual is generated at runtime so the
 * prototype needs zero external downloads; each can be swapped for a real file
 * through the asset manifest.
 */
const cache = new Map<string, THREE.Texture>();

/**
 * Draw text that always fits: shrinks the font size until the text (plus blur margin)
 * is no wider than maxW. Prevents clipped letters on signs and billboards.
 */
export function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, style: string) {
  let s = size;
  g.font = style.replace('{s}', `${s}px`);
  while (s > 8 && g.measureText(text).width > maxW) {
    s -= 2;
    g.font = style.replace('{s}', `${s}px`);
  }
  g.fillText(text, x, y);
  return s;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function toTex(c: HTMLCanvasElement, opts: { repeat?: boolean; srgb?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = opts.aniso ?? 8;
  t.needsUpdate = true;
  return t;
}

function memo(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/**
 * Brand logo images (the official chrome XWAVE artwork). Loaded once; textures
 * that use them are created immediately and redrawn when the image arrives.
 */
const logoImgs = (() => {
  const load = (url: string) => {
    const img = new Image();
    img.decoding = 'async';
    const ready = new Promise<HTMLImageElement>((res) => {
      img.onload = () => res(img);
      img.onerror = () => res(img);
    });
    img.src = url;
    return ready;
  };
  return { full: load(logoFullUrl), mark: load(logoMarkUrl) };
})();

function drawContain(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  if (!img.naturalWidth) return;
  const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/**
 * XWAVE wordmark on transparent background.
 * `tint` = null keeps the chrome artwork; a colour recolours it (e.g. dark decal on a white car).
 */
export function logoTexture(tint: string | null = null, glow: string | null = null) {
  return memo(`logo-${tint}-${glow}`, () => {
    const [c, g] = canvas(1024, 210);
    const t = toTex(c);
    void logoImgs.mark.then((img) => {
      g.clearRect(0, 0, c.width, c.height);
      if (glow) {
        g.shadowColor = glow;
        g.shadowBlur = 22;
      }
      drawContain(g, img, 8, 8, c.width - 16, c.height - 16);
      g.shadowBlur = 0;
      if (tint) {
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = tint;
        g.globalAlpha = 0.88;
        g.fillRect(0, 0, c.width, c.height);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      t.needsUpdate = true;
    });
    return t;
  });
}

/** Rear badge like the reference car: silver XWAVE wordmark over "INNOVATE BEYOND LIMITS". */
export function rearBadgeTexture(tint: string | null = null) {
  return memo(`rear-badge-${tint}`, () => {
    const [c, g] = canvas(1024, 300);
    const t = toTex(c);
    void logoImgs.mark.then((img) => {
      g.clearRect(0, 0, c.width, c.height);
      drawContain(g, img, 212, 20, 600, 150);
      g.font = '600 46px "Helvetica Neue", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#c9d0dc';
      const text = 'INNOVATE BEYOND LIMITS';
      // letter-spaced tagline
      const spacing = 9;
      const w = g.measureText(text).width + spacing * (text.length - 1);
      let x = 512 - w / 2;
      g.textAlign = 'left';
      for (const ch of text) {
        g.fillText(ch, x, 232);
        x += g.measureText(ch).width + spacing;
      }
      if (tint) {
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = tint;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'source-over';
      }
      t.needsUpdate = true;
    });
    return t;
  });
}

/** Wheel face: chrome rim with five twin spokes, blue inner ring and an X hub (spins visibly). */
export function wheelFaceTexture() {
  return memo('wheel-face', () => {
    const [c, g] = canvas(256, 256);
    g.translate(128, 128);
    g.fillStyle = '#0b0e16';
    g.beginPath();
    g.arc(0, 0, 128, 0, Math.PI * 2);
    g.fill();
    // rim barrel
    const rim = g.createRadialGradient(0, 0, 70, 0, 0, 120);
    rim.addColorStop(0, '#2a3242');
    rim.addColorStop(0.7, '#d9e2f0');
    rim.addColorStop(1, '#7c8799');
    g.fillStyle = rim;
    g.beginPath();
    g.arc(0, 0, 118, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#10141e';
    g.beginPath();
    g.arc(0, 0, 104, 0, Math.PI * 2);
    g.fill();
    // twin spokes
    for (let i = 0; i < 5; i++) {
      g.save();
      g.rotate((i * Math.PI * 2) / 5);
      for (const off of [-9, 9]) {
        const sg = g.createLinearGradient(0, -100, 0, -20);
        sg.addColorStop(0, '#9aa6ba');
        sg.addColorStop(1, '#f4f7fc');
        g.fillStyle = sg;
        g.beginPath();
        g.moveTo(off - 5, -26);
        g.lineTo(off * 1.8 - 6, -102);
        g.lineTo(off * 1.8 + 6, -102);
        g.lineTo(off + 5, -26);
        g.closePath();
        g.fill();
      }
      g.restore();
    }
    // blue light ring + hub
    g.strokeStyle = '#3cc2ff';
    g.lineWidth = 6;
    g.shadowColor = '#3cc2ff';
    g.shadowBlur = 14;
    g.beginPath();
    g.arc(0, 0, 110, 0, Math.PI * 2);
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = '#e8eef8';
    g.beginPath();
    g.arc(0, 0, 28, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1b2a4a';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(-11, -11);
    g.lineTo(11, 11);
    g.moveTo(11, -11);
    g.lineTo(-11, 11);
    g.stroke();
    return toTex(c);
  });
}

/** Radial motion-blur streaks laid over a fast-spinning wheel. */
export function wheelBlurTexture() {
  return memo('wheel-blur', () => {
    const [c, g] = canvas(256, 256);
    g.translate(128, 128);
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const r0 = 30 + Math.random() * 40;
      const r1 = 70 + Math.random() * 45;
      g.strokeStyle = `rgba(220,232,250,${0.08 + Math.random() * 0.18})`;
      g.lineWidth = 2 + Math.random() * 4;
      g.beginPath();
      g.arc(0, 0, (r0 + r1) / 2, a, a + 0.5 + Math.random() * 0.6);
      g.stroke();
    }
    return toTex(c);
  });
}

/** Tyre tread stripes (wrap around the torus so rotation shows from the side). */
export function treadTexture() {
  return memo('tread', () => {
    const [c, g] = canvas(256, 32);
    g.fillStyle = '#0d1018';
    g.fillRect(0, 0, 256, 32);
    g.fillStyle = '#272d3a';
    for (let x = 0; x < 256; x += 16) {
      g.fillRect(x, 4, 6, 24);
    }
    const tx = toTex(c, { repeat: true });
    tx.repeat.set(3, 1);
    return tx;
  });
}

/** Billboard panel art — several variants that mimic the reference holo-ads. */
export function billboardTexture(variant: number) {
  return memo(`bb-${variant}`, () => {
    const [c, g] = canvas(512, 256);
    const palettes = [
      ['#1a0b4a', '#5b2bff', '#4fc3ff'],
      ['#0a1f4a', '#1677ff', '#7af5ff'],
      ['#3a0a3f', '#ff3fae', '#ffd34f'],
      ['#06283d', '#00c2ff', '#ffffff'],
    ];
    const [a, b, accent] = palettes[variant % palettes.length];
    const grad = g.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, a);
    grad.addColorStop(1, b);
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);
    // scanlines
    g.globalAlpha = 0.12;
    g.fillStyle = '#ffffff';
    for (let y = 0; y < 256; y += 4) g.fillRect(0, y, 512, 1);
    g.globalAlpha = 1;
    g.strokeStyle = accent;
    g.lineWidth = 8;
    g.strokeRect(6, 6, 500, 244);
    g.save();
    g.translate(256, 128);
    g.transform(1, 0, -0.2, 1, 0, 0);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = accent;
    g.shadowBlur = 24;
    g.fillStyle = '#ffffff';
    if (variant % 4 === 0) {
      fitText(g, 'XWAVE', 0, 0, 400, 120, '900 {s} "Arial Black", Arial, sans-serif');
    } else if (variant % 4 === 1) {
      const s1 = fitText(g, 'BEYOND LIMITS', 0, 36, 400, 64, '900 {s} "Arial Black", Arial, sans-serif');
      g.font = `900 ${s1}px "Arial Black", Arial, sans-serif`;
      g.fillText('INNOVATE', 0, -40);
    } else if (variant % 4 === 2) {
      fitText(g, 'SKY ROADSTER', 0, -22, 400, 74, '900 {s} "Arial Black", Arial, sans-serif');
      g.fillStyle = accent;
      fitText(g, 'GO BEYOND', 0, 52, 380, 36, '700 {s} Arial, sans-serif');
    } else {
      g.font = '900 96px "Arial Black", Arial, sans-serif';
      g.fillText('X', -150, 0);
      fitText(g, 'FLY · AVOID', 50, -26, 270, 46, '800 {s} Arial, sans-serif');
      fitText(g, 'COLLECT', 50, 30, 270, 46, '800 {s} Arial, sans-serif');
    }
    g.restore();
    const t = toTex(c);
    if (variant % 4 === 0 || variant % 4 === 1) {
      // brand boards show the official chrome logo (with or without the tagline)
      void (variant % 4 === 0 ? logoImgs.mark : logoImgs.full).then((img) => {
        g.fillStyle = grad;
        g.fillRect(14, 14, 484, 228);
        g.globalAlpha = 0.12;
        g.fillStyle = '#ffffff';
        for (let y = 14; y < 242; y += 4) g.fillRect(14, y, 484, 1);
        g.globalAlpha = 1;
        g.shadowColor = accent;
        g.shadowBlur = 26;
        drawContain(g, img, 34, 40, 444, 176);
        g.shadowBlur = 0;
        t.needsUpdate = true;
      });
    }
    return t;
  });
}

/** Building facade: dark glass grid with randomly lit windows (used as emissive map). */
export function windowsTexture(seed = 1) {
  return memo(`win-${seed}`, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#000000';
    g.fillRect(0, 0, 256, 256);
    let s = seed * 9301;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const cols = 8;
    const rows = 16;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const r = rnd();
        if (r < 0.42) continue;
        const hue = r > 0.93 ? '#ff7ad9' : r > 0.8 ? '#7ad7ff' : r > 0.62 ? '#ffd28a' : '#9fb8ff';
        g.fillStyle = hue;
        g.globalAlpha = 0.35 + rnd() * 0.65;
        g.fillRect(x * 32 + 5, y * 16 + 4, 22, 9);
      }
    }
    g.globalAlpha = 1;
    // vertical neon strip
    g.fillStyle = '#5ad1ff';
    g.fillRect(0, 0, 3, 256);
    const t = toTex(c, { repeat: true });
    return t;
  });
}

/** Road surface: dark asphalt panels, glowing lane dividers & edge lines. Tiles along V. */
export function roadTexture() {
  return memo('road', () => {
    const W = 512;
    const H = 512;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#1b1f2e';
    g.fillRect(0, 0, W, H);
    // panel seams
    g.strokeStyle = '#262c40';
    g.lineWidth = 3;
    for (let y = 0; y < H; y += 128) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    // subtle noise
    for (let i = 0; i < 2400; i++) {
      g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.12)';
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    // lane dividers (dashed)
    const laneW = W / 3;
    g.fillStyle = '#9fe7ff';
    for (let l = 1; l < 3; l++) {
      for (let y = 0; y < H; y += 128) g.fillRect(l * laneW - 4, y + 20, 8, 70);
    }
    // edge lines (cyan inside, amber hazard)
    g.fillStyle = '#4fc3ff';
    g.fillRect(6, 0, 8, H);
    g.fillRect(W - 14, 0, 8, H);
    g.fillStyle = '#ffb02e';
    for (let y = 0; y < H; y += 64) {
      g.fillRect(0, y, 5, 32);
      g.fillRect(W - 5, y, 5, 32);
    }
    const t = toTex(c, { repeat: true, aniso: 8 });
    return t;
  });
}

/** Chevron arrows painted on the road (boost pad look). */
export function chevronTexture() {
  return memo('chevron', () => {
    const [c, g] = canvas(256, 256);
    g.clearRect(0, 0, 256, 256);
    g.strokeStyle = '#7ad7ff';
    g.lineWidth = 26;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.shadowColor = '#4fc3ff';
    g.shadowBlur = 20;
    for (let i = 0; i < 2; i++) {
      const y = 150 - i * 80;
      g.beginPath();
      g.moveTo(50, y + 50);
      g.lineTo(128, y);
      g.lineTo(206, y + 50);
      g.stroke();
    }
    return toTex(c);
  });
}

/** Soft round glow sprite (for flares, particles, headlights). */
export function glowTexture() {
  return memo('glow', () => {
    const [c, g] = canvas(128, 128);
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return toTex(c, { srgb: false });
  });
}

/** Puffy cloud sprite. */
export function cloudTexture() {
  return memo('cloud', () => {
    const [c, g] = canvas(256, 256);
    for (let i = 0; i < 18; i++) {
      const x = 60 + Math.random() * 136;
      const y = 90 + Math.random() * 80;
      const r = 30 + Math.random() * 50;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return toTex(c);
  });
}

/** Rolling cloud-sea layer below the elevated road (tiles). */
export function cloudSeaTexture() {
  return memo('cloudsea', () => {
    const S = 512;
    const [c, g] = canvas(S, S);
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 20 + Math.random() * 70;
      for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
        const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.35)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
    return toTex(c, { repeat: true, srgb: false });
  });
}

/** "2X" badge, heart, etc. for pickup icons. */
export function iconTexture(kind: '2x') {
  return memo(`icon-${kind}`, () => {
    const [c, g] = canvas(256, 256);
    g.translate(128, 132);
    g.transform(1, 0, -0.15, 1, 0, 0);
    g.font = '900 150px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 16;
    g.strokeStyle = '#7a3b00';
    g.strokeText('2X', 0, 0);
    const grad = g.createLinearGradient(0, -70, 0, 70);
    grad.addColorStop(0, '#fff3a0');
    grad.addColorStop(0.5, '#ffc21a');
    grad.addColorStop(1, '#ff8a00');
    g.fillStyle = grad;
    g.fillText('2X', 0, 0);
    return toTex(c);
  });
}

/** Coin face: star emblem. */
export function coinFaceTexture() {
  return memo('coinface', () => {
    const [c, g] = canvas(128, 128);
    const grad = g.createRadialGradient(54, 48, 4, 64, 64, 64);
    grad.addColorStop(0, '#fff6b0');
    grad.addColorStop(0.6, '#ffc21a');
    grad.addColorStop(1, '#d97a00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#fff2a8';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(64, 64, 52, 0, Math.PI * 2);
    g.stroke();
    // lightning bolt emblem
    g.fillStyle = '#b35a00';
    g.beginPath();
    g.moveTo(70, 22);
    g.lineTo(42, 70);
    g.lineTo(62, 70);
    g.lineTo(54, 106);
    g.lineTo(88, 54);
    g.lineTo(67, 54);
    g.closePath();
    g.fill();
    return toTex(c);
  });
}

/** Vertical sky gradient for a theme (used on a big back-sphere). */
export function skyTexture(top: string, mid: string, bottom: string, stars = false, key = '') {
  return memo(`sky-${top}-${mid}-${bottom}-${stars}-${key}`, () => {
    const [c, g] = canvas(16, 512);
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, top);
    grad.addColorStop(0.55, mid);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 512);
    const t = toTex(c);
    if (!stars) return t;
    return t;
  });
}

export function starfieldTexture() {
  return memo('stars', () => {
    const [c, g] = canvas(1024, 512);
    g.fillStyle = '#000';
    g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 900; i++) {
      const a = Math.random();
      g.fillStyle = `rgba(255,255,255,${a * a})`;
      const s = Math.random() < 0.05 ? 2 : 1;
      g.fillRect(Math.random() * 1024, Math.random() * 512, s, s);
    }
    return toTex(c, { repeat: true });
  });
}

/** Hazard stripes for crates/barriers. */
export function hazardTexture(color = '#ffb02e') {
  return memo(`hazard-${color}`, () => {
    const [c, g] = canvas(128, 128);
    g.fillStyle = '#1a1d27';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = color;
    for (let i = -128; i < 256; i += 40) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 20, 0);
      g.lineTo(i + 20 + 128, 128);
      g.lineTo(i + 128, 128);
      g.closePath();
      g.fill();
    }
    return toTex(c, { repeat: true });
  });
}

/** Crate face with glowing X. */
export function crateTexture(glow: string) {
  return memo(`crate-${glow}`, () => {
    const [c, g] = canvas(256, 256);
    const grad = g.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#3a4256');
    grad.addColorStop(1, '#202534');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#596381';
    g.lineWidth = 18;
    g.strokeRect(9, 9, 238, 238);
    g.fillStyle = '#151924';
    g.fillRect(40, 40, 176, 176);
    g.strokeStyle = glow;
    g.shadowColor = glow;
    g.shadowBlur = 22;
    g.lineWidth = 22;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(66, 66);
    g.lineTo(190, 190);
    g.moveTo(190, 66);
    g.lineTo(66, 190);
    g.stroke();
    // corner bolts
    g.shadowBlur = 0;
    g.fillStyle = '#8b96b5';
    for (const [x, y] of [[22, 22], [234, 22], [22, 234], [234, 234]]) {
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
    }
    return toTex(c);
  });
}

export function disposeTextures() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

/** v2 Bonus roads: tiling ground textures (sand · grass · fields · water). */
export function groundTexture(kind: 'desert' | 'forest' | 'country' | 'sea') {
  return memo(`ground-${kind}`, () => {
    const [c, g] = canvas(256, 256);
    const rnd = (() => {
      let a = kind.length * 977;
      return () => ((a = (a * 16807) % 2147483647) / 2147483647);
    })();
    if (kind === 'desert') {
      g.fillStyle = '#e8b878';
      g.fillRect(0, 0, 256, 256);
      // wind ripples
      for (let y = 0; y < 256; y += 6) {
        g.strokeStyle = y % 12 ? 'rgba(160,100,50,.18)' : 'rgba(255,240,210,.25)';
        g.lineWidth = 2;
        g.beginPath();
        for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin((x / 256) * Math.PI * 4 + y * 0.3) * 3);
        g.stroke();
      }
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(150,95,45,${0.1 + rnd() * 0.15})`;
        g.fillRect(rnd() * 256, rnd() * 256, 2, 2);
      }
    } else if (kind === 'forest') {
      g.fillStyle = '#3f7d3a';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(30,80,30,.35)' : 'rgba(120,170,80,.25)';
        g.fillRect(rnd() * 256, rnd() * 256, 3, 3);
      }
    } else if (kind === 'country') {
      // patchwork fields
      const cols = ['#8fbf4a', '#c9b44a', '#6fa83d', '#d9c46a', '#5f9a3a', '#a8c85a'];
      for (let y = 0; y < 256; y += 64)
        for (let x = 0; x < 256; x += 128) {
          g.fillStyle = cols[Math.floor(rnd() * cols.length)];
          g.fillRect(x, y, 128, 64);
          g.strokeStyle = 'rgba(0,0,0,.12)';
          for (let k = 4; k < 64; k += 8) {
            g.beginPath();
            g.moveTo(x, y + k);
            g.lineTo(x + 128, y + k);
            g.stroke();
          }
        }
      g.strokeStyle = 'rgba(70,90,40,.6)';
      g.lineWidth = 3;
      g.strokeRect(0, 0, 256, 256);
    } else {
      g.fillStyle = '#1f7fb8';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 140; i++) {
        const x = rnd() * 256;
        const y = rnd() * 256;
        g.strokeStyle = `rgba(220,245,255,${0.15 + rnd() * 0.3})`;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 6, y - 3, x + 12, y);
        g.stroke();
      }
    }
    return toTex(c, { repeat: true });
  });
}

/** round badge with a short word (Bonus-road showcase specials) */
export function labelTexture(text: string, color: number) {
  return memo(`label-${text}-${color}`, () => {
    const [c, g] = canvas(256, 256);
    const hex = '#' + color.toString(16).padStart(6, '0');
    g.beginPath();
    g.arc(128, 128, 112, 0, Math.PI * 2);
    g.fillStyle = 'rgba(10,14,40,.85)';
    g.fill();
    g.lineWidth = 14;
    g.strokeStyle = hex;
    g.stroke();
    g.font = `900 ${text.length > 4 ? 58 : 70}px "Arial Black", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.fillText(text, 128, 134);
    return toTex(c);
  });
}

/** v2.1 ladder worlds: lava crust and ice sheet ground */
export function groundTexture2(kind: 'lava' | 'ice' | 'rockv') {
  return memo(`ground2-${kind}`, () => {
    const [c, g] = canvas(256, 256);
    let a = kind.length * 7919;
    const rnd = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    if (kind === 'lava') {
      g.fillStyle = '#2a0e08';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 26; i++) {
        g.strokeStyle = `rgba(255,${90 + Math.floor(rnd() * 90)},20,${0.55 + rnd() * 0.4})`;
        g.lineWidth = 2 + rnd() * 4;
        g.beginPath();
        let x = rnd() * 256, y = rnd() * 256;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (rnd() - 0.5) * 70;
          y += (rnd() - 0.5) * 70;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    } else if (kind === 'ice') {
      g.fillStyle = '#cfe8f6';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = `rgba(120,170,210,${0.2 + rnd() * 0.3})`;
        g.lineWidth = 1.2;
        g.beginPath();
        const x = rnd() * 256, y = rnd() * 256;
        g.moveTo(x, y);
        g.lineTo(x + (rnd() - 0.5) * 90, y + (rnd() - 0.5) * 90);
        g.stroke();
      }
    } else {
      g.fillStyle = '#4a2a5a';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(30,10,40,.35)' : 'rgba(160,110,200,.18)';
        g.fillRect(rnd() * 256, rnd() * 256, 4, 4);
      }
    }
    return toTex(c, { repeat: true });
  });
}
