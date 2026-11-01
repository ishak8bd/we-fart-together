/**
 * We Fart Together — Procedural 3D Model Factory
 * Recreates the exact visual experience from the reference game:
 * - Raft: Flat circular inflatable ring (cream/peach tube, gold loops, teal skirt, green plank deck)
 * - Characters: Chunky cartoon animals (blue hippo, orange hippo, green dino, dark bear) with red boxing-glove paws
 * - Hazards: Pink/magenta spiked bank cylinders, grey spiked slab gates, rotating spiked bars, grey rocks
 * - Environment: Bamboo START/FINISH arches with palm thatch, lily pads with pink flowers, bamboo stalks, trees
 */

const ModelFactory = {
  // Shared materials for optimal performance
  materials: {
    // Raft Materials (from screenshots: cream tube, gold loops, teal skirt, green plank deck)
    tubePeach: new THREE.MeshStandardMaterial({ color: 0xfcd5b5, roughness: 0.4, metalness: 0.05 }),
    skirtTeal: new THREE.MeshStandardMaterial({ color: 0x26c6da, roughness: 0.5, metalness: 0.1 }),
    deckWoodGreen: new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 0.7 }),
    deckPlankLine: new THREE.MeshStandardMaterial({ color: 0x558b2f, roughness: 0.8 }),
    goldLoop: new THREE.MeshStandardMaterial({ color: 0xfbc02d, roughness: 0.3, metalness: 0.4 }),
    gloveRed: new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.35, metalness: 0.05 }),
    
    // Character Body Materials
    hippoBlue: new THREE.MeshStandardMaterial({ color: 0x42a5f5, roughness: 0.75 }),
    hippoOrange: new THREE.MeshStandardMaterial({ color: 0xfb8c00, roughness: 0.75 }),
    hippoGreen: new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 0.75 }),
    bearDark: new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 }),
    
    snoutLight: new THREE.MeshStandardMaterial({ color: 0xffe0b2, roughness: 0.7 }),
    snoutBlue: new THREE.MeshStandardMaterial({ color: 0x90caf9, roughness: 0.7 }),
    snoutGreen: new THREE.MeshStandardMaterial({ color: 0xaed581, roughness: 0.7 }),
    snoutDark: new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 }),
    blackEye: new THREE.MeshBasicMaterial({ color: 0x111111 }),
    pinkNose: new THREE.MeshStandardMaterial({ color: 0xf48fb1, roughness: 0.6 }),
    
    // Hazard Materials (from screenshots: pink cylinders with white spikes, grey slabs with white spikes)
    spikePink: new THREE.MeshStandardMaterial({ color: 0xe91e63, roughness: 0.35 }),
    spikeWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 }),
    slabGrey: new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.55 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 }),
    woodBamboo: new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.8 }),
    thatchPalm: new THREE.MeshStandardMaterial({ color: 0x8bc34a, roughness: 0.9 }),
    rockGrey: new THREE.MeshStandardMaterial({ color: 0x607d8b, roughness: 0.9, flatShading: true }),
    
    // Scenery & FX
    boostRed: new THREE.MeshStandardMaterial({ color: 0xff3d00, emissive: 0xdd2c00, roughness: 0.2 }),
    boostWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }),
    lilyGreen: new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.8 }),
    flowerPink: new THREE.MeshStandardMaterial({ color: 0xf48fb1, roughness: 0.5 }),
    flowerYellow: new THREE.MeshStandardMaterial({ color: 0xffeb3b, roughness: 0.4 })
  },

  /**
   * Build the Circular Donut Raft at exact 80px diameter (40px radius)
   */
  createRaft() {
    const group = new THREE.Group();
    group.name = "Raft";

    // 1. Teal Skirt Underneath
    const skirtGeo = new THREE.TorusGeometry(32, 6, 16, 32);
    skirtGeo.rotateX(Math.PI / 2);
    const skirt = new THREE.Mesh(skirtGeo, this.materials.skirtTeal);
    skirt.position.y = -3.5;
    group.add(skirt);

    // 2. Inflatable Peach/Cream Donut Tube (Major radius 32, tube radius 8 -> outer radius 40px)
    const tubeGeo = new THREE.TorusGeometry(32, 8, 18, 36);
    tubeGeo.rotateX(Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeo, this.materials.tubePeach);
    tube.castShadow = true;
    tube.receiveShadow = true;
    group.add(tube);

    // 3. Green Wooden-Plank Deck in center
    const deckGeo = new THREE.CylinderGeometry(28, 28, 3, 28);
    deckGeo.translate(0, -1.5, 0);
    const deck = new THREE.Mesh(deckGeo, this.materials.deckWoodGreen);
    deck.receiveShadow = true;
    group.add(deck);

    // Parallel wooden plank lines
    for (let x = -20; x <= 20; x += 8) {
      const lineLen = Math.sqrt(Math.max(0, 26 * 26 - x * x)) * 2;
      const plankGeo = new THREE.BoxGeometry(0.8, 0.4, lineLen);
      const plankLine = new THREE.Mesh(plankGeo, this.materials.deckPlankLine);
      plankLine.position.set(x, 0.05, 0);
      group.add(plankLine);
    }

    // 4. Eight Gold/Yellow loops around the peach tube
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const loopGroup = new THREE.Group();
      loopGroup.rotation.y = angle;

      const loopGeo = new THREE.TorusGeometry(8.5, 1.0, 8, 16);
      loopGeo.rotateY(Math.PI / 2);
      const loopMesh = new THREE.Mesh(loopGeo, this.materials.goldLoop);
      loopMesh.position.set(32, 0, 0);
      loopGroup.add(loopMesh);
      group.add(loopGroup);
    }

    return group;
  },

  /**
   * Create Character with Red Boxing Gloves holding onto the rim
   */
  createCharacter(slotIndex = 0) {
    const char = new THREE.Group();
    char.name = `Character_${slotIndex}`;

    // Select body & snout materials based on slot (matches reference screenshots)
    let bodyMat, snoutMat, isBear = false;
    if (slotIndex === 0) {
      bodyMat = this.materials.hippoBlue;
      snoutMat = this.materials.snoutBlue;
    } else if (slotIndex === 1) {
      bodyMat = this.materials.hippoOrange;
      snoutMat = this.materials.snoutLight;
    } else if (slotIndex === 2) {
      bodyMat = this.materials.hippoGreen;
      snoutMat = this.materials.snoutGreen;
    } else {
      bodyMat = this.materials.bearDark;
      snoutMat = this.materials.snoutDark;
      isBear = true;
    }

    // Main Torso (leaning slightly toward center of raft)
    const torsoGeo = new THREE.BoxGeometry(15, 17, 18);
    torsoGeo.translate(0, 11, 0);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.rotation.x = 0.15;
    torso.castShadow = true;
    char.add(torso);

    // Chubby Rear / Butt (Animates when farting!)
    const buttGeo = new THREE.SphereGeometry(10, 12, 12);
    buttGeo.scale(1.1, 0.95, 1.2);
    const butt = new THREE.Mesh(buttGeo, bodyMat);
    butt.position.set(0, 10, 10);
    butt.castShadow = true;
    char.add(butt);
    char.buttMesh = butt;

    // Head
    const headWidth = isBear ? 13 : 14;
    const headGeo = new THREE.BoxGeometry(headWidth, 12, 13);
    headGeo.translate(0, 18, -9);
    const head = new THREE.Mesh(headGeo, snoutMat);
    head.castShadow = true;
    char.add(head);

    // Ears
    const earGeo = new THREE.SphereGeometry(2.5, 8, 8);
    earGeo.scale(0.8, 1.2, 0.5);
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-5.5, 25, -7);
    char.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(5.5, 25, -7);
    char.add(rightEar);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(1.6, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, this.materials.blackEye);
    leftEye.position.set(-6, 21, -9.5);
    char.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, this.materials.blackEye);
    rightEye.position.set(6, 21, -9.5);
    char.add(rightEye);

    // Hippo Nostrils
    if (!isBear) {
      const nostrilGeo = new THREE.SphereGeometry(1.5, 6, 6);
      const leftNose = new THREE.Mesh(nostrilGeo, this.materials.pinkNose);
      leftNose.position.set(-4, 19, -15.5);
      char.add(leftNose);

      const rightNose = new THREE.Mesh(nostrilGeo, this.materials.pinkNose);
      rightNose.position.set(4, 19, -15.5);
      char.add(rightNose);
    }

    // RED BOXING-GLOVE PAWS holding onto the rim (from screenshots)
    const gloveGeo = new THREE.SphereGeometry(3.5, 10, 10);
    gloveGeo.scale(1.1, 1.0, 1.2);

    const leftGlove = new THREE.Mesh(gloveGeo, this.materials.gloveRed);
    leftGlove.position.set(-8.5, 9, -13);
    leftGlove.castShadow = true;
    char.add(leftGlove);

    const rightGlove = new THREE.Mesh(gloveGeo, this.materials.gloveRed);
    rightGlove.position.set(8.5, 9, -13);
    rightGlove.castShadow = true;
    char.add(rightGlove);

    return char;
  },

  /**
   * Pink / Magenta Spiked Bank Rollers (from screenshots)
   */
  createSpikeRoller(length = 200, thickness = 24) {
    const group = new THREE.Group();
    group.name = "SpikeRoller";

    const radius = thickness * 0.45;
    const bodyGeo = new THREE.CylinderGeometry(radius, radius, length, 14);
    bodyGeo.rotateZ(Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.materials.spikePink);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Sharp white cone spikes along the bank facing river
    const spikeRadius = thickness * 0.4;
    const spikeHeight = thickness * 0.95;
    const spikeGeo = new THREE.ConeGeometry(spikeRadius, spikeHeight, 8);
    spikeGeo.rotateX(Math.PI / 2);

    const step = thickness * 0.95;
    const count = Math.max(2, Math.floor(length / step));

    for (let i = 0; i < count; i++) {
      const spike = new THREE.Mesh(spikeGeo, this.materials.spikeWhite);
      const x = -length / 2 + (i + 0.5) * (length / count);
      spike.position.set(x, 0, radius + spikeHeight * 0.42);
      spike.castShadow = true;
      group.add(spike);
    }

    return group;
  },

  /**
   * Grey Spiked Slabs forming gates (from screenshots)
   */
  createSpikeSlab(width = 38, height = 60) {
    const group = new THREE.Group();
    group.name = "SpikeSlab";

    // Vertical grey rectangular slab
    const slabGeo = new THREE.BoxGeometry(width, 42, height);
    slabGeo.translate(0, 21, 0);
    const slab = new THREE.Mesh(slabGeo, this.materials.slabGrey);
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);

    // 4 vertical rows of white spikes on the face
    const spikeGeo = new THREE.ConeGeometry(3.5, 9, 6);
    spikeGeo.rotateX(-Math.PI / 2);

    for (let y = 8; y <= 34; y += 9) {
      for (let z = -height / 2 + 10; z < height / 2; z += 14) {
        const spike = new THREE.Mesh(spikeGeo, this.materials.spikeWhite);
        spike.position.set(width / 2 + 4, y, z);
        spike.castShadow = true;
        group.add(spike);
      }
    }

    return group;
  },

  /**
   * Rotating Spiked Windmill / Turnstile (Pixel-scale 4-Arm Cross)
   */
  createSpikedWindmill(radius = 72) {
    const group = new THREE.Group();
    group.name = "SpikedWindmill";

    // Center Vertical Pillar
    const poleGeo = new THREE.CylinderGeometry(9, 11, 48, 12);
    const pole = new THREE.Mesh(poleGeo, this.materials.woodDark);
    pole.position.y = 24;
    pole.castShadow = true;
    group.add(pole);

    // Rotating Cross Rotor
    const rotor = new THREE.Group();
    rotor.position.y = 15;

    const armGeo = new THREE.CylinderGeometry(4.5, 4.5, radius, 8);
    armGeo.rotateZ(Math.PI / 2);

    const spikeGeo = new THREE.ConeGeometry(3.8, 10, 6);
    spikeGeo.rotateX(-Math.PI / 2);

    for (let a = 0; a < 4; a++) {
      const armGroup = new THREE.Group();
      armGroup.rotation.y = a * (Math.PI / 2);

      const arm = new THREE.Mesh(armGeo, this.materials.spikePink);
      arm.position.x = radius / 2;
      arm.castShadow = true;
      armGroup.add(arm);

      // Add spikes along arm
      for (let s = 14; s < radius - 4; s += 15) {
        const spike = new THREE.Mesh(spikeGeo, this.materials.spikeWhite);
        spike.position.set(s, 0, 5);
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
  createSpikedRoller(width = 76, height = 24) {
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
    const rollerMesh = new THREE.Mesh(rollerGeo, this.materials.spikePink);
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
   * Desert Rock / Boulder Hazard (Pixel-scale)
   */
  createBoulder(radius = 22) {
    const geo = new THREE.DodecahedronGeometry(radius, 1);
    const mesh = new THREE.Mesh(geo, this.materials.rockGrey);
    mesh.scale.set(1.1, 1.25, 1.05);
    mesh.position.y = radius * 0.7;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * START & FINISH Bamboo Arches with Palm Thatch & Signboard (from screenshots)
   */
  createGateArch(width = 460, text = "START") {
    const group = new THREE.Group();
    group.name = `GateArch_${text}`;

    const halfW = width / 2;
    const archH = 80;

    // Bamboo Side Posts
    const postGeo = new THREE.CylinderGeometry(5, 6, archH, 8);
    const leftPost = new THREE.Mesh(postGeo, this.materials.woodBamboo);
    leftPost.position.set(-halfW + 15, archH / 2, 0);
    leftPost.castShadow = true;
    group.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, this.materials.woodBamboo);
    rightPost.position.set(halfW - 15, archH / 2, 0);
    rightPost.castShadow = true;
    group.add(rightPost);

    // Top Bamboo Crossbeams
    const beamGeo = new THREE.CylinderGeometry(5, 5, width, 8);
    beamGeo.rotateZ(Math.PI / 2);
    const topBeam = new THREE.Mesh(beamGeo, this.materials.woodBamboo);
    topBeam.position.set(0, archH - 6, 0);
    topBeam.castShadow = true;
    group.add(topBeam);

    // Palm Thatch / Straw Roof on top of posts
    for (const side of [-1, 1]) {
      const thatchGeo = new THREE.ConeGeometry(16, 20, 8);
      const thatch = new THREE.Mesh(thatchGeo, this.materials.thatchPalm);
      thatch.position.set(side * (halfW - 15), archH + 6, 0);
      group.add(thatch);
    }

    // Wooden Signboard with Bold Text
    const boardW = Math.min(width * 0.65, 260);
    const boardH = 38;
    const boardGeo = new THREE.BoxGeometry(boardW, boardH, 4);
    const boardMesh = new THREE.Mesh(boardGeo, this.materials.thatchPalm);
    boardMesh.position.set(0, archH - 22, 0);
    boardMesh.castShadow = true;
    group.add(boardMesh);

    // Canvas Texture for Signboard Text
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fbc02d";
    ctx.fillRect(0, 0, 512, 128);
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#3e2723";
    ctx.strokeRect(6, 6, 500, 116);
    ctx.font = "bold 68px sans-serif";
    ctx.fillStyle = "#263238";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const textMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(boardW * 0.95, boardH * 0.9), textMat);
    textMesh.position.set(0, archH - 22, 2.5);
    group.add(textMesh);

    return group;
  },

  /**
   * Lily Pad with Pink Lotus Flower for Start Pool (from screenshots)
   */
  createLilyPad() {
    const group = new THREE.Group();
    group.name = "LilyPad";

    // Round green disc
    const padGeo = new THREE.CylinderGeometry(14, 14, 0.4, 16);
    const pad = new THREE.Mesh(padGeo, this.materials.lilyGreen);
    pad.position.y = 0.2;
    group.add(pad);

    // Pink Lotus Flower
    const flowerGeo = new THREE.ConeGeometry(5, 6, 6);
    flowerGeo.rotateX(Math.PI);
    const flower = new THREE.Mesh(flowerGeo, this.materials.flowerPink);
    flower.position.set(0, 4, 0);
    group.add(flower);

    const centerGeo = new THREE.SphereGeometry(2, 6, 6);
    const center = new THREE.Mesh(centerGeo, this.materials.flowerYellow);
    center.position.set(0, 3.5, 0);
    group.add(center);

    return group;
  },

  /**
   * Speed Boost Chevron Arrow on Water Surface (Red & White)
   */
  createSpeedChevron() {
    const group = new THREE.Group();
    group.name = "SpeedChevron";

    const shape = new THREE.Shape();
    shape.moveTo(-16, -8);
    shape.lineTo(0, 12);
    shape.lineTo(16, -8);
    shape.lineTo(16, -1);
    shape.lineTo(0, 19);
    shape.lineTo(-16, -1);
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, this.materials.boostRed);
    mesh.position.y = 0.6;
    group.add(mesh);

    // Inner White Stripe
    const shapeInner = new THREE.Shape();
    shapeInner.moveTo(-12, -7);
    shapeInner.lineTo(0, 8);
    shapeInner.lineTo(12, -7);
    shapeInner.lineTo(12, -4);
    shapeInner.lineTo(0, 11);
    shapeInner.lineTo(-12, -4);
    shapeInner.closePath();

    const geoInner = new THREE.ShapeGeometry(shapeInner);
    geoInner.rotateX(-Math.PI / 2);
    const innerMesh = new THREE.Mesh(geoInner, this.materials.boostWhite);
    innerMesh.position.y = 0.7;
    group.add(innerMesh);

    // Second Chevron
    const group2 = group.clone();
    group2.position.z = -22;

    const chevronPair = new THREE.Group();
    chevronPair.add(group);
    chevronPair.add(group2);
    return chevronPair;
  }
};

window.ModelFactory = ModelFactory;