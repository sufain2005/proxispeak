import React from "react"
import { Icon } from "./Icons"

interface ControlDockProps {
  isMuted: boolean
  onToggleMute: () => void
  isDeafened: boolean
  onToggleDeafen: () => void
  isSharingScreen: boolean
  onToggleScreenShare: () => void
  audioRange: number
  onChangeAudioRange: (range: number) => void
  miniMapOpen: boolean
  onToggleMiniMap: () => void
  onOpenEditor: () => void
  onOpenSettings: () => void
  micLevel: number
}

export default function ControlDock({
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  isSharingScreen,
  onToggleScreenShare,
  audioRange,
  onChangeAudioRange,
  miniMapOpen,
  onToggleMiniMap,
  onOpenEditor,
  onOpenSettings,
  micLevel,
}: ControlDockProps) {
  const getRangeLabel = () => {
    if (audioRange <= 14) return "Whisper (12m)"
    if (audioRange >= 70) return "Townhall (All)"
    return "Proximity (22m)"
  }

  const cycleRange = () => {
    if (audioRange <= 14) onChangeAudioRange(22)
    else if (audioRange <= 30) onChangeAudioRange(95)
    else onChangeAudioRange(12)
  }

  return (
    <nav className="control-dock" aria-label="Audio and workspace controls">
      {/* Mic Button with Dynamic Speech Level Ring */}
      <div className="mic-dock-wrapper">
        <button
          type="button"
          className={`dock-button ${isMuted ? "danger" : "active"}`}
          onClick={onToggleMute}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          title={
            isMuted
              ? "Microphone Muted (Click to Unmute)"
              : "Microphone Active (Click to Mute)"
          }
        >
          <div className="icon-with-level">
            <Icon name={isMuted ? "mic-off" : "mic"} size={20} />
            {!isMuted && micLevel > 15 && (
              <span
                className="mic-speech-wave"
                style={{ transform: `scale(${1 + (micLevel / 100) * 0.45})` }}
              />
            )}
          </div>
          <span>{isMuted ? "Muted" : "Mic On"}</span>
        </button>
      </div>

      {/* Audio / Deafen */}
      <button
        type="button"
        className={`dock-button ${isDeafened ? "danger" : ""}`}
        onClick={onToggleDeafen}
        aria-label={isDeafened ? "Undeafen audio" : "Deafen audio"}
        title={
          isDeafened
            ? "Audio Deafened (Click to Listen)"
            : "Audio Active (Click to Deafen)"
        }
      >
        <Icon name={isDeafened ? "headphones-off" : "headphones"} size={20} />
        <span>{isDeafened ? "Deafened" : "Audio On"}</span>
      </button>

      <i className="dock-separator" />

      {/* Screen Share */}
      <button
        type="button"
        className={`dock-button ${isSharingScreen ? "active-pulse" : ""}`}
        onClick={onToggleScreenShare}
        aria-label={
          isSharingScreen ? "Stop screen sharing" : "Start screen sharing"
        }
        title="Share your screen with the room"
      >
        <Icon name="screen" size={20} />
        <span>{isSharingScreen ? "Sharing" : "Share"}</span>
      </button>

      {/* Audio Range Cycle */}
      <button
        type="button"
        className="dock-button"
        onClick={cycleRange}
        title="Change Voice Range (Whisper / Proximity / Townhall)"
      >
        <Icon name="radio" size={20} />
        <span className="dock-subtext">{getRangeLabel()}</span>
      </button>

      <i className="dock-separator" />

      {/* Minimap Toggle */}
      <button
        type="button"
        className={`dock-button ${miniMapOpen ? "selected" : ""}`}
        onClick={onToggleMiniMap}
        aria-label="Toggle minimap"
        title="Toggle Minimap Radar"
      >
        <Icon name="grid" size={20} />
        <span>Map</span>
      </button>

      {/* Room Layout Editor */}
      <button
        type="button"
        className="dock-button"
        onClick={onOpenEditor}
        aria-label="Open room layout editor"
        title="Customize Office Walls & Layout"
      >
        <Icon name="layout" size={20} />
        <span>Layout</span>
      </button>

      {/* Settings Modal */}
      <button
        type="button"
        className="dock-button"
        onClick={onOpenSettings}
        aria-label="Audio and spatial acoustics settings"
        title="Microphone & Acoustics Settings"
      >
        <Icon name="settings" size={20} />
        <span>Settings</span>
      </button>
    </nav>
  )
}
