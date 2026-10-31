/**
 * We Fart Together — Raft Rigid Body & Fart Dynamics Engine
 * Simulates planar rigid-body translation, fart-induced torque, fluid damping, and hazard collisions.
 */

class PhysicsSimulation {
  constructor(track, particleEngine) {
    this.track = track;
    this.particles = particleEngine;

    // Raft Properties
    this.radius = 1.85;
    this.mass = 1.0;
    this.inertia = 1.2;

    // State Vectors
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotationY = Math.PI; // Face downstream (-Z)
    this.angularVelocity = 0.0;

    // Fart Forces
    this.fartThrustPower = 28.0;
    this.fartTorquePower = 7.5;
    this.linearDamping = 2.8;
    this.angularDamping = 3.6;

    // Player Handle Setup (Relative angles on donut rim)
    // P0: Left (-PI/2), P1: Right (+PI/2), P2: Rear (PI), P3: Front (0)
    this.playerAngles = [
      Math.PI / 2,     // Player 0 (Left Capybara)
      -Math.PI / 2,    // Player 1 (Right Hippo)
      Math.PI,         // Player 2 (Back)
      0.0              // Player 3 (Front)
    ];

    // Active Fart States
    this.farting = [false, false, false, false];
    this.fartCoolDowns = [0, 0, 0, 0];

    // Stats
    this.totalFarts = 0;
    this.totalDeaths = 0;
    this.isDead = false;
    this.activeCheckpoint = 0;

    // Callbacks
    this.onDeath = null;
    this.onCheckpoint = null;
    this.onVictory = null;
  }

  /**
   * Reset raft state to a specific checkpoint
   */
  respawnAtCheckpoint(cpIndex = this.activeCheckpoint) {
    const cp = this.track.checkpoints[cpIndex] || this.track.checkpoints[0];
    this.position.copy(cp.position).add(new THREE.Vector3(0, 0.2, 0));
    this.velocity.set(0, 0, 0);

    // Align with stream tangent
    const angle = Math.atan2(cp.tangent.x, cp.tangent.z);
    this.rotationY = angle;
    this.angularVelocity = 0;
    this.isDead = false;

    // Clear particles
    this.particles.clear();
  }

  /**
   * Trigger Fart for player index
   */
  setFart(playerIndex, isFarting) {
    if (this.isDead) return;
    this.farting[playerIndex] = isFarting;
  }

  /**
   * Main Physics Step
   */
  update(dt, gameMode = '1p') {
    if (this.isDead) return;

    // Cap delta time to prevent tunneling
    dt = Math.min(dt, 0.05);

    // 1. AI Co-Pilot Behavior for Solo Mode
    if (gameMode === '1p') {
      this.updateAICoPilot(dt);
    }

    // 2. Stream Current Force
    const streamVel = this.track.getStreamVelocityAt(this.position);
    const relativeVel = this.velocity.clone().sub(streamVel);

    // Stream drag accelerates or drags the raft along the current
    const streamForce = streamVel.clone().sub(this.velocity).multiplyScalar(this.linearDamping);
    const totalForce = streamForce.clone();
    let totalTorque = -this.angularVelocity * this.angularDamping * this.inertia;

    // 3. Process Fart Impulses & Torque from each player
    const raftForward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    const raftRight = new THREE.Vector3(Math.cos(this.rotationY), 0, -Math.sin(this.rotationY));

    for (let i = 0; i < 4; i++) {
      if (this.farting[i]) {
        this.fartCoolDowns[i] -= dt;
        if (this.fartCoolDowns[i] <= 0) {
          this.fartCoolDowns[i] = 0.08; // Continuous pulse rate
          this.totalFarts++;

          // Audio & Haptics
          if (window.sound) window.sound.playFart(1.0 + (i * 0.15), 1.0);
          if (navigator.vibrate) navigator.vibrate(30);

          // Calculate world position and direction of player's rear
          const charAngle = this.rotationY + this.playerAngles[i];
          const charOffset = new THREE.Vector3(
            Math.sin(charAngle) * (this.radius - 0.3),
            0.4,
            Math.cos(charAngle) * (this.radius - 0.3)
          );
          const worldCharPos = this.position.clone().add(charOffset);

          // Gas shoots outward away from raft center
          const gasDirection = charOffset.clone().normalize();
          this.particles.emitFart(worldCharPos, gasDirection, 9.0, 3);

          // Reactive Force pushes opposite to gas direction
          const thrustDir = gasDirection.clone().negate();
          const thrust = thrustDir.multiplyScalar(this.fartThrustPower);
          totalForce.add(thrust);

          // Rotational Torque: P0 (Left) turns Right (+Torque), P1 (Right) turns Left (-Torque)
          if (i === 0) totalTorque += this.fartTorquePower;
          if (i === 1) totalTorque -= this.fartTorquePower;
          if (i === 2) totalForce.add(raftForward.clone().multiplyScalar(this.fartThrustPower * 0.8));
          if (i === 3) totalForce.add(raftForward.clone().multiplyScalar(-this.fartThrustPower * 0.8));
        }
      } else {
        this.fartCoolDowns[i] = 0;
      }
    }

    // 4. Integrate Linear Acceleration & Velocity
    const acceleration = totalForce.divideScalar(this.mass);
    this.velocity.addScaledVector(acceleration, dt);
    this.position.addScaledVector(this.velocity, dt);

    // 5. Integrate Angular Acceleration & Rotation
    const angularAcc = totalTorque / this.inertia;
    this.angularVelocity += angularAcc * dt;
    this.rotationY += this.angularVelocity * dt;

    // Keep raft sitting on water spline elevation
    const closestU = this.track.getClosestU(this.position);
    const splinePt = this.track.riverCurve.getPointAt(closestU);
    this.position.y = THREE.MathUtils.lerp(this.position.y, splinePt.y + 0.1, dt * 6.0);

    // Periodic Water Wake Ring
    if (this.velocity.lengthSq() > 8.0 && Math.random() < 0.3) {
      this.particles.emitWake(this.position, this.radius);
    }

    // 6. Check Boundary Walls & Collisions
    this.checkCollisions(closestU, splinePt);

    // 7. Check Boost Pads
    this.checkBoostPads();

    // 8. Check Checkpoints & Finish
    this.checkCheckpoints(closestU);
  }

  /**
   * Smart AI Co-Pilot for Solo Mode: Helps steer away from outer spike walls
   */
  updateAICoPilot(dt) {
    const closestU = this.track.getClosestU(this.position);
    const splinePt = this.track.riverCurve.getPointAt(closestU);
    const tangent = this.track.riverCurve.getTangentAt(closestU);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    // Lateral offset from canal centerline
    const delta = this.position.clone().sub(splinePt);
    const lateralDist = delta.dot(normal);

    // If drifting too close to walls, AI pulses opposite fart to help steer back
    const safeMargin = this.track.trackWidth / 2 - this.radius - 1.2;
    if (lateralDist > safeMargin && !this.farting[1]) {
      // Too far right -> fart right handle to turn left
      this.farting[1] = true;
    } else if (lateralDist < -safeMargin && !this.farting[0]) {
      // Too far left -> fart left handle to turn right
      this.farting[0] = true;
    }
  }

  /**
   * Collision Detection: Track borders, Spiked Walls, Rotating Windmills, Rollers
   */
  checkCollisions(u, splinePt) {
    const tangent = this.track.riverCurve.getTangentAt(u);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const delta = this.position.clone().sub(splinePt);
    const lateralDist = delta.dot(normal);
    const halfW = this.track.trackWidth / 2;
    const maxAllowedDist = halfW - this.radius;

    // 1. Canal Border Wall Collision
    if (Math.abs(lateralDist) > maxAllowedDist) {
      // Check if this segment has Spikes
      const inSpikeZone = this.isNearSpikeZone(u, lateralDist > 0 ? 1 : -1);
      if (inSpikeZone) {
        this.die("Popped on border spikes!");
        return;
      }

      // Elastic bounce off normal bamboo wall
      const penetration = Math.abs(lateralDist) - maxAllowedDist;
      const pushDir = normal.clone().multiplyScalar(lateralDist > 0 ? -1 : 1);
      this.position.addScaledVector(pushDir, penetration);
      this.velocity.reflect(pushDir).multiplyScalar(0.5);
    }

    // 2. Obstacle Hazards Collision
    for (const hazard of this.track.hazards) {
      const dist = this.position.distanceTo(hazard.position);
      const hitRadius = this.radius + (hazard.radius || 1.8);

      if (dist < hitRadius) {
        if (hazard.type === 'windmill') {
          // Check arm angles or proximity to center
          this.die("Chopped by spiked windmill!");
          return;
        } else if (hazard.type === 'roller') {
          this.die("Crushed by spiked roller!");
          return;
        } else if (hazard.type === 'boulder') {
          // Elastic bounce off rock
          const push = this.position.clone().sub(hazard.position).normalize();
          this.velocity.reflect(push).multiplyScalar(0.6);
          this.position.addScaledVector(push, 0.4);
        }
      }
    }
  }

  /**
   * Helper to check if raft is near a spiked section of the wall
   */
  isNearSpikeZone(u, side) {
    for (const h of this.track.hazards) {
      if (h.type === 'spikeWall') {
        const dist = this.position.distanceTo(h.position);
        if (dist < 4.5) return true;
      }
    }
    return false;
  }

  /**
   * Speed Boost Chevron interaction
   */
  checkBoostPads() {
    for (const pad of this.track.boostPads) {
      const dist = this.position.distanceTo(pad.position);
      if (dist < pad.radius) {
        // Apply forward boost impulse
        const boostVel = pad.tangent.clone().multiplyScalar(pad.boostPower);
        this.velocity.add(boostVel);
        if (window.sound) window.sound.playBoost();
        if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
        break;
      }
    }
  }

  /**
   * Checkpoint & Finish line detection
   */
  checkCheckpoints(u) {
    for (let i = 0; i < this.track.checkpoints.length; i++) {
      const cp = this.track.checkpoints[i];
      const dist = this.position.distanceTo(cp.position);

      if (dist < cp.radius && i > this.activeCheckpoint) {
        this.activeCheckpoint = i;
        if (window.sound) window.sound.playCheckpoint();

        if (i === this.track.checkpoints.length - 1) {
          // Victory!
          if (this.onVictory) this.onVictory();
        } else {
          if (this.onCheckpoint) this.onCheckpoint(i, cp.title);
        }
        break;
      }
    }
  }

  /**
   * Raft Pop / Explosion & Checkpoint Respawn
   */
  die(reason = "Popped!") {
    if (this.isDead) return;
    this.isDead = true;
    this.totalDeaths++;

    // Audio & Haptics
    if (window.sound) window.sound.playExplosion();
    if (navigator.vibrate) navigator.vibrate([100, 50, 150]);

    // Visual Explosion
    this.particles.emitExplosion(this.position);

    if (this.onDeath) this.onDeath(reason);

    // Instant respawn after 0.75s
    setTimeout(() => {
      this.respawnAtCheckpoint();
    }, 750);
  }
}

window.PhysicsSimulation = PhysicsSimulation;
