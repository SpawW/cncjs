import get from 'lodash/get';
import { GRBL, MARLIN } from 'app/constants';

// Fallback maximum S value (100% power) when the controller does not report
// one. Matches the Grbl default of $30 = 1000.
export const MAX_S = 1000;

// Resolve the S value that corresponds to 100% laser power for the given
// controller. For Grbl this is $30 (Maximum spindle speed); Marlin uses 255.
export const resolveMaxS = (controller) => {
  const type = get(controller, 'type');

  if (type === GRBL) {
    const value = Number(get(controller, 'settings.settings.$30'));
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
    return MAX_S;
  }

  if (type === MARLIN) {
    return 255;
  }

  return MAX_S;
};

export const percentToS = (percent, maxS = MAX_S) => {
  const value = Number(percent);
  const max = Number(maxS);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (!Number.isFinite(max) || max <= 0) {
    return 0;
  }
  const clamped = Math.min(100, value);
  return Math.round((clamped / 100) * max);
};
