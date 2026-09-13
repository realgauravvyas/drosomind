/**
 * DROSOMIND - 3D WebGL Visualization Engine (Three.js)
 * High-performance rendering of:
 * 1. The 3D Male Fruit Fly Connectome (Brain + Ventral Nerve Cord) with glowing soma nodes,
 *    synaptic fiber bundles, and traveling action-potential pulse particles.
 * 2. The 3D Articulated Living Organism (Fruit Fly body, faceted eyes, legs, vibrating courtship wings).
 * 3. Sexual Dimorphism Comparative Inspection (Male vs Female AOTU008/P1 circuit arborizations).
 */

(function(window) {
  'use strict';

  class FlyRenderer3D {
    constructor(canvasContainer, connectomeData, neuralEngine) {
      this.container = canvasContainer;
      this.connectomeData = connectomeData;
      this.neuralEngine = neuralEngine;

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;

      // Object groups
      this.brainGroup = new THREE.Group();
      this.organismGroup = new THREE.Group();
      this.dimorphismGroup = new THREE.Group();
      this.pulsesGroup = new THREE.Group();

      // Node mesh references for fast color/scale updates on spike
      this.somaMeshes = [];
      this.fiberLines = [];
      this.activePulseParticles = [];

      // Articulated Fly Model References
      this.flyParts = {
        root: null,
        body: null,
        head: null,
        antennaeL: null,
        antennaeR: null,
        proboscis: null,
        leftWing: null,
        rightWing: null,
        legs: []
      };

      // View modes: 'split', 'brain', 'organism', 'dimorphism'
      this.viewMode = 'split';

      // Animation clocks
      this.clock = new THREE.Clock();
      this.walkPhase = 0;
      this.wingSongPhase = 0;

      // Raycasting for laser ablation and neuron inspection
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      this.hoveredNeuron = null;
      this.selectedNeuron = null;
      this.onNeuronSelectCallback = null;

      // Laser ablation cursor mode
      this.isAblationToolActive = false;

      // Simulation timescale (1.0 = real-time, 0.25 = slow-mo, 2.0 = fast)
      this.simulationSpeed = 1.0;

      // Smooth camera fly-to transition state
      this.isCameraAnimating = false;
      this.cameraTargetPos = new THREE.Vector3();
      this.controlsTargetPos = new THREE.Vector3();
      this.cameraAnimDuration = 1.2;
      this.cameraAnimElapsed = 0;
      this.cameraStartPos = new THREE.Vector3();
      this.controlsStartTarget = new THREE.Vector3();

      // Highlighted anatomical circuit in guided tour
      this.highlightedRegion = null;

      this.init();
    }

    init() {
      // Scene setup
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x060810);
      this.scene.fog = new THREE.FogExp2(0x060810, 0.0035);

      // Camera
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      this.camera.position.set(0, 15, 120);

      // WebGL Renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;
      this.container.appendChild(this.renderer.domElement);

      // Controls (OrbitControls from Three.js CDN)
      if (window.THREE.OrbitControls) {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 400;
        this.controls.minDistance = 15;
      }

      // Lighting
      const ambientLight = new THREE.AmbientLight(0x334466, 1.2);
      this.scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0x00e5ff, 1.5);
      dirLight1.position.set(50, 80, 50);
      this.scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0xff007f, 1.2);
      dirLight2.position.set(-50, -40, -50);
      this.scene.add(dirLight2);

      const spotLight = new THREE.SpotLight(0xffffff, 2.0);
      spotLight.position.set(0, 100, 80);
      spotLight.angle = Math.PI / 4;
      spotLight.penumbra = 0.8;
      this.scene.add(spotLight);

      // Add groups to scene
      this.scene.add(this.brainGroup);
      this.scene.add(this.organismGroup);
      this.scene.add(this.dimorphismGroup);
      this.scene.add(this.pulsesGroup);

      // Build 3D sub-components
      this.buildConnectomeVisualization();
      this.buildArticulatedFlyOrganism();
      this.buildDimorphismComparativeOverlay();
      this.buildExperimentalArena();

      // Set initial layout
      this.updateLayout(this.viewMode);

      // Window resize listener
      window.addEventListener('resize', () => this.onResize());

      // Mouse interaction for neuron hover/ablation
      this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
      this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
    }

    /**
     * Constructs the 3D Male Fruit Fly Connectome (Brain + VNC)
     */
    buildConnectomeVisualization() {
      const neurons = this.neuralEngine.neurons;
      const synapses = this.neuralEngine.synapses;
      const themes = this.connectomeData.REGION_THEMES;

      // 1. Soma Sphere Mesh Instancing / Points
      const somaGeo = new THREE.SphereGeometry(0.75, 12, 12);

      neurons.forEach((n) => {
        const theme = themes[n.region] || themes.CENTRAL_COMPLEX;
        const color = new THREE.Color(theme.color);

        const mat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.5,
          roughness: 0.3,
          metalness: 0.7
        });

        const mesh = new THREE.Mesh(somaGeo, mat);
        mesh.position.set(n.pos.x, n.pos.y, n.pos.z);
        mesh.userData = { neuron: n, neuronId: n.id, originalColor: color.clone(), baseScale: 1.0 };
        this.brainGroup.add(mesh);
        this.somaMeshes.push(mesh);
      });

      // 2. Synaptic Fiber Bundles (Glowing axonal paths)
      const linePositions = [];
      const lineColors = [];

      synapses.forEach(syn => {
        const src = neurons[syn.source];
        const tgt = neurons[syn.target];
        if (!src || !tgt) return;

        linePositions.push(src.pos.x, src.pos.y, src.pos.z);
        linePositions.push(tgt.pos.x, tgt.pos.y, tgt.pos.z);

        const srcColor = new THREE.Color((themes[src.region] || themes.CENTRAL_COMPLEX).color);
        const tgtColor = new THREE.Color((themes[tgt.region] || themes.CENTRAL_COMPLEX).color);

        lineColors.push(srcColor.r * 0.4, srcColor.g * 0.4, srcColor.b * 0.4);
        lineColors.push(tgtColor.r * 0.4, tgtColor.g * 0.4, tgtColor.b * 0.4);
      });

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));

      const lineMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });

      const fiberSegments = new THREE.LineSegments(lineGeo, lineMat);
      this.brainGroup.add(fiberSegments);

      // 3. Translucent Brain Shell (Surface Morphology Envelope)
      this.createBrainEnvelope();
    }

    /**
     * Translucent shell representing the Drosophila brain capsule and ventral nerve cord
     */
    createBrainEnvelope() {
      // Central Brain Hull
      const headCapsuleGeo = new THREE.SphereGeometry(22, 24, 24);
      headCapsuleGeo.scale(1.4, 0.9, 0.8);
      const capsuleMat = new THREE.MeshPhysicalMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.08,
        roughness: 0.1,
        transmission: 0.8,
        wireframe: false
      });
      const brainShell = new THREE.Mesh(headCapsuleGeo, capsuleMat);
      brainShell.position.set(0, 20, 0);
      this.brainGroup.add(brainShell);

      // VNC (Ventral Nerve Cord) Elongated Spinal Hull
      const vncGeo = new THREE.CylinderGeometry(6, 4, 46, 16);
      const vncMat = new THREE.MeshPhysicalMaterial({
        color: 0x3399ff,
        transparent: true,
        opacity: 0.07,
        roughness: 0.2,
        transmission: 0.7
      });
      const vncShell = new THREE.Mesh(vncGeo, vncMat);
      vncShell.position.set(0, -22, 0);
      this.brainGroup.add(vncShell);
    }

    /**
     * Builds the 3D Physically Articulated Fruit Fly Organism
     */
    buildArticulatedFlyOrganism() {
      const fly = new THREE.Group();
      this.flyParts.root = fly;

      // Fly Materials
      const cuticleMat = new THREE.MeshStandardMaterial({
        color: 0xc48243, // Golden-brown fruit fly amber cuticle
        roughness: 0.4,
        metalness: 0.2
      });

      const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xb31414, // Brilliant ruby-red compound eye
        roughness: 0.25,
        metalness: 0.4,
        emissive: 0x3a0000
      });

      const abdomenMat = new THREE.MeshStandardMaterial({
        color: 0xa86a32,
        roughness: 0.45,
        metalness: 0.15
      });

      const darkMaleTipMat = new THREE.MeshStandardMaterial({
        color: 0x221810, // Dark male-specific abdominal tip
        roughness: 0.5,
        metalness: 0.2
      });

      // Wing Material (Delicate translucent chitin with bio-luminescent sheen)
      const wingMat = new THREE.MeshPhysicalMaterial({
        color: 0xf0f8ff,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
        transmission: 0.75,
        clearcoat: 1.0,
        side: THREE.DoubleSide
      });

      // 1. Thorax
      const thoraxGeo = new THREE.SphereGeometry(4.2, 16, 16);
      thoraxGeo.scale(1.0, 1.2, 1.4);
      const thorax = new THREE.Mesh(thoraxGeo, cuticleMat);
      thorax.position.set(0, 0, 0);
      fly.add(thorax);
      this.flyParts.body = thorax;

      // 2. Head
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 1.0, 6.0);
      const headGeo = new THREE.SphereGeometry(3.0, 16, 16);
      headGeo.scale(1.3, 1.0, 0.9);
      const headMesh = new THREE.Mesh(headGeo, cuticleMat);
      headGroup.add(headMesh);

      // Large Compound Eyes (Ruby Red)
      const eyeGeo = new THREE.SphereGeometry(1.9, 14, 14);
      eyeGeo.scale(0.8, 1.2, 1.1);

      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-2.4, 0.4, 0.5);
      headGroup.add(eyeL);

      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(2.4, 0.4, 0.5);
      headGroup.add(eyeR);

      // Antennae
      const antGeo = new THREE.CylinderGeometry(0.12, 0.08, 2.0, 8);
      antGeo.translate(0, 1.0, 0);

      const antL = new THREE.Mesh(antGeo, cuticleMat);
      antL.position.set(-0.8, 1.2, 2.4);
      antL.rotation.set(0.6, -0.4, -0.4);
      headGroup.add(antL);
      this.flyParts.antennaeL = antL;

      const antR = new THREE.Mesh(antGeo, cuticleMat);
      antR.position.set(0.8, 1.2, 2.4);
      antR.rotation.set(0.6, 0.4, 0.4);
      headGroup.add(antR);
      this.flyParts.antennaeR = antR;

      // Proboscis (Feeder)
      const probGeo = new THREE.CylinderGeometry(0.4, 0.3, 2.5, 8);
      probGeo.translate(0, -1.2, 0);
      const proboscis = new THREE.Mesh(probGeo, cuticleMat);
      proboscis.position.set(0, -1.8, 1.8);
      proboscis.rotation.x = 0.5;
      headGroup.add(proboscis);
      this.flyParts.proboscis = proboscis;

      fly.add(headGroup);
      this.flyParts.head = headGroup;

      // 3. Abdomen (Segmented + Dark Male Posterior Tip)
      const abdomenGroup = new THREE.Group();
      abdomenGroup.position.set(0, -0.8, -5.2);

      // Abdominal segments
      for (let s = 0; s < 5; s++) {
        const r = 3.6 - s * 0.45;
        const segGeo = new THREE.SphereGeometry(r, 14, 14);
        segGeo.scale(1.0, 0.9, 0.8);
        const segMat = (s >= 3) ? darkMaleTipMat : abdomenMat;
        const seg = new THREE.Mesh(segGeo, segMat);
        seg.position.set(0, -s * 0.3, -s * 1.8);
        abdomenGroup.add(seg);
      }
      fly.add(abdomenGroup);

      // 4. Wings (Articulated at thorax wing hinges)
      // Left Wing
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.bezierCurveTo(4, 3, 14, 4, 18, 0);
      wingShape.bezierCurveTo(15, -4, 6, -3, 0, 0);
      const wingGeo = new THREE.ShapeGeometry(wingShape);

      const wingLGroup = new THREE.Group();
      wingLGroup.position.set(-2.0, 3.2, -1.0);
      const wingLMesh = new THREE.Mesh(wingGeo, wingMat);
      wingLMesh.rotation.set(-Math.PI / 2, -0.2, -0.3);
      wingLGroup.add(wingLMesh);
      fly.add(wingLGroup);
      this.flyParts.leftWing = wingLGroup;

      // Right Wing
      const wingRGroup = new THREE.Group();
      wingRGroup.position.set(2.0, 3.2, -1.0);
      const wingRMesh = new THREE.Mesh(wingGeo, wingMat);
      wingRMesh.rotation.set(-Math.PI / 2, 0.2, 0.3);
      wingRMesh.scale.set(1, -1, 1);
      wingRGroup.add(wingRMesh);
      fly.add(wingRGroup);
      this.flyParts.rightWing = wingRGroup;

      // 5. Six Articulated Legs (Front T1, Middle T2, Hind T3)
      const legConfigs = [
        { side: -1, z: 2.0, name: 'T1_L', angle: 0.6 },
        { side: 1, z: 2.0, name: 'T1_R', angle: -0.6 },
        { side: -1, z: 0.0, name: 'T2_L', angle: 0.1 },
        { side: 1, z: 0.0, name: 'T2_R', angle: -0.1 },
        { side: -1, z: -2.5, name: 'T3_L', angle: -0.7 },
        { side: 1, z: -2.5, name: 'T3_R', angle: 0.7 }
      ];

      legConfigs.forEach((cfg) => {
        const legGroup = new THREE.Group();
        legGroup.position.set(cfg.side * 2.8, -1.5, cfg.z);

        // Coxa / Femur
        const femurGeo = new THREE.CylinderGeometry(0.25, 0.2, 4.0, 6);
        femurGeo.translate(0, -2.0, 0);
        const femur = new THREE.Mesh(femurGeo, cuticleMat);
        femur.rotation.set(0, 0, cfg.side * 0.7);

        // Tibia
        const tibiaGeo = new THREE.CylinderGeometry(0.18, 0.12, 4.5, 6);
        tibiaGeo.translate(0, -2.25, 0);
        const tibia = new THREE.Mesh(tibiaGeo, cuticleMat);
        tibia.position.set(cfg.side * 2.5, -3.2, 0);
        tibia.rotation.set(0, 0, -cfg.side * 0.9);

        legGroup.add(femur);
        legGroup.add(tibia);
        legGroup.rotation.y = cfg.angle;

        fly.add(legGroup);
        this.flyParts.legs.push({ group: legGroup, config: cfg });
      });

      this.organismGroup.add(fly);
    }

    /**
     * Experimental Arena (Virtual flight/treadmill dome inspired by Janelia fly flight arena)
     */
    buildExperimentalArena() {
      // Cylindrical visual arena with LED display stripes
      const arenaGeo = new THREE.CylinderGeometry(40, 40, 30, 32, 1, true);
      const arenaMat = new THREE.MeshBasicMaterial({
        color: 0x101b2b,
        wireframe: true,
        transparent: true,
        opacity: 0.25
      });
      const arena = new THREE.Mesh(arenaGeo, arenaMat);
      arena.position.set(50, 0, 0);
      this.organismGroup.add(arena);

      // Floor grid
      const gridHelper = new THREE.GridHelper(90, 30, 0x00e5ff, 0x112233);
      gridHelper.position.set(50, -12, 0);
      this.organismGroup.add(gridHelper);
    }

    /**
     * Sexual Dimorphism Comparative Overlay
     * Directly showcases the AOTU008 / P1 neural pathway discovered in Google's Cell paper
     */
    buildDimorphismComparativeOverlay() {
      const group = this.dimorphismGroup;
      group.visible = false;

      // 1. Male-Specific Branches (Neon Cyan)
      const maleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-3.5, 17, 0),
        new THREE.Vector3(-6.5, 22, 2),  // Lateral expansion
        new THREE.Vector3(-1.2, 24, 4),  // Midline crossing
        new THREE.Vector3(0.0, 23, 3),   // Bilateral P1 courtship bridge
        new THREE.Vector3(1.2, 24, 4),
        new THREE.Vector3(6.5, 22, 2),
        new THREE.Vector3(3.5, 17, 0)
      ]);
      const maleGeo = new THREE.TubeGeometry(maleCurve, 64, 0.45, 8, false);
      const maleMat = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.9,
        roughness: 0.2
      });
      const maleMesh = new THREE.Mesh(maleGeo, maleMat);
      group.add(maleMesh);

      // 2. Female Streamlined Pathway (Neon Magenta - lacks the lateral and midline branches)
      const femaleCurveL = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-3.5, 17, -5),
        new THREE.Vector3(-4.0, 20, -4.5),
        new THREE.Vector3(-3.5, 22, -5)
      ]);
      const femaleGeo = new THREE.TubeGeometry(femaleCurveL, 32, 0.35, 8, false);
      const femaleMat = new THREE.MeshStandardMaterial({
        color: 0xff007f,
        emissive: 0xff007f,
        emissiveIntensity: 0.8,
        roughness: 0.2
      });
      const femaleMesh = new THREE.Mesh(femaleGeo, femaleMat);
      group.add(femaleMesh);
    }

    /**
     * Updates 3D layouts based on selected view mode
     */
    updateLayout(mode) {
      this.viewMode = mode;

      if (mode === 'split') {
        // Dual view: Connectome Brain on Left, Living Organism on Right
        this.brainGroup.visible = true;
        this.organismGroup.visible = true;
        this.dimorphismGroup.visible = false;
        this.brainGroup.position.set(-45, 0, 0);
        this.organismGroup.position.set(45, 0, 0);
        if (this.controls) {
          this.controls.target.set(0, 0, 0);
          this.camera.position.set(0, 25, 150);
        }
      } else if (mode === 'brain') {
        // Pure Brain Connectome Exploration
        this.brainGroup.visible = true;
        this.organismGroup.visible = false;
        this.dimorphismGroup.visible = false;
        this.brainGroup.position.set(0, 0, 0);
        if (this.controls) {
          this.controls.target.set(0, 0, 0);
          this.camera.position.set(0, 10, 100);
        }
      } else if (mode === 'organism') {
        // Pure Living Organism Macro View
        this.brainGroup.visible = false;
        this.organismGroup.visible = true;
        this.dimorphismGroup.visible = false;
        this.organismGroup.position.set(0, 0, 0);
        if (this.controls) {
          this.controls.target.set(0, 0, 0);
          this.camera.position.set(0, 12, 55);
        }
      } else if (mode === 'dimorphism') {
        // Google Research Dimorphism Comparison Mode
        this.brainGroup.visible = true;
        this.organismGroup.visible = false;
        this.dimorphismGroup.visible = true;
        this.brainGroup.position.set(0, 0, 0);
        this.dimorphismGroup.position.set(0, 0, 0);
        if (this.controls) {
          this.controls.target.set(0, 20, 0);
          this.camera.position.set(0, 25, 65);
        }
      }
    }

    /**
     * Primary Animation & Render Loop (called every requestAnimationFrame)
     */
    animate() {
      const rawDelta = this.clock.getDelta();
      // Bound raw delta to prevent huge jumps on tab switch
      const clampedDelta = Math.min(rawDelta, 0.1);
      const delta = clampedDelta * this.simulationSpeed;
      const time = this.clock.getElapsedTime();

      // Smooth camera interpolation if transitioning
      if (this.isCameraAnimating) {
        this.cameraAnimElapsed += clampedDelta;
        const progress = Math.min(1.0, this.cameraAnimElapsed / this.cameraAnimDuration);
        // Smooth ease-in-out cubic
        const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        this.camera.position.lerpVectors(this.cameraStartPos, this.cameraTargetPos, ease);
        if (this.controls) {
          this.controls.target.lerpVectors(this.controlsStartTarget, this.controlsTargetPos, ease);
        }

        if (progress >= 1.0) {
          this.isCameraAnimating = false;
        }
      }

      // 1. Advance neural simulation scaled by simulationSpeed
      this.neuralEngine.step(2.0 * this.simulationSpeed);

      // 2. Animate Action Potential Spikes (Glowing traveling pulses)
      this.updateSpikeVisuals(delta);

      // 3. Animate the Physically Articulated Fly Organism
      this.updateFlyKinematics(time, delta);

      // 4. Update camera controls
      if (this.controls && !this.isCameraAnimating) {
        this.controls.update();
      }

      // 5. Render Scene
      this.renderer.render(this.scene, this.camera);
    }

    /**
     * Smoothly flies camera to focus on an anatomical region or target position
     */
    flyToCamera(targetCamPos, targetLookAt, duration = 1.2) {
      this.cameraStartPos.copy(this.camera.position);
      if (this.controls) {
        this.controlsStartTarget.copy(this.controls.target);
      } else {
        this.controlsStartTarget.set(0, 0, 0);
      }

      this.cameraTargetPos.copy(targetCamPos);
      this.controlsTargetPos.copy(targetLookAt);

      this.cameraAnimDuration = duration;
      this.cameraAnimElapsed = 0;
      this.isCameraAnimating = true;
    }

    /**
     * Sets the simulation timescale multiplier (0.25 = slow-mo, 1.0 = normal, 2.0 = fast)
     */
    setSimulationSpeed(speed) {
      this.simulationSpeed = Math.max(0.1, Math.min(speed, 5.0));
    }

    /**
     * Highlights an anatomical super-region in the connectome
     */
    highlightRegion(regionName) {
      this.highlightedRegion = regionName;

      this.somaMeshes.forEach(mesh => {
        const neuron = mesh.userData.neuron;
        if (!neuron) return;

        if (!regionName) {
          // Reset all to original colors and resting opacity
          const orig = mesh.userData.originalColor;
          mesh.material.color.copy(orig);
          mesh.material.emissive.copy(orig);
          mesh.material.emissiveIntensity = 0.5;
          mesh.material.opacity = 0.95;
          mesh.scale.setScalar(1.0);
        } else {
          const matches = (neuron.region === regionName) || 
                          (regionName === 'VNC' && neuron.region.startsWith('VNC_')) ||
                          (regionName === 'CENTRAL_COMPLEX' && (neuron.region === 'CENTRAL_COMPLEX' || neuron.tags.includes('compass'))) ||
                          (regionName === 'OPTIC' && neuron.region === 'OPTIC') ||
                          (regionName === 'MUSHROOM_BODY' && neuron.region === 'MUSHROOM_BODY') ||
                          (regionName === 'P1_COURTSHIP' && neuron.region === 'P1_COURTSHIP') ||
                          (regionName === 'GIANT_FIBER' && (neuron.region === 'GIANT_FIBER' || neuron.tags.includes('escape')));
          
          if (matches) {
            mesh.material.emissiveIntensity = 2.4;
            mesh.material.opacity = 1.0;
            mesh.scale.setScalar(1.4);
          } else {
            mesh.material.emissiveIntensity = 0.1;
            mesh.material.opacity = 0.2;
            mesh.scale.setScalar(0.7);
          }
        }
      });
    }

    /**
     * Animates glowing soma nodes and traveling axonal action-potential particles
     */
    updateSpikeVisuals(delta) {
      const activeSpikes = this.neuralEngine.activeSpikesThisTick;
      const neurons = this.neuralEngine.neurons;

      // Spawn action potential pulse particles
      activeSpikes.forEach(spk => {
        const mesh = this.somaMeshes[spk.neuronId];
        if (mesh) {
          // Flash soma node brightly
          mesh.material.emissiveIntensity = 2.8;
          mesh.scale.setScalar(1.9);
        }

        // Spawn pulse particle travelling to targets
        const outSynapses = this.neuralEngine.outgoingSynapses.get(spk.neuronId);
        if (outSynapses && outSynapses.length > 0) {
          // Spawn up to 3 particles for performance
          const sample = outSynapses.slice(0, 3);
          sample.forEach(syn => {
            const tgt = neurons[syn.target];
            if (tgt) {
              this.spawnPulseParticle(spk.pos, tgt.pos, spk.neurotransmitter);
            }
          });
        }
      });

      // Decay soma glow back to resting level
      this.somaMeshes.forEach(mesh => {
        if (mesh.material.emissiveIntensity > 0.5) {
          mesh.material.emissiveIntensity = Math.max(0.5, mesh.material.emissiveIntensity - delta * 4.0);
          const currentScale = mesh.scale.x;
          if (currentScale > 1.0) {
            mesh.scale.setScalar(Math.max(1.0, currentScale - delta * 3.5));
          }
        }
      });

      // Update travelling pulse particles
      const remainingPulses = [];
      for (let i = 0; i < this.activePulseParticles.length; i++) {
        const p = this.activePulseParticles[i];
        p.progress += delta * p.speed;

        if (p.progress >= 1.0) {
          // Remove particle
          this.pulsesGroup.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
        } else {
          // Interpolate position along axonal trajectory
          p.mesh.position.lerpVectors(p.start, p.end, p.progress);
          // Add subtle wave curvature
          p.mesh.position.y += Math.sin(p.progress * Math.PI) * 0.6;
          remainingPulses.push(p);
        }
      }
      this.activePulseParticles = remainingPulses;
    }

    /**
     * Spawns a glowing photon particle moving along a synapse
     */
    spawnPulseParticle(startPos, endPos, ntType) {
      if (this.activePulseParticles.length > 120) return; // Prevent memory saturation

      const ntInfo = this.connectomeData.NEUROTRANSMITTERS[ntType] || this.connectomeData.NEUROTRANSMITTERS.ACh;
      const color = new THREE.Color(ntInfo.color);

      const geo = new THREE.SphereGeometry(0.35, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(startPos.x, startPos.y, startPos.z);
      this.pulsesGroup.add(mesh);

      this.activePulseParticles.push({
        mesh: mesh,
        start: new THREE.Vector3(startPos.x, startPos.y, startPos.z),
        end: new THREE.Vector3(endPos.x, endPos.y, endPos.z),
        progress: 0.0,
        speed: 1.8 * (ntInfo.speed || 1.0)
      });
    }

    /**
     * Translates the Connectome Motor States directly into the 3D Articulated Fly Model
     */
    updateFlyKinematics(time, delta) {
      const parts = this.flyParts;
      if (!parts.root) return;

      const behavior = this.neuralEngine.currentBehavior;
      const headingRad = this.neuralEngine.compassHeadingRad;

      // 1. Heading Orientation (Aligned with Central Complex Ring Attractor compass)
      parts.root.rotation.y = THREE.MathUtils.lerp(parts.root.rotation.y, -headingRad, delta * 3.0);

      // 2. Behavior Kinematics
      if (behavior === 'COURTSHIP_SINGING') {
        // Authentic Male Courtship Behavior:
        // Unilaterally extends one wing at ~90 degrees and vibrates it at high frequency!
        this.wingSongPhase += delta * 65.0; // High speed vibration (~35-160Hz equivalent)
        const wingVibe = Math.sin(this.wingSongPhase) * 0.45;

        // Extend left wing at 90 degrees and vibrate
        parts.leftWing.rotation.z = -1.57 + wingVibe;
        parts.leftWing.rotation.x = Math.sin(this.wingSongPhase * 0.5) * 0.2;

        // Right wing stays resting
        parts.rightWing.rotation.z = 0.2;

        // Courting abdomen twitch
        parts.body.position.y = Math.sin(time * 8.0) * 0.4;
      } else if (behavior === 'ESCAPE_TAKEOFF') {
        // Giant Fiber Jump Reflex:
        // Explosive extension of hind legs + synchronous wing beat takeoff!
        parts.root.position.y = THREE.MathUtils.lerp(parts.root.position.y, 16.0, delta * 8.0);
        const fastFlap = Math.sin(time * 75.0) * 0.8;
        parts.leftWing.rotation.z = fastFlap;
        parts.rightWing.rotation.z = -fastFlap;
      } else if (behavior === 'GROOMING_ANTENNA') {
        // Front leg grooming sequence
        parts.root.position.y = THREE.MathUtils.lerp(parts.root.position.y, 0, delta * 4.0);
        parts.leftWing.rotation.z = 0;
        parts.rightWing.rotation.z = 0;

        // Front legs (index 0 and 1) brush head and antennae
        const groomPhase = Math.sin(time * 12.0) * 0.6;
        parts.legs[0].group.rotation.x = 0.8 + groomPhase;
        parts.legs[1].group.rotation.x = 0.8 - groomPhase;
        parts.antennaeL.rotation.x = 0.6 + groomPhase * 0.3;
        parts.antennaeR.rotation.x = 0.6 - groomPhase * 0.3;
      } else {
        // Normal tripod walking locomotion
        parts.root.position.y = THREE.MathUtils.lerp(parts.root.position.y, 0, delta * 4.0);
        parts.leftWing.rotation.z = 0;
        parts.rightWing.rotation.z = 0;

        this.walkPhase += delta * 9.0;
        // Alternating tripod hexapod gait
        parts.legs.forEach((leg, idx) => {
          const tripPhase = (idx % 2 === 0) ? this.walkPhase : this.walkPhase + Math.PI;
          leg.group.rotation.x = Math.sin(tripPhase) * 0.35;
          leg.group.rotation.z = (leg.config.side * 0.2) + Math.cos(tripPhase) * 0.15;
        });

        // Head subtle scanning
        parts.head.rotation.y = Math.sin(time * 2.0) * 0.15;
      }
    }

    /**
     * Pointer move handler for raycasting interactive neurons
     */
    onPointerMove(event) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      if (!this.brainGroup.visible) return;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.somaMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (this.hoveredNeuron !== hit) {
          if (this.hoveredNeuron && this.hoveredNeuron !== this.selectedNeuron) {
            this.hoveredNeuron.scale.setScalar(this.hoveredNeuron.userData.baseScale);
          }
          this.hoveredNeuron = hit;
          hit.scale.setScalar(1.6);
          this.renderer.domElement.style.cursor = this.isAblationToolActive ? 'crosshair' : 'pointer';
        }
      } else {
        if (this.hoveredNeuron && this.hoveredNeuron !== this.selectedNeuron) {
          this.hoveredNeuron.scale.setScalar(this.hoveredNeuron.userData.baseScale);
        }
        this.hoveredNeuron = null;
        this.renderer.domElement.style.cursor = 'default';
      }
    }

    /**
     * Click handler for neuron selection or laser micro-ablation
     */
    onClick(event) {
      if (!this.hoveredNeuron) return;

      const neuronId = this.hoveredNeuron.userData.neuronId;
      const neuron = this.neuralEngine.neurons[neuronId];

      if (this.isAblationToolActive) {
        // Toggle ablation
        const isAblated = this.neuralEngine.toggleAblation(neuronId);
        if (isAblated) {
          this.hoveredNeuron.material.color.set(0x222222);
          this.hoveredNeuron.material.emissive.set(0x000000);
        } else {
          const original = this.hoveredNeuron.userData.originalColor;
          this.hoveredNeuron.material.color.copy(original);
          this.hoveredNeuron.material.emissive.copy(original);
        }
      }

      this.selectedNeuron = this.hoveredNeuron;
      if (this.onNeuronSelectCallback) {
        this.onNeuronSelectCallback(neuron, this.neuralEngine.ablatedNeurons.has(neuronId));
      }
    }

    onResize() {
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  window.DrosomindRenderer = FlyRenderer3D;
})(window);
