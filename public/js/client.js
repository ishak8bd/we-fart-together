/**
 * We Fart Together — Mobile Client & Interpolation Engine
 * Handles Socket.IO networking, snapshot interpolation, touch joystick, and FART button.
 */

class ClientGameApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer3D(this.canvas);

    // Player Identification
    this.playerToken = localStorage.getItem('wft_player_token') || this.generateToken();
    localStorage.setItem('wft_player_token', this.playerToken);
    this.playerName = localStorage.getItem('wft_player_name') || `Hippo_${Math.floor(Math.random() * 900 + 100)}`;

    // Room & Network State
    this.roomCode = null;
    this.mySlot = null;
    this.levelData = null;
    this.socket = null;
    this.ping = 0;

    // Snapshot Interpolation Buffer (50ms render delay)
    this.snapshotBuffer = [];
    this.interpolationDelay = 65; // ms

    // Local Controls
    this.hippoTargetAngle = Math.PI; // Default back of raft (thrusts forward)
    this.isFarting = false;

    // Wake Lock
    this.wakeLock = null;

    this.initSocket();
    this.initInput();
    this.initUI();
    this.startRenderLoop();
  }

  generateToken() {
    return 'tkn_' + Math.random().toString(36).substring(2, 12);
  }

  initSocket() {
    this.socket = io({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    // Ping / Latency Loop
    setInterval(() => {
      if (this.socket.connected) {
        this.socket.emit('client_ping', Date.now());
      }
    }, 2000);

    this.socket.on('server_pong', (clientTime) => {
      this.ping = Math.max(1, Math.round((Date.now() - clientTime) / 2));
      document.getElementById('hud-ping').textContent = `${this.ping}ms`;
    });

    // Snapshot from authoritative server (~25 Hz)
    this.socket.on('snapshot', (snapshot) => {
      this.snapshotBuffer.push(snapshot);
      if (this.snapshotBuffer.length > 30) {
        this.snapshotBuffer.shift();
      }

      // Check for particle events from active farting hippos
      if (snapshot.raft && snapshot.hippos && !snapshot.raft.isDead) {
        snapshot.hippos.forEach(h => {
          if (h.isFarting && h.connected) {
            const buttAngle = snapshot.raft.angle + h.angle;
            const hx = snapshot.raft.x + 36 * Math.cos(buttAngle);
            const hy = snapshot.raft.y + 36 * Math.sin(buttAngle);
            this.renderer.addFartParticle(hx, hy, buttAngle);
          }
        });
      }

      // Update HUD Timer (format mm:ss.ms)
      if (snapshot.timer !== undefined) {
        document.getElementById('hud-timer').textContent = this.formatTime(snapshot.timer);
      }
    });

    this.socket.on('game_started', ({ level, players }) => {
      this.levelData = level;
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('waiting-screen').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('controls-layer').classList.remove('hidden');
      this.requestWakeLock();
    });

    this.socket.on('player_joined', ({ playerCount, targetCount, players }) => {
      document.getElementById('waiting-status').textContent = `Waiting for hippos... ${playerCount} / ${targetCount} joined`;
      this.renderWaitingSlots(players, targetCount);
    });

    this.socket.on('game_paused', ({ reason, reconnectWindow }) => {
      document.getElementById('pause-overlay').classList.remove('hidden');
      document.getElementById('pause-reason').textContent = reason;
    });

    this.socket.on('game_resumed', () => {
      document.getElementById('pause-overlay').classList.add('hidden');
    });

    this.socket.on('raft_popped', ({ reason, x, y }) => {
      this.renderer.addExplosion(x, y);
      if (window.soundEngine) window.soundEngine.playExplosion();
      if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
    });

    this.socket.on('raft_respawned', ({ checkpointId }) => {
      this.showToast(`RESPAWNED AT CHECKPOINT ${checkpointId}`);
    });

    this.socket.on('boost_activated', ({ x, y }) => {
      if (window.soundEngine) window.soundEngine.playBoost();
      if (navigator.vibrate) navigator.vibrate(40);
    });

    this.socket.on('checkpoint_reached', ({ checkpointId, label }) => {
      if (window.soundEngine) window.soundEngine.playCheckpoint();
      this.showToast(label);
    });

    this.socket.on('game_victory', ({ finalTime, totalFarts, totalDeaths }) => {
      if (window.soundEngine) window.soundEngine.playVictory();
      document.getElementById('victory-modal').classList.remove('hidden');
      document.getElementById('final-time').textContent = this.formatTime(finalTime);
      document.getElementById('final-farts').textContent = totalFarts;
      document.getElementById('final-deaths').textContent = totalDeaths;
    });

    this.socket.on('room_abandoned', ({ reason }) => {
      alert(`Game ended: ${reason}`);
      window.location.reload();
    });

    // Check URL parameters for direct invite link (?room=XXXX)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      document.getElementById('join-code-input').value = roomParam.toUpperCase();
    }
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      }
    } catch (err) {
      console.warn("Wake Lock error:", err);
    }
  }

  /**
   * Mobile Touch Controls & Suicide Button
   */
  initInput() {
    const joystickArea = document.getElementById('touch-joystick');
    const joystickNub = document.getElementById('joystick-nub');
    const fartBtn = document.getElementById('btn-fart');
    const suicideBtn = document.getElementById('btn-suicide');

    // 1. Left Side Touch Joystick for moving around the circular edge
    let isTouchingJoystick = false;
    let joyCenter = { x: 0, y: 0 };

    const onJoyStart = (e) => {
      e.preventDefault();
      if (window.soundEngine) window.soundEngine.ensureContext();
      isTouchingJoystick = true;
      const rect = joystickArea.getBoundingClientRect();
      joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      onJoyMove(e);
    };

    const onJoyMove = (e) => {
      if (!isTouchingJoystick) return;
      const touch = e.touches ? e.touches[0] : e;
      const dx = touch.clientX - joyCenter.x;
      const dy = touch.clientY - joyCenter.y;
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(36, Math.hypot(dx, dy));

      joystickNub.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;

      // Target angle on the raft perimeter
      this.hippoTargetAngle = angle;
      this.sendInput();
    };

    const onJoyEnd = (e) => {
      isTouchingJoystick = false;
      joystickNub.style.transform = 'translate(0px, 0px)';
    };

    joystickArea.addEventListener('pointerdown', onJoyStart);
    window.addEventListener('pointermove', onJoyMove);
    window.addEventListener('pointerup', onJoyEnd);
    window.addEventListener('pointercancel', onJoyEnd);

    // 2. Right Side FART Button (Simple Hold to Thrust, no charge multiplier)
    const onFartDown = (e) => {
      e.preventDefault();
      if (window.soundEngine) window.soundEngine.ensureContext();
      this.isFarting = true;
      fartBtn.classList.add('active');

      if (window.soundEngine) {
        window.soundEngine.playFart(1.0, 1.0);
      }
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      this.sendInput();
    };

    const onFartUp = (e) => {
      e.preventDefault();
      if (!this.isFarting) return;
      this.isFarting = false;
      fartBtn.classList.remove('active');
      this.sendInput();
    };

    fartBtn.addEventListener('pointerdown', onFartDown);
    fartBtn.addEventListener('pointerup', onFartUp);
    fartBtn.addEventListener('pointerleave', onFartUp);
    fartBtn.addEventListener('pointercancel', onFartUp);

    // 3. Suicide Button
    if (suicideBtn) {
      suicideBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.socket && this.socket.connected) {
          this.socket.emit('player_suicide');
        }
      });
    }

    // 4. Desktop Keyboard Controls
    const keys = {};
    window.addEventListener('keydown', (e) => {
      if (keys[e.code]) return;
      keys[e.code] = true;
      if (window.soundEngine) window.soundEngine.ensureContext();

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        this.hippoTargetAngle -= 0.35;
        this.sendInput();
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        this.hippoTargetAngle += 0.35;
        this.sendInput();
      }
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        onFartDown(e);
      }
      if (e.code === 'KeyK') {
        if (this.socket && this.socket.connected) {
          this.socket.emit('player_suicide');
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        onFartUp(e);
      }
    });
  }

  sendInput() {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('player_input', {
      targetAngle: this.hippoTargetAngle,
      isFarting: this.isFarting
    });
  }

  initUI() {
    let selectedPlayerCount = 1;
    const countBtns = document.querySelectorAll('.count-btn');
    countBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        countBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPlayerCount = parseInt(btn.getAttribute('data-count'));
      });
    });

    document.getElementById('btn-create-room').addEventListener('click', () => {
      const name = document.getElementById('player-name-input').value.trim() || this.playerName;
      const levelId = parseInt(document.getElementById('level-select').value) || 1;
      localStorage.setItem('wft_player_name', name);
      this.playerName = name;

      this.socket.emit('create_room', {
        playerCount: selectedPlayerCount,
        levelId: levelId,
        playerName: name,
        token: this.playerToken
      }, (res) => {
        if (res.success) {
          this.roomCode = res.code;
          this.mySlot = res.slot;
          this.levelData = res.level;
          document.getElementById('hud-room-code').textContent = this.roomCode;

          if (res.targetCount === 1) {
            // Solo starts immediately
          } else {
            document.getElementById('lobby-screen').classList.add('hidden');
            document.getElementById('waiting-screen').classList.remove('hidden');
            document.getElementById('waiting-code-display').textContent = this.roomCode;
            document.getElementById('waiting-status').textContent = `Waiting for hippos... 1 / ${res.targetCount} joined`;
          }
        }
      });
    });

    document.getElementById('btn-join-room').addEventListener('click', () => {
      const code = document.getElementById('join-code-input').value.trim().toUpperCase();
      const name = document.getElementById('player-name-input').value.trim() || this.playerName;
      localStorage.setItem('wft_player_name', name);
      this.playerName = name;

      if (!code || code.length !== 4) {
        return alert("Please enter a valid 4-character room code!");
      }

      this.socket.emit('join_room', {
        code: code,
        playerName: name,
        token: this.playerToken
      }, (res) => {
        if (res.error) {
          return alert(res.error);
        }
        this.roomCode = res.code;
        this.mySlot = res.slot;
        this.levelData = res.level;
        document.getElementById('hud-room-code').textContent = this.roomCode;

        if (res.isReconnect) {
          document.getElementById('lobby-screen').classList.add('hidden');
          document.getElementById('hud').classList.remove('hidden');
          document.getElementById('controls-layer').classList.remove('hidden');
        } else {
          document.getElementById('lobby-screen').classList.add('hidden');
          document.getElementById('waiting-screen').classList.remove('hidden');
          document.getElementById('waiting-code-display').textContent = this.roomCode;
        }
      });
    });

    document.getElementById('btn-copy-link').addEventListener('click', () => {
      const link = `${window.location.origin}${window.location.pathname}?room=${this.roomCode}`;
      navigator.clipboard.writeText(link).then(() => {
        this.showToast("Room link copied to clipboard! 📋");
      });
    });

    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
      const isMuted = window.soundEngine.toggleMute();
      document.getElementById('sound-icon').textContent = isMuted ? '🔇' : '🔊';
    });

    document.getElementById('btn-restart-game').addEventListener('click', () => {
      document.getElementById('victory-modal').classList.add('hidden');
      const nextLevel = (this.levelData.id % 3) + 1;
      this.socket.emit('restart_game', { levelId: nextLevel });
    });
  }

  renderWaitingSlots(players, targetCount) {
    const list = document.getElementById('waiting-players-list');
    list.innerHTML = '';
    for (let i = 0; i < targetCount; i++) {
      const p = players.find(x => x.slot === i);
      const item = document.createElement('div');
      item.className = `waiting-slot ${p ? 'filled' : 'empty'}`;
      item.innerHTML = p ? `🦛 <strong>${p.name}</strong>` : `⏳ Waiting...`;
      list.appendChild(item);
    }
  }

  showToast(msg) {
    const toast = document.getElementById('toast-banner');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2200);
  }

  formatTime(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  }

  startRenderLoop() {
    let lastTime = performance.now();

    const loop = (currentTime) => {
      requestAnimationFrame(loop);
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const interpolated = this.getInterpolatedState(Date.now() - this.interpolationDelay);

      if (interpolated) {
        this.renderer.render(
          this.levelData,
          interpolated.raft,
          interpolated.hippos,
          interpolated.obstacles,
          interpolated.checkpoint,
          dt
        );
      }
    };

    requestAnimationFrame(loop);
  }

  getInterpolatedState(renderTime) {
    const buffer = this.snapshotBuffer;
    if (buffer.length === 0) return null;

    if (renderTime <= buffer[0].time) {
      return buffer[0];
    }
    if (renderTime >= buffer[buffer.length - 1].time) {
      return buffer[buffer.length - 1];
    }

    for (let i = 0; i < buffer.length - 1; i++) {
      const s0 = buffer[i];
      const s1 = buffer[i + 1];

      if (renderTime >= s0.time && renderTime <= s1.time) {
        const factor = (renderTime - s0.time) / (s1.time - s0.time);

        const raft = {
          x: s0.raft.x + (s1.raft.x - s0.raft.x) * factor,
          y: s0.raft.y + (s1.raft.y - s0.raft.y) * factor,
          angle: this.lerpAngle(s0.raft.angle, s1.raft.angle, factor),
          vx: (s0.raft.vx || 0) + ((s1.raft.vx || 0) - (s0.raft.vx || 0)) * factor,
          vy: (s0.raft.vy || 0) + ((s1.raft.vy || 0) - (s0.raft.vy || 0)) * factor,
          vRot: 0,
          isDead: s1.raft.isDead
        };

        const hippos = s1.hippos.map((h1) => {
          const h0 = s0.hippos.find(h => h.slot === h1.slot) || h1;
          return {
            slot: h1.slot,
            name: h1.name,
            angle: this.lerpAngle(h0.angle, h1.angle, factor),
            isFarting: h1.isFarting,
            connected: h1.connected,
            color: h1.color
          };
        });

        return {
          raft: raft,
          hippos: hippos,
          obstacles: s1.obstacles,
          checkpoint: s1.checkpoint
        };
      }
    }

    return buffer[buffer.length - 1];
  }

  lerpAngle(a, b, t) {
    const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + diff * t;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.clientApp = new ClientGameApp();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});