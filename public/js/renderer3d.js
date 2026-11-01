/**
 * We Fart Together — 3D WebGL Three.js Renderer
 * Recreates the exact visual experience from the gameplay video clips:
 * 3D chase camera, inflatable donut raft, animated capybaras/hippos,
 * neon green fart plumes, water wake rings, spiked hazards, and canyon canyon walls.
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
    // 1. Three.js Scene with Sky Gradient Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x81d4fa);
    // Adjusted fog for pixel-scale world (0.0004 allows seeing ~2000px down river with gentle haze)
    this.scene.fog = new THREE.FogExp2(0xb3e5fc, 0.0004);

    // 2. Perspective Camera (3rd Person Chase Camera)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(54, aspect, 1, 4500);
    this.camera.position.set(300, 130, 0);

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
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x81d4fa, 0.8);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff9c4, 1.25);
    dirLight.position.set(200, 450, -200);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 50;
    dirLight.shadow.camera.far = 1500;
    dirLight.shadow.camera.left = -320;
    dirLight.shadow.camera.right = 320;
    dirLight.shadow.camera.top = 320;
    dirLight.shadow.camera.bottom = -320;
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
    // 3D Inflatable Donut Raft
    this.raftGroup = new THREE.Group();
    this.scene.add(this.raftGroup);

    // SCALE FACTOR: ModelFactory torus has major radius 1.5.
    // Physics RAFT_RADIUS is 55px.
    // Scaling raftGroup by 55 / 1.5 = ~36.67 scales raft and child characters to exact physics bounds!
    this.RAFT_SCALE = 55 / 1.5;
    this.raftGroup.scale.setScalar(this.RAFT_SCALE);

    // Raft Model (Torus r=1.5, tube=0.45)
    this.raftMesh = ModelFactory.createRaft();
    this.raftGroup.add(this.raftMesh);

    // Animal Characters on rim
    // 0: Brown Capybara, 1: Teal Hippo, 2: Dark Bear/Capy, 3: Green Croc/Hippo
    const charDefs = [
      { type: 'capy', color: 0x8d6e63 },
      { type: 'hippo', color: 0x455a64 },
      { type: 'capy', color: 0xd97706 },
      { type: 'hippo', color: 0x7c3aed }
    ];

    this.characterMeshes = [];
    charDefs.forEach((def) => {
      const char = def.type === 'capy'
        ? ModelFactory.createCapybara(def.color)
        : ModelFactory.createHippo(def.color);

      char.position.set(0, 0, 0);
      char.visible = false;
      this.raftGroup.add(char);
      this.characterMeshes.push(char);
    });
  }

  /**
   * Build 3D River Canal & Obstacles from Level Data
   */
  loadLevel(level) {
    if (this.currentLevelId === level.id) return;
    this.currentLevelId = level.id;

    // Clear previous level meshes
    this.levelMeshes.forEach(m => this.scene.remove(m));
    this.levelMeshes = [];
    this.dynamicMeshMap.clear();

    // 1. Build Water Surface Mesh from waypoints
    const pts = level.waypoints;
    const waterGeo = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const pNext = pts[Math.min(i + 1, pts.length - 1)];
      const pPrev = pts[Math.max(i - 1, 0)];
      const dx = pNext.x - pPrev.x;
      const dz = pNext.y - pPrev.y; // 2D Y is 3D Z
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const halfW = p.width / 2;
      const leftX = p.x + nx * halfW;
      const leftZ = p.y + nz * halfW;
      const rightX = p.x - nx * halfW;
      const rightZ = p.y - nz * halfW;

      const waterY = 0;
      positions.push(leftX, waterY, leftZ);
      positions.push(rightX, waterY, rightZ);

      uvs.push(0, (i / pts.length) * 20);
      uvs.push(1, (i / pts.length) * 20);

      if (i < pts.length - 1) {
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
      color: 0x29b6f6,
      roughness: 0.12,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.receiveShadow = true;
    this.scene.add(waterMesh);
    this.levelMeshes.push(waterMesh);
    this.waterMesh = waterMesh;

    // 2. Build Border Rails (Bamboo/Green trim along sides)
    for (let side of [-1, 1]) {
      const railCurvePts = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const pNext = pts[Math.min(i + 1, pts.length - 1)];
        const pPrev = pts[Math.max(i - 1, 0)];
        const dx = pNext.x - pPrev.x;
        const dz = pNext.y - pPrev.y;
        const len = Math.hypot(dx, dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;
        const halfW = p.width / 2;
        railCurvePts.push(new THREE.Vector3(
          p.x + side * nx * (halfW + 5),
          6,
          p.y + side * nz * (halfW + 5)
        ));
      }
      const railCurve = new THREE.CatmullRomCurve3(railCurvePts);
      const tubeGeo = new THREE.TubeGeometry(railCurve, 90, 7, 8, false);
      const railMat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.7 });
      const railMesh = new THREE.Mesh(tubeGeo, railMat);
      railMesh.receiveShadow = true;
      this.scene.add(railMesh);
      this.levelMeshes.push(railMesh);
    }

    // 3. Canyon Mesas / Sandstone Cliffs along river
    const canyonMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.95, flatShading: true });
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      for (let side of [-1, 1]) {
        const mesa = new THREE.Mesh(
          new THREE.CylinderGeometry(70 + Math.random() * 30, 95 + Math.random() * 30, 120, 7),
          canyonMat
        );
        mesa.position.set(
          p.x + side * (p.width / 2 + 130 + Math.random() * 40),
          55,
          p.y + (Math.random() - 0.5) * 60
        );
        this.scene.add(mesa);
        this.levelMeshes.push(mesa);
      }
    }

    // 4. Checkpoint Wooden Archways (scaled to span canal width)
    level.checkpoints.forEach((cp) => {
      const arch = ModelFactory.createCheckpointArch(cp.label);
      arch.position.set(cp.x, 0, cp.y);
      // Base arch width between posts is 13 units
      const scaleXZ = cp.width / 13;
      const scaleY = 9.0;
      arch.scale.set(scaleXZ, scaleY, scaleXZ);
      this.scene.add(arch);
      this.levelMeshes.push(arch);
    });

    // 5. Obstacles (Shrunk Rocks, Spikes, Windmills, Rollers, Boosters)
    level.obstacles.forEach(obs => {
      if (obs.type === 'rock') {
        const rock = ModelFactory.createBoulder(obs.radius);
        rock.position.set(obs.x, obs.radius * 0.7, obs.y);
        this.scene.add(rock);
        this.levelMeshes.push(rock);
      } else if (obs.type === 'spike_strip') {
        const strip = ModelFactory.createSpikeStrip(obs.height, obs.width || 20);
        strip.position.set(obs.x, 8, obs.y);
        strip.rotation.y = -(obs.angle || 0) + Math.PI / 2;
        this.scene.add(strip);
        this.levelMeshes.push(strip);
      } else if (obs.type === 'boost') {
        const boost = ModelFactory.createSpeedChevron();
        boost.position.set(obs.x, 1, obs.y);
        boost.scale.set(22, 22, 22);
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
   * Main 3D Render Step
   */
  render(level, raftState, hippos, dynamicObstacles, activeCheckpoint, dt) {
    if (!raftState) return;

    this.time += dt;

    // Load Level if needed
    if (level) {
      this.loadLevel(level);
    }

    // 1. Position & Rotate the Raft (World 2D X -> 3D X, 2D Y -> 3D Z)
    const bob = Math.sin(this.time * 4) * 1.5;
    this.raftGroup.position.set(raftState.x, bob, raftState.y);
    this.raftGroup.rotation.y = raftState.angle;

    // Subtle Raft Bobbing and Tilt (safe with vRot default)
    const vRot = raftState.vRot || 0;
    this.raftGroup.rotation.z = -vRot * 0.35;
    this.raftGroup.rotation.x = Math.sin(this.time * 3) * 0.03;

    // 2. Position Hippos along the Raft Rim (in local raft space)
    if (hippos) {
      this.characterMeshes.forEach((mesh, idx) => {
        const h = hippos[idx];
        if (h && h.connected) {
          mesh.visible = true;

          // Local coordinate: Torus major radius is 1.5
          const rimRadius = 1.45;
          const charAngle = h.angle;
          mesh.position.set(
            Math.cos(charAngle) * rimRadius,
            0.2,
            Math.sin(charAngle) * rimRadius
          );

          // ORIENTATION:
          // Local +Z (butt) points outward toward the water!
          // Local -Z (head) points inward toward the raft center!
          mesh.rotation.y = Math.PI / 2 - charAngle;

          // Animate Butt Swelling / Recoil on Fart
          if (mesh.buttMesh) {
            if (h.isFarting) {
              const jiggle = 1.0 + Math.sin(this.time * 45) * 0.28;
              const chargeScale = 1.0 + (h.fartCharge || 0) * 0.5;
              mesh.buttMesh.scale.set(jiggle * chargeScale * 1.3, jiggle * 1.2, jiggle * chargeScale * 1.4);
              mesh.rotation.z = Math.sin(this.time * 60) * 0.15; // Wobble recoil
            } else {
              mesh.buttMesh.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 10);
              mesh.rotation.z = 0;
            }
          }
        } else {
          mesh.visible = false;
        }
      });
    }

    // 3. Update Dynamic Obstacles (Windmills, Rollers)
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

    // 4. Update 3D Particles (Neon-Green Farts & Explosions)
    this.particles.update(dt);

    // Periodic Water Wake Ring
    const speed = Math.hypot(raftState.vx || 0, raftState.vy || 0);
    if (speed > 0.8 && Math.random() < 0.25) {
      this.particles.emitWake(this.raftGroup.position, 52);
    }

    // 5. 3rd-Person Dynamic Chase Camera behind the Raft
    this.updateCamera(dt, raftState);

    // 6. Update Sunlight tracking
    this.sunLight.position.set(raftState.x + 180, 420, raftState.y - 160);
    this.sunLight.target.position.set(raftState.x, 0, raftState.y);
    this.sunLight.target.updateMatrixWorld();

    // 7. Update 2D Floating Nameplates projected from 3D heads
    this.updateNameplates(hippos);

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(dt, raft) {
    // Current heading in 2D angle
    const currentHeading = raft.angle;
    const forwardX = Math.cos(currentHeading);
    const forwardZ = Math.sin(currentHeading);

    // Camera behind and above the raft
    const distBehind = 160;
    const camHeight = 110;
    const idealX = raft.x - forwardX * distBehind;
    const idealZ = raft.y - forwardZ * distBehind;
    const idealY = camHeight;

    // Smooth lerp
    this.camera.position.x += (idealX - this.camera.position.x) * (dt * 5.5);
    this.camera.position.z += (idealZ - this.camera.position.z) * (dt * 5.5);
    this.camera.position.y += (idealY - this.camera.position.y) * (dt * 5.5);

    // Look slightly ahead of raft
    const lookTarget = new THREE.Vector3(
      raft.x + forwardX * 45,
      12,
      raft.y + forwardZ * 45
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

      el.innerHTML = `<span>●</span> ${h.name || `Hippo ${h.slot + 1}`}`;

      const charMesh = this.characterMeshes[h.slot];
      if (charMesh && charMesh.visible) {
        const worldPos = new THREE.Vector3();
        charMesh.getWorldPosition(worldPos);
        worldPos.y += 35; // Head offset in world coordinates

        const projected = worldPos.clone().project(this.camera);
        if (projected.z > 1.0) {
          el.style.display = 'none';
          return;
        }

        el.style.display = 'flex';
        const screenX = (projected.x * widthHalf) + widthHalf;
        const screenY = -(projected.y * heightHalf) + heightHalf;
        el.style.left = `${screenX}px`;
        el.style.top = `${screenY}px`;
      }
    });
  }

  addFartParticle(x, y, angle, power = 1.0) {
    // In 3D: world pos on raft rim
    const buttDir = new THREE.Vector3(Math.cos(angle), 0.18, Math.sin(angle)).normalize();
    const spawnPos = new THREE.Vector3(x, 10, y);
    this.particles.emitFart(spawnPos, buttDir, 160.0 * power, 4);
  }

  addExplosion(x, y) {
    this.particles.emitExplosion(new THREE.Vector3(x, 12, y));
  }
}

window.Renderer3D = Renderer3D;