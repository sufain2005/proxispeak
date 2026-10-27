# 🌐 ProxiSpeak — Spatial Virtual Office & WebRTC Proximity Audio

> A next-generation virtual office workspace featuring real-time peer-to-peer WebRTC voice communication, 3D binaural spatial audio, acoustic wall occlusion physics, and an interactive architectural floor plan.

![ProxiSpeak Status](https://img.shields.io/badge/Status-Production%20Ready-2ed573?style=for-the-badge)
![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react)
![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwindcss)
![WebRTC](https://img.shields.io/badge/WebRTC-Peer_to_Peer-ff6b6b?style=for-the-badge&logo=webrtc)
![Web Audio API](https://img.shields.io/badge/Web_Audio-3D_Spatial_Acoustics-a855f7?style=for-the-badge)
![Node.js & ws](https://img.shields.io/badge/Backend-Node.js%20%7C%20WebSocket-339933?style=for-the-badge&logo=node.js)

---

## 🚀 Key Features

### 🎧 1. True 3D Spatial Audio & Binaural Panning
- **Stereo Left/Right Panning**: Sound dynamically pans between your left and right ear (`StereoPannerNode`) based on where colleagues stand relative to your avatar.
- **Cosine Distance Roll-Off**: Smooth, natural volume roll-off (`GainNode`) as you approach or walk away from peers.
- **Master Audio & Input Monitoring**: Integrated mic VU meter, master volume slider, and stereo sweep test chimes.

### 🧱 2. Acoustic Ray-Casting & Wall Occlusion
- **Real Physical Walls**: Ray-segment intersection algorithms test line-of-sight between avatars across all 4 perimeter edges of every room.
- **Smart Muffling**: Sound is naturally muffled through glass (-45%) and heavily blocked by solid drywall (-85%).
- **No Spiderweb Lines**: Laser connection lines strictly respect architectural walls and only connect within true conversational proximity.

### 🏢 3. 5-Zone Architectural Floor Plan
- **Executive Boardroom**: 6-seat table with click-to-dock feature and integrated screen sharing.
- **Design Studio**: Collaborative workbenches with dual-monitor rigs and ideation boards.
- **Quiet Focus Pods**: Individual sound-isolated acoustic booths with vacancy indicators.
- **Atlas Lounge & Cafe**: Casual sectional couches, coffee bar, and ambient gathering spots.
- **Core Engineering Lab**: High-speed workstations, edge servers, and developer pods.

### 🔄 4. Resilient Dual-Signaling Architecture
- **WebRTC Live Mode**: Node.js + Express WebSocket server on port `3001` with layout persistence and room synchronization.
- **Local Mesh Mode (P2P)**: Seamless standalone fallback using the browser's native `BroadcastChannel` API — test across multiple browser tabs with zero server dependencies.
- **Zero UI Jitter**: Fixed-dimension status indicator with silent HTTP health probes prevents flapping or shrinking.

### 🛠️ 5. Interactive Workspace Controls
- **Click-to-Walk with Destination Ripple**: Dual-ring pulse animation on floor clicks.
- **Minimap Radar**: Real-time overhead radar with click-to-jump navigation.
- **Interactive Layout Editor**: Drag-and-drop palette to place walls and furniture with REST API persistence.
- **Spatial Chat & Quick Reactions**: Comic speech bubbles pop above avatars with reaction chips (`👋`, `☕`, `💡`, `🚀`, `👏`, `🔥`).
- **Boardroom Screen Sharing**: Broadcast screen presentations live to colleagues.
- **Keyboard Shortcuts**: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys to walk, <kbd>M</kbd> to toggle microphone.

---

## 📦 Project Structure

```text
ProxiSpeak/
├── server/                   # Node.js backend
│   └── index.js              # Express REST API & WebSocket signaling server (Port 3001)
├── src/
│   ├── components/
│   │   ├── OfficeMap.tsx           # Interactive 5-zone SVG map & avatar canvas
│   │   ├── ControlDock.tsx         # Bottom dock (Mic, Audio, Share, Range, Map)
│   │   ├── SidebarDirectory.tsx    # Colleagues list, spatial chat & zones
│   │   ├── AudioSettingsModal.tsx  # Mic selector, VU meter, master volume & stereo test
│   │   ├── LayoutEditorModal.tsx   # Wall & furniture placement editor
│   │   ├── ScreenShareModal.tsx    # Boardroom screen sharing modal
│   │   └── Icons.tsx               # Crisp SVG iconography
│   ├── services/
│   │   ├── spatialAudio.ts         # Web Audio API engine (Stereo panning, occlusion, chimes)
│   │   └── webrtcService.ts        # WebRTC mesh & dual-signaling manager
│   ├── App.tsx                     # Main application container & state orchestration
│   ├── index.css                   # Global styles & Tailwind CSS v4 custom theme
│   └── main.tsx                    # React 19 entrypoint
├── package.json
└── vite.config.ts
```

---

## 🏁 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Frontend (Vite Dev Server)
```bash
npm run dev
```
*Frontend runs on `http://localhost:8443` (or the port shown in terminal).*

### 3. Start the Backend Signaling Server (Optional for Live Multi-Device)
In a separate terminal tab:
```bash
npm run server
```
*Signaling server runs on `http://localhost:3001`.*

> **Note**: Even without the backend server running, ProxiSpeak automatically runs in **Local Mesh Mode** across browser tabs using native `BroadcastChannel`!

---

## 🧪 Testing Multi-User Spatial Audio

1. Open `http://localhost:8443` in your browser.
2. Open a **second tab** or an **Incognito window** to the same address.
3. Unmute your microphone and walk your avatars near each other on the floor plan.
4. Listen as voice pans from left to right as you walk across the room!

---

## 📄 License
MIT License. Built for modern remote teams.
