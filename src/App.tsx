import React, { useState, useEffect, useCallback } from 'react';
import OfficeMap from './components/OfficeMap';
import SidebarDirectory from './components/SidebarDirectory';
import ControlDock from './components/ControlDock';
import AudioSettingsModal from './components/AudioSettingsModal';
import LayoutEditorModal from './components/LayoutEditorModal';
import ScreenShareModal from './components/ScreenShareModal';
import { Icon } from './components/Icons';
import { webrtcService, type UserProfile, type RoomLayout, type ChatMessage, type ConnectionState } from './services/webrtcService';

const DEFAULT_LAYOUT: RoomLayout = {
  walls: [
    { id: 'w1', x: 5, y: 6, width: 28, height: 34, type: 'room' },
    { id: 'w2', x: 67, y: 6, width: 28, height: 34, type: 'room' },
    { id: 'w3', x: 5, y: 56, width: 38, height: 38, type: 'room' },
    { id: 'w4', x: 46, y: 56, width: 49, height: 38, type: 'room' },
    { id: 'w5', x: 36, y: 6, width: 28, height: 34, type: 'room' },
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
  ],
};

const DEFAULT_COLLEAGUES: UserProfile[] = [
  { id: 'bot-nora', name: 'Nora Park', role: 'Marketing Lead', initials: 'NP', color: 'pink', x: 19.0, y: 23.0, status: 'In Meeting', isMuted: true, isSpeaking: false, audioRange: 20, isBot: true },
  { id: 'bot-maya', name: 'Maya Chen', role: 'Lead Designer', initials: 'MC', color: 'violet', x: 48.0, y: 23.0, status: 'Available', isMuted: false, isSpeaking: false, audioRange: 20, isBot: true },
  { id: 'bot-alex', name: 'Alex Kim', role: 'Operations', initials: 'AK', color: 'cyan', x: 80.0, y: 23.0, status: 'Focus Pod 2', isMuted: true, isSpeaking: false, audioRange: 20, isBot: true },
  { id: 'bot-sam', name: 'Sam Rivera', role: 'Growth & BD', initials: 'SR', color: 'amber', x: 18.0, y: 78.0, status: 'Coffee Break', isMuted: false, isSpeaking: false, audioRange: 20, isBot: true },
  { id: 'bot-theo', name: 'Theo Grant', role: 'Staff Engineer', initials: 'TG', color: 'blue', x: 78.0, y: 76.0, status: 'Coding', isMuted: false, isSpeaking: false, audioRange: 20, isBot: true },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(webrtcService.currentUser);
  const [peers, setPeers] = useState<UserProfile[]>(DEFAULT_COLLEAGUES);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [layout, setLayout] = useState<RoomLayout>(DEFAULT_LAYOUT);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>('connecting');
  const [micLevel, setMicLevel] = useState<number>(0);
  const [miniMapOpen, setMiniMapOpen] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [screenShareOpen, setScreenShareOpen] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [presenterName, setPresenterName] = useState('You');
  const [toast, setToast] = useState<string | null>(null);
  const [includeBots, setIncludeBots] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Global Quick Hotkeys (M = Toggle Mic)
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleMute();
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [currentUser.isMuted, micLevel]);

  // WebRTC & Backend WebSocket connection lifecycle
  useEffect(() => {
    webrtcService.connect('atlas-hq');

    const handleRoomJoined = (data: { roomId: string; user: UserProfile; peers: UserProfile[]; layout: RoomLayout; messages: ChatMessage[] }) => {
      setCurrentUser(data.user);
      if (data.peers && data.peers.length > 0) {
        setPeers(data.peers);
      }
      if (data.layout) setLayout(data.layout);
      if (data.messages) setMessages(data.messages);
      showToast('Connected to Atlas HQ Floor');
    };

    const handlePeerJoined = (peer: UserProfile) => {
      setPeers((prev) => {
        if (prev.some((p) => p.id === peer.id)) return prev;
        return [...prev, peer];
      });
      showToast(`${peer.name} entered the office`);
    };

    const handlePeerLeft = (peerId: string) => {
      setPeers((prev) => prev.filter((p) => p.id !== peerId));
    };

    const handlePeerMoved = (data: { peerId: string; x: number; y: number }) => {
      setPeers((prev) =>
        prev.map((p) => (p.id === data.peerId ? { ...p, x: data.x, y: data.y } : p))
      );
    };

    const handlePeerState = (data: { peerId: string; state: Partial<UserProfile> }) => {
      setPeers((prev) =>
        prev.map((p) => (p.id === data.peerId ? { ...p, ...data.state } : p))
      );
    };

    const handleChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleLayoutUpdated = (newLayout: RoomLayout) => {
      setLayout(newLayout);
      showToast('Office layout updated');
    };

    const handleLocalMicLevel = (data: { level: number; isSpeaking: boolean }) => {
      setMicLevel(data.level);
      setCurrentUser((prev) => ({
        ...prev,
        isSpeaking: data.isSpeaking,
        level: Math.ceil(data.level / 20),
      }));
    };

    const handleConnectionStatus = (status: ConnectionState) => {
      setConnectionStatus(status);
    };

    const handleScreenShareChanged = (data: { peerId: string; isSharing: boolean; stream?: MediaStream }) => {
      if (data.isSharing) {
        setScreenStream(data.stream || null);
        setPresenterName(data.peerId === currentUser.id ? 'You' : peers.find((p) => p.id === data.peerId)?.name || 'Colleague');
        setScreenShareOpen(true);
        showToast('Screen share broadcast in Boardroom');
      } else {
        setScreenShareOpen(false);
        setScreenStream(null);
      }
    };

    webrtcService.on('roomJoined', handleRoomJoined);
    webrtcService.on('peerJoined', handlePeerJoined);
    webrtcService.on('peerLeft', handlePeerLeft);
    webrtcService.on('peerMoved', handlePeerMoved);
    webrtcService.on('peerState', handlePeerState);
    webrtcService.on('chatMessage', handleChatMessage);
    webrtcService.on('layoutUpdated', handleLayoutUpdated);
    webrtcService.on('localMicLevel', handleLocalMicLevel);
    webrtcService.on('connectionStatus', handleConnectionStatus);
    webrtcService.on('screenShareChanged', handleScreenShareChanged);

    // Initial fetch of office layout from REST API
    fetch('/api/rooms/atlas-hq/layout')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.walls) setLayout(data);
      })
      .catch(() => {});

    return () => {
      webrtcService.off('roomJoined', handleRoomJoined);
      webrtcService.off('peerJoined', handlePeerJoined);
      webrtcService.off('peerLeft', handlePeerLeft);
      webrtcService.off('peerMoved', handlePeerMoved);
      webrtcService.off('peerState', handlePeerState);
      webrtcService.off('chatMessage', handleChatMessage);
      webrtcService.off('layoutUpdated', handleLayoutUpdated);
      webrtcService.off('localMicLevel', handleLocalMicLevel);
      webrtcService.off('connectionStatus', handleConnectionStatus);
      webrtcService.off('screenShareChanged', handleScreenShareChanged);
      webrtcService.disconnect();
    };
  }, [showToast, currentUser.id, peers]);

  // Toggle Microphone
  const handleToggleMute = async () => {
    try {
      if (!currentUser.isMuted && micLevel === 0) {
        await webrtcService.startMicrophone();
      }
      const nextMuted = !currentUser.isMuted;
      webrtcService.setMuted(nextMuted);
      setCurrentUser((prev) => ({ ...prev, isMuted: nextMuted }));
      showToast(nextMuted ? 'Microphone Muted' : 'Microphone Live');
    } catch (err) {
      showToast('Microphone access required for voice');
    }
  };

  // Toggle Deafen
  const handleToggleDeafen = () => {
    const nextDeafened = !currentUser.isDeafened;
    webrtcService.setDeafened(nextDeafened);
    setCurrentUser((prev) => ({ ...prev, isDeafened: nextDeafened }));
    showToast(nextDeafened ? 'Audio Deafened' : 'Audio Active');
  };

  // Move avatar on floor plan
  const handleMove = (x: number, y: number) => {
    webrtcService.move(x, y);
    setCurrentUser((prev) => ({ ...prev, x, y }));
  };

  // Change Audio Hearing Range
  const handleChangeAudioRange = (range: number) => {
    webrtcService.setAudioRange(range);
    setCurrentUser((prev) => ({ ...prev, audioRange: range }));
    const label = range <= 14 ? 'Whisper Mode (12m)' : range >= 70 ? 'Townhall Mode (Entire Office)' : 'Proximity Mode (20m)';
    showToast(`Voice radius: ${label}`);
  };

  // Toggle Screen Sharing
  const handleToggleScreenShare = async () => {
    if (screenShareOpen) {
      webrtcService.stopScreenShare();
      setScreenShareOpen(false);
      setScreenStream(null);
    } else {
      try {
        const stream = await webrtcService.startScreenShare();
        setScreenStream(stream);
        setPresenterName('You');
        setScreenShareOpen(true);
      } catch (err) {
        showToast('Screen sharing canceled');
      }
    }
  };

  // Send spatial chat message
  const handleSendMessage = (text: string, isWhisper = false, targetId?: string) => {
    webrtcService.sendChatMessage(text, isWhisper, targetId);
  };

  // Save Layout to Database via REST API
  const handleSaveLayout = async (newLayout: RoomLayout) => {
    setLayout(newLayout);
    const res = await fetch('/api/rooms/atlas-hq/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLayout),
    });
    if (!res.ok) throw new Error('Failed to save layout');
    showToast('Layout successfully saved to database');
  };

  // Reset Layout to Default via REST API
  const handleResetLayout = async () => {
    const res = await fetch('/api/rooms/atlas-hq/layout/reset', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setLayout(data.layout || DEFAULT_LAYOUT);
      showToast('Layout reset to default');
    }
  };

  // Manual Reconnect Handler
  const handleManualReconnect = () => {
    showToast('Checking WebRTC server connection...');
    webrtcService.forceReconnect();
  };

  // Change Status
  const handleStatusChange = (status: string) => {
    setCurrentUser((prev) => ({ ...prev, status }));
    webrtcService.currentUser.status = status;
    showToast(`Status updated: ${status}`);
  };

  // Filter peers if bots toggled
  const activePeers = includeBots ? peers : peers.filter((p) => !p.isBot);

  return (
    <main className="app-shell">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-notice" role="alert" aria-live="polite">
          <Icon name="check" size={14} />
          <span>{toast}</span>
        </div>
      )}

      {/* Main Floor Plan Workspace */}
      <section className="workspace">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <span style={{ height: micLevel > 15 ? `${Math.min(22, 9 + micLevel / 6)}px` : undefined }} />
              <span style={{ height: micLevel > 15 ? `${Math.min(26, 16 + micLevel / 5)}px` : undefined }} />
              <span style={{ height: micLevel > 15 ? `${Math.min(20, 11 + micLevel / 7)}px` : undefined }} />
            </div>
            <div className="brand-info">
              <strong>ProxiSpeak</strong>
              <small>Atlas HQ · Spatial Architecture</small>
            </div>
          </div>

          <div className="topbar-actions">
            {/* Stable fixed-width connection indicator: No shrinking or jumping */}
            <button
              type="button"
              className={`connection-pill ${
                connectionStatus === 'connected'
                  ? 'connected'
                  : connectionStatus === 'mesh'
                  ? 'mesh'
                  : connectionStatus === 'connecting'
                  ? 'connecting'
                  : 'disconnected'
              }`}
              onClick={handleManualReconnect}
              title={
                connectionStatus === 'connected'
                  ? 'WebRTC Server Online (Port 3001) · Click to test'
                  : connectionStatus === 'mesh'
                  ? 'Local Mesh P2P Active · Click to check for server'
                  : connectionStatus === 'connecting'
                  ? 'Connecting to WebRTC server...'
                  : 'Signaling Server Offline · Click to reconnect'
              }
            >
              <i
                className={
                  connectionStatus === 'connected'
                    ? 'green-dot'
                    : connectionStatus === 'mesh'
                    ? 'blue-dot'
                    : connectionStatus === 'connecting'
                    ? 'amber-dot'
                    : 'red-dot'
                }
              />
              <span>
                {connectionStatus === 'connected'
                  ? 'WebRTC Live'
                  : connectionStatus === 'mesh'
                  ? 'Local Mesh'
                  : connectionStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Offline'}
              </span>
            </button>

            <button
              type="button"
              className={`bot-toggle-btn ${includeBots ? 'active' : ''}`}
              onClick={() => {
                setIncludeBots(!includeBots);
                showToast(includeBots ? 'Colleague bots hidden' : 'Colleague bots active');
              }}
              title="Toggle simulated colleagues presence"
            >
              <Icon name="spark" size={13} />
              <span>{includeBots ? 'Bots On' : 'Bots Off'}</span>
            </button>
          </div>

          <div className="topbar-meta">
            <span className="live-dot" />
            <span>{activePeers.length + 1} online</span>
            <span className="divider" />
            <span>{currentTime || 'Tue, 10:42 AM'}</span>
          </div>
        </header>

        {/* Interactive Floor Plan Map */}
        <OfficeMap
          user={currentUser}
          peers={activePeers}
          layout={layout}
          onMove={handleMove}
          miniMapOpen={miniMapOpen}
          recentMessages={messages}
          micLevel={micLevel}
        />

        {/* Bottom Control Dock */}
        <ControlDock
          isMuted={currentUser.isMuted}
          onToggleMute={handleToggleMute}
          isDeafened={currentUser.isDeafened}
          onToggleDeafen={handleToggleDeafen}
          isSharingScreen={screenShareOpen}
          onToggleScreenShare={handleToggleScreenShare}
          audioRange={currentUser.audioRange}
          onChangeAudioRange={handleChangeAudioRange}
          miniMapOpen={miniMapOpen}
          onToggleMiniMap={() => setMiniMapOpen(!miniMapOpen)}
          onOpenEditor={() => setEditorOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          micLevel={micLevel}
        />
      </section>

      {/* Sidebar: Colleagues Directory, Spatial Chat & Office Zones */}
      <SidebarDirectory
        user={currentUser}
        peers={activePeers}
        messages={messages}
        layout={layout}
        onSendMessage={handleSendMessage}
        onWalkTo={handleMove}
        onOpenSettings={() => setSettingsOpen(true)}
        onStatusChange={handleStatusChange}
      />

      {/* Audio & Spatial Acoustics Settings Modal */}
      <AudioSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        micLevel={micLevel}
      />

      {/* Interactive Room Layout Editor Modal */}
      <LayoutEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        layout={layout}
        onSaveLayout={handleSaveLayout}
        onResetLayout={handleResetLayout}
      />

      {/* Screen Share Viewing Modal */}
      <ScreenShareModal
        isOpen={screenShareOpen}
        onClose={() => setScreenShareOpen(false)}
        stream={screenStream}
        presenterName={presenterName}
      />
    </main>
  );
}
