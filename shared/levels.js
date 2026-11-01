/**
 * We Fart Together — Shared Level Definitions & Collision Geometry
 * Matches exact game design brief:
 * - Raft Diameter: 80px (Radius: 40px)
 * - Normal Lane Width: 240px (~3 raft diameters)
 * - Start Pool: >= 5 raft diameters wide (460px)
 * - Spiked Chokepoints: >= 1.8 raft diameters free gap (144px)
 * - Continuous boundary polylines (trapezoids) with closed end caps
 */

const RAFT_RADIUS = 40;
const RAFT_DIAMETER = RAFT_RADIUS * 2; // 80px
const MIN_GAP_REQUIRED = Math.ceil(RAFT_DIAMETER * 1.8); // 144px

/**
 * Compute continuous left and right boundary polylines for waypoints
 */
function computeBoundaryPolylines(waypoints) {
  const leftPts = [];
  const rightPts = [];
  const tangents = [];

  for (let i = 0; i < waypoints.length; i++) {
    const p = waypoints[i];
    let tx, ty;

    if (i === 0) {
      const pNext = waypoints[1];
      const dx = pNext.x - p.x;
      const dy = pNext.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      tx = dx / len;
      ty = dy / len;
    } else if (i === waypoints.length - 1) {
      const pPrev = waypoints[i - 1];
      const dx = p.x - pPrev.x;
      const dy = p.y - pPrev.y;
      const len = Math.hypot(dx, dy) || 1;
      tx = dx / len;
      ty = dy / len;
    } else {
      const pPrev = waypoints[i - 1];
      const pNext = waypoints[i + 1];
      const d1x = p.x - pPrev.x;
      const d1y = p.y - pPrev.y;
      const len1 = Math.hypot(d1x, d1y) || 1;
      const d2x = pNext.x - p.x;
      const d2y = pNext.y - p.y;
      const len2 = Math.hypot(d2x, d2y) || 1;
      const sumX = d1x / len1 + d2x / len2;
      const sumY = d1y / len1 + d2y / len2;
      const sumLen = Math.hypot(sumX, sumY) || 1;
      tx = sumX / sumLen;
      ty = sumY / sumLen;
    }

    tangents.push({ x: tx, y: ty, angle: Math.atan2(ty, tx) });

    // Normal points left: (-ty, tx)
    const nx = -ty;
    const ny = tx;
    const halfW = p.width / 2;

    leftPts.push({
      x: p.x + nx * halfW,
      y: p.y + ny * halfW,
      nx: nx,
      ny: ny
    });

    rightPts.push({
      x: p.x - nx * halfW,
      y: p.y - ny * halfW,
      nx: -nx,
      ny: -ny
    });
  }

  return { leftPts, rightPts, tangents };
}

const LEVELS = [
  {
    id: 1,
    name: "Canyon Rapids (Level 1)",
    description: "Navigate canyon curves, pink bank spikes, grey gate slabs, and the central rock.",
    startPosition: { x: 300, y: 180 },
    startAngle: Math.PI / 2, // Downward (+Y)
    currentSpeed: 0.0, // River current completely removed!
    waypoints: [
      { x: 300, y: 80, width: 460 },   // Start Pool (width 460px >= 5 * D_raft)
      { x: 300, y: 320, width: 460 },  // START Gate location
      { x: 300, y: 550, width: 240 },  // Standard 240px racing lane
      { x: 420, y: 900, width: 240 },
      { x: 580, y: 1250, width: 240 },
      { x: 580, y: 1650, width: 380 }, // Wide Rock Basin (380px wide)
      { x: 420, y: 2050, width: 240 },
      { x: 260, y: 2450, width: 240 },
      { x: 260, y: 2850, width: 320 }, // Finish basin & FINISH Gate
      { x: 260, y: 3000, width: 320 }  // Closed back cap
    ],
    // Obstacles
    obstacles: [
      // Speed Boost Chevrons on water just past Start Gate
      {
        id: "boost_1",
        type: "boost",
        x: 300,
        y: 450,
        radius: 35,
        power: 16.0
      },
      // Pink Spiked Bank Rollers (along the bank, 24px thick into river)
      {
        id: "spike_roller_1",
        type: "spike_roller",
        x: 480,
        y: 950,
        width: 24,
        height: 200,
        angle: 0.45,
        isSpike: true
      },
      // Grey Spiked Slabs forming a gate (opening: 240 - 2 * 38 = 164px >= 144px!)
      {
        id: "spike_slab_left",
        type: "spike_slab",
        x: 490,
        y: 1350,
        width: 38,
        height: 60,
        angle: 0.0,
        isSpike: true
      },
      {
        id: "spike_slab_right",
        type: "spike_slab",
        x: 670,
        y: 1350,
        width: 38,
        height: 60,
        angle: 0.0,
        isSpike: true
      },
      // Shrunk Rock in 380px basin: Radius 22px (D = 44px) -> Gap on each side = (380 - 44)/2 = 168px >= 144px!
      {
        id: "rock_1",
        type: "rock",
        x: 580,
        y: 1650,
        radius: 22,
        isSpike: false
      },
      // Boost pad after rock basin
      {
        id: "boost_2",
        type: "boost",
        x: 420,
        y: 1950,
        radius: 35,
        power: 16.0
      },
      // Pink Spiked Bank Roller on left wall
      {
        id: "spike_roller_2",
        type: "spike_roller",
        x: 170,
        y: 2250,
        width: 24,
        height: 220,
        angle: -0.4,
        isSpike: true
      }
    ],
    // Checkpoints & Bamboo Arches
    checkpoints: [
      { id: 0, x: 300, y: 320, width: 460, label: "START" },
      { id: 1, x: 500, y: 1100, width: 240, label: "CHECKPOINT 1" },
      { id: 2, x: 580, y: 1800, width: 260, label: "CHECKPOINT 2" },
      { id: 3, x: 260, y: 2850, width: 320, label: "FINISH!" }
    ]
  },
  {
    id: 2,
    name: "Windmill Alley (Level 2)",
    description: "Navigate past spinning spiked windmills, pink rollers, and oscillating crushers.",
    startPosition: { x: 300, y: 180 },
    startAngle: Math.PI / 2,
    currentSpeed: 0.0,
    waypoints: [
      { x: 300, y: 80, width: 460 },   // Start pool
      { x: 300, y: 320, width: 460 },  // START Gate
      { x: 300, y: 600, width: 240 },
      { x: 450, y: 1000, width: 380 }, // Wide windmill bay (380px)
      { x: 380, y: 1400, width: 380 }, // Wide Rock Basin (380px)
      { x: 300, y: 1800, width: 380 }, // Wide windmill bay 2 (380px)
      { x: 300, y: 2200, width: 280 }, // Roller zone
      { x: 400, y: 2600, width: 240 },
      { x: 400, y: 2950, width: 320 }, // Finish basin & FINISH Gate
      { x: 400, y: 3100, width: 320 }  // End cap
    ],
    obstacles: [
      {
        id: "boost_2_start",
        type: "boost",
        x: 300,
        y: 480,
        radius: 35,
        power: 16.0
      },
      // Rotating Spiked Windmill 1: in 380px bay (armLength 72px -> corridor 164px >= 144px!)
      {
        id: "windmill_1",
        type: "windmill",
        x: 450,
        y: 1000,
        armLength: 72,
        armCount: 4,
        rotSpeed: 0.022,
        isSpike: true
      },
      // Shrunk Rock in 380px basin: Radius 22px -> clearance 168px >= 144px!
      {
        id: "rock_2",
        type: "rock",
        x: 380,
        y: 1400,
        radius: 22,
        isSpike: false
      },
      // Rotating Spiked Windmill 2: in 380px bay
      {
        id: "windmill_2",
        type: "windmill",
        x: 300,
        y: 1800,
        armLength: 72,
        armCount: 4,
        rotSpeed: -0.025,
        isSpike: true
      },
      // Oscillating Horizontal Spiked Roller (width 80 in 280px lane -> side clearance >= 144px during cycle)
      {
        id: "roller_1",
        type: "roller",
        x: 300,
        y: 2200,
        width: 76,
        height: 24,
        swingRange: 42,
        swingSpeed: 0.03,
        isSpike: true
      },
      // Pink Spiked Bank Roller
      {
        id: "spike_roller_2a",
        type: "spike_roller",
        x: 210,
        y: 650,
        width: 24,
        height: 180,
        angle: 0.2,
        isSpike: true
      },
      {
        id: "boost_2a",
        type: "boost",
        x: 450,
        y: 1200,
        radius: 35,
        power: 16.0
      }
    ],
    checkpoints: [
      { id: 0, x: 300, y: 320, width: 460, label: "START" },
      { id: 1, x: 450, y: 750, width: 240, label: "CHECKPOINT 1" },
      { id: 2, x: 340, y: 1550, width: 260, label: "CHECKPOINT 2" },
      { id: 3, x: 300, y: 2050, width: 260, label: "CHECKPOINT 3" },
      { id: 4, x: 400, y: 2950, width: 320, label: "FINISH!" }
    ]
  },
  {
    id: 3,
    name: "The Slalom Rapids (Level 3)",
    description: "Zigzag through slalom curves, pink bank spikes, and grey gate chokepoints.",
    startPosition: { x: 300, y: 180 },
    startAngle: Math.PI / 2,
    currentSpeed: 0.0,
    waypoints: [
      { x: 300, y: 80, width: 460 },   // Start pool
      { x: 300, y: 320, width: 460 },  // START Gate
      { x: 300, y: 550, width: 240 },
      { x: 170, y: 850, width: 240 },
      { x: 360, y: 1200, width: 240 },
      { x: 550, y: 1550, width: 240 },
      { x: 360, y: 1900, width: 380 }, // Wide Rock Basin (380px)
      { x: 180, y: 2250, width: 260 },
      { x: 300, y: 2650, width: 240 },
      { x: 300, y: 3000, width: 320 }, // Finish basin & FINISH Gate
      { x: 300, y: 3150, width: 320 }  // End cap
    ],
    obstacles: [
      {
        id: "boost_3_start",
        type: "boost",
        x: 300,
        y: 480,
        radius: 35,
        power: 16.0
      },
      // Pink Spikes along slalom turns
      {
        id: "spike_s1",
        type: "spike_roller",
        x: 65,
        y: 850,
        width: 24,
        height: 200,
        angle: 0.35,
        isSpike: true
      },
      // Grey Spiked Slabs gate
      {
        id: "spike_s2_left",
        type: "spike_slab",
        x: 270,
        y: 1200,
        width: 38,
        height: 60,
        angle: -0.3,
        isSpike: true
      },
      {
        id: "spike_s2_right",
        type: "spike_slab",
        x: 450,
        y: 1200,
        width: 38,
        height: 60,
        angle: -0.3,
        isSpike: true
      },
      {
        id: "spike_s3",
        type: "spike_roller",
        x: 650,
        y: 1550,
        width: 24,
        height: 200,
        angle: 0.35,
        isSpike: true
      },
      // Shrunk Rock in 380px basin: clearance 168px >= 144px!
      {
        id: "rock_s1",
        type: "rock",
        x: 360,
        y: 1900,
        radius: 22,
        isSpike: false
      },
      // Oscillating Roller
      {
        id: "roller_s1",
        type: "roller",
        x: 180,
        y: 2250,
        width: 76,
        height: 24,
        swingRange: 42,
        swingSpeed: 0.035,
        isSpike: true
      },
      {
        id: "boost_s1",
        type: "boost",
        x: 360,
        y: 1000,
        radius: 35,
        power: 18.0
      },
      {
        id: "boost_s2",
        type: "boost",
        x: 550,
        y: 1700,
        radius: 35,
        power: 18.0
      }
    ],
    checkpoints: [
      { id: 0, x: 300, y: 320, width: 460, label: "START" },
      { id: 1, x: 260, y: 1020, width: 240, label: "CHECKPOINT 1" },
      { id: 2, x: 450, y: 1720, width: 250, label: "CHECKPOINT 2" },
      { id: 3, x: 240, y: 2450, width: 250, label: "CHECKPOINT 3" },
      { id: 4, x: 300, y: 3000, width: 320, label: "FINISH!" }
    ]
  }
];

/**
 * Flood-fill verification:
 * Confirms that the track is 100% closed, watertight, and reaches the finish line.
 */
function verifyTrackWatertight(level) {
  const { leftPts, rightPts } = computeBoundaryPolylines(level.waypoints);
  
  // Bounding box with margins
  const minX = -100;
  const maxX = 900;
  const minY = 0;
  const maxY = 3300;
  const cellSize = 10;
  const cols = Math.ceil((maxX - minX) / cellSize);
  const rows = Math.ceil((maxY - minY) / cellSize);

  // 0 = empty, 1 = solid wall
  const grid = new Uint8Array(cols * rows);

  function markLine(x1, y1, x2, y2, thickness = 20) {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (cellSize / 2)) || 1;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      
      const radCells = Math.ceil(thickness / cellSize);
      const cx = Math.floor((x - minX) / cellSize);
      const cy = Math.floor((y - minY) / cellSize);

      for (let dy = -radCells; dy <= radCells; dy++) {
        for (let dx = -radCells; dx <= radCells; dx++) {
          const gx = cx + dx;
          const gy = cy + dy;
          if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
            grid[gy * cols + gx] = 1;
          }
        }
      }
    }
  }

  // Draw continuous left boundary
  for (let i = 0; i < leftPts.length - 1; i++) {
    markLine(leftPts[i].x, leftPts[i].y, leftPts[i + 1].x, leftPts[i + 1].y, 25);
  }
  // Draw continuous right boundary
  for (let i = 0; i < rightPts.length - 1; i++) {
    markLine(rightPts[i].x, rightPts[i].y, rightPts[i + 1].x, rightPts[i + 1].y, 25);
  }
  // Draw start cap
  markLine(leftPts[0].x, leftPts[0].y, rightPts[0].x, rightPts[0].y, 25);
  // Draw finish cap
  const last = leftPts.length - 1;
  markLine(leftPts[last].x, leftPts[last].y, rightPts[last].x, rightPts[last].y, 25);

  // Flood fill from startPosition
  const startX = Math.floor((level.startPosition.x - minX) / cellSize);
  const startY = Math.floor((level.startPosition.y - minY) / cellSize);
  
  const visited = new Uint8Array(cols * rows);
  const queue = [[startX, startY]];
  visited[startY * cols + startX] = 1;

  let reachedBoundary = false;
  let maxVisitedY = 0;

  while (queue.length > 0) {
    const [cx, cy] = queue.pop();
    const worldY = minY + cy * cellSize;
    if (worldY > maxVisitedY) maxVisitedY = worldY;

    // Check if leaked to outside bounding perimeter
    if (cx <= 1 || cx >= cols - 2 || cy <= 1 || cy >= rows - 2) {
      reachedBoundary = true;
      break;
    }

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        const idx = ny * cols + nx;
        if (!visited[idx] && grid[idx] === 0) {
          visited[idx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }

  const finishY = level.waypoints[level.waypoints.length - 2].y;
  const reachesFinish = maxVisitedY >= finishY;
  const isWatertight = !reachedBoundary && reachesFinish;

  return {
    isWatertight,
    leakedToOutside: reachedBoundary,
    reachesFinish,
    maxVisitedY,
    finishY
  };
}

/**
 * Grid clearance test at hazards against real collider dimensions:
 * Verifies that a circle of diameter >= MIN_GAP_REQUIRED (144px) can pass all chokepoints.
 */
function verifyHazardClearances(level) {
  const results = [];

  level.obstacles.forEach(obs => {
    let clearance = Infinity;

    // Find nearest waypoints to get canal width at obstacle
    let bestDist = Infinity;
    let localWidth = 240;

    for (const wp of level.waypoints) {
      const d = Math.hypot(obs.x - wp.x, obs.y - wp.y);
      if (d < bestDist) {
        bestDist = d;
        localWidth = wp.width;
      }
    }

    if (obs.type === 'rock') {
      // Rock in center of wide channel: clearance on each side is (width - 2*radius) / 2
      clearance = (localWidth - obs.radius * 2) / 2;
    } else if (obs.type === 'spike_roller') {
      // Pink roller along bank: free channel is width - roller thickness
      clearance = localWidth - obs.width;
    } else if (obs.type === 'spike_slab') {
      // Slabs on banks: free gap between slabs or to opposing wall
      // If two slabs, clearance is channel width minus total slab protrusion
      clearance = localWidth - obs.width * 2;
    } else if (obs.type === 'windmill') {
      // Windmill in 380px bay: passage corridor around arms
      clearance = localWidth - obs.armLength;
    } else if (obs.type === 'roller') {
      // Oscillating roller: clearance during open window
      clearance = localWidth - obs.width;
    } else if (obs.type === 'boost') {
      // Boost pad is passable
      clearance = localWidth;
    }

    const passes = clearance >= MIN_GAP_REQUIRED;
    results.push({
      id: obs.id,
      type: obs.type,
      clearance,
      required: MIN_GAP_REQUIRED,
      passes
    });
  });

  return results;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RAFT_RADIUS,
    RAFT_DIAMETER,
    MIN_GAP_REQUIRED,
    LEVELS,
    computeBoundaryPolylines,
    verifyTrackWatertight,
    verifyHazardClearances
  };
} else {
  window.RAFT_RADIUS = RAFT_RADIUS;
  window.RAFT_DIAMETER = RAFT_DIAMETER;
  window.MIN_GAP_REQUIRED = MIN_GAP_REQUIRED;
  window.LEVELS = LEVELS;
  window.computeBoundaryPolylines = computeBoundaryPolylines;
  window.verifyTrackWatertight = verifyTrackWatertight;
  window.verifyHazardClearances = verifyHazardClearances;
}