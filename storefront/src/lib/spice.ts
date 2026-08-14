import type { SpiceLevel } from '../types/api';

const SPICE_PEPPER_COUNT: Record<SpiceLevel, number> = { None: 0, Mild: 1, Medium: 2, Hot: 3 };

export function spiceIcon(level: SpiceLevel): string {
  return '🌶️'.repeat(SPICE_PEPPER_COUNT[level]);
}
