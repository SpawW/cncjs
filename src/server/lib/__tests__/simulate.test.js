/* eslint-env jest */
import {
  getWorkAreaCorners,
  getGcodeBounds,
  buildTraceProgram,
  createSimulationCommands,
} from '../simulate';

describe('simulate', () => {
  describe('getWorkAreaCorners', () => {
    test('returns the four corners of the bounding box in counter-clockwise order', () => {
      const bbox = { min: { x: -5, y: -3 }, max: { x: 10, y: 7 } };

      expect(getWorkAreaCorners(bbox)).toEqual([
        { x: -5, y: -3 },
        { x: 10, y: -3 },
        { x: 10, y: 7 },
        { x: -5, y: 7 },
      ]);
    });

    test('defaults missing values to zero', () => {
      expect(getWorkAreaCorners()).toEqual([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]);
    });
  });

  describe('buildTraceProgram', () => {
    test('clamps positive S words to the minimum power and keeps S0', () => {
      const gcode = [
        'G21',
        'M3 S0',
        'G1 X10 Y10 S500',
        'G1 X20 Y10 S0',
        'M5',
      ].join('\n');

      const lines = buildTraceProgram(gcode, 1, 1000).split('\n');

      expect(lines).toEqual([
        'G21',
        'M3 S0',
        'G1 X10 Y10 S10',
        'G1 X20 Y10 S0',
        'M5',
        'M5',
      ]);
    });

    test('clamps S words without a preceding space', () => {
      const lines = buildTraceProgram('M3S500', 2, 1000).split('\n');

      expect(lines).toEqual(['M3S20', 'M5']);
    });

    test('leaves dwell (G4) lines untouched', () => {
      const lines = buildTraceProgram('G4 S5', 1, 1000).split('\n');

      expect(lines).toEqual(['G4 S5', 'M5']);
    });

    test('appends M5 to turn the laser off at the end', () => {
      const lines = buildTraceProgram('G1 X1', 1, 1000).split('\n');

      expect(lines[lines.length - 1]).toBe('M5');
    });

    test('skips the end-of-program park move', () => {
      const gcode = 'G1 X1 Y1 S1000\nG0 X400 Y400 ; Park away from origin';
      const lines = buildTraceProgram(gcode, 1, 1000).split('\n');

      expect(lines.some(line => /Park away from origin/i.test(line))).toBe(false);
      expect(lines.some(line => /X400/.test(line))).toBe(false);
    });
  });

  describe('getGcodeBounds', () => {
    test('returns the XY bounds of the object, including the import offset', () => {
      const gcode = 'G0 X10 Y0\nG1 X30 Y0\nG1 X30 Y20\nG1 X10 Y20';
      expect(getGcodeBounds(gcode)).toEqual({
        min: { x: 10, y: 0, z: 0 },
        max: { x: 30, y: 20, z: 0 },
      });
    });

    test('ignores the end-of-program park move', () => {
      const gcode = 'G0 X10 Y0\nG1 X30 Y20\nG0 X400 Y400 ; Park away from origin';
      expect(getGcodeBounds(gcode)).toEqual({
        min: { x: 10, y: 0, z: 0 },
        max: { x: 30, y: 20, z: 0 },
      });
    });

    test('returns zero bounds when there is no motion', () => {
      expect(getGcodeBounds('G21\nG90\nM5')).toEqual({
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      });
    });
  });

  describe('createSimulationCommands', () => {
    test('simulate:trace feeds the clamped program through the gcode command', () => {
      const controller = { command: jest.fn() };
      const commands = createSimulationCommands(controller, jest.fn(), ['M3 S500', 1, 1000]);

      commands['simulate:trace']();

      expect(controller.command).toHaveBeenCalledTimes(1);
      const [cmd, program] = controller.command.mock.calls[0];
      expect(cmd).toBe('gcode');
      expect(program).toContain('M3 S10');
    });

    test('simulate:corners moves to each corner and pulses the laser in order', () => {
      const controller = { command: jest.fn() };
      const writeMotion = jest.fn();
      const gcode = 'G0 X0 Y0\nG1 X10 Y0\nG1 X10 Y10\nG1 X0 Y10';
      const commands = createSimulationCommands(controller, writeMotion, [gcode, 1, 1000, 300]);

      commands['simulate:corners']();

      expect(writeMotion.mock.calls).toEqual([
        ['G0 X0 Y0'],
        ['G0 X10 Y0'],
        ['G0 X10 Y10'],
        ['G0 X0 Y10'],
      ]);
      expect(controller.command.mock.calls).toEqual([
        ['lasertest:on', 1, 300, 1000],
        ['lasertest:on', 1, 300, 1000],
        ['lasertest:on', 1, 300, 1000],
        ['lasertest:on', 1, 300, 1000],
      ]);
    });

    test('simulate:corners traces the object bounds including the import offset and ignoring the park', () => {
      const controller = { command: jest.fn() };
      const writeMotion = jest.fn();
      const gcode = [
        'G0 X10 Y0',
        'G1 X30 Y0',
        'G1 X30 Y20',
        'G1 X10 Y20',
        'G0 X400 Y400 ; Park away from origin',
      ].join('\n');
      const commands = createSimulationCommands(controller, writeMotion, [gcode, 1, 1000, 300]);

      commands['simulate:corners']();

      expect(writeMotion.mock.calls).toEqual([
        ['G0 X10 Y0'],
        ['G0 X30 Y0'],
        ['G0 X30 Y20'],
        ['G0 X10 Y20'],
      ]);
    });
  });
});
