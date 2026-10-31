/**
 * We Fart Together — Procedural 3D Model Factory
 * Generates stylized low-poly characters, donut raft, obstacles, and props matching the reference clips.
 */

const ModelFactory = {
  // Shared materials for performance
  materials: {
    tubeOrange: new THREE.MeshStandardMaterial({ color: 0xff8a65, roughness: 0.5, metalness: 0.05 }),
    deckGreen: new THREE.MeshStandardMaterial({ color: 0x81c784, roughness: 0.7 }),
    handleDark: new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.4 }),
    handleGrip: new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.3 }),
    
    // Animal Materials
    capyBrown: new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 0.8 }),
    capySnout: new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7 }),
    hippoTeal: new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.8 }),
    hippoSnout: new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.7 }),
    blackEye: new THREE.MeshBasicMaterial({ color: 0x111111 }),
    pinkNose: new THREE.MeshStandardMaterial({ color: 0xf48fb1, roughness: 0.6 }),
    
    // Hazard Materials
    spikePurple: new THREE.MeshStandardMaterial({ color: 0xab47bc, roughness: 0.4 }),
    spikeWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }),
    woodBrown: new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.9 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 }),
    bannerYellow: new THREE.MeshStandardMaterial({ color: 0xfbc02d, roughness: 0.4 }),
    boostRed: new THREE.MeshStandardMaterial({ color: 0xff3d00, emissive: 0xd50000, roughness: 0.3 }),
    rockGrey: new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.9, flatShading: true })
  },

  /**
   * Build the Circular Donut Raft with 4 Handles
   */
  createRaft() {
    const group = new THREE.Group();
    group.name = "Raft";

    // 1. Inflatable Outer Donut Tube (Torus)
    const tubeGeo = new THREE.TorusGeometry(1.5, 0.45, 16, 32);
    tubeGeo.rotateX(Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeo, this.materials.tubeOrange);
    tube.castShadow = true;
    tube.receiveShadow = true;
    group.add(tube);

    // 2. Trampoline Inner Floor Disc
    const deckGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.12, 24);
    deckGeo.translate(0, -0.1, 0);
    const deck = new THREE.Mesh(deckGeo, this.materials.deckGreen);
    deck.receiveShadow = true;
    group.add(deck);

    // 3. Handles at 4 cardinal positions around rim
    group.handles = [];
    const angles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];

    angles.forEach((angle, idx) => {
      const handleGroup = new THREE.Group();
      handleGroup.rotation.y = angle;

      // Handle Post & Grip
      const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
      const post1 = new THREE.Mesh(postGeo, this.materials.handleDark);
      post1.position.set(1.4, 0.25, -0.18);
      handleGroup.add(post1);

      const post2 = new THREE.Mesh(postGeo, this.materials.handleDark);
      post2.position.set(1.4, 0.25, 0.18);
      handleGroup.add(post2);

      const barGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.42, 8);
      barGeo.rotateX(Math.PI / 2);
      const bar = new THREE.Mesh(barGeo, this.materials.handleGrip);
      bar.position.set(1.4, 0.4, 0);
      handleGroup.add(bar);

      group.add(handleGroup);
      group.handles.push(handleGroup);
    });

    return group;
  },

  /**
   * Create a Capybara Character Rig
   */
  createCapybara(colorHex = 0xa1887f) {
    const char = new THREE.Group();
    char.name = "Capybara";

    const bodyMat = colorHex === 0xa1887f ? this.materials.capyBrown : new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.8 });
    const snoutMat = this.materials.capySnout;

    // Main Torso (Slightly leaned forward towards handle)
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.8, 0.9);
    torsoGeo.translate(0, 0.5, 0);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.rotation.x = 0.2;
    char.add(torso);

    // Rounded Chubby Rear / Butt (Animates on fart!)
    const buttGeo = new THREE.SphereGeometry(0.48, 12, 12);
    buttGeo.scale(1.0, 0.9, 1.1);
    const butt = new THREE.Mesh(buttGeo, bodyMat);
    butt.position.set(0, 0.45, 0.48);
    char.add(butt);
    char.buttMesh = butt;

    // Blunt Rectangular Snout Head
    const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.65);
    headGeo.translate(0, 0.85, -0.45);
    const head = new THREE.Mesh(headGeo, snoutMat);
    char.add(head);

    // Little Rounded Ears
    const earGeo = new THREE.SphereGeometry(0.12, 8, 8);
    earGeo.scale(0.8, 1.2, 0.5);
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-0.25, 1.15, -0.35);
    char.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(0.25, 1.15, -0.35);
    char.add(rightEar);

    // Dark Bead Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, this.materials.blackEye);
    leftEye.position.set(-0.29, 0.95, -0.5);
    char.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, this.materials.blackEye);
    rightEye.position.set(0.29, 0.95, -0.5);
    char.add(rightEye);

    // Front Paws holding handle
    const pawGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
    pawGeo.rotateX(Math.PI / 3);
    const leftPaw = new THREE.Mesh(pawGeo, snoutMat);
    leftPaw.position.set(-0.25, 0.45, -0.5);
    char.add(leftPaw);

    const rightPaw = new THREE.Mesh(pawGeo, snoutMat);
    rightPaw.position.set(0.25, 0.45, -0.5);
    char.add(rightPaw);

    return char;
  },

  /**
   * Create a Hippo Character Rig
   */
  createHippo(colorHex = 0x455a64) {
    const char = new THREE.Group();
    char.name = "Hippo";

    const bodyMat = colorHex === 0x455a64 ? this.materials.hippoTeal : new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.8 });
    const snoutMat = this.materials.hippoSnout;

    // Big Chubby Torso
    const torsoGeo = new THREE.BoxGeometry(0.8, 0.85, 0.95);
    torsoGeo.translate(0, 0.5, 0);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.rotation.x = 0.2;
    char.add(torso);

    // Big Hippo Butt
    const buttGeo = new THREE.SphereGeometry(0.52, 12, 12);
    buttGeo.scale(1.1, 0.95, 1.15);
    const butt = new THREE.Mesh(buttGeo, bodyMat);
    butt.position.set(0, 0.48, 0.52);
    char.add(butt);
    char.buttMesh = butt;

    // Wide Hippo Snout
    const headGeo = new THREE.BoxGeometry(0.7, 0.5, 0.7);
    headGeo.translate(0, 0.8, -0.45);
    const head = new THREE.Mesh(headGeo, snoutMat);
    char.add(head);

    // Pink Nostril Spheres
    const nostrilGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const leftNostril = new THREE.Mesh(nostrilGeo, this.materials.pinkNose);
    leftNostril.position.set(-0.2, 0.95, -0.75);
    char.add(leftNostril);

    const rightNostril = new THREE.Mesh(nostrilGeo, this.materials.pinkNose);
    rightNostril.position.set(0.2, 0.95, -0.75);
    char.add(rightNostril);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, this.materials.blackEye);
    leftEye.position.set(-0.32, 1.0, -0.4);
    char.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, this.materials.blackEye);
    rightEye.position.set(0.32, 1.0, -0.4);
    char.add(rightEye);

    return char;
  },

  /**
   * Spiked Wall Segment (Purple tube lined with sharp white triangular spikes)
   */
  createSpikeStrip(length = 6, height = 0.8) {
    const group = new THREE.Group();
    group.name = "SpikeStrip";

    // Purple Base Bar
    const barGeo = new THREE.CylinderGeometry(0.35, 0.35, length, 12);
    barGeo.rotateZ(Math.PI / 2);
    const bar = new THREE.Mesh(barGeo, this.materials.spikePurple);
    bar.castShadow = true;
    group.add(bar);

    // Teeth / Spikes
    const spikeGeo = new THREE.ConeGeometry(0.25, 0.7, 8);
    spikeGeo.rotateX(Math.PI / 2);
    const count = Math.floor(length / 0.55);

    for (let i = 0; i < count; i++) {
      const spike = new THREE.Mesh(spikeGeo, this.materials.spikeWhite);
      const x = -length / 2 + (i + 0.5) * (length / count);
      spike.position.set(x, 0, 0.35);
      group.add(spike);
    }

    return group;
  },

  /**
   * Rotating Spiked Windmill / Turnstile (4-Arm Cross)
   */
  createSpikedWindmill(radius = 4.2) {
    const group = new THREE.Group();
    group.name = "SpikedWindmill";

    // Center Vertical Pillar
    const poleGeo = new THREE.CylinderGeometry(0.45, 0.5, 3.5, 12);
    const pole = new THREE.Mesh(poleGeo, this.materials.woodDark);
    pole.position.y = 1.75;
    group.add(pole);

    // Rotating Cross Rotor
    const rotor = new THREE.Group();
    rotor.position.y = 0.8;

    const armGeo = new THREE.CylinderGeometry(0.22, 0.22, radius, 8);
    armGeo.rotateZ(Math.PI / 2);

    const spikeGeo = new THREE.ConeGeometry(0.25, 0.65, 6);
    spikeGeo.rotateX(-Math.PI / 2);

    for (let a = 0; a < 4; a++) {
      const armGroup = new THREE.Group();
      armGroup.rotation.y = a * (Math.PI / 2);

      const arm = new THREE.Mesh(armGeo, this.materials.spikePurple);
      arm.position.x = radius / 2;
      armGroup.add(arm);

      // Add spikes along arm
      for (let s = 1.0; s < radius; s += 0.8) {
        const spike = new THREE.Mesh(spikeGeo, this.materials.spikeWhite);
        spike.position.set(s, 0, 0.25);
        armGroup.add(spike);
      }

      rotor.add(armGroup);
    }

    group.add(rotor);
    group.rotor = rotor;
    return group;
  },

  /**
   * Oscillating Spiked Horizontal Roller
   */
  createSpikedRoller(width = 5.0) {
    const group = new THREE.Group();
    group.name = "SpikedRoller";

    // Overhead Support Beam
    const beamGeo = new THREE.CylinderGeometry(0.25, 0.25, width + 2, 8);
    beamGeo.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(beamGeo, this.materials.woodDark);
    beam.position.y = 3.5;
    group.add(beam);

    // Spiked Roller Body
    const rollerGeo = new THREE.CylinderGeometry(0.4, 0.4, width, 12);
    rollerGeo.rotateZ(Math.PI / 2);
    const roller = new THREE.Mesh(rollerGeo, this.materials.spikePurple);
    roller.position.y = 0.8;

    // Spikes around roller
    const spikeGeo = new THREE.ConeGeometry(0.2, 0.55, 6);
    for (let x = -width / 2 + 0.4; x < width / 2; x += 0.7) {
      for (let r = 0; r < 4; r++) {
        const spike = new THREE.Mesh(spikeGeo, this.materials.spikeWhite);
        spike.rotation.z = Math.PI / 2;
        spike.rotation.y = r * (Math.PI / 2);
        spike.position.set(x, 0, 0);
        spike.translateZ(0.4);
        roller.add(spike);
      }
    }

    group.add(roller);
    group.roller = roller;
    return group;
  },

  /**
   * Speed Boost Chevron Arrow on Water Surface
   */
  createSpeedChevron() {
    const group = new THREE.Group();
    group.name = "SpeedChevron";

    const shape = new THREE.Shape();
    shape.moveTo(-1.2, -0.6);
    shape.lineTo(0, 0.4);
    shape.lineTo(1.2, -0.6);
    shape.lineTo(1.2, -0.1);
    shape.lineTo(0, 0.9);
    shape.lineTo(-1.2, -0.1);
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, this.materials.boostRed);
    mesh.position.y = 0.05;
    group.add(mesh);

    // Second Chevron
    const mesh2 = mesh.clone();
    mesh2.position.z = -1.2;
    group.add(mesh2);

    return group;
  },

  /**
   * Checkpoint Wooden Archway with Banner
   */
  createCheckpointArch(bannerText = "CHECK POINT") {
    const group = new THREE.Group();
    group.name = "CheckpointArch";

    // Side Posts
    const postGeo = new THREE.CylinderGeometry(0.35, 0.4, 6.0, 8);
    const leftPost = new THREE.Mesh(postGeo, this.materials.woodBrown);
    leftPost.position.set(-6.5, 3.0, 0);
    group.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, this.materials.woodBrown);
    rightPost.position.set(6.5, 3.0, 0);
    group.add(rightPost);

    // Overhead Crossbeam
    const beamGeo = new THREE.BoxGeometry(14.0, 0.6, 0.6);
    const beam = new THREE.Mesh(beamGeo, this.materials.woodBrown);
    beam.position.set(0, 5.5, 0);
    group.add(beam);

    // Wooden Banner Board
    const bannerGeo = new THREE.BoxGeometry(10.0, 1.8, 0.2);
    const banner = new THREE.Mesh(bannerGeo, this.materials.bannerYellow);
    banner.position.set(0, 4.4, 0);
    group.add(banner);

    // Banner Text using Canvas Texture
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fbc02d";
    ctx.fillRect(0, 0, 512, 128);
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#4e342e";
    ctx.strokeRect(6, 6, 500, 116);
    ctx.font = "bold 56px sans-serif";
    ctx.fillStyle = "#4e342e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(bannerText, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const textMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 1.6), textMat);
    textMesh.position.set(0, 4.4, 0.12);
    group.add(textMesh);

    return group;
  },

  /**
   * Desert Rock / Boulder Hazard
   */
  createBoulder(radius = 1.8) {
    const geo = new THREE.DodecahedronGeometry(radius, 1);
    const mesh = new THREE.Mesh(geo, this.materials.rockGrey);
    mesh.scale.set(1.0 + Math.random() * 0.4, 1.2 + Math.random() * 0.5, 1.0 + Math.random() * 0.4);
    mesh.position.y = radius * 0.6;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
};

window.ModelFactory = ModelFactory;
