/**
 * We Fart Together — Procedural 3D Model Factory
 * Generates stylized low-poly characters, donut raft, obstacles, and props matching the reference clips.
 * Perfectly proportioned for the physics world coordinates (raft radius 55px).
 */

const ModelFactory = {
  // Shared materials for performance
  materials: {
    tubeOrange: new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.45, metalness: 0.05 }),
    deckGreen: new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.65 }),
    handleDark: new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.4 }),
    handleGrip: new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.3 }),
    
    // Animal Materials
    capyBrown: new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.75 }),
    capySnout: new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.7 }),
    hippoTeal: new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.75 }),
    hippoSnout: new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.7 }),
    blackEye: new THREE.MeshBasicMaterial({ color: 0x111111 }),
    pinkNose: new THREE.MeshStandardMaterial({ color: 0xf48fb1, roughness: 0.6 }),
    
    // Hazard Materials
    spikePurple: new THREE.MeshStandardMaterial({ color: 0x8e24aa, roughness: 0.35 }),
    spikeWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }),
    woodBrown: new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.85 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 }),
    bannerYellow: new THREE.MeshStandardMaterial({ color: 0xfbc02d, roughness: 0.35 }),
    boostRed: new THREE.MeshStandardMaterial({ color: 0xff3d00, emissive: 0xdd2c00, roughness: 0.2 }),
    rockGrey: new THREE.MeshStandardMaterial({ color: 0x607d8b, roughness: 0.9, flatShading: true })
  },

  /**
   * Build the Circular Donut Raft with 4 Handles (unit scale, scaled by RAFT_SCALE = 55/1.5 in Renderer3D)
   */
  createRaft() {
    const group = new THREE.Group();
    group.name = "Raft";

    // 1. Inflatable Outer Donut Tube (Torus: major radius 1.5, tube radius 0.45)
    const tubeGeo = new THREE.TorusGeometry(1.5, 0.45, 18, 36);
    tubeGeo.rotateX(Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeo, this.materials.tubeOrange);
    tube.castShadow = true;
    tube.receiveShadow = true;
    group.add(tube);

    // 2. Trampoline Inner Floor Disc
    const deckGeo = new THREE.CylinderGeometry(1.22, 1.22, 0.12, 24);
    deckGeo.translate(0, -0.08, 0);
    const deck = new THREE.Mesh(deckGeo, this.materials.deckGreen);
    deck.receiveShadow = true;
    group.add(deck);

    // 3. Handles at 4 cardinal positions around rim
    group.handles = [];
    const angles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];

    angles.forEach((angle) => {
      const handleGroup = new THREE.Group();
      handleGroup.rotation.y = angle;

      // Handle Post & Grip
      const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
      const post1 = new THREE.Mesh(postGeo, this.materials.handleDark);
      post1.position.set(1.4, 0.22, -0.18);
      handleGroup.add(post1);

      const post2 = new THREE.Mesh(postGeo, this.materials.handleDark);
      post2.position.set(1.4, 0.22, 0.18);
      handleGroup.add(post2);

      const barGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.42, 8);
      barGeo.rotateX(Math.PI / 2);
      const bar = new THREE.Mesh(barGeo, this.materials.handleGrip);
      bar.position.set(1.4, 0.38, 0);
      handleGroup.add(bar);

      group.add(handleGroup);
      group.handles.push(handleGroup);
    });

    return group;
  },

  /**
   * Create a Capybara Character Rig
   */
  createCapybara(colorHex = 0x8d6e63) {
    const char = new THREE.Group();
    char.name = "Capybara";

    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.8 });
    const snoutMat = this.materials.capySnout;

    // Main Torso
    const torsoGeo = new THREE.BoxGeometry(0.68, 0.75, 0.85);
    torsoGeo.translate(0, 0.45, 0);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.rotation.x = 0.15;
    torso.castShadow = true;
    char.add(torso);

    // Chubby Rear / Butt (Animates on fart!)
    const buttGeo = new THREE.SphereGeometry(0.46, 12, 12);
    buttGeo.scale(1.0, 0.9, 1.15);
    const butt = new THREE.Mesh(buttGeo, bodyMat);
    butt.position.set(0, 0.45, 0.46);
    butt.castShadow = true;
    char.add(butt);
    char.buttMesh = butt;

    // Blunt Rectangular Snout Head
    const headGeo = new THREE.BoxGeometry(0.52, 0.52, 0.62);
    headGeo.translate(0, 0.82, -0.42);
    const head = new THREE.Mesh(headGeo, snoutMat);
    head.castShadow = true;
    char.add(head);

    // Little Rounded Ears
    const earGeo = new THREE.SphereGeometry(0.12, 8, 8);
    earGeo.scale(0.8, 1.2, 0.5);
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-0.25, 1.12, -0.32);
    char.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(0.25, 1.12, -0.32);
    char.add(rightEar);

    // Dark Bead Eyes
    const eyeGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, this.materials.blackEye);
    leftEye.position.set(-0.28, 0.92, -0.48);
    char.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, this.materials.blackEye);
    rightEye.position.set(0.28, 0.92, -0.48);
    char.add(rightEye);

    // Front Paws holding handle
    const pawGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.38, 8);
    pawGeo.rotateX(Math.PI / 3);
    const leftPaw = new THREE.Mesh(pawGeo, snoutMat);
    leftPaw.position.set(-0.24, 0.42, -0.48);
    char.add(leftPaw);

    const rightPaw = new THREE.Mesh(pawGeo, snoutMat);
    rightPaw.position.set(0.24, 0.42, -0.48);
    char.add(rightPaw);

    return char;
  },

  /**
   * Create a Hippo Character Rig
   */
  createHippo(colorHex = 0x455a64) {
    const char = new THREE.Group();
    char.name = "Hippo";

    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.8 });
    const snoutMat = this.materials.hippoSnout;

    // Big Chubby Torso
    const torsoGeo = new THREE.BoxGeometry(0.76, 0.82, 0.92);
    torsoGeo.translate(0, 0.48, 0);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.rotation.x = 0.15;
    torso.castShadow = true;
    char.add(torso);

    // Big Hippo Butt
    const buttGeo = new THREE.SphereGeometry(0.5, 12, 12);
    buttGeo.scale(1.1, 0.95, 1.18);
    const butt = new THREE.Mesh(buttGeo, bodyMat);
    butt.position.set(0, 0.46, 0.5);
    butt.castShadow = true;
    char.add(butt);
    char.buttMesh = butt;

    // Wide Hippo Snout
    const headGeo = new THREE.BoxGeometry(0.66, 0.48, 0.68);
    headGeo.translate(0, 0.78, -0.42);
    const head = new THREE.Mesh(headGeo, snoutMat);
    head.castShadow = true;
    char.add(head);

    // Pink Nostril Spheres
    const nostrilGeo = new THREE.SphereGeometry(0.075, 8, 8);
    const leftNostril = new THREE.Mesh(nostrilGeo, this.materials.pinkNose);
    leftNostril.position.set(-0.19, 0.92, -0.72);
    char.add(leftNostril);

    const rightNostril = new THREE.Mesh(nostrilGeo, this.materials.pinkNose);
    rightNostril.position.set(0.19, 0.92, -0.72);
    char.add(rightNostril);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, this.materials.blackEye);
    leftEye.position.set(-0.31, 0.98, -0.38);
    char.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, this.materials.blackEye);
    rightEye.position.set(0.31, 0.98, -0.38);
    char.add(rightEye);

    return char;
  },

  /**
   * Spiked Wall Segment (Pixel-scale purple bar lined with sharp white triangular spikes)
   */
  createSpikeStrip(length = 200, thickness = 20) {
    const group = new THREE.Group();
    group.name = "SpikeStrip";

    const barRadius = thickness * 0.45;
    const barGeo = new THREE.CylinderGeometry(barRadius, barRadius, length, 12);
    barGeo.rotateZ(Math.PI / 2);
    const bar = new THREE.Mesh(barGeo, this.materials.spikePurple);
    bar.castShadow = true;
    bar.receiveShadow = true;
    group.add(bar);

    // Teeth / Spikes pointing outward
    const spikeRadius = thickness * 0.42;
    const spikeHeight = thickness * 0.9;
    const spikeGeo = new THREE.ConeGeometry(spikeRadius, spikeHeight, 8);
    spikeGeo.rotateX(Math.PI / 2);

    const step = thickness * 0.95;
    const count = Math.max(2, Math.floor(length / step));

    for (let i = 0; i < count; i++) {
      const spike = new THREE.Mesh(spikeGeo, this.materials.spikeWhite);
      const x = -length / 2 + (i + 0.5) * (length / count);
      spike.position.set(x, 0, barRadius + spikeHeight * 0.4);
      spike.castShadow = true;
      group.add(spike);
    }

    return group;
  },

  /**
   * Rotating Spiked Windmill / Turnstile (Pixel-scale 4-Arm Cross)
   */
  createSpikedWindmill(radius = 64) {
    const group = new THREE.Group();
    group.name = "SpikedWindmill";

    // Center Vertical Pillar
    const poleGeo = new THREE.CylinderGeometry(9, 11, 46, 12);
    const pole = new THREE.Mesh(poleGeo, this.materials.woodDark);
    pole.position.y = 23;
    pole.castShadow = true;
    group.add(pole);

    // Rotating Cross Rotor
    const rotor = new THREE.Group();
    rotor.position.y = 14;

    const armGeo = new THREE.CylinderGeometry(4, 4, radius, 8);
    armGeo.rotateZ(Math.PI / 2);

    const spikeGeo = new THREE.ConeGeometry(3.5, 9, 6);
    spikeGeo.rotateX(-Math.PI / 2);

    for (let a = 0; a < 4; a++) {
      const armGroup = new THREE.Group();
      armGroup.rotation.y = a * (Math.PI / 2);

      const arm = new THREE.Mesh(armGeo, this.materials.spikePurple);
      arm.position.x = radius / 2;
      arm.castShadow = true;
      armGroup.add(arm);

      // Add spikes along arm
      for (let s = 14; s < radius - 4; s += 14) {
        const spike = new THREE.Mesh(spikeGeo, this.materials.spikeWhite);
        spike.position.set(s, 0, 4.5);
        spike.castShadow = true;
        armGroup.add(spike);
      }

      rotor.add(armGroup);
    }

    group.add(rotor);
    group.rotor = rotor;
    return group;
  },

  /**
   * Oscillating Spiked Horizontal Roller (Pixel-scale)
   */
  createSpikedRoller(width = 80, height = 24) {
    const group = new THREE.Group();
    group.name = "SpikedRoller";

    // Overhead Support Beam
    const beamGeo = new THREE.CylinderGeometry(4.5, 4.5, width + 34, 8);
    beamGeo.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(beamGeo, this.materials.woodDark);
    beam.position.y = 44;
    beam.castShadow = true;
    group.add(beam);

    // Side Posts
    const postGeo = new THREE.CylinderGeometry(4, 4, 44, 8);
    const leftPost = new THREE.Mesh(postGeo, this.materials.woodDark);
    leftPost.position.set(-(width + 28) / 2, 22, 0);
    group.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, this.materials.woodDark);
    rightPost.position.set((width + 28) / 2, 22, 0);
    group.add(rightPost);

    // Spiked Roller Body (oscillates)
    const roller = new THREE.Group();
    roller.position.y = 13;

    const rollerRadius = height * 0.42;
    const rollerGeo = new THREE.CylinderGeometry(rollerRadius, rollerRadius, width, 14);
    rollerGeo.rotateZ(Math.PI / 2);
    const rollerMesh = new THREE.Mesh(rollerGeo, this.materials.spikePurple);
    rollerMesh.castShadow = true;
    roller.add(rollerMesh);

    // Spikes around roller
    const spikeGeo = new THREE.ConeGeometry(3.5, 9, 6);
    for (let x = -width / 2 + 10; x < width / 2; x += 15) {
      for (let r = 0; r < 4; r++) {
        const spike = new THREE.Mesh(spikeGeo, this.materials.spikeWhite);
        spike.rotation.z = Math.PI / 2;
        spike.rotation.y = r * (Math.PI / 2);
        spike.position.set(x, 0, 0);
        spike.translateZ(rollerRadius + 2);
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
    mesh.position.y = 0.5;
    group.add(mesh);

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

    // Side Posts (base width between posts is 13 units)
    const postGeo = new THREE.CylinderGeometry(0.4, 0.45, 6.0, 8);
    const leftPost = new THREE.Mesh(postGeo, this.materials.woodBrown);
    leftPost.position.set(-6.5, 3.0, 0);
    leftPost.castShadow = true;
    group.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, this.materials.woodBrown);
    rightPost.position.set(6.5, 3.0, 0);
    rightPost.castShadow = true;
    group.add(rightPost);

    // Overhead Crossbeam
    const beamGeo = new THREE.BoxGeometry(14.0, 0.6, 0.6);
    const beam = new THREE.Mesh(beamGeo, this.materials.woodBrown);
    beam.position.set(0, 5.5, 0);
    beam.castShadow = true;
    group.add(beam);

    // Wooden Banner Board
    const bannerGeo = new THREE.BoxGeometry(10.5, 1.8, 0.2);
    const banner = new THREE.Mesh(bannerGeo, this.materials.bannerYellow);
    banner.position.set(0, 4.4, 0);
    banner.castShadow = true;
    group.add(banner);

    // Banner Text using Canvas Texture
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fbc02d";
    ctx.fillRect(0, 0, 512, 128);
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#3e2723";
    ctx.strokeRect(6, 6, 500, 116);
    ctx.font = "bold 52px sans-serif";
    ctx.fillStyle = "#3e2723";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(bannerText, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const textMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 1.6), textMat);
    textMesh.position.set(0, 4.4, 0.12);
    group.add(textMesh);

    return group;
  },

  /**
   * Desert Rock / Boulder Hazard (Pixel-scale)
   */
  createBoulder(radius = 24) {
    const geo = new THREE.DodecahedronGeometry(radius, 1);
    const mesh = new THREE.Mesh(geo, this.materials.rockGrey);
    mesh.scale.set(1.1, 1.25, 1.05);
    mesh.position.y = radius * 0.7;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
};

window.ModelFactory = ModelFactory;