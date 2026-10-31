/**
 * We Fart Together — Procedural Web Audio Engine
 * Zero external audio files required! Synthesizes cartoon farts, splashes, explosions, and chimes.
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
    this.masterGain = null;
    this.waterNoiseNode = null;
    this.waterGainNode = null;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;

      // Start subtle rushing water ambience
      this.startWaterAmbience();
    } catch (e) {
      console.warn("Web Audio API not supported or blocked:", e);
    }
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  /**
   * Procedural Comic Fart Synthesizer
   * Combines detuned pitch-dropping oscillators + FM flutter + resonant lowpass noise burst
   */
  playFart(pitchScale = 1.0, intensity = 1.0) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const duration = 0.25 + Math.random() * 0.25 * intensity;

    // Fart Tone Oscillators (Sawtooth + Square for brassy buzz)
    const baseFreq = (75 + Math.random() * 45) * pitchScale;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    // Pitch Drop Envelope (starts higher, drops sharply, with flutter)
    osc1.frequency.setValueAtTime(baseFreq * 1.5, t);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, t + duration * 0.7);
    osc1.frequency.linearRampToValueAtTime(baseFreq * 0.3, t + duration);

    osc2.frequency.setValueAtTime(baseFreq * 1.48, t);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.58, t + duration * 0.7);

    // Vibrato / Flutter LFO (creates the iconic "flapping" fart texture)
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sawtooth';
    lfo.frequency.setValueAtTime(25 + Math.random() * 20, t);
    lfoGain.gain.setValueAtTime(baseFreq * 0.45, t);
    lfo.connect(osc1.frequency);
    lfo.connect(osc2.frequency);

    // Noise Generator (airy / wet squelch)
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brown noise filter for deep airy texture
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Resonant Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450 * pitchScale, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + duration);
    filter.Q.setValueAtTime(4.5 + Math.random() * 3, t);

    // Amplitude Envelope
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.01, t);
    gainNode.gain.linearRampToValueAtTime(0.7 * intensity, t + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + duration);

    // Routing
    osc1.connect(filter);
    osc2.connect(filter);
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    // Start / Stop
    lfo.start(t);
    osc1.start(t);
    osc2.start(t);
    noise.start(t);

    lfo.stop(t + duration);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
    noise.stop(t + duration);
  }

  /**
   * Comic Pop / Death Explosion SFX
   */
  playExplosion() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const duration = 0.5;

    // Sub thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(1.0, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    // Sharp noise burst (balloon pop / crack)
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1200, t);
    noiseFilter.Q.setValueAtTime(2.0, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    osc.start(t);
    noise.start(t);
    osc.stop(t + 0.3);
    noise.stop(t + duration);
  }

  /**
   * Checkpoint Reached Fanfare Chime
   */
  playCheckpoint() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, idx) => {
      const startTime = t + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  /**
   * Speed Boost Chevron SFX
   */
  playBoost() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.3);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.3);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.35);
  }

  /**
   * Victory Fanfare
   */
  playVictory() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const chords = [
      { notes: [523.25, 659.25, 783.99], time: 0.0, dur: 0.2 },
      { notes: [587.33, 739.99, 880.00], time: 0.2, dur: 0.2 },
      { notes: [659.25, 830.61, 987.77], time: 0.4, dur: 0.25 },
      { notes: [783.99, 987.77, 1174.66, 1567.98], time: 0.7, dur: 0.9 }
    ];

    chords.forEach(chord => {
      chord.notes.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = t + chord.time;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.01, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + chord.dur);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + chord.dur);
      });
    });
  }

  /**
   * Continuous subtle rushing water background ambient sound
   */
  startWaterAmbience() {
    if (!this.ctx || this.waterNoiseNode) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.waterNoiseNode = this.ctx.createBufferSource();
    this.waterNoiseNode.buffer = buffer;
    this.waterNoiseNode.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 650;
    filter.Q.value = 1.2;

    this.waterGainNode = this.ctx.createGain();
    this.waterGainNode.gain.value = 0.08;

    this.waterNoiseNode.connect(filter);
    filter.connect(this.waterGainNode);
    this.waterGainNode.connect(this.masterGain);

    this.waterNoiseNode.start(0);
  }
}

// Global Sound Instance
window.sound = new SoundSystem();
