import express from 'express';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const LAYOUT_FILE = path.join(DATA_DIR, 'layouts.json');

// Default office layout objects matching architectural zones
const DEFAULT_LAYOUT = {
  walls: [
    { id: 'w1', x: 5, y: 6, width: 28, height: 34, type: 'room', name: 'Executive Boardroom' },
    { id: 'w2', x: 67, y: 6, width: 28, height: 34, type: 'room', name: 'Focus Pods' },
    { id: 'w3', x: 5, y: 56, width: 38, height: 38, type: 'room', name: 'Atlas Lounge & Cafe' },
    { id: 'w4', x: 46, y: 56, width: 49, height: 38, type: 'room', name: 'Engineering Lab' },
    { id: 'w5', x: 36, y: 6, width: 28, height: 34, type: 'room', name: 'Design Studio' },
  ],
  furniture: [
    { id: 'f1', type: 'conference-table', x: 19, y: 23, label: 'Executive Board Table' },
    { id: 'f2', type: 'sofa', x: 14, y: 76, label: 'Lounge Sectional' },
    { id: 'f3', type: 'desk-cluster', x: 48, y: 23, label: 'Design Island' },
    { id: 'f4', type: 'desk-cluster', x: 78, y: 76, label: 'Engineering Workstations' },
    { id: 'f5', type: 'plant', x: 7, y: 92, label: 'Monstera' },
    { id: 'f6', type: 'plant', x: 93, y: 92, label: 'Ficus' },
  ],
  zones: [
    { id: 'z1', name: 'Executive Boardroom', tag: 'NORTH ROOM', x: 5, y: 6, width: 28, height: 34, audioMode: 'conference' },
    { id: 'z2', name: 'Focus Pods', tag: 'QUIET ZONE', x: 67, y: 6, width: 28, height: 34, audioMode: 'isolated' },
    { id: 'z3', name: 'Design Studio', tag: 'COLLAB', x: 36, y: 6, width: 28, height: 34, audioMode: 'open' },
    { id: 'z4', name: 'Atlas Lounge & Cafe', tag: 'LOUNGE', x: 5, y: 56, width: 38, height: 38, audioMode: 'ambient' },
    { id: 'z5', name: 'Engineering Lab', tag: 'DEV LAB', x: 46, y: 56, width: 49, height: 38, audioMode: 'open' },
  ]
};

// Load saved layout or fallback
let savedLayouts = {};
try {
  if (fs.existsSync(LAYOUT_FILE)) {
    savedLayouts = JSON.parse(fs.readFileSync(LAYOUT_FILE, 'utf-8'));
  }
} catch (err) {
  console.warn('Could not read saved layouts, using defaults', err);
}

// In-memory room state
// Map<roomId, { users: Map<userId, userObj>, sockets: Map<userId, WebSocket>, messages: [], layout: {} }>
const rooms = new Map();

function getOrCreateRoom(roomId = 'atlas-hq') {
  if (!rooms.has(roomId)) {
    const layout = savedLayouts[roomId] || JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    rooms.set(roomId, {
      id: roomId,
      name: roomId === 'atlas-hq' ? 'Atlas HQ · Main Floor' : `Office ${roomId}`,
      createdAt: Date.now(),
      users: new Map(),
      sockets: new Map(),
      messages: [
        {
          id: 'welcome-msg',
          senderId: 'system',
          senderName: 'ProxiSpeak Bot',
          senderInitials: 'PS',
          senderColor: 'green',
          text: 'Welcome to ProxiSpeak Spatial Office! Move closer to peers to talk in real-time WebRTC audio.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: true
        }
      ],
      layout,
      // Default virtual colleagues spread logically into their architectural zones
      bots: [
        { id: 'bot-nora', name: 'Nora Park', role: 'Marketing Lead', initials: 'NP', color: 'pink', x: 19.0, y: 23.0, status: 'In Meeting', isMuted: true, isSpeaking: false, level: 0, audioRange: 20, isBot: true },
        { id: 'bot-maya', name: 'Maya Chen', role: 'Lead Designer', initials: 'MC', color: 'violet', x: 48.0, y: 23.0, status: 'Available', isMuted: false, isSpeaking: false, level: 0, audioRange: 20, isBot: true },
        { id: 'bot-alex', name: 'Alex Kim', role: 'Operations', initials: 'AK', color: 'cyan', x: 80.0, y: 23.0, status: 'Focus Pod 2', isMuted: true, isSpeaking: false, level: 0, audioRange: 20, isBot: true },
        { id: 'bot-sam', name: 'Sam Rivera', role: 'Growth & BD', initials: 'SR', color: 'amber', x: 18.0, y: 78.0, status: 'Coffee Break', isMuted: false, isSpeaking: false, level: 0, audioRange: 20, isBot: true },
        { id: 'bot-theo', name: 'Theo Grant', role: 'Staff Engineer', initials: 'TG', color: 'blue', x: 78.0, y: 76.0, status: 'Coding', isMuted: false, isSpeaking: false, level: 0, audioRange: 20, isBot: true },
      ]
    });
  }
  return rooms.get(roomId);
}

// Ensure default room exists
getOrCreateRoom('atlas-hq');

const app = express();
app.use(cors());
app.use(express.json());

// REST API Endpoints
app.get('/api/health', (req, res) => {
  let totalPeers = 0;
  rooms.forEach(room => totalPeers += room.users.size);
  res.json({
    status: 'online',
    version: '1.2.0',
    service: 'ProxiSpeak WebRTC Signaling & Spatial Audio Backend',
    uptimeSeconds: Math.floor(process.uptime()),
    activeRooms: rooms.size,
    totalConnectedPeers: totalPeers,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    userCount: r.users.size,
    botCount: r.bots.length,
    activeMessages: r.messages.length
  }));
  res.json(roomList);
});

app.get('/api/rooms/:roomId/state', (req, res) => {
  const room = getOrCreateRoom(req.params.roomId);
  const realUsers = Array.from(room.users.values());
  res.json({
    roomId: room.id,
    name: room.name,
    users: [...realUsers, ...room.bots],
    layout: room.layout,
    messages: room.messages.slice(-50)
  });
});

app.get('/api/rooms/:roomId/layout', (req, res) => {
  const room = getOrCreateRoom(req.params.roomId);
  res.json(room.layout);
});

app.post('/api/rooms/:roomId/layout', (req, res) => {
  const room = getOrCreateRoom(req.params.roomId);
  const newLayout = req.body;
  
  if (!newLayout || typeof newLayout !== 'object') {
    return res.status(400).json({ error: 'Invalid layout payload' });
  }

  room.layout = newLayout;
  savedLayouts[room.id] = newLayout;

  try {
    fs.writeFileSync(LAYOUT_FILE, JSON.stringify(savedLayouts, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist layout to disk:', err);
  }

  // Broadcast layout update to room
  broadcastToRoom(room.id, {
    type: 'layout-updated',
    layout: newLayout,
    updatedAt: Date.now()
  });

  res.json({ success: true, message: 'Layout successfully saved and broadcasted' });
});

app.post('/api/rooms/:roomId/layout/reset', (req, res) => {
  const room = getOrCreateRoom(req.params.roomId);
  room.layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  delete savedLayouts[room.id];
  try {
    fs.writeFileSync(LAYOUT_FILE, JSON.stringify(savedLayouts, null, 2), 'utf-8');
  } catch (e) { /* ignore */ }

  broadcastToRoom(room.id, {
    type: 'layout-updated',
    layout: room.layout,
    updatedAt: Date.now()
  });

  res.json({ success: true, layout: room.layout });
});

// Setup HTTP & WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastToRoom(roomId, message, excludeUserId = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(message);

  room.sockets.forEach((ws, userId) => {
    if (userId !== excludeUserId && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

function sendToUser(roomId, targetUserId, message) {
  const room = rooms.get(roomId);
  if (!room) return false;
  const ws = room.sockets.get(targetUserId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}

wss.on('connection', (ws, req) => {
  let currentRoomId = 'atlas-hq';
  let currentUserId = null;

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const rParam = url.searchParams.get('roomId');
    if (rParam) currentRoomId = rParam;
  } catch (e) {
    // fallback
  }

  ws.on('message', (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString());
      const room = getOrCreateRoom(currentRoomId);

      switch (msg.type) {
        case 'join-room': {
          currentRoomId = msg.roomId || currentRoomId;
          const userRoom = getOrCreateRoom(currentRoomId);
          currentUserId = msg.user.id;

          const userData = {
            id: currentUserId,
            name: msg.user.name || 'Anonymous',
            role: msg.user.role || 'Member',
            initials: msg.user.initials || 'ME',
            color: msg.user.color || 'green',
            x: typeof msg.user.x === 'number' ? msg.user.x : 50.6,
            y: typeof msg.user.y === 'number' ? msg.user.y : 49.2,
            status: msg.user.status || 'Available',
            isMuted: !!msg.user.isMuted,
            isDeafened: !!msg.user.isDeafened,
            isSpeaking: false,
            audioRange: msg.user.audioRange || 22,
            joinedAt: Date.now()
          };

          userRoom.users.set(currentUserId, userData);
          userRoom.sockets.set(currentUserId, ws);

          // 1. Reply to joining user with full room state
          const otherRealUsers = Array.from(userRoom.users.values()).filter(u => u.id !== currentUserId);
          ws.send(JSON.stringify({
            type: 'room-joined',
            roomId: currentRoomId,
            userId: currentUserId,
            user: userData,
            peers: [...otherRealUsers, ...userRoom.bots],
            layout: userRoom.layout,
            messages: userRoom.messages.slice(-30)
          }));

          // 2. Announce new peer to other connected clients
          broadcastToRoom(currentRoomId, {
            type: 'peer-joined',
            peer: userData
          }, currentUserId);

          console.log(`[WebRTC] User joined room ${currentRoomId}: ${userData.name} (${currentUserId})`);
          break;
        }

        case 'user-moved': {
          if (!currentUserId) return;
          const userRoom = rooms.get(currentRoomId);
          if (!userRoom) return;

          const user = userRoom.users.get(currentUserId);
          if (user) {
            user.x = Math.max(2, Math.min(98, msg.x));
            user.y = Math.max(2, Math.min(98, msg.y));

            broadcastToRoom(currentRoomId, {
              type: 'peer-moved',
              peerId: currentUserId,
              x: user.x,
              y: user.y
            }, currentUserId);
          }
          break;
        }

        case 'user-state': {
          if (!currentUserId) return;
          const userRoom = rooms.get(currentRoomId);
          if (!userRoom) return;

          const user = userRoom.users.get(currentUserId);
          if (user) {
            if (msg.isMuted !== undefined) user.isMuted = !!msg.isMuted;
            if (msg.isDeafened !== undefined) user.isDeafened = !!msg.isDeafened;
            if (msg.isSpeaking !== undefined) user.isSpeaking = !!msg.isSpeaking;
            if (msg.status !== undefined) user.status = msg.status;
            if (msg.audioRange !== undefined) user.audioRange = msg.audioRange;
            if (msg.level !== undefined) user.level = msg.level;

            broadcastToRoom(currentRoomId, {
              type: 'peer-state',
              peerId: currentUserId,
              state: {
                isMuted: user.isMuted,
                isDeafened: user.isDeafened,
                isSpeaking: user.isSpeaking,
                status: user.status,
                audioRange: user.audioRange,
                level: user.level
              }
            }, currentUserId);
          }
          break;
        }

        case 'chat-message': {
          if (!currentUserId) return;
          const userRoom = rooms.get(currentRoomId);
          if (!userRoom) return;
          const user = userRoom.users.get(currentUserId);
          if (!user) return;

          const chatItem = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            senderId: currentUserId,
            senderName: user.name,
            senderInitials: user.initials,
            senderColor: user.color,
            text: String(msg.text || '').trim().slice(0, 300),
            isWhisper: !!msg.isWhisper,
            targetId: msg.targetId || null,
            x: user.x,
            y: user.y,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          userRoom.messages.push(chatItem);
          if (userRoom.messages.length > 100) userRoom.messages.shift();

          if (chatItem.isWhisper && chatItem.targetId) {
            // Whisper to specific target + self
            sendToUser(currentRoomId, chatItem.targetId, {
              type: 'chat-message',
              message: chatItem
            });
            ws.send(JSON.stringify({
              type: 'chat-message',
              message: chatItem
            }));
          } else {
            // Broadcast to room
            broadcastToRoom(currentRoomId, {
              type: 'chat-message',
              message: chatItem
            });
          }
          break;
        }

        // WebRTC Signaling: Offer, Answer, ICE Candidate exchange
        case 'rtc-offer': {
          if (!currentUserId || !msg.toUserId) return;
          sendToUser(currentRoomId, msg.toUserId, {
            type: 'rtc-offer',
            fromUserId: currentUserId,
            offer: msg.offer
          });
          break;
        }

        case 'rtc-answer': {
          if (!currentUserId || !msg.toUserId) return;
          sendToUser(currentRoomId, msg.toUserId, {
            type: 'rtc-answer',
            fromUserId: currentUserId,
            answer: msg.answer
          });
          break;
        }

        case 'rtc-ice': {
          if (!currentUserId || !msg.toUserId) return;
          sendToUser(currentRoomId, msg.toUserId, {
            type: 'rtc-ice',
            fromUserId: currentUserId,
            candidate: msg.candidate
          });
          break;
        }

        case 'screen-share': {
          if (!currentUserId) return;
          broadcastToRoom(currentRoomId, {
            type: 'peer-screen-share',
            peerId: currentUserId,
            isSharing: !!msg.isSharing
          }, currentUserId);
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('[WebRTC Server] Error handling socket message:', err);
    }
  });

  ws.on('close', () => {
    if (currentUserId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.users.delete(currentUserId);
        room.sockets.delete(currentUserId);

        broadcastToRoom(currentRoomId, {
          type: 'peer-left',
          peerId: currentUserId
        });

        console.log(`[WebRTC] User left room ${currentRoomId}: ${currentUserId}`);
      }
    }
  });

  ws.on('error', (err) => {
    console.warn('[WebRTC Server] Socket error:', err.message);
  });
});

// Periodic simulated audio pulse and subtle presence for virtual colleagues
setInterval(() => {
  rooms.forEach((room) => {
    if (room.users.size > 0) {
      // Natural speech cadence: occasionally Maya or Theo speaks
      const maya = room.bots.find(b => b.id === 'bot-maya');
      const theo = room.bots.find(b => b.id === 'bot-theo');

      if (maya) {
        // Natural 25% conversational speaking chance
        const wasSpeaking = maya.isSpeaking;
        maya.isSpeaking = Math.random() < 0.28;
        maya.level = maya.isSpeaking ? Math.floor(Math.random() * 4) + 1 : 0;

        if (wasSpeaking !== maya.isSpeaking) {
          broadcastToRoom(room.id, {
            type: 'peer-state',
            peerId: maya.id,
            state: {
              isSpeaking: maya.isSpeaking,
              level: maya.level
            }
          });
        }
      }

      if (theo && Math.random() < 0.15) {
        const wasSpeaking = theo.isSpeaking;
        theo.isSpeaking = Math.random() < 0.2;
        theo.level = theo.isSpeaking ? Math.floor(Math.random() * 3) + 1 : 0;

        if (wasSpeaking !== theo.isSpeaking) {
          broadcastToRoom(room.id, {
            type: 'peer-state',
            peerId: theo.id,
            state: {
              isSpeaking: theo.isSpeaking,
              level: theo.level
            }
          });
        }
      }
    }
  });
}, 3500);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 ProxiSpeak Backend Server running on port ${PORT}`);
  console.log(`📡 WebSocket Signaling available at /ws`);
  console.log(`🌐 REST API available at /api/health & /api/rooms`);
  console.log(`===============================================`);
});

