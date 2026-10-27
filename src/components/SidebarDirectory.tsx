import React, { useState } from "react"
import { Icon } from "./Icons"
import type {
  UserProfile,
  ChatMessage,
  RoomLayout,
} from "../services/webrtcService"
import { spatialAudio } from "../services/spatialAudio"

interface SidebarDirectoryProps {
  user: UserProfile
  peers: UserProfile[]
  messages: ChatMessage[]
  layout: RoomLayout
  onSendMessage: (text: string, isWhisper?: boolean, targetId?: string) => void
  onWalkTo: (x: number, y: number) => void
  onOpenSettings: () => void
  onStatusChange: (status: string) => void
}

type TabType = "directory" | "chat" | "zones"

export default function SidebarDirectory({
  user,
  peers,
  messages,
  layout,
  onSendMessage,
  onWalkTo,
  onOpenSettings,
  onStatusChange,
}: SidebarDirectoryProps) {
  const [activeTab, setActiveTab] = useState<TabType>("directory")
  const [chatInput, setChatInput] = useState("")
  const [whisperTarget, setWhisperTarget] = useState<string>("")
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [copiedInvite, setCopiedInvite] = useState(false)

  // Group peers by audio proximity with wall occlusion
  const nearbyPeers: Array<{
    peer: UserProfile
    distance: number
    volume: number
    pan: number
    isOccluded: boolean
  }> = []
  const distantPeers: Array<{
    peer: UserProfile
    distance: number
    isOccluded: boolean
  }> = []

  peers.forEach((peer) => {
    const acoustics = spatialAudio.updateSpatialProperties(
      { x: user.x, y: user.y },
      { x: peer.x, y: peer.y, id: peer.id },
      user.audioRange,
      layout.walls,
    )

    if (acoustics.inRange) {
      nearbyPeers.push({ peer, ...acoustics })
    } else {
      distantPeers.push({
        peer,
        distance: acoustics.distance,
        isOccluded: acoustics.isOccluded,
      })
    }
  })

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    onSendMessage(chatInput, !!whisperTarget, whisperTarget || undefined)
    setChatInput("")
  }

  const startWhisper = (targetId: string) => {
    setWhisperTarget(targetId)
    setActiveTab("chat")
  }

  // 5 Architectural Zones
  const zones = [
    {
      name: "Executive Boardroom",
      tag: "6 Seats · HD Presentation",
      x: 19,
      y: 23,
      count:
        peers.filter((p) => p.x < 35 && p.y < 42).length +
        (user.x < 35 && user.y < 42 ? 1 : 0),
    },
    {
      name: "Design Studio",
      tag: "Creative Islands",
      x: 48,
      y: 23,
      count:
        peers.filter((p) => p.x >= 35 && p.x <= 66 && p.y < 42).length +
        (user.x >= 35 && user.x <= 66 && user.y < 42 ? 1 : 0),
    },
    {
      name: "Focus Pods",
      tag: "Acoustic Soundproof",
      x: 80,
      y: 23,
      count:
        peers.filter((p) => p.x > 66 && p.y < 42).length +
        (user.x > 66 && user.y < 42 ? 1 : 0),
    },
    {
      name: "Atlas Lounge & Cafe",
      tag: "Casual · Watercooler",
      x: 18,
      y: 78,
      count:
        peers.filter((p) => p.x < 44 && p.y >= 52).length +
        (user.x < 44 && user.y >= 52 ? 1 : 0),
    },
    {
      name: "Core Engineering Lab",
      tag: "Workstations & Servers",
      x: 78,
      y: 76,
      count:
        peers.filter((p) => p.x >= 44 && p.y >= 52).length +
        (user.x >= 44 && user.y >= 52 ? 1 : 0),
    },
  ]

  const statusOptions = [
    "Available",
    "In a meeting",
    "Focus mode",
    "Coffee break",
    "Be right back",
  ]
  const quickReactions = ["👋", "☕", "💡", "🚀", "👏", "🔥"]

  return (
    <aside className="directory" aria-label="Office directory and spatial chat">
      {/* Header with Title and Tab Navigation */}
      <div className="directory-header">
        <div className="directory-heading">
          <div>
            <span className="eyebrow">WORKSPACE</span>
            <h1>ProxiSpeak Office</h1>
          </div>
          <button
            type="button"
            className={`invite-btn ${copiedInvite ? "copied" : ""}`}
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href)
              }
              setCopiedInvite(true)
              setTimeout(() => setCopiedInvite(false), 2200)
            }}
            title={
              copiedInvite
                ? "Invite link copied to clipboard!"
                : "Copy office invite link"
            }
            aria-label="Invite team member"
          >
            <Icon name={copiedInvite ? "check" : "users"} size={17} />
          </button>
        </div>

        {/* Tab Controls */}
        <nav className="directory-tabs" aria-label="Directory views">
          <button
            type="button"
            className={`tab-btn ${activeTab === "directory" ? "active" : ""}`}
            onClick={() => setActiveTab("directory")}
          >
            <Icon name="users" size={14} />
            <span>Colleagues</span>
            <em className="tab-badge">{peers.length + 1}</em>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            <Icon name="message" size={14} />
            <span>Spatial Chat</span>
            {messages.length > 0 && (
              <em className="tab-badge">{messages.length}</em>
            )}
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === "zones" ? "active" : ""}`}
            onClick={() => setActiveTab("zones")}
          >
            <Icon name="grid" size={14} />
            <span>Zones</span>
          </button>
        </nav>
      </div>

      {/* Tab 1: Directory */}
      {activeTab === "directory" && (
        <div className="directory-scroll">
          {/* Nearby Section */}
          <section className="member-section" aria-labelledby="nearby-heading">
            <div className="section-title">
              <span id="nearby-heading">
                <i className="green-dot" />
                Nearby (In Voice Range)
              </span>
              <em>{nearbyPeers.length} CONNECTED</em>
            </div>

            {nearbyPeers.length === 0 ? (
              <div className="empty-section-hint">
                <Icon name="navigation" size={16} />
                <span>
                  No one in audio range. Click on someone on the map to walk
                  toward them!
                </span>
              </div>
            ) : (
              nearbyPeers.map(({ peer, volume, pan, isOccluded }) => (
                <div key={peer.id} className="member active-member">
                  <div
                    className={`avatar avatar-${peer.color || "violet"} avatar-small`}
                  >
                    {peer.initials}
                  </div>
                  <div className="member-info">
                    <div className="member-name-row">
                      <strong>{peer.name}</strong>
                      {isOccluded && (
                        <span className="occluded-pill">Wall Muffled</span>
                      )}
                    </div>
                    <small>
                      {peer.role} · {Math.round(volume * 100)}% vol
                    </small>
                  </div>

                  {/* Pan indicator */}
                  <div
                    className="pan-indicator"
                    title={`Panning: ${
                      pan > 0.2 ? "Right" : pan < -0.2 ? "Left" : "Center"
                    }`}
                  >
                    <small>
                      {pan < -0.2 ? "◄ L" : pan > 0.2 ? "R ►" : "• C"}
                    </small>
                  </div>

                  {/* Waveform */}
                  <div className="waveform" aria-label="Audio level">
                    {[2, 5, 3, 7, 4].map((h, i) => (
                      <span
                        key={i}
                        className={
                          peer.isSpeaking && i < (peer.level || 3)
                            ? "active"
                            : ""
                        }
                        style={{ height: `${h * 2}px` }}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}

            <div className="range-note">
              <Icon name="spark" size={16} />
              <span>
                Voices fade realistically as you step away. Headphone stereo
                panning enabled.
              </span>
            </div>
          </section>

          {/* Distant Section */}
          <section
            className="member-section distant-list"
            aria-labelledby="distant-heading"
          >
            <div className="section-title">
              <span id="distant-heading">
                <i className="red-dot" />
                Distant (Out of Range)
              </span>
              <em>{distantPeers.length} AWAY</em>
            </div>

            {distantPeers.map(({ peer, distance, isOccluded }) => (
              <div key={peer.id} className="member">
                <div
                  className={`avatar avatar-${peer.color || "cyan"} avatar-small`}
                >
                  {peer.initials}
                </div>
                <div className="member-info">
                  <div className="member-name-row">
                    <strong>{peer.name}</strong>
                    {isOccluded && (
                      <span className="occluded-pill subtle">Behind Wall</span>
                    )}
                  </div>
                  <small>{peer.role}</small>
                </div>

                <div className="distant-actions">
                  <span className="distance-badge">
                    {Math.round(distance / 5)}m
                  </span>
                  <button
                    type="button"
                    className="walk-to-btn"
                    onClick={() =>
                      onWalkTo(peer.x + (peer.x > 50 ? -6 : 6), peer.y)
                    }
                    title={`Walk to ${peer.name}`}
                  >
                    Walk to
                  </button>
                  <button
                    type="button"
                    className="whisper-btn"
                    onClick={() => startWhisper(peer.id)}
                    title={`Whisper to ${peer.name}`}
                  >
                    Whisper
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {/* Tab 2: Spatial Chat */}
      {activeTab === "chat" && (
        <div className="chat-container">
          <div className="chat-messages" role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div className="empty-chat-hint">
                <Icon name="message" size={24} />
                <p>
                  No messages yet. Spatial messages appear as comic speech
                  bubbles on the floor plan!
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-bubble-row ${
                    msg.senderId === user.id ? "is-self" : ""
                  } ${msg.isWhisper ? "is-whisper" : ""}`}
                >
                  <div
                    className={`avatar avatar-${msg.senderColor || "green"} avatar-micro`}
                  >
                    {msg.senderInitials}
                  </div>
                  <div className="chat-content">
                    <div className="chat-meta">
                      <strong>{msg.senderName}</strong>
                      {msg.isWhisper && (
                        <span className="whisper-tag">Whisper</span>
                      )}
                      <small>{msg.timestamp}</small>
                    </div>
                    <div className="chat-text">{msg.text}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Reaction Bar */}
          <div className="quick-reactions-bar" aria-label="Quick reactions">
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="reaction-chip"
                onClick={() =>
                  onSendMessage(
                    emoji,
                    !!whisperTarget,
                    whisperTarget || undefined,
                  )
                }
                title={`Send ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <form className="chat-input-bar" onSubmit={handleSend}>
            {whisperTarget && (
              <div className="whisper-target-indicator">
                <span>
                  Whispering to:{" "}
                  {peers.find((p) => p.id === whisperTarget)?.name ||
                    "Colleague"}
                </span>
                <button
                  type="button"
                  onClick={() => setWhisperTarget("")}
                  aria-label="Cancel whisper"
                >
                  ×
                </button>
              </div>
            )}
            <div className="input-group">
              <input
                type="text"
                placeholder={
                  whisperTarget
                    ? "Type a private whisper..."
                    : "Type a spatial message..."
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={200}
                className="chat-text-input"
              />
              <button
                type="submit"
                className="send-msg-btn"
                aria-label="Send message"
                disabled={!chatInput.trim()}
              >
                <Icon name="send" size={15} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Office Zones */}
      {activeTab === "zones" && (
        <div className="zones-container">
          <div className="zone-intro">
            <h3>Office Acoustic Zones</h3>
            <p>
              Click any room to fast-travel your avatar into that acoustic
              space.
            </p>
          </div>

          <div className="zones-list">
            {zones.map((zone) => (
              <div key={zone.name} className="zone-card">
                <div className="zone-card-info">
                  <strong>{zone.name}</strong>
                  <span className="zone-tag">{zone.tag}</span>
                  <small className="zone-occupants">
                    <i className="green-dot" /> {zone.count}{" "}
                    {zone.count === 1 ? "person" : "people"} inside
                  </small>
                </div>
                <button
                  type="button"
                  className="zone-teleport-btn"
                  onClick={() => onWalkTo(zone.x, zone.y)}
                >
                  Enter Zone
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Profile Footer */}
      <footer className="profile-footer">
        <div className={`avatar avatar-${user.color || "green"} avatar-small`}>
          {user.initials}
        </div>
        <div className="profile-details">
          <strong>{user.name}</strong>
          <div className="status-dropdown-wrapper">
            <button
              type="button"
              className="status-selector-btn"
              onClick={() => setShowStatusPicker(!showStatusPicker)}
              aria-expanded={showStatusPicker}
            >
              <i
                className={
                  user.status === "Available" ? "green-dot" : "amber-dot"
                }
              />
              <span>{user.status}</span>
              <Icon name="chevron" size={12} />
            </button>

            {showStatusPicker && (
              <div className="status-menu" role="menu">
                {statusOptions.map((st) => (
                  <button
                    key={st}
                    type="button"
                    role="menuitem"
                    className={`status-item ${
                      user.status === st ? "active" : ""
                    }`}
                    onClick={() => {
                      onStatusChange(st)
                      setShowStatusPicker(false)
                    }}
                  >
                    <i
                      className={st === "Available" ? "green-dot" : "amber-dot"}
                    />
                    <span>{st}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="footer-settings-btn"
          onClick={onOpenSettings}
          title="Open Audio & Spatial Settings"
          aria-label="Audio settings"
        >
          <Icon name="settings" size={17} />
        </button>
      </footer>
    </aside>
  )
}
