import { storage } from './mmkv';

export type MeasurementSystem = 'metric' | 'imperial' | 'auto';

const MEASUREMENT_PREFERENCE_KEY = 'measurement_system';

export function getMeasurementPreference(): MeasurementSystem {
  const stored = storage.getString(MEASUREMENT_PREFERENCE_KEY);
  return (stored as MeasurementSystem) || 'auto';
}

export function setMeasurementPreference(system: MeasurementSystem): void {
  storage.set(MEASUREMENT_PREFERENCE_KEY, system);
}

export function getMeasurementDisplayName(system: MeasurementSystem): string {
  switch (system) {
    case 'metric':
      return 'Metric (g, ml, °C)';
    case 'imperial':
      return 'Imperial (oz, cups, °F)';
    case 'auto':
      return 'Auto-detect';
    default:
      return 'Auto-detect';
  }
}
