/**
 * We Fart Together — Particle Systems Engine
 * Recreates exact visual FX matching the reference screenshots:
 * - Fart plume: directional lime-green gas cone jetting from the butt outward over the water
 * - Water ripples: concentric white wake rings beneath the raft
 * - Explosion: raft fragments, water splashes, and drowning bubbles
 */

class ParticleEngine {
  constructor(scene) {
    this.scene = scene;
    this.fartParticles = [];
    this.wakeRings = [];
    this.explosionParticles = [];
    this.drowningParticles = [];

    // Fart Particle Geometry & Material (Lime-green gas puff cone)
    this.fartGeo = new THREE.DodecahedronGeometry(5.0, 1);
    this.fartMat = new THREE.MeshStandardMaterial({
      color: 0x76ff03,
      emissive: 0x64dd17,
      roughness: 0.3,
      metalness: 0.05,
      transparent: true,
      opacity: 0.9,
      flatShading: true
    });

    // Wake Ring Geometry & Material (White water ripple ring)
    this.ringGeo = new THREE.RingGeometry(38, 44, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Raft Debris & Splash Geometry
    this.debrisGeo = new THREE.BoxGeometry(4.5, 4.5, 4.5);
    this.splashGeo = new THREE.SphereGeometry(2.5, 6, 6);
    this.splashMat = new THREE.MeshBasicMaterial({
      color: 0xe0f7fa,
      transparent: true,
      opacity: 0.8
    });

    // Raft Material Debris
    this.peachMat = new THREE.MeshStandardMaterial({ color: 0xfcd5b5, roughness: 0.4 });
    this.tealMat = new THREE.MeshStandardMaterial({ color: 0x26c6da, roughness: 0.5 });
    this.greenMat = new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 0.7 });
  }

  /**
   * Spawn lime-green fart gas cone jetting from the butt outward over the water
   */
  emitFart(position, direction, speed = 160.0, count = 5) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.fartGeo, this.fartMat.clone());
      mesh.position.copy(position);

      // Conical cone spread
      const spread = 0.28;
      const vel = direction.clone()
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() * 0.15) - 0.02,
          (Math.random() - 0.5) * spread
        ))
        .normalize()
        .multiplyScalar(speed * (0.85 + Math.random() * 0.35));

      mesh.scale.setScalar(0.75 + Math.random() * 0.55);

      this.scene.add(mesh);
      this.fartParticles.push({
        mesh: mesh,
        velocity: vel,
        life: 0.0,
        maxLife: 0.6 + Math.random() * 0.25,
        rotSpeed: (Math.random() - 0.5) * 6
      });
    }
  }

  /**
   * Spawn expanding white water wake ring beneath the raft
   */
  emitWake(position, startRadius = 40) {
    const mesh = new THREE.Mesh(this.ringGeo, this.ringMat.clone());
    mesh.position.set(position.x, 0.4, position.z);
    mesh.scale.setScalar(startRadius / 40);

    this.scene.add(mesh);
    this.wakeRings.push({
      mesh: mesh,
      radius: startRadius / 40,
      life: 0.0,
      maxLife: 1.1
    });
  }

  /**
   * Explode the raft and scatter pieces with water splashes
   */
  emitExplosion(position) {
    const debrisMats = [this.peachMat, this.tealMat, this.greenMat];
    for (let i = 0; i < 24; i++) {
      const mat = debrisMats[i % debrisMats.length].clone();
      const mesh = new THREE.Mesh(this.debrisGeo, mat);
      mesh.position.copy(position);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 180,
        Math.random() * 140 + 35,
        (Math.random() - 0.5) * 180
      );

      this.scene.add(mesh);
      this.explosionParticles.push({
        mesh: mesh,
        velocity: vel,
        rotSpeed: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12),
        life: 0.0,
        maxLife: 1.0 + Math.random() * 0.4
      });
    }

    // Water Splash drops
    for (let i = 0; i < 18; i++) {
      const drop = new THREE.Mesh(this.splashGeo, this.splashMat.clone());
      drop.position.copy(position);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 90,
        Math.random() * 80 + 30,
        (Math.random() - 0.5) * 90
      );

      this.scene.add(drop);
      this.explosionParticles.push({
        mesh: drop,
        velocity: vel,
        rotSpeed: new THREE.Vector3(0, 0, 0),
        life: 0.0,
        maxLife: 0.8
      });
    }
  }

  /**
   * Spawn drowning splash & water bubbles
   */
  emitDrowningBubbles(position) {
    for (let i = 0; i < 4; i++) {
      const bubble = new THREE.Mesh(this.splashGeo, this.splashMat.clone());
      bubble.position.set(
        position.x + (Math.random() - 0.5) * 20,
        0.2,
        position.z + (Math.random() - 0.5) * 20
      );
      bubble.scale.setScalar(0.8 + Math.random() * 0.6);

      this.scene.add(bubble);
      this.drowningParticles.push({
        mesh: bubble,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 8 + 6, (Math.random() - 0.5) * 6),
        life: 0.0,
        maxLife: 0.8
      });
    }
  }

  update(dt) {
    // 1. Fart Gas Plume
    for (let i = this.fartParticles.length - 1; i >= 0; i--) {
      const p = this.fartParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.fartParticles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(0.93);
      p.velocity.y += 14.0 * dt;

      p.mesh.rotation.x += p.rotSpeed * dt;
      p.mesh.rotation.y += p.rotSpeed * dt;

      const progress = p.life / p.maxLife;
      const scale = 1.0 + progress * 2.8;
      p.mesh.scale.set(scale, scale, scale);
      p.mesh.material.opacity = (1.0 - progress) * 0.9;
    }

    // 2. Wake Rings
    for (let i = this.wakeRings.length - 1; i >= 0; i--) {
      const r = this.wakeRings[i];
      r.life += dt;
      if (r.life >= r.maxLife) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        this.wakeRings.splice(i, 1);
        continue;
      }

      const progress = r.life / r.maxLife;
      r.radius += dt * 0.9;
      r.mesh.scale.setScalar(r.radius);
      r.mesh.material.opacity = (1.0 - progress) * 0.7;
    }

    // 3. Explosion Debris & Splashes
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const p = this.explosionParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.explosionParticles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 240.0 * dt; // Gravity
      p.mesh.rotation.x += p.rotSpeed.x * dt;
      p.mesh.rotation.y += p.rotSpeed.y * dt;

      const progress = p.life / p.maxLife;
      p.mesh.material.opacity = Math.max(0, 1.0 - progress);
    }

    // 4. Drowning Bubbles
    for (let i = this.drowningParticles.length - 1; i >= 0; i--) {
      const b = this.drowningParticles[i];
      b.life += dt;
      if (b.life >= b.maxLife) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
        this.drowningParticles.splice(i, 1);
        continue;
      }

      b.mesh.position.addScaledVector(b.velocity, dt);
      const progress = b.life / b.maxLife;
      b.mesh.scale.setScalar(1.0 + progress * 0.8);
      b.mesh.material.opacity = (1.0 - progress) * 0.8;
    }
  }

  clear() {
    this.fartParticles.forEach(p => this.scene.remove(p.mesh));
    this.wakeRings.forEach(r => this.scene.remove(r.mesh));
    this.explosionParticles.forEach(p => this.scene.remove(p.mesh));
    this.drowningParticles.forEach(b => this.scene.remove(b.mesh));
    this.fartParticles = [];
    this.wakeRings = [];
    this.explosionParticles = [];
    this.drowningParticles = [];
  }
}

window.ParticleEngine = ParticleEngine;