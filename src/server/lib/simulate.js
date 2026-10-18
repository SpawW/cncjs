import { ensurePositiveNumber } from 'ensure-type';
import Toolpath from 'gcode-toolpath';
import logger from './logger';

const log = logger('simulate');

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
// End-of-program finishing moves (added by the SVG/STL importer) are not part
// of the design, so they are ignored when measuring the object and when tracing.
const reParkMove = /;\s*(Park away from origin|Return to origin)/i;

// Computes the XY bounding box of a G-code program, ignoring the end-of-program
// park move. Used to trace the work area of the actual object (with any import
// offset applied) without depending on the visualizer's state.
// @param {string} gcode The loaded G-code program.
// @return {{min: {x: number, y: number, z: number}, max: {x: number, y: number, z: number}}}
export const getGcodeBounds = (gcode) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const track = (x, y) => {
    if (Number.isFinite(x)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    if (Number.isFinite(y)) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  };

  const toolpath = new Toolpath({
    // Track only the end point of each move, matching the visualizer, so the
    // initial position (home) does not widen the object bounds.
    addLine: (modal, v1, v2) => {
      track(v2.x, v2.y);
    },
    addArcCurve: (modal, v1, v2) => {
      track(v2.x, v2.y);
    },
  });

  const content = String(gcode || '')
    .split(/\r?\n/)
    .filter(line => !reParkMove.test(line))
    .join('\n');
  toolpath.loadFromStringSync(content, () => {});

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }

  return {
    min: { x: minX, y: minY, z: 0 },
    max: { x: maxX, y: maxY, z: 0 },
  };
};

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

  const lines = String(gcode || '').split(/\r?\n/)
    .filter(line => !reParkMove.test(line))
    .map((line) => {
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
    const [gcode, power = 0, maxS = 1000, dwell = 300] = args;
    const bbox = getGcodeBounds(gcode);
    const corners = getWorkAreaCorners(bbox);
    const lines = String(gcode || '').split(/\r?\n/);
    log.debug(`simulate:corners bbox=${JSON.stringify(bbox)} corners=${JSON.stringify(corners)}`);
    log.debug(`simulate:corners gcode lines=${lines.length} head=${JSON.stringify(lines.slice(0, 10))} tail=${JSON.stringify(lines.slice(-6))}`);
    corners.forEach(({ x, y }) => {
      writeMotion(`G0 X${x} Y${y}`);
      controller.command('lasertest:on', power, dwell, maxS);
    });
  },
});

export default { getWorkAreaCorners, getGcodeBounds, buildTraceProgram, createSimulationCommands };
