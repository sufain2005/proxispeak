import React, { useEffect, useState, useRef } from "react"
import { Icon } from "./Icons"
import { spatialAudio } from "../services/spatialAudio"
import { webrtcService } from "../services/webrtcService"

interface AudioSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  micLevel: number
}

export default function AudioSettingsModal({
  isOpen,
  onClose,
  micLevel,
}: AudioSettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>("")
  const [spatialEnabled, setSpatialEnabled] = useState(true)
  const [occlusionEnabled, setOcclusionEnabled] = useState(true)
  const [echoCancellation, setEchoCancellation] = useState(true)
  const [testingSpeaker, setTestingSpeaker] = useState(false)
  const [masterVolume, setMasterVolume] = useState<number>(
    Math.round(spatialAudio.getMasterVolume() * 100),
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal()
      }
    } else {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [isOpen])

  useEffect(() => {
    async function loadDevices() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const mics = devices.filter((d) => d.kind === "audioinput")
          setAudioDevices(mics)
          if (mics.length > 0 && !selectedDevice) {
            setSelectedDevice(mics[0].deviceId)
          }
        }
      } catch (e) {
        console.warn("Could not enumerate audio devices:", e)
      }
    }
    loadDevices()
  }, [isOpen])

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDevice(deviceId)
    try {
      await webrtcService.startMicrophone(deviceId)
    } catch (err) {
      console.warn("Failed to switch microphone:", err)
    }
  }

  const handleSpatialToggle = () => {
    const next = !spatialEnabled
    setSpatialEnabled(next)
    spatialAudio.setSpatialEnabled(next)
  }

  const handleOcclusionToggle = () => {
    const next = !occlusionEnabled
    setOcclusionEnabled(next)
    spatialAudio.setOcclusionEnabled(next)
  }

  const handlePlaySpatialTest = () => {
    setTestingSpeaker(true)
    spatialAudio.playChime("spatial-test")
    setTimeout(() => setTestingSpeaker(false), 1200)
  }

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog modal-backdrop"
      onClose={onClose}
      aria-labelledby="audio-settings-title"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="settings-modal" role="document">
        <header className="settings-header">
          <div>
            <span className="eyebrow">PREFERENCES</span>
            <h2 id="audio-settings-title">Audio & Spatial Acoustics</h2>
          </div>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close audio settings"
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="settings-body">
          {/* Microphone Selector */}
          <section className="settings-group">
            <label htmlFor="mic-select" className="settings-label">
              <Icon name="mic" size={16} />
              <span>Microphone Input Device</span>
            </label>
            <div className="select-wrapper">
              <select
                id="mic-select"
                value={selectedDevice}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="settings-select"
              >
                {audioDevices.length > 0 ? (
                  audioDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="">Default System Microphone</option>
                )}
              </select>
            </div>

            {/* Live Input Meter */}
            <div className="input-meter-container">
              <div className="meter-label">
                <span>Mic Input Level</span>
                <span
                  className={
                    micLevel > 15 ? "meter-value active" : "meter-value"
                  }
                >
                  {micLevel > 15 ? `${micLevel}% (Speaking)` : "Idle"}
                </span>
              </div>
              <div
                className="meter-track"
                role="progressbar"
                aria-valuenow={micLevel}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="meter-fill"
                  style={{
                    width: `${micLevel}%`,
                    backgroundColor:
                      micLevel > 75
                        ? "#ff4757"
                        : micLevel > 15
                          ? "#2ed573"
                          : "#3b82f6",
                  }}
                />
              </div>
            </div>
          </section>

          {/* Master Listening Volume Slider */}
          <section className="settings-group">
            <div className="settings-row-heading">
              <label htmlFor="master-volume-slider" className="settings-label">
                <Icon name="volume" size={16} />
                <span>Master Listening Volume</span>
              </label>
              <span className="meter-value active">{masterVolume}%</span>
            </div>
            <input
              id="master-volume-slider"
              type="range"
              min="0"
              max="100"
              value={masterVolume}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                setMasterVolume(val)
                spatialAudio.setMasterVolume(val / 100)
              }}
              className="volume-slider"
              aria-label="Master listening volume"
            />
          </section>

          {/* Spatial Sound Test */}
          <section className="settings-group">
            <div className="settings-row-heading">
              <div>
                <strong>3D Spatial Panning</strong>
                <p>
                  Simulates real binaural stereo panning based on peer
                  coordinates relative to your avatar.
                </p>
              </div>
              <button
                type="button"
                className={`toggle-switch ${spatialEnabled ? "active" : ""}`}
                onClick={handleSpatialToggle}
                aria-pressed={spatialEnabled}
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            <div className="speaker-test-row">
              <button
                type="button"
                className={`sound-test-btn ${testingSpeaker ? "playing" : ""}`}
                onClick={handlePlaySpatialTest}
              >
                <Icon name="sound-test" size={18} />
                <span>
                  {testingSpeaker
                    ? "Sweeping Left → Right..."
                    : "Test Spatial Audio (L → R)"}
                </span>
              </button>
              <small className="test-hint">
                Wear headphones to experience 3D directional panning.
              </small>
            </div>
          </section>

          {/* Wall & Acoustic Occlusion */}
          <section className="settings-group">
            <div className="settings-row-heading">
              <div>
                <strong>Acoustic Wall Occlusion</strong>
                <p>
                  Drywall blocks voice transmission (-85%), and glass partitions
                  soften audio (-45%).
                </p>
              </div>
              <button
                type="button"
                className={`toggle-switch ${occlusionEnabled ? "active" : ""}`}
                onClick={handleOcclusionToggle}
                aria-pressed={occlusionEnabled}
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </section>

          {/* Noise Suppression & Echo Cancellation */}
          <section className="settings-group">
            <div className="settings-row-heading">
              <div>
                <strong>Echo Cancellation & Noise Reduction</strong>
                <p>
                  Filters out keyboard typing, room reverb, and feedback loops.
                </p>
              </div>
              <button
                type="button"
                className={`toggle-switch ${echoCancellation ? "active" : ""}`}
                onClick={() => setEchoCancellation(!echoCancellation)}
                aria-pressed={echoCancellation}
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </section>
        </div>

        <footer className="settings-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Apply Settings
          </button>
        </footer>
      </div>
    </dialog>
  )
}
