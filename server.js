/**
 * We Fart Together — Authoritative Multiplayer Game Server
 * Stack: Node.js + Express + Socket.IO + Matter.js (Server-only physics)
 *
 * Implements exact physics specifications:
 * - Raft Diameter: 80px (Radius: 40px)
 * - Rotation locked (infinite inertia, follows smoothed track tangent)
 * - Zero river current (raft sits still in water)
 * - Fixed thrust per player (opposite pairs cancel exactly)
 * - Linear water drag: 1 farter ~40 px/s (0.5 D/s), 4 farters ~160 px/s (2.0 D/s)
 * - Small bounce on walls/rocks (restitution 0.3, friction 0)
 * - Spiked hazards trigger explosion & drowning (2s respawn delay)
 * - Continuous boundary polylines with closed end caps
 * - SUICIDE command for manual checkpoint respawn
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const Matter = require('matter-js');
const {
  LEVELS,
  RAFT_RADIUS,
  RAFT_DIAMETER,
  MIN_GAP_REQUIRED,
  computeBoundaryPolylines
} = require('./shared/levels');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 10000,
  pingTimeout: 5000
});

const PORT = process.env.PORT || 3000;

// Serve public static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));

// Hippos visual colors for slots 0..3 matching reference screenshots
const HIPPO_COLORS = [
  { name: 'Blue Hippo', hex: '#42a5f5', belly: '#bbdefb' },
  { name: 'Orange Hippo', hex: '#fb8c00', belly: '#ffe0b2' },
  { name: 'Green Dino-Hippo', hex: '#7cb342', belly: '#dcedc8' },
  { name: 'Dark Bear', hex: '#4e342e', belly: '#d7ccc8' }
];

// Active Game Rooms
const rooms = new Map();

/**
 * Generate 4-character uppercase room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

/**
 * Room Instance holding Matter.js Physics Engine and Player Slots
 */
class GameRoom {
  constructor(code, hostSocketId, targetPlayerCount, levelId = 1) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.targetPlayerCount = Math.max(1, Math.min(4, targetPlayerCount));
    this.levelId = levelId;
    this.levelData = LEVELS.find(l => l.id === levelId) || LEVELS[0];

    // Slots: array of length targetPlayerCount
    this.players = [];
    this.playerTokens = new Map(); // token -> slotIndex
    this.disconnectTimers = new Map();

    // Game state
    this.state = 'lobby'; // 'lobby', 'playing', 'paused', 'victory'
    this.pauseReason = '';
    this.currentCheckpoint = 0;
    this.totalFarts = 0;
    this.totalDeaths = 0;
    this.startTime = 0;
    this.pauseStartTime = 0;
    this.totalPausedDuration = 0;
    this.seq = 0;
    this.isRespawning = false;

    // Physics Engine (Matter.js)
    this.initPhysics();

    // Timestep loops
    this.physicsInterval = null;
    this.broadcastInterval = null;
  }

  initPhysics() {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 } // Top-down 2D river plane
    });
    this.world = this.engine.world;

    // 1. Create Raft Rigid Body with LOCKED ROTATION (infinite inertia)
    const startPos = this.levelData.startPosition;
    this.raft = Matter.Bodies.circle(startPos.x, startPos.y, RAFT_RADIUS, {
      mass: 4.0,
      inertia: Infinity,
      inverseInertia: 0,
      restitution: 0.3,     // Small realistic bounce
      friction: 0.0,
      frictionAir: 0.0,     // Linear water drag applied manually
      label: 'raft'
    });
    Matter.Body.setAngle(this.raft, this.levelData.startAngle);
    Matter.World.add(this.world, this.raft);

    // 2. Build River Canal Walls & Spikes from continuous polylines
    this.wallBodies = [];
    this.spikeBodies = [];
    this.rockBodies = [];
    this.buildTrackColliders();

    // 3. Dynamic Obstacles (Windmills, Rollers)
    this.dynamicObstacles = [];
    this.initDynamicObstacles();

    // 4. Collision Listener
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      event.pairs.forEach(pair => {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        if (labels.includes('raft') && labels.includes('spike')) {
          this.handleRaftPop("Popped on spikes!");
        }
      });
    });
  }

  buildTrackColliders() {
    const { leftPts, rightPts } = computeBoundaryPolylines(this.levelData.waypoints);
    const wallThick = 50;

    // Left wall continuous segments
    for (let i = 0; i < leftPts.length - 1; i++) {
      const p1 = leftPts[i];
      const p2 = leftPts[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const nx = -dy / len;
      const ny = dx / len;

      const midX = (p1.x + p2.x) / 2 + nx * (wallThick / 2);
      const midY = (p1.y + p2.y) / 2 + ny * (wallThick / 2);

      const wall = Matter.Bodies.rectangle(midX, midY, len + 10, wallThick, {
        isStatic: true,
        angle: angle,
        restitution: 0.3,
        friction: 0.0,
        label: 'wall'
      });
      Matter.World.add(this.world, wall);
      this.wallBodies.push(wall);

      // Corner joint circle to prevent gaps
      const joint = Matter.Bodies.circle(p1.x, p1.y, 18, {
        isStatic: true,
        restitution: 0.3,
        friction: 0.0,
        label: 'wall'
      });
      Matter.World.add(this.world, joint);
      this.wallBodies.push(joint);
    }

    // Right wall continuous segments
    for (let i = 0; i < rightPts.length - 1; i++) {
      const p1 = rightPts[i];
      const p2 = rightPts[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const nx = dy / len;
      const ny = -dx / len;

      const midX = (p1.x + p2.x) / 2 + nx * (wallThick / 2);
      const midY = (p1.y + p2.y) / 2 + ny * (wallThick / 2);

      const wall = Matter.Bodies.rectangle(midX, midY, len + 10, wallThick, {
        isStatic: true,
        angle: angle,
        restitution: 0.3,
        friction: 0.0,
        label: 'wall'
      });
      Matter.World.add(this.world, wall);
      this.wallBodies.push(wall);

      // Corner joint circle
      const joint = Matter.Bodies.circle(p1.x, p1.y, 18, {
        isStatic: true,
        restitution: 0.3,
        friction: 0.0,
        label: 'wall'
      });
      Matter.World.add(this.world, joint);
      this.wallBodies.push(joint);
    }

    // End caps:
    // 1. Behind Start
    const pStartL = leftPts[0];
    const pStartR = rightPts[0];
    const startCapLen = Math.hypot(pStartR.x - pStartL.x, pStartR.y - pStartL.y);
    const startCapAngle = Math.atan2(pStartR.y - pStartL.y, pStartR.x - pStartL.x);
    const startCap = Matter.Bodies.rectangle(
      (pStartL.x + pStartR.x) / 2,
      (pStartL.y + pStartR.y) / 2 - wallThick / 2,
      startCapLen + 20,
      wallThick,
      { isStatic: true, angle: startCapAngle, restitution: 0.3, friction: 0, label: 'wall' }
    );
    Matter.World.add(this.world, startCap);
    this.wallBodies.push(startCap);

    // 2. Past Finish
    const lastIdx = leftPts.length - 1;
    const pEndL = leftPts[lastIdx];
    const pEndR = rightPts[lastIdx];
    const endCapLen = Math.hypot(pEndR.x - pEndL.x, pEndR.y - pEndL.y);
    const endCapAngle = Math.atan2(pEndR.y - pEndL.y, pEndR.x - pEndL.x);
    const endCap = Matter.Bodies.rectangle(
      (pEndL.x + pEndR.x) / 2,
      (pEndL.y + pEndR.y) / 2 + wallThick / 2,
      endCapLen + 20,
      wallThick,
      { isStatic: true, angle: endCapAngle, restitution: 0.3, friction: 0, label: 'wall' }
    );
    Matter.World.add(this.world, endCap);
    this.wallBodies.push(endCap);

    // Obstacles
    this.levelData.obstacles.forEach(obs => {
      if (obs.type === 'rock') {
        const rock = Matter.Bodies.circle(obs.x, obs.y, obs.radius, {
          isStatic: true,
          restitution: 0.3,
          friction: 0.0,
          label: 'rock'
        });
        Matter.World.add(this.world, rock);
        this.rockBodies.push(rock);
      } else if (obs.type === 'spike_roller' || obs.type === 'spike_strip') {
        const spike = Matter.Bodies.rectangle(obs.x, obs.y, obs.width, obs.height, {
          isStatic: true,
          angle: obs.angle || 0,
          label: 'spike'
        });
        Matter.World.add(this.world, spike);
        this.spikeBodies.push(spike);
      } else if (obs.type === 'spike_slab') {
        const slab = Matter.Bodies.rectangle(obs.x, obs.y, obs.width, obs.height, {
          isStatic: true,
          angle: obs.angle || 0,
          label: 'spike'
        });
        Matter.World.add(this.world, slab);
        this.spikeBodies.push(slab);
      }
    });
  }

  initDynamicObstacles() {
    this.levelData.obstacles.forEach(obs => {
      if (obs.type === 'windmill') {
        const armBodies = [];
        for (let a = 0; a < obs.armCount; a++) {
          const arm = Matter.Bodies.rectangle(obs.x, obs.y, obs.armLength * 2, 16, {
            isStatic: true,
            label: 'spike'
          });
          armBodies.push(arm);
          Matter.World.add(this.world, arm);
        }
        this.dynamicObstacles.push({
          type: 'windmill',
          data: obs,
          bodies: armBodies,
          angle: 0
        });
      } else if (obs.type === 'roller') {
        const roller = Matter.Bodies.rectangle(obs.x, obs.y, obs.width, obs.height, {
          isStatic: true,
          label: 'spike'
        });
        Matter.World.add(this.world, roller);
        this.dynamicObstacles.push({
          type: 'roller',
          data: obs,
          body: roller,
          initialX: obs.x,
          time: 0
        });
      }
    });
  }

  getTrackTangent(x, y) {
    const pts = this.levelData.waypoints;
    let bestDist = Infinity;
    let segIdx = 0;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const dist = Math.hypot(x - midX, y - midY);
      if (dist < bestDist) {
        bestDist = dist;
        segIdx = i;
      }
    }

    const p1 = pts[segIdx];
    const p2 = pts[segIdx + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      tx: dx / len,
      ty: dy / len,
      angle: Math.atan2(dy, dx)
    };
  }

  addPlayer(socket, token, playerName) {
    if (this.playerTokens.has(token)) {
      const slotIndex = this.playerTokens.get(token);
      const existing = this.players[slotIndex];
      existing.socketId = socket.id;
      existing.connected = true;

      if (this.disconnectTimers.has(slotIndex)) {
        clearTimeout(this.disconnectTimers.get(slotIndex));
        this.disconnectTimers.delete(slotIndex);
      }

      if (this.state === 'paused' && this.allPlayersConnected()) {
        this.resumeGame();
      }

      return { slot: slotIndex, hippo: existing, isReconnect: true };
    }

    if (this.players.length >= this.targetPlayerCount) {
      return { error: `Room ${this.code} is full (${this.targetPlayerCount}/${this.targetPlayerCount} players).` };
    }

    const slotIndex = this.players.length;
    // Default angles around perimeter:
    // 0: Back (angle = PI, thrusts forward)
    // 1: Front (angle = 0, thrusts backward)
    // 2: Left (angle = -PI/2, thrusts right)
    // 3: Right (angle = PI/2, thrusts left)
    const angles = [Math.PI, 0, -Math.PI / 2, Math.PI / 2];
    const defaultAngle = angles[slotIndex % angles.length];

    const hippo = {
      slot: slotIndex,
      token: token,
      socketId: socket.id,
      name: playerName || `Hippo ${slotIndex + 1}`,
      angle: defaultAngle,
      targetAngle: defaultAngle,
      isFarting: false,
      connected: true,
      color: HIPPO_COLORS[slotIndex % HIPPO_COLORS.length]
    };

    this.players.push(hippo);
    this.playerTokens.set(token, slotIndex);

    if (this.players.length === this.targetPlayerCount && this.state === 'lobby') {
      this.startGame();
    }

    return { slot: slotIndex, hippo: hippo, isReconnect: false };
  }

  allPlayersConnected() {
    return this.players.every(p => p.connected);
  }

  handleDisconnect(socketId) {
    const player = this.players.find(p => p.socketId === socketId);
    if (!player) return;

    player.connected = false;
    player.isFarting = false;

    if (this.state === 'playing') {
      this.pauseGame(`Player ${player.name} disconnected! Rejoin within 30s.`);

      const timer = setTimeout(() => {
        this.disconnectTimers.delete(player.slot);
        io.to(this.code).emit('room_abandoned', {
          reason: `Player ${player.name} did not reconnect within 30 seconds.`
        });
        this.destroy();
      }, 30000);

      this.disconnectTimers.set(player.slot, timer);
    }
  }

  startGame() {
    // Clear any previous interval to prevent duplicate loop bugs
    clearInterval(this.physicsInterval);
    clearInterval(this.broadcastInterval);

    this.state = 'playing';
    this.startTime = Date.now();
    this.totalPausedDuration = 0;
    this.isRespawning = false;
    this.respawnAtCheckpoint(0);

    // 60 Hz physics loop
    this.physicsInterval = setInterval(() => this.physicsTick(), 1000 / 60);

    // 25 Hz snapshot broadcast loop
    this.broadcastInterval = setInterval(() => this.broadcastSnapshot(), 1000 / 25);

    io.to(this.code).emit('game_started', {
      level: this.levelData,
      players: this.players.map(p => ({
        slot: p.slot,
        name: p.name,
        color: p.color
      }))
    });
  }

  pauseGame(reason) {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.pauseReason = reason;
    this.pauseStartTime = Date.now();

    io.to(this.code).emit('game_paused', {
      reason: reason,
      reconnectWindow: 30
    });
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.totalPausedDuration += Date.now() - this.pauseStartTime;
    this.pauseReason = '';

    io.to(this.code).emit('game_resumed');
  }

  getElapsedTime() {
    if (this.startTime === 0) return 0;
    const current = this.state === 'paused' ? this.pauseStartTime : Date.now();
    return Math.max(0, current - this.startTime - this.totalPausedDuration);
  }

  handlePlayerInput(slotIndex, input) {
    if (this.state !== 'playing' || !this.players[slotIndex]) return;
    const hippo = this.players[slotIndex];

    if (typeof input.targetAngle === 'number' && !isNaN(input.targetAngle)) {
      hippo.targetAngle = input.targetAngle;
    }
    if (typeof input.isFarting === 'boolean') {
      hippo.isFarting = input.isFarting;
    }
  }

  /**
   * 60 Hz Fixed Physics Step with 2 Substeps
   */
  physicsTick() {
    if (this.state !== 'playing') return;

    const dt = 1 / 60; // seconds

    // 1. Update Hippo positions along rim
    this.updateHippoPositions(dt);

    if (this.isRespawning) {
      // Raft is exploded / respawning
      Matter.Body.setVelocity(this.raft, { x: 0, y: 0 });
      return;
    }

    // 2. Align raft rotation with track heading
    const track = this.getTrackTangent(this.raft.position.x, this.raft.position.y);
    Matter.Body.setAngle(this.raft, track.angle);
    Matter.Body.setAngularVelocity(this.raft, 0);

    // 3. Compute Vector Sum of Fart Forces
    // Each farting player produces fixed thrust F0 = 40 px/s^2 * mass
    // Inward towards center (opposite to butt)
    const thrustAcc = 40.0; // px/s^2 per player
    let netAccX = 0;
    let netAccY = 0;

    for (const h of this.players) {
      if (h.isFarting && h.connected) {
        this.totalFarts++;
        // World butt angle = track.angle + h.angle
        const worldButtAngle = track.angle + h.angle;
        // Thrust is opposite to butt:
        netAccX += -Math.cos(worldButtAngle) * thrustAcc;
        netAccY += -Math.sin(worldButtAngle) * thrustAcc;
      }
    }

    // 4. Update Dynamic Obstacles
    this.updateDynamicObstacles();

    // 5. Physics Substeps (2 substeps per tick for anti-tunneling)
    const substeps = 2;
    const subDt = dt / substeps;
    const linearDamping = 1.0; // s^-1 (tau = 1s, steady state 1 farter = 40 px/s, 4 = 160 px/s)

    for (let s = 0; s < substeps; s++) {
      let vx = this.raft.velocity.x;
      let vy = this.raft.velocity.y;

      // Linear water drag
      vx = vx * (1 - linearDamping * subDt) + netAccX * subDt;
      vy = vy * (1 - linearDamping * subDt) + netAccY * subDt;

      // Max speed cap (220 px/s)
      const speed = Math.hypot(vx, vy);
      const maxSpeed = 220;
      if (speed > maxSpeed) {
        vx = (vx / speed) * maxSpeed;
        vy = (vy / speed) * maxSpeed;
      }

      Matter.Body.setVelocity(this.raft, { x: vx, y: vy });

      // Step physics engine
      Matter.Engine.update(this.engine, subDt * 1000);

      // Lock rotation strictly to track angle
      Matter.Body.setAngle(this.raft, track.angle);
      Matter.Body.setAngularVelocity(this.raft, 0);
    }

    // 6. Checkpoint & Boost Pad Triggers
    this.checkTriggers();
  }

  updateHippoPositions(dtSeconds) {
    const minSeparation = 0.52; // ~30 degrees separation
    const moveSpeed = 4.0; // rad/s

    for (const h of this.players) {
      let diff = h.targetAngle - h.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      h.angle += Math.sign(diff) * Math.min(Math.abs(diff), moveSpeed * dtSeconds);
      h.angle = Math.atan2(Math.sin(h.angle), Math.cos(h.angle));
    }

    if (this.players.length > 1) {
      const sorted = [...this.players].sort((a, b) => a.angle - b.angle);
      const count = sorted.length;

      for (let i = 0; i < count; i++) {
        const curr = sorted[i];
        const next = sorted[(i + 1) % count];

        let diff = next.angle - curr.angle;
        if (i === count - 1) diff += Math.PI * 2;

        if (diff < minSeparation) {
          const overlap = minSeparation - diff;
          curr.angle -= overlap / 2;
          next.angle += overlap / 2;
        }
      }
    }
  }

  updateDynamicObstacles() {
    this.dynamicObstacles.forEach(obs => {
      if (obs.type === 'windmill') {
        obs.angle += obs.data.rotSpeed;
        obs.bodies.forEach((arm, idx) => {
          const armAngle = obs.angle + (idx * Math.PI) / obs.data.armCount;
          Matter.Body.setAngle(arm, armAngle);
        });
      } else if (obs.type === 'roller') {
        obs.time += obs.data.swingSpeed;
        const offset = Math.sin(obs.time) * obs.data.swingRange;
        Matter.Body.setPosition(obs.body, {
          x: obs.initialX + offset,
          y: obs.data.y
        });
      }
    });
  }

  checkTriggers() {
    const raftPos = this.raft.position;
    const now = Date.now();

    // Check Boost Chevrons
    this.levelData.obstacles.forEach(obs => {
      if (obs.type === 'boost') {
        const dist = Math.hypot(raftPos.x - obs.x, raftPos.y - obs.y);
        if (dist < obs.radius + RAFT_RADIUS) {
          // Check cooldown (1.5s)
          if (!obs._lastTrigger || now - obs._lastTrigger > 1500) {
            obs._lastTrigger = now;
            const track = this.getTrackTangent(obs.x, obs.y);
            const currentVel = this.raft.velocity;
            const currentSpeed = Math.hypot(currentVel.x, currentVel.y);
            const boostSpeed = Math.max(currentSpeed + obs.power * 4, 120);

            Matter.Body.setVelocity(this.raft, {
              x: track.tx * boostSpeed,
              y: track.ty * boostSpeed
            });

            io.to(this.code).emit('boost_activated', { x: obs.x, y: obs.y });
          }
        }
      }
    });

    // Check Checkpoints
    const cps = this.levelData.checkpoints;
    for (let i = 0; i < cps.length; i++) {
      const cp = cps[i];
      const dist = Math.hypot(raftPos.x - cp.x, raftPos.y - cp.y);

      if (dist < cp.width / 2 + RAFT_RADIUS && i > this.currentCheckpoint) {
        this.currentCheckpoint = i;

        if (i === cps.length - 1) {
          this.triggerVictory();
        } else {
          io.to(this.code).emit('checkpoint_reached', {
            checkpointId: i,
            label: cp.label
          });
        }
        break;
      }
    }
  }

  handleRaftPop(reason) {
    if (this.isRespawning) return;
    this.isRespawning = true;
    this.totalDeaths++;

    io.to(this.code).emit('raft_popped', {
      reason: reason,
      x: this.raft.position.x,
      y: this.raft.position.y
    });

    // 2.0s delay for explosion & drowning animations
    setTimeout(() => {
      this.respawnAtCheckpoint(this.currentCheckpoint);
      this.isRespawning = false;
    }, 2000);
  }

  respawnAtCheckpoint(cpIndex) {
    const cp = this.levelData.checkpoints[cpIndex] || this.levelData.checkpoints[0];
    const track = this.getTrackTangent(cp.x, cp.y);
    Matter.Body.setPosition(this.raft, { x: cp.x, y: cp.y + 40 });
    Matter.Body.setVelocity(this.raft, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.raft, 0);
    Matter.Body.setAngle(this.raft, track.angle);

    io.to(this.code).emit('raft_respawned', {
      checkpointId: cpIndex,
      x: cp.x,
      y: cp.y + 40
    });
  }

  triggerVictory() {
    this.state = 'victory';
    const finalTime = this.getElapsedTime();

    io.to(this.code).emit('game_victory', {
      finalTime: finalTime,
      totalFarts: this.totalFarts,
      totalDeaths: this.totalDeaths
    });
  }

  restartLevel(levelId = this.levelId) {
    clearInterval(this.physicsInterval);
    clearInterval(this.broadcastInterval);

    this.levelId = levelId;
    this.levelData = LEVELS.find(l => l.id === levelId) || LEVELS[0];
    this.currentCheckpoint = 0;
    this.totalFarts = 0;
    this.totalDeaths = 0;

    Matter.World.clear(this.world, false);
    this.initPhysics();
    this.startGame();
  }

  broadcastSnapshot() {
    if (this.state !== 'playing' && this.state !== 'paused') return;

    this.seq++;
    const dynamicObstacleStates = this.dynamicObstacles.map(obs => {
      if (obs.type === 'windmill') {
        return { type: 'windmill', id: obs.data.id, angle: obs.angle };
      } else if (obs.type === 'roller') {
        return { type: 'roller', id: obs.data.id, x: obs.body.position.x, y: obs.body.position.y };
      }
      return null;
    }).filter(Boolean);

    const snapshot = {
      seq: this.seq,
      time: Date.now(),
      state: this.state,
      pauseReason: this.pauseReason,
      timer: this.getElapsedTime(),
      checkpoint: this.currentCheckpoint,
      raft: {
        x: this.raft.position.x,
        y: this.raft.position.y,
        angle: this.raft.angle,
        vx: this.raft.velocity.x,
        vy: this.raft.velocity.y,
        vRot: 0,
        isDead: this.isRespawning
      },
      hippos: this.players.map(h => ({
        slot: h.slot,
        name: h.name,
        angle: h.angle,
        isFarting: h.isFarting,
        connected: h.connected,
        color: h.color
      })),
      obstacles: dynamicObstacleStates
    };

    io.to(this.code).emit('snapshot', snapshot);
  }

  destroy() {
    clearInterval(this.physicsInterval);
    clearInterval(this.broadcastInterval);
    this.disconnectTimers.forEach(t => clearTimeout(t));
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
    rooms.delete(this.code);
  }
}

// Socket.IO Event Handlers
io.on('connection', (socket) => {
  let currentRoom = null;
  let playerSlot = null;

  socket.on('client_ping', (clientTime) => {
    socket.emit('server_pong', clientTime);
  });

  socket.on('create_room', ({ playerCount, levelId, playerName, token }, callback) => {
    const code = generateRoomCode();
    const room = new GameRoom(code, socket.id, playerCount, levelId || 1);
    rooms.set(code, room);

    socket.join(code);
    const result = room.addPlayer(socket, token, playerName);

    currentRoom = room;
    playerSlot = result.slot;

    callback({
      success: true,
      code: code,
      slot: result.slot,
      targetCount: room.targetPlayerCount,
      level: room.levelData
    });

    console.log(`[Room ${code}] Created by ${playerName} for ${playerCount} players.`);
  });

  socket.on('join_room', ({ code, playerName, token }, callback) => {
    const upperCode = (code || '').toUpperCase().trim();
    const room = rooms.get(upperCode);

    if (!room) {
      return callback({ error: `Room "${upperCode}" not found. Check the code and try again!` });
    }

    const result = room.addPlayer(socket, token, playerName);
    if (result.error) {
      return callback({ error: result.error });
    }

    socket.join(upperCode);
    currentRoom = room;
    playerSlot = result.slot;

    callback({
      success: true,
      code: upperCode,
      slot: result.slot,
      targetCount: room.targetPlayerCount,
      level: room.levelData,
      isReconnect: result.isReconnect
    });

    io.to(upperCode).emit('player_joined', {
      slot: result.slot,
      playerCount: room.players.length,
      targetCount: room.targetPlayerCount,
      players: room.players.map(p => ({ slot: p.slot, name: p.name, color: p.color }))
    });

    console.log(`[Room ${upperCode}] Player ${playerName} joined (Slot ${result.slot}).`);
  });

  socket.on('player_input', (input) => {
    if (currentRoom && playerSlot !== null) {
      currentRoom.handlePlayerInput(playerSlot, input);
    }
  });

  // SUICIDE command: explodes raft and respawns at checkpoint
  socket.on('player_suicide', () => {
    if (currentRoom && currentRoom.state === 'playing') {
      currentRoom.handleRaftPop("Self-destruct!");
    }
  });

  socket.on('restart_game', ({ levelId }) => {
    if (currentRoom && currentRoom.hostSocketId === socket.id) {
      currentRoom.restartLevel(levelId || currentRoom.levelId);
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      currentRoom.handleDisconnect(socket.id);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`We Fart Together game server listening on port ${PORT}`);
});