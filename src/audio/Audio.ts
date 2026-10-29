/**
 * Procedural Web Audio: every SFX is synthesized, plus a small synthwave
 * sequencer for music. Any SFX can be overridden by a real file via
 * `loadOverride(name, url)` (see assets/manifest.ts).
 */
import { platform } from '../platform.ts';

export type Sfx =
  | 'coin' | 'lane' | 'up' | 'down' | 'land' | 'power' | 'shield' | 'shieldBreak' | 'crash' | 'explode'
  | 'near' | 'ring' | 'beep' | 'go' | 'mission' | 'click' | 'turbo' | 'respawn' | 'bump' | 'combo' | 'warp' | 'expire';

/**
 * v3: make a partial Web Audio implementation (a mini-game runtime's tt.createWebAudioContext)
 * usable: missing node factories fall back to a pass-through gain, missing AudioParam automation
 * falls back to timed value changes. Every sound and the music then play instead of going silent.
 */
function compat(c: any) {
  const fixParam = (p: any) => {
    if (!p || typeof p !== 'object') return p;
    const at = (t: number, fn: () => void) => {
      const ms = Math.max(0, (t - (c.currentTime ?? 0)) * 1000);
      if (ms < 4) fn();
      else setTimeout(fn, ms);
    };
    const set = (v: number) => {
      try {
        p.value = v;
      } catch {
        /* read-only */
      }
    };
    if (typeof p.setValueAtTime !== 'function') p.setValueAtTime = (v: number, t: number) => (at(t, () => set(v)), p);
    if (typeof p.exponentialRampToValueAtTime !== 'function') p.exponentialRampToValueAtTime = (v: number, t: number) => (at(t, () => set(v)), p);
    if (typeof p.linearRampToValueAtTime !== 'function') p.linearRampToValueAtTime = (v: number, t: number) => (at(t, () => set(v)), p);
    if (typeof p.setTargetAtTime !== 'function') p.setTargetAtTime = (v: number, t: number) => (at(t, () => set(v)), p);
    if (typeof p.cancelScheduledValues !== 'function') p.cancelScheduledValues = () => p;
    return p;
  };
  const fakeParam = (v: number) => fixParam({ value: v });
  const PARAMS = ['gain', 'frequency', 'detune', 'Q', 'pan', 'delayTime', 'threshold', 'ratio', 'knee', 'attack', 'release', 'playbackRate'];
  const fixNode = (n: any) => {
    if (!n) return n;
    for (const k of PARAMS) {
      if (k in n) {
        if (n[k] && typeof n[k] === 'object') fixParam(n[k]);
      }
    }
    // an oscillator without detune (the pads detune two saws)
    if (n.frequency && !n.detune) {
      try {
        n.detune = fakeParam(0);
      } catch {
        /* ignore */
      }
    }
    return n;
  };
  /** a pass-through node standing in for a missing one (gain = 1, extra params ignored) */
  const passThrough = (extra: Record<string, unknown>) => {
    const g = c.createGain();
    for (const [k, v] of Object.entries(extra)) {
      try {
        if (!(k in g)) g[k] = v;
      } catch {
        /* ignore */
      }
    }
    return fixNode(g);
  };
  const wrap = (name: string, fallback: (() => any) | null) => {
    const orig = typeof c[name] === 'function' ? c[name].bind(c) : null;
    c[name] = (...a: unknown[]) => {
      let n = null;
      try {
        n = orig ? orig(...a) : null;
      } catch {
        n = null;
      }
      if (!n && fallback) n = fallback();
      return fixNode(n);
    };
  };
  wrap('createGain', null);
  wrap('createOscillator', null);
  wrap('createBufferSource', null);
  wrap('createDynamicsCompressor', () => passThrough({ threshold: fakeParam(-14), ratio: fakeParam(4) }));
  wrap('createBiquadFilter', () => passThrough({ type: 'lowpass', frequency: fakeParam(1000), Q: fakeParam(1) }));
  wrap('createDelay', () => passThrough({ delayTime: fakeParam(0) }));
  if (typeof c.createStereoPanner === 'function') wrap('createStereoPanner', null);
}

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private overrides = new Map<string, AudioBuffer>();
  private pendingOverrides: [string, string][] = [];
  sfxOn = true;
  musicOn = true;
  private coinPitch = 0;
  private coinPitchT = 0;
  // music
  private seqTimer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private bpm = 100;
  /** warm lowpass + echo for the music (pads / arp) */
  private musicTone!: BiquadFilterNode;
  private echo!: GainNode;
  intensity = 0; // 0 menu, 1 run, 2 turbo
  private playing = false;

  // ---- v3 native: "baked" sound. Mini-game Web Audio has no (or crude) AudioParam automation, which
  // turned every envelope into hard steps = crackle. In the native build every SFX and the music
  // loop are rendered once into PCM buffers (same recipes, envelopes computed per sample) and only
  // plain buffer sources play — the most basic, best-supported part of Web Audio.
  private baked = platform.native;
  /** render target while baking (null = real-time) */
  private rt: Float32Array | null = null;
  private rtSr = 44100;
  private rtEcho: Float32Array | null = null;
  private sfxCache = new Map<string, AudioBuffer>();
  private loops: (AudioBuffer | null)[] = [null, null, null];
  private loopLen = 0;
  private loopSrc: AudioBufferSourceNode | null = null;
  private loopLevel = -1;
  private loopStart = 0;
  private loopTimer: number | null = null;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    try {
      this.unlockInner();
    } catch (e) {
      // a runtime with a partial Web Audio (some mini-game engines): play silently, never break the game
      console.warn('[audio] off:', e);
      this.ctx = null;
    }
  }
  private unlockInner() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume?.();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    try {
      compat(c);
    } catch (e) {
      console.warn('[audio] compat', e);
    }
    // iOS / mini-game runtimes start the context suspended until resumed inside a touch
    if (c.state !== 'running') void c.resume?.();
    if (this.baked) {
      this.rtSr = c.sampleRate || 44100;
      this.master = c.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(c.destination);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0;
      this.sfxBus.connect(this.master);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
      this.musicBus.connect(this.master);
      this.prebakeSfx();
      return;
    }
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(c.destination);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0;
    this.sfxBus.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
    this.musicBus.connect(this.master);
    // soft, airy mix: everything melodic goes through a gentle lowpass; the arp also feeds a
    // dotted-eighth echo so it shimmers like a road at night
    this.musicTone = c.createBiquadFilter();
    this.musicTone.type = 'lowpass';
    this.musicTone.frequency.value = 2600;
    this.musicTone.Q.value = 0.5;
    this.musicTone.connect(this.musicBus);
    this.echo = c.createGain();
    this.echo.gain.value = 0.55;
    const dl = c.createDelay(1);
    dl.delayTime.value = (60 / this.bpm) * 0.75;
    const fb = c.createGain();
    fb.gain.value = 0.32;
    const damp = c.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1800;
    this.echo.connect(dl);
    dl.connect(damp);
    damp.connect(fb);
    fb.connect(dl);
    damp.connect(this.musicTone);
    this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const [n, u] of this.pendingOverrides) void this.loadOverride(n, u);
    this.pendingOverrides.length = 0;
  }

  async loadOverride(name: string, url: string) {
    if (!this.ctx) {
      this.pendingOverrides.push([name, url]);
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.overrides.set(name, buf);
    } catch {
      /* keep procedural */
    }
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx && this.sfxBus) this.sfxBus.gain.value = on ? 0.9 : 0;
  }
  /** silence everything while an ad plays */
  duck(on: boolean) {
    if (this.ctx && this.master) this.master.gain.value = on ? 0 : 0.8;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx && this.musicBus) this.musicBus.gain.value = on ? 0.32 : 0;
  }

  // ---------------------------------------------------------------- helpers
  private osc(type: OscillatorType, f0: number, f1: number, t0: number, dur: number, vol: number, bus?: AudioNode, pan = 0) {
    if (this.rt) return bakeOsc(this.rt, this.rtSr, type, f0, f1, t0, dur, (t) => envAD(t, 0.008, dur, vol));
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let out: AudioNode = g;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      out = p;
    }
    o.connect(g);
    out.connect(bus ?? this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(t0: number, dur: number, vol: number, f0: number, f1: number, q = 1, type: BiquadFilterType = 'bandpass', bus?: AudioNode, pan = 0) {
    if (this.rt) return bakeNoise(this.rt, this.rtSr, t0, dur, vol, f0, f1, q, type);
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f);
    f.connect(g);
    let out: AudioNode = g;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      out = p;
    }
    out.connect(bus ?? this.sfxBus);
    s.start(t0, Math.random() * 0.5);
    s.stop(t0 + dur + 0.02);
  }

  play(name: Sfx, opt: { pan?: number } = {}) {
    if (!this.ctx || !this.sfxOn) return;
    try {
      if (this.baked) return this.playBaked(name);
      this.playInner(name, opt);
    } catch (e) {
      console.warn('[audio] play', name, e);
    }
  }
  /** baked SFX: render once (per coin pitch step), then play the buffer */
  private playBaked(name: Sfx) {
    const c = this.ctx!;
    if (this.overrides.has(name)) return this.playInner(name, {});
    if (name === 'coin') {
      const now = performance.now() / 1000;
      if (now - this.coinPitchT > 0.6) this.coinPitch = 0;
      this.coinPitchT = now;
    }
    const buf = this.bakeSfx(name, name === 'coin' ? Math.min(this.coinPitch, 12) : -1);
    if (name === 'coin') this.coinPitch++;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.connect(this.sfxBus);
    s.start();
  }

  private bakeSfx(name: Sfx, pitch: number): AudioBuffer {
    const key = name === 'coin' ? `coin${pitch}` : name;
    let buf = this.sfxCache.get(key);
    if (!buf) {
      const pcm = this.bake(1.6, () => this.playInner(name, {}, Math.max(0, pitch)));
      buf = this.toBuffer(trimTail(pcm));
      this.sfxCache.set(key, buf);
    }
    return buf;
  }

  /** run a recipe into a fresh PCM buffer of `seconds` */
  private bake(seconds: number, recipe: () => void, echo = false): Float32Array {
    const pcm = new Float32Array(Math.ceil(seconds * this.rtSr));
    this.rt = pcm;
    this.rtEcho = echo ? new Float32Array(pcm.length) : null;
    try {
      recipe();
    } finally {
      this.rt = null;
    }
    return pcm;
  }

  private toBuffer(pcm: Float32Array, sr = this.rtSr): AudioBuffer {
    const c = this.ctx!;
    const b = c.createBuffer(1, Math.max(1, pcm.length), sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) d[i] = softClip(pcm[i]);
    return b;
  }

  private playInner(name: Sfx, opt: { pan?: number }, bakedPitch = -1) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = this.rt ? 0 : c.currentTime;
    const ov = this.overrides.get(name);
    if (ov) {
      const s = c.createBufferSource();
      s.buffer = ov;
      s.connect(this.sfxBus);
      s.start();
      return;
    }
    const pan = opt.pan ?? 0;
    switch (name) {
      case 'coin': {
        // rising pitch on fast streaks
        if (bakedPitch < 0) {
          if (t - this.coinPitchT > 0.6) this.coinPitch = 0;
          this.coinPitchT = t;
        }
        const base = 1320 * Math.pow(2, Math.min(bakedPitch >= 0 ? bakedPitch : this.coinPitch, 12) / 24);
        if (bakedPitch < 0) this.coinPitch++;
        this.osc('square', base, base, t, 0.06, 0.06);
        this.osc('sine', base * 1.5, base * 1.5, t + 0.05, 0.16, 0.12);
        break;
      }
      case 'lane':
        this.noise(t, 0.16, 0.22, 900, 3200, 1.4, 'bandpass', undefined, pan);
        this.osc('sine', 300, 520, t, 0.1, 0.05, undefined, pan);
        break;
      case 'bump':
        this.osc('sine', 160, 90, t, 0.12, 0.2, undefined, pan);
        break;
      case 'up':
        // pneumatic "pssshh" of the air blast, then the thrusters spool up
        this.noise(t, 0.55, 0.42, 7000, 2500, 0.6, 'highpass');
        this.noise(t, 0.4, 0.2, 900, 3500, 0.9);
        this.osc('sawtooth', 160, 520, t + 0.05, 0.32, 0.05);
        break;
      case 'down':
        this.osc('sawtooth', 500, 140, t, 0.22, 0.07);
        this.noise(t, 0.22, 0.18, 2500, 400, 0.8);
        break;
      case 'land':
        // tyres touch down + an air release
        this.osc('sine', 120, 55, t, 0.16, 0.22);
        this.noise(t, 0.45, 0.3, 5000, 1500, 0.6, 'highpass');
        break;
      case 'power':
        [0, 4, 7, 12].forEach((n, i) => this.osc('triangle', 523 * Math.pow(2, n / 12), 523 * Math.pow(2, n / 12), t + i * 0.055, 0.2, 0.12));
        this.noise(t, 0.4, 0.08, 4000, 9000, 1);
        break;
      case 'shield':
        this.osc('sine', 400, 900, t, 0.35, 0.12);
        this.osc('sine', 600, 1350, t + 0.04, 0.35, 0.06);
        break;
      case 'shieldBreak':
        this.noise(t, 0.45, 0.4, 6000, 1200, 2);
        this.osc('triangle', 900, 200, t, 0.35, 0.12);
        break;
      case 'crash':
        this.noise(t, 0.6, 0.6, 2000, 120, 0.7, 'lowpass');
        this.osc('sine', 110, 35, t, 0.6, 0.45);
        break;
      case 'explode':
        this.noise(t, 1.2, 0.7, 1200, 60, 0.6, 'lowpass');
        this.osc('sine', 80, 25, t, 1.0, 0.5);
        break;
      case 'near':
        this.noise(t, 0.18, 0.3, 3000, 8000, 3, 'bandpass', undefined, pan);
        this.osc('square', 1800, 2600, t, 0.08, 0.04);
        break;
      case 'ring':
        [0, 7, 12].forEach((n, i) => this.osc('sine', 880 * Math.pow(2, n / 12), 880 * Math.pow(2, n / 12), t + i * 0.04, 0.3, 0.09));
        break;
      case 'beep':
        this.osc('square', 660, 660, t, 0.12, 0.08);
        break;
      case 'go':
        this.osc('square', 1320, 1320, t, 0.3, 0.09);
        this.osc('sawtooth', 660, 1320, t, 0.3, 0.05);
        break;
      case 'mission':
        [0, 4, 7, 12, 16].forEach((n, i) => this.osc('square', 660 * Math.pow(2, n / 12), 660 * Math.pow(2, n / 12), t + i * 0.08, 0.22, 0.06));
        break;
      case 'combo':
        this.osc('triangle', 880, 1760, t, 0.18, 0.09);
        break;
      case 'click':
        this.osc('square', 900, 700, t, 0.05, 0.05);
        break;
      case 'turbo':
        this.noise(t, 1.0, 0.35, 300, 3000, 0.7);
        this.osc('sawtooth', 90, 300, t, 0.8, 0.1);
        break;
      case 'respawn':
        [12, 7, 4, 0].reverse().forEach((n, i) => this.osc('sine', 440 * Math.pow(2, n / 12), 440 * Math.pow(2, n / 12), t + i * 0.07, 0.3, 0.1));
        break;
      case 'warp':
        this.noise(t, 1.2, 0.4, 200, 6000, 1);
        this.osc('sawtooth', 60, 900, t, 1.0, 0.08);
        break;
      case 'expire':
        this.osc('triangle', 700, 350, t, 0.25, 0.08);
        break;
    }
  }

  // ---------------------------------------------------------------- music
  startMusic() {
    if (!this.ctx || this.playing) return;
    if (this.baked) {
      this.playing = true;
      this.loopLevel = -1;
      this.loopTick();
      this.loopTimer = window.setInterval(() => this.loopTick(), 300);
      return;
    }
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.seqTimer = window.setInterval(() => this.schedule(), 25);
  }
  stopMusic() {
    this.playing = false;
    if (this.loopTimer !== null) window.clearInterval(this.loopTimer);
    this.loopTimer = null;
    try {
      this.loopSrc?.stop();
    } catch {
      /* already stopped */
    }
    this.loopSrc = null;
    if (this.seqTimer !== null) window.clearInterval(this.seqTimer);
    this.seqTimer = null;
  }

  /** baked music: one 4-bar loop per intensity, switched at the next bar line (no clicks) */
  private loopTick() {
    try {
      const c = this.ctx;
      if (!c || !this.playing) return;
      const lv = Math.max(0, Math.min(2, Math.round(this.intensity)));
      if (lv === this.loopLevel && this.loopSrc) return;
      const buf = this.loops[lv];
      if (!buf) {
        if (this.loopJobs.size === 0 || this.loopJobs.has(lv)) this.bakeLoopAsync(lv);
        // keep the next levels warm too
        return;
      }
      const bar = this.loopLen / 4;
      const now = c.currentTime;
      // start in step with the old loop: at its next bar line, from the same position in the bar
      let when = now + 0.03;
      let offset = 0;
      if (this.loopSrc && this.loopLen > 0) {
        const pos = (now - this.loopStart) % this.loopLen;
        const nextBar = Math.ceil((pos + 0.02) / bar) * bar;
        when = now + (nextBar - pos);
        offset = nextBar % this.loopLen;
        try {
          this.loopSrc.stop(when);
        } catch {
          /* ignore */
        }
      }
      const s = c.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.connect(this.musicBus);
      s.start(when, offset);
      this.loopStart = when - offset;
      this.loopSrc = s;
      this.loopLevel = lv;
    } catch (e) {
      console.warn('[audio] music', e);
      this.stopMusic();
    }
  }

  /** loops being rendered (a few steps per tick so the game never freezes) */
  private loopJobs = new Set<number>();
  private bakeLoopAsync(level: number) {
    if (this.loops[level] || this.loopJobs.has(level) || !this.ctx) return;
    this.loopJobs.add(level);
    const spb = 60 / this.bpm / 4;
    const len = 64 * spb;
    this.loopLen = len;
    // v3.0.9: music renders at ≤ 22.05 kHz (it is low-passed at 2.6 kHz anyway) — half the work
    const sfxSr = this.rtSr;
    const sr = Math.min(sfxSr, 22050);
    const pcm = new Float32Array(Math.ceil((len + 3) * sr));
    const echo = new Float32Array(pcm.length);
    let st = 0;
    const step = () => {
      try {
        const keep = this.intensity;
        this.intensity = level;
        this.rt = pcm;
        this.rtEcho = echo;
        this.rtSr = sr;
        try {
          // one step per tick: a few ms of work, never a visible hitch
          this.note(st, st * spb, spb);
          st++;
        } finally {
          this.rt = null;
          this.rtEcho = null;
          this.rtSr = sfxSr;
          this.intensity = keep;
        }
        if (st < 64) return void setTimeout(step, 20);
        const n = Math.round(len * sr);
        // fold the tails (notes ringing past the loop end) back to the start → seamless
        for (let i = n; i < pcm.length; i++) {
          pcm[i - n] += pcm[i];
          echo[i - n] += echo[i];
        }
        const out = pcm.subarray(0, n);
        addEcho(out, echo.subarray(0, n), sr, (60 / this.bpm) * 0.75, 0.32, 0.55, 1800);
        lowpass(out, sr, 2600);
        this.loops[level] = this.toBuffer(out, sr);
      } catch (e) {
        console.warn('[audio] bake', e);
      }
      this.loopJobs.delete(level);
      if (this.playing) this.loopTick();
      // then the next intensity, in the background (ready before the race needs it)
      const next = this.loops.findIndex((b, i) => !b && !this.loopJobs.has(i));
      if (next >= 0 && this.loopJobs.size === 0) setTimeout(() => this.bakeLoopAsync(next), 400);
    };
    setTimeout(step, 0);
  }

  /** pre-render every SFX after unlock, a few per tick */
  private prebakeSfx() {
    const all: Sfx[] = ['click', 'coin', 'lane', 'up', 'down', 'land', 'power', 'shield', 'shieldBreak', 'crash', 'explode',
      'near', 'ring', 'beep', 'go', 'mission', 'turbo', 'respawn', 'bump', 'combo', 'warp', 'expire'];
    let i = 0;
    const tick = () => {
      for (const end = Math.min(all.length, i + 1); i < end; i++) {
        try {
          this.bakeSfx(all[i], all[i] === 'coin' ? 0 : -1);
        } catch {
          /* rendered on first play instead */
        }
      }
      if (i < all.length) setTimeout(tick, 60);
    };
    setTimeout(tick, 1500);
  }

  private schedule() {
    try {
      this.scheduleInner();
    } catch (e) {
      console.warn('[audio] music off:', e);
      this.stopMusic();
    }
  }
  private scheduleInner() {
    const c = this.ctx;
    if (!c) return;
    const spb = 60 / this.bpm / 4; // 16th notes
    while (this.nextTime < c.currentTime + 0.12) {
      this.note(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % 128;
    }
  }

  /** slow-attack pad voice (two detuned saws through the music lowpass) */
  private pad(midi: number, t0: number, dur: number, vol: number) {
    const hz = 440 * Math.pow(2, (midi - 69) / 12);
    if (this.rt) {
      const a = Math.min(0.9, dur * 0.35);
      const env = (t: number) => (t < a ? expSeg(t, 0, a, 0.0001, vol) : t < dur * 0.7 ? vol : expSeg(t, dur * 0.7, dur, vol, 0.0001));
      for (const det of [-7, 7]) bakeOsc(this.rt, this.rtSr, 'sawtooth', hz * Math.pow(2, det / 1200), hz * Math.pow(2, det / 1200), t0, dur + 0.03, env);
      return;
    }
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.9, dur * 0.35));
    g.gain.setValueAtTime(vol, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(this.musicTone);
    for (const det of [-7, 7]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = det;
      o.connect(g);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
  }

  /** soft pluck for the arpeggio (sine + triangle), sent to the echo */
  private pluck(midi: number, t0: number, vol: number) {
    const hz = 440 * Math.pow(2, (midi - 69) / 12);
    if (this.rt) {
      const env = (t: number) => envAD(t, 0.01, 0.42, vol);
      for (const target of [this.rt, this.rtEcho]) {
        if (!target) continue;
        bakeOsc(target, this.rtSr, 'sine', hz, hz, t0, 0.45, env);
        bakeOsc(target, this.rtSr, 'triangle', hz * 2, hz * 2, t0, 0.45, (t) => env(t) * 0.25);
      }
      return;
    }
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    g.connect(this.musicTone);
    g.connect(this.echo);
    for (const [type, mul] of [['sine', 1], ['triangle', 2]] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = hz * mul;
      const og = c.createGain();
      og.gain.value = mul === 1 ? 1 : 0.25;
      o.connect(og);
      og.connect(g);
      o.start(t0);
      o.stop(t0 + 0.45);
    }
  }

  /**
   * Original procedural soundtrack (no samples, no licensed material → safe for commercial use).
   * Calm synthwave: Fmaj7 – G6 – Em7 – Am7 at 100 bpm, warm pads, round bass, soft drums,
   * echoing arpeggio. Intensity 0 = menu (pads + arp only), 1 = run (drums in), 2 = turbo.
   */
  private note(step: number, t: number, spb: number) {
    const bus = this.musicBus;
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    // chord tones (relative) per bar: Fmaj7, G6, Em7, Am7
    const roots = [53, 55, 52, 57];
    const chords = [
      [0, 4, 7, 11],
      [0, 4, 7, 9],
      [0, 3, 7, 10],
      [0, 3, 7, 10],
    ];
    const bar = Math.floor(step / 16) % 4;
    const root = roots[bar];
    const ch = chords[bar];
    const s = step % 16;
    const run = this.intensity >= 1;
    // pads: whole-bar chord, gentle attack
    if (s === 0) for (const iv of ch) this.pad(root + 12 + iv, t, spb * 16.5, run ? 0.022 : 0.03);
    // round bass: root on 1, fifth on the "and" of 2, octave pickup
    if (s === 0 || s === 6 || s === 10 || s === 14) {
      const m = root - 12 + (s === 6 ? 7 : s === 14 ? 12 : 0);
      this.osc('triangle', hz(m), hz(m), t, spb * (s === 0 ? 3.5 : 1.8), run ? 0.16 : 0.1, this.musicTone);
    }
    // arpeggio (8ths, up-down through the chord), sparkle an octave up in turbo
    if (s % 2 === 0) {
      const seq = [0, 1, 2, 3, 2, 1, 2, 3];
      const m = root + 24 + ch[seq[(s / 2) % 8]] + (this.intensity >= 2 ? 12 : 0);
      this.pluck(m, t, run ? 0.05 : 0.04);
    }
    if (!run) return;
    // soft kick on 1 and 3 (four-on-the-floor only in turbo)
    if (s % 8 === 0 || (this.intensity >= 2 && s % 4 === 0)) this.osc('sine', 110, 42, t, 0.22, 0.32, bus);
    // light shaker on off-beats
    if (s % 4 === 2) this.noise(t, 0.05, 0.05, 7000, 7000, 0.8, 'highpass', bus);
    // brushed clap on 2 and 4
    if (s === 4 || s === 12) this.noise(t, 0.18, 0.09, 1400, 900, 0.7, 'bandpass', bus);
  }
}


// =============================================================== baked synthesis (v3 native)
/** exponential segment from v0 at t0 to v1 at t1 (Web Audio exponentialRamp) */
function expSeg(t: number, t0: number, t1: number, v0: number, v1: number) {
  if (t <= t0) return v0;
  if (t >= t1) return v1;
  return v0 * Math.pow(v1 / v0, (t - t0) / (t1 - t0));
}
/** 0.0001 → vol over `a`, → 0.0001 at `dur` (the recipes' envelope) */
function envAD(t: number, a: number, dur: number, vol: number) {
  if (t < 0) return 0;
  if (t < a) return expSeg(t, 0, a, 0.0001, vol);
  if (t < dur) return expSeg(t, a, dur, vol, 0.0001);
  return 0;
}
/** band-limited step correction (PolyBLEP) — kills the aliasing that sounds like crackle */
function blep(t: number, dt: number) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}
function bakeOsc(out: Float32Array, sr: number, type: string, f0: number, f1: number, t0: number, dur: number, env: (t: number) => number) {
  const i0 = Math.max(0, Math.floor(t0 * sr));
  const i1 = Math.min(out.length, Math.ceil((t0 + dur + 0.02) * sr));
  let ph = 0;
  let tri = 0;
  const glide = f1 !== f0 && dur > 0;
  // envelope + glide are evaluated every 16 samples and interpolated (Math.pow per sample is slow on phones)
  let e0 = 0,
    e1 = 0,
    f = f0,
    nextK = i0;
  for (let i = i0; i < i1; i++) {
    const t = i / sr - t0;
    if (i >= nextK) {
      e0 = env(t);
      e1 = env(t + 16 / sr);
      if (glide) f = f0 * Math.pow(f1 / f0, Math.min(1, t / dur));
      nextK = i + 16;
    }
    const dt = f / sr;
    let v: number;
    if (type === 'sine') v = Math.sin(ph * 2 * Math.PI);
    else if (type === 'sawtooth') v = 2 * ph - 1 - blep(ph, dt);
    else {
      // square (and the triangle integrates it)
      let sq = ph < 0.5 ? 1 : -1;
      sq += blep(ph, dt);
      sq -= blep((ph + 0.5) % 1, dt);
      if (type === 'square') v = sq;
      else {
        tri = dt * sq + (1 - dt) * tri;
        v = tri * 4;
      }
    }
    // fade the last 4 ms so a voice never ends on a step
    const tailK = Math.min(1, (t0 + dur + 0.02 - i / sr) / 0.004);
    out[i] += v * (e0 + (e1 - e0) * (1 - (nextK - i) / 16)) * tailK;
    ph += dt;
    if (ph >= 1) ph -= 1;
  }
}
/** white noise through a gliding TPT state-variable filter */
function bakeNoise(out: Float32Array, sr: number, t0: number, dur: number, vol: number, f0: number, f1: number, q: number, type: string) {
  const i0 = Math.max(0, Math.floor(t0 * sr));
  const i1 = Math.min(out.length, Math.ceil((t0 + dur + 0.02) * sr));
  let ic1 = 0,
    ic2 = 0;
  const k = 1 / Math.max(0.05, q);
  const nyq = sr * 0.45;
  let a1 = 0,
    a2 = 0,
    a3 = 0,
    ev = 0;
  for (let i = i0; i < i1; i++) {
    const t = i / sr - t0;
    if ((i - i0) % 16 === 0) {
      // filter coefficients + envelope every 16 samples (tan / pow per sample is slow on phones)
      const fc = Math.min(nyq, f0 * Math.pow(Math.max(30, f1) / f0, Math.min(1, t / Math.max(0.001, dur))));
      const g = Math.tan((Math.PI * fc) / sr);
      a1 = 1 / (1 + g * (g + k));
      a2 = g * a1;
      a3 = g * a2;
      ev = envAD(t + 8 / sr, 0.01, dur, vol);
    }
    const v0 = Math.random() * 2 - 1;
    const v3 = v0 - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    const y = type === 'lowpass' ? v2 : type === 'highpass' ? v0 - k * v1 - v2 : v1;
    const tailK = Math.min(1, (t0 + dur + 0.02 - i / sr) / 0.004);
    out[i] += y * (t < 0.012 ? envAD(t, 0.01, dur, vol) : ev) * tailK;
  }
}
/** dotted-eighth echo with damped feedback, wrapping around the loop */
function addEcho(out: Float32Array, send: Float32Array, sr: number, delay: number, fb: number, wet: number, dampHz: number) {
  const n = out.length;
  const d = Math.round(delay * sr);
  const line = new Float32Array(n);
  const a = 1 - Math.exp((-2 * Math.PI * dampHz) / sr);
  let lp = 0;
  // two passes so the feedback tail wraps across the loop seam
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < n; i++) {
      const j = (i - d + n) % n;
      lp += a * (line[j] - lp);
      line[i] = send[i] + lp * fb;
    }
  for (let i = 0; i < n; i++) out[i] += line[(i - d + n) % n] * wet;
}
/** one-pole lowpass in place (the music's warm tone), run twice so the loop seam matches */
function lowpass(x: Float32Array, sr: number, hz: number) {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / sr);
  let y = 0;
  for (let i = 0; i < x.length; i++) y += a * (x[i] - y);
  for (let i = 0; i < x.length; i++) {
    y += a * (x[i] - y);
    x[i] = y;
  }
}
const softClip = (v: number) => (v > 1 || v < -1 ? Math.tanh(v) : v);
/** drop trailing silence (keeps buffers small) */
function trimTail(x: Float32Array) {
  let n = x.length;
  while (n > 1 && Math.abs(x[n - 1]) < 1e-4) n--;
  return x.subarray(0, Math.min(x.length, n + 64));
}
