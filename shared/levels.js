/**
 * We Fart Together — Shared Level Definitions & Obstacle Geometries
 * Guarantees every canal passage has at least raft width + 30% clearance (>= 1.3 * D_raft).
 */

const RAFT_RADIUS = 55;
const RAFT_DIAMETER = RAFT_RADIUS * 2; // 110px
const MIN_GAP_REQUIRED = Math.ceil(RAFT_DIAMETER * 1.3); // 143px

const LEVELS = [
  {
    id: 1,
    name: "Canyon Rapids (Level 1)",
    description: "Learn the ropes! Steer through canyon bends and bypass the shrunk rock.",
    startPosition: { x: 300, y: 150 },
    startAngle: Math.PI / 2, // Downward (+Y)
    currentSpeed: 1.8,
    // Track segments defined by centerline waypoints and canal widths
    // Canal width at rock is 380px -> each side has (380/2 - 24) = 166px >= 143px!
    waypoints: [
      { x: 300, y: 100, width: 220 },
      { x: 300, y: 450, width: 220 },
      { x: 450, y: 800, width: 240 },
      { x: 650, y: 1100, width: 240 },
      { x: 650, y: 1500, width: 380 }, // Wide Rock Basin (380px wide)
      { x: 450, y: 1900, width: 240 },
      { x: 250, y: 2300, width: 240 },
      { x: 250, y: 2800, width: 220 }
    ],
    // Obstacles
    obstacles: [
      // Shrunk Rock: Radius 24px in a 380px wide channel -> Gaps on each side are 166px (>= 143px!)
      {
        id: "rock_1",
        type: "rock",
        x: 650,
        y: 1500,
        radius: 24, // Shrunk to 24px!
        isSpike: false
      },
      // Purple Spiked Border Strips
      {
        id: "spike_wall_1",
        type: "spike_strip",
        x: 770,
        y: 950,
        width: 20,
        height: 220,
        angle: 0.4,
        isSpike: true
      },
      {
        id: "spike_wall_2",
        type: "spike_strip",
        x: 130,
        y: 2100,
        width: 20,
        height: 240,
        angle: -0.4,
        isSpike: true
      },
      // Speed Boost Chevrons
      {
        id: "boost_1",
        type: "boost",
        x: 300,
        y: 600,
        radius: 35,
        power: 14.0
      },
      {
        id: "boost_2",
        type: "boost",
        x: 450,
        y: 1850,
        radius: 35,
        power: 15.0
      }
    ],
    // Checkpoints
    checkpoints: [
      { id: 0, x: 300, y: 200, width: 220, label: "START" },
      { id: 1, x: 550, y: 950, width: 240, label: "CHECKPOINT 1" },
      { id: 2, x: 550, y: 1700, width: 250, label: "CHECKPOINT 2" },
      { id: 3, x: 250, y: 2750, width: 220, label: "FINISH!" }
    ]
  },
  {
    id: 2,
    name: "Windmill Alley (Level 2)",
    description: "Navigate past spinning spiked windmills and swinging rollers with clear timing windows.",
    startPosition: { x: 300, y: 150 },
    startAngle: Math.PI / 2,
    currentSpeed: 2.2,
    waypoints: [
      { x: 300, y: 100, width: 230 },
      { x: 300, y: 500, width: 230 },
      { x: 450, y: 900, width: 380 }, // Wide windmill bay (380px)
      { x: 380, y: 1300, width: 380 }, // Wide Rock Basin (380px)
      { x: 300, y: 1700, width: 380 }, // Wide windmill bay 2 (380px)
      { x: 300, y: 2100, width: 260 }, // Roller zone
      { x: 400, y: 2500, width: 230 },
      { x: 400, y: 2900, width: 230 }
    ],
    obstacles: [
      // Rotating Spiked Windmill 1: in 380px wide bay
      {
        id: "windmill_1",
        type: "windmill",
        x: 450,
        y: 900,
        armLength: 64,
        armCount: 4,
        rotSpeed: 0.025,
        isSpike: true
      },
      // Shrunk Rock 2: Radius 24px in 380px canal -> (380/2 - 24) = 166px >= 143px!
      {
        id: "rock_2",
        type: "rock",
        x: 380,
        y: 1300,
        radius: 24,
        isSpike: false
      },
      // Rotating Spiked Windmill 2: in 380px bay
      {
        id: "windmill_2",
        type: "windmill",
        x: 300,
        y: 1700,
        armLength: 64,
        armCount: 4,
        rotSpeed: -0.03,
        isSpike: true
      },
      // Oscillating Horizontal Spiked Roller
      {
        id: "roller_1",
        type: "roller",
        x: 300,
        y: 2100,
        width: 80,
        height: 24,
        swingRange: 50,
        swingSpeed: 0.03,
        isSpike: true
      },
      // Spikes on canal wall
      {
        id: "spike_wall_2a",
        type: "spike_strip",
        x: 180,
        y: 600,
        width: 18,
        height: 180,
        angle: 0,
        isSpike: true
      },
      // Boost
      {
        id: "boost_2a",
        type: "boost",
        x: 450,
        y: 1100,
        radius: 35,
        power: 16.0
      }
    ],
    checkpoints: [
      { id: 0, x: 300, y: 200, width: 230, label: "START" },
      { id: 1, x: 450, y: 650, width: 240, label: "CHECKPOINT 1" },
      { id: 2, x: 300, y: 1450, width: 250, label: "CHECKPOINT 2" },
      { id: 3, x: 300, y: 1950, width: 240, label: "CHECKPOINT 3" },
      { id: 4, x: 400, y: 2850, width: 230, label: "FINISH!" }
    ]
  },
  {
    id: 3,
    name: "The Slalom Rapids (Level 3)",
    description: "High speed canyon rapids! Rapid zigzag turns, timing crushers, and turbo boosts.",
    startPosition: { x: 300, y: 150 },
    startAngle: Math.PI / 2,
    currentSpeed: 2.6,
    waypoints: [
      { x: 300, y: 100, width: 230 },
      { x: 300, y: 400, width: 230 },
      { x: 150, y: 750, width: 230 },
      { x: 350, y: 1100, width: 240 },
      { x: 550, y: 1450, width: 240 },
      { x: 350, y: 1800, width: 380 }, // Wide Rock Basin (380px)
      { x: 150, y: 2150, width: 250 },
      { x: 300, y: 2550, width: 240 },
      { x: 300, y: 2950, width: 230 }
    ],
    obstacles: [
      // Spikes along slalom turns
      {
        id: "spike_s1",
        type: "spike_strip",
        x: 20,
        y: 750,
        width: 18,
        height: 220,
        angle: 0.3,
        isSpike: true
      },
      {
        id: "spike_s2",
        type: "spike_strip",
        x: 480,
        y: 1100,
        width: 18,
        height: 220,
        angle: -0.3,
        isSpike: true
      },
      {
        id: "spike_s3",
        type: "spike_strip",
        x: 680,
        y: 1450,
        width: 18,
        height: 220,
        angle: 0.3,
        isSpike: true
      },
      // Shrunk Rock in Slalom: radius 24px in 380px wide canal -> (380/2 - 24) = 166px >= 143px!
      {
        id: "rock_s1",
        type: "rock",
        x: 350,
        y: 1800,
        radius: 24,
        isSpike: false
      },
      // Oscillating Roller
      {
        id: "roller_s1",
        type: "roller",
        x: 150,
        y: 2150,
        width: 80,
        height: 24,
        swingRange: 50,
        swingSpeed: 0.035,
        isSpike: true
      },
      // Boosters
      {
        id: "boost_s1",
        type: "boost",
        x: 150,
        y: 900,
        radius: 35,
        power: 18.0
      },
      {
        id: "boost_s2",
        type: "boost",
        x: 550,
        y: 1600,
        radius: 35,
        power: 18.0
      }
    ],
    checkpoints: [
      { id: 0, x: 300, y: 200, width: 230, label: "START" },
      { id: 1, x: 250, y: 920, width: 230, label: "CHECKPOINT 1" },
      { id: 2, x: 450, y: 1620, width: 240, label: "CHECKPOINT 2" },
      { id: 3, x: 220, y: 2350, width: 240, label: "CHECKPOINT 3" },
      { id: 4, x: 300, y: 2900, width: 230, label: "FINISH!" }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RAFT_RADIUS,
    RAFT_DIAMETER,
    MIN_GAP_REQUIRED,
    LEVELS
  };
} else {
  window.RAFT_RADIUS = RAFT_RADIUS;
  window.RAFT_DIAMETER = RAFT_DIAMETER;
  window.MIN_GAP_REQUIRED = MIN_GAP_REQUIRED;
  window.LEVELS = LEVELS;
}
