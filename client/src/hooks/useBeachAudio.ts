import { useEffect, useRef, useState, useCallback } from "react";

class BeachAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private waveInterval: number | null = null;
  private ambientIntervals: number[] = [];
  private isPlaying = false;
  private continuousWaveSource: AudioBufferSourceNode | null = null;

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.ctx.destination);
  }

  private createNoise(duration: number, type: "white" | "pink" | "brown" = "white") {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const samples = duration * sampleRate;
    const buffer = this.ctx.createBuffer(2, samples, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      let lastOut = 0;

      for (let i = 0; i < samples; i++) {
        const white = Math.random() * 2 - 1;
        if (type === "pink") {
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        } else if (type === "brown") {
          lastOut = (lastOut + (0.02 * white)) / 1.02;
          data[i] = lastOut * 3.5;
        } else {
          data[i] = white;
        }
      }
    }
    return buffer;
  }

  startContinuousOcean() {
    if (!this.ctx || !this.masterGain) return;

    const duration = 10;
    const buffer = this.createNoise(duration, "brown");
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const lpFilter = this.ctx.createBiquadFilter();
    lpFilter.type = "lowpass";
    lpFilter.frequency.value = 180;
    lpFilter.Q.value = 0.5;

    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = "highpass";
    hpFilter.frequency.value = 30;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.25;

    source.connect(hpFilter);
    hpFilter.connect(lpFilter);
    lpFilter.connect(gain);
    gain.connect(this.masterGain);
    source.start();

    this.continuousWaveSource = source;
  }

  playWaveLap() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const duration = 5 + Math.random() * 2;
    const buffer = this.createNoise(duration, "pink");
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const lpFilter = this.ctx.createBiquadFilter();
    lpFilter.type = "lowpass";
    lpFilter.frequency.setValueAtTime(120, now);
    lpFilter.frequency.linearRampToValueAtTime(350, now + 1.0);
    lpFilter.frequency.linearRampToValueAtTime(500, now + 1.8);
    lpFilter.frequency.linearRampToValueAtTime(280, now + 3.0);
    lpFilter.frequency.linearRampToValueAtTime(100, now + duration);
    lpFilter.Q.value = 0.7;

    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = "highpass";
    hpFilter.frequency.value = 40;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.8);
    gain.gain.linearRampToValueAtTime(0.15, now + 1.5);
    gain.gain.linearRampToValueAtTime(0.18, now + 2.0);
    gain.gain.linearRampToValueAtTime(0.12, now + 3.0);
    gain.gain.linearRampToValueAtTime(0.06, now + 4.0);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    const foamBuffer = this.createNoise(duration, "white");
    if (!foamBuffer) return;
    const foamSource = this.ctx.createBufferSource();
    foamSource.buffer = foamBuffer;

    const foamFilter = this.ctx.createBiquadFilter();
    foamFilter.type = "bandpass";
    foamFilter.frequency.setValueAtTime(2000, now);
    foamFilter.frequency.linearRampToValueAtTime(4000, now + 1.8);
    foamFilter.frequency.linearRampToValueAtTime(2500, now + 3.5);
    foamFilter.frequency.linearRampToValueAtTime(1500, now + duration);
    foamFilter.Q.value = 0.3;

    const foamGain = this.ctx.createGain();
    foamGain.gain.setValueAtTime(0, now);
    foamGain.gain.linearRampToValueAtTime(0, now + 1.2);
    foamGain.gain.linearRampToValueAtTime(0.04, now + 2.0);
    foamGain.gain.linearRampToValueAtTime(0.06, now + 2.5);
    foamGain.gain.linearRampToValueAtTime(0.03, now + 3.5);
    foamGain.gain.linearRampToValueAtTime(0, now + duration);

    source.connect(hpFilter);
    hpFilter.connect(lpFilter);
    lpFilter.connect(gain);
    gain.connect(this.masterGain);

    foamSource.connect(foamFilter);
    foamFilter.connect(foamGain);
    foamGain.connect(this.masterGain);

    source.start(now);
    source.stop(now + duration);
    foamSource.start(now);
    foamSource.stop(now + duration);
  }

  playSeagull() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const calls = 1 + Math.floor(Math.random() * 3);
    const callType = Math.random();

    for (let i = 0; i < calls; i++) {
      const gap = 0.4 + Math.random() * 0.3;
      const t = now + i * gap;

      if (callType < 0.5) {
        this.seagullLongCry(t);
      } else {
        this.seagullShortSquawk(t);
      }
    }
  }

  private seagullLongCry(t: number) {
    if (!this.ctx || !this.masterGain) return;

    const dur = 0.6 + Math.random() * 0.3;
    const baseFreq = 1800 + Math.random() * 400;

    const carrier = this.ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(baseFreq * 0.6, t);
    carrier.frequency.linearRampToValueAtTime(baseFreq, t + dur * 0.15);
    carrier.frequency.setValueAtTime(baseFreq, t + dur * 0.2);
    carrier.frequency.linearRampToValueAtTime(baseFreq * 1.15, t + dur * 0.35);
    carrier.frequency.linearRampToValueAtTime(baseFreq * 0.95, t + dur * 0.5);
    carrier.frequency.linearRampToValueAtTime(baseFreq * 0.6, t + dur * 0.8);
    carrier.frequency.linearRampToValueAtTime(baseFreq * 0.4, t + dur);

    const vibrato = this.ctx.createOscillator();
    vibrato.type = "sine";
    vibrato.frequency.value = 25 + Math.random() * 15;
    const vibratoGain = this.ctx.createGain();
    vibratoGain.gain.setValueAtTime(0, t);
    vibratoGain.gain.linearRampToValueAtTime(80, t + dur * 0.2);
    vibratoGain.gain.setValueAtTime(80, t + dur * 0.6);
    vibratoGain.gain.linearRampToValueAtTime(30, t + dur);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(carrier.frequency);

    const harmonic = this.ctx.createOscillator();
    harmonic.type = "sine";
    harmonic.frequency.setValueAtTime(baseFreq * 1.2, t);
    harmonic.frequency.linearRampToValueAtTime(baseFreq * 2.0, t + dur * 0.15);
    harmonic.frequency.linearRampToValueAtTime(baseFreq * 2.3, t + dur * 0.35);
    harmonic.frequency.linearRampToValueAtTime(baseFreq * 1.9, t + dur * 0.5);
    harmonic.frequency.linearRampToValueAtTime(baseFreq * 1.2, t + dur * 0.8);
    harmonic.frequency.linearRampToValueAtTime(baseFreq * 0.8, t + dur);

    const harmonicGain = this.ctx.createGain();
    harmonicGain.gain.value = 0.3;

    const nasalFilter = this.ctx.createBiquadFilter();
    nasalFilter.type = "peaking";
    nasalFilter.frequency.value = baseFreq * 1.5;
    nasalFilter.Q.value = 5;
    nasalFilter.gain.value = 8;

    const shapeFilter = this.ctx.createBiquadFilter();
    shapeFilter.type = "bandpass";
    shapeFilter.frequency.value = baseFreq;
    shapeFilter.Q.value = 1.5;

    const envGain = this.ctx.createGain();
    envGain.gain.setValueAtTime(0, t);
    envGain.gain.linearRampToValueAtTime(0.045, t + dur * 0.08);
    envGain.gain.setValueAtTime(0.045, t + dur * 0.15);
    envGain.gain.linearRampToValueAtTime(0.055, t + dur * 0.25);
    envGain.gain.setValueAtTime(0.055, t + dur * 0.5);
    envGain.gain.linearRampToValueAtTime(0.03, t + dur * 0.75);
    envGain.gain.linearRampToValueAtTime(0, t + dur);

    const merger = this.ctx.createGain();
    carrier.connect(merger);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(merger);
    merger.connect(nasalFilter);
    nasalFilter.connect(shapeFilter);
    shapeFilter.connect(envGain);
    envGain.connect(this.masterGain!);

    carrier.start(t);
    carrier.stop(t + dur + 0.05);
    vibrato.start(t);
    vibrato.stop(t + dur + 0.05);
    harmonic.start(t);
    harmonic.stop(t + dur + 0.05);
  }

  private seagullShortSquawk(t: number) {
    if (!this.ctx || !this.masterGain) return;

    const dur = 0.25 + Math.random() * 0.15;
    const baseFreq = 2200 + Math.random() * 600;

    const carrier = this.ctx.createOscillator();
    carrier.type = "sawtooth";
    carrier.frequency.setValueAtTime(baseFreq, t);
    carrier.frequency.linearRampToValueAtTime(baseFreq * 1.4, t + dur * 0.3);
    carrier.frequency.linearRampToValueAtTime(baseFreq * 0.7, t + dur);

    const vibrato = this.ctx.createOscillator();
    vibrato.type = "sine";
    vibrato.frequency.value = 35;
    const vibGain = this.ctx.createGain();
    vibGain.gain.value = 100;
    vibrato.connect(vibGain);
    vibGain.connect(carrier.frequency);

    const bpFilter = this.ctx.createBiquadFilter();
    bpFilter.type = "bandpass";
    bpFilter.frequency.value = baseFreq;
    bpFilter.Q.value = 3;

    const envGain = this.ctx.createGain();
    envGain.gain.setValueAtTime(0, t);
    envGain.gain.linearRampToValueAtTime(0.04, t + 0.02);
    envGain.gain.setValueAtTime(0.04, t + dur * 0.4);
    envGain.gain.linearRampToValueAtTime(0, t + dur);

    carrier.connect(bpFilter);
    bpFilter.connect(envGain);
    envGain.connect(this.masterGain!);

    carrier.start(t);
    carrier.stop(t + dur + 0.02);
    vibrato.start(t);
    vibrato.stop(t + dur + 0.02);
  }

  playCrabClick() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const clicks = 2 + Math.floor(Math.random() * 4);

    for (let i = 0; i < clicks; i++) {
      const t = now + i * (0.06 + Math.random() * 0.08);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "square";
      const freq = 1200 + Math.random() * 600;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.3, t + 0.015);

      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

      const hpFilter = this.ctx.createBiquadFilter();
      hpFilter.type = "highpass";
      hpFilter.frequency.value = 800;

      osc.connect(hpFilter);
      hpFilter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.03);
    }
  }

  playDogBark() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const barks = 1 + Math.floor(Math.random() * 2);

    for (let i = 0; i < barks; i++) {
      const t = now + i * 0.45;

      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.linearRampToValueAtTime(280, t + 0.12);
      osc.frequency.linearRampToValueAtTime(200, t + 0.2);

      const osc2 = this.ctx.createOscillator();
      osc2.type = "square";
      osc2.frequency.setValueAtTime(420, t);
      osc2.frequency.linearRampToValueAtTime(180, t + 0.2);

      const bpFilter = this.ctx.createBiquadFilter();
      bpFilter.type = "bandpass";
      bpFilter.frequency.value = 600;
      bpFilter.Q.value = 2.5;

      const lpFilter = this.ctx.createBiquadFilter();
      lpFilter.type = "lowpass";
      lpFilter.frequency.value = 1200;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.015);
      gain.gain.setValueAtTime(0.06, t + 0.06);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.12);
      gain.gain.linearRampToValueAtTime(0, t + 0.22);

      osc.connect(bpFilter);
      osc2.connect(bpFilter);
      bpFilter.connect(lpFilter);
      lpFilter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc2.start(t);
      osc.stop(t + 0.25);
      osc2.stop(t + 0.25);
    }
  }

  start() {
    if (this.isPlaying) return;
    this.init();
    if (this.ctx?.state === "suspended") {
      this.ctx.resume();
    }
    this.isPlaying = true;

    this.startContinuousOcean();

    this.playWaveLap();
    this.waveInterval = window.setInterval(() => {
      this.playWaveLap();
    }, 7000);

    const scheduleRandom = (fn: () => void, minDelay: number, maxDelay: number) => {
      const schedule = () => {
        if (!this.isPlaying) return;
        const delay = minDelay + Math.random() * (maxDelay - minDelay);
        const id = window.setTimeout(() => {
          if (!this.isPlaying) return;
          fn();
          schedule();
        }, delay);
        this.ambientIntervals.push(id);
      };
      schedule();
    };

    scheduleRandom(() => this.playSeagull(), 5000, 14000);
    scheduleRandom(() => this.playCrabClick(), 8000, 18000);
    scheduleRandom(() => this.playDogBark(), 18000, 40000);
  }

  stop() {
    this.isPlaying = false;
    if (this.waveInterval) {
      clearInterval(this.waveInterval);
      this.waveInterval = null;
    }
    this.ambientIntervals.forEach(id => clearTimeout(id));
    this.ambientIntervals = [];
    if (this.continuousWaveSource) {
      try { this.continuousWaveSource.stop(); } catch {}
      this.continuousWaveSource = null;
    }
    if (this.ctx && this.ctx.state === "running") {
      this.ctx.suspend();
    }
  }

  destroy() {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export function useBeachAudio() {
  const engineRef = useRef<BeachAudioEngine | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    engineRef.current = new BeachAudioEngine();
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => {
    setMuted(prev => {
      if (prev) {
        engineRef.current?.start();
      } else {
        engineRef.current?.stop();
      }
      return !prev;
    });
  }, []);

  return { muted, toggle };
}
