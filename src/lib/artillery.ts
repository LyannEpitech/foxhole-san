import artilleryJson from '../data/artillery.json';
import { dataset } from '../data';
import type { Faction } from '../types/domain';

// B4 — spotter-style firing solution. Ranges are wiki-infobox values
// (A1_RangeMax "min-max", fetched 2026-07-07).

export interface ArtilleryPiece {
  id: string;
  min: number;
  max: number;
}

export const ARTILLERY: ArtilleryPiece[] = artilleryJson;

export function artilleryForFaction(faction: Faction): ArtilleryPiece[] {
  return ARTILLERY.filter((a) => {
    const item = dataset.items.get(a.id);
    return !item || item.faction === 'Both' || item.faction === faction;
  });
}

export interface FireSolution {
  distance: number;
  /** Compass azimuth in degrees (0 = north, clockwise). */
  azimuth: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Combine gun→spotter and spotter→target polar measurements into the
 * gun→target solution (plain vector addition in compass convention).
 */
export function solveFire(
  gunToSpotterDist: number,
  gunToSpotterAzimuth: number,
  spotterToTargetDist: number,
  spotterToTargetAzimuth: number,
): FireSolution {
  const x =
    gunToSpotterDist * Math.sin(toRad(gunToSpotterAzimuth)) +
    spotterToTargetDist * Math.sin(toRad(spotterToTargetAzimuth));
  const y =
    gunToSpotterDist * Math.cos(toRad(gunToSpotterAzimuth)) +
    spotterToTargetDist * Math.cos(toRad(spotterToTargetAzimuth));
  const distance = Math.hypot(x, y);
  const azimuth = (toDeg(Math.atan2(x, y)) + 360) % 360;
  return { distance, azimuth };
}
