/**
 * We Fart Together — 3D WebGL Three.js Renderer
 * Visuals matching the reference game:
 * - 3D third-person chase camera (high angle, FOV 60, pitch ~35-45 degrees)
 * - Inflatable donut raft: cream/peach tube, gold loops, teal skirt, green plank deck
 * - Characters: 4 chunky animals (blue hippo, orange hippo, green dino, dark bear) with red boxing-glove paws
 * - Saturated bright blue water with white ripple rings under raft
 * - Banks: rounded grass-green pipe rails with orange base trim
 * - Red-orange canyon cliffs, bamboo stalks, round trees, lily pads with pink lotus flowers in start pool
 * - START & FINISH bamboo arches with palm thatch
 * - Pink/magenta spiked bank rollers, grey spiked slab gates, rotating spiked bars, grey rocks
 */

class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.characters = [];
    this.nameplates = [];
    this.levelMeshes = [];
    this.dynamicMeshMap = new Map();
    this.activeCheckpoint = 0;
    this.time = 0;
    this.currentLevelId = null;

    this.initThree();
    this.initParticles();
    this.initRaft();
  }

  initThree() {
    // 1. Scene with Vibrant Blue Sky & Subtle Distance Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x80d8ff);
    this.scene.fog = new THREE.FogExp2(0x80d8ff, 0.00035);

    // 2. Third-person Chase Camera (FOV 60, high angle looking down track)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 1, 4500);
    this.camera.position.set(300, 115, 60);

    // 3. WebGLRenderer (Capped at 2x DPR for 60fps on mobile)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Vibrant Cartoon Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x80d8ff, 0.85);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff9c4, 1.3);
    dirLight.position.set(200, 480, -200);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 50;
    dirLight.shadow.camera.far = 1600;
    dirLight.shadow.camera.left = -340;
    dirLight.shadow.camera.right = 340;
    dirLight.shadow.camera.top = 340;
    dirLight.shadow.camera.bottom = -340;
    this.scene.add(dirLight);
    this.sunLight = dirLight;

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  initParticles() {
    this.particles = new ParticleEngine(this.scene);
  }

  initRaft() {
    // 3D Inflatable Donut Raft Group
    this.raftGroup = new THREE.Group();
    this.scene.add(this.raftGroup);

    // Raft Model (Built directly at diameter 80px, radius 40px)
    this.raftMesh = ModelFactory.createRaft();
    this.raftGroup.add(this.raftMesh);

    // 4 Animal Characters on rim with red boxing-glove paws:
    // Slot 0: Blue Hippo, Slot 1: Orange Hippo, Slot 2: Green Dino, Slot 3: Dark Bear
    this.characterMeshes = [];
    for (let i = 0; i < 4; i++) {
      const char = ModelFactory.createCharacter(i);
      char.position.set(0, 0, 0);
      char.visible = false;
      this.raftGroup.add(char);
      this.characterMeshes.push(char);
    }
  }

  /**
   * Build 3D River Canal & Obstacles from Level Data
   */
  loadLevel(level) {
    if (this.currentLevelId === level.id) return;
    this.currentLevelId = level.id;

    // Clear previous meshes
    this.levelMeshes.forEach(m => this.scene.remove(m));
    this.levelMeshes = [];
    this.dynamicMeshMap.clear();

    const { leftPts, rightPts } = computeBoundaryPolylines(level.waypoints);

    // 1. Saturated Bright Blue Water Surface Mesh
    const waterGeo = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < leftPts.length; i++) {
      const lp = leftPts[i];
      const rp = rightPts[i];
      const waterY = 0;

      positions.push(lp.x, waterY, lp.y);
      positions.push(rp.x, waterY, rp.y);

      uvs.push(0, (i / leftPts.length) * 24);
      uvs.push(1, (i / leftPts.length) * 24);

      if (i < leftPts.length - 1) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    waterGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    waterGeo.setIndex(indices);
    waterGeo.computeVertexNormals();

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0288d1, // Saturated vibrant blue water
      roughness: 0.1,
      metalness: 0.08,
      transparent: true,
      opacity: 0.92
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.receiveShadow = true;
    this.scene.add(waterMesh);
    this.levelMeshes.push(waterMesh);
    this.waterMesh = waterMesh;

    // 2. Banks: Grass-Green Pipe Rails on top with Orange Base Trim along water line (from screenshots)
    const railMat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.6 }); // Grass-green top rail
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xfb8c00, roughness: 0.65 }); // Orange base trim

    for (let side = 0; side < 2; side++) {
      const bPts = side === 0 ? leftPts : rightPts;
      const topPts = [];
      const bottomPts = [];

      for (let i = 0; i < bPts.length; i++) {
        const p = bPts[i];
        topPts.push(new THREE.Vector3(p.x, 8, p.y));
        bottomPts.push(new THREE.Vector3(p.x, 2, p.y));
      }

      // Top green rail
      const topCurve = new THREE.CatmullRomCurve3(topPts);
      const topGeo = new THREE.TubeGeometry(topCurve, 100, 6, 8, false);
      const topMesh = new THREE.Mesh(topGeo, railMat);
      topMesh.receiveShadow = true;
      this.scene.add(topMesh);
      this.levelMeshes.push(topMesh);

      // Orange base trim
      const bottomCurve = new THREE.CatmullRomCurve3(bottomPts);
      const bottomGeo = new THREE.TubeGeometry(bottomCurve, 100, 4, 8, false);
      const bottomMesh = new THREE.Mesh(bottomGeo, trimMat);
      bottomMesh.receiveShadow = true;
      this.scene.add(bottomMesh);
      this.levelMeshes.push(bottomMesh);
    }

    // 3. Red-Orange Canyon Sandstone Cliffs (from screenshots)
    const canyonMat = new THREE.MeshStandardMaterial({ color: 0xe64a19, roughness: 0.95, flatShading: true });
    for (let i = 0; i < level.waypoints.length; i += 2) {
      const p = level.waypoints[i];
      for (let side of [-1, 1]) {
        const mesa = new THREE.Mesh(
          new THREE.CylinderGeometry(75 + Math.random() * 25, 100 + Math.random() * 30, 130, 7),
          canyonMat
        );
        mesa.position.set(
          p.x + side * (p.width / 2 + 130 + Math.random() * 40),
          58,
          p.y + (Math.random() - 0.5) * 50
        );
        this.scene.add(mesa);
        this.levelMeshes.push(mesa);
      }
    }

    // 4. Lily Pads with Pink Flowers in Start Pool (from screenshots)
    const startWp = level.waypoints[0];
    for (let l = 0; l < 8; l++) {
      const lily = ModelFactory.createLilyPad();
      const angle = (l / 8) * Math.PI * 2;
      const dist = 90 + Math.random() * 80;
      lily.position.set(
        startWp.x + Math.cos(angle) * dist,
        0,
        startWp.y + 60 + Math.sin(angle) * 70
      );
      this.scene.add(lily);
      this.levelMeshes.push(lily);
    }

    // 5. START & FINISH Bamboo Gate Arches (from screenshots)
    // Start Gate at Checkpoint 0
    const startCp = level.checkpoints[0];
    const startArch = ModelFactory.createGateArch(startCp.width, "START");
    startArch.position.set(startCp.x, 0, startCp.y);
    this.scene.add(startArch);
    this.levelMeshes.push(startArch);

    // Finish Gate at Last Checkpoint
    const finishCp = level.checkpoints[level.checkpoints.length - 1];
    const finishArch = ModelFactory.createGateArch(finishCp.width, "FINISH");
    finishArch.position.set(finishCp.x, 0, finishCp.y);
    this.scene.add(finishArch);
    this.levelMeshes.push(finishArch);

    // 6. Obstacles (Pink Bank Rollers, Grey Slabs, Windmills, Rocks, Boosters)
    level.obstacles.forEach(obs => {
      if (obs.type === 'rock') {
        const rock = ModelFactory.createBoulder(obs.radius);
        rock.position.set(obs.x, 0, obs.y);
        this.scene.add(rock);
        this.levelMeshes.push(rock);
      } else if (obs.type === 'spike_roller' || obs.type === 'spike_strip') {
        const strip = ModelFactory.createSpikeRoller(obs.height, obs.width || 24);
        strip.position.set(obs.x, 8, obs.y);
        strip.rotation.y = -(obs.angle || 0) + Math.PI / 2;
        this.scene.add(strip);
        this.levelMeshes.push(strip);
      } else if (obs.type === 'spike_slab') {
        const slab = ModelFactory.createSpikeSlab(obs.width, obs.height);
        slab.position.set(obs.x, 0, obs.y);
        slab.rotation.y = -(obs.angle || 0);
        this.scene.add(slab);
        this.levelMeshes.push(slab);
      } else if (obs.type === 'boost') {
        const boost = ModelFactory.createSpeedChevron();
        boost.position.set(obs.x, 0, obs.y);
        this.scene.add(boost);
        this.levelMeshes.push(boost);
      } else if (obs.type === 'windmill') {
        const windmill = ModelFactory.createSpikedWindmill(obs.armLength);
        windmill.position.set(obs.x, 0, obs.y);
        this.scene.add(windmill);
        this.levelMeshes.push(windmill);
        this.dynamicMeshMap.set(obs.id, { type: 'windmill', mesh: windmill });
      } else if (obs.type === 'roller') {
        const roller = ModelFactory.createSpikedRoller(obs.width, obs.height);
        roller.position.set(obs.x, 0, obs.y);
        this.scene.add(roller);
        this.levelMeshes.push(roller);
        this.dynamicMeshMap.set(obs.id, { type: 'roller', mesh: roller });
      }
    });
  }

  /**
   * Main 3D Render Loop Step
   */
  render(level, raftState, hippos, dynamicObstacles, activeCheckpoint, dt) {
    if (!raftState) return;

    this.time += dt;

    if (level) {
      this.loadLevel(level);
    }

    // 1. Position & Rotate the Raft
    const bob = Math.sin(this.time * 3) * 1.0;
    this.raftGroup.position.set(raftState.x, bob, raftState.y);
    this.raftGroup.rotation.y = raftState.angle;

    // Visibility when alive / dead (exploding)
    this.raftMesh.visible = !raftState.isDead;

    // 2. Position Hippos on Raft Rim (Radius 32)
    if (hippos) {
      this.characterMeshes.forEach((mesh, idx) => {
        const h = hippos[idx];
        if (h && h.connected) {
          mesh.visible = true;

          if (raftState.isDead) {
            // Drowning animation: tip backward into water and sink
            mesh.position.y -= dt * 20;
            mesh.rotation.x += dt * 3;
            if (Math.random() < 0.2) {
              const worldPos = new THREE.Vector3();
              mesh.getWorldPosition(worldPos);
              this.particles.emitDrowningBubbles(worldPos);
            }
          } else {
            // Standing on rim
            const rimRadius = 32;
            const charAngle = h.angle;
            mesh.position.set(
              Math.cos(charAngle) * rimRadius,
              2.5,
              Math.sin(charAngle) * rimRadius
            );

            // ORIENTATION:
            // Butt faces outward toward water!
            // Head faces inward toward raft center!
            mesh.rotation.y = Math.PI / 2 - charAngle;
            mesh.rotation.x = 0;

            // Butt Swelling & Wobble during Fart
            if (mesh.buttMesh) {
              if (h.isFarting) {
                const jiggle = 1.0 + Math.sin(this.time * 45) * 0.25;
                mesh.buttMesh.scale.set(jiggle * 1.35, jiggle * 1.25, jiggle * 1.4);
                mesh.rotation.z = Math.sin(this.time * 50) * 0.12;
              } else {
                mesh.buttMesh.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 10);
                mesh.rotation.z = 0;
              }
            }
          }
        } else {
          mesh.visible = false;
        }
      });
    }

    // 3. Update Dynamic Obstacles
    if (dynamicObstacles) {
      dynamicObstacles.forEach(d => {
        const entry = this.dynamicMeshMap.get(d.id);
        if (entry) {
          if (entry.type === 'windmill' && entry.mesh.rotor) {
            entry.mesh.rotor.rotation.y = d.angle;
          } else if (entry.type === 'roller' && entry.mesh.roller) {
            entry.mesh.roller.position.x = d.x - entry.mesh.position.x;
          }
        }
      });
    }

    // 4. Update Particles
    this.particles.update(dt);

    // Ripple Wake Rings beneath moving raft
    const speed = Math.hypot(raftState.vx || 0, raftState.vy || 0);
    if (!raftState.isDead && speed > 5.0 && Math.random() < 0.25) {
      this.particles.emitWake(this.raftGroup.position, 40);
    }

    // 5. High-Angle Third-Person Chase Camera (FOV 60, pitch ~35-45 deg)
    this.updateCamera(dt, raftState);

    // 6. Sunlight Tracking
    this.sunLight.position.set(raftState.x + 180, 480, raftState.y - 180);
    this.sunLight.target.position.set(raftState.x, 0, raftState.y);
    this.sunLight.target.updateMatrixWorld();

    // 7. Floating Nameplates with Outline
    this.updateNameplates(hippos);

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(dt, raft) {
    const heading = raft.angle;
    const forwardX = Math.cos(heading);
    const forwardZ = Math.sin(heading);

    // High angle behind raft: ~130px behind, ~95px above (pitch ~36 degrees)
    const distBehind = 135;
    const camHeight = 98;
    const idealX = raft.x - forwardX * distBehind;
    const idealZ = raft.y - forwardZ * distBehind;
    const idealY = camHeight;

    this.camera.position.x += (idealX - this.camera.position.x) * (dt * 5.5);
    this.camera.position.z += (idealZ - this.camera.position.z) * (dt * 5.5);
    this.camera.position.y += (idealY - this.camera.position.y) * (dt * 5.5);

    // Look slightly ahead of raft down the canal
    const lookTarget = new THREE.Vector3(
      raft.x + forwardX * 40,
      10,
      raft.y + forwardZ * 40
    );
    this.camera.lookAt(lookTarget);
  }

  updateNameplates(hippos) {
    const container = document.getElementById('nameplates-container');
    if (!container || !hippos) return;

    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;

    hippos.forEach((h) => {
      let el = document.getElementById(`nameplate-${h.slot}`);
      if (!el) {
        el = document.createElement('div');
        el.id = `nameplate-${h.slot}`;
        el.className = `nameplate p${(h.slot % 4) + 1}`;
        container.appendChild(el);
      }

      if (!h.connected) {
        el.style.display = 'none';
        return;
      }

      // White bold text with dark outline (from screenshots)
      el.innerHTML = `${h.name || `Hippo ${h.slot + 1}`}`;

      const charMesh = this.characterMeshes[h.slot];
      if (charMesh && charMesh.visible) {
        const worldPos = new THREE.Vector3();
        charMesh.getWorldPosition(worldPos);
        worldPos.y += 28;

        const projected = worldPos.clone().project(this.camera);
        if (projected.z > 1.0) {
          el.style.display = 'none';
          return;
        }

        el.style.display = 'block';
        const screenX = (projected.x * widthHalf) + widthHalf;
        const screenY = -(projected.y * heightHalf) + heightHalf;
        el.style.left = `${screenX}px`;
        el.style.top = `${screenY}px`;
      }
    });
  }

  addFartParticle(x, y, angle) {
    // Direction outward from butt over the water
    const buttDir = new THREE.Vector3(Math.cos(angle), 0.12, Math.sin(angle)).normalize();
    const spawnPos = new THREE.Vector3(x, 7, y);
    this.particles.emitFart(spawnPos, buttDir, 160.0, 5);
  }

  addExplosion(x, y) {
    this.particles.emitExplosion(new THREE.Vector3(x, 10, y));
  }
}

window.Renderer3D = Renderer3D;