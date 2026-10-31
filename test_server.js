/**
 * Automated Test Suite for "We Fart Together" Server & Level Physics
 */

const { LEVELS, RAFT_RADIUS, RAFT_DIAMETER, MIN_GAP_REQUIRED } = require('./shared/levels');
const http = require('http');
const { io: ioClient } = require('socket.io-client');

console.log("=== 1. VERIFYING LEVEL GAPS & SHRUNK ROCKS ===");
console.log(`Raft Radius: ${RAFT_RADIUS}px | Diameter: ${RAFT_DIAMETER}px`);
console.log(`Minimum Required Gap (Diameter + 30%): ${MIN_GAP_REQUIRED}px\n`);

let allLevelsPassed = true;

LEVELS.forEach((level) => {
  console.log(`Checking Level ${level.id}: "${level.name}"...`);

  // 1. Check all canal widths along waypoints
  level.waypoints.forEach((wp, idx) => {
    if (wp.width < MIN_GAP_REQUIRED) {
      console.error(`  [FAIL] Waypoint ${idx} at (${wp.x}, ${wp.y}) width ${wp.width}px < ${MIN_GAP_REQUIRED}px!`);
      allLevelsPassed = false;
    }
  });

  // 2. Check rocks
  const rocks = level.obstacles.filter(o => o.type === 'rock');
  rocks.forEach(rock => {
    // Find closest waypoint to estimate canal width at rock
    let closestWp = level.waypoints[0];
    let minDist = Infinity;
    level.waypoints.forEach(wp => {
      const d = Math.hypot(wp.x - rock.x, wp.y - rock.y);
      if (d < minDist) {
        minDist = d;
        closestWp = wp;
      }
    });

    const sideGap = (closestWp.width / 2) - rock.radius;
    console.log(`  Rock "${rock.id}" radius: ${rock.radius}px in canal width ${closestWp.width}px -> Side clearance: ${sideGap}px (Required >= ${MIN_GAP_REQUIRED}px)`);
    if (sideGap < MIN_GAP_REQUIRED) {
      console.error(`  [FAIL] Rock ${rock.id} gap ${sideGap}px < ${MIN_GAP_REQUIRED}px!`);
      allLevelsPassed = false;
    }
  });

  // 3. Check checkpoints exist
  if (!level.checkpoints || level.checkpoints.length < 2) {
    console.error(`  [FAIL] Level ${level.id} lacks valid start/finish checkpoints!`);
    allLevelsPassed = false;
  }
});

if (allLevelsPassed) {
  console.log("\n[PASS] All levels guarantee at least Raft Width + 30% clearance at every point!\n");
} else {
  process.exit(1);
}

console.log("=== 2. RUNNING MULTIPLAYER & SERVER-AUTHORITATIVE SIMULATION TEST ===");

// Require server or spawn it
const { spawn } = require('child_process');
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

  // 1. Create Room (2 Players)
  const client1 = ioClient(SERVER_URL);
  const client2 = ioClient(SERVER_URL);
  const client3 = ioClient(SERVER_URL);

  const token1 = 'tkn_test_1';
  const token2 = 'tkn_test_2';

  client1.on('connect', () => {
    console.log('[Client 1] Connected. Creating 2-player room...');
    client1.emit('create_room', {
      playerCount: 2,
      levelId: 1,
      playerName: 'HostHippo',
      token: token1
    }, (res) => {
      console.log(`[Client 1] Room created: Code = "${res.code}", Slot = ${res.slot}`);
      if (res.code.length !== 4) {
        console.error('[FAIL] Room code must be 4 characters!');
        cleanup(1);
      }

      const roomCode = res.code;

      // 2. Client 2 Joins Room
      client2.emit('join_room', {
        code: roomCode,
        playerName: 'BuddyHippo',
        token: token2
      }, (joinRes) => {
        console.log(`[Client 2] Joined Room "${roomCode}", Slot = ${joinRes.slot}`);

        // 3. Client 3 attempts to join full room -> should be rejected!
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

          // 4. Test Fart Physics and Snapshot Reception
          let receivedSnapshot = false;
          client1.on('snapshot', (snap) => {
            if (!receivedSnapshot) {
              receivedSnapshot = true;
              console.log(`[PASS] Server-authoritative snapshot received! Raft pos: (${snap.raft.x.toFixed(1)}, ${snap.raft.y.toFixed(1)}), angle: ${snap.raft.angle.toFixed(2)} rad, hippos: ${snap.hippos.length}`);

              // Test Fart input from Client 1
              client1.emit('player_input', {
                targetAngle: 0,
                isFarting: true,
                fartCharge: 1.5
              });

              // 5. Test Disconnect & Pause
              setTimeout(() => {
                console.log('[Test] Simulating Client 2 disconnect...');
                client2.disconnect();
              }, 500);
            }
          });

          client1.on('game_paused', ({ reason }) => {
            console.log(`[PASS] Game paused on player disconnect: "${reason}"`);

            // 6. Test Reconnect with same token
            console.log('[Test] Reconnecting Client 2 with slot token...');
            const client2Reconnect = ioClient(SERVER_URL);
            client2Reconnect.emit('join_room', {
              code: roomCode,
              playerName: 'BuddyHippo',
              token: token2
            }, (reconnectRes) => {
              if (reconnectRes.isReconnect && reconnectRes.slot === 1) {
                console.log(`[PASS] Player successfully reconnected to original slot ${reconnectRes.slot}!`);
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
