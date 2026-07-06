import { z } from 'zod';
import { useAnnotationStore, type Annotation } from '../store/annotationStore';
import { useAttackStore } from '../store/attackStore';
import { useDeployStore } from '../store/deployStore';
import { useLogiStore } from '../store/logiStore';
import { usePlanStore } from '../store/planStore';

// ---------------------------------------------------------------------------
// A5 — full-app plan snapshot: capture/apply, JSON file, URL-hash sharing.
// ---------------------------------------------------------------------------

const target = z.object({ refId: z.string(), qty: z.number() });
const pos = z.tuple([z.number(), z.number()]);

const snapshotSchema = z.object({
  v: z.literal(1),
  name: z.string(),
  savedAt: z.number(),
  plan: z.object({
    targets: z.array(target),
    faction: z.enum(['Colonial', 'Warden']),
    stock: z.record(z.string(), z.number()),
  }),
  deploy: z.object({
    positions: z.record(z.string(), pos),
    transports: z.record(z.string(), z.string()),
  }),
  logi: z.object({
    cargo: z.array(z.object({ itemId: z.string(), qty: z.number() })),
    vehicleItemId: z.string().nullable(),
    waypoints: z.array(z.string()),
  }),
  attack: z.object({
    soldiers: z.number(),
    loadout: z.array(z.object({ itemId: z.string(), perSoldier: z.number() })),
    support: z.array(z.object({ itemId: z.string(), qty: z.number() })),
    objectiveRegion: z.string().nullable(),
    stagingRegion: z.string().nullable(),
  }),
  annotations: z.array(z.custom<Annotation>()),
});

export type PlanSnapshot = z.infer<typeof snapshotSchema>;

export function captureSnapshot(name: string): PlanSnapshot {
  const plan = usePlanStore.getState();
  const deploy = useDeployStore.getState();
  const logi = useLogiStore.getState();
  const attack = useAttackStore.getState();
  const annotations = useAnnotationStore.getState().annotations;
  return {
    v: 1,
    name,
    savedAt: Date.now(),
    plan: { targets: plan.targets, faction: plan.faction, stock: plan.stock },
    deploy: { positions: deploy.positions, transports: deploy.transports },
    logi: { cargo: logi.cargo, vehicleItemId: logi.vehicleItemId, waypoints: logi.waypoints },
    attack: {
      soldiers: attack.soldiers,
      loadout: attack.loadout,
      support: attack.support,
      objectiveRegion: attack.objectiveRegion,
      stagingRegion: attack.stagingRegion,
    },
    annotations,
  };
}

export function applySnapshot(raw: unknown): PlanSnapshot {
  const snap = snapshotSchema.parse(raw);
  const plan = usePlanStore.getState();
  plan.setFaction(snap.plan.faction);
  usePlanStore.setState({ stock: snap.plan.stock });
  plan.setTargets(snap.plan.targets); // recomputes with the restored stock
  useDeployStore.setState({
    positions: snap.deploy.positions,
    transports: snap.deploy.transports,
    placing: null,
    selectedEdge: null,
  });
  useLogiStore.setState(snap.logi);
  useAttackStore.setState(snap.attack);
  useAnnotationStore.setState({ annotations: snap.annotations, past: [], future: [] });
  return snap;
}

// --- URL sharing (A5.2): gzip via CompressionStream -> base64url ----------

async function pipe(data: Uint8Array, stream: { readable: ReadableStream; writable: WritableStream }) {
  const writer = stream.writable.getWriter();
  void writer.write(data as unknown as BufferSource);
  void writer.close();
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

const b64url = {
  encode: (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  decode: (s: string) =>
    Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
};

export async function encodeShareHash(snap: PlanSnapshot): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(snap));
  const gz = await pipe(json, new CompressionStream('gzip'));
  return `#p=${b64url.encode(gz)}`;
}

export async function decodeShareHash(hash: string): Promise<PlanSnapshot | null> {
  const m = hash.match(/#p=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const gz = b64url.decode(m[1]);
  const json = await pipe(gz, new DecompressionStream('gzip'));
  return snapshotSchema.parse(JSON.parse(new TextDecoder().decode(json)));
}
