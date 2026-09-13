/**
 * DROSOMIND - Bio-Acoustic Synthesizer & Neural Synesthesia Engine
 * Authentic audio synthesis of the Male Fruit Fly Courtship Song:
 * 1. Pulse Song (IPI ~34ms, damped sinusoidal burst at ~180Hz)
 * 2. Sine Song (Continuous harmonic hum at ~160Hz)
 * 3. Connectome Synesthesia (Multi-channel electrophysiological sonification)
 */

(function(window) {
  'use strict';

  class BioAcousticsEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.analyser = null;
      this.isMuted = true;
      this.isInitialized = false;

      // Pulse song timing
      this.lastPulseTime = 0;
      this.pulseIntervalMs = 34.0; // Drosophila melanogaster characteristic IPI (34ms)
      this.pulseCarrierHz = 180.0;

      // Continuous sine song oscillator
      this.sineOsc = null;
      this.sineGain = null;

      // Multi-channel brain synesthesia voices
      this.synesthesiaVoices = [];

      // Master volume (0.0 to 1.0)
      this.masterVolume = 1.0;
      this._lastEscapeActive = false;
    }

    /**
     * Initializes the Web Audio API context upon user gesture
     */
    init() {
      if (this.isInitialized) return;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        console.warn('Web Audio API not supported in this browser.');
        return;
      }

      this.ctx = new AudioCtx();

      // Master dynamics compressor to prevent clipping
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0, this.ctx.currentTime); // Start muted

      // Analyser Node for live visual spectrogram
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect graph
      this.masterGain.connect(compressor);
      compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Setup Continuous Courtship Sine Song voice
      this.setupSineSongVoice();

      this.isInitialized = true;
    }

    setupSineSongVoice() {
      if (!this.ctx) return;

      this.sineOsc = this.ctx.createOscillator();
      this.sineOsc.type = 'triangle'; // Richer acoustic profile than pure sine
      this.sineOsc.frequency.setValueAtTime(160.0, this.ctx.currentTime);

      // Bandpass filter to match insect thoracic acoustic resonator
      const bpFilter = this.ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.frequency.setValueAtTime(160.0, this.ctx.currentTime);
      bpFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

      this.sineGain = this.ctx.createGain();
      this.sineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.sineOsc.connect(bpFilter);
      bpFilter.connect(this.sineGain);
      this.sineGain.connect(this.masterGain);

      this.sineOsc.start();
    }

    /**
     * Toggles audio mute/unmute
     */
    toggleMute() {
      if (!this.isInitialized) {
        this.init();
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      this.isMuted = !this.isMuted;
      const targetGain = this.isMuted ? 0.0 : 0.45 * this.masterVolume;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
      }
      return !this.isMuted;
    }

    /**
     * Called every simulation tick with real-time neural state
     */
    update(neuralEngine, delta) {
      if (!this.isInitialized || this.isMuted || !this.ctx) return;

      const now = performance.now();
      const behavior = neuralEngine.currentBehavior;
      const isSongActive = neuralEngine.wingSongActive;
      const songIntensity = neuralEngine.wingSongIntensity;

      // Check for escape takeoff behavior transition
      if (behavior === 'ESCAPE_TAKEOFF' && !this._lastEscapeActive) {
        this.triggerEscapeWhoosh();
      }
      this._lastEscapeActive = (behavior === 'ESCAPE_TAKEOFF');

      // 1. Synthesize Courtship Song when male P1 / VNC T2 song motor neurons fire!
      if (isSongActive) {
        // A. Pulse Song synthesis: trigger clicks at ~34ms intervals
        if (now - this.lastPulseTime >= this.pulseIntervalMs) {
          this.triggerCourtshipPulse(songIntensity);
          this.lastPulseTime = now;
        }

        // B. Sine Song continuous background hum
        if (this.sineGain) {
          const targetSine = 0.25 * songIntensity;
          this.sineGain.gain.setTargetAtTime(targetSine, this.ctx.currentTime, 0.04);
        }
      } else {
        if (this.sineGain) {
          this.sineGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.08);
        }
      }

      // 2. Play subtle neural synesthesia pulses for active action potentials
      const activeSpikes = neuralEngine.activeSpikesThisTick;
      if (activeSpikes.length > 0 && Math.random() < 0.25) {
        const spk = activeSpikes[Math.floor(Math.random() * activeSpikes.length)];
        this.triggerNeuralBlip(spk.region, spk.neurotransmitter);
      }
    }

    /**
     * Generates a single biological Courtship Song Pulse
     * Authentic waveform: 180Hz damped sinusoidal cycle lasting ~4ms
     */
    triggerCourtshipPulse(intensity = 1.0) {
      if (!this.ctx || this.isMuted) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Slight pitch variance mimicking wing vibration natural jitter
      osc.frequency.setValueAtTime(this.pulseCarrierHz + (Math.random() - 0.5) * 15, t);

      // Fast exponential envelope: attack < 1ms, decay ~ 4ms
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.35 * intensity, t + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.014);
    }

    /**
     * Generates soft harmonic synesthesia micro-tones based on brain region
     */
    triggerNeuralBlip(region, neurotransmitter) {
      if (!this.ctx || this.isMuted) return;

      const regionFrequencies = {
        OPTIC: 520,             // Crisp visual frequency
        CENTRAL_COMPLEX: 380,   // Compass navigation harmony
        MUSHROOM_BODY: 640,     // Learning/Memory chime
        P1_COURTSHIP: 240,      // Deep male arousal tone
        GIANT_FIBER: 140,       // Low escape bass thud
        VNC_T1: 440,
        VNC_T2: 320,
        VNC_T3: 280,
        VNC_ABDOMEN: 210
      };

      const baseFreq = regionFrequencies[region] || 400;
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, t);

      // Soft blip
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.05);
    }

    /**
     * Sets master volume (0.0 to 1.0)
     */
    setVolume(volume) {
      this.masterVolume = Math.max(0.0, Math.min(1.0, volume));
      if (!this.isMuted && this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.masterVolume * 0.45, this.ctx.currentTime, 0.05);
      }
    }

    /**
     * Synthesizes the sudden high-frequency wing buzz and air whoosh of a Giant Fiber escape jump
     */
    triggerEscapeWhoosh() {
      if (!this.ctx || this.isMuted) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(260, t + 0.08);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.35);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(3400, t + 0.06);
      filter.frequency.exponentialRampToValueAtTime(400, t + 0.35);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.35 * this.masterVolume, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.4);
    }

    /**
     * Synthesizes sweet taste receptor detection and proboscis extension feedback
     */
    triggerFeedingChirp() {
      if (!this.ctx || this.isMuted) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(680, t);
      osc.frequency.exponentialRampToValueAtTime(920, t + 0.06);
      osc.frequency.exponentialRampToValueAtTime(540, t + 0.16);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.18 * this.masterVolume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.2);
    }

    /**
     * Returns FFT byte frequency data for the UI spectrum visualizer
     */
    getFrequencyData() {
      if (!this.analyser) return new Uint8Array(0);
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);
      return data;
    }
  }

  window.DrosomindAcoustics = BioAcousticsEngine;
})(window);
