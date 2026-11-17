import { GameSettings } from '../types/game';

/**
 * 100% Procedural Web Audio API synthesizer for engine harmonics, tire screech,
 * nitro jet boost, collisions, countdown tones, and UI clicks. Zero external files.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private screechSource: AudioBufferSourceNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private screechGain: GainNode | null = null;

  private nitroSource: AudioBufferSourceNode | null = null;
  private nitroFilter: BiquadFilterNode | null = null;
  private nitroGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private engineActive = false;

  private masterVolume = 0.7;
  private sfxVolume = 0.8;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public applySettings(settings: GameSettings): void {
    this.masterVolume = settings.masterVolume;
    this.sfxVolume = settings.sfxVolume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.masterVolume,
        this.ctx.currentTime,
        0.04,
      );
    }
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(
        this.sfxVolume,
        this.ctx.currentTime,
        0.04,
      );
    }
  }

  public startRaceAudio(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.engineActive) return;

    this.engineActive = true;
    const now = ctx.currentTime;

    // Dual-oscillator sport engine synth
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';
    this.engineOsc1.frequency.setValueAtTime(55, now);
    this.engineOsc2.frequency.setValueAtTime(110, now);

    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(320, now);
    this.engineFilter.Q.value = 3.5;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.08, now);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc1.start(now);
    this.engineOsc2.start(now);

    // Continuous filtered noise for tire screech & nitro
    if (this.noiseBuffer) {
      this.screechSource = ctx.createBufferSource();
      this.screechSource.buffer = this.noiseBuffer;
      this.screechSource.loop = true;
      this.screechFilter = ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 1450;
      this.screechFilter.Q.value = 6.0;
      this.screechGain = ctx.createGain();
      this.screechGain.gain.value = 0;

      this.screechSource.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.sfxGain);
      this.screechSource.start(now);

      this.nitroSource = ctx.createBufferSource();
      this.nitroSource.buffer = this.noiseBuffer;
      this.nitroSource.loop = true;
      this.nitroFilter = ctx.createBiquadFilter();
      this.nitroFilter.type = 'bandpass';
      this.nitroFilter.frequency.value = 620;
      this.nitroFilter.Q.value = 1.6;
      this.nitroGain = ctx.createGain();
      this.nitroGain.gain.value = 0;

      this.nitroSource.connect(this.nitroFilter);
      this.nitroFilter.connect(this.nitroGain);
      this.nitroGain.connect(this.sfxGain);
      this.nitroSource.start(now);
    }
  }

  public updateRaceAudio(
    rpmRatio: number,
    throttle: boolean,
    isDrifting: boolean,
    isNitro: boolean,
    isBraking: boolean,
  ): void {
    if (!this.ctx || !this.engineActive) return;
    const now = this.ctx.currentTime;
    const clampedRpm = Math.max(0, Math.min(1.15, rpmRatio));
    const baseFreq = 48 + clampedRpm * 145 + (isNitro ? 35 : 0);

    if (this.engineOsc1 && this.engineOsc2 && this.engineFilter && this.engineGain) {
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.05);
      this.engineFilter.frequency.setTargetAtTime(
        260 + clampedRpm * 1150 + (throttle ? 240 : 0),
        now,
        0.06,
      );
      this.engineGain.gain.setTargetAtTime(
        throttle ? 0.13 + clampedRpm * 0.06 : 0.07,
        now,
        0.06,
      );
    }

    if (this.screechGain) {
      const targetScreech = isDrifting ? 0.11 : isBraking ? 0.04 : 0;
      this.screechGain.gain.setTargetAtTime(targetScreech, now, 0.06);
    }

    if (this.nitroGain && this.nitroFilter) {
      this.nitroGain.gain.setTargetAtTime(isNitro ? 0.18 : 0, now, 0.05);
      this.nitroFilter.frequency.setTargetAtTime(isNitro ? 920 : 500, now, 0.08);
    }
  }

  public stopRaceAudio(): void {
    if (!this.engineActive) return;
    this.engineActive = false;
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      this.screechSource?.stop();
      this.nitroSource?.stop();
    } catch {
      // already stopped
    }
    this.engineOsc1?.disconnect();
    this.engineOsc2?.disconnect();
    this.engineFilter?.disconnect();
    this.engineGain?.disconnect();
    this.screechSource?.disconnect();
    this.screechFilter?.disconnect();
    this.screechGain?.disconnect();
    this.nitroSource?.disconnect();
    this.nitroFilter?.disconnect();
    this.nitroGain?.disconnect();

    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.screechSource = null;
    this.screechFilter = null;
    this.screechGain = null;
    this.nitroSource = null;
    this.nitroFilter = null;
    this.nitroGain = null;
  }

  public playCollision(intensity = 0.7): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0.2, Math.min(1, intensity));

    // Low impact thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 * clamped + 50, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);
    gain.gain.setValueAtTime(0.32 * clamped, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.23);

    // Metallic crunch noise burst
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 950;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.22 * clamped, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.17);
    }
  }

  public playCountdownBeep(isGo: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isGo ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.38 : 0.18));
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.4 : 0.2));
  }

  public playFinishFanfare(won: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [440, 523.25, 659.25];
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.36);
    });
  }

  public playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.045);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }
}

export const soundEngine = new SoundEngine();
