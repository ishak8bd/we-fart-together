/**
 * We Fart Together — Authoritative Multiplayer Game Server
 * Stack: Node.js + Express + Socket.IO + Matter.js (Server-only physics)
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const Matter = require('matter-js');
const { LEVELS, RAFT_RADIUS, RAFT_DIAMETER, MIN_GAP_REQUIRED } = require('./shared/levels');

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

// Hippos visual colors for slots 0..3
const HIPPO_COLORS = [
  { name: 'Brown Capy-Hippo', hex: '#8d6e63', belly: '#d7ccc8' },
  { name: 'Teal River-Hippo', hex: '#455a64', belly: '#cfd8dc' },
  { name: 'Golden Mud-Hippo', hex: '#d97706', belly: '#fef3c7' },
  { name: 'Lavender Night-Hippo', hex: '#7c3aed', belly: '#ede9fe' }
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
    this.state = 'lobby'; // 'lobby', 'countdown', 'playing', 'paused', 'victory'
    this.pauseReason = '';
    this.currentCheckpoint = 0;
    this.totalFarts = 0;
    this.totalDeaths = 0;
    this.startTime = 0;
    this.pauseStartTime = 0;
    this.totalPausedDuration = 0;
    this.seq = 0;

    // Physics Engine (Matter.js)
    this.initPhysics();

    // Fixed timestep loop (60 Hz)
    this.physicsInterval = null;
    this.broadcastInterval = null;
  }

  initPhysics() {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 } // Top-down 2D river plane
    });
    this.world = this.engine.world;

    // 1. Create Raft Rigid Body
    const startPos = this.levelData.startPosition;
    this.raft = Matter.Bodies.circle(startPos.x, startPos.y, RAFT_RADIUS, {
      mass: 4.0,
      restitution: 0.5,     // Bouncy, prevents sticking
      friction: 0.02,
      frictionAir: 0.04,    // Fluid resistance
      label: 'raft'
    });
    Matter.Body.setAngle(this.raft, this.levelData.startAngle);
    Matter.World.add(this.world, this.raft);

    // 2. Build River Canal Walls & Spikes from level waypoints
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
    const pts = this.levelData.waypoints;
    const wallThick = 40;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];

      // Segment vector and normal
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const nx = -dy / len;
      const ny = dx / len;

      const halfW1 = p1.width / 2;
      const halfW2 = p2.width / 2;
      const midHalfW = (halfW1 + halfW2) / 2;

      // Left Wall Segment
      const midLeftX = (p1.x + p2.x) / 2 + nx * (midHalfW + wallThick / 2);
      const midLeftY = (p1.y + p2.y) / 2 + ny * (midHalfW + wallThick / 2);
      const leftWall = Matter.Bodies.rectangle(midLeftX, midLeftY, len, wallThick, {
        isStatic: true,
        angle: angle,
        restitution: 0.5,
        friction: 0.04,
        label: 'wall'
      });
      Matter.World.add(this.world, leftWall);
      this.wallBodies.push(leftWall);

      // Right Wall Segment
      const midRightX = (p1.x + p2.x) / 2 - nx * (midHalfW + wallThick / 2);
      const midRightY = (p1.y + p2.y) / 2 - ny * (midHalfW + wallThick / 2);
      const rightWall = Matter.Bodies.rectangle(midRightX, midRightY, len, wallThick, {
        isStatic: true,
        angle: angle,
        restitution: 0.5,
        friction: 0.04,
        label: 'wall'
      });
      Matter.World.add(this.world, rightWall);
      this.wallBodies.push(rightWall);
    }

    // Add Obstacles (Rocks, Spikes)
    this.levelData.obstacles.forEach(obs => {
      if (obs.type === 'rock') {
        const rock = Matter.Bodies.circle(obs.x, obs.y, obs.radius, {
          isStatic: true,
          restitution: 0.6,
          friction: 0.02,
          label: 'rock'
        });
        Matter.World.add(this.world, rock);
        this.rockBodies.push(rock);
      } else if (obs.type === 'spike_strip') {
        const spike = Matter.Bodies.rectangle(obs.x, obs.y, obs.width, obs.height, {
          isStatic: true,
          angle: obs.angle || 0,
          label: 'spike'
        });
        Matter.World.add(this.world, spike);
        this.spikeBodies.push(spike);
      }
    });
  }

  initDynamicObstacles() {
    this.levelData.obstacles.forEach(obs => {
      if (obs.type === 'windmill') {
        // Center pivot with 4 spiked arm bodies
        const armBodies = [];
        for (let a = 0; a < obs.armCount; a++) {
          const arm = Matter.Bodies.rectangle(obs.x, obs.y, obs.armLength * 2, 14, {
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

  /**
   * Add a player to the room
   */
  addPlayer(socket, token, playerName) {
    // Check if player is reconnecting with existing token
    if (this.playerTokens.has(token)) {
      const slotIndex = this.playerTokens.get(token);
      const existing = this.players[slotIndex];
      existing.socketId = socket.id;
      existing.connected = true;

      // Cancel disconnect countdown if active
      if (this.disconnectTimers.has(slotIndex)) {
        clearTimeout(this.disconnectTimers.get(slotIndex));
        this.disconnectTimers.delete(slotIndex);
      }

      // If all connected, unpause
      if (this.state === 'paused' && this.allPlayersConnected()) {
        this.resumeGame();
      }

      return { slot: slotIndex, hippo: existing, isReconnect: true };
    }

    // Check if room is full
    if (this.players.length >= this.targetPlayerCount) {
      return { error: `Room ${this.code} is full (${this.targetPlayerCount}/${this.targetPlayerCount} players).` };
    }

    const slotIndex = this.players.length;
    // Distribute default starting angles evenly along rim
    const defaultAngle = (slotIndex / this.targetPlayerCount) * (Math.PI * 2) - Math.PI / 2;

    const hippo = {
      slot: slotIndex,
      token: token,
      socketId: socket.id,
      name: playerName || `Hippo ${slotIndex + 1}`,
      angle: defaultAngle,
      targetAngle: defaultAngle,
      isFarting: false,
      fartCharge: 0.0,
      connected: true,
      color: HIPPO_COLORS[slotIndex % HIPPO_COLORS.length]
    };

    this.players.push(hippo);
    this.playerTokens.set(token, slotIndex);

    // Auto-start check:
    // Solo (N=1) starts immediately!
    // For N >= 2, starts as soon as room is full!
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

      // 30-second reconnection window
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
    this.state = 'playing';
    this.startTime = Date.now();
    this.totalPausedDuration = 0;
    this.respawnAtCheckpoint(0);

    // Start 60 Hz physics loop
    this.physicsInterval = setInterval(() => this.physicsTick(), 1000 / 60);

    // Start 25 Hz snapshot broadcast loop
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

  /**
   * Update Player Inputs (Move along rim, Fart charge)
   */
  handlePlayerInput(slotIndex, input) {
    if (this.state !== 'playing' || !this.players[slotIndex]) return;
    const hippo = this.players[slotIndex];

    // Angle movement around perimeter
    if (typeof input.targetAngle === 'number') {
      hippo.targetAngle = input.targetAngle;
    } else if (typeof input.deltaAngle === 'number') {
      hippo.targetAngle += input.deltaAngle;
    }

    // Fart button press & charge
    if (typeof input.isFarting === 'boolean') {
      hippo.isFarting = input.isFarting;
    }
    if (typeof input.fartCharge === 'number') {
      hippo.fartCharge = Math.max(0, Math.min(2.5, input.fartCharge));
    }
  }

  /**
   * 60 Hz Matter.js Physics Step
   */
  physicsTick() {
    if (this.state !== 'playing') return;

    const dt = 1000 / 60;

    // 1. Update Hippo positions along rim with non-overlapping circular collision
    this.updateHippoPositions(dt / 1000);

    // 2. Downstream River Current Force
    this.applyRiverCurrent();

    // 3. Apply Fart Impulses & Torques from each farting hippo
    this.applyFartForces();

    // 4. Update Dynamic Obstacles (Windmills, Rollers)
    this.updateDynamicObstacles();

    // 5. Matter.js engine step
    Matter.Engine.update(this.engine, dt);

    // 6. Checkpoint & Boost Pad Triggers
    this.checkTriggers();
  }

  /**
   * Move hippos around the edge without overlapping
   */
  updateHippoPositions(dtSeconds) {
    const minSeparation = 0.52; // ~30 degrees separation
    const moveSpeed = 4.0; // rad/s

    // Move smoothly towards targetAngle
    for (const h of this.players) {
      let diff = h.targetAngle - h.angle;
      // Normalize to [-PI, PI]
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      h.angle += Math.sign(diff) * Math.min(Math.abs(diff), moveSpeed * dtSeconds);
      // Normalize h.angle to [-PI, PI]
      h.angle = Math.atan2(Math.sin(h.angle), Math.cos(h.angle));
    }

    // If multiple players, enforce non-overlapping circular order
    if (this.players.length > 1) {
      // Sort by angle
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

  /**
   * Passive Downstream Water Current
   */
  applyRiverCurrent() {
    const raftPos = this.raft.position;
    const pts = this.levelData.waypoints;

    // Find current waypoint segment
    let bestDist = Infinity;
    let segIdx = 0;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const dist = Math.hypot(raftPos.x - midX, raftPos.y - midY);
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
    const dirX = dx / len;
    const dirY = dy / len;

    // Gentle passive water flow (doesn't rush downstream without farting)
    const currentForce = 0.00035 * this.levelData.currentSpeed;
    Matter.Body.applyForce(this.raft, this.raft.position, {
      x: dirX * currentForce,
      y: dirY * currentForce
    });
  }

  /**
   * Apply Fart Force opposite to hippo butt direction
   */
  applyFartForces() {
    const raftPos = this.raft.position;
    const raftAngle = this.raft.angle;
    const baseFartPower = 0.016; // Powerful, satisfying fart propulsion!

    for (const h of this.players) {
      if (h.isFarting) {
        this.totalFarts++;

        // Charge power multiplier (1.0x to 2.5x)
        const powerMultiplier = 1.0 + (h.fartCharge || 0);

        // Butt faces outside: world angle = raftAngle + h.angle
        const buttAngle = raftAngle + h.angle;

        // Hippo position on rim
        const hippoX = raftPos.x + RAFT_RADIUS * Math.cos(buttAngle);
        const hippoY = raftPos.y + RAFT_RADIUS * Math.sin(buttAngle);

        // Force pushes opposite to butt (inward towards raft):
        const forceX = -Math.cos(buttAngle) * baseFartPower * powerMultiplier;
        const forceY = -Math.sin(buttAngle) * baseFartPower * powerMultiplier;

        // Matter.js applies force at world position, naturally calculating both linear push & torque!
        Matter.Body.applyForce(this.raft, { x: hippoX, y: hippoY }, { x: forceX, y: forceY });
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

    // Check Boost Chevrons
    this.levelData.obstacles.forEach(obs => {
      if (obs.type === 'boost') {
        const dist = Math.hypot(raftPos.x - obs.x, raftPos.y - obs.y);
        if (dist < obs.radius + RAFT_RADIUS) {
          // Launch raft forward along current velocity or downward
          const currentVel = this.raft.velocity;
          const speed = Math.hypot(currentVel.x, currentVel.y) || 1;
          const dirX = currentVel.x / speed;
          const dirY = (currentVel.y / speed) || 1;

          Matter.Body.setVelocity(this.raft, {
            x: dirX * (speed + obs.power * 0.4),
            y: dirY * (speed + obs.power * 0.4)
          });

          io.to(this.code).emit('boost_activated', { x: obs.x, y: obs.y });
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
          // Finish Line reached!
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

    // 0.8s reset delay
    setTimeout(() => {
      this.respawnAtCheckpoint(this.currentCheckpoint);
      this.isRespawning = false;
    }, 800);
  }

  respawnAtCheckpoint(cpIndex) {
    const cp = this.levelData.checkpoints[cpIndex] || this.levelData.checkpoints[0];
    Matter.Body.setPosition(this.raft, { x: cp.x, y: cp.y + 40 });
    Matter.Body.setVelocity(this.raft, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.raft, 0);
    Matter.Body.setAngle(this.raft, Math.PI / 2);
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
    this.levelId = levelId;
    this.levelData = LEVELS.find(l => l.id === levelId) || LEVELS[0];
    this.currentCheckpoint = 0;
    this.totalFarts = 0;
    this.totalDeaths = 0;

    // Rebuild physics world
    Matter.World.clear(this.world, false);
    this.initPhysics();
    this.startGame();
  }

  /**
   * Broadcast Authoritative Snapshot to Clients at ~25 Hz
   */
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
        vRot: this.raft.angularVelocity
      },
      hippos: this.players.map(h => ({
        slot: h.slot,
        name: h.name,
        angle: h.angle,
        isFarting: h.isFarting,
        fartCharge: h.fartCharge,
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

  // Heartbeat ping-pong for latency measurement
  socket.on('client_ping', (clientTime) => {
    socket.emit('server_pong', clientTime);
  });

  // Host Creates Room
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

  // Player Joins Existing Room
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

  // Player Input (Move joystick & Fart button)
  socket.on('player_input', (input) => {
    if (currentRoom && playerSlot !== null) {
      currentRoom.handlePlayerInput(playerSlot, input);
    }
  });

  // Host Restarts Game or Changes Level
  socket.on('restart_game', ({ levelId }) => {
    if (currentRoom && currentRoom.hostSocketId === socket.id) {
      currentRoom.restartLevel(levelId || currentRoom.levelId);
    }
  });

  // Disconnection
  socket.on('disconnect', () => {
    if (currentRoom) {
      currentRoom.handleDisconnect(socket.id);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`We Fart Together game server listening on port ${PORT}`);
});
