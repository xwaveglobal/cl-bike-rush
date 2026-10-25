/** Inline SVG icons (no icon font / CDN). */
const svg = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

/** UI chrome icons: one stroke style (24 grid, 2px round strokes) so they read as a set. */
const line = (body: string, w = 2) =>
  svg(`<g fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`);

export const ICON = {
  dash: svg('<path d="M3.5 6.5 9 12l-5.5 5.5h3.6L12.6 12 7.1 6.5z" fill="#2ee6c8"/><path d="M11 6.5 16.5 12 11 17.5h3.6l5.5-5.5-5.5-5.5z" fill="#a8fff0"/>'),
  sos: svg('<path d="M12 2.5 18.5 10h-4v6.5h-5V10h-4z" fill="#ff5a3c"/><path d="M12 2.5 18.5 10h-4" fill="#ffb4a6"/><rect x="6" y="18.2" width="12" height="2.6" rx="1.3" fill="#fff"/>'),
  close: line('<path d="M6 6l12 12M18 6 6 18"/>', 2.4),
  share: line('<path d="M12 15V4"/><path d="M7.5 8.2 12 3.8l4.5 4.4"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/>'),
  plus: line('<path d="M12 6v12M6 12h12"/>', 2.6),
  calendar: line('<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="m9 15 2 2 4-4"/>'),
  podium: svg('<rect x="9" y="7.5" width="6" height="13" rx="1.2" fill="#ffc21a"/><rect x="2.8" y="11.5" width="6" height="9" rx="1.2" fill="#9fd6ff"/><rect x="15.2" y="13.5" width="6" height="7" rx="1.2" fill="#ff9a5c"/><path d="M12 2.6l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="#fff3a0"/>'),
  cup: svg('<path d="M6.5 3.5h11v5.2a5.5 5.5 0 0 1-11 0z" fill="#ffc21a"/><path d="M6.5 5H3.7v1.5a3.8 3.8 0 0 0 3.6 3.8M17.5 5h2.8v1.5a3.8 3.8 0 0 1-3.6 3.8" fill="none" stroke="#ffc21a" stroke-width="1.7" stroke-linecap="round"/><path d="M10.5 14h3v3h-3z" fill="#f09a00"/><rect x="7.2" y="17" width="9.6" height="3.6" rx="1.2" fill="#ffc21a"/><path d="M12 5.2l.8 1.6 1.7.2-1.3 1.2.3 1.7-1.5-.8-1.5.8.3-1.7-1.3-1.2 1.7-.2z" fill="#fff8d0"/>'),
  bag: svg('<path d="M5 8.5h14l-1.2 11a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4z" fill="currentColor"/><path d="M8.8 10V7a3.2 3.2 0 0 1 6.4 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m12 12.6.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="#0b1436" opacity=".55"/>'),
  gift: svg('<rect x="3.5" y="8.5" width="17" height="4" rx="1.2" fill="currentColor"/><rect x="5" y="12.5" width="14" height="8" rx="1.4" fill="currentColor" opacity=".85"/><path d="M12 8.5v12" stroke="#0b1436" stroke-width="2" opacity=".5"/><path d="M12 8.3C10.6 5 7.4 4.6 7.2 6.6 7 8.3 10 8.4 12 8.3zm0 0c1.4-3.3 4.6-3.7 4.8-1.7.2 1.7-2.8 1.8-4.8 1.7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'),
  user: line('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>'),
  hyper: svg('<path d="M12 1.8c2.9 2.2 4 5.5 3.8 9.5l2.6 3.4-3-.6-.7 2.6H9.3l-.7-2.6-3 .6 2.6-3.4C8 7.3 9.1 4 12 1.8z" fill="#ffc21a"/><path d="M12 1.8c1.4 1.1 2.3 2.4 2.9 3.9H9.1c.6-1.5 1.5-2.8 2.9-3.9z" fill="#fff3a0"/><circle cx="12" cy="9" r="1.7" fill="#7a3d00"/><path d="M9.8 17.6h4.4L12 22.4z" fill="#ff8a1f"/><path d="M3 6l1.4.6M21 6l-1.4.6M2.6 11h1.6M21.4 11h-1.6" stroke="#ffe08a" stroke-width="1.4" stroke-linecap="round"/>'),
  noads: svg('<rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><text x="12" y="14.6" font-size="7" font-family="Arial Black,Arial" font-weight="900" text-anchor="middle" fill="currentColor">AD</text><path d="M4 20 20 4" stroke="#ff3b5c" stroke-width="2.4" stroke-linecap="round"/>'),
  crown: svg('<path d="M3.5 8.5 7.5 12l4.5-6.5 4.5 6.5 4-3.5-1.6 10H5.1z" fill="#ffc21a"/><rect x="5" y="18.6" width="14" height="2.2" rx="1" fill="#f09a00"/><circle cx="12" cy="14" r="1.4" fill="#fff3a0"/>'),
  clock: line('<circle cx="12" cy="12" r="8.2"/><path d="M12 7.5V12l3 2"/>'),
  info: line('<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.5"/><path d="M12 7.6h.01" stroke-width="2.8"/>'),
  film: line('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m10 9.2 5 2.8-5 2.8z" fill="currentColor"/>'),
  pause: svg('<rect x="6.5" y="5" width="3.6" height="14" rx="1.5" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.5" fill="currentColor"/>'),
  play: svg('<path d="M8.2 5.3c0-1 1.1-1.6 2-1.1l9.4 6.1c.8.5.8 1.7 0 2.3l-9.4 6.1c-.9.5-2-.1-2-1.1z" fill="currentColor"/>'),
  home: line('<path d="M4 11 12 4.5 20 11"/><path d="M6.5 9.5V19a1 1 0 0 0 1 1H10v-5h4v5h2.5a1 1 0 0 0 1-1V9.5"/>'),
  retry: line('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.2 4.2v4.6h-4.6"/>', 2.3),
  gear: line('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/><circle cx="12" cy="12" r="6.3"/>'),
  sound: svg('<path d="M3.8 9.6c0-.6.4-1 1-1h2.8l4.3-3.6c.6-.5 1.6 0 1.6.8v12.4c0 .8-1 1.3-1.6.8L7.6 15.4H4.8a1 1 0 0 1-1-1z" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16.3 9a4.2 4.2 0 0 1 0 6"/><path d="M18.8 6.5a7.8 7.8 0 0 1 0 11"/></g>'),
  soundOff: svg('<path d="M3.8 9.6c0-.6.4-1 1-1h2.8l4.3-3.6c.6-.5 1.6 0 1.6.8v12.4c0 .8-1 1.3-1.6.8L7.6 15.4H4.8a1 1 0 0 1-1-1z" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m16.5 9.5 5 5M21.5 9.5l-5 5"/></g>'),
  music: svg('<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17.5V6.2l10-2.2v11.3"/><path d="M9 9.4l10-2.2"/></g><circle cx="6.6" cy="17.6" r="2.6" fill="currentColor"/><circle cx="16.6" cy="15.4" r="2.6" fill="currentColor"/>'),
  musicOff: svg('<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17.5V6.2l10-2.2v11.3"/><path d="M3.5 3.5l17 17" stroke-width="2.3"/></g><circle cx="6.6" cy="17.6" r="2.6" fill="currentColor"/><circle cx="16.6" cy="15.4" r="2.6" fill="currentColor"/>'),
  // flying car seen from the front: canopy, body, two hover pods
  car: svg('<path d="M7.4 10.2 8.8 6.8c.3-.7 1-1.2 1.8-1.2h2.8c.8 0 1.5.5 1.8 1.2l1.4 3.4z" fill="currentColor" opacity=".55"/><rect x="3.4" y="10" width="17.2" height="6" rx="3" fill="currentColor"/><circle cx="7.4" cy="13" r="1.1" fill="#0b1436"/><circle cx="16.6" cy="13" r="1.1" fill="#0b1436"/><rect x="2.6" y="17.6" width="5.4" height="1.9" rx=".95" fill="currentColor" opacity=".8"/><rect x="16" y="17.6" width="5.4" height="1.9" rx=".95" fill="currentColor" opacity=".8"/>'),
  // target with arrow
  target: svg('<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="13" r="7.8"/><circle cx="11" cy="13" r="3.9"/><path d="M11 13 19.5 4.5"/><path d="M16.3 4.2h3.5v3.5"/></g><circle cx="11" cy="13" r="1.4" fill="currentColor"/>'),
  trophy: svg('<path d="M7 3.8h10v4.8a5 5 0 0 1-10 0z" fill="#ffc21a"/><path d="M7 5.2H4.3v1.3A3.6 3.6 0 0 0 7.6 10M17 5.2h2.7v1.3a3.6 3.6 0 0 1-3.3 3.5" fill="none" stroke="#ffc21a" stroke-width="1.7" stroke-linecap="round"/><path d="M10.6 13.4h2.8v3h-2.8z" fill="#f09a00"/><rect x="7.5" y="16.3" width="9" height="3.5" rx="1.2" fill="#ffc21a"/><path d="M9.3 5.5v2.8" stroke="#fff3a0" stroke-width="1.4" stroke-linecap="round"/>'),
  flag: svg('<path d="M5.5 21V3.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 4.3h11.6c.6 0 .9.6.6 1.1L16.4 8.6l1.8 3.2c.3.5 0 1.1-.6 1.1H6z" fill="currentColor"/>'),
  chevL: line('<path d="M14.5 5 7.5 12l7 7"/>', 2.8),
  chevR: line('<path d="M9.5 5l7 7-7 7"/>', 2.8),
  check: line('<path d="M5 12.5 10 17.5 19.5 7"/>', 3),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8.3 10.5V8a3.7 3.7 0 0 1 7.4 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  engine: svg('<path d="M3 12h3l2-4h7l2 3h2v-2h2v8h-2v-2h-2l-2 3H9l-2-3H3z" fill="currentColor"/>'),
  // game items (full colour)
  coin: svg('<circle cx="12" cy="12" r="10" fill="#ffc21a"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#fff3a0" stroke-width="1.4"/><path d="M13 5.8 8.8 12.6h3l-1 5.6 4.6-7.4h-3z" fill="#b35a00"/>'),
  heart: svg('<path d="M12 20.5s-8-4.8-8-10.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.5c0 5.8-8 10.6-8 10.6z" fill="#ff3b6b"/><path d="M7.5 8.5a2.5 2.5 0 0 1 2.4-1.2" stroke="#ffd0dc" stroke-width="1.4" fill="none" stroke-linecap="round"/>'),
  heartEmpty: svg('<path d="M12 20.5s-8-4.8-8-10.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.5c0 5.8-8 10.6-8 10.6z" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>'),
  shield: svg('<path d="M12 2.8 4.5 5.6v5.6c0 4.7 3.2 8.6 7.5 10 4.3-1.4 7.5-5.3 7.5-10V5.6z" fill="#3d9bff"/><path d="M12 6 7.6 7.7v3.6c0 2.9 1.9 5.3 4.4 6.3 2.5-1 4.4-3.4 4.4-6.3V7.7z" fill="#bfe4ff"/>'),
  magnet: svg('<path d="M5 4h4v8a3 3 0 0 0 6 0V4h4v8A7 7 0 0 1 5 12z" fill="#ff3b4e"/><rect x="5" y="4" width="4" height="3" fill="#e8edf6"/><rect x="15" y="4" width="4" height="3" fill="#e8edf6"/>'),
  rocket: svg('<path d="M12 2.5c2.6 2 3.6 5 3.4 8.6l2.3 3.1-2.7-.5-.6 2.3H9.6L9 13.7l-2.7.5 2.3-3.1C8.4 7.5 9.4 4.5 12 2.5z" fill="#9b6bff"/><circle cx="12" cy="8.6" r="1.6" fill="#dff1ff"/><path d="M10.4 17.4h3.2L12 21.5z" fill="#5ad1ff"/>'),
  bolt: svg('<path d="M13.5 2 5 13.5h5.5L9.5 22 19 9.8h-5.6z" fill="#b6ff2e"/>'),
  x2: svg('<text x="12" y="16.8" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="12.5" font-style="italic" fill="#ffc21a">2X</text>'),
  hand: svg('<path d="M9 11V5.2a1.6 1.6 0 0 1 3.2 0V10l.3-1.2a1.5 1.5 0 0 1 2.9.6v1.3l.4-.8a1.4 1.4 0 0 1 2.6 1V15a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-5-2.7L4 15.7a1.5 1.5 0 0 1 2.4-1.8L9 16.5z" fill="#ffffff" stroke="#0a1230" stroke-width="1.1"/>'),
} as const;
