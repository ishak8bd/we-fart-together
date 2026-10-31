/**
 * We Fart Together — Canyon River Track & Level Generator
 * Creates the spline water flume, bank walls, checkpoints, boost pads, and obstacle hazards.
 */

class RiverTrack {
  constructor(scene) {
    this.scene = scene;
    this.trackWidth = 11.0;
    this.checkpoints = [];
    this.hazards = [];
    this.boostPads = [];
    this.waterMesh = null;
    this.riverCurve = null;

    this.initSpline();
    this.generateRiverGeometry();
    this.spawnLevelElements();
  }

  /**
   * Define the 3D Spline Curve for the Canyon River
   */
  initSpline() {
    const points = [
      new THREE.Vector3(0, 0, 0),         // Start Arch
      new THREE.Vector3(0, -1, -50),      // Straight intro
      new THREE.Vector3(15, -3, -110),    // Right curve 1
      new THREE.Vector3(30, -6, -170),
      new THREE.Vector3(20, -9, -230),    // Checkpoint 1
      new THREE.Vector3(-15, -13, -290),  // Left bend + Spikes
      new THREE.Vector3(-35, -18, -360),
      new THREE.Vector3(-20, -22, -430),  // Checkpoint 2 (Windmill zone)
      new THREE.Vector3(10, -26, -500),   // S-curve + Boulders
      new THREE.Vector3(35, -31, -570),   // Sharp right
      new THREE.Vector3(25, -36, -640),   // Checkpoint 3 (Rollers zone)
      new THREE.Vector3(-10, -42, -720),  // Big drop / waterfall rapid
      new THREE.Vector3(-30, -50, -800),  // Checkpoint 4 (Speedway)
      new THREE.Vector3(-15, -54, -880),  // Final rapid
      new THREE.Vector3(0, -58, -960)     // Victory Finish line
    ];

    this.riverCurve = new THREE.CatmullRomCurve3(points);
    this.riverCurve.curveType = 'catmullrom';
    this.riverCurve.tension = 0.5;
  }

  /**
   * Generate the continuous water surface and canyon bank walls
   */
  generateRiverGeometry() {
    const segments = 240;
    const halfW = this.trackWidth / 2;

    const waterGeo = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];

    // Canyon Bank geometries
    const bankGeo = new THREE.BufferGeometry();
    const bankPositions = [];
    const bankNormals = [];

    const curvePoints = this.riverCurve.getSpacedPoints(segments);

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const pt = curvePoints[i];
      const tangent = this.riverCurve.getTangent(u);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      // Left and right water edge vertices
      const pLeft = pt.clone().addScaledVector(normal, -halfW);
      const pRight = pt.clone().addScaledVector(normal, halfW);

      positions.push(pLeft.x, pLeft.y, pLeft.z);
      positions.push(pRight.x, pRight.y, pRight.z);

      uvs.push(0, u * 30);
      uvs.push(1, u * 30);

      // Bank Walls (extending upward and outward into canyon)
      const pBankLeftOuter = pLeft.clone().addScaledVector(normal, -3.5).add(new THREE.Vector3(0, 3.2, 0));
      const pBankRightOuter = pRight.clone().addScaledVector(normal, 3.5).add(new THREE.Vector3(0, 3.2, 0));

      // Build wall strips
      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    waterGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    waterGeo.setIndex(indices);
    waterGeo.computeVertexNormals();

    // Stylized Animated Water Material
    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x29b6f6,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
      flatShading: false
    });

    this.waterMesh = new THREE.Mesh(waterGeo, this.waterMat);
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);

    // Track Border Rails (Green bamboo/grass tubes along edges)
    this.buildBorderRails(curvePoints, halfW);

    // Canyon Mesa Backdrop Meshes
    this.buildCanyonBackdrop(curvePoints);
  }

  /**
   * Border Rails that define physical track walls
   */
  buildBorderRails(curvePoints, halfW) {
    const railMat = new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.6 });
    const segments = curvePoints.length - 1;

    for (let side of [-1, 1]) {
      const railPoints = [];
      for (let i = 0; i <= segments; i += 2) {
        const u = i / segments;
        const pt = curvePoints[i];
        const tangent = this.riverCurve.getTangent(u);
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        railPoints.push(pt.clone().addScaledVector(normal, side * (halfW + 0.3)).add(new THREE.Vector3(0, 0.4, 0)));
      }

      const railCurve = new THREE.CatmullRomCurve3(railPoints);
      const tubeGeo = new THREE.TubeGeometry(railCurve, 120, 0.45, 8, false);
      const railMesh = new THREE.Mesh(tubeGeo, railMat);
      railMesh.receiveShadow = true;
      this.scene.add(railMesh);
    }
  }

  /**
   * Low-Poly Terracotta Canyon Cliffs & Mesas
   */
  buildCanyonBackdrop(curvePoints) {
    const canyonMat = new THREE.MeshStandardMaterial({
      color: 0xd7ccc8,
      roughness: 0.95,
      flatShading: true
    });

    // Place cliff mesas along sides
    for (let i = 0; i < curvePoints.length; i += 12) {
      const u = i / curvePoints.length;
      const pt = curvePoints[i];
      const tangent = this.riverCurve.getTangent(u);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      for (let side of [-1, 1]) {
        const mesa = new THREE.Mesh(
          new THREE.CylinderGeometry(8 + Math.random() * 4, 12 + Math.random() * 4, 14 + Math.random() * 10, 7),
          canyonMat
        );
        const pos = pt.clone().addScaledVector(normal, side * (this.trackWidth * 1.5 + 10 + Math.random() * 8));
        mesa.position.set(pos.x, pos.y + 4, pos.z);
        mesa.rotation.y = Math.random() * Math.PI;
        this.scene.add(mesa);
      }
    }
  }

  /**
   * Spawn Checkpoints, Spiked Walls, Rotating Windmills, Oscillating Rollers, and Boost Chevrons
   */
  spawnLevelElements() {
    // 1. Checkpoints
    const checkpointRatios = [0.0, 0.23, 0.46, 0.68, 1.0];
    const titles = ["START", "CHECK POINT 1", "CHECK POINT 2", "CHECK POINT 3", "FINISH!"];

    checkpointRatios.forEach((u, idx) => {
      const pt = this.riverCurve.getPointAt(u);
      const tangent = this.riverCurve.getTangentAt(u);
      const arch = ModelFactory.createCheckpointArch(titles[idx]);
      arch.position.copy(pt);
      arch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      this.scene.add(arch);

      this.checkpoints.push({
        id: idx,
        u: u,
        position: pt.clone(),
        tangent: tangent.clone(),
        title: titles[idx],
        radius: 6.0
      });
    });

    // 2. Purple Spiked Wall Strips (Dangerous outer curves)
    const spikeZones = [
      { u: 0.12, side: 1, length: 14 },
      { u: 0.18, side: -1, length: 16 },
      { u: 0.32, side: 1, length: 22 },
      { u: 0.38, side: -1, length: 18 },
      { u: 0.54, side: 1, length: 24 },
      { u: 0.60, side: -1, length: 20 },
      { u: 0.78, side: 1, length: 26 },
      { u: 0.88, side: -1, length: 28 }
    ];

    const halfW = this.trackWidth / 2;
    spikeZones.forEach(sz => {
      const pt = this.riverCurve.getPointAt(sz.u);
      const tangent = this.riverCurve.getTangentAt(sz.u);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const strip = ModelFactory.createSpikeStrip(sz.length);
      const pos = pt.clone().addScaledVector(normal, sz.side * (halfW - 0.2)).add(new THREE.Vector3(0, 0.35, 0));
      strip.position.copy(pos);
      strip.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent);
      this.scene.add(strip);

      this.hazards.push({
        type: 'spikeWall',
        position: pos,
        radius: sz.length / 2,
        halfWidth: 1.0,
        mesh: strip
      });
    });

    // 3. Rotating Spiked Windmills in Mid-Channel
    const windmillU = [0.35, 0.58, 0.82];
    windmillU.forEach(u => {
      const pt = this.riverCurve.getPointAt(u);
      const windmill = ModelFactory.createSpikedWindmill(4.2);
      windmill.position.copy(pt);
      this.scene.add(windmill);

      this.hazards.push({
        type: 'windmill',
        position: pt,
        radius: 4.2,
        mesh: windmill,
        rotSpeed: 1.8 + Math.random() * 0.8
      });
    });

    // 4. Oscillating Spiked Rollers (Swinging across track)
    const rollerU = [0.40, 0.64, 0.74, 0.90];
    rollerU.forEach((u, idx) => {
      const pt = this.riverCurve.getPointAt(u);
      const tangent = this.riverCurve.getTangentAt(u);
      const roller = ModelFactory.createSpikedRoller(6.0);
      roller.position.copy(pt);
      roller.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      this.scene.add(roller);

      this.hazards.push({
        type: 'roller',
        position: pt,
        tangent: tangent,
        radius: 2.5,
        mesh: roller,
        swingTime: idx * 1.5,
        swingSpeed: 2.0
      });
    });

    // 5. Speed Boost Chevrons on Water
    const boostU = [0.08, 0.26, 0.48, 0.71, 0.85];
    boostU.forEach(u => {
      const pt = this.riverCurve.getPointAt(u);
      const tangent = this.riverCurve.getTangentAt(u);
      const chevron = ModelFactory.createSpeedChevron();
      chevron.position.copy(pt);
      chevron.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), tangent);
      this.scene.add(chevron);

      this.boostPads.push({
        position: pt.clone(),
        tangent: tangent.clone(),
        radius: 3.2,
        boostPower: 26.0
      });
    });

    // 6. Central Boulders dividing river paths
    const boulderU = [0.15, 0.52, 0.76];
    boulderU.forEach(u => {
      const pt = this.riverCurve.getPointAt(u);
      const boulder = ModelFactory.createBoulder(2.0);
      boulder.position.copy(pt);
      this.scene.add(boulder);

      this.hazards.push({
        type: 'boulder',
        position: pt,
        radius: 2.2,
        mesh: boulder
      });
    });
  }

  /**
   * Find closest point on spline and return parameter u (0.0 to 1.0)
   */
  getClosestU(position) {
    let closestU = 0;
    let minDistSq = Infinity;
    const samples = 150;

    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const pt = this.riverCurve.getPointAt(u);
      const distSq = position.distanceToSquared(pt);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestU = u;
      }
    }
    return closestU;
  }

  /**
   * Get stream tangent vector and river velocity at given position
   */
  getStreamVelocityAt(position) {
    const u = this.getClosestU(position);
    const tangent = this.riverCurve.getTangentAt(u).normalize();
    // Base river current velocity (speed increases down slopes)
    const baseSpeed = 8.5 + (u * 4.0);
    return tangent.multiplyScalar(baseSpeed);
  }

  /**
   * Update animated obstacles (Windmills, Rollers)
   */
  update(dt) {
    this.hazards.forEach(h => {
      if (h.type === 'windmill' && h.mesh.rotor) {
        h.mesh.rotor.rotation.y += h.rotSpeed * dt;
      } else if (h.type === 'roller' && h.mesh.roller) {
        h.swingTime += dt * h.swingSpeed;
        const offset = Math.sin(h.swingTime) * 3.2;
        h.mesh.roller.position.x = offset;
        h.position.x = h.mesh.position.x + offset;
      }
    });
  }
}

window.RiverTrack = RiverTrack;
