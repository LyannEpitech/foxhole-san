import { useCallback, useRef, useState } from 'react';
import { REGIONS, WORLD_BOUNDS, type Region } from '../data/regions';
import type { Annotation, ToolId } from '../store/annotationStore';

export interface MapMarker {
  regionId: string;
  /** Small label rendered inside the badge (number, emoji…). */
  label: string;
  color: string;
}

/** A live marker from the War API, already resolved to world coordinates.
    All display strings arrive pre-localized so the map stays i18n-agnostic. */
export interface ApiMarker {
  x: number;
  y: number;
  iconUrl: string;
  ringColor: string;
  /** Structure name, e.g. "Raffinerie". */
  label: string;
  /** Marker family, e.g. "Industrie". */
  kindLabel: string;
  regionName: string;
  /** Owner faction display name (or "Neutre"). */
  factionLabel: string;
  /** Extra state badges (victory base, scorched…). */
  badges: string[];
  /** Destroyed world structure awaiting reconstruction (IsBuildSite). */
  buildSite?: boolean;
  /** War API icon type (for matching world structures to plan nodes). */
  iconType?: number;
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
  onAddStroke?: (points: [number, number][]) => void;
  onAddText?: (pos: [number, number], text: string) => void;
  onEraseAnnotation?: (id: string) => void;
  /** Placeholder for the inline text input. */
  textPlaceholder?: string;
  /** Height of the map viewport (CSS). */
  className?: string;
  /** Plain click on the map in pan mode (world coordinates). */
  onMapClick?: (pos: [number, number]) => void;
  /** Extra SVG rendered in world coordinates (above regions, below badges).
      Pass a function to receive the current viewport width in world units,
      so overlay elements can keep a constant on-screen size. */
  overlay?: React.ReactNode | ((ctx: { vw: number; zoom: number }) => React.ReactNode);
  /** B2 — per-region ownership tint (regionId -> rgba fill). */
  regionTint?: Map<string, string>;
  /** A2.1 — static town/field labels in world coordinates. */
  staticLabels?: { x: number; y: number; text: string; major: boolean }[];
}

const [BX, BY, BW, BH] = WORLD_BOUNDS;
const PAD = 400;
const VIEW = { x: BX - PAD, y: BY - PAD, w: BW + 2 * PAD, h: BH + 2 * PAD };
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
/** Below this zoom, API markers are grouped into count bubbles. */
const CLUSTER_MAX_ZOOM = 2.6;

export const ANNOTATION_COLORS: Record<string, string> = {
  friendly: '#38bdf8',
  enemy: '#ef4444',
  danger: '#facc15',
  arrowFriendly: '#38bdf8',
  arrowEnemy: '#ef4444',
  drawFriendly: '#38bdf8',
  drawEnemy: '#ef4444',
  text: '#f8fafc',
};

/** 24x24 stroke icon paths shared by the toolbar and the map markers. */
export const MARKER_PATHS: Record<string, string> = {
  friendly: 'M12 3l7 3v5c0 4.8-3.4 8.4-7 10-3.6-1.6-7-5.2-7-10V6z',
  enemy: 'M7 7l10 10M17 7L7 17',
  danger: 'M12 4l9 16H3zM12 11v4M12 17.6v.4',
};

/**
 * Interactive SVG map of the 53 world hexes rendered with the official
 * region art: pan (drag), zoom (wheel), clickable regions, highlights,
 * route polyline, badges, live War API markers and custom annotations
 * (markers, arrows, freehand strokes, text).
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
  onAddStroke,
  onAddText,
  onEraseAnnotation,
  textPlaceholder = '…',
  className,
  onMapClick,
  overlay,
  regionTint,
  staticLabels,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2]);
  const [hovered, setHovered] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [drawStart, setDrawStart] = useState<[number, number] | null>(null);
  const [drawEnd, setDrawEnd] = useState<[number, number] | null>(null);
  const [strokePoints, setStrokePoints] = useState<[number, number][] | null>(null);
  const [pendingText, setPendingText] = useState<[number, number] | null>(null);
  /** Hovered API marker + its position in CSS pixels inside the wrapper. */
  const [hoverInfo, setHoverInfo] = useState<{
    marker: ApiMarker;
    px: number;
    py: number;
    /** Container width at hover time, to flip the tooltip near the edge. */
    w: number;
  } | null>(null);

  const vw = VIEW.w / zoom;
  const vh = VIEW.h / zoom;
  const viewBox = `${center[0] - vw / 2} ${center[1] - vh / 2} ${vw} ${vh}`;

  const isArrowTool = tool === 'arrowFriendly' || tool === 'arrowEnemy';
  const isPointTool = tool === 'friendly' || tool === 'enemy' || tool === 'danger';
  const isDrawTool = tool === 'drawFriendly' || tool === 'drawEnemy';

  /** Convert a mouse event into world coordinates — via the SVG's screen
      matrix, so letterboxing from preserveAspectRatio can't skew clicks. */
  const toWorld = useCallback(
    (e: { clientX: number; clientY: number }): [number, number] => {
      const svg = svgRef.current!;
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
        return [p.x, p.y];
      }
      // Fallback (should not happen once mounted)
      const rect = svg.getBoundingClientRect();
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
    setHoverInfo(null);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (pendingText) return; // the inline input is open — let it handle events
    if (isArrowTool) {
      const pos = toWorld(e);
      setDrawStart(pos);
      setDrawEnd(pos);
      return;
    }
    if (isDrawTool) {
      setStrokePoints([toWorld(e)]);
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (strokePoints) {
      const p = toWorld(e);
      setStrokePoints((pts) => {
        if (!pts) return pts;
        const last = pts[pts.length - 1];
        // Light simplification: skip points closer than ~0.4% of the viewport.
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < vw * 0.004) return pts;
        return [...pts, p];
      });
      return;
    }
    if (drawStart) {
      setDrawEnd(toWorld(e));
      return;
    }
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    // Pan using the real screen scale (px per world unit) from the CTM.
    const ctm = svgRef.current!.getScreenCTM();
    const sx = ctm?.a || 1;
    const sy = ctm?.d || sx;
    setCenter(([cx, cy]) => [cx - dx / sx, cy - dy / sy]);
    drag.current.x = e.clientX;
    drag.current.y = e.clientY;
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (strokePoints) {
      if (strokePoints.length > 2) onAddStroke?.(strokePoints);
      setStrokePoints(null);
      return;
    }
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
    if (tool === 'text' && !drag.current?.moved && !pendingText) {
      setPendingText(toWorld(e));
    }
    if (tool === 'pan' && !drag.current?.moved) {
      onMapClick?.(toWorld(e));
    }
    drag.current = null;
  };

  const endDrag = () => {
    drag.current = null;
    setDrawStart(null);
    setDrawEnd(null);
    setStrokePoints(null);
  };

  const clickRegion = (region: Region) => {
    // Region selection only in pan mode, and not at the end of a pan gesture.
    if (tool !== 'pan' || drag.current?.moved) return;
    onRegionClick?.(region);
  };

  const commitText = (value: string) => {
    if (pendingText && value.trim()) onAddText?.(pendingText, value.trim());
    setPendingText(null);
  };

  const routePoints = route
    .map((id) => REGIONS.find((r) => r.id === id))
    .filter((r): r is Region => !!r)
    .map((r) => r.center);

  const fontSize = Math.max(180, 420 / zoom);
  // Sizes tied to the viewport so elements keep a constant on-screen size.
  const apiIconSize = vw * 0.018;
  const pointSize = vw * 0.022;
  const arrowWidth = vw * 0.007;
  const textSize = vw * 0.02;

  // Cull API markers outside the current viewport.
  const minVX = center[0] - vw / 2 - apiIconSize;
  const maxVX = center[0] + vw / 2 + apiIconSize;
  const minVY = center[1] - vh / 2 - apiIconSize;
  const maxVY = center[1] + vh / 2 + apiIconSize;
  const visibleApiMarkers = apiMarkers.filter(
    (m) => m.x >= minVX && m.x <= maxVX && m.y >= minVY && m.y <= maxVY,
  );

  // Screen-space grid clustering: when zoomed out, nearby structures merge
  // into count bubbles; zoomed in, individual icons are shown.
  const clusters: { x: number; y: number; members: ApiMarker[] }[] = [];
  if (zoom < CLUSTER_MAX_ZOOM && visibleApiMarkers.length > 0) {
    const cell = vw * 0.05;
    const byCell = new Map<string, ApiMarker[]>();
    for (const m of visibleApiMarkers) {
      const key = `${Math.floor(m.x / cell)}:${Math.floor(m.y / cell)}`;
      const bucket = byCell.get(key) ?? [];
      bucket.push(m);
      byCell.set(key, bucket);
    }
    for (const members of byCell.values()) {
      const x = members.reduce((s, m) => s + m.x, 0) / members.length;
      const y = members.reduce((s, m) => s + m.y, 0) / members.length;
      clusters.push({ x, y, members });
    }
  }

  const zoomTowards = (x: number, y: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, z * 1.9));
    setCenter([x, y]);
    setHoverInfo(null);
  };

  const cursorClass =
    tool === 'pan'
      ? 'cursor-grab active:cursor-grabbing'
      : tool === 'erase'
        ? 'cursor-pointer'
        : tool === 'text'
          ? 'cursor-text'
          : 'cursor-crosshair';

  return (
    <div className="relative w-full h-full">
    <svg
      ref={svgRef}
      viewBox={viewBox}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={endDrag}
      className={`${className ?? 'w-full h-full block'} ${cursorClass} select-none`}
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
            href={`${import.meta.env.BASE_URL}maps/${region.id}.png`}
            x={minX}
            y={minY}
            width={Math.max(...xs) - minX}
            height={Math.max(...ys) - minY}
            preserveAspectRatio="none"
            pointerEvents="none"
          />
        );
      })}

      {/* B2 — region ownership tint */}
      {regionTint &&
        REGIONS.map((region) => {
          const fill = regionTint.get(region.id);
          if (!fill) return null;
          return (
            <polygon
              key={`tint-${region.id}`}
              points={region.polygon.map((p) => p.join(',')).join(' ')}
              fill={fill}
              pointerEvents="none"
            />
          );
        })}

      {/* A2.1 — static town/field labels (zoomed-in only; majors first) */}
      {staticLabels &&
        zoom >= 2 &&
        staticLabels
          .filter(
            (l) =>
              (l.major || zoom >= 3) &&
              l.x >= minVX && l.x <= maxVX && l.y >= minVY && l.y <= maxVY,
          )
          .map((l, i) => (
            <text
              key={`lbl-${i}`}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={l.major ? vw * 0.011 : vw * 0.0085}
              fill={l.major ? '#fde68a' : '#e2e8f0'}
              stroke="#0f172a"
              strokeWidth={vw * 0.0009}
              style={{ paintOrder: 'stroke' }}
              fontWeight={l.major ? 700 : 500}
              pointerEvents="none"
              opacity={0.95}
            >
              {l.text}
            </text>
          ))}

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

      {/* Live War API structures — clustered when zoomed out */}
      {zoom < CLUSTER_MAX_ZOOM
        ? clusters.map((c, i) =>
            c.members.length === 1 ? (
              <g key={`cl-${i}`} pointerEvents="none">
                <circle
                  cx={c.members[0].x}
                  cy={c.members[0].y}
                  r={apiIconSize * 0.62}
                  fill="rgba(15,23,42,0.72)"
                  stroke={c.members[0].buildSite ? '#fb923c' : c.members[0].ringColor}
                  strokeWidth={apiIconSize * 0.09}
                  strokeDasharray={c.members[0].buildSite ? `${apiIconSize * 0.18} ${apiIconSize * 0.12}` : undefined}
                />
                <image
                  href={c.members[0].iconUrl}
                  x={c.members[0].x - apiIconSize / 2}
                  y={c.members[0].y - apiIconSize / 2}
                  width={apiIconSize}
                  height={apiIconSize}
                  opacity={c.members[0].buildSite ? 0.55 : 1}
                />
              </g>
            ) : (
              <g
                key={`cl-${i}`}
                className="cursor-zoom-in"
                onClick={(ev) => {
                  ev.stopPropagation();
                  zoomTowards(c.x, c.y);
                }}
              >
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={apiIconSize * (0.62 + Math.min(0.5, Math.log10(c.members.length) * 0.35))}
                  fill="rgba(15,23,42,0.82)"
                  stroke="#94a3b8"
                  strokeWidth={apiIconSize * 0.07}
                />
                <text
                  x={c.x}
                  y={c.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={apiIconSize * 0.62}
                  fontWeight={700}
                  fill="#e2e8f0"
                  pointerEvents="none"
                >
                  {c.members.length}
                </text>
              </g>
            ),
          )
        : visibleApiMarkers.map((m, i) => (
        <g
          key={`api-${i}`}
          // Hoverable only in pan mode so drawing tools are never blocked.
          pointerEvents={tool === 'pan' ? 'auto' : 'none'}
          onMouseEnter={(e) => {
            const rect = svgRef.current!.getBoundingClientRect();
            setHoverInfo({
              marker: m,
              px: e.clientX - rect.left,
              py: e.clientY - rect.top,
              w: rect.width,
            });
          }}
          onMouseLeave={() => setHoverInfo((h) => (h?.marker === m ? null : h))}
        >
          <circle
            cx={m.x}
            cy={m.y}
            r={apiIconSize * 0.62}
            fill="rgba(15,23,42,0.72)"
            stroke={m.buildSite ? '#fb923c' : m.ringColor}
            strokeWidth={apiIconSize * (hoverInfo?.marker === m ? 0.16 : 0.09)}
            strokeDasharray={m.buildSite ? `${apiIconSize * 0.18} ${apiIconSize * 0.12}` : undefined}
          />
          <image
            href={m.iconUrl}
            x={m.x - apiIconSize / 2}
            y={m.y - apiIconSize / 2}
            width={apiIconSize}
            height={apiIconSize}
            opacity={m.buildSite ? 0.55 : 1}
            pointerEvents="none"
          />
        </g>
      ))}

      {/* Module-specific world-coordinate overlay */}
      {typeof overlay === 'function' ? overlay({ vw, zoom }) : overlay}

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

        if (a.kind === 'text') {
          return (
            <text
              key={a.id}
              x={a.pos[0]}
              y={a.pos[1]}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={textSize}
              fill={color}
              stroke="#0f172a"
              strokeWidth={textSize / 10}
              style={{ paintOrder: 'stroke' }}
              fontWeight={700}
              {...eraseProps}
            >
              {a.text}
            </text>
          );
        }
        if ('points' in a) {
          return (
            <polyline
              key={a.id}
              points={a.points.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={arrowWidth * 0.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
              {...eraseProps}
            />
          );
        }
        if ('pos' in a) {
          const s = pointSize / 12; // scale a 24x24 icon to ~2*pointSize
          return (
            <g key={a.id} {...eraseProps}>
              <circle
                cx={a.pos[0]}
                cy={a.pos[1]}
                r={pointSize * 1.15}
                fill={`${color}2e`}
                stroke={color}
                strokeWidth={pointSize * 0.12}
              />
              <g
                transform={`translate(${a.pos[0] - 12 * s}, ${a.pos[1] - 12 * s}) scale(${s})`}
                pointerEvents="none"
              >
                <path
                  d={MARKER_PATHS[a.kind]}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
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

      {/* Freehand stroke preview */}
      {strokePoints && strokePoints.length > 1 && isDrawTool && (
        <polyline
          points={strokePoints.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke={ANNOTATION_COLORS[tool]}
          strokeWidth={arrowWidth * 0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
          pointerEvents="none"
        />
      )}

      {/* Inline text input */}
      {pendingText && (
        <foreignObject
          x={pendingText[0] - vw * 0.12}
          y={pendingText[1] - textSize}
          width={vw * 0.24}
          height={textSize * 2.4}
        >
          <input
            autoFocus
            placeholder={textPlaceholder}
            style={{
              width: '100%',
              fontSize: `${textSize}px`,
              padding: `${textSize * 0.15}px ${textSize * 0.4}px`,
              background: 'rgba(15,23,42,0.92)',
              color: '#f8fafc',
              border: `${Math.max(1, textSize * 0.06)}px solid #f59e0b`,
              borderRadius: textSize * 0.3,
              outline: 'none',
              textAlign: 'center',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setPendingText(null);
            }}
            onBlur={(e) => commitText(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </foreignObject>
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

    {/* Rich hover tooltip for War API structures */}
    {hoverInfo && (
      <div
        className="absolute z-10 pointer-events-none rounded-lg border bg-slate-900/95 px-3 py-2 text-xs shadow-xl max-w-56"
        style={{
          left: hoverInfo.px,
          top: hoverInfo.py,
          borderColor: hoverInfo.marker.ringColor,
          transform: `translate(${hoverInfo.px > 0.6 * hoverInfo.w ? 'calc(-100% - 14px)' : '14px'}, calc(-50%))`,
        }}
      >
        <div className="font-semibold text-slate-100 text-sm leading-tight">
          {hoverInfo.marker.label}
        </div>
        <div className="text-slate-400">{hoverInfo.marker.kindLabel}</div>
        <div className="mt-1 text-slate-300">📍 {hoverInfo.marker.regionName}</div>
        <div style={{ color: hoverInfo.marker.ringColor }}>
          ⚑ {hoverInfo.marker.factionLabel}
        </div>
        {hoverInfo.marker.badges.map((badge) => (
          <div key={badge} className="text-amber-300">
            ★ {badge}
          </div>
        ))}
      </div>
    )}
    </div>
  );
}
