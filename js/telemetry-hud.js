/**
 * DROSOMIND - Real-Time Telemetry HUD & Electrophysiological Canvas Monitors
 * 1. Neural Spike Raster Plot (Multi-region spike train waterfall)
 * 2. Multi-channel Voltage Oscilloscope (Membrane potential Vm in mV)
 * 3. Ring Attractor Compass Polar Radar (Ellipsoid Body 16-wedge heading vector)
 * 4. Audio Spectrogram & Synapse Transmission Metrics
 */

(function(window) {
  'use strict';

  class TelemetryHUD {
    constructor(neuralEngine, acousticsEngine, connectomeData) {
      this.neuralEngine = neuralEngine;
      this.acousticsEngine = acousticsEngine;
      this.connectomeData = connectomeData;

      // DOM Elements
      this.rasterCanvas = document.getElementById('raster-canvas');
      this.rasterCtx = this.rasterCanvas ? this.rasterCanvas.getContext('2d') : null;

      this.oscilloCanvas = document.getElementById('oscillo-canvas');
      this.oscilloCtx = this.oscilloCanvas ? this.oscilloCanvas.getContext('2d') : null;

      this.compassCanvas = document.getElementById('compass-canvas');
      this.compassCtx = this.compassCanvas ? this.compassCanvas.getContext('2d') : null;

      this.spectroCanvas = document.getElementById('spectro-canvas');
      this.spectroCtx = this.spectroCanvas ? this.spectroCanvas.getContext('2d') : null;

      // Voltage history for oscilloscope
      this.voltageHistory = {
        optic: [],
        compass: [],
        p1: [],
        vnc: []
      };
      this.maxOscilloPoints = 120;

      // Telemetry DOM text elements
      this.behaviorBadge = document.getElementById('telemetry-behavior');
      this.spikeRateBadge = document.getElementById('telemetry-spikerate');
      this.headingBadge = document.getElementById('telemetry-heading');
      this.activeNeuronBadge = document.getElementById('telemetry-neurons');
    }

    /**
     * Primary update tick called from main animation loop
     */
    update() {
      this.updateBadges();
      this.drawSpikeRaster();
      this.drawOscilloscope();
      this.drawCompassRadar();
      this.drawAudioSpectrum();
    }

    updateBadges() {
      if (this.behaviorBadge) {
        const behavior = this.neuralEngine.currentBehavior;
        this.behaviorBadge.textContent = behavior.replace(/_/g, ' ');

        // Color badge dynamically
        if (behavior.includes('COURTSHIP')) {
          this.behaviorBadge.className = 'hud-badge hud-badge-pink';
        } else if (behavior.includes('ESCAPE')) {
          this.behaviorBadge.className = 'hud-badge hud-badge-red';
        } else if (behavior.includes('GROOM')) {
          this.behaviorBadge.className = 'hud-badge hud-badge-blue';
        } else {
          this.behaviorBadge.className = 'hud-badge hud-badge-green';
        }
      }

      if (this.spikeRateBadge) {
        this.spikeRateBadge.textContent = `${this.neuralEngine.spikesPerSecond} Hz`;
      }

      if (this.headingBadge) {
        const deg = Math.round((this.neuralEngine.compassHeadingRad * 180 / Math.PI + 360) % 360);
        this.headingBadge.textContent = `${deg}°`;
      }

      if (this.activeNeuronBadge) {
        const total = this.neuralEngine.neurons.length - this.neuralEngine.ablatedNeurons.size;
        this.activeNeuronBadge.textContent = `${total} / ${this.neuralEngine.neurons.length}`;
      }
    }

    /**
     * Real-Time Neural Spike Raster Plot
     * Color-coded vertical ticks scrolling horizontally across time
     */
    drawSpikeRaster() {
      if (!this.rasterCtx || !this.rasterCanvas) return;
      const ctx = this.rasterCtx;
      const w = this.rasterCanvas.width;
      const h = this.rasterCanvas.height;

      // Dark background with subtle scanlines
      ctx.fillStyle = 'rgba(6, 10, 18, 0.4)';
      ctx.fillRect(0, 0, w, h);

      const history = this.neuralEngine.spikeHistory;
      if (history.length === 0) return;

      const currentTime = this.neuralEngine.simTime;
      const windowMs = 1200.0; // 1.2s time window
      const totalNeurons = this.neuralEngine.neurons.length;

      const themes = this.connectomeData.REGION_THEMES;

      for (let i = 0; i < history.length; i++) {
        const spk = history[i];
        const ageMs = currentTime - spk.time;
        if (ageMs > windowMs) continue;

        // X coordinate: newest on right, older on left
        const x = w - (ageMs / windowMs) * w;
        // Y coordinate: proportional to neuron ID
        const y = (spk.neuronId / totalNeurons) * (h - 8) + 4;

        const theme = themes[spk.region] || themes.CENTRAL_COMPLEX;
        ctx.fillStyle = theme.color;
        ctx.fillRect(x, y, 2.0, 2.5);
      }
    }

    /**
     * Multi-Channel Voltage Oscilloscope
     * Shows membrane potentials (mV) across 4 key functional circuits
     */
    drawOscilloscope() {
      if (!this.oscilloCtx || !this.oscilloCanvas) return;
      const ctx = this.oscilloCtx;
      const w = this.oscilloCanvas.width;
      const h = this.oscilloCanvas.height;

      ctx.fillStyle = 'rgba(6, 10, 18, 0.85)';
      ctx.fillRect(0, 0, w, h);

      // Grid lines (-70mV, -50mV, 0mV, +30mV)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += h / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Sample representative neurons
      const groups = this.neuralEngine.groups;
      const opticNeuron = this.neuralEngine.neurons[groups.leftOpticIds[0]];
      const compassNeuron = this.neuralEngine.neurons[groups.compassRingIds[0]];
      const p1Neuron = this.neuralEngine.neurons[groups.p1CourtshipIds[0]];
      const vncNeuron = this.neuralEngine.neurons[groups.vncIds.T2[4]]; // Song motor neuron

      this.voltageHistory.optic.push(opticNeuron ? opticNeuron.voltage : -65);
      this.voltageHistory.compass.push(compassNeuron ? compassNeuron.voltage : -65);
      this.voltageHistory.p1.push(p1Neuron ? p1Neuron.voltage : -65);
      this.voltageHistory.vnc.push(vncNeuron ? vncNeuron.voltage : -65);

      if (this.voltageHistory.optic.length > this.maxOscilloPoints) {
        this.voltageHistory.optic.shift();
        this.voltageHistory.compass.shift();
        this.voltageHistory.p1.shift();
        this.voltageHistory.vnc.shift();
      }

      // Helper to map voltage (-75mV to +35mV) to Y
      const mapVtoY = (v) => {
        const norm = (v - (-75)) / (35 - (-75));
        return h - norm * (h - 6) - 3;
      };

      const drawTrace = (data, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = (i / (this.maxOscilloPoints - 1)) * w;
          const y = mapVtoY(data[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      drawTrace(this.voltageHistory.optic, '#00e5ff');   // Optic (Cyan)
      drawTrace(this.voltageHistory.compass, '#00ff88'); // Compass (Green)
      drawTrace(this.voltageHistory.p1, '#ff007f');      // P1 Courtship (Hot Pink)
      drawTrace(this.voltageHistory.vnc, '#ff5500');     // VNC Wing Motor (Orange)
    }

    /**
     * Polar Ring Attractor Compass Radar
     * 16 wedges of Ellipsoid Body with active population bump
     */
    drawCompassRadar() {
      if (!this.compassCtx || !this.compassCanvas) return;
      const ctx = this.compassCtx;
      const w = this.compassCanvas.width;
      const h = this.compassCanvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy) - 6;

      ctx.clearRect(0, 0, w, h);

      // Outer dial circle
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Draw 16 wedges of the Ellipsoid Body (E-PG neurons)
      const compassIds = this.neuralEngine.groups.compassRingIds;
      const stepAngle = (Math.PI * 2) / compassIds.length;

      for (let i = 0; i < compassIds.length; i++) {
        const id = compassIds[i];
        const n = this.neuralEngine.neurons[id];
        const activity = Math.max(0, (n.voltage - n.resting) / (n.threshold - n.resting));
        const theta = (i / compassIds.length) * Math.PI * 2 - Math.PI / 2;

        const wedgeR = 6 + activity * (r - 8);
        const wx = cx + Math.cos(theta) * wedgeR;
        const wy = cy + Math.sin(theta) * wedgeR;

        // Glowing wedge nodes
        ctx.fillStyle = activity > 0.6 ? '#00ff88' : 'rgba(0, 255, 136, 0.2)';
        ctx.beginPath();
        ctx.arc(wx, wy, 2.5 + activity * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Decoded population heading needle
      const headingRad = this.neuralEngine.compassHeadingRad - Math.PI / 2;
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(headingRad) * (r - 4), cy + Math.sin(headingRad) * (r - 4));
      ctx.stroke();

      // Center pivot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    /**
     * Real-time Audio Spectrum / Courtship Song Waveform
     */
    drawAudioSpectrum() {
      if (!this.spectroCtx || !this.spectroCanvas) return;
      const ctx = this.spectroCtx;
      const w = this.spectroCanvas.width;
      const h = this.spectroCanvas.height;

      ctx.fillStyle = 'rgba(6, 10, 18, 0.8)';
      ctx.fillRect(0, 0, w, h);

      const freqData = this.acousticsEngine.getFrequencyData();
      if (!freqData || freqData.length === 0) {
        // Flatline
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        return;
      }

      const barWidth = (w / 32);
      for (let i = 0; i < 32; i++) {
        const val = freqData[i * 2] / 255.0;
        const barH = val * (h - 4);
        ctx.fillStyle = this.neuralEngine.wingSongActive ? '#ff007f' : '#00e5ff';
        ctx.fillRect(i * barWidth, h - barH, barWidth - 1, barH);
      }
    }
  }

  window.DrosomindTelemetry = TelemetryHUD;
})(window);
