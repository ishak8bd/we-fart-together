/**
 * We Fart Together — 2D HTML5 Canvas Game Renderer
 * Optimized for mobile web at 60 FPS (capped at 2x DPR).
 */

class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Camera offset (follows raft)
    this.camera = { x: 300, y: 150 };

    // Visual particles
    this.fartParticles = [];
    this.wakeRings = [];
    this.explosionParticles = [];

    // Animation time
    this.time = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.scale(this.dpr, this.dpr);
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  addFartParticle(x, y, angle, power = 1.0) {
    for (let i = 0; i < 3; i++) {
      const spread = (Math.random() - 0.5) * 0.4;
      const speed = (180 + Math.random() * 120) * Math.min(power, 2.0);
      const dir = angle + spread;
      this.fartParticles.push({
        x: x,
        y: y,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        radius: 8 + Math.random() * 8 * power,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2
      });
    }
  }

  addWakeRing(x, y, radius = 55) {
    this.wakeRings.push({
      x: x,
      y: y,
      radius: radius * 0.9,
      maxRadius: radius * 1.8,
      opacity: 0.65,
      life: 0,
      maxLife: 0.9
    });
  }

  addExplosion(x, y) {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 220;
      this.explosionParticles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: ['#ffeb3b', '#ff7043', '#ffffff', '#76ff03'][Math.floor(Math.random() * 4)],
        size: 5 + Math.random() * 7,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.3
      });
    }
  }

  updateParticles(dt) {
    this.time += dt;

    // Fart Particles
    for (let i = this.fartParticles.length - 1; i >= 0; i--) {
      const p = this.fartParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.fartParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.radius += dt * 25;
    }

    // Wake Rings
    for (let i = this.wakeRings.length - 1; i >= 0; i--) {
      const r = this.wakeRings[i];
      r.life += dt;
      if (r.life >= r.maxLife) {
        this.wakeRings.splice(i, 1);
        continue;
      }
      const progress = r.life / r.maxLife;
      r.radius += dt * 35;
      r.opacity = (1 - progress) * 0.65;
    }

    // Explosion Particles
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const ep = this.explosionParticles[i];
      ep.life += dt;
      if (ep.life >= ep.maxLife) {
        this.explosionParticles.splice(i, 1);
        continue;
      }
      ep.x += ep.vx * dt;
      ep.y += ep.vy * dt;
      ep.vx *= 0.94;
      ep.vy *= 0.94;
    }
  }

  /**
   * Main Render Pass
   */
  render(level, raftState, hippos, dynamicObstacles, activeCheckpoint, dt) {
    this.updateParticles(dt);

    const ctx = this.ctx;
    const w = this.viewportWidth;
    const h = this.viewportHeight;

    // Smooth Camera Follow
    if (raftState) {
      this.camera.x += (raftState.x - this.camera.x) * 0.1;
      this.camera.y += (raftState.y - this.camera.y) * 0.1;
    }

    // Clear Screen (Canyon Desert Sand Background)
    ctx.fillStyle = '#d7ccc8';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    // Center camera on screen
    ctx.translate(w / 2 - this.camera.x, h / 2 - this.camera.y);

    // 1. Draw River Water Canal
    if (level) {
      this.drawRiverCanal(ctx, level);
      this.drawCheckpoints(ctx, level, activeCheckpoint);
      this.drawObstacles(ctx, level, dynamicObstacles);
    }

    // 2. Draw Wake Rings
    this.drawWakeRings(ctx);

    // 3. Draw The Raft & Hippos
    if (raftState && !raftState.isDead) {
      this.drawRaft(ctx, raftState);
      this.drawHippos(ctx, raftState, hippos);
    }

    // 4. Draw Particles (Fart gas and explosions)
    this.drawParticles(ctx);

    ctx.restore();
  }

  drawRiverCanal(ctx, level) {
    const pts = level.waypoints;
    if (!pts || pts.length < 2) return;

    // Draw Canal Water polygon
    ctx.beginPath();
    // Left boundary
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const pNext = pts[Math.min(i + 1, pts.length - 1)];
      const pPrev = pts[Math.max(i - 1, 0)];
      const dx = pNext.x - pPrev.x;
      const dy = pNext.y - pPrev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const x = p.x + nx * (p.width / 2);
      const y = p.y + ny * (p.width / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    // Right boundary (reversed)
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      const pNext = pts[Math.min(i + 1, pts.length - 1)];
      const pPrev = pts[Math.max(i - 1, 0)];
      const dx = pNext.x - pPrev.x;
      const dy = pNext.y - pPrev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const x = p.x - nx * (p.width / 2);
      const y = p.y - ny * (p.width / 2);
      ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Vibrant Blue Water Fill
    ctx.fillStyle = '#29b6f6';
    ctx.fill();

    // Animated water flow ripples
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    const waveOffset = (this.time * 60) % 80;
    for (let y = -200; y < 3500; y += 80) {
      ctx.beginPath();
      ctx.moveTo(-500, y + waveOffset);
      ctx.bezierCurveTo(200, y + waveOffset + 25, 600, y + waveOffset - 25, 1500, y + waveOffset);
      ctx.stroke();
    }
    ctx.restore();

    // Green Border Banks (Grass / Bamboo edges)
    ctx.strokeStyle = '#43a047';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Left bank stroke
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const pNext = pts[Math.min(i + 1, pts.length - 1)];
      const pPrev = pts[Math.max(i - 1, 0)];
      const dx = pNext.x - pPrev.x;
      const dy = pNext.y - pPrev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const x = p.x + nx * (p.width / 2);
      const y = p.y + ny * (p.width / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Right bank stroke
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const pNext = pts[Math.min(i + 1, pts.length - 1)];
      const pPrev = pts[Math.max(i - 1, 0)];
      const dx = pNext.x - pPrev.x;
      const dy = pNext.y - pPrev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const x = p.x - nx * (p.width / 2);
      const y = p.y - ny * (p.width / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  drawCheckpoints(ctx, level, activeCheckpoint) {
    level.checkpoints.forEach((cp, idx) => {
      const isReached = idx <= activeCheckpoint;
      ctx.save();
      ctx.translate(cp.x, cp.y);

      // Wooden Arch Beam
      ctx.fillStyle = isReached ? '#ffd54f' : '#8d6e63';
      ctx.strokeStyle = '#4e342e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-cp.width / 2, -14, cp.width, 28, 6);
      ctx.fill();
      ctx.stroke();

      // Banner Text
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#4e342e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cp.label, 0, 0);

      ctx.restore();
    });
  }

  drawObstacles(ctx, level, dynamicObstacles) {
    level.obstacles.forEach(obs => {
      ctx.save();
      if (obs.type === 'rock') {
        // Shrunk Rock (Grey boulder with dark outline and 3D shading)
        ctx.fillStyle = '#607d8b';
        ctx.strokeStyle = '#37474f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(obs.x - obs.radius * 0.3, obs.y - obs.radius * 0.3, obs.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'spike_strip') {
        // Spiked Wall: Purple base with sharp white teeth
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.angle || 0);

        ctx.fillStyle = '#ab47bc';
        ctx.strokeStyle = '#4a148c';
        ctx.lineWidth = 3;
        ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);

        // White spikes
        ctx.fillStyle = '#ffffff';
        const numTeeth = Math.floor(obs.height / 24);
        for (let i = 0; i < numTeeth; i++) {
          const ty = -obs.height / 2 + (i + 0.5) * (obs.height / numTeeth);
          ctx.beginPath();
          ctx.moveTo(obs.width / 2, ty - 8);
          ctx.lineTo(obs.width / 2 + 12, ty);
          ctx.lineTo(obs.width / 2, ty + 8);
          ctx.fill();
        }
      } else if (obs.type === 'boost') {
        // Speed Chevron on water
        ctx.translate(obs.x, obs.y);
        ctx.fillStyle = '#ff3d00';
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(-25, -12);
        ctx.lineTo(0, 16);
        ctx.lineTo(25, -12);
        ctx.lineTo(25, -2);
        ctx.lineTo(0, 26);
        ctx.lineTo(-25, -2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });

    // Draw Dynamic Obstacles (Windmills, Rollers)
    if (dynamicObstacles) {
      dynamicObstacles.forEach(d => {
        ctx.save();
        if (d.type === 'windmill') {
          const obsData = level.obstacles.find(o => o.id === d.id);
          if (obsData) {
            ctx.translate(obsData.x, obsData.y);
            ctx.rotate(d.angle);

            // 4 Spiked Cross Arms
            for (let a = 0; a < obsData.armCount; a++) {
              ctx.rotate(Math.PI / 2);
              ctx.fillStyle = '#ab47bc';
              ctx.strokeStyle = '#4a148c';
              ctx.lineWidth = 3;
              ctx.fillRect(-obsData.armLength, -7, obsData.armLength * 2, 14);

              // Teeth along arms
              ctx.fillStyle = '#ffffff';
              for (let s = -obsData.armLength + 15; s < obsData.armLength; s += 24) {
                ctx.beginPath();
                ctx.moveTo(s - 6, 7);
                ctx.lineTo(s, 16);
                ctx.lineTo(s + 6, 7);
                ctx.fill();
              }
            }

            // Center Pivot
            ctx.fillStyle = '#4e342e';
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (d.type === 'roller') {
          // Oscillating roller
          const obsData = level.obstacles.find(o => o.id === d.id);
          if (obsData) {
            ctx.translate(d.x, d.y);
            ctx.fillStyle = '#ab47bc';
            ctx.strokeStyle = '#4a148c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(-obsData.width / 2, -obsData.height / 2, obsData.width, obsData.height, 6);
            ctx.fill();
            ctx.stroke();

            // Spikes on roller
            ctx.fillStyle = '#ffffff';
            for (let rx = -obsData.width / 2 + 10; rx < obsData.width / 2; rx += 18) {
              ctx.beginPath();
              ctx.moveTo(rx - 5, obsData.height / 2);
              ctx.lineTo(rx, obsData.height / 2 + 10);
              ctx.lineTo(rx + 5, obsData.height / 2);
              ctx.fill();
            }
          }
        }
        ctx.restore();
      });
    }
  }

  drawWakeRings(ctx) {
    this.wakeRings.forEach(r => {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${r.opacity})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  drawRaft(ctx, raft) {
    ctx.save();
    ctx.translate(raft.x, raft.y);
    ctx.rotate(raft.angle);

    // 1. Inflatable Donut Torus (Orange)
    ctx.fillStyle = '#ff7043';
    ctx.strokeStyle = '#d84315';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inflatable Tube Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.stroke();

    // 2. Trampoline Inner Green Deck
    ctx.fillStyle = '#81c784';
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Deck Cross Stitching
    ctx.strokeStyle = 'rgba(46, 125, 50, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-28, 0); ctx.lineTo(28, 0);
    ctx.moveTo(0, -28); ctx.lineTo(0, 28);
    ctx.stroke();

    // 3. Handles (at 4 cardinal directions)
    for (let a = 0; a < 4; a++) {
      ctx.save();
      ctx.rotate(a * Math.PI / 2);
      ctx.fillStyle = '#e53935';
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(46, -6, 10, 12, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  drawHippos(ctx, raft, hippos) {
    if (!hippos) return;

    hippos.forEach((h, idx) => {
      ctx.save();
      ctx.translate(raft.x, raft.y);
      ctx.rotate(raft.angle);

      // Hippo sits on the raft rim at relative angle h.angle
      ctx.rotate(h.angle);
      ctx.translate(55, 0); // Position exactly on the edge (R = 55)

      // ORIENTATION:
      // Butt faces water (outside: +X in this local frame).
      // Head faces inside the raft (-X in this local frame)!
      // So local rotation 0 aligns butt outward (+X) and snout inward (-X).

      const charge = h.fartCharge || 0;
      const isFarting = h.isFarting;
      const buttSwell = 1.0 + charge * 0.4 + (isFarting ? 0.25 : 0);
      const color = h.color ? h.color.hex : '#455a64';
      const belly = h.color ? h.color.belly : '#cfd8dc';

      // 1. Plump Butt (facing outside: +X)
      ctx.fillStyle = color;
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(8, 0, 14 * buttSwell, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      ctx.stroke();

      // 2. Main Hippo Torso
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Belly Patch
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. Hippo Head & Snout (facing inside: -X)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-24, -10, 14, 20, 6);
      ctx.fill();
      ctx.stroke();

      // Nostrils (Pink)
      ctx.fillStyle = '#f48fb1';
      ctx.beginPath();
      ctx.arc(-22, -4, 2.5, 0, Math.PI * 2);
      ctx.arc(-22, 4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(-12, -7, 2.2, 0, Math.PI * 2);
      ctx.arc(-12, 7, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(-8, -12, 3.5, 0, Math.PI * 2);
      ctx.arc(-8, 12, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 4. Front Paws holding the rim/handle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(-14, -11, 4, 0, Math.PI * 2);
      ctx.arc(-14, 11, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 5. Overhead Name Tag
      ctx.save();
      // Keep nameplate upright
      ctx.rotate(-raft.angle - h.angle);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-42, -44, 84, 18, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h.name || `Hippo ${idx + 1}`, 0, -35);
      ctx.restore();

      ctx.restore();
    });
  }

  drawParticles(ctx) {
    // Neon Green Fart Smoke
    this.fartParticles.forEach(p => {
      const progress = p.life / p.maxLife;
      ctx.save();
      ctx.fillStyle = `rgba(118, 255, 3, ${1 - progress})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Death Explosion Debris
    this.explosionParticles.forEach(ep => {
      const progress = ep.life / ep.maxLife;
      ctx.save();
      ctx.fillStyle = ep.color;
      ctx.globalAlpha = 1 - progress;
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, ep.size * (1 - progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}

window.CanvasRenderer = CanvasRenderer;
