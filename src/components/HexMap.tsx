import { useCallback, useRef, useState } from 'react';
import { REGIONS, WORLD_BOUNDS, type Region } from '../data/regions';

export interface MapMarker {
  regionId: string;
  /** Small label rendered inside the badge (number, emoji…). */
  label: string;
  color: string;
}

interface Props {
  onRegionClick?: (region: Region) => void;
  /** Region ids to highlight (fill). */
  highlighted?: Map<string, string>;
  /** Ordered polyline through region centers. */
  route?: string[];
  routeColor?: string;
  markers?: MapMarker[];
  /** Height of the map viewport (CSS). */
  className?: string;
}

const [BX, BY, BW, BH] = WORLD_BOUNDS;
const PAD = 400;
const VIEW = { x: BX - PAD, y: BY - PAD, w: BW + 2 * PAD, h: BH + 2 * PAD };
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

/**
 * Interactive SVG map of the 53 world hexes: pan (drag), zoom (wheel),
 * clickable regions, optional highlights, route polyline and markers.
 */
export function HexMap({
  onRegionClick,
  highlighted,
  route = [],
  routeColor = '#f59e0b',
  markers = [],
  className,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2]);
  const [hovered, setHovered] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const vw = VIEW.w / zoom;
  const vh = VIEW.h / zoom;
  const viewBox = `${center[0] - vw / 2} ${center[1] - vh / 2} ${vw} ${vh}`;

  /** Convert a mouse event into world coordinates. */
  const toWorld = useCallback(
    (e: React.MouseEvent | React.WheelEvent): [number, number] => {
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
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    const rect = svgRef.current!.getBoundingClientRect();
    setCenter(([cx, cy]) => [cx - (dx / rect.width) * vw, cy - (dy / rect.height) * vh]);
    drag.current.x = e.clientX;
    drag.current.y = e.clientY;
  };
  const endDrag = () => {
    drag.current = null;
  };

  const clickRegion = (region: Region) => {
    // Ignore the click at the end of a pan gesture.
    if (drag.current?.moved) return;
    onRegionClick?.(region);
  };

  const routePoints = route
    .map((id) => REGIONS.find((r) => r.id === id))
    .filter((r): r is Region => !!r)
    .map((r) => r.center);

  const fontSize = Math.max(180, 420 / zoom);

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      className={className ?? 'w-full h-[480px] cursor-grab active:cursor-grabbing select-none'}
      role="img"
    >
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
          (hovered === region.id ? 'rgba(255,255,255,0.12)' : 'transparent');
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
              className={onRegionClick ? 'cursor-pointer' : undefined}
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

      {/* Markers */}
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
