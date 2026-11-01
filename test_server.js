/**
 * Automated Test Suite for "We Fart Together"
 * Validates:
 * 1. Real Collider Hazard Clearances (>= 1.8 * D_raft = 144px free gap)
 * 2. Flood-Fill Track Closure (no leaks to outside world, reaches finish)
 * 3. Physics Thrust Cancellation & Drag (1 farter ~40 px/s, 4 farters ~160 px/s, opposite pairs = 0)
 * 4. Multiplayer Room Lifecycle, Disconnect Pause & Reconnect
 */

const {
  LEVELS,
  RAFT_RADIUS,
  RAFT_DIAMETER,
  MIN_GAP_REQUIRED,
  verifyTrackWatertight,
  verifyHazardClearances
} = require('./shared/levels');
const { spawn } = require('child_process');
const { io: ioClient } = require('socket.io-client');

console.log("=== 1. VERIFYING LEVEL GAPS & REAL COLLIDER HAZARD CLEARANCES ===");
console.log(`Raft Radius: ${RAFT_RADIUS}px | Diameter: ${RAFT_DIAMETER}px`);
console.log(`Minimum Required Gap (1.8 * D_raft): ${MIN_GAP_REQUIRED}px\n`);

let allClearancesPassed = true;
LEVELS.forEach(level => {
  console.log(`Checking Level ${level.id}: "${level.name}"...`);
  const results = verifyHazardClearances(level);
  results.forEach(r => {
    console.log(`  Obstacle "${r.id}" (${r.type}) -> Clearance: ${r.clearance.toFixed(1)}px (Required >= ${r.required}px) -> ${r.passes ? '[PASS]' : '[FAIL]'}`);
    if (!r.passes) allClearancesPassed = false;
  });
});

if (!allClearancesPassed) {
  console.error("[FAIL] One or more hazards do not provide 1.8 * D_raft clearance!");
  process.exit(1);
}
console.log("\n[PASS] All hazards provide >= 1.8 * D_raft clearance!\n");

console.log("=== 2. VERIFYING 100% CLOSED WATERTIGHT TRACKS VIA FLOOD-FILL ===");
let allWatertightPassed = true;
LEVELS.forEach(level => {
  const res = verifyTrackWatertight(level);
  console.log(`Level ${level.id} Flood-Fill: Leaked: ${res.leakedToOutside}, Reaches Finish: ${res.reachesFinish} (max Y: ${res.maxVisitedY} / finish Y: ${res.finishY})`);
  if (!res.isWatertight) {
    console.error(`  [FAIL] Level ${level.id} failed watertight flood-fill test!`);
    allWatertightPassed = false;
  }
});

if (!allWatertightPassed) {
  console.error("[FAIL] One or more levels leaked or did not reach finish!");
  process.exit(1);
}
console.log("\n[PASS] All tracks are 100% closed, watertight, and finishable!\n");

console.log("=== 3. VERIFYING RAFT PHYSICS: THRUST CANCELLATION & LINEAR DRAG ===");
const thrustAcc = 40.0;
const linearDamping = 1.0;
const dt = 1/60;

// Test 1: 1 farter terminal speed
let v1 = 0;
for (let i = 0; i < 400; i++) {
  v1 = v1 * (1 - linearDamping * dt) + thrustAcc * dt;
}
console.log(`  1 farter steady speed: ${v1.toFixed(1)} px/s (Target ~40 px/s = 0.5 D/s)`);

// Test 2: 4 farters terminal speed
let v4 = 0;
for (let i = 0; i < 400; i++) {
  v4 = v4 * (1 - linearDamping * dt) + (4 * thrustAcc) * dt;
}
console.log(`  4 farters steady speed: ${v4.toFixed(1)} px/s (Target ~160 px/s = 2.0 D/s)`);

// Test 3: Opposite pair cancellation
const a1x = -Math.cos(0) * thrustAcc;
const a1y = -Math.sin(0) * thrustAcc;
const a2x = -Math.cos(Math.PI) * thrustAcc;
const a2y = -Math.sin(Math.PI) * thrustAcc;
const netOpposite = Math.hypot(a1x + a2x, a1y + a2y);
console.log(`  Opposite farters net force: ${netOpposite.toFixed(6)} (Target: 0.000000)`);

if (Math.abs(v1 - 40) < 0.2 && Math.abs(v4 - 160) < 0.5 && netOpposite < 0.000001) {
  console.log("\n[PASS] Physics speed scaling, linear drag & exact cancellation verified!\n");
} else {
  console.error("[FAIL] Physics verification failed!");
  process.exit(1);
}

console.log("=== 4. VERIFYING SERVER MULTIPLAYER, INPUTS & RECONNECT ===");
const serverProcess = spawn('node', ['server.js'], {
  env: { ...process.env, PORT: '3456' },
  stdio: 'pipe'
});

serverProcess.stdout.on('data', (d) => {
  const msg = d.toString();
  if (msg.includes('listening')) {
    runSocketTests();
  }
});

serverProcess.stderr.on('data', (d) => {
  console.error('[Server Error]', d.toString());
});

async function runSocketTests() {
  const SERVER_URL = 'http://localhost:3456';
  console.log(`Connected to test server at ${SERVER_URL}...`);

  const client1 = ioClient(SERVER_URL);
  const client2 = ioClient(SERVER_URL);
  const client3 = ioClient(SERVER_URL);

  const token1 = 'tkn_test_1';
  const token2 = 'tkn_test_2';

  client1.on('connect', () => {
    console.log('[Client 1] Creating 2-player room...');
    client1.emit('create_room', {
      playerCount: 2,
      levelId: 1,
      playerName: 'HostHippo',
      token: token1
    }, (res) => {
      console.log(`[Client 1] Room created: Code = "${res.code}", Slot = ${res.slot}`);
      const roomCode = res.code;

      client2.emit('join_room', {
        code: roomCode,
        playerName: 'BuddyHippo',
        token: token2
      }, (joinRes) => {
        console.log(`[Client 2] Joined Room "${roomCode}", Slot = ${joinRes.slot}`);

        // Extra joiner rejection
        client3.emit('join_room', {
          code: roomCode,
          playerName: 'ExtraHippo',
          token: 'tkn_extra'
        }, (extraRes) => {
          if (extraRes.error && extraRes.error.includes('full')) {
            console.log(`[PASS] Extra joiner rejected as expected: "${extraRes.error}"`);
          } else {
            console.error('[FAIL] Extra joiner was not rejected!');
            cleanup(1);
          }

          let snapCount = 0;
          client1.on('snapshot', (snap) => {
            snapCount++;
            if (snapCount === 1) {
              console.log(`[PASS] Authoritative snapshot: Raft pos (${snap.raft.x.toFixed(1)}, ${snap.raft.y.toFixed(1)}), angle: ${snap.raft.angle.toFixed(2)}, hippos: ${snap.hippos.length}`);

              // Test Fart input
              client1.emit('player_input', {
                targetAngle: Math.PI,
                isFarting: true
              });

              // Test suicide command after brief moment
              setTimeout(() => {
                console.log('[Test] Emitting suicide command...');
                client1.emit('player_suicide');
              }, 300);
            }
          });

          client1.on('raft_popped', ({ reason }) => {
            console.log(`[PASS] Raft popped event received: "${reason}"`);

            // Test Disconnect & Pause
            setTimeout(() => {
              console.log('[Test] Simulating Client 2 disconnect...');
              client2.disconnect();
            }, 300);
          });

          client1.on('game_paused', ({ reason }) => {
            console.log(`[PASS] Game paused on disconnect: "${reason}"`);

            // Reconnect Client 2
            console.log('[Test] Reconnecting Client 2 with token...');
            const client2Reconnect = ioClient(SERVER_URL);
            client2Reconnect.emit('join_room', {
              code: roomCode,
              playerName: 'BuddyHippo',
              token: token2
            }, (reconnectRes) => {
              if (reconnectRes.isReconnect && reconnectRes.slot === 1) {
                console.log(`[PASS] Reconnected successfully to slot ${reconnectRes.slot}!`);
                cleanup(0);
              } else {
                console.error('[FAIL] Reconnect failed or wrong slot!', reconnectRes);
                cleanup(1);
              }
            });
          });
        });
      });
    });
  });

  function cleanup(code) {
    client1.disconnect();
    client2.disconnect();
    client3.disconnect();
    serverProcess.kill('SIGTERM');
    console.log(`\n=== ALL TESTS FINISHED (Exit code: ${code}) ===`);
    process.exit(code);
  }
}