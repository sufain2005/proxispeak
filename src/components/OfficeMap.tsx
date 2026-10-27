import React, { useRef, useState, useEffect } from "react"
import { Icon } from "./Icons"
import type {
  UserProfile,
  RoomLayout,
  ChatMessage,
} from "../services/webrtcService"
import { spatialAudio } from "../services/spatialAudio"

interface OfficeMapProps {
  user: UserProfile
  peers: UserProfile[]
  layout: RoomLayout
  onMove: (x: number, y: number) => void
  miniMapOpen: boolean
  recentMessages: ChatMessage[]
  micLevel: number
}

export default function OfficeMap({
  user,
  peers,
  layout,
  onMove,
  miniMapOpen,
  recentMessages,
  micLevel,
}: OfficeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [clickTarget, setClickTarget] = useState<{
    x: number
    y: number
  } | null>(null)
  const [activeSpeechBubbles, setActiveSpeechBubbles] = useState<Map<string, {
    text: string
    expires: number
  }>>(new Map())

  // Keyboard navigation (WASD & Arrow Keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      ) {
        return
      }

      let dx = 0
      let dy = 0
      const step = 2.5

      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dy -= step
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") dy += step
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") dx -= step
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") dx += step

      if (dx !== 0 || dy !== 0) {
        e.preventDefault()
        onMove(
          Math.max(4, Math.min(96, user.x + dx)),
          Math.max(4, Math.min(96, user.y + dy)),
        )
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [user.x, user.y, onMove])

  // Handle incoming chat messages to pop speech bubbles
  useEffect(() => {
    if (recentMessages.length > 0) {
      const latest = recentMessages[recentMessages.length - 1]
      const now = Date.now()
      setActiveSpeechBubbles((prev) => {
        const next = new Map(prev)
        next.set(latest.senderId, { text: latest.text, expires: now + 5000 })
        return next
      })
    }
  }, [recentMessages])

  // Clean expired speech bubbles
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setActiveSpeechBubbles((prev) => {
        let changed = false
        const next = new Map(prev)
        next.forEach((bubble, id) => {
          if (bubble.expires < now) {
            next.delete(id)
            changed = true
          }
        })
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Update spatial audio engine on positions change
  useEffect(() => {
    peers.forEach((peer) => {
      spatialAudio.updateSpatialProperties(
        { x: user.x, y: user.y },
        { x: peer.x, y: peer.y, id: peer.id },
        user.audioRange,
        layout.walls,
      )
    })
  }, [user.x, user.y, user.audioRange, peers, layout.walls])

  // Click on floor to walk with visual ripple
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return
    const rect = mapRef.current.getBoundingClientRect()
    const clickX = ((e.clientX - rect.left) / rect.width) * 100
    const clickY = ((e.clientY - rect.top) / rect.height) * 100
    const targetX = Math.max(4, Math.min(96, clickX))
    const targetY = Math.max(4, Math.min(96, clickY))

    setClickTarget({ x: targetX, y: targetY })
    setTimeout(() => setClickTarget(null), 900)

    onMove(targetX, targetY)
  }

  // Dragging avatar
  const handleDrag = (e: React.MouseEvent) => {
    e.stopPropagation()
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!mapRef.current) return
      const rect = mapRef.current.getBoundingClientRect()
      const newX = ((moveEvent.clientX - rect.left) / rect.width) * 100
      const newY = ((moveEvent.clientY - rect.top) / rect.height) * 100
      onMove(Math.max(4, Math.min(96, newX)), Math.max(4, Math.min(96, newY)))
    }
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  const calculatePeerAcoustics = (peer: UserProfile) => {
    return spatialAudio.updateSpatialProperties(
      { x: user.x, y: user.y },
      { x: peer.x, y: peer.y, id: peer.id },
      user.audioRange,
      layout.walls,
    )
  }

  return (
    <div
      ref={mapRef}
      className="map"
      onClick={handleMapClick}
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: "center center",
        transition: "transform 0.15s ease-out",
      }}
      role="region"
      aria-label="Interactive Office Floor Plan. Click or use WASD to walk."
    >
      {/* Visual Destination Ripple on Click */}
      {clickTarget && (
        <div
          className="click-destination-ripple"
          style={{ left: `${clickTarget.x}%`, top: `${clickTarget.y}%` }}
        >
          <span className="ripple-circle" />
          <span className="ripple-pulse" />
        </div>
      )}

      {/* ============================================================ */}
      {/* ARCHITECTURAL OFFICE STRUCTURE (ZONES & FLOOR TEXTURES) */}
      {/* ============================================================ */}

      {/* 1. North Executive Boardroom (Top Left) */}
      <div
        className="office-zone zone-boardroom"
        style={{ left: "5%", top: "6%", width: "28%", height: "34%" }}
      >
        <div className="zone-header">
          <span className="zone-title">
            <Icon name="briefcase" size={13} /> EXECUTIVE BOARDROOM
          </span>
          <span className="zone-badge">6 SEATS · HD PRESENTATION</span>
        </div>
        <div className="boardroom-display">
          <span className="screen-led" />
          <span className="screen-title">Q3 Product Strategy Presentation</span>
        </div>
        <div className="table conference">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <button
            type="button"
            className="dock-table-btn"
            onClick={(e) => {
              e.stopPropagation()
              onMove(19, 23)
            }}
            title="Snap avatar to Boardroom Table"
          >
            Join Table
          </button>
        </div>
        <div className="glass-door-frame left-door">
          <span />
        </div>
      </div>

      {/* 2. Design Studio (Top Center) */}
      <div
        className="office-zone zone-studio"
        style={{ left: "36%", top: "6%", width: "28%", height: "34%" }}
      >
        <div className="zone-header">
          <span className="zone-title">
            <Icon name="spark" size={13} /> DESIGN & PROTOTYPING STUDIO
          </span>
          <span className="zone-badge">COLLAB ISLANDS</span>
        </div>
        <div className="ideation-board">
          <span className="sticky-note yellow" />
          <span className="sticky-note pink" />
          <span className="sticky-note cyan" />
          <span className="sticky-note green" />
          <small>Wireframes & Moodboard</small>
        </div>
        <div
          className="workbench-cluster clickable-zone"
          onClick={(e) => {
            e.stopPropagation()
            onMove(48, 23)
          }}
          title="Click to sit at Design Workbench"
        >
          <div className="dual-desk">
            <div className="monitor-rig">
              <span className="screen-glow" />
              <i />
            </div>
            <div className="monitor-rig">
              <span className="screen-glow" />
              <i />
            </div>
          </div>
          <div className="dual-desk">
            <div className="monitor-rig">
              <span className="screen-glow" />
              <i />
            </div>
            <div className="monitor-rig">
              <span className="screen-glow" />
              <i />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Quiet Focus Pods (Top Right) */}
      <div
        className="office-zone zone-focus"
        style={{ left: "67%", top: "6%", width: "28%", height: "34%" }}
      >
        <div className="zone-header">
          <span className="zone-title">
            <Icon name="radio" size={13} /> FOCUS PODS (ACOUSTIC)
          </span>
          <span className="zone-badge">SOUND ISOLATED</span>
        </div>
        <div className="pods-row">
          <div
            className="pod clickable-pod pod-vacant"
            onClick={(e) => {
              e.stopPropagation()
              onMove(71, 23)
            }}
            title="Enter Focus Pod 1 (Vacant)"
          >
            <div className="pod-indicator">
              <span className="vacant-led" />
              Vacant
            </div>
            <div className="pod-interior">
              <span className="desk-shelf" />
              <span className="chair-dot" />
            </div>
            <small>Pod 01</small>
          </div>

          <div
            className="pod clickable-pod pod-occupied"
            onClick={(e) => {
              e.stopPropagation()
              onMove(80, 23)
            }}
            title="Focus Pod 2 (In Use by Alex)"
          >
            <div className="pod-indicator">
              <span className="occupied-led" />
              In Use
            </div>
            <div className="pod-interior">
              <span className="desk-shelf" />
              <span className="chair-dot active" />
            </div>
            <small>Pod 02</small>
          </div>

          <div
            className="pod clickable-pod pod-vacant"
            onClick={(e) => {
              e.stopPropagation()
              onMove(89, 23)
            }}
            title="Enter Focus Pod 3 (Vacant)"
          >
            <div className="pod-indicator">
              <span className="vacant-led" />
              Vacant
            </div>
            <div className="pod-interior">
              <span className="desk-shelf" />
              <span className="chair-dot" />
            </div>
            <small>Pod 03</small>
          </div>
        </div>
      </div>

      {/* 4. Central Town Plaza & Walkways */}
      <div className="central-walkway">
        <div
          className="reception-carpet clickable-zone"
          onClick={(e) => {
            e.stopPropagation()
            onMove(50, 48)
          }}
          title="Walk to Central Foyer"
        >
          <span>✦ PROXISPEAK ATLAS HQ · CENTRAL FOYER ✦</span>
        </div>
      </div>

      {/* 5. The Atlas Lounge & Cafe (Bottom Left) */}
      <div
        className="office-zone zone-lounge"
        style={{ left: "5%", top: "56%", width: "38%", height: "38%" }}
      >
        <div className="zone-header">
          <span className="zone-title">
            <Icon name="coffee" size={13} /> THE ATLAS LOUNGE & CAFE
          </span>
          <span className="zone-badge">CASUAL · WATERCOOLER</span>
        </div>
        <div className="lounge-furniture">
          <div
            className="lounge-sectional clickable-zone"
            onClick={(e) => {
              e.stopPropagation()
              onMove(16, 76)
            }}
            title="Click to sit on Lounge Sofa"
          >
            <span className="sofa-cushion" />
            <span className="sofa-cushion" />
            <span className="sofa-cushion" />
            <div className="coffee-table">
              <span className="coffee-mug">☕</span>
              <span className="coffee-mug">🍵</span>
            </div>
          </div>
          <div
            className="cafe-bar clickable-zone"
            onClick={(e) => {
              e.stopPropagation()
              onMove(28, 76)
            }}
            title="Click to stand at Espresso Bar"
          >
            <span className="espresso-machine">☕ Espresso Bar</span>
            <div className="barstools">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="potted-plant plant-monstera">🌿</div>
          <div className="potted-plant plant-ficus">🪴</div>
        </div>
      </div>

      {/* 6. Engineering & Dev Lab (Bottom Right) */}
      <div
        className="office-zone zone-engineering"
        style={{ left: "46%", top: "56%", width: "49%", height: "38%" }}
      >
        <div className="zone-header">
          <span className="zone-title">
            <Icon name="layout" size={13} /> CORE ENGINEERING LAB
          </span>
          <span className="zone-badge">HIGH-SPEED WORKSTATIONS</span>
        </div>
        <div className="dev-workstations">
          <div
            className="desk-island clickable-zone"
            onClick={(e) => {
              e.stopPropagation()
              onMove(78, 76)
            }}
            title="Click to sit at Dev Workstation"
          >
            <div className="dev-desk">
              <span className="screen-dev">Terminal</span>
              <i className="chair-seat" />
            </div>
            <div className="dev-desk">
              <span className="screen-dev">Code</span>
              <i className="chair-seat" />
            </div>
          </div>
          <div
            className="desk-island clickable-zone"
            onClick={(e) => {
              e.stopPropagation()
              onMove(88, 76)
            }}
            title="Click to sit at Secondary Dev Workstation"
          >
            <div className="dev-desk">
              <span className="screen-dev">Metrics</span>
              <i className="chair-seat" />
            </div>
            <div className="dev-desk">
              <span className="screen-dev">WebRTC</span>
              <i className="chair-seat" />
            </div>
          </div>
          <div className="server-rack">
            <span className="rack-leds">
              <i />
              <i />
              <i />
              <i />
            </span>
            <small>Edge Server #01</small>
          </div>
          <div className="potted-plant plant-desk">🌵</div>
        </div>
      </div>

      {/* Custom layout walls & furniture loaded from database */}
      {layout.walls
        .filter((w) => w.id.startsWith("wall-"))
        .map((w) => (
          <div
            key={w.id}
            className={`map-custom-wall ${w.type}`}
            style={{
              left: `${w.x}%`,
              top: `${w.y}%`,
              width: `${w.width || 15}%`,
              height: `${w.height || 0.8}%`,
            }}
          />
        ))}

      {layout.furniture
        .filter((f) => f.id.startsWith("item-"))
        .map((f) => (
          <div
            key={f.id}
            className={`map-custom-furniture ${f.type}`}
            style={{ left: `${f.x}%`, top: `${f.y}%` }}
          >
            <span>
              {f.type === "plant" ? "🌿" : f.type === "sofa" ? "🛋️" : "🖥️"}
            </span>
          </div>
        ))}

      {/* SVG Proximity Connections & Laser Links */}
      {/* Cleaned: ONLY connects within true conversation distance & NEVER penetrates solid walls */}
      <svg
        className="connections"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="voiceLinkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2ed573" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        {peers.map((peer) => {
          const acoustics = calculatePeerAcoustics(peer)

          // DO NOT draw lines through solid walls!
          if (acoustics.isOccluded) return null

          // DO NOT clutter screen: only draw line if in conversational distance (<24%) OR actively speaking in voice range
          const isConversational = acoustics.distance <= 24
          const isAudioActive =
            (peer.isSpeaking && acoustics.inRange) ||
            (isConversational && (user.isSpeaking || micLevel > 15))
          if (!isConversational && !isAudioActive) return null

          return (
            <g key={`conn-${peer.id}`}>
              <line
                x1={user.x}
                y1={user.y}
                x2={peer.x}
                y2={peer.y}
                stroke="url(#voiceLinkGrad)"
                strokeWidth={isAudioActive ? "0.35" : "0.2"}
                strokeDasharray={isAudioActive ? "1 1" : "none"}
                opacity={isAudioActive ? 0.9 : 0.4}
                className={isAudioActive ? "animated-sound-link" : ""}
              />
            </g>
          )
        })}
      </svg>

      {/* Remote Peers (Cleaned: No giant overlapping radar circles!) */}
      {peers.map((peer) => {
        const acoustics = calculatePeerAcoustics(peer)
        const bubble = activeSpeechBubbles.get(peer.id)
        const inVoiceRange = acoustics.inRange && !acoustics.isOccluded

        return (
          <div
            key={peer.id}
            className={`person ${
              inVoiceRange ? "in-range-person" : "distant-person"
            } ${peer.isSpeaking ? "is-speaking" : ""}`}
            style={{ left: `${peer.x}%`, top: `${peer.y}%` }}
            onClick={(e) => {
              e.stopPropagation()
              onMove(peer.x + (peer.x > 50 ? -6 : 6), peer.y)
            }}
            title={`Colleague: ${peer.name} (${peer.role}) · Click to walk here`}
          >
            {/* Speech bubble */}
            {bubble && (
              <div className="comic-speech-bubble" role="status">
                <span>{bubble.text}</span>
              </div>
            )}

            {/* Avatar with speaking wave */}
            <div className={`avatar avatar-${peer.color || "blue"}`}>
              {peer.initials}
              {peer.isSpeaking && <span className="speaking-pulse-ring" />}
            </div>

            <div className="person-label">
              <span>{peer.name}</span>
              {inVoiceRange ? (
                <small className="in-range-badge">
                  {peer.isSpeaking
                    ? "Speaking"
                    : `${Math.round(acoustics.volume * 100)}% vol`}
                </small>
              ) : acoustics.isOccluded ? (
                <small className="distant-badge">Behind Wall</small>
              ) : (
                <small className="distant-badge">Out of range</small>
              )}
            </div>

            {/* Hover Tooltip Card */}
            <div className="peer-hover-card">
              <span className="hover-name">{peer.name}</span>
              <small className="hover-role">{peer.role}</small>
              <span className="hover-dist">
                {inVoiceRange
                  ? `In Voice Range (${Math.round(acoustics.volume * 100)}% vol)`
                  : acoustics.isOccluded
                    ? "Muffled by Wall"
                    : `${Math.round(acoustics.distance / 5)}m away`}
              </span>
              <button
                type="button"
                className="hover-action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onMove(peer.x + (peer.x > 50 ? -6 : 6), peer.y)
                }}
              >
                Walk to
              </button>
            </div>
          </div>
        )
      })}

      {/* Local User Avatar (With single elegant proximity radar ring) */}
      <div
        className={`person p-you local ${
          user.isSpeaking || micLevel > 15 ? "is-speaking" : ""
        }`}
        style={{ left: `${user.x}%`, top: `${user.y}%` }}
        onMouseDown={handleDrag}
        title="Your Avatar · Drag or Click on floor to move"
      >
        {/* Dynamic Proximity Audio Radius Ring */}
        <div
          className="user-proximity-radar"
          style={{
            width: `${user.audioRange * 2 * 9}px`,
            height: `${user.audioRange * 2 * 9}px`,
          }}
        />

        {/* Local Speech Bubble */}
        {activeSpeechBubbles.get(user.id) && (
          <div className="comic-speech-bubble user-bubble" role="status">
            <span>{activeSpeechBubbles.get(user.id)!.text}</span>
          </div>
        )}

        <div className="avatar avatar-green local-avatar-disc">
          {user.initials}
          {(user.isSpeaking || micLevel > 15) && (
            <span className="local-voice-pulse" />
          )}
        </div>

        <div className="person-label">
          <span>You</span>
          <small className="connected-badge">
            {user.isMuted ? "Muted" : "Mic Active"}
          </small>
        </div>
      </div>

      {/* Map Tools: Zoom & Center */}
      <div className="map-tools" aria-label="Floor plan zoom controls">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setZoom((z) => Math.min(1.5, z + 0.15))
          }}
          aria-label="Zoom in"
        >
          <Icon name="plus" size={16} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setZoom((z) => Math.max(0.75, z - 0.15))
          }}
          aria-label="Zoom out"
        >
          <Icon name="minus" size={16} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setZoom(1)
          }}
          aria-label="Reset Zoom"
          title="Reset Zoom to 100%"
        >
          <Icon name="refresh" size={14} />
        </button>
      </div>

      {/* Minimap Radar */}
      {miniMapOpen && (
        <div
          className="minimap"
          onClick={(e) => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            const px = ((e.clientX - rect.left) / rect.width) * 100
            const py = ((e.clientY - rect.top) / rect.height) * 100
            onMove(px, py)
          }}
          title="Minimap · Click to jump"
        >
          <div className="mini-rooms" />
          <span
            className="mini-viewport"
            style={{
              left: `${user.x}%`,
              top: `${user.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
          {peers.map((p) => (
            <span
              key={`mini-${p.id}`}
              className="mini-peer-dot"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
