import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { Image as KonvaImage, Layer, Stage, Transformer } from 'react-konva';
import type Konva from 'konva';

import { useBlobUrl, useHtmlImage } from '../../lib/hooks/useBlobUrl';
import { useAppStore } from '../../store/useAppStore';
import { showToast } from '../../store/toastStore';
import { SkeletonRoom } from '../room/SkeletonRoom';
import { PlacedItem } from './PlacedItem';
import type { Placement, Room } from '../../store/types';

/** D-09 self-healing toast copy — locked in Phase 1 CONTEXT.md / UI-SPEC. */
const SELF_HEAL_TOAST = {
  title: "We couldn't reload your last photo",
  body: 'Upload again to continue.',
  variant: 'error' as const,
};

const IS_COARSE_POINTER =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export interface EditorStageProps {
  room: Room;
  placements: Placement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Desktop DnD drop from the library strip: (itemId, room-space x/y). */
  onDropItem: (itemId: string, x: number, y: number) => void;
}

/**
 * Konva editor stage (EDT-01..06). The Stage is scaled so all children live
 * in the room image's natural pixel space — placements persist in that space
 * and Phase 3 export draws them 1:1 onto a native-resolution canvas.
 *
 * Layers: room image (listening=false, Pitfall m6) below, placements +
 * Transformer above. `touch-action: none` lives on the container only
 * (Pitfall M1/M8) so the library strip still scrolls.
 */
export function EditorStage({
  room,
  placements,
  selectedId,
  onSelect,
  onDropItem,
}: EditorStageProps): ReactElement {
  const libraryItems = useAppStore((s) => s.libraryItems);
  const updatePlacement = useAppStore((s) => s.updatePlacement);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState({ w: 0, h: 0 });

  // Size the stage to its container (throttled to rAF — Pitfall M3).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let rafId = 0;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setContainer({ w: rect.width, h: rect.height });
    };
    measure();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Room bitmap + D-09 self-heal when the blob vanished from IDB.
  const { url: roomUrl, missing } = useBlobUrl(room.blobId);
  const roomImage = useHtmlImage(roomUrl);
  useEffect(() => {
    if (!missing) return;
    showToast(SELF_HEAL_TOAST);
    useAppStore.setState((s) => {
      if (!s.activeRoomId) return s;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [s.activeRoomId]: _evicted, ...rest } = s.rooms;
      return { activeRoomId: null, rooms: rest };
    });
  }, [missing]);

  // Node registry so the Transformer can attach to the selected placement.
  const nodesRef = useRef(new Map<string, Konva.Image>());
  const registerNode = (id: string, node: Konva.Image | null) => {
    if (node) nodesRef.current.set(id, node);
    else nodesRef.current.delete(id);
  };
  const trRef = useRef<Konva.Transformer | null>(null);
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodesRef.current.get(selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, placements]);

  // Two-finger pinch = scale + rotate the SELECTED node (EDT-03). The node is
  // mutated directly during the gesture and committed to the store on end.
  const gestureRef = useRef<{ dist: number; angle: number } | null>(null);
  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length !== 2 || !selectedId) return;
    e.evt.preventDefault();
    const t0 = touches[0];
    const t1 = touches[1];
    if (!t0 || !t1) return;
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    const dist = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const prev = gestureRef.current;
    gestureRef.current = { dist, angle };
    if (!prev) return;
    const node = nodesRef.current.get(selectedId);
    if (!node) return;
    node.stopDrag();
    const factor = prev.dist > 0 ? dist / prev.dist : 1;
    node.scaleX(node.scaleX() * factor);
    node.scaleY(node.scaleY() * factor);
    node.rotation(node.rotation() + (angle - prev.angle));
  };
  const handleTouchEnd = () => {
    if (!gestureRef.current) return;
    gestureRef.current = null;
    if (!selectedId) return;
    const node = nodesRef.current.get(selectedId);
    if (!node) return;
    updatePlacement(room.id, selectedId, {
      scale: Math.abs(node.scaleX()),
      rotation: node.rotation(),
    });
  };

  // Fit the room into the container ("contain"); children use room coords.
  const displayScale =
    container.w > 0 && container.h > 0
      ? Math.min(container.w / room.width, container.h / room.height)
      : 0;
  const stageW = Math.floor(room.width * displayScale);
  const stageH = Math.floor(room.height * displayScale);

  const deselectOnEmpty = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) onSelect(null);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 flex items-center justify-center touch-none"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData('application/x-roomdrop-item');
        if (!itemId || displayScale === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetX = (rect.width - stageW) / 2;
        const offsetY = (rect.height - stageH) / 2;
        const x = (e.clientX - rect.left - offsetX) / displayScale;
        const y = (e.clientY - rect.top - offsetY) / displayScale;
        onDropItem(itemId, x, y);
      }}
    >
      {!roomImage && <SkeletonRoom />}
      {roomImage && displayScale > 0 && (
        <div className="rounded-2xl overflow-hidden shadow-lg" style={{ lineHeight: 0 }}>
          <Stage
            width={stageW}
            height={stageH}
            scaleX={displayScale}
            scaleY={displayScale}
            onMouseDown={deselectOnEmpty}
            onTouchStart={deselectOnEmpty}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Layer listening={false}>
              <KonvaImage image={roomImage} width={room.width} height={room.height} />
            </Layer>
            <Layer>
              {placements.map((p) => {
                const item = libraryItems[p.itemId];
                if (!item) return null;
                return (
                  <PlacedItem
                    key={p.id}
                    placement={p}
                    item={item}
                    onSelect={() => onSelect(p.id)}
                    onCommit={(patch) => updatePlacement(room.id, p.id, patch)}
                    registerNode={registerNode}
                  />
                );
              })}
              <Transformer
                ref={trRef}
                keepRatio
                flipEnabled={false}
                rotateEnabled
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                anchorSize={IS_COARSE_POINTER ? 24 : 10}
                rotateAnchorOffset={IS_COARSE_POINTER ? 48 : 25}
                anchorCornerRadius={4}
                anchorStroke="#c17a52"
                borderStroke="#c17a52"
                anchorFill="#ffffff"
              />
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}
