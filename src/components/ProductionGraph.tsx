import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dataset } from '../data';
import type { PlanResult, RequirementNode } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { refName } from '../lib/refs';
import { formatDuration } from './PlanExtras';

interface GraphNode {
  refId: string;
  qty: number;
  kind: 'raw' | 'refined' | 'item';
  layer: number;
  /** Position, filled by the layout pass. */
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  qty: number;
}

const NODE_W = 176;
const NODE_H = 54;
const GAP_X = 110;
const GAP_Y = 26;
const PAD = 16;

const KIND_COLORS: Record<GraphNode['kind'], string> = {
  raw: '#34d399',
  refined: '#38bdf8',
  item: '#f59e0b',
};

/**
 * Layered flow diagram of a production plan: raw resources on the left,
 * refined materials in the middle, the finished product on the right.
 * Hovering a node shows where it is produced (building), order count and
 * time per order.
 */
export function ProductionGraph({ result }: { result: PlanResult }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const [hovered, setHovered] = useState<string | null>(null);

  const { nodes, edges, width, height } = useMemo(() => {
    // 1. Aggregate the requirement tree into a DAG (one node per refId).
    const qtyById = new Map<string, number>();
    const edgeMap = new Map<string, GraphEdge>();
    const visit = (node: RequirementNode) => {
      qtyById.set(node.refId, (qtyById.get(node.refId) ?? 0) + node.qty);
      for (const child of node.children) {
        const key = `${child.refId}->${node.refId}`;
        const edge = edgeMap.get(key) ?? { from: child.refId, to: node.refId, qty: 0 };
        edge.qty += child.qty;
        edgeMap.set(key, edge);
        visit(child);
      }
    };
    visit(result.tree);

    // 2. Longest-path layering: raw/leaf = 0, product = 1 + max(inputs).
    const layerById = new Map<string, number>();
    const layerOf = (refId: string): number => {
      const known = layerById.get(refId);
      if (known !== undefined) return known;
      const inputs = [...edgeMap.values()].filter((e) => e.to === refId);
      const layer =
        inputs.length === 0 ? 0 : 1 + Math.max(...inputs.map((e) => layerOf(e.from)));
      layerById.set(refId, layer);
      return layer;
    };
    for (const refId of qtyById.keys()) layerOf(refId);

    // 3. Column layout, vertically centered per layer.
    const maxLayer = Math.max(...layerById.values());
    const byLayer = new Map<number, string[]>();
    for (const [refId, layer] of layerById) {
      const bucket = byLayer.get(layer) ?? [];
      bucket.push(refId);
      byLayer.set(layer, bucket);
    }
    const tallest = Math.max(...[...byLayer.values()].map((ids) => ids.length));
    const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * GAP_Y;
    const width = PAD * 2 + (maxLayer + 1) * NODE_W + maxLayer * GAP_X;

    const nodes: GraphNode[] = [];
    for (const [layer, ids] of byLayer) {
      // Stable order: raw first alphabetically keeps the diagram calm.
      ids.sort((a, b) => a.localeCompare(b));
      const columnHeight = ids.length * NODE_H + (ids.length - 1) * GAP_Y;
      const startY = (height - columnHeight) / 2;
      ids.forEach((refId, i) => {
        const resource = dataset.resources.get(refId);
        nodes.push({
          refId,
          qty: qtyById.get(refId)!,
          kind: resource ? resource.kind : 'item',
          layer,
          x: PAD + layer * (NODE_W + GAP_X),
          y: startY + i * (NODE_H + GAP_Y),
        });
      });
    }

    return { nodes, edges: [...edgeMap.values()], width, height };
  }, [result]);

  const nodeById = new Map(nodes.map((n) => [n.refId, n]));
  const hoveredNode = hovered ? nodeById.get(hovered) : undefined;

  // Tooltip content for the hovered node.
  const tooltip = useMemo(() => {
    if (!hoveredNode) return null;
    const recipe = dataset.recipeByOutput.get(hoveredNode.refId);
    if (!recipe) {
      return { lines: [t('graph.gather')], building: null as string | null };
    }
    const building = dataset.buildings.get(recipe.buildingId)!;
    const output = recipe.outputs.find((o) => o.refId === hoveredNode.refId)!;
    const batches = Math.ceil(hoveredNode.qty / output.qty);
    const lines = [
      `${t('graph.batches')}: ${batches}`,
      ...(recipe.timeSeconds > 0
        ? [`${t('graph.timePerBatch')}: ${formatDuration(recipe.timeSeconds)}`]
        : []),
    ];
    return { lines, building: localized(building.name) };
  }, [hoveredNode, t, localized]);

  const isEdgeActive = (e: GraphEdge) =>
    hovered !== null && (e.from === hovered || e.to === hovered);

  return (
    <div className="relative overflow-x-auto">
      <svg width={width} height={height} className="block">
        <defs>
          <marker
            id="flow-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
          <marker
            id="flow-arrow-hot"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
          </marker>
        </defs>

        {/* Edges (bezier, left-to-right) with consumed quantities */}
        {edges.map((e) => {
          const from = nodeById.get(e.from)!;
          const to = nodeById.get(e.to)!;
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const mx = (x1 + x2) / 2;
          const active = isEdgeActive(e);
          return (
            <g key={`${e.from}->${e.to}`} opacity={hovered && !active ? 0.25 : 1}>
              <path
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 4} ${y2}`}
                fill="none"
                stroke={active ? '#f59e0b' : '#64748b'}
                strokeWidth={active ? 2.5 : 1.5}
                markerEnd={`url(#${active ? 'flow-arrow-hot' : 'flow-arrow'})`}
              />
              <text
                x={mx}
                y={(y1 + y2) / 2 - 6}
                textAnchor="middle"
                fontSize={11}
                fontFamily="monospace"
                fill={active ? '#fbbf24' : '#94a3b8'}
                stroke="#0f172a"
                strokeWidth={3}
                style={{ paintOrder: 'stroke' }}
              >
                ×{e.qty}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const color = KIND_COLORS[n.kind];
          const active = hovered === n.refId;
          return (
            <g
              key={n.refId}
              onMouseEnter={() => setHovered(n.refId)}
              onMouseLeave={() => setHovered((h) => (h === n.refId ? null : h))}
              className="cursor-help"
              opacity={hovered && !active && !edges.some(
                (e) => isEdgeActive(e) && (e.from === n.refId || e.to === n.refId),
              )
                ? 0.45
                : 1}
            >
              <rect
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                rx={10}
                fill="#1e293b"
                stroke={active ? '#f59e0b' : color}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <rect x={n.x} y={n.y} width={5} height={NODE_H} rx={2.5} fill={color} />
              <text
                x={n.x + 14}
                y={n.y + 21}
                fontSize={11}
                fontWeight={600}
                fill="#f1f5f9"
              >
                {(() => {
                  const label = localized(refName(n.refId));
                  return label.length > 27 ? `${label.slice(0, 26)}…` : label;
                })()}
              </text>
              <text
                x={n.x + 14}
                y={n.y + 40}
                fontSize={12}
                fontFamily="monospace"
                fill={color}
              >
                × {n.qty}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip: where can this be produced? */}
      {hoveredNode && tooltip && (
        <div
          className="absolute z-10 pointer-events-none rounded-lg border border-slate-600 bg-slate-900/95 px-3 py-2 text-xs shadow-xl max-w-60"
          style={{
            left: Math.min(hoveredNode.x + NODE_W + 10, width - 200),
            top: hoveredNode.y - 6,
          }}
        >
          <div className="font-semibold text-slate-100 text-sm">
            {localized(refName(hoveredNode.refId))}
          </div>
          {tooltip.building ? (
            <div className="text-amber-300 mt-0.5">
              🏭 {t('graph.producedAt')} : {tooltip.building}
            </div>
          ) : null}
          {tooltip.lines.map((line) => (
            <div key={line} className="text-slate-300">
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-xs text-slate-400">
        {(['raw', 'refined', 'item'] as const).map((kind) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: KIND_COLORS[kind] }}
            />
            {t(`graph.legend.${kind}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
