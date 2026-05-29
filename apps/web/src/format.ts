import { convertLengthToUnit, convertVolumeToUnit, Unit } from '@board-studio/units';

export type UnitSystem = 'metric' | 'imperial';

/** Format an internal centimeter length per the chosen unit system. */
export const fmtLen = (cm: number, sys: UnitSystem): string =>
  convertLengthToUnit(cm, true, sys === 'imperial' ? Unit.INCHES : Unit.CENTIMETERS);

/** Volume is always shown in liters (matches the legacy convention). */
export const fmtVol = (cm3: number): string => convertVolumeToUnit(cm3, Unit.CENTIMETERS);
