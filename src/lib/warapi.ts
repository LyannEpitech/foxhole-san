// Thin client for the official Foxhole War API (CORS-enabled).
// https://github.com/clapfoot/warapi
const API_BASE = 'https://war-service-live.foxholeservices.com/api';

export interface ApiMapItem {
  teamId: 'NONE' | 'WARDENS' | 'COLONIALS';
  iconType: number;
  /** Fraction of the hex bounding box (0..1), origin top-left. */
  x: number;
  y: number;
  flags: number;
}

interface DynamicMapResponse {
  regionId: number;
  mapItems: ApiMapItem[];
}

export async function fetchRegionDynamic(regionId: string): Promise<ApiMapItem[]> {
  const res = await fetch(`${API_BASE}/worldconquest/maps/${regionId}/dynamic/public`);
  if (!res.ok) throw new Error(`War API ${res.status} for ${regionId}`);
  const data = (await res.json()) as DynamicMapResponse;
  return data.mapItems;
}

/**
 * Fetch the dynamic map items of every region with bounded concurrency.
 * Calls `onProgress(done, total)` as regions complete; regions that fail
 * resolve to an empty list (the map stays usable offline).
 */
export async function fetchAllDynamic(
  regionIds: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, ApiMapItem[]>> {
  const out: Record<string, ApiMapItem[]> = {};
  let done = 0;
  const queue = [...regionIds];
  const workers = Array.from({ length: 8 }, async () => {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      try {
        out[id] = await fetchRegionDynamic(id);
      } catch {
        out[id] = [];
      }
      done += 1;
      onProgress?.(done, regionIds.length);
    }
  });
  await Promise.all(workers);
  return out;
}
