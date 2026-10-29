const { chromium } = require('playwright');
const fs = require('fs');
const S = '/tmp/claude-0/-home-claude/508aa4a3-f434-5478-82f1-376ca4166a3b/scratchpad', T = S + '/three/t/';
const REF = { UpperArm_L: [0.15, 1.28], Forearm_L: [-0.03, 1.11], Hand_L: [-0.32, 0.97], Thigh_L: [0.41, 0.98], Shin_L: [0.105, 0.86], Foot_L: [0.34, 0.49], Head: [0.04, 1.39], Chest: [null, null], Neck: [null, null], Pelvis: [null, null] };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.route('https://cdn.jsdelivr.net/npm/three@0.169.0/**', r => r.fulfill({ body: fs.readFileSync(T + r.request().url().split('three@0.169.0/')[1]), contentType: 'application/javascript' }));
  await p.route('https://fonts.**', r => r.abort());
  await p.route('http://local/**', r => r.fulfill({ body: fs.readFileSync(S + '/viewer/bike-rush-hero.html'), contentType: 'text/html; charset=utf-8' }));
  await p.goto('http://local/i.html', { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__viewer, null, { timeout: 60000 });
  await p.evaluate(() => { window.__viewer.run(false); window.__viewer.pose('StraightRide'); });
  await p.waitForTimeout(800);
  for (const n of Object.keys(REF)) {
    const r = await p.evaluate((n) => window.__viewer.bone(n), n);
    const pz = r.p.z ?? r.p[2], py = r.p.y ?? r.p[1];
    const [rz, ry] = REF[n];
    console.log(n.padEnd(11), 'z', pz.toFixed(3), 'y', py.toFixed(3), rz === null ? '' : ` ref z ${rz} y ${ry}  dz ${(pz - rz).toFixed(2)} dy ${(py - ry).toFixed(2)}`);
  }
  await b.close();
})();
