/**
 * DROSOMIND - Connectome Anatomical & Synaptic Data
 * Based on the Google Research & HHMI Janelia Male Fruit Fly Connectome (Cell 2026)
 * "Sexual dimorphism in the complete connectome of the Drosophila male central nervous system"
 * 
 * Maps anatomical regions:
 * 1. Optic Lobes (Medulla, Lobula, Lobula Plate Tangential Cells: HS/VS)
 * 2. Central Complex (Ellipsoid Body compass ring attractor, Protocerebral Bridge, Fan-shaped Body)
 * 3. Antennal Lobes & Mushroom Bodies (Olfactory glomeruli, Kenyon cells, MBONs)
 * 4. P1 Courtship Cluster (Sexually dimorphic Fru+/Dsx+ male command hub)
 * 5. Giant Fiber Escape Neurons (Looming predator triggered takeoff)
 * 6. Descending Neurons (DNs linking brain to VNC)
 * 7. Ventral Nerve Cord (VNC: Prothoracic T1, Mesothoracic T2, Metathoracic T3, Abdominal neuromeres)
 * 8. Sexual Dimorphism morphology (AOTU008 male-specific arborizations vs female)
 */

(function(window) {
  'use strict';

  // Brain Super-Regions & Palettes
  const REGION_THEMES = {
    OPTIC: { name: 'Optic Lobes', color: '#00e5ff', glow: '#00aacc', emissive: 0x00e5ff },
    CENTRAL_COMPLEX: { name: 'Central Complex (Compass)', color: '#00ff88', glow: '#00cc66', emissive: 0x00ff88 },
    MUSHROOM_BODY: { name: 'Mushroom Body (Memory)', color: '#ffd700', glow: '#cca000', emissive: 0xffd700 },
    P1_COURTSHIP: { name: 'P1 Courtship Hub (Male-Specific)', color: '#ff007f', glow: '#cc0066', emissive: 0xff007f },
    GIANT_FIBER: { name: 'Giant Fiber (Escape)', color: '#ff3300', glow: '#cc2200', emissive: 0xff3300 },
    DESCENDING: { name: 'Descending Neurons (DN)', color: '#b388ff', glow: '#7c4dff', emissive: 0xb388ff },
    VNC_T1: { name: 'VNC T1 (Front Legs & Grooming)', color: '#3399ff', glow: '#2277cc', emissive: 0x3399ff },
    VNC_T2: { name: 'VNC T2 (Wings & Courtship Song)', color: '#ff5500', glow: '#cc4400', emissive: 0xff5500 },
    VNC_T3: { name: 'VNC T3 (Hind Legs & Jump)', color: '#00e676', glow: '#00b0ff', emissive: 0x00e676 },
    VNC_ABDOMEN: { name: 'VNC Abdominal Neuromere', color: '#e040fb', glow: '#aa00ff', emissive: 0xe040fb }
  };

  // Neurotransmitter definitions
  const NEUROTRANSMITTERS = {
    ACh: { name: 'Acetylcholine', type: 'excitatory', color: '#00ffcc', speed: 1.0 },
    GABA: { name: 'GABA', type: 'inhibitory', color: '#ff3366', speed: 0.8 },
    GLU: { name: 'Glutamate', type: 'excitatory', color: '#ffff33', speed: 1.1 },
    DA: { name: 'Dopamine', type: 'modulatory', color: '#ff9900', speed: 0.6 },
    OCT: { name: 'Octopamine', type: 'arousal', color: '#cc00ff', speed: 0.9 }
  };

  /**
   * Generates realistic 3D morphological neuron arborizations (soma, dendrites, axon terminal)
   */
  function generateConnectomeGraph() {
    const neurons = [];
    const synapses = [];
    let neuronId = 0;

    // Helper to add neuron
    function addNeuron(spec) {
      const id = neuronId++;
      const neuron = {
        id: id,
        name: spec.name || `N-${id}`,
        region: spec.region,
        pos: { x: spec.x, y: spec.y, z: spec.z },
        dendriteBranches: spec.branches || [],
        threshold: spec.threshold || -50.0,
        resting: spec.resting || -65.0,
        voltage: spec.resting || -65.0,
        lastSpikeTime: -999,
        refractoryUntil: 0,
        neurotransmitter: spec.nt || 'ACh',
        isSexuallyDimorphic: spec.dimorphic || false,
        maleSpecific: spec.maleSpecific || false,
        femaleAltBranches: spec.femaleAltBranches || null,
        tags: spec.tags || []
      };
      neurons.push(neuron);
      return id;
    }

    // 1. OPTIC LOBES (Left and Right: Compound eyes -> Medulla -> Lobula Plate)
    // Lobula Plate Tangential Cells (LPTCs): HS (Horizontal System) & VS (Vertical System)
    const leftOpticIds = [];
    const rightOpticIds = [];

    // Left Optic Lobe array (x: -32 to -18, y: 15 to 30, z: -10 to 15)
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 1.5 - 0.5;
      const radius = 9 + (i % 3) * 1.8;
      const x = -26 + Math.cos(angle) * radius;
      const y = 20 + Math.sin(angle) * radius;
      const z = -4 + (i % 5) * 3;
      const isHS = i % 2 === 0;
      const id = addNeuron({
        name: isHS ? `L_HS_${i/2}` : `L_VS_${Math.floor(i/2)}`,
        region: 'OPTIC',
        x: x, y: y, z: z,
        nt: 'ACh',
        tags: ['visual', isHS ? 'horizontal_motion' : 'vertical_motion', 'left_eye']
      });
      leftOpticIds.push(id);
    }

    // Right Optic Lobe array (x: +18 to +32, y: 15 to 30, z: -10 to 15)
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 1.5 - 0.5;
      const radius = 9 + (i % 3) * 1.8;
      const x = 26 - Math.cos(angle) * radius;
      const y = 20 + Math.sin(angle) * radius;
      const z = -4 + (i % 5) * 3;
      const isHS = i % 2 === 0;
      const id = addNeuron({
        name: isHS ? `R_HS_${i/2}` : `R_VS_${Math.floor(i/2)}`,
        region: 'OPTIC',
        x: x, y: y, z: z,
        nt: 'ACh',
        tags: ['visual', isHS ? 'horizontal_motion' : 'vertical_motion', 'right_eye']
      });
      rightOpticIds.push(id);
    }

    // 2. CENTRAL COMPLEX (The Fly's Brain Navigation Compass & Heading Ring Attractor)
    // Ellipsoid Body (EB): Ring of 16 E-PG (Ellipsoid to Protocerebral bridge Gall) neurons
    const compassRingIds = [];
    const ringRadius = 5.2;
    const ringCenterY = 22;
    const ringCenterZ = 2;

    for (let i = 0; i < 16; i++) {
      const theta = (i / 16) * Math.PI * 2;
      const x = Math.sin(theta) * ringRadius;
      const y = ringCenterY + Math.cos(theta) * ringRadius;
      const z = ringCenterZ + Math.sin(theta * 2) * 1.2;
      const id = addNeuron({
        name: `EB_EPG_Wedge_${i}`,
        region: 'CENTRAL_COMPLEX',
        x: x, y: y, z: z,
        nt: 'GLU',
        tags: ['compass', 'ring_attractor', `wedge_${i}`]
      });
      compassRingIds.push(id);
    }

    // Protocerebral Bridge (PB) bridge neurons (8 on left, 8 on right)
    const pbNeuronIds = [];
    for (let side = -1; side <= 1; side += 2) {
      for (let glomerulus = 1; glomerulus <= 8; glomerulus++) {
        const x = side * (3 + glomerulus * 1.3);
        const y = 28 + (glomerulus * 0.4);
        const z = 6 + (glomerulus * 0.3);
        const id = addNeuron({
          name: `PB_${side < 0 ? 'L' : 'R'}${glomerulus}`,
          region: 'CENTRAL_COMPLEX',
          x: x, y: y, z: z,
          nt: 'ACh',
          tags: ['protocerebral_bridge', 'navigation']
        });
        pbNeuronIds.push(id);
      }
    }

    // 3. ANTENNAL LOBE & MUSHROOM BODY (Olfaction, Pheromone Detection, Associative Memory)
    // Left & Right Antennal Lobe Glomeruli (Sugar sweet Gr5a vs Bitter Gr66a vs cVA pheromone)
    const antennalLobeIds = [];
    const glomeruliTypes = ['Sweet_Gr5a', 'Pheromone_cVA', 'Food_Or42b', 'CO2_Gr21a', 'Bitter_Gr66a', 'Yeast_Or59b'];
    glomeruliTypes.forEach((type, idx) => {
      // Left
      const idL = addNeuron({
        name: `AL_L_${type}`,
        region: 'MUSHROOM_BODY',
        x: -7 - (idx * 0.8), y: 12 + (idx * 1.1), z: -8 + (idx * 0.9),
        nt: 'ACh',
        tags: ['olfaction', type.toLowerCase(), 'left_antenna']
      });
      // Right
      const idR = addNeuron({
        name: `AL_R_${type}`,
        region: 'MUSHROOM_BODY',
        x: 7 + (idx * 0.8), y: 12 + (idx * 1.1), z: -8 + (idx * 0.9),
        nt: 'ACh',
        tags: ['olfaction', type.toLowerCase(), 'right_antenna']
      });
      antennalLobeIds.push(idL, idR);
    });

    // Mushroom Body Kenyon Cells & MBONs (Mushroom Body Output Neurons)
    const mbNeuronIds = [];
    for (let i = 0; i < 24; i++) {
      const side = (i % 2 === 0) ? -1 : 1;
      const k = Math.floor(i / 2);
      const x = side * (8 + (k % 4) * 2.2);
      const y = 24 + Math.floor(k / 4) * 2.5;
      const z = -6 + (k % 3) * 3;
      const id = addNeuron({
        name: `MB_KC_${side < 0 ? 'L' : 'R'}_${k}`,
        region: 'MUSHROOM_BODY',
        x: x, y: y, z: z,
        nt: (i % 5 === 0) ? 'DA' : 'ACh',
        tags: ['kenyon_cell', 'memory', (i % 5 === 0) ? 'dopaminergic_reward' : 'associative']
      });
      mbNeuronIds.push(id);
    }

    // 4. P1 COURTSHIP CLUSTER & SEXUALLY DIMORPHIC PATHWAYS (Direct Landmark Finding in Google/Janelia Paper)
    // The P1 cluster: ~20 Fru+/Dsx+ neurons per hemisphere present ONLY in male flies!
    // Triggers wing extension, courtship song production, and female pursuit.
    const p1CourtshipIds = [];
    for (let i = 0; i < 18; i++) {
      const side = (i % 2 === 0) ? -1 : 1;
      const idx = Math.floor(i / 2);
      const x = side * (2.8 + (idx % 3) * 1.6);
      const y = 17 + (idx * 0.9);
      const z = -2 + (idx % 3) * 1.8;
      
      // Male-specific branches (AOTU008 / P1 bilateral branches as shown in Figure 3 of Google paper)
      const maleBranches = [
        { x: side * 3.0, y: 19, z: 0 },
        { x: side * 6.5, y: 22, z: 2 }, // Male-specific lateral branch
        { x: side * 1.2, y: 24, z: 4 }, // Male-specific crossing midline branch
        { x: 0, y: 23, z: 3 }           // Midline contact to contralateral P1
      ];

      // Female homologous neuron (much reduced, lacks lateral and midline branches)
      const femaleBranches = [
        { x: side * 3.0, y: 19, z: 0 },
        { x: side * 3.5, y: 20, z: 1 }  // Truncated, no courtship circuitry
      ];

      const id = addNeuron({
        name: `P1_Courtship_${side < 0 ? 'L' : 'R'}_${idx}`,
        region: 'P1_COURTSHIP',
        x: x, y: y, z: z,
        nt: 'ACh',
        dimorphic: true,
        maleSpecific: true,
        branches: maleBranches,
        femaleAltBranches: femaleBranches,
        tags: ['p1_courtship', 'sexual_dimorphism', 'fru_positive', 'wing_song_trigger']
      });
      p1CourtshipIds.push(id);
    }

    // 5. GIANT FIBER (GF) ESCAPE NEURONS (High-speed Looming Stimulus Detection)
    // Bilateral giant descending axons directly commanding explosive jump
    const giantFiberIds = [];
    for (let side = -1; side <= 1; side += 2) {
      const id = addNeuron({
        name: `GF_${side < 0 ? 'Left' : 'Right'}`,
        region: 'GIANT_FIBER',
        x: side * 3.5, y: 18, z: 3,
        nt: 'ACh',
        threshold: -45.0, // High sensitivity threshold
        tags: ['giant_fiber', 'escape_jump', 'predator_evasion']
      });
      giantFiberIds.push(id);
    }

    // 6. DESCENDING NEURONS (DNs) - Transmitting commands down the Cervical Connective (Neck)
    const descendingNeuronIds = [];
    const dnTypes = [
      { name: 'DNp09_Grooming', y: 10, z: 0, tag: 'grooming_command' },
      { name: 'DNa02_Steering', y: 9, z: 1, tag: 'steering_command' },
      { name: 'DNb01_FlightThrust', y: 8, z: -1, tag: 'flight_command' },
      { name: 'DNg02_CourtshipSong', y: 7, z: 2, tag: 'song_command' },
      { name: 'DNa01_EscapeTakeoff', y: 6, z: 0, tag: 'escape_command' }
    ];

    dnTypes.forEach((dn, idx) => {
      // Left and Right pairs
      [-1, 1].forEach(side => {
        const id = addNeuron({
          name: `${dn.name}_${side < 0 ? 'L' : 'R'}`,
          region: 'DESCENDING',
          x: side * (1.5 + idx * 0.5),
          y: dn.y,
          z: dn.z,
          nt: 'ACh',
          tags: ['descending_neuron', dn.tag]
        });
        descendingNeuronIds.push(id);
      });
    });

    // 7. VENTRAL NERVE CORD (VNC) - The "Spinal Cord" controlling Body & Limbs
    // Spans y: -2 to -45 (elongated thoracic and abdominal neuromeres)
    const vncIds = {
      T1: [], // Prothoracic: Front legs, antenna grooming
      T2: [], // Mesothoracic: Wings, power muscles, courtship song vibration motor pools
      T3: [], // Metathoracic: Hind legs, jumping tergotrochanteral motor neurons
      Abdomen: [] // Abdominal ganglion: copulatory flexion, abdominal bending
    };

    // T1 Neuromere (Front Legs & Grooming) (y: -3 to -11)
    for (let i = 0; i < 14; i++) {
      const side = (i % 2 === 0) ? -1 : 1;
      const k = Math.floor(i / 2);
      const id = addNeuron({
        name: `VNC_T1_Leg_${side < 0 ? 'L' : 'R'}_${k}`,
        region: 'VNC_T1',
        x: side * (2.5 + (k % 3) * 1.5),
        y: -4 - (k * 1.2),
        z: -1 + (k % 2) * 2,
        nt: 'ACh',
        tags: ['vnc', 'front_legs', 't1_grooming']
      });
      vncIds.T1.push(id);
    }

    // T2 Neuromere (Wings & Courtship Song Motor Pool) (y: -13 to -24)
    // Direct link to the Courtship Song Synthesizer!
    for (let i = 0; i < 18; i++) {
      const side = (i % 2 === 0) ? -1 : 1;
      const k = Math.floor(i / 2);
      const isSongMotor = (k >= 3 && k <= 6);
      const id = addNeuron({
        name: isSongMotor ? `VNC_T2_WingSong_MN_${side < 0 ? 'L' : 'R'}_${k}` : `VNC_T2_Flight_MN_${side < 0 ? 'L' : 'R'}_${k}`,
        region: 'VNC_T2',
        x: side * (3.0 + (k % 3) * 1.8),
        y: -14 - (k * 1.3),
        z: -2 + (k % 3) * 2,
        nt: 'GLU', // Motor neurons use glutamate
        tags: ['vnc', 'wings', isSongMotor ? 'courtship_song_motor' : 'flight_motor']
      });
      vncIds.T2.push(id);
    }

    // T3 Neuromere (Hind Legs & Jump Motor Neurons) (y: -26 to -34)
    for (let i = 0; i < 12; i++) {
      const side = (i % 2 === 0) ? -1 : 1;
      const k = Math.floor(i / 2);
      const isTTMn = (k === 0 || k === 1); // Tergotrochanteral motor neuron (giant jump muscle)
      const id = addNeuron({
        name: isTTMn ? `VNC_T3_TTMn_Jump_${side < 0 ? 'L' : 'R'}` : `VNC_T3_Leg_${side < 0 ? 'L' : 'R'}_${k}`,
        region: 'VNC_T3',
        x: side * (2.8 + (k % 3) * 1.6),
        y: -26 - (k * 1.2),
        z: -1 + (k % 2) * 2.2,
        nt: 'GLU',
        tags: ['vnc', 'hind_legs', isTTMn ? 'jump_motor' : 'locomotion']
      });
      vncIds.T3.push(id);
    }

    // Abdominal Neuromeres (y: -36 to -46)
    for (let i = 0; i < 10; i++) {
      const side = (i % 2 === 0) ? -1 : 1;
      const k = Math.floor(i / 2);
      const id = addNeuron({
        name: `VNC_Abdomen_${side < 0 ? 'L' : 'R'}_${k}`,
        region: 'VNC_ABDOMEN',
        x: side * (1.8 + (k % 2) * 1.2),
        y: -36 - (k * 1.8),
        z: 0 + (k % 2) * 1.5,
        nt: 'ACh',
        tags: ['vnc', 'abdomen', 'posture']
      });
      vncIds.Abdomen.push(id);
    }

    // -------------------------------------------------------------
    // SYNAPTIC WIRING MATRIX (Functionally biologically grounded)
    // -------------------------------------------------------------

    function addSynapse(sourceId, targetId, weight = 1.0, delay = 1.5) {
      if (sourceId === undefined || targetId === undefined) return;
      synapses.push({
        source: sourceId,
        target: targetId,
        weight: weight,
        delay: delay,
        neurotransmitter: neurons[sourceId].neurotransmitter
      });
    }

    // A. Visual Flow Circuit: Optic Lobes -> Central Complex Ring Attractor
    leftOpticIds.forEach((lId, idx) => {
      // Connect to left half of compass wedges
      const targetWedge = compassRingIds[idx % 8];
      addSynapse(lId, targetWedge, 0.85, 2.0);
      // Connect to steering descending neurons
      addSynapse(lId, descendingNeuronIds[2], 0.7, 1.8); // DNa02 Steering
    });

    rightOpticIds.forEach((rId, idx) => {
      // Connect to right half of compass wedges
      const targetWedge = compassRingIds[8 + (idx % 8)];
      addSynapse(rId, targetWedge, 0.85, 2.0);
      // Connect to steering descending neurons
      addSynapse(rId, descendingNeuronIds[3], 0.7, 1.8);
    });

    // B. Compass Ring Attractor Dynamics (Ring recurrent excitation + global inhibition)
    // Allows persistent mental heading representation
    for (let i = 0; i < 16; i++) {
      const selfId = compassRingIds[i];
      const nextId = compassRingIds[(i + 1) % 16];
      const prevId = compassRingIds[(i + 15) % 16];
      const oppId1 = compassRingIds[(i + 8) % 16];
      const oppId2 = compassRingIds[(i + 7) % 16];

      // Local recurrent excitation
      addSynapse(selfId, nextId, 0.45, 1.0);
      addSynapse(selfId, prevId, 0.45, 1.0);

      // Distal/Opposite inhibition (via GABAergic interneurons)
      addSynapse(selfId, oppId1, -0.6, 1.5);
      addSynapse(selfId, oppId2, -0.6, 1.5);
    }

    // C. Giant Fiber Escape Circuit: Visual Looming -> Giant Fiber -> T3 Jump Motor & Wings
    // Extremely fast, high weight synapses
    leftOpticIds.slice(0, 8).forEach(vId => {
      addSynapse(vId, giantFiberIds[0], 1.2, 0.8);
    });
    rightOpticIds.slice(0, 8).forEach(vId => {
      addSynapse(vId, giantFiberIds[1], 1.2, 0.8);
    });

    // Giant Fibers direct to Descending Escape and T3 Tergotrochanteral Jump Neurons
    giantFiberIds.forEach(gfId => {
      // Direct connection to Escape Takeoff DN
      addSynapse(gfId, descendingNeuronIds[8], 2.5, 0.5); // DNa01 Escape
      addSynapse(gfId, descendingNeuronIds[9], 2.5, 0.5);

      // Direct connection to T3 Jump Motor Neurons in VNC
      vncIds.T3.slice(0, 4).forEach(jumpMnId => {
        addSynapse(gfId, jumpMnId, 2.8, 1.0);
      });

      // Simultaneous wing depression to open wings for flight
      vncIds.T2.slice(0, 4).forEach(wingMnId => {
        addSynapse(gfId, wingMnId, 1.8, 1.2);
      });
    });

    // D. Olfactory Plume & Pheromone -> Antennal Lobe -> Mushroom Body -> P1 Courtship / Feeding
    antennalLobeIds.forEach(alId => {
      const neuron = neurons[alId];
      // Sugar odor -> activates Feeding / Proboscis & Front leg grooming
      if (neuron.tags.includes('sweet_gr5a') || neuron.tags.includes('yeast_or59b')) {
        mbNeuronIds.slice(0, 6).forEach(mbId => addSynapse(alId, mbId, 1.1, 1.5));
        vncIds.T1.slice(0, 4).forEach(t1Id => addSynapse(alId, t1Id, 0.9, 2.5));
      }
      // cVA Female Pheromone -> Directly activates Male P1 Courtship Hub!
      if (neuron.tags.includes('pheromone_cva')) {
        p1CourtshipIds.forEach(p1Id => {
          addSynapse(alId, p1Id, 1.4, 2.0);
        });
      }
    });

    // E. P1 Courtship Master Circuit -> Courtship Song DN -> VNC T2 Wing Vibration Motor Pool!
    // This is the core male-specific circuit highlighted in Google Research's Cell 2026 paper!
    p1CourtshipIds.forEach(p1Id => {
      // Self-sustaining reciprocal recurrent excitation among P1 cluster (arousal state)
      const partnerP1 = p1CourtshipIds[(p1Id + 1) % p1CourtshipIds.length];
      addSynapse(p1Id, partnerP1, 0.6, 1.2);

      // Connect to DNg02 Courtship Song Descending Neurons
      addSynapse(p1Id, descendingNeuronIds[6], 1.3, 1.8);
      addSynapse(p1Id, descendingNeuronIds[7], 1.3, 1.8);

      // Connect directly down to VNC T2 Wing Vibration Motor Pool (for acoustic song generation)
      vncIds.T2.filter(id => neurons[id].tags.includes('courtship_song_motor')).forEach(songMnId => {
        addSynapse(p1Id, songMnId, 1.2, 3.2);
      });

      // Connect to Abdominal flexion neuromere (for copulatory alignment)
      vncIds.Abdomen.slice(0, 4).forEach(abId => {
        addSynapse(p1Id, abId, 0.8, 3.5);
      });
    });

    // F. Descending Neurons -> Respective VNC Neuromeres
    // Grooming DN -> T1 front legs
    addSynapse(descendingNeuronIds[0], vncIds.T1[0], 1.2, 1.5);
    addSynapse(descendingNeuronIds[1], vncIds.T1[1], 1.2, 1.5);

    // Steering DN -> T2 wing modulation (yaw control)
    addSynapse(descendingNeuronIds[2], vncIds.T2[2], 0.9, 1.5);
    addSynapse(descendingNeuronIds[3], vncIds.T2[3], 0.9, 1.5);

    // Flight thrust DN -> T2 symmetrical wing beat
    addSynapse(descendingNeuronIds[4], vncIds.T2[0], 1.1, 1.5);
    addSynapse(descendingNeuronIds[5], vncIds.T2[1], 1.1, 1.5);

    return {
      neurons: neurons,
      synapses: synapses,
      groups: {
        leftOpticIds,
        rightOpticIds,
        compassRingIds,
        pbNeuronIds,
        antennalLobeIds,
        mbNeuronIds,
        p1CourtshipIds,
        giantFiberIds,
        descendingNeuronIds,
        vncIds
      }
    };
  }

  // Export to global window object
  window.DrosomindConnectome = {
    REGION_THEMES: REGION_THEMES,
    NEUROTRANSMITTERS: NEUROTRANSMITTERS,
    generateGraph: generateConnectomeGraph
  };

})(window);
