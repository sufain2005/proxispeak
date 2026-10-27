import { spatialAudio, type LayoutWall } from './spatialAudio';

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  x: number;
  y: number;
  status: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  audioRange: number; // radius in % of map
  level?: number;
  isBot?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  senderColor: string;
  text: string;
  isWhisper?: boolean;
  targetId?: string | null;
  x?: number;
  y?: number;
  timestamp: string;
  isSystem?: boolean;
}

export interface RoomLayout {
  walls: LayoutWall[];
  furniture: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;
    label?: string;
    count?: number;
  }>;
  zones: Array<{
    id: string;
    name: string;
    tag: string;
    x: number;
    y: number;
    width: number;
    height: number;
    audioMode: string;
  }>;
}

export type ConnectionState = 'connecting' | 'connected' | 'mesh' | 'disconnected' | 'error';

export type WebRTCEventMap = {
  roomJoined: (data: { roomId: string; user: UserProfile; peers: UserProfile[]; layout: RoomLayout; messages: ChatMessage[] }) => void;
  peerJoined: (peer: UserProfile) => void;
  peerLeft: (peerId: string) => void;
  peerMoved: (data: { peerId: string; x: number; y: number }) => void;
  peerState: (data: { peerId: string; state: Partial<UserProfile> }) => void;
  chatMessage: (msg: ChatMessage) => void;
  layoutUpdated: (layout: RoomLayout) => void;
  localMicLevel: (data: { level: number; isSpeaking: boolean }) => void;
  connectionStatus: (status: ConnectionState) => void;
  screenShareChanged: (data: { peerId: string; isSharing: boolean; stream?: MediaStream }) => void;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

class WebRTCManager {
  private socket: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

  private roomId: string = 'atlas-hq';
  public currentUser: UserProfile = {
    id: `usr-${Math.random().toString(36).substring(2, 8)}`,
    name: 'You',
    role: 'Product Lead',
    initials: 'YA',
    color: 'green',
    x: 50.0,
    y: 52.0,
    status: 'Available',
    isMuted: false,
    isDeafened: false,
    isSpeaking: false,
    audioRange: 20, // Default Proximity range (20%)
  };

  private listeners: { [K in keyof WebRTCEventMap]?: WebRTCEventMap[K][] } = {};
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectAttempts = 0;
  private isStandaloneMesh = false;

  constructor() {
    // Cross-tab broadcast channel for instant multi-tab communication
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('proxispeak-spatial-channel');
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingSignal(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported:', e);
      }
    }
  }

  public on<K extends keyof WebRTCEventMap>(event: K, fn: WebRTCEventMap[K]) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(fn);
  }

  public off<K extends keyof WebRTCEventMap>(event: K, fn: WebRTCEventMap[K]) {
    if (this.listeners[event]) {
      this.listeners[event] = (this.listeners[event] as WebRTCEventMap[K][]).filter((f) => f !== fn) as any;
    }
  }

  private emit<K extends keyof WebRTCEventMap>(event: K, ...args: Parameters<WebRTCEventMap[K]>) {
    const handlers = this.listeners[event];
    if (handlers) {
      handlers.forEach((fn) => (fn as any)(...args));
    }
  }

  // Force a manual reconnect check
  public forceReconnect(roomId: string = 'atlas-hq') {
    this.isStandaloneMesh = false;
    this.connectAttempts = 0;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.connect(roomId);
  }

  // Connect to backend WebSocket signaling with smart fallback to local mesh
  public connect(roomId: string = 'atlas-hq', userProfile?: Partial<UserProfile>) {
    this.roomId = roomId;
    if (userProfile) {
      this.currentUser = { ...this.currentUser, ...userProfile };
    }

    // Determine target URL: try direct port 3001 first if local, otherwise relative /ws
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const wsProto = isHttps ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8443';

    // Direct port 3001 avoids Vite proxy issues on local machines
    const primaryUrl = isLocal ? `ws://localhost:3001/ws?roomId=${roomId}&userId=${this.currentUser.id}` : `${wsProto}//${host}/ws?roomId=${roomId}&userId=${this.currentUser.id}`;
    const fallbackUrl = `${wsProto}//${host}/ws?roomId=${roomId}&userId=${this.currentUser.id}`;
    const targetUrl = this.connectAttempts % 2 === 0 ? primaryUrl : fallbackUrl;

    // If already running in stable Local Mesh, check HTTP health first before opening WebSocket
    if (this.isStandaloneMesh) {
      fetch('/api/health')
        .then((res) => {
          if (res.ok) {
            this.isStandaloneMesh = false;
            this.initiateWebSocket(primaryUrl);
          }
        })
        .catch(() => {
          // Still in local mesh, check again later silently
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.connect(this.roomId), 30000);
        });
      return;
    }

    this.emit('connectionStatus', 'connecting');
    this.initiateWebSocket(targetUrl);
  }

  private initiateWebSocket(targetUrl: string) {
    try {
      if (this.socket) {
        this.socket.onopen = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.close();
        this.socket = null;
      }

      const ws = new WebSocket(targetUrl);
      this.socket = ws;

      // Timeout connection attempt to prevent infinite hanging
      const connectTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          try { ws.close(); } catch (e) {}
          this.handleConnectionFailure();
        }
      }, 3500);

      ws.onopen = () => {
        clearTimeout(connectTimeout);
        this.connectAttempts = 0;
        this.isStandaloneMesh = false;
        this.emit('connectionStatus', 'connected');

        this.sendSignal({
          type: 'join-room',
          roomId: this.roomId,
          user: this.currentUser,
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingSignal(data);
        } catch (err) {
          console.warn('Error parsing incoming WS message:', err);
        }
      };

      ws.onclose = () => {
        clearTimeout(connectTimeout);
        this.handleConnectionFailure();
      };

      ws.onerror = () => {
        clearTimeout(connectTimeout);
        this.handleConnectionFailure();
      };
    } catch (err) {
      this.handleConnectionFailure();
    }
  }

  // Gracefully transition to Standalone Local Mesh mode instead of looping
  private handleConnectionFailure() {
    this.connectAttempts++;

    // Gracefully switch to Standalone Mesh mode without jittering the UI
    if (!this.isStandaloneMesh) {
      this.isStandaloneMesh = true;
      this.emit('connectionStatus', 'mesh');
      console.log('[WebRTC] Active in Local Mesh mode (BroadcastChannel P2P)');

      // Announce self across tabs
      this.sendSignal({
        type: 'peer-joined',
        peer: this.currentUser,
      });
    }

    // Schedule background retry calmly every 30 seconds (never spams the UI)
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.roomId);
    }, 30000);
  }

  private sendSignal(msg: any) {
    let sent = false;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(msg));
        sent = true;
      } catch (e) {}
    }
    // Also broadcast cross-tab so multiple tabs talk with 100% reliability
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch (e) {}
    }
    return sent;
  }

  // Handle incoming signaling messages
  private async handleIncomingSignal(msg: any) {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'room-joined': {
        this.emit('roomJoined', {
          roomId: msg.roomId,
          user: msg.user,
          peers: msg.peers || [],
          layout: msg.layout,
          messages: msg.messages || [],
        });
        spatialAudio.playChime('join');
        break;
      }

      case 'peer-joined': {
        if (msg.peer && msg.peer.id !== this.currentUser.id) {
          this.emit('peerJoined', msg.peer);
          if (!msg.peer.isBot) {
            this.initiatePeerConnection(msg.peer.id, true);
          }
        }
        break;
      }

      case 'peer-left': {
        if (msg.peerId) {
          this.closePeerConnection(msg.peerId);
          spatialAudio.detachPeerStream(msg.peerId);
          this.emit('peerLeft', msg.peerId);
        }
        break;
      }

      case 'peer-moved': {
        if (msg.peerId && msg.peerId !== this.currentUser.id) {
          this.emit('peerMoved', { peerId: msg.peerId, x: msg.x, y: msg.y });
        }
        break;
      }

      case 'peer-state': {
        if (msg.peerId && msg.peerId !== this.currentUser.id) {
          this.emit('peerState', { peerId: msg.peerId, state: msg.state });
        }
        break;
      }

      case 'chat-message': {
        if (msg.message) {
          this.emit('chatMessage', msg.message);
          spatialAudio.playChime('whisper');
        }
        break;
      }

      case 'layout-updated': {
        if (msg.layout) {
          this.emit('layoutUpdated', msg.layout);
        }
        break;
      }

      case 'peer-screen-share': {
        if (msg.peerId && msg.peerId !== this.currentUser.id) {
          this.emit('screenShareChanged', { peerId: msg.peerId, isSharing: msg.isSharing });
        }
        break;
      }

      case 'rtc-offer': {
        if (msg.toUserId === this.currentUser.id || !msg.toUserId) {
          await this.handleOffer(msg.fromUserId, msg.offer);
        }
        break;
      }

      case 'rtc-answer': {
        if (msg.toUserId === this.currentUser.id || !msg.toUserId) {
          await this.handleAnswer(msg.fromUserId, msg.answer);
        }
        break;
      }

      case 'rtc-ice': {
        if (msg.toUserId === this.currentUser.id || !msg.toUserId) {
          await this.handleIceCandidate(msg.fromUserId, msg.candidate);
        }
        break;
      }

      default:
        break;
    }
  }

  // Request real microphone access and configure AudioContext visualizer
  public async startMicrophone(deviceId?: string): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;

      spatialAudio.setupLocalStream(stream, (level, isSpeaking) => {
        const speakingChanged = isSpeaking !== this.currentUser.isSpeaking;
        this.currentUser.isSpeaking = isSpeaking;
        this.currentUser.level = Math.ceil(level / 20);

        this.emit('localMicLevel', { level, isSpeaking });

        if (speakingChanged) {
          this.sendSignal({
            type: 'user-state',
            isSpeaking,
            level: this.currentUser.level,
          });
        }
      });

      this.peerConnections.forEach((pc) => {
        stream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      });

      return stream;
    } catch (err) {
      console.error('Failed to get user media (microphone):', err);
      throw err;
    }
  }

  public setMuted(muted: boolean) {
    this.currentUser.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
    }
    spatialAudio.playChime(muted ? 'mute' : 'unmute');
    this.sendSignal({
      type: 'user-state',
      isMuted: muted,
    });
  }

  public setDeafened(deafened: boolean) {
    this.currentUser.isDeafened = deafened;
    spatialAudio.setDeafened(deafened);
    spatialAudio.playChime(deafened ? 'mute' : 'unmute');
    this.sendSignal({
      type: 'user-state',
      isDeafened: deafened,
    });
  }

  public setAudioRange(radius: number) {
    this.currentUser.audioRange = radius;
    this.sendSignal({
      type: 'user-state',
      audioRange: radius,
    });
  }

  public move(x: number, y: number) {
    this.currentUser.x = Math.max(2, Math.min(98, x));
    this.currentUser.y = Math.max(2, Math.min(98, y));

    this.sendSignal({
      type: 'user-moved',
      x: this.currentUser.x,
      y: this.currentUser.y,
    });
  }

  public sendChatMessage(text: string, isWhisper = false, targetId?: string) {
    if (!text.trim()) return;
    this.sendSignal({
      type: 'chat-message',
      text,
      isWhisper,
      targetId,
    });
  }

  public async startScreenShare(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      this.screenStream = stream;

      const videoTrack = stream.getVideoTracks()[0];
      this.peerConnections.forEach((pc) => {
        pc.addTrack(videoTrack, stream);
      });

      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      this.sendSignal({
        type: 'screen-share',
        isSharing: true,
      });

      this.emit('screenShareChanged', {
        peerId: this.currentUser.id,
        isSharing: true,
        stream,
      });

      return stream;
    } catch (err) {
      console.warn('Screen share canceled or failed:', err);
      throw err;
    }
  }

  public stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    this.sendSignal({
      type: 'screen-share',
      isSharing: false,
    });
    this.emit('screenShareChanged', {
      peerId: this.currentUser.id,
      isSharing: false,
    });
  }

  private getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(peerId);
    if (!pc) {
      pc = new RTCPeerConnection(ICE_SERVERS);

      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          pc!.addTrack(track, this.localStream!);
        });
      }

      if (this.screenStream) {
        this.screenStream.getVideoTracks().forEach((track) => {
          pc!.addTrack(track, this.screenStream!);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal({
            type: 'rtc-ice',
            toUserId: peerId,
            fromUserId: this.currentUser.id,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        if (event.track.kind === 'audio') {
          spatialAudio.attachPeerStream(peerId, stream);
        } else if (event.track.kind === 'video') {
          this.emit('screenShareChanged', { peerId, isSharing: true, stream });
        }
      };

      this.peerConnections.set(peerId, pc);
    }
    return pc;
  }

  public async initiatePeerConnection(peerId: string, isInitiator = false) {
    if (!isInitiator) return;
    const pc = this.getOrCreatePeerConnection(peerId);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      this.sendSignal({
        type: 'rtc-offer',
        toUserId: peerId,
        fromUserId: this.currentUser.id,
        offer,
      });
    } catch (err) {
      console.warn(`Failed to create offer for peer ${peerId}:`, err);
    }
  }

  private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit) {
    const pc = this.getOrCreatePeerConnection(peerId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const queued = this.pendingCandidates.get(peerId);
      if (queued && queued.length > 0) {
        for (const candidate of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        this.pendingCandidates.delete(peerId);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.sendSignal({
        type: 'rtc-answer',
        toUserId: peerId,
        fromUserId: this.currentUser.id,
        answer,
      });
    } catch (err) {
      console.warn(`Failed to handle offer from ${peerId}:`, err);
    }
  }

  private async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        const queued = this.pendingCandidates.get(peerId);
        if (queued && queued.length > 0) {
          for (const candidate of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          this.pendingCandidates.delete(peerId);
        }
      } catch (err) {
        console.warn(`Failed to set remote answer from ${peerId}:`, err);
      }
    }
  }

  private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    const pc = this.peerConnections.get(peerId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(`Failed to add ICE candidate from ${peerId}:`, err);
      }
    } else {
      if (!this.pendingCandidates.has(peerId)) {
        this.pendingCandidates.set(peerId, []);
      }
      this.pendingCandidates.get(peerId)!.push(candidate);
    }
  }

  private closePeerConnection(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      this.peerConnections.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    spatialAudio.dispose();
  }
}

export const webrtcService = new WebRTCManager();
