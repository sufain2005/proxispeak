import React, { useState } from 'react';
import { Icon } from './Icons';
import type { RoomLayout } from '../services/webrtcService';

interface LayoutEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  layout: RoomLayout;
  onSaveLayout: (newLayout: RoomLayout) => Promise<void>;
  onResetLayout: () => Promise<void>;
}

type PaletteItemType = 'solid' | 'glass' | 'wall-v' | 'wall-h' | 'desk-cluster' | 'sofa' | 'plant';

export default function LayoutEditorModal({
  isOpen,
  onClose,
  layout,
  onSaveLayout,
  onResetLayout,
}: LayoutEditorModalProps) {
  const [currentLayout, setCurrentLayout] = useState<RoomLayout>(layout);
  const [selectedTool, setSelectedTool] = useState<PaletteItemType>('solid');
  const [snapGrid, setSnapGrid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  React.useEffect(() => {
    setCurrentLayout(layout);
  }, [layout]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    if (snapGrid) {
      x = Math.round(x / 4) * 4;
      y = Math.round(y / 4) * 4;
    }

    if (selectedTool === 'solid' || selectedTool === 'glass' || selectedTool === 'wall-h' || selectedTool === 'wall-v') {
      const isVertical = selectedTool === 'wall-v';
      const isGlass = selectedTool === 'glass';
      const newWall = {
        id: `wall-${Date.now()}`,
        x: Math.max(5, Math.min(90, x)),
        y: Math.max(5, Math.min(90, y)),
        width: isVertical ? 0.8 : 20,
        height: isVertical ? 20 : 0.8,
        type: isGlass ? 'glass' : selectedTool,
      };

      setCurrentLayout((prev) => ({
        ...prev,
        walls: [...prev.walls, newWall],
      }));
    } else {
      const newFurniture = {
        id: `item-${Date.now()}`,
        type: selectedTool,
        x: Math.max(5, Math.min(90, x)),
        y: Math.max(5, Math.min(90, y)),
        label: selectedTool === 'desk-cluster' ? 'Desk Cluster' : selectedTool === 'sofa' ? 'Lounge Sofa' : 'Green Plant',
      };

      setCurrentLayout((prev) => ({
        ...prev,
        furniture: [...prev.furniture, newFurniture],
      }));
    }
  };

  const removeWall = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentLayout((prev) => ({
      ...prev,
      walls: prev.walls.filter((w) => w.id !== id),
    }));
  };

  const removeFurniture = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentLayout((prev) => ({
      ...prev,
      furniture: prev.furniture.filter((f) => f.id !== id),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      await onSaveLayout(currentLayout);
      setSaveStatus('Saved to Database!');
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      setSaveStatus('Failed to save layout');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await onResetLayout();
      setSaveStatus('Reset to default');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      setSaveStatus('Failed to reset');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="editor-modal">
        <header>
          <div>
            <span className="eyebrow">WORKSPACE TOOLS</span>
            <h2 id="editor-title">Interactive Room Layout Editor</h2>
            <p>Select an architectural element on the left, then click on the grid to place it. Click placed items to remove.</p>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close editor">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="editor-body">
          <aside className="palette">
            <span className="eyebrow">BUILD ELEMENTS</span>

            <button
              type="button"
              className={`palette-item ${selectedTool === 'solid' ? 'selected' : ''}`}
              onClick={() => setSelectedTool('solid')}
            >
              <i className="wall-icon" />
              <span>
                <strong>Solid Drywall</strong>
                <small>Blocks audio (-85%)</small>
              </span>
            </button>

            <button
              type="button"
              className={`palette-item ${selectedTool === 'glass' ? 'selected' : ''}`}
              onClick={() => setSelectedTool('glass')}
            >
              <i className="glass-icon" />
              <span>
                <strong>Glass Partition</strong>
                <small>Softens audio (-45%)</small>
              </span>
            </button>

            <button
              type="button"
              className={`palette-item ${selectedTool === 'desk-cluster' ? 'selected' : ''}`}
              onClick={() => setSelectedTool('desk-cluster')}
            >
              <i className="desk-icon" />
              <span>
                <strong>Desk Cluster</strong>
                <small>4 workstations</small>
              </span>
            </button>

            <button
              type="button"
              className={`palette-item ${selectedTool === 'sofa' ? 'selected' : ''}`}
              onClick={() => setSelectedTool('sofa')}
            >
              <i className="sofa-icon" />
              <span>
                <strong>Lounge Sofa</strong>
                <small>Casual seating</small>
              </span>
            </button>

            <button
              type="button"
              className={`palette-item ${selectedTool === 'plant' ? 'selected' : ''}`}
              onClick={() => setSelectedTool('plant')}
            >
              <i className="plant-icon">✦</i>
              <span>
                <strong>Office Plant</strong>
                <small>Acoustic dampener</small>
              </span>
            </button>

            <div className="snap-setting">
              <span>Snap to grid</span>
              <button
                type="button"
                className={`toggle ${snapGrid ? 'on' : ''}`}
                onClick={() => setSnapGrid(!snapGrid)}
                aria-pressed={snapGrid}
              >
                <i />
              </button>
            </div>

            <div className="editor-stats-hint">
              <small>Click placed elements to delete them.</small>
              <small>Walls: {currentLayout.walls.length} | Items: {currentLayout.furniture.length}</small>
            </div>
          </aside>

          <div className="editor-grid" onClick={handleGridClick} role="region" aria-label="Floor plan grid">
            {/* Visual boundary walls */}
            <div className="placed-wall wall-one" />
            <div className="placed-wall wall-two" />
            <div className="placed-glass" />

            {/* Custom walls */}
            {currentLayout.walls.map((wall) => (
              <div
                key={wall.id}
                className={`custom-placed-wall ${wall.type}`}
                style={{
                  left: `${wall.x}%`,
                  top: `${wall.y}%`,
                  width: `${wall.width || 10}%`,
                  height: `${wall.height || 1}%`,
                }}
                onClick={(e) => removeWall(wall.id, e)}
                title="Click to remove wall"
              >
                <span className="remove-tag">×</span>
              </div>
            ))}

            {/* Furniture */}
            {currentLayout.furniture.map((item) => (
              <div
                key={item.id}
                className={`custom-placed-furniture ${item.type}`}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                }}
                onClick={(e) => removeFurniture(item.id, e)}
                title={`Click to remove ${item.label || item.type}`}
              >
                <span>{item.type === 'plant' ? '🌿' : item.type === 'sofa' ? '🛋️' : '🖥️'}</span>
                <span className="remove-tag">×</span>
              </div>
            ))}

            <span className="grid-scale">1 square = 0.5m · Click anywhere to place</span>
          </div>
        </div>

        <footer>
          <button type="button" className="reset-button" onClick={handleReset} disabled={isSaving}>
            Reset to Default
          </button>
          <div className="save-actions">
            {saveStatus && <span className="save-status show">{saveStatus}</span>}
            <button type="button" className="save-button" onClick={handleSave} disabled={isSaving}>
              <Icon name="check" size={16} />
              <span>{isSaving ? 'Syncing...' : 'Save Layout to Database'}</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

