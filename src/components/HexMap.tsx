import { useCallback, useRef, useState } from 'react';
import { REGIONS, WORLD_BOUNDS, type Region } from '../data/regions';
import type { Annotation, ToolId } from '../store/annotationStore';

export interface MapMarker {
  regionId: string;
  /** Small label rendered inside the badge (number, emoji…). */
  label: string;
  color: string;
}

/** A live marker from the War API, already resolved to world coordinates. */
export interface ApiMarker {
  x: number;
  y: number;
  iconUrl: string;
  ringColor: string;
  title: string;
}

interface Props {
  onRegionClick?: (region: Region) => void;
  /** Region ids to highlight (fill). */
  highlighted?: Map<string, string>;
  /** Ordered polyline through region centers. */
  route?: string[];
  routeColor?: string;
  markers?: MapMarker[];
  /** Live structures/fields from the War API. */
  apiMarkers?: ApiMarker[];
  /** Freehand annotations + the active drawing tool. */
  annotations?: Annotation[];
  tool?: ToolId;
  onAddPoint?: (pos: [number, number]) => void;
  onAddArrow?: (from: [number, number], to: [number, number]) => void;
  onEraseAnnotation?: (id: string) => void;
  /** Height of the map viewport (CSS). */
  className?: string;
}

const [BX, BY, BW, BH] = WORLD_BOUNDS;
const PAD = 400;
const VIEW = { x: BX - PAD, y: BY - PAD, w: BW + 2 * PAD, h: BH + 2 * PAD };
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
/** API markers only appear once zoomed in enough to be readable. */
const API_MARKER_MIN_ZOOM = 1.6;

const ANNOTATION_COLORS: Record<string, string> = {
  friendly: '#38bdf8',
  enemy: '#ef4444',
  danger: '#facc15',
  arrowFriendly: '#38bdf8',
  arrowEnemy: '#ef4444',
};
const POINT_GLYPHS: Record<string, string> = {
  friendly: '⬤',
  enemy: '✖',
  danger: '⚠',
};

/**
 * Interactive SVG map of the 53 world hexes rendered with the official
 * region art: pan (drag), zoom (wheel), clickable regions, highlights,
 * route polyline, badges, live War API markers and custom annotations.
 */
export function HexMap({
  onRegionClick,
  highlighted,
  route = [],
  routeColor = '#f59e0b',
  markers = [],
  apiMarkers = [],
  annotations = [],
  tool = 'pan',
  onAddPoint,
  onAddArrow,
  onEraseAnnotation,
  className,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2]);
  const [hovered, setHovered] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [drawStart, setDrawStart] = useState<[number, number] | null>(null);
  const [drawEnd, setDrawEnd] = useState<[number, number] | null>(null);

  const vw = VIEW.w / zoom;
  const vh = VIEW.h / zoom;
  const viewBox = `${center[0] - vw / 2} ${center[1] - vh / 2} ${vw} ${vh}`;

  const isArrowTool = tool === 'arrowFriendly' || tool === 'arrowEnemy';
  const isPointTool = tool === 'friendly' || tool === 'enemy' || tool === 'danger';

  /** Convert a mouse event into world coordinates. */
  const toWorld = useCallback(
    (e: { clientX: number; clientY: number }): [number, number] => {
      const rect = svgRef.current!.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      return [center[0] - vw / 2 + px * vw, center[1] - vh / 2 + py * vh];
    },
    [center, vw, vh],
  );

  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.25 : 0.8;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    if (next === zoom) return;
    // Zoom towards the cursor: keep the world point under it fixed.
    const [wx, wy] = toWorld(e);
    const scale = zoom / next;
    setCenter([wx - (wx - center[0]) * scale, wy - (wy - center[1]) * scale]);
    setZoom(next);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (isArrowTool) {
      const pos = toWorld(e);
      setDrawStart(pos);
      setDrawEnd(pos);
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (drawStart) {
      setDrawEnd(toWorld(e));
      return;
    }
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    const rect = svgRef.current!.getBoundingClientRect();
    setCenter(([cx, cy]) => [cx - (dx / rect.width) * vw, cy - (dy / rect.height) * vh]);
    drag.current.x = e.clientX;
    drag.current.y = e.clientY;
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (drawStart && isArrowTool) {
      const end = toWorld(e);
      const dist = Math.hypot(end[0] - drawStart[0], end[1] - drawStart[1]);
      // Require a real drag so stray clicks don't leave arrows behind.
      if (dist > vw * 0.02) onAddArrow?.(drawStart, end);
      setDrawStart(null);
      setDrawEnd(null);
      return;
    }
    if (isPointTool && !drag.current?.moved) {
      onAddPoint?.(toWorld(e));
    }
    drag.current = null;
  };

  const endDrag = () => {
    drag.current = null;
    setDrawStart(null);
    setDrawEnd(null);
  };

  const clickRegion = (region: Region) => {
    // Region selection only in pan mode, and not at the end of a pan gesture.
    if (tool !== 'pan' || drag.current?.moved) return;
    onRegionClick?.(region);
  };

  const routePoints = route
    .map((id) => REGIONS.find((r) => r.id === id))
    .filter((r): r is Region => !!r)
    .map((r) => r.center);

  const fontSize = Math.max(180, 420 / zoom);
  // Sizes tied to the viewport so elements keep a constant on-screen size.
  const apiIconSize = vw * 0.03;
  const pointSize = vw * 0.022;
  const arrowWidth = vw * 0.007;

  // Cull API markers outside the current viewport.
  const minVX = center[0] - vw / 2 - apiIconSize;
  const maxVX = center[0] + vw / 2 + apiIconSize;
  const minVY = center[1] - vh / 2 - apiIconSize;
  const maxVY = center[1] + vh / 2 + apiIconSize;
  const visibleApiMarkers =
    zoom >= API_MARKER_MIN_ZOOM
      ? apiMarkers.filter((m) => m.x >= minVX && m.x <= maxVX && m.y >= minVY && m.y <= maxVY)
      : [];

  const cursorClass =
    tool === 'pan'
      ? 'cursor-grab active:cursor-grabbing'
      : tool === 'erase'
        ? 'cursor-pointer'
        : 'cursor-crosshair';

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={endDrag}
      className={`${className ?? 'w-full h-[520px]'} ${cursorClass} select-none`}
      role="img"
    >
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4.5"
          markerHeight="4.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      </defs>

      {/* Official region map art (from the game's War API assets, 1024x888
          per hex) drawn on each hex's bounding box — corners are transparent
          so neighbouring hexes tile seamlessly. */}
      {REGIONS.map((region) => {
        const xs = region.polygon.map((p) => p[0]);
        const ys = region.polygon.map((p) => p[1]);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return (
          <image
            key={`img-${region.id}`}
            href={`/maps/${region.id}.png`}
            x={minX}
            y={minY}
            width={Math.max(...xs) - minX}
            height={Math.max(...ys) - minY}
            preserveAspectRatio="none"
            pointerEvents="none"
          />
        );
      })}

      {/* Interaction / highlight layer */}
      {REGIONS.map((region) => {
        const fill =
          highlighted?.get(region.id) ??
          (hovered === region.id && tool === 'pan' ? 'rgba(255,255,255,0.12)' : 'transparent');
        return (
          <g key={region.id}>
            <polygon
              points={region.polygon.map((p) => p.join(',')).join(' ')}
              fill={fill}
              stroke="rgba(15,23,42,0.5)"
              strokeWidth={12}
              onMouseEnter={() => setHovered(region.id)}
              onMouseLeave={() => setHovered((h) => (h === region.id ? null : h))}
              onClick={() => clickRegion(region)}
              className={onRegionClick && tool === 'pan' ? 'cursor-pointer' : undefined}
            />
            <text
              x={region.center[0]}
              y={region.center[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={fontSize}
              fill="#f8fafc"
              stroke="#0f172a"
              strokeWidth={fontSize / 14}
              style={{ paintOrder: 'stroke' }}
              fontWeight={600}
              pointerEvents="none"
            >
              {region.name}
            </text>
          </g>
        );
      })}

      {/* Live War API structures / resource fields */}
      {visibleApiMarkers.map((m, i) => (
        <g key={`api-${i}`} pointerEvents="none">
          <circle
            cx={m.x}
            cy={m.y}
            r={apiIconSize * 0.62}
            fill="rgba(15,23,42,0.72)"
            stroke={m.ringColor}
            strokeWidth={apiIconSize * 0.09}
          />
          <image
            href={m.iconUrl}
            x={m.x - apiIconSize / 2}
            y={m.y - apiIconSize / 2}
            width={apiIconSize}
            height={apiIconSize}
          >
            <title>{m.title}</title>
          </image>
        </g>
      ))}

      {/* Route polyline */}
      {routePoints.length > 1 && (
        <polyline
          points={routePoints.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke={routeColor}
          strokeWidth={70}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="200 140"
          pointerEvents="none"
          opacity={0.9}
        />
      )}

      {/* Custom annotations */}
      {annotations.map((a) => {
        const color = ANNOTATION_COLORS[a.kind];
        const eraseProps =
          tool === 'erase'
            ? {
                onClick: () => onEraseAnnotation?.(a.id),
                className: 'cursor-pointer',
              }
            : { pointerEvents: 'none' as const };
        if ('pos' in a) {
          return (
            <g key={a.id} {...eraseProps}>
              <circle
                cx={a.pos[0]}
                cy={a.pos[1]}
                r={pointSize}
                fill={`${color}33`}
                stroke={color}
                strokeWidth={pointSize * 0.14}
              />
              <text
                x={a.pos[0]}
                y={a.pos[1]}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={pointSize}
                fill={color}
                fontWeight={700}
                pointerEvents="none"
              >
                {POINT_GLYPHS[a.kind]}
              </text>
            </g>
          );
        }
        return (
          <line
            key={a.id}
            x1={a.from[0]}
            y1={a.from[1]}
            x2={a.to[0]}
            y2={a.to[1]}
            stroke={color}
            strokeWidth={arrowWidth}
            strokeLinecap="round"
            markerEnd="url(#arrowhead)"
            opacity={0.95}
            {...eraseProps}
          />
        );
      })}

      {/* Arrow drawing preview */}
      {drawStart && drawEnd && isArrowTool && (
        <line
          x1={drawStart[0]}
          y1={drawStart[1]}
          x2={drawEnd[0]}
          y2={drawEnd[1]}
          stroke={ANNOTATION_COLORS[tool]}
          strokeWidth={arrowWidth}
          strokeDasharray={`${arrowWidth * 2} ${arrowWidth * 1.5}`}
          strokeLinecap="round"
          markerEnd="url(#arrowhead)"
          pointerEvents="none"
        />
      )}

      {/* Waypoint / objective badges */}
      {markers.map((marker, i) => {
        const region = REGIONS.find((r) => r.id === marker.regionId);
        if (!region) return null;
        const [cx, cy] = region.center;
        const r = 320;
        return (
          <g key={`${marker.regionId}-${i}`} pointerEvents="none">
            <circle cx={cx} cy={cy - 380} r={r} fill={marker.color} opacity={0.95} />
            <text
              x={cx}
              y={cy - 380}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={r}
              fill="#0f172a"
              fontWeight={700}
            >
              {marker.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
