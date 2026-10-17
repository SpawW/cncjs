/* eslint-env jest */
import {
  getWorkAreaCorners,
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
      const commands = createSimulationCommands(controller, writeMotion, [
        { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } }, 1, 1000, 300,
      ]);

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
  });
});
