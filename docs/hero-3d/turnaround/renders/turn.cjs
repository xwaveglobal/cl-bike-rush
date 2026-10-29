// near-orthographic turnaround renders (rider+bike and helmet) for the reference sheet
const { chromium } = require('playwright');
const fs = require('fs');
const S = '/tmp/claude-0/-home-claude/508aa4a3-f434-5478-82f1-376ca4166a3b/scratchpad', T = S + '/three/t/';
const D = 14, H = [0, 1.21, -0.29], d = 3;
const views = {
  full_front: { p: [0, 0.75, -D], l: [0, 0.75, 0], fov: 9 },
  full_left: { p: [-D, 0.75, 0], l: [0, 0.75, 0], fov: 9 },
  full_rear: { p: [0, 0.75, D], l: [0, 0.75, 0], fov: 9 },
  full_right: { p: [D, 0.75, 0], l: [0, 0.75, 0], fov: 9 },
  full_top: { p: [0, D, 0.001], l: [0, 0, 0], fov: 9 },
  full_34: { p: [-D * 0.62, 0.75 + D * 0.3, -D * 0.72], l: [0, 0.75, 0], fov: 9 },
  helmet_front: { p: [H[0], H[1], H[2] - d], l: H, fov: 6 },
  helmet_left: { p: [H[0] - d, H[1], H[2]], l: H, fov: 6 },
  helmet_rear: { p: [H[0], H[1], H[2] + d], l: H, fov: 6 },
  helmet_top: { p: [H[0], H[1] + d, H[2] + 0.001], l: H, fov: 6 },
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('https://cdn.jsdelivr.net/npm/three@0.169.0/**', r => r.fulfill({ body: fs.readFileSync(T + r.request().url().split('three@0.169.0/')[1]), contentType: 'application/javascript' }));
  await p.route('https://fonts.**', r => r.abort());
  await p.route('http://local/**', r => r.fulfill({ body: fs.readFileSync(S + '/viewer/bike-rush-hero.html'), contentType: 'text/html; charset=utf-8' }));
  await p.goto('http://local/i.html', { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__viewer, null, { timeout: 60000 });
  await p.evaluate(() => {
    document.querySelector('aside').style.display = 'none';
    document.querySelector('.app').style.gridTemplateColumns = '1fr';
    for (const sel of ['.hud', '.pose-chip', '.hint']) document.querySelector(sel).style.display = 'none';
    window.__viewer.run(false); window.__viewer.studio(true); window.__viewer.pose('StraightRide');
  });
  for (const [name, v] of Object.entries(views)) {
    await p.evaluate(([pp, ll, f]) => { window.__viewer.fov(f); window.__viewer.cam(pp, ll); }, [v.p, v.l, v.fov]);
    await p.waitForTimeout(1500);
    await p.locator('#stage').screenshot({ path: `${S}/turn/${name}.png`, timeout: 120000 });
  }
  await b.close();
})();
