const MUTE_KEY = 'gully_clash_muted_v1';
const VOLUME_KEY = 'arenax_sound_volume_v1';

class SoundFXEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private muted: boolean = false;
  private volume: number = 0.8;
  private listeners = new Set<() => void>();
  private unlockBound = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === 'true';
      const savedVol = localStorage.getItem(VOLUME_KEY);
      if (savedVol !== null) {
        const parsed = Number(savedVol);
        if (!Number.isNaN(parsed)) {
          this.volume = Math.max(0, Math.min(1, parsed));
        }
      }
    } catch {
      this.muted = false;
      this.volume = 0.8;
    }

    this.bindFirstGestureUnlock();
  }

  private bindFirstGestureUnlock(): void {
    if (this.unlockBound || typeof window === 'undefined') return;
    this.unlockBound = true;

    const unlock = () => {
      const ctx = this.initAudioGraph();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        // Play a 1-sample silent buffer to unlock Web Audio on iOS Safari cleanly
        try {
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        } catch {
          // Ignore unlock errors
        }
      }
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };

    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('touchstart', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  private initAudioGraph(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;

      // DynamicsCompressor prevents clipping/distortion during overlapping stadium sounds
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private ensureContext(): { ctx: AudioContext; out: AudioNode } | null {
    if (this.muted || this.volume <= 0.001) return null;
    const ctx = this.initAudioGraph();
    if (!ctx || !this.masterGain) return null;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return { ctx, out: this.masterGain };
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb());
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(val: boolean): void {
    this.muted = val;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(val ? 0 : this.volume, this.ctx.currentTime, 0.015);
    }
    try {
      localStorage.setItem(MUTE_KEY, String(val));
    } catch {
      // Ignore storage quota errors
    }
    this.notify();
  }

  public setVolume(val: number): void {
    const clamped = Math.max(0, Math.min(1, val));
    this.volume = clamped;
    if (clamped > 0 && this.muted) {
      this.muted = false;
      try {
        localStorage.setItem(MUTE_KEY, 'false');
      } catch {
        // Ignore
      }
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.015
      );
    }
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      // Ignore
    }
    this.notify();
  }

  public toggleMute(): boolean {
    const next = !this.muted;
    this.setMuted(next);
    if (!next) {
      this.playTap();
    }
    return next;
  }

  // ==================== UI & LOBBY ====================

  public playTap(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(560, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.036);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.048);
  }

  public playCoinFlip(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const clinks = [0, 0.14, 0.28, 0.44, 0.62, 0.84];
    clinks.forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const base = 1850 + idx * 145;
      osc.frequency.setValueAtTime(base, now + offset);
      osc.frequency.exponentialRampToValueAtTime(base * 1.25, now + offset + 0.05);
      gain.gain.setValueAtTime(0.1, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + offset);
      osc.stop(now + offset + 0.09);
    });
  }

  public playVictoryFanfare(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.085;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.5);
    });

    this.playCrowdCheer('victory');
  }

  public playDefeatBuzzer(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const notes = [240, 185, 130];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const t = now + idx * 0.14;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.72, t + 0.16);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(680, t);

      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(lp);
      lp.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  // ==================== HAND CRICKET ====================

  public playPowerUp(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    // Subtle rising air whoosh
    const len = Math.floor(ctx.sampleRate * 0.24);
    const nBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = nBuf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, now);
    bp.frequency.exponentialRampToValueAtTime(2400, now + 0.22);
    bp.Q.setValueAtTime(2.2, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.16, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    noise.connect(bp);
    bp.connect(nGain);
    nGain.connect(out);
    noise.start(now);

    // Rising power chime
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  public playBatHit(runs: number): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.065);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(runs >= 4 ? 1950 : 1380, now);
    filter.Q.setValueAtTime(1.8, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(runs >= 4 ? 0.38 : 0.24, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.062);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(out);
    noise.start(now);

    // Willow punch
    const thud = ctx.createOscillator();
    const tGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(runs >= 6 ? 215 : 165, now);
    thud.frequency.exponentialRampToValueAtTime(55, now + 0.085);
    tGain.gain.setValueAtTime(runs >= 4 ? 0.28 : 0.17, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.092);
    thud.connect(tGain);
    tGain.connect(out);
    thud.start(now);
    thud.stop(now + 0.098);

    if (runs >= 4) {
      this.playCrowdCheer(runs >= 6 ? 'big' : 'medium');
    }
  }

  public playCrowdCheer(intensity: 'medium' | 'big' | 'victory'): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const duration = intensity === 'victory' ? 1.15 : intensity === 'big' ? 0.72 : 0.45;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.linearRampToValueAtTime(1250, now + duration * 0.35);
    filter.frequency.linearRampToValueAtTime(800, now + duration);
    filter.Q.setValueAtTime(0.9, now);

    const gain = ctx.createGain();
    const peak = intensity === 'victory' ? 0.24 : intensity === 'big' ? 0.18 : 0.11;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.09);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    noise.start(now);

    if (intensity === 'big') {
      [587.33, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const cGain = ctx.createGain();
        osc.type = 'triangle';
        const start = now + idx * 0.05;
        osc.frequency.setValueAtTime(freq, start);
        cGain.gain.setValueAtTime(0.08, start);
        cGain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.connect(cGain);
        cGain.connect(out);
        osc.start(start);
        osc.stop(start + 0.32);
      });
    }
  }

  public playWicket(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.34);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(900, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.38);

    // Wooden stump rattle
    [0.02, 0.075, 0.13].forEach((offset, i) => {
      const rattle = ctx.createOscillator();
      const rGain = ctx.createGain();
      rattle.type = 'square';
      rattle.frequency.setValueAtTime(420 - i * 65, now + offset);
      rattle.frequency.exponentialRampToValueAtTime(120, now + offset + 0.045);
      rGain.gain.setValueAtTime(0.12, now + offset);
      rGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
      rattle.connect(rGain);
      rGain.connect(out);
      rattle.start(now + offset);
      rattle.stop(now + offset + 0.055);
    });
  }

  public playFreeHitSave(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.18);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // ==================== NEON CARROM ====================

  public playCarromClack(intensity: number = 1): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const clamped = Math.max(0.15, Math.min(1.4, intensity));

    // Crisp wooden striker transient
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(860 + clamped * 340, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.042);
    gain.gain.setValueAtTime(Math.min(0.28, 0.06 + clamped * 0.15), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.052);

    // Subtle hardwood click overtone
    const clickLen = Math.floor(ctx.sampleRate * 0.014);
    const nBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
    const data = nBuf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (clickLen * 0.3));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2100 + clamped * 500, now);
    bp.Q.setValueAtTime(2.5, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(Math.min(0.22, clamped * 0.14), now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    noise.connect(bp);
    bp.connect(nGain);
    nGain.connect(out);
    noise.start(now);
  }

  public playCarromPocket(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    // Deep pocket-drop thud
    const thud = ctx.createOscillator();
    const tGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(210, now);
    thud.frequency.exponentialRampToValueAtTime(62, now + 0.16);
    tGain.gain.setValueAtTime(0.28, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    thud.connect(tGain);
    tGain.connect(out);
    thud.start(now);
    thud.stop(now + 0.19);

    // Rim rattle drop chime
    const rim = ctx.createOscillator();
    const rGain = ctx.createGain();
    rim.type = 'triangle';
    rim.frequency.setValueAtTime(520, now + 0.02);
    rim.frequency.exponentialRampToValueAtTime(190, now + 0.12);
    rGain.gain.setValueAtTime(0.11, now + 0.02);
    rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    rim.connect(rGain);
    rGain.connect(out);
    rim.start(now + 0.02);
    rim.stop(now + 0.15);
  }

  // ==================== CURVE-SHOT PENALTY ====================

  public playWhistle(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2850, now);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(36, now);
    lfoGain.gain.setValueAtTime(115, now);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.setValueAtTime(0.12, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.31);

    osc.connect(gain);
    gain.connect(out);
    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.32);
    osc.stop(now + 0.32);
  }

  public playKick(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.exponentialRampToValueAtTime(44, now + 0.12);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playCurveWhoosh(spinIntensity: number = 0.6): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const dur = 0.32;
    const len = Math.floor(ctx.sampleRate * dur);
    const nBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = nBuf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = nBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(340, now);
    bp.frequency.exponentialRampToValueAtTime(1450 + spinIntensity * 700, now + dur * 0.65);
    bp.frequency.exponentialRampToValueAtTime(520, now + dur);
    bp.Q.setValueAtTime(2.6, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08 + Math.min(0.14, spinIntensity * 0.12), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(out);
    noise.start(now);
  }

  public playNetSwish(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const dur = 0.26;
    const len = Math.floor(ctx.sampleRate * dur);
    const nBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = nBuf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.exp(-i / (len * 0.45));
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = nBuf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1900, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(out);
    noise.start(now);
  }

  public playSave(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  // ==================== ROYAL & CHAOS CHESS ====================

  public playChessSlide(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    // Warm wooden board thud
    const thud = ctx.createOscillator();
    const gain = ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(210, now);
    thud.frequency.exponentialRampToValueAtTime(88, now + 0.055);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    thud.connect(gain);
    gain.connect(out);
    thud.start(now);
    thud.stop(now + 0.07);
  }

  public playChessCapture(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    // Sharp wooden capture snap
    const snap = ctx.createOscillator();
    const sGain = ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(520, now);
    snap.frequency.exponentialRampToValueAtTime(125, now + 0.065);
    sGain.gain.setValueAtTime(0.3, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.072);
    snap.connect(sGain);
    sGain.connect(out);
    snap.start(now);
    snap.stop(now + 0.078);

    const len = Math.floor(ctx.sampleRate * 0.028);
    const nBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = nBuf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.28));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800, now);
    bp.Q.setValueAtTime(1.8, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.24, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    noise.connect(bp);
    bp.connect(nGain);
    nGain.connect(out);
    noise.start(now);
  }

  public playChessCheck(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    [698.46, 932.33].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }
}

export const soundFX = new SoundFXEngine();
