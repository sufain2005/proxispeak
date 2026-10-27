// Spatial Audio Engine using Web Audio API

export interface LayoutWall {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

// Line segment intersection helper
function doLinesIntersect(
  p1x: number, p1y: number, p2x: number, p2y: number,
  p3x: number, p3y: number, p4x: number, p4y: number
): boolean {
  const ccw = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  };
  return (
    ccw(p1x, p1y, p3x, p3y, p4x, p4y) !== ccw(p2x, p2y, p3x, p3y, p4x, p4y) &&
    ccw(p1x, p1y, p2x, p2y, p3x, p3y) !== ccw(p1x, p1y, p2x, p2y, p4x, p4y)
  );
}

class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localSource: MediaStreamAudioSourceNode | null = null;
  private peerAudioNodes: Map<
    string,
    {
      source: MediaStreamAudioSourceNode;
      panner: StereoPannerNode;
      gain: GainNode;
      stream: MediaStream;
    }
  > = new Map();

  private isDeafened: boolean = false;
  private masterVolume: number = 1.0;
  private spatialEnabled: boolean = true;
  private occlusionEnabled: boolean = true;
  private animFrameId: number | null = null;

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Setup local microphone stream analysis
  public setupLocalStream(stream: MediaStream, onLevelUpdate: (level: number, isSpeaking: boolean) => void) {
    try {
      const ctx = this.getAudioContext();
      if (this.localSource) {
        this.localSource.disconnect();
      }
      this.localSource = ctx.createMediaStreamSource(stream);
      this.localAnalyser = ctx.createAnalyser();
      this.localAnalyser.fftSize = 64;
      this.localAnalyser.smoothingTimeConstant = 0.5;
      this.localSource.connect(this.localAnalyser);

      const bufferLength = this.localAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
      }

      const updateMeter = () => {
        if (!this.localAnalyser) return;
        this.localAnalyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        const isSpeaking = normalized > 14;

        onLevelUpdate(normalized, isSpeaking);
        this.animFrameId = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.warn('Failed to setup local microphone analysis:', err);
    }
  }

  // Connect remote peer's WebRTC audio stream into spatial graph
  public attachPeerStream(peerId: string, stream: MediaStream) {
    try {
      const ctx = this.getAudioContext();
      this.detachPeerStream(peerId);

      const source = ctx.createMediaStreamSource(stream);
      const panner = ctx.createStereoPanner();
      const gain = ctx.createGain();

      // Default initial gain is 0 until distance is calculated
      gain.gain.setValueAtTime(0, ctx.currentTime);

      source.connect(panner);
      panner.connect(gain);
      gain.connect(ctx.destination);

      this.peerAudioNodes.set(peerId, { source, panner, gain, stream });
    } catch (err) {
      console.warn(`Could not attach spatial stream for ${peerId}:`, err);
    }
  }

  public detachPeerStream(peerId: string) {
    const nodes = this.peerAudioNodes.get(peerId);
    if (nodes) {
      try {
        nodes.gain.disconnect();
        nodes.panner.disconnect();
        nodes.source.disconnect();
      } catch (e) {
        // ignore
      }
      this.peerAudioNodes.delete(peerId);
    }
  }

  // Update spatial properties (distance, pan, wall occlusion)
  public updateSpatialProperties(
    myPos: { x: number; y: number },
    peerPos: { x: number; y: number; id: string },
    rangeRadius: number = 22,
    walls: LayoutWall[] = []
  ): { distance: number; volume: number; pan: number; inRange: boolean; isOccluded: boolean } {
    const dx = peerPos.x - myPos.x;
    const dy = peerPos.y - myPos.y;
    const distance = Math.hypot(dx, dy);

    let inRange = distance <= rangeRadius;
    let volume = 0;
    let pan = 0;
    let isOccluded = false;

    if (inRange) {
      // Smooth cosine fade
      const normalizedDist = distance / rangeRadius;
      volume = Math.max(0, Math.cos((normalizedDist * Math.PI) / 2));

      // Wall Occlusion: check if line segment between me and peer intersects walls
      if (this.occlusionEnabled && walls && walls.length > 0) {
        for (const wall of walls) {
          const wx1 = wall.x;
          const wy1 = wall.y;
          const wx2 = wall.x + (wall.width || 0);
          const wy2 = wall.y + (wall.height || 0);

          // Check all 4 boundary edges of the wall / room rectangle
          const intersects =
            doLinesIntersect(myPos.x, myPos.y, peerPos.x, peerPos.y, wx1, wy1, wx2, wy1) || // Top edge
            doLinesIntersect(myPos.x, myPos.y, peerPos.x, peerPos.y, wx1, wy2, wx2, wy2) || // Bottom edge
            doLinesIntersect(myPos.x, myPos.y, peerPos.x, peerPos.y, wx1, wy1, wx1, wy2) || // Left edge
            doLinesIntersect(myPos.x, myPos.y, peerPos.x, peerPos.y, wx2, wy1, wx2, wy2);   // Right edge

          if (intersects) {
            isOccluded = true;
            if (wall.type === 'glass') {
              volume *= 0.55; // Muffled by glass
            } else {
              volume *= 0.15; // Heavily muffled by solid wall
            }
          }
        }
      }

      // Stereo Panning: map dx to [-1.0, 1.0]
      if (this.spatialEnabled) {
        pan = Math.max(-1, Math.min(1, dx / 18));
      }
    }

    if (this.isDeafened) {
      volume = 0;
    } else {
      volume *= this.masterVolume;
    }

    // Apply to Web Audio nodes if peer has active audio stream
    const nodes = this.peerAudioNodes.get(peerPos.id);
    if (nodes && this.ctx) {
      const now = this.ctx.currentTime;
      nodes.gain.gain.setTargetAtTime(volume, now, 0.05);
      nodes.panner.pan.setTargetAtTime(pan, now, 0.05);
    }

    return { distance, volume, pan, inRange, isOccluded };
  }

  public setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.peerAudioNodes.forEach((nodes) => {
        nodes.gain.gain.setTargetAtTime(deafened ? 0 : this.masterVolume * 0.8, now, 0.05);
      });
    }
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.peerAudioNodes.forEach((nodes) => {
        nodes.gain.gain.setTargetAtTime(this.isDeafened ? 0 : this.masterVolume * 0.8, now, 0.05);
      });
    }
  }

  public getMasterVolume() {
    return this.masterVolume;
  }

  public setSpatialEnabled(enabled: boolean) {
    this.spatialEnabled = enabled;
  }

  public setOcclusionEnabled(enabled: boolean) {
    this.occlusionEnabled = enabled;
  }

  // Pleasant auditory feedback using Web Audio synthesis
  public playChime(type: 'join' | 'whisper' | 'leave' | 'mute' | 'unmute' | 'spatial-test') {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      if (type === 'join') {
        // Harmonic uplifting chord
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.06);
          gain.gain.setValueAtTime(0, now + i * 0.06);
          gain.gain.linearRampToValueAtTime(0.12, now + i * 0.06 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.5);
        });
      } else if (type === 'whisper') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'mute' || type === 'unmute') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const startFreq = type === 'unmute' ? 380 : 540;
        const endFreq = type === 'unmute' ? 540 : 380;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'spatial-test') {
        // Sweeps a warm tone smoothly from far left to far right
        const osc = ctx.createOscillator();
        const panner = ctx.createStereoPanner();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.3);
        osc.frequency.setValueAtTime(659.25, now + 0.6);

        panner.pan.setValueAtTime(-1, now);
        panner.pan.linearRampToValueAtTime(1, now + 0.9);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
        gain.gain.setValueAtTime(0.15, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

        osc.connect(panner);
        panner.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.1);
      }
    } catch (e) {
      console.warn('Audio chime playback suppressed:', e);
    }
  }

  public dispose() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.peerAudioNodes.forEach((nodes) => {
      try {
        nodes.gain.disconnect();
        nodes.source.disconnect();
      } catch (e) {}
    });
    this.peerAudioNodes.clear();
    if (this.localSource) {
      try {
        this.localSource.disconnect();
      } catch (e) {}
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {}
      this.ctx = null;
    }
  }
}

export const spatialAudio = new SpatialAudioEngine();

