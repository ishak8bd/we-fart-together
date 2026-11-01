/**
 * We Fart Together — Particle Systems Engine
 * High-performance instanced / pooled particles for Fart Jets, Water Wake Rings, and Explosions.
 * Sized and tuned for the pixel-scale world coordinates (raft radius 55px).
 */

class ParticleEngine {
  constructor(scene) {
    this.scene = scene;
    this.fartParticles = [];
    this.wakeRings = [];
    this.explosionParticles = [];

    // Fart Particle Geometry & Material (Pixel-scale neon green puffs)
    this.fartGeo = new THREE.DodecahedronGeometry(5.5, 1);
    this.fartMat = new THREE.MeshStandardMaterial({
      color: 0x76ff03,
      emissive: 0x33691e,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
      flatShading: true
    });

    // Wake Ring Geometry & Material (Expanding white water ripple ring)
    this.ringGeo = new THREE.RingGeometry(46, 52, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Explosion Particle Geometry
    this.debrisGeo = new THREE.BoxGeometry(4.5, 4.5, 4.5);
    this.debrisMat = new THREE.MeshStandardMaterial({
      color: 0xffeb3b,
      roughness: 0.3,
      flatShading: true
    });

    // Smoke puff geometry for explosions
    this.smokeGeo = new THREE.DodecahedronGeometry(8.0, 1);
  }

  /**
   * Spawn a burst of neon-green fart gas from a character's rear end
   */
  emitFart(position, direction, speed = 140.0, count = 4) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.fartGeo, this.fartMat.clone());
      mesh.position.copy(position);

      // Random jitter in direction
      const spread = 0.35;
      const vel = direction.clone()
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() * 0.25) + 0.1,
          (Math.random() - 0.5) * spread
        ))
        .normalize()
        .multiplyScalar(speed * (0.8 + Math.random() * 0.45));

      mesh.scale.setScalar(0.8 + Math.random() * 0.5);

      this.scene.add(mesh);
      this.fartParticles.push({
        mesh: mesh,
        velocity: vel,
        life: 0.0,
        maxLife: 0.55 + Math.random() * 0.3,
        rotSpeed: (Math.random() - 0.5) * 8
      });
    }
  }

  /**
   * Spawn an expanding white water wake ring beneath the raft
   */
  emitWake(position, startRadius = 50) {
    const mesh = new THREE.Mesh(this.ringGeo, this.ringMat.clone());
    mesh.position.set(position.x, 0.4, position.z);
    mesh.scale.setScalar(startRadius / 50);

    this.scene.add(mesh);
    this.wakeRings.push({
      mesh: mesh,
      radius: startRadius / 50,
      life: 0.0,
      maxLife: 1.2
    });
  }

  /**
   * Spawn cartoon skull explosion / raft pop
   */
  emitExplosion(position) {
    const colors = [0xffeb3b, 0xff7043, 0xffffff, 0x76ff03];
    for (let i = 0; i < 28; i++) {
      const mat = this.debrisMat.clone();
      mat.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
      const mesh = new THREE.Mesh(this.debrisGeo, mat);
      mesh.position.copy(position);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 160,
        Math.random() * 140 + 40,
        (Math.random() - 0.5) * 160
      );

      this.scene.add(mesh);
      this.explosionParticles.push({
        mesh: mesh,
        velocity: vel,
        rotSpeed: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        life: 0.0,
        maxLife: 0.9 + Math.random() * 0.4
      });
    }

    // Expanding smoke puff cloud
    for (let i = 0; i < 12; i++) {
      const smokeMat = this.fartMat.clone();
      smokeMat.color.setHex(0xffffff);
      smokeMat.opacity = 0.9;
      const mesh = new THREE.Mesh(this.smokeGeo, smokeMat);
      mesh.position.copy(position).add(new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        Math.random() * 15 + 5,
        (Math.random() - 0.5) * 15
      ));
      mesh.scale.setScalar(1.2 + Math.random() * 1.2);

      this.scene.add(mesh);
      this.explosionParticles.push({
        mesh: mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 30, Math.random() * 40 + 20, (Math.random() - 0.5) * 30),
        rotSpeed: new THREE.Vector3(1, 1, 1),
        life: 0.0,
        maxLife: 0.75,
        isSmoke: true
      });
    }
  }

  /**
   * Update particle lifetimes and animations
   */
  update(dt) {
    // Update Fart Particles
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

      // Physics: Move, expand, and rise slightly
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(0.92); // Drag
      p.velocity.y += 18.0 * dt; // Buoyancy rising

      p.mesh.rotation.x += p.rotSpeed * dt;
      p.mesh.rotation.y += p.rotSpeed * dt;

      // Expand & Fade
      const progress = p.life / p.maxLife;
      const scale = 1.0 + progress * 2.4;
      p.mesh.scale.set(scale, scale, scale);
      p.mesh.material.opacity = (1.0 - progress) * 0.88;
    }

    // Update Water Wake Rings
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
      r.radius += dt * 0.8;
      r.mesh.scale.setScalar(r.radius);
      r.mesh.material.opacity = (1.0 - progress) * 0.65;
    }

    // Update Explosion Particles
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
      if (!p.isSmoke) {
        p.velocity.y -= 220.0 * dt; // Gravity on debris
        p.mesh.rotation.x += p.rotSpeed.x * dt;
        p.mesh.rotation.y += p.rotSpeed.y * dt;
      } else {
        p.velocity.multiplyScalar(0.92);
        const progress = p.life / p.maxLife;
        const scale = 1.0 + progress * 2.8;
        p.mesh.scale.setScalar(scale);
        p.mesh.material.opacity = (1.0 - progress) * 0.9;
      }
    }
  }

  clear() {
    this.fartParticles.forEach(p => this.scene.remove(p.mesh));
    this.wakeRings.forEach(r => this.scene.remove(r.mesh));
    this.explosionParticles.forEach(p => this.scene.remove(p.mesh));
    this.fartParticles = [];
    this.wakeRings = [];
    this.explosionParticles = [];
  }
}

window.ParticleEngine = ParticleEngine;