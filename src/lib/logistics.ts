import type { Dataset } from '../data';
import { getRegion } from '../data/regions';
import type { VehicleSpec } from '../types/domain';

// A3.3 — distance estimate: one hex is ~2.2 km corner to corner in-game;
// our world polygons are 2042 units wide. Straight-line waypoint legs,
// so real road routes will be somewhat longer (flagged as an estimate).
export const KM_PER_WORLD_UNIT = 2.2 / 2042;
/** Loading + unloading overhead per round trip (rough field estimate). */
export const HANDLING_MIN_PER_TRIP = 5;

export interface TravelEstimate {
  distanceKm: number;
  oneWayMinutes: number;
  /** trips × (2 × one-way + handling). */
  totalMinutes: number;
}

/** Polyline distance through the waypoints' region centers, in km. */
export function routeDistanceKm(waypoints: string[]): number {
  let units = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const a = getRegion(waypoints[i - 1])?.center;
    const b = getRegion(waypoints[i])?.center;
    if (!a || !b) continue;
    units += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return units * KM_PER_WORLD_UNIT;
}

/** A3.3/A3.4 — travel + rotation estimate for a route and trip count. */
export function estimateTravel(
  waypoints: string[],
  speedKmh: number | undefined,
  trips: number | null,
): TravelEstimate | null {
  if (!speedKmh || waypoints.length < 2) return null;
  const distanceKm = routeDistanceKm(waypoints);
  if (distanceKm === 0) return null;
  const oneWayMinutes = (distanceKm / speedKmh) * 60;
  const n = trips ?? 1;
  const totalMinutes = n * (2 * oneWayMinutes + HANDLING_MIN_PER_TRIP);
  return { distanceKm, oneWayMinutes, totalMinutes };
}

export interface CargoRow {
  itemId: string;
  qty: number;
}

export interface CargoPlanRow extends CargoRow {
  /** Crates needed to ship `qty` units (ceil by crate size). */
  crates: number;
}

export interface CargoPlan {
  rows: CargoPlanRow[];
  totalCrates: number;
  /** Round trips needed with the chosen vehicle (null if no vehicle chosen). */
  trips: number | null;
}

/**
 * Compute the crate/trip breakdown for a cargo manifest.
 * Items ship in crates of `amountProduced`; a vehicle carries
 * `capacityCrates` crates per trip.
 */
export function planCargo(
  data: Dataset,
  cargo: CargoRow[],
  vehicle: VehicleSpec | undefined,
): CargoPlan {
  const rows: CargoPlanRow[] = cargo
    .filter((row) => row.qty > 0 && data.items.has(row.itemId))
    .map((row) => {
      const item = data.items.get(row.itemId)!;
      return { ...row, crates: Math.ceil(row.qty / item.amountProduced) };
    });

  const totalCrates = rows.reduce((sum, r) => sum + r.crates, 0);
  const trips =
    vehicle && totalCrates > 0 ? Math.ceil(totalCrates / vehicle.capacityCrates) : null;

  return { rows, totalCrates, trips };
}
