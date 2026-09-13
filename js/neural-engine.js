/**
 * DROSOMIND - Spiking Neural Network (SNN) Simulation Engine
 * High-performance Leaky Integrate-and-Fire (LIF) dynamics with axonal propagation delays,
 * biophysical neurotransmitter kinetics, sensory stimulus injection, and laser ablation.
 */

(function(window) {
  'use strict';

  class NeuralEngine {
    constructor(connectomeData) {
      this.graph = connectomeData.generateGraph();
      this.neurons = this.graph.neurons;
      this.synapses = this.graph.synapses;
      this.groups = this.graph.groups;

      // Biological parameters
      this.tauM = 15.0;         // Membrane time constant (ms)
      this.vRest = -65.0;       // Resting potential (mV)
      this.vReset = -70.0;      // Reset potential (mV)
      this.refractoryPeriod = 3.0; // ms

      // Build outgoing synaptic adjacency list for O(1) spike propagation
      this.outgoingSynapses = new Map();
      this.neurons.forEach(n => this.outgoingSynapses.set(n.id, []));
      this.synapses.forEach(syn => {
        this.outgoingSynapses.get(syn.source).push(syn);
      });

      // Axonal propagation queue: { targetId, weight, neurotransmitter, deliverAtTime }
      this.axonalPulses = [];

      // Simulation clock & telemetry
      this.simTime = 0;         // ms
      this.spikeHistory = [];   // [{ time, neuronId, region }] for raster plot
      this.maxSpikeHistory = 800;
      this.activeSpikesThisTick = [];
      this.spikesPerSecond = 0;
      this.spikesCounter = 0;
      this.lastSpikeRateCalcTime = 0;

      // Behavioral state output
      this.currentBehavior = 'RESTING';
      this.compassHeadingRad = 0; // Decoded from Ellipsoid Body ring attractor
      this.wingSongActive = false;
      this.wingSongIntensity = 0;
      this.escapeJumpTriggered = false;
      this.groomingActive = false;
      this.steeringTorque = 0;

      // Ablated neuron IDs
      this.ablatedNeurons = new Set();

      // Sexual dimorphism state: 'male' (default, Google paper) or 'female'
      this.dimorphismState = 'male';

      // Spontaneous background noise baseline (stochastic miniature EPSPs)
      this.noiseLevel = 1.2;
    }

    /**
     * Primary step function (runs at fixed biological dt in ms, e.g., dt = 1.0ms)
     */
    step(dt = 1.0) {
      this.simTime += dt;
      this.activeSpikesThisTick = [];

      // 1. Deliver delayed synaptic pulses
      const remainingPulses = [];
      for (let i = 0; i < this.axonalPulses.length; i++) {
        const pulse = this.axonalPulses[i];
        if (this.simTime >= pulse.deliverAtTime) {
          const target = this.neurons[pulse.targetId];
          if (target && !this.ablatedNeurons.has(target.id)) {
            // Apply postsynaptic potential based on neurotransmitter
            let psp = pulse.weight * 6.5;
            if (pulse.neurotransmitter === 'GABA') {
              psp = -Math.abs(psp); // Hyperpolarizing IPSP
            } else if (pulse.neurotransmitter === 'DA') {
              psp *= 0.5; // Modulatory
            }
            target.voltage += psp;
          }
        } else {
          remainingPulses.push(pulse);
        }
      }
      this.axonalPulses = remainingPulses;

      // 2. Update individual neuron membrane potentials (LIF)
      for (let i = 0; i < this.neurons.length; i++) {
        const n = this.neurons[i];

        // Skip ablated neurons
        if (this.ablatedNeurons.has(n.id)) {
          n.voltage = n.resting;
          continue;
        }

        // Check if in refractory period
        if (this.simTime < n.refractoryUntil) {
          n.voltage = this.vReset;
          continue;
        }

        // Biological leak back toward resting potential
        const dV = (-(n.voltage - n.resting) / this.tauM) * dt;
        n.voltage += dV;

        // Add subtle stochastic miniature synaptic noise
        n.voltage += (Math.random() - 0.49) * this.noiseLevel;

        // Check for action potential threshold
        if (n.voltage >= n.threshold) {
          this.fireNeuron(n);
        }
      }

      // 3. Compute telemetry, decode heading, and classify behavioral state
      this.updateTelemetryAndBehavior();
    }

    /**
     * Triggers an action potential in a neuron
     */
    fireNeuron(neuron) {
      neuron.voltage = 30.0; // Action potential peak (mV)
      neuron.lastSpikeTime = this.simTime;
      neuron.refractoryUntil = this.simTime + this.refractoryPeriod;

      // Record spike for telemetry and visual rendering
      const spikeEvent = {
        time: this.simTime,
        neuronId: neuron.id,
        region: neuron.region,
        pos: neuron.pos,
        neurotransmitter: neuron.neurotransmitter
      };
      this.activeSpikesThisTick.push(spikeEvent);
      this.spikeHistory.push(spikeEvent);
      if (this.spikeHistory.length > this.maxSpikeHistory) {
        this.spikeHistory.shift();
      }

      this.spikesCounter++;

      // Propagate down axonal arborizations to downstream synapses
      const outSynapses = this.outgoingSynapses.get(neuron.id);
      if (outSynapses) {
        for (let i = 0; i < outSynapses.length; i++) {
          const syn = outSynapses[i];
          // In female mode, skip male-specific P1 courtship synapses
          if (this.dimorphismState === 'female' && neuron.maleSpecific) {
            continue;
          }

          this.axonalPulses.push({
            targetId: syn.target,
            weight: syn.weight,
            neurotransmitter: syn.neurotransmitter,
            deliverAtTime: this.simTime + syn.delay
          });
        }
      }
    }

    /**
     * Decodes population vector heading from the 16 Ellipsoid Body wedges
     * and calculates high-level motor state from VNC efferent neurons
     */
    updateTelemetryAndBehavior() {
      // Calculate firing rate (spikes/sec)
      if (this.simTime - this.lastSpikeRateCalcTime >= 1000) {
        this.spikesPerSecond = this.spikesCounter;
        this.spikesCounter = 0;
        this.lastSpikeRateCalcTime = this.simTime;
      }

      // 1. Decode Compass Heading from E-PG Ring Attractor (Central Complex)
      const compassIds = this.groups.compassRingIds;
      let sumSin = 0;
      let sumCos = 0;
      for (let i = 0; i < compassIds.length; i++) {
        const id = compassIds[i];
        const n = this.neurons[id];
        // Activation is higher if recently spiked or depolarized
        const activity = Math.max(0, (n.voltage - n.resting) / (n.threshold - n.resting));
        const theta = (i / compassIds.length) * Math.PI * 2;
        sumSin += activity * Math.sin(theta);
        sumCos += activity * Math.cos(theta);
      }
      if (Math.hypot(sumSin, sumCos) > 0.05) {
        this.compassHeadingRad = Math.atan2(sumSin, sumCos);
      }

      // 2. Decode Motor Behaviors from VNC and Descending Neurons
      // A. Escape Jump (Giant Fiber + T3 jump motor neurons)
      const gfLeft = this.neurons[this.groups.giantFiberIds[0]];
      const gfRight = this.neurons[this.groups.giantFiberIds[1]];
      const isGFActive = (this.simTime - gfLeft.lastSpikeTime < 40) || (this.simTime - gfRight.lastSpikeTime < 40);
      this.escapeJumpTriggered = isGFActive;

      // B. Courtship Wing Vibration & Song (T2 Song Motor Neurons)
      let songSpikes = 0;
      const t2Ids = this.groups.vncIds.T2;
      for (let i = 0; i < t2Ids.length; i++) {
        const n = this.neurons[t2Ids[i]];
        if (n.tags.includes('courtship_song_motor') && (this.simTime - n.lastSpikeTime < 60)) {
          songSpikes++;
        }
      }
      this.wingSongActive = songSpikes >= 2 && this.dimorphismState === 'male';
      this.wingSongIntensity = Math.min(1.0, songSpikes / 5.0);

      // C. Grooming (T1 front legs & DNp09)
      const t1Ids = this.groups.vncIds.T1;
      let groomSpikes = 0;
      for (let i = 0; i < t1Ids.length; i++) {
        const n = this.neurons[t1Ids[i]];
        if (this.simTime - n.lastSpikeTime < 50) {
          groomSpikes++;
        }
      }
      this.groomingActive = groomSpikes >= 3;

      // D. Steering Torque (difference between left and right optic/steering DNs)
      const dnSteerL = this.neurons[this.groups.descendingNeuronIds[2]];
      const dnSteerR = this.neurons[this.groups.descendingNeuronIds[3]];
      const steerL = Math.max(0, 50 - (this.simTime - dnSteerL.lastSpikeTime)) / 50;
      const steerR = Math.max(0, 50 - (this.simTime - dnSteerR.lastSpikeTime)) / 50;
      this.steeringTorque = steerR - steerL;

      // Classify overall behavioral state
      if (this.escapeJumpTriggered) {
        this.currentBehavior = 'ESCAPE_TAKEOFF';
      } else if (this.wingSongActive) {
        this.currentBehavior = 'COURTSHIP_SINGING';
      } else if (this.groomingActive) {
        this.currentBehavior = 'GROOMING_ANTENNA';
      } else if (Math.abs(this.steeringTorque) > 0.3) {
        this.currentBehavior = this.steeringTorque > 0 ? 'STEERING_RIGHT' : 'STEERING_LEFT';
      } else {
        this.currentBehavior = 'SEARCHING_LOCOMOTION';
      }
    }

    // ==========================================
    // SENSORY STIMULI INJECTION INTERFACES
    // ==========================================

    /**
     * Stimulus 1: Looming Predator Shadow
     * High-contrast optical expansion triggers rapid burst in Lobula Tangential Cells & Giant Fiber
     */
    applyLoomingStimulus() {
      // Depolarize both left and right optic visual tracking cells strongly
      const allOptic = [...this.groups.leftOpticIds.slice(0, 12), ...this.groups.rightOpticIds.slice(0, 12)];
      allOptic.forEach(id => {
        const n = this.neurons[id];
        n.voltage = n.threshold + 2.0; // Force immediate spike
      });
      // Direct high surge to Giant Fibers
      this.groups.giantFiberIds.forEach(gfId => {
        const gf = this.neurons[gfId];
        gf.voltage = gf.threshold + 10.0;
      });
    }

    /**
     * Stimulus 2: Optomotor Rotating Gratings (Moving visual stripes)
     * Drives directional flow in left or right optic lobe to rotate the internal compass
     */
    applyOptomotorStimulus(direction = 'right', speed = 1.0) {
      const targetOptic = direction === 'right' ? this.groups.leftOpticIds : this.groups.rightOpticIds;
      targetOptic.forEach((id, idx) => {
        const n = this.neurons[id];
        if (Math.random() < 0.6 * speed) {
          n.voltage += 15.0 * speed;
        }
      });
    }

    /**
     * Stimulus 3: Chemical Plume (Sugar feeding or Pheromone scent)
     */
    applyOdorStimulus(type = 'pheromone_cva') {
      const alIds = this.groups.antennalLobeIds;
      alIds.forEach(id => {
        const n = this.neurons[id];
        if (n.tags.includes(type.toLowerCase())) {
          n.voltage = n.threshold + 5.0; // Strong burst
        }
      });
    }

    /**
     * Stimulus 4: Courtship Trigger (P1 Master Hub excitation)
     * Simulates visual tracking of female fly + contact pheromone cue
     */
    applyCourtshipCue() {
      if (this.dimorphismState === 'female') {
        // Female flies do not have active P1 courtship hubs
        return;
      }
      this.groups.p1CourtshipIds.forEach(id => {
        const n = this.neurons[id];
        n.voltage = n.threshold + 6.0;
      });
    }

    /**
     * Stimulus 5: Direct Locomotion Drive to VNC T1/T3 hexapod motor pools
     */
    applyLocomotionDrive(intensity = 1.0) {
      const vncIds = [...this.groups.vncIds.T1, ...this.groups.vncIds.T3];
      vncIds.forEach(id => {
        const n = this.neurons[id];
        if (Math.random() < 0.75 * intensity) {
          n.voltage = n.threshold + 3.0;
        }
      });
      // Also drive descending forward locomotion neurons
      if (this.groups.descendingNeuronIds.length > 0) {
        const dn = this.neurons[this.groups.descendingNeuronIds[0]];
        if (dn) dn.voltage = dn.threshold + 5.0;
      }
    }

    /**
     * Laser Micro-Ablation: Silence or restore specific neuron / cluster
     */
    toggleAblation(neuronId) {
      if (this.ablatedNeurons.has(neuronId)) {
        this.ablatedNeurons.delete(neuronId);
        return false; // Restored
      } else {
        this.ablatedNeurons.add(neuronId);
        const n = this.neurons[neuronId];
        if (n) n.voltage = n.resting;
        return true; // Ablated
      }
    }

    clearAblations() {
      this.ablatedNeurons.clear();
    }

    /**
     * Sexual Dimorphism Toggle (Male vs Female Connectome)
     */
    setDimorphismMode(mode) {
      this.dimorphismState = mode;
      if (mode === 'female') {
        // Silence male-specific P1 courtship neurons
        this.groups.p1CourtshipIds.forEach(id => this.ablatedNeurons.add(id));
      } else {
        // Restore male-specific circuits
        this.groups.p1CourtshipIds.forEach(id => this.ablatedNeurons.delete(id));
      }
    }
  }

  window.DrosomindNeuralEngine = NeuralEngine;
})(window);
