/**
 * Live board weight estimate. The legacy WeightCalculatorDialog asked the user to
 * type foam volume, stringer, glass weights, resin ratio, hotcoat, plugs, etc.;
 * here we estimate it live from the kernel's volume + planshape area and two
 * preset pickers (foam type, glass schedule), the way a glasser quotes a board.
 * Rough but useful — a quoting aid, not a scale.
 */

export type FoamType = 'PU' | 'EPS';
export type GlassSchedule = '4+4' | '6+4' | '6+6' | '4+4+4';

/** Foam blank density, kg per litre (PU ~40 kg/m³, EPS ~28 kg/m³). */
export const FOAM_DENSITY: Record<FoamType, number> = { PU: 0.04, EPS: 0.028 };

export const FOAM_TYPES: FoamType[] = ['PU', 'EPS'];
export const GLASS_SCHEDULES: GlassSchedule[] = ['4+4', '6+4', '6+6', '4+4+4'];

/** Cloth layers (oz/yd²) per side for each schedule: [deck], [bottom]. */
const GLASS_LAYERS: Record<GlassSchedule, { deck: number[]; bottom: number[] }> = {
  '4+4': { deck: [4], bottom: [4] },
  '6+4': { deck: [6], bottom: [4] },
  '6+6': { deck: [6], bottom: [6] },
  '4+4+4': { deck: [4, 4], bottom: [4] },
};

/** 1 oz/yd² of cloth ≈ 33.9 g/m². */
const OZ_PER_SQYD_TO_GSM = 33.9;
/** Deck+bottom glass also wraps the rails: scale the covered area up a touch. */
const RAIL_WRAP = 1.15;
/** Total resin ≈ this × cloth mass — laminate + hotcoat + sand/gloss, hand lay-up. */
const RESIN_RATIO = 2.5;
/** Stringer contribution, kg (a thin wood/foam stringer). */
const STRINGER_KG = 0.18;
/** Plugs / leash / fin boxes, kg. */
const HARDWARE_KG = 0.25;

export interface WeightBreakdown {
  foam: number;
  cloth: number;
  resin: number;
  hardware: number;
  total: number; // kg
}

/**
 * Estimate board weight (kg) from blank volume (litres) and planshape area (m²).
 * Glass covers deck + bottom, each ≈ the planshape area.
 */
export function estimateWeight(
  volumeL: number,
  planAreaM2: number,
  foam: FoamType,
  glass: GlassSchedule,
): WeightBreakdown {
  const foamKg = volumeL * FOAM_DENSITY[foam] + STRINGER_KG;
  const sum = (a: number[]) => a.reduce((t, oz) => t + oz, 0);
  const layers = GLASS_LAYERS[glass];
  const clothGsm = (sum(layers.deck) + sum(layers.bottom)) * OZ_PER_SQYD_TO_GSM;
  const clothKg = (planAreaM2 * RAIL_WRAP * clothGsm) / 1000;
  const resinKg = clothKg * RESIN_RATIO;
  return {
    foam: foamKg,
    cloth: clothKg,
    resin: resinKg,
    hardware: HARDWARE_KG,
    total: foamKg + clothKg + resinKg + HARDWARE_KG,
  };
}

/** Format a kg weight as "x.x kg (y.y lb)". */
export function fmtWeight(kg: number): string {
  return `${kg.toFixed(2)} kg (${(kg * 2.2046226).toFixed(1)} lb)`;
}
