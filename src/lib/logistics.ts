import type { Dataset } from '../data';
import type { VehicleSpec } from '../types/domain';

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
