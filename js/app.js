/**
 * DROSOMIND - Main Application Controller
 * Orchestrates WebGL rendering, Neural SNN simulation, Bio-Acoustics,
 * Sensory Stimulus triggers, Laser Ablation, and 1-Click Social Reel recording.
 */

(function(window) {
  'use strict';

  let connectomeData;
  let neuralEngine;
  let renderer3d;
  let acousticsEngine;
  let telemetryHud;

  // MediaRecorder for 1-Click Reel / Video Export
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;

  // Guided Tour State & Waypoints
  let isTourActive = false;
  let currentTourIndex = 0;

  const TOUR_STOPS = [
    {
      region: 'OPTIC',
      title: '1. Optic Lobes (Medulla, Lobula, LPTCs)',
      desc: 'Processing omnidirectional visual motion from compound eyes. Horizontal (HS) and Vertical (VS) system tangential cells compute rotatory velocity to guide flight steering.',
      circuit: 'Retina &rarr; Medulla &rarr; Lobula Plate LPTCs',
      actionLabel: 'Simulate Visual Flow',
      action: () => {
        neuralEngine.applyOptomotorStimulus('left', 1.2);
        showToast('Leftward optical flow simulated -> Optic tangential cells fired.');
      },
      camPos: { x: -26, y: 25, z: 45 },
      lookAt: { x: -24, y: 20, z: 0 }
    },
    {
      region: 'CENTRAL_COMPLEX',
      title: '2. Ellipsoid Body Ring Attractor Compass',
      desc: 'The fly\'s internal heading compass. 16 wedge E-PG neurons form a continuous topological ring attractor that tracks azimuthal heading in real time.',
      circuit: 'Visual Landmarks &rarr; 16-Wedge E-PG Compass &rarr; Heading Steering',
      actionLabel: 'Rotate Compass 90°',
      action: () => {
        neuralEngine.applyOptomotorStimulus('right', 1.8);
        showToast('Compass heading shifted 90° clockwise via ring attractor.');
      },
      camPos: { x: 0, y: 30, z: 40 },
      lookAt: { x: 0, y: 20, z: 0 }
    },
    {
      region: 'MUSHROOM_BODY',
      title: '3. Mushroom Body & Kenyon Cells (Memory)',
      desc: 'The center of learning and associative memory in the insect brain. Kenyon cells encode multi-sensory odor representations paired with dopamine reinforcement to form learned memories.',
      circuit: 'Antennal Lobe &rarr; Calyx Kenyon Cells &rarr; MBON Output',
      actionLabel: 'Deliver Sugar Reward',
      action: () => {
        neuralEngine.applyOdorStimulus('sweet_gr5a');
        acousticsEngine.triggerFeedingChirp();
        showToast('Sweet sucrose stimulus -> Mushroom body memory circuits active.');
      },
      camPos: { x: 14, y: 36, z: 34 },
      lookAt: { x: 10, y: 28, z: 5 }
    },
    {
      region: 'P1_COURTSHIP',
      title: '4. Male P1 Courtship Hub & Dimorphic Bridge',
      desc: 'Google Research Cell 2026 milestone: mapped the male-specific Fru+/Dsx+ P1 cluster and bilateral AOTU008 axonal bridge that triggers unilateral courtship wing song.',
      circuit: 'cVA Pheromone &rarr; P1 Cluster Hub &rarr; DNg02 Song Command',
      actionLabel: 'Trigger Courtship Song',
      action: () => {
        neuralEngine.applyCourtshipCue();
        showToast('P1 courtship command hub ignited -> Unilateral wing song active!');
      },
      camPos: { x: 0, y: 32, z: 28 },
      lookAt: { x: 0, y: 24, z: 6 }
    },
    {
      region: 'GIANT_FIBER',
      title: '5. Giant Fiber Escape Reflex System',
      desc: 'The ultimate survival circuit. Electrical synapses transmit visual looming danger in sub-5ms directly from lobula to thoracic motor neurons, initiating explosive jump and wing takeoff.',
      circuit: 'Lobula Plate &rarr; Giant Fiber &rarr; VNC T2 Jump/Flight',
      actionLabel: 'Trigger Looming Shadow',
      action: () => {
        neuralEngine.applyLoomingStimulus();
        acousticsEngine.triggerEscapeWhoosh();
        showToast('Visual Looming Shadow! Giant Fiber electrical synapse triggered takeoff!');
      },
      camPos: { x: 0, y: 20, z: 36 },
      lookAt: { x: 0, y: 14, z: -2 }
    },
    {
      region: 'VNC',
      title: '6. Ventral Nerve Cord (Motor Locomotion Pools)',
      desc: 'The insect spinal cord linking descending brain commands to body action: T1 controls front-leg grooming, T2 drives courtship wing song and flight, and T3 coordinates hexapod gait and jump.',
      circuit: 'Descending Neurons (DN) &rarr; T1-T3 Neuromeres &rarr; Motor Actuators',
      actionLabel: 'Drive Hexapod Gait',
      action: () => {
        neuralEngine.applyLocomotionDrive(1.0);
        showToast('Descending motor command -> Tripod gait cycle running.');
      },
      camPos: { x: 0, y: -16, z: 52 },
      lookAt: { x: 0, y: -22, z: 0 }
    }
  ];

  function initApp() {
    console.log('Initializing DROSOMIND: Male Fruit Fly Connectome Organism...');

    // 1. Instantiate Core Subsystems
    connectomeData = window.DrosomindConnectome;
    neuralEngine = new window.DrosomindNeuralEngine(connectomeData);

    const container = document.getElementById('webgl-container');
    renderer3d = new window.DrosomindRenderer(container, connectomeData, neuralEngine);

    acousticsEngine = new window.DrosomindAcoustics();
    telemetryHud = new window.DrosomindTelemetry(neuralEngine, acousticsEngine, connectomeData);

    // 2. Setup Neuron Selection Callback
    renderer3d.onNeuronSelectCallback = handleNeuronSelection;

    // 3. Bind UI Controls & Event Listeners
    setupUIEventListeners();

    // 4. Start Animation Loop
    requestAnimationFrame(mainLoop);

    console.log('DROSOMIND successfully started. 166k male connectome simulation online.');
  }

  /**
   * Main 60FPS RAF Loop
   */
  let lastTime = performance.now();
  function mainLoop(currentTime) {
    requestAnimationFrame(mainLoop);

    const delta = (currentTime - lastTime) / 1000.0;
    lastTime = currentTime;

    // Advance 3D renderer and neural simulation
    renderer3d.animate();

    // Update bio-acoustic sound engine
    acousticsEngine.update(neuralEngine, delta);

    // Update real-time telemetry HUD
    telemetryHud.update();
  }

  /**
   * UI Event Bindings
   */
  function setupUIEventListeners() {
    // --- Stimulus Buttons ---
    const btnLooming = document.getElementById('btn-stim-looming');
    if (btnLooming) {
      btnLooming.addEventListener('click', () => {
        neuralEngine.applyLoomingStimulus();
        acousticsEngine.triggerEscapeWhoosh();
        showToast('Visual Looming Predator triggered! Giant Fiber firing.');
      });
    }

    const btnOptoLeft = document.getElementById('btn-stim-opto-left');
    if (btnOptoLeft) {
      btnOptoLeft.addEventListener('click', () => {
        neuralEngine.applyOptomotorStimulus('left', 1.0);
        showToast('Optomotor motion Left -> Ring attractor rotating.');
      });
    }

    const btnOptoRight = document.getElementById('btn-stim-opto-right');
    if (btnOptoRight) {
      btnOptoRight.addEventListener('click', () => {
        neuralEngine.applyOptomotorStimulus('right', 1.0);
        showToast('Optomotor motion Right -> Ring attractor rotating.');
      });
    }

    const btnCourtship = document.getElementById('btn-stim-courtship');
    if (btnCourtship) {
      btnCourtship.addEventListener('click', () => {
        neuralEngine.applyCourtshipCue();
        showToast('P1 Courtship Hub excited! Wing vibration song starting.');
      });
    }

    const btnSugar = document.getElementById('btn-stim-sugar');
    if (btnSugar) {
      btnSugar.addEventListener('click', () => {
        neuralEngine.applyOdorStimulus('sweet_gr5a');
        acousticsEngine.triggerFeedingChirp();
        showToast('Sugar scent detected -> Antennal lobe activated.');
      });
    }

    const btnPheromone = document.getElementById('btn-stim-pheromone');
    if (btnPheromone) {
      btnPheromone.addEventListener('click', () => {
        neuralEngine.applyOdorStimulus('pheromone_cva');
        showToast('Female cVA Pheromone plume -> P1 cluster ignited.');
      });
    }

    // --- Laser Micro-Ablation Tool ---
    const btnAblation = document.getElementById('btn-tool-ablation');
    if (btnAblation) {
      btnAblation.addEventListener('click', () => {
        renderer3d.isAblationToolActive = !renderer3d.isAblationToolActive;
        btnAblation.classList.toggle('active', renderer3d.isAblationToolActive);
        showToast(renderer3d.isAblationToolActive ? 'Laser Ablation active: Click any neuron to silence it!' : 'Laser Ablation deactivated.');
      });
    }

    const btnClearAblation = document.getElementById('btn-clear-ablation');
    if (btnClearAblation) {
      btnClearAblation.addEventListener('click', () => {
        neuralEngine.clearAblations();
        renderer3d.somaMeshes.forEach(m => {
          const orig = m.userData.originalColor;
          m.material.color.copy(orig);
          m.material.emissive.copy(orig);
        });
        showToast('All ablated neural circuits restored.');
      });
    }

    // --- View Mode Selectors ---
    const viewButtons = {
      'view-split': 'split',
      'view-brain': 'brain',
      'view-organism': 'organism',
      'view-dimorphism': 'dimorphism'
    };

    Object.entries(viewButtons).forEach(([btnId, mode]) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderer3d.updateLayout(mode);

          const dimorphismDesc = document.getElementById('dimorphism-panel');
          if (dimorphismDesc) {
            dimorphismDesc.style.display = (mode === 'dimorphism') ? 'block' : 'none';
          }
        });
      }
    });

    // --- Dimorphism Gender Switcher (Male vs Female) ---
    const btnSexMale = document.getElementById('btn-sex-male');
    const btnSexFemale = document.getElementById('btn-sex-female');
    if (btnSexMale && btnSexFemale) {
      btnSexMale.addEventListener('click', () => {
        btnSexMale.classList.add('active');
        btnSexFemale.classList.remove('active');
        neuralEngine.setDimorphismMode('male');
        showToast('Male Connectome active (166k neurons, P1 courtship cluster, wing song motor centers).');
      });

      btnSexFemale.addEventListener('click', () => {
        btnSexFemale.classList.add('active');
        btnSexMale.classList.remove('active');
        neuralEngine.setDimorphismMode('female');
        showToast('Female Connectome active (Courtship song circuits suppressed, dimorphic pruning).');
      });
    }

    // --- Audio Mute / Unmute ---
    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const isAudible = acousticsEngine.toggleMute();
        btnAudio.innerHTML = isAudible ? '<span class="icon">🔊</span> Bio-Acoustics: ON' : '<span class="icon">🔇</span> Bio-Acoustics: OFF';
        btnAudio.classList.toggle('active', isAudible);
        showToast(isAudible ? 'Audio active: Courtship song & synesthesia synthesized.' : 'Audio muted.');
      });
    }

    // --- Volume Slider ---
    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        acousticsEngine.setVolume(val);
      });
    }

    // --- Simulation Timescale Speed Buttons ---
    const speedButtons = document.querySelectorAll('.speed-btn');
    speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = parseFloat(btn.getAttribute('data-speed')) || 1.0;
        renderer3d.setSimulationSpeed(speed);
        showToast(`Simulation speed: ${speed}x ${speed < 1 ? '(Slow-Motion)' : speed > 1 ? '(Hyper-Speed)' : '(Real-Time)'}`);
      });
    });

    // --- Guided Tour Navigation ---
    const btnGuidedTour = document.getElementById('btn-guided-tour');
    if (btnGuidedTour) {
      btnGuidedTour.addEventListener('click', () => {
        if (isTourActive) {
          exitGuidedTour();
        } else {
          startGuidedTour();
        }
      });
    }

    const btnTourClose = document.getElementById('btn-tour-close');
    if (btnTourClose) {
      btnTourClose.addEventListener('click', exitGuidedTour);
    }

    const btnTourNext = document.getElementById('btn-tour-next');
    if (btnTourNext) {
      btnTourNext.addEventListener('click', () => {
        if (currentTourIndex >= TOUR_STOPS.length - 1) {
          exitGuidedTour();
          showToast('Guided Tour completed! Feel free to explore freely.');
        } else {
          renderTourStop(currentTourIndex + 1);
        }
      });
    }

    const btnTourPrev = document.getElementById('btn-tour-prev');
    if (btnTourPrev) {
      btnTourPrev.addEventListener('click', () => {
        if (currentTourIndex > 0) {
          renderTourStop(currentTourIndex - 1);
        }
      });
    }

    const btnTourAction = document.getElementById('btn-tour-action');
    if (btnTourAction) {
      btnTourAction.addEventListener('click', () => {
        const stop = TOUR_STOPS[currentTourIndex];
        if (stop && stop.action) {
          stop.action();
        }
      });
    }

    // --- 1-Click Social Reel / Video Recording ---
    const btnRecord = document.getElementById('btn-record-reel');
    if (btnRecord) {
      btnRecord.addEventListener('click', toggleReelRecording);
    }

    // --- Scientific Info Modal ---
    const btnInfo = document.getElementById('btn-info-modal');
    const modal = document.getElementById('info-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    if (btnInfo && modal) {
      btnInfo.addEventListener('click', () => modal.classList.add('open'));
    }
    if (btnCloseModal && modal) {
      btnCloseModal.addEventListener('click', () => modal.classList.remove('open'));
    }
  }

  /**
   * Guided Tour Engine: Launch, navigation, and highlight
   */
  function startGuidedTour() {
    isTourActive = true;
    currentTourIndex = 0;

    // Switch view mode to brain view for clearest anatomical view
    document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
    const btnBrain = document.getElementById('view-brain');
    if (btnBrain) btnBrain.classList.add('active');
    renderer3d.updateLayout('brain');

    const overlay = document.getElementById('guided-tour-overlay');
    if (overlay) {
      overlay.classList.add('active');
      overlay.style.display = 'block';
    }

    const btnTourHeader = document.getElementById('btn-guided-tour');
    if (btnTourHeader) btnTourHeader.classList.add('active');

    renderTourStop(0);
    showToast('Starting Connectome Guided Tour: Stop 1 of 6');
  }

  function renderTourStop(index) {
    if (index < 0 || index >= TOUR_STOPS.length) return;
    currentTourIndex = index;
    const stop = TOUR_STOPS[index];

    // Update overlay text
    const badge = document.getElementById('tour-step-badge');
    const title = document.getElementById('tour-title');
    const desc = document.getElementById('tour-desc');
    const circuitTag = document.getElementById('tour-circuit-tag');
    const actionLabel = document.getElementById('tour-action-label');
    const btnPrev = document.getElementById('btn-tour-prev');
    const btnNext = document.getElementById('btn-tour-next');

    if (badge) badge.textContent = `Stop ${index + 1} of ${TOUR_STOPS.length}`;
    if (title) title.textContent = stop.title;
    if (desc) desc.textContent = stop.desc;
    if (circuitTag) circuitTag.innerHTML = `Circuit: ${stop.circuit}`;
    if (actionLabel) actionLabel.textContent = stop.actionLabel;

    if (btnPrev) btnPrev.style.visibility = (index === 0) ? 'hidden' : 'visible';
    if (btnNext) btnNext.textContent = (index === TOUR_STOPS.length - 1) ? 'Finish Tour ✓' : 'Next Stop →';

    // Fly 3D camera to circuit
    renderer3d.flyToCamera(
      new THREE.Vector3(stop.camPos.x, stop.camPos.y, stop.camPos.z),
      new THREE.Vector3(stop.lookAt.x, stop.lookAt.y, stop.lookAt.z),
      1.2
    );

    // Highlight region soma meshes
    renderer3d.highlightRegion(stop.region);
  }

  function exitGuidedTour() {
    isTourActive = false;
    const overlay = document.getElementById('guided-tour-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
    }

    const btnTourHeader = document.getElementById('btn-guided-tour');
    if (btnTourHeader) btnTourHeader.classList.remove('active');

    renderer3d.highlightRegion(null);
    renderer3d.flyToCamera(new THREE.Vector3(0, 10, 100), new THREE.Vector3(0, 0, 0), 1.0);
    showToast('Exited Guided Tour. Free exploration active.');
  }

  /**
   * Displays details of a clicked neuron
   */
  function handleNeuronSelection(neuron, isAblated) {
    const inspector = document.getElementById('neuron-inspector');
    if (!inspector) return;

    inspector.innerHTML = `
      <div class="inspector-header">
        <span class="region-dot" style="background:${(connectomeData.REGION_THEMES[neuron.region] || {}).color || '#fff'}"></span>
        <h4>${neuron.name}</h4>
      </div>
      <div class="inspector-body">
        <p><strong>Region:</strong> ${(connectomeData.REGION_THEMES[neuron.region] || {}).name || neuron.region}</p>
        <p><strong>Transmitter:</strong> ${neuron.neurotransmitter} (${(connectomeData.NEUROTRANSMITTERS[neuron.neurotransmitter] || {}).type})</p>
        <p><strong>Potential:</strong> ${neuron.voltage.toFixed(1)} mV</p>
        <p><strong>Dimorphic:</strong> ${neuron.isSexuallyDimorphic ? 'Yes (Male P1 / AOTU008)' : 'No'}</p>
        <p><strong>Tags:</strong> ${neuron.tags.join(', ')}</p>
        <p><strong>Status:</strong> <span style="color:${isAblated ? '#ff3366' : '#00ff88'}">${isAblated ? 'ABLATED (SILENCED)' : 'FUNCTIONAL'}</span></p>
      </div>
    `;
  }

  /**
   * 1-Click Social Reel / Video Recording from WebGL Canvas
   */
  function toggleReelRecording() {
    const canvas = renderer3d.renderer.domElement;
    const btn = document.getElementById('btn-record-reel');

    if (!isRecording) {
      // Start recording
      recordedChunks = [];
      const stream = canvas.captureStream(30); // 30 FPS stream
      const options = { mimeType: 'video/webm;codecs=vp9' };

      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `drosomind-connectome-reel-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
        showToast('Social Reel video downloaded! Ready to share on Reels/TikTok.');
      };

      mediaRecorder.start();
      isRecording = true;
      if (btn) {
        btn.classList.add('recording');
        btn.innerHTML = '<span class="rec-dot"></span> STOP RECORDING';
      }
      showToast('Recording Reel... (Click again when finished)');
    } else {
      // Stop recording
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      isRecording = false;
      if (btn) {
        btn.classList.remove('recording');
        btn.innerHTML = '<span class="icon">📹</span> RECORD REEL';
      }
    }
  }

  /**
   * Toast notification UI banner
   */
  function showToast(message) {
    let toast = document.getElementById('drosomind-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'drosomind-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // Launch on DOM ready
  window.addEventListener('DOMContentLoaded', initApp);

})(window);
