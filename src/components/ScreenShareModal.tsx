import React, { useEffect, useRef } from "react"
import { Icon } from "./Icons"

interface ScreenShareModalProps {
  isOpen: boolean
  onClose: () => void
  stream: MediaStream | null
  presenterName: string
}

export default function ScreenShareModal({
  isOpen,
  onClose,
  stream,
  presenterName,
}: ScreenShareModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-backdrop screen-share-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="screen-share-dialog">
        <header className="screen-share-header">
          <div className="presenter-tag">
            <span className="live-dot" />
            <strong>{`${presenterName}'s Live Screen`}</strong>
            <small>North Boardroom Presentation</small>
          </div>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Minimize screen"
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="screen-video-wrapper">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="screen-video"
            />
          ) : (
            <div className="no-stream-placeholder">
              <Icon name="screen" size={48} />
              <p>Waiting for presenter screen transmission...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
