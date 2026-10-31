/**
 * We Fart Together — Main Game Controller & 3D WebGL Loop
 * Mobile Web App implementation with touch controls, 3rd-person chase camera, and dynamic HUD.
 */

class GameApp {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.gameMode = '1p'; // '1p', '2p', '4p'
    this.isPlaying = false;
    this.startTime = 0;
    this.elapsedTime = 0;

    // Characters on Raft
    this.characters = [];
    this.nameplates = [];

    this.initThree();
    this.initSystems();
    this.initInput();
    this.initUI();
    this.animate = this.animate.bind(this);

    // Initial render & resize
    this.onWindowResize();
    window.addEventListener('resize', () => this.onWindowResize());
  }

  /**
   * Initialize Three.js Scene, Camera, Lights, and Renderer
   */
  initThree() {
    // 1. Scene with Sky Gradient Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb3e5fc);
    this.scene.fog = new THREE.FogExp2(0xb3e5fc, 0.008);

    // 2. Camera: 3rd person follow behind the raft
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.5, 600);
    this.camera.position.set(0, 12, 16);

    // 3. Renderer with High-DPI support & shadows
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Vibrant Lighting matching cartoon TikTok clips
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xb3e5fc, 0.7);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff9c4, 1.1);
    dirLight.position.set(30, 60, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    this.scene.add(dirLight);
    this.sunLight = dirLight;
  }

  /**
   * Initialize River Track, Particles, Raft, Characters, and Physics
   */
  initSystems() {
    // 1. Particle Systems
    this.particles = new ParticleEngine(this.scene);

    // 2. Canyon River Track & Hazards
    this.track = new RiverTrack(this.scene);

    // 3. Raft Mesh
    this.raftMesh = ModelFactory.createRaft();
    this.scene.add(this.raftMesh);

    // 4. Animal Characters Clinging to Handles
    // Handle 0: Left Capybara
    const capy1 = ModelFactory.createCapybara(0xa1887f);
    capy1.position.set(1.4, 0.1, 0);
    capy1.rotation.y = -Math.PI / 2; // Face handle
    this.raftMesh.handles[0].add(capy1);
    this.characters.push(capy1);

    // Handle 1: Right Hippo
    const hippo = ModelFactory.createHippo(0x455a64);
    hippo.position.set(1.4, 0.1, 0);
    hippo.rotation.y = -Math.PI / 2;
    this.raftMesh.handles[1].add(hippo);
    this.characters.push(hippo);

    // Handle 2: Rear Capybara (Dark Fur)
    const capy2 = ModelFactory.createCapybara(0x6d4c41);
    capy2.position.set(1.4, 0.1, 0);
    capy2.rotation.y = -Math.PI / 2;
    this.raftMesh.handles[2].add(capy2);
    this.characters.push(capy2);

    // Handle 3: Front Gator/Capybara (Greenish)
    const capy3 = ModelFactory.createCapybara(0x81c784);
    capy3.position.set(1.4, 0.1, 0);
    capy3.rotation.y = -Math.PI / 2;
    this.raftMesh.handles[3].add(capy3);
    this.characters.push(capy3);

    // 5. Physics Simulation
    this.physics = new PhysicsSimulation(this.track, this.particles);
    this.physics.respawnAtCheckpoint(0);

    // Hook Callbacks
    this.physics.onDeath = (reason) => {
      this.showBannerAlert("POPPED! 💥", reason);
    };

    this.physics.onCheckpoint = (cpIdx, title) => {
      this.showBannerAlert(title, "Respawn Point Saved!");
      document.getElementById('checkpoint-display').textContent = `${cpIdx + 1} / ${this.track.checkpoints.length}`;
    };

    this.physics.onVictory = () => {
      this.triggerVictory();
    };

    // 6. Overhead Nameplates
    this.createNameplates();
  }

  /**
   * Floating Overhead Player Tags (like Steam IDs in reference videos)
   */
  createNameplates() {
    const container = document.getElementById('nameplates-container');
    container.innerHTML = '';
    this.nameplates = [];

    const names = [
      { text: "Steam 7656119919", class: "p1" },
      { text: "ramyyelles", class: "p2" },
      { text: "Steam 7656119904", class: "p3" },
      { text: "Steam 7656119920", class: "p4" }
    ];

    names.forEach((n, idx) => {
      const el = document.createElement('div');
      el.className = `nameplate ${n.class}`;
      el.innerHTML = `<span>●</span> ${n.text}`;
      container.appendChild(el);
      this.nameplates.push(el);
    });
  }

  /**
   * Handle Mobile Touch & Keyboard Controls
   */
  initInput() {
    // Touch / Pointer Down & Up on all fart buttons
    const fartButtons = document.querySelectorAll('.fart-touch-btn');

    fartButtons.forEach(btn => {
      const playerAttr = btn.getAttribute('data-player');

      const startFart = (e) => {
        e.preventDefault();
        window.sound.ensureContext();
        btn.classList.add('pressed');

        if (playerAttr === 'all') {
          for (let p = 0; p < 4; p++) this.physics.setFart(p, true);
        } else {
          this.physics.setFart(parseInt(playerAttr), true);
        }
      };

      const stopFart = (e) => {
        e.preventDefault();
        btn.classList.remove('pressed');

        if (playerAttr === 'all') {
          for (let p = 0; p < 4; p++) this.physics.setFart(p, false);
        } else {
          this.physics.setFart(parseInt(playerAttr), false);
        }
      };

      btn.addEventListener('pointerdown', startFart);
      btn.addEventListener('pointerup', stopFart);
      btn.addEventListener('pointerleave', stopFart);
      btn.addEventListener('pointercancel', stopFart);
    });

    // Keyboard controls for desktop testing
    const keysDown = {};
    window.addEventListener('keydown', (e) => {
      if (keysDown[e.code]) return;
      keysDown[e.code] = true;
      window.sound.ensureContext();

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        this.physics.setFart(0, true);
        this.highlightButton('0', true);
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        this.physics.setFart(1, true);
        this.highlightButton('1', true);
      }
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        this.physics.setFart(0, true);
        this.physics.setFart(1, true);
        this.highlightButton('all', true);
      }
      if (e.code === 'KeyR' || e.code === 'KeyY') {
        this.physics.die("Suicide Reset");
      }
    });

    window.addEventListener('keyup', (e) => {
      keysDown[e.code] = false;

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        this.physics.setFart(0, false);
        this.highlightButton('0', false);
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        this.physics.setFart(1, false);
        this.highlightButton('1', false);
      }
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        this.physics.setFart(0, false);
        this.physics.setFart(1, false);
        this.highlightButton('all', false);
      }
    });
  }

  highlightButton(playerAttr, active) {
    const btn = document.querySelector(`.fart-touch-btn[data-player="${playerAttr}"]`);
    if (btn) {
      if (active) btn.classList.add('pressed');
      else btn.classList.remove('pressed');
    }
  }

  /**
   * UI Setup & Event Listeners
   */
  initUI() {
    // Mode Select Tabs
    const modeTabs = document.querySelectorAll('.mode-tab');
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        modeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.gameMode = tab.getAttribute('data-mode');

        // Switch Mobile Controls Layout
        document.querySelectorAll('.controls-layout').forEach(l => l.classList.remove('active'));
        const targetLayout = document.getElementById(`controls-${this.gameMode}`);
        if (targetLayout) targetLayout.classList.add('active');
      });
    });

    // Start Game Button
    document.getElementById('btn-start-game').addEventListener('click', () => {
      window.sound.init();
      document.getElementById('start-modal').classList.add('hidden');
      this.startGame();
    });

    // Respawn / Suicide Button
    document.getElementById('btn-suicide').addEventListener('click', () => {
      this.physics.die("Manual Reset");
    });

    // Sound Mute Toggle
    document.getElementById('btn-sound').addEventListener('click', () => {
      const muted = window.sound.toggleMute();
      document.getElementById('sound-icon').textContent = muted ? '🔇' : '🔊';
    });

    // Fullscreen Toggle
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Replay Button
    document.getElementById('btn-replay').addEventListener('click', () => {
      document.getElementById('victory-modal').classList.add('hidden');
      this.physics.activeCheckpoint = 0;
      this.physics.respawnAtCheckpoint(0);
      this.startGame();
    });
  }

  startGame() {
    this.isPlaying = true;
    this.startTime = performance.now();
    this.physics.respawnAtCheckpoint(0);
  }

  triggerVictory() {
    this.isPlaying = false;
    window.sound.playVictory();

    document.getElementById('final-time').textContent = this.formatTime(this.elapsedTime);
    document.getElementById('final-farts').textContent = this.physics.totalFarts;
    document.getElementById('final-deaths').textContent = this.physics.totalDeaths;
    document.getElementById('victory-modal').classList.remove('hidden');
  }

  showBannerAlert(title, subtitle) {
    const alert = document.getElementById('banner-alert');
    document.getElementById('banner-title').textContent = title;
    document.getElementById('banner-subtitle').textContent = subtitle;
    alert.classList.remove('hidden');

    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      alert.classList.add('hidden');
    }, 1800);
  }

  formatTime(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Main Render Loop
   */
  startLoop() {
    this.lastTime = performance.now();
    requestAnimationFrame(this.animate);
  }

  animate(currentTime) {
    requestAnimationFrame(this.animate);

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (this.isPlaying) {
      this.elapsedTime = currentTime - this.startTime;
      document.getElementById('timer-display').textContent = this.formatTime(this.elapsedTime);

      // 1. Update Physics
      this.physics.update(dt, this.gameMode);

      // 2. Update Track Hazards (Windmills, Rollers)
      this.track.update(dt);

      // 3. Sync Raft Visual Transform
      if (this.physics.isDead) {
        this.raftMesh.visible = false;
      } else {
        this.raftMesh.visible = true;
        this.raftMesh.position.copy(this.physics.position);
        this.raftMesh.rotation.y = this.physics.rotationY;

        // Subtle raft bobbing & roll tilt
        const speed = this.physics.velocity.length();
        this.raftMesh.rotation.z = -this.physics.angularVelocity * 0.08;
        this.raftMesh.rotation.x = Math.sin(currentTime * 0.005) * 0.04;
      }

      // 4. Animate Character Butts when Farting
      this.characters.forEach((char, idx) => {
        if (char.buttMesh) {
          if (this.physics.farting[idx]) {
            // Butt swells up & jiggles
            const jiggle = 1.0 + Math.sin(currentTime * 0.04) * 0.25;
            char.buttMesh.scale.set(jiggle * 1.3, jiggle * 1.2, jiggle * 1.4);
            char.rotation.z = Math.sin(currentTime * 0.06) * 0.12; // Character wobble
          } else {
            char.buttMesh.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 10);
            char.rotation.z = 0;
          }
        }
      });

      // 5. Update Particles
      this.particles.update(dt);

      // 6. Smooth 3rd Person Follow Camera
      this.updateCamera(dt);

      // 7. Update Sunlight Position to follow player
      this.sunLight.position.set(
        this.physics.position.x + 30,
        this.physics.position.y + 60,
        this.physics.position.z + 40
      );
      this.sunLight.target.position.copy(this.physics.position);
      this.sunLight.target.updateMatrixWorld();

      // 8. Update Overhead Nameplates
      this.updateNameplates();
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 3rd Person Dynamic Chase Camera behind the Raft
   */
  updateCamera(dt) {
    const targetPos = this.physics.position;
    const streamTangent = this.track.getStreamVelocityAt(targetPos).normalize();

    // Position camera behind and above the raft relative to river flow
    const camOffset = streamTangent.clone().multiplyScalar(-13.0).add(new THREE.Vector3(0, 9.5, 0));
    const idealCamPos = targetPos.clone().add(camOffset);

    // Smooth lerp
    this.camera.position.lerp(idealCamPos, dt * 4.5);

    // Look slightly ahead of raft
    const lookTarget = targetPos.clone().add(streamTangent.clone().multiplyScalar(4.0));
    this.camera.lookAt(lookTarget);
  }

  /**
   * Project 3D character world positions to 2D screen coordinates for Nameplates
   */
  updateNameplates() {
    if (this.physics.isDead) {
      this.nameplates.forEach(np => np.style.display = 'none');
      return;
    }

    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;

    this.characters.forEach((char, idx) => {
      const np = this.nameplates[idx];
      if (!np) return;

      const worldPos = new THREE.Vector3();
      char.getWorldPosition(worldPos);
      worldPos.y += 1.8; // Floating over head

      // Check if behind camera
      const projected = worldPos.clone().project(this.camera);
      if (projected.z > 1.0) {
        np.style.display = 'none';
        return;
      }

      np.style.display = 'flex';
      const screenX = (projected.x * widthHalf) + widthHalf;
      const screenY = -(projected.y * heightHalf) + heightHalf;
      np.style.left = `${screenX}px`;
      np.style.top = `${screenY}px`;
    });
  }
}

// Start Game App on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new GameApp();
  window.gameApp.startLoop();
});
