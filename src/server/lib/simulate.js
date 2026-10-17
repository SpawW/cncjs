import { ensurePositiveNumber } from 'ensure-type';

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Returns the four corners of a G-code bounding box, starting at the lower-left
// corner and going counter-clockwise.
// @param {object} bbox The bounding box reported by the visualizer (min/max x,y).
export const getWorkAreaCorners = (bbox = {}) => {
  const min = bbox.min || {};
  const max = bbox.max || {};
  const xmin = toNumber(min.x);
  const ymin = toNumber(min.y);
  const xmax = toNumber(max.x);
  const ymax = toNumber(max.y);

  return [
    { x: xmin, y: ymin },
    { x: xmax, y: ymin },
    { x: xmax, y: ymax },
    { x: xmin, y: ymax },
  ];
};

const reSpindleSpeed = /[sS](\d+(?:\.\d+)?)/g;
const reDwell = /^\s*G0?4(\s|$)/;

// Replays a G-code program with the laser (spindle) power clamped to a minimum.
// A positive `S` word is lowered to the minimum power, while `S0` (laser off)
// is preserved, so the original on/off pattern stays unchanged and the laser
// only lights up where the program would actually be engraving. Dwell lines
// (`G4 S...`) are left untouched so their timing is not altered.
// @param {string} gcode The loaded G-code program.
// @param {number} power The minimum power as a percentage of maxS.
// @param {number} maxS The maximum spindle speed (e.g. 1000 for Grbl, 255 for Marlin).
// @return {string} The transformed G-code program.
export const buildTraceProgram = (gcode, power = 0, maxS = 1000) => {
  const minS = Number((ensurePositiveNumber(maxS) * (ensurePositiveNumber(power) / 100)).toFixed(3));

  const lines = String(gcode || '').split(/\r?\n/).map((line) => {
    if (reDwell.test(line)) {
      return line;
    }

    return line.replace(reSpindleSpeed, (match, value) => {
      return (Number(value) > 0) ? `S${minS}` : 'S0';
    });
  });

  // Always turn the laser/spindle off when the simulation ends
  lines.push('M5');

  return lines.join('\n');
};

// Wires the `simulate:trace` and `simulate:corners` commands into a controller.
// `writeMotion` writes a single motion line through the controller's preferred
// channel, so that motion and laser commands stay in order on every controller:
// the feeder for Grbl/Marlin/TinyG, or a direct write for Smoothie (whose `fire`
// command cannot go through the feeder).
// @param {object} controller The controller instance.
// @param {function} writeMotion Callback that writes a single motion line.
// @param {Array} args The command arguments passed to `controller.command()`.
export const createSimulationCommands = (controller, writeMotion, args = []) => ({
  'simulate:trace': () => {
    const [gcode, power = 0, maxS = 1000] = args;
    controller.command('gcode', buildTraceProgram(gcode, power, maxS));
  },
  'simulate:corners': () => {
    const [bbox, power = 0, maxS = 1000, dwell = 300] = args;
    getWorkAreaCorners(bbox).forEach(({ x, y }) => {
      writeMotion(`G0 X${x} Y${y}`);
      controller.command('lasertest:on', power, dwell, maxS);
    });
  },
});

export default { getWorkAreaCorners, buildTraceProgram, createSimulationCommands };
