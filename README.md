# 🍩💨 We Fart Together — Mobile Co-op Raft Game

A mobile-first, cooperative 3D-inspired 2D physics river-runner game. Up to 4 players control hippos clinging to the edge of a shared inflatable donut raft floating down a canyon river course, steering and propelling the raft exclusively with **directional farts**.

---

## 🎮 How to Play

### Mobile Controls
- **Move around the rim**: Drag the left virtual touch joystick or slide along the edge. Your hippo moves along the raft's perimeter.
- **Orientation**: Your hippo's **butt strictly faces outward toward the water**, and its **head faces inside**.
- **Fart Propulsion**: Hold the big right **FART** button to charge your fart meter (up to 2.5x), then release to blast! Farting pushes the raft **opposite** to your butt direction, applying both linear thrust and rotational torque.
- **Co-op Steering**: Players must coordinate farting angles to steer through narrow passages, around rocks, and past spinning spike hazards.

### Desktop Controls
- **A / Left Arrow**: Move Hippo counter-clockwise
- **D / Right Arrow**: Move Hippo clockwise
- **Space / W / Up Arrow**: Hold to charge FART, release to blast!

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: Vanilla JavaScript + HTML5 Canvas (PWA installable, landscape locked, Screen Wake Lock API, Safe-Area insets).
- **Physics**: [Matter.js](https://brm.io/matter-js/) running **exclusively on the server**.
- **Multiplayer**: Node.js + Express + Socket.IO with server-authoritative simulation at **60 Hz** and client interpolation at **25 Hz** snapshots.
- **Audio**: Procedural Web Audio API sound synthesizer (randomized flutter farts, explosions, splashes, chimes).

---

## ☁️ Deployment on Render.com

1. On [Render.com](https://render.com), click **New +** and select **Web Service**.
2. Connect this repository: `https://github.com/ishak8bd/we-fart-together`.
3. Configure settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter)
4. Click **Deploy Web Service**.
5. Once live, open your URL `https://your-app.onrender.com` on two or more mobile phones and play!

> [!NOTE]
> **Single Instance Only**: Run exactly one instance on Render. Game rooms and physics simulations live in server memory, so scaling across multiple instances would split players.
> The `?room=XXXX` invite link works automatically across all devices.

---

## 🧪 Local Testing

```bash
# Install dependencies
npm install

# Run automated clearance and multiplayer tests
npm test

# Start local server (http://localhost:3000)
npm start
```
