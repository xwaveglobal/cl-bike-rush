// Share image: a 1080×1350 "brag card" drawn on a canvas (rank shield, EXP, car, pilot),
// then handed to the native share sheet — with a visible fallback when sharing is blocked
// (e.g. inside an iframe): a preview the player can long-press / download.
import { CLASS_COLOR, type RankClass } from '../meta/Rank.ts';

export interface ShareCardData {
  title: string; // 'FINISH' · 'NEW RANK' · 'MY PILOT'
  name: string;
  rank: RankClass;
  exp: number;
  sub?: string; // e.g. '8.4 km · Hard · Endless'
  car: string; // image url
  avatar: string; // svg markup
  logo: string; // image url
}

const W = 1080;
const H = 1350;

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

function shield(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.lineTo(cx + r * 0.86, cy - r * 0.62);
  g.lineTo(cx + r * 0.78, cy + r * 0.28);
  g.quadraticCurveTo(cx + r * 0.5, cy + r * 0.82, cx, cy + r);
  g.quadraticCurveTo(cx - r * 0.5, cy + r * 0.82, cx - r * 0.78, cy + r * 0.28);
  g.lineTo(cx - r * 0.86, cy - r * 0.62);
  g.closePath();
}

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

export async function drawShareCard(d: ShareCardData): Promise<Blob | null> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  const col = CLASS_COLOR[d.rank];
  // background: deep night sky + rank-coloured glow
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#120a3a');
  bg.addColorStop(0.55, '#1d0f52');
  bg.addColorStop(1, '#07051a');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 470, 40, W / 2, 470, 620);
  glow.addColorStop(0, `${col}66`);
  glow.addColorStop(1, 'transparent');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  // speed lines
  g.strokeStyle = 'rgba(255,255,255,.06)';
  g.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    const y = 120 + i * 47;
    g.beginPath();
    g.moveTo(((i * 137) % 300) - 40, y);
    g.lineTo(((i * 137) % 300) + 160 + (i % 3) * 90, y);
    g.stroke();
  }
  const [logo, car, ava] = await Promise.all([
    load(d.logo),
    load(d.car),
    load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(d.avatar.includes('xmlns') ? d.avatar : d.avatar.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'))}`),
  ]);
  if (logo) {
    const lw = 560;
    g.drawImage(logo, (W - lw) / 2, 40, lw, (lw * logo.height) / logo.width);
  }
  g.textAlign = 'center';
  g.fillStyle = '#ffffff';
  g.font = '900 italic 92px system-ui, -apple-system, Segoe UI, sans-serif';
  g.shadowColor = col;
  g.shadowBlur = 30;
  g.fillText(d.title, W / 2, 300);
  g.shadowBlur = 0;
  // rank shield
  shield(g, W / 2, 500, 150);
  const sg = g.createLinearGradient(0, 350, 0, 650);
  sg.addColorStop(0, col);
  sg.addColorStop(1, '#1a0f40');
  g.fillStyle = sg;
  g.shadowColor = col;
  g.shadowBlur = 50;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 12;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = `900 ${d.rank.length > 2 ? 110 : d.rank.length > 1 ? 140 : 170}px system-ui, -apple-system, Segoe UI, sans-serif`;
  g.textBaseline = 'middle';
  g.fillText(d.rank, W / 2, 510);
  g.textBaseline = 'alphabetic';
  g.font = '800 40px system-ui, -apple-system, Segoe UI, sans-serif';
  g.fillStyle = col;
  g.fillText(`RANK ${d.rank}`, W / 2, 712);
  // EXP
  g.fillStyle = '#ffffff';
  g.font = '900 128px system-ui, -apple-system, Segoe UI, sans-serif';
  g.fillText(fmt(d.exp), W / 2, 850);
  g.font = '800 44px system-ui, -apple-system, Segoe UI, sans-serif';
  g.fillStyle = '#ffd94a';
  g.fillText('EXP', W / 2, 910);
  if (d.sub) {
    g.fillStyle = 'rgba(220,225,255,.8)';
    g.font = '600 36px system-ui, -apple-system, Segoe UI, sans-serif';
    g.fillText(d.sub, W / 2, 964);
  }
  // car
  if (car) {
    // fit inside 680×250, keep the aspect ratio, sit on a soft glow
    const k = Math.min(680 / car.width, 250 / car.height);
    const cw = car.width * k;
    const ch = car.height * k;
    const halo = g.createRadialGradient(W / 2, 1110, 20, W / 2, 1110, 380);
    halo.addColorStop(0, `${col}55`);
    halo.addColorStop(1, 'transparent');
    g.fillStyle = halo;
    g.fillRect(0, 980, W, 260);
    g.drawImage(car, (W - cw) / 2, 1235 - ch, cw, ch);
  }
  // pilot strip
  g.fillStyle = 'rgba(0,0,0,.45)';
  g.fillRect(0, H - 110, W, 110);
  if (ava) g.drawImage(ava, 40, H - 98, 86, 86);
  g.textAlign = 'left';
  g.fillStyle = '#ffffff';
  g.font = '800 44px system-ui, -apple-system, Segoe UI, sans-serif';
  g.fillText(d.name.slice(0, 18), 146, H - 42);
  g.textAlign = 'right';
  g.fillStyle = 'rgba(220,225,255,.85)';
  g.font = '700 34px system-ui, -apple-system, Segoe UI, sans-serif';
  g.fillText('Can you beat me?', W - 40, H - 44);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

/** 'shared' = native sheet done · 'cancel' = player closed it · 'fallback' = caller shows the preview */
export async function shareImage(blob: Blob | null, text: string, url: string): Promise<'shared' | 'cancel' | 'fallback'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (blob && nav.share && nav.canShare) {
      const file = new File([blob], 'sky-roadster.png', { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: 'Sky Roadster', text: url ? `${text} ${url}` : text });
        return 'shared';
      }
    }
    if (nav.share) {
      await nav.share({ title: 'Sky Roadster', text, ...(url ? { url } : {}) });
      return 'shared';
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'cancel';
  }
  return 'fallback';
}

/** copy text without the async clipboard API (works inside sandboxed iframes more often) */
export function copyText(t: string) {
  try {
    void navigator.clipboard?.writeText(t).catch(() => legacyCopy(t));
  } catch {
    legacyCopy(t);
  }
}
function legacyCopy(t: string) {
  const ta = document.createElement('textarea');
  ta.value = t;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    /* ignore */
  }
  ta.remove();
}
