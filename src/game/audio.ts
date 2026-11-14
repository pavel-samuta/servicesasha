import { MonsterKind } from './types';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private lastFishSpawnMs = 0;
  private lastShotMs = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.8);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  public unlock() {
    this.ensureContext();
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playHarpoon(isCrit = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isCrit ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isCrit ? 520 : 380, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playHit(isKill = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isKill ? 'square' : 'sine';
    osc.frequency.setValueAtTime(isKill ? 210 : 170, now);
    osc.frequency.exponentialRampToValueAtTime(isKill ? 55 : 75, now + (isKill ? 0.16 : 0.07));

    gain.gain.setValueAtTime(isKill ? 0.11 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isKill ? 0.17 : 0.08));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isKill ? 0.18 : 0.09));
  }

  public playMonsterSpawn(kind: MonsterKind) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const nowMs = performance.now();

    if (kind === 'leviathan') {
      // Deep abyssal foghorn roar + dark water surge
      const now = ctx.currentTime;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240, now);
      filter.frequency.exponentialRampToValueAtTime(85, now + 0.72);
      filter.Q.value = 3.5;
      filter.connect(ctx.destination);

      for (const baseFreq of [56, 59.5]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(34, now + 0.72);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.11, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
        osc.connect(gain);
        gain.connect(filter);
        osc.start(now);
        osc.stop(now + 0.78);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = this.ensureNoiseBuffer(ctx);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.09, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      noise.connect(nGain);
      nGain.connect(filter);
      noise.start(now);
      noise.stop(now + 0.68);
      return;
    }

    if (kind === 'croc_gena') {
      // Sinister forest twig-rustle + reptilian rasp + ominous minor stinger
      const now = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = this.ensureNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1100, now);
      bp.frequency.exponentialRampToValueAtTime(420, now + 0.34);
      bp.Q.value = 2.2;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.09, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.36);

      const growl = ctx.createOscillator();
      const gGain = ctx.createGain();
      growl.type = 'sawtooth';
      growl.frequency.setValueAtTime(112, now + 0.04);
      growl.frequency.exponentialRampToValueAtTime(58, now + 0.38);
      gGain.gain.setValueAtTime(0.09, now + 0.04);
      gGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      growl.connect(gGain);
      gGain.connect(ctx.destination);
      growl.start(now + 0.04);
      growl.stop(now + 0.42);
      return;
    }

    // Throttle regular fish spawn splashes so rapid waves stay atmospheric, not noisy
    if (nowMs - this.lastFishSpawnMs < 240) return;
    this.lastFishSpawnMs = nowMs;

    const now = ctx.currentTime;
    const isMinnow = kind === 'minnow';
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(isMinnow ? 140 : 96, now);
    sub.frequency.exponentialRampToValueAtTime(isMinnow ? 65 : 44, now + 0.22);
    subGain.gain.setValueAtTime(isMinnow ? 0.04 : 0.075, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.25);

    const noise = ctx.createBufferSource();
    noise.buffer = this.ensureNoiseBuffer(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(460, now);
    lp.frequency.exponentialRampToValueAtTime(110, now + 0.25);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(isMinnow ? 0.025 : 0.05, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    noise.connect(lp);
    lp.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.27);
  }

  public playMonsterLunge(isLeviathan = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.ensureNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isLeviathan ? 220 : 380, now);
    bp.frequency.exponentialRampToValueAtTime(isLeviathan ? 620 : 980, now + 0.14);
    bp.frequency.exponentialRampToValueAtTime(140, now + 0.34);
    bp.Q.value = 2.0;

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(isLeviathan ? 0.14 : 0.09, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    noise.connect(bp);
    bp.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.38);

    const snarl = ctx.createOscillator();
    const sGain = ctx.createGain();
    snarl.type = 'sawtooth';
    snarl.frequency.setValueAtTime(isLeviathan ? 95 : 195, now);
    snarl.frequency.exponentialRampToValueAtTime(isLeviathan ? 42 : 74, now + 0.26);
    sGain.gain.setValueAtTime(isLeviathan ? 0.11 : 0.065, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    snarl.connect(sGain);
    sGain.connect(ctx.destination);
    snarl.start(now);
    snarl.stop(now + 0.3);
  }

  public playMonsterShot(isBitcoin = false, isLeviathan = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const nowMs = performance.now();
    if (!isBitcoin && !isLeviathan && nowMs - this.lastShotMs < 90) return;
    this.lastShotMs = nowMs;

    const now = ctx.currentTime;
    if (isBitcoin) {
      // Sinister metallic crypto-clink + low villainous snap
      const thump = ctx.createOscillator();
      const tGain = ctx.createGain();
      thump.type = 'sawtooth';
      thump.frequency.setValueAtTime(170, now);
      thump.frequency.exponentialRampToValueAtTime(64, now + 0.14);
      tGain.gain.setValueAtTime(0.08, now);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      thump.connect(tGain);
      tGain.connect(ctx.destination);
      thump.start(now);
      thump.stop(now + 0.16);

      const coin = ctx.createOscillator();
      const cGain = ctx.createGain();
      coin.type = 'triangle';
      coin.frequency.setValueAtTime(1320, now);
      coin.frequency.setValueAtTime(1760, now + 0.035);
      coin.frequency.exponentialRampToValueAtTime(980, now + 0.18);
      cGain.gain.setValueAtTime(0.065, now);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      coin.connect(cGain);
      cGain.connect(ctx.destination);
      coin.start(now);
      coin.stop(now + 0.2);
      return;
    }

    // Murky abyssal energy discharge
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isLeviathan ? 150 : 270, now);
    osc.frequency.exponentialRampToValueAtTime(isLeviathan ? 52 : 95, now + 0.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(920, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.2);

    gain.gain.setValueAtTime(isLeviathan ? 0.11 : 0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playThunder() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Distant rolling thunder rumble using filtered noise + deep sub-bass
    const noise = ctx.createBufferSource();
    noise.buffer = this.ensureNoiseBuffer(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(340, now);
    lp.frequency.exponentialRampToValueAtTime(75, now + 0.78);
    lp.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.78);

    noise.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.8);

    const sub = ctx.createOscillator();
    const sGain = ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(64, now + 0.03);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.65);
    sGain.gain.setValueAtTime(0.08, now + 0.03);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    sub.connect(sGain);
    sGain.connect(ctx.destination);
    sub.start(now + 0.03);
    sub.stop(now + 0.7);
  }

  public playDash() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.25);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  public playDepthCharge() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playPickup(kind: 'coin' | 'repair' | 'overdrive') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    if (kind === 'coin') {
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.setValueAtTime(880, now + 0.05);
    } else if (kind === 'repair') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554, now + 0.06);
      osc.frequency.setValueAtTime(659, now + 0.12);
    } else {
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(784, now + 0.06);
      osc.frequency.setValueAtTime(1046, now + 0.12);
    }

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playPlayerHurt() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.linearRampToValueAtTime(62, now + 0.2);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playWaveClear() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [392, 493.88, 587.33, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.28);
    });
  }

  public playGameOver() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [293.66, 261.63, 220, 164.81];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const start = now + i * 0.14;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.34);
    });
  }

  public playVictory() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [392, 493.88, 587.33, 783.99, 987.77];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + i * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }

  public playFishermanCall(seed = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitchShift = 1 + ((seed % 5) - 2) * 0.06;

    // Two-syllable distant shore hail ("Э-гей!")
    const notes = [
      { start: 0, dur: 0.11, f1: 250 * pitchShift, f2: 330 * pitchShift, vol: 0.055 },
      { start: 0.13, dur: 0.19, f1: 360 * pitchShift, f2: 295 * pitchShift, vol: 0.07 },
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f1, now + n.start);
      osc.frequency.linearRampToValueAtTime(n.f2, now + n.start + n.dur);

      filter.type = 'bandpass';
      filter.frequency.value = 680;
      filter.Q.value = 1.4;

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.linearRampToValueAtTime(n.vol, now + n.start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    }
  }
}

export const soundEngine = new SoundEngine();
