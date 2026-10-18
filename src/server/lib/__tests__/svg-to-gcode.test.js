/* eslint-env jest */
import defaultConvert, { convertSvgToGcode } from '../svg-to-gcode';

const svg = (body, attrs = 'width="100mm" height="100mm" viewBox="0 0 100 100"') => (
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`
);

const isFiniteGcode = (gcode) => !/(NaN|Infinity)/.test(gcode);

describe('svg-to-gcode', () => {
  test('exports the converter as default and named export', () => {
    expect(defaultConvert).toBe(convertSvgToGcode);
  });

  test('generates G-code for a rectangle with the correct bounding box', () => {
    const { gcode, bbox } = convertSvgToGcode(svg('<rect x="10" y="20" width="30" height="40"/>'), {
      feedRate: 500,
      power: 800,
      laserMode: 'M3',
      invertY: false,
    });

    expect(isFiniteGcode(gcode)).toBe(true);
    expect(gcode).toContain('G21');
    expect(gcode).toContain('G90');
    expect(gcode).toContain('M5');
    expect(gcode).toContain('M3 S800');
    expect(gcode).toContain('F500');
    expect(bbox.width).toBeCloseTo(30, 3);
    expect(bbox.height).toBeCloseTo(40, 3);
  });

  test('maps every polygon point onto a G1 move', () => {
    const { gcode } = convertSvgToGcode(
      svg('<polygon points="0,0 10,0 10,10 0,10"/>'),
      { invertY: false }
    );
    const moves = gcode.split('\n').filter(line => line.startsWith('G1'));
    // 4 points, closed back to the first one.
    expect(moves.length).toBe(4);
  });

  test('converts circles into flattened arcs', () => {
    const { bbox } = convertSvgToGcode(
      svg('<circle cx="50" cy="50" r="20"/>'),
      { invertY: false, curveTolerance: 0.1 }
    );
    expect(bbox.width).toBeCloseTo(40, 1);
    expect(bbox.height).toBeCloseTo(40, 1);
  });

  test('flattens cubic and quadratic curves without NaN', () => {
    const { gcode } = convertSvgToGcode(
      svg('<path d="M0,0 C20,40 40,40 60,0 Q80,-40 100,0"/>'),
      { invertY: false, curveTolerance: 0.2 }
    );
    expect(isFiniteGcode(gcode)).toBe(true);
    const moves = gcode.split('\n').filter(line => line.startsWith('G1'));
    expect(moves.length).toBeGreaterThan(4);
  });

  test('applies nested group and element transforms', () => {
    const withTransform = convertSvgToGcode(
      svg('<g transform="translate(50,50)"><rect x="0" y="0" width="10" height="10"/></g>'),
      { invertY: false }
    ).bbox;
    const withoutTransform = convertSvgToGcode(
      svg('<rect x="0" y="0" width="10" height="10"/>'),
      { invertY: false }
    ).bbox;

    // Translation must not change the size, only the position.
    expect(withTransform.width).toBeCloseTo(withoutTransform.width, 3);
    expect(withTransform.height).toBeCloseTo(withoutTransform.height, 3);
    expect(withTransform.minX).toBeCloseTo(withoutTransform.minX, 3);
    expect(withTransform.minY).toBeCloseTo(withoutTransform.minY, 3);
  });

  test('scales by viewBox to the physical size of the SVG', () => {
    const { bbox } = convertSvgToGcode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 200 100">' +
      '<rect x="0" y="0" width="200" height="100"/></svg>',
      { invertY: false }
    );
    expect(bbox.width).toBeCloseTo(100, 1);
    expect(bbox.height).toBeCloseTo(50, 1);
  });

  test('inverts Y so the SVG top becomes the machine top', () => {
    const { gcode } = convertSvgToGcode(
      svg('<rect x="0" y="0" width="10" height="10"/>'),
      { invertY: true }
    );
    expect(gcode).toContain('G1 X0 Y0');
  });

  test('repeats the toolpath for multiple passes', () => {
    const { gcode } = convertSvgToGcode(
      svg('<line x1="0" y1="0" x2="10" y2="10"/>'),
      { passes: 3 }
    );
    expect(gcode).toContain('; Pass 1/3');
    expect(gcode).toContain('; Pass 3/3');
  });

  test('parks at the corner opposite to the origin at the end', () => {
    const { gcode, bbox } = convertSvgToGcode(
      svg('<rect x="10" y="20" width="30" height="40"/>'),
      { invertY: false }
    );
    const lastLine = gcode.trim().split('\n').pop();
    expect(lastLine).toBe(`G0 X${bbox.maxX} Y${bbox.maxY} ; Park away from origin`);
  });

  test('parks at the given target when provided', () => {
    const { gcode } = convertSvgToGcode(
      svg('<rect x="10" y="20" width="30" height="40"/>'),
      { invertY: false, parkX: 400, parkY: 300 }
    );
    const lastLine = gcode.trim().split('\n').pop();
    expect(lastLine).toBe('G0 X400 Y300 ; Park away from origin');
  });

  test('enables the fan with M8 at the start and M9 at the end when requested', () => {
    const { gcode } = convertSvgToGcode(
      svg('<line x1="0" y1="0" x2="10" y2="10"/>'),
      { fan: true }
    );
    expect(gcode).toMatch(/^M8\b/m);
    expect(gcode.trim().endsWith('M9 ; fan')).toBe(true);
    // M8 must come before the first cutting move
    expect(gcode.indexOf('M8')).toBeLessThan(gcode.indexOf('G1'));
  });

  test('does not emit fan commands by default', () => {
    const { gcode } = convertSvgToGcode(svg('<line x1="0" y1="0" x2="10" y2="10"/>'));
    expect(gcode).not.toMatch(/^M[89]\b/m);
  });

  test('throws for an empty document', () => {
    expect(() => convertSvgToGcode('')).toThrow('Empty SVG document');
  });

  test('throws when no vector geometry is present', () => {
    expect(() => convertSvgToGcode(svg('<text x="0" y="0">hello</text>'))).toThrow(
      'No drawable vector geometry found in SVG'
    );
  });

  test('throws for malformed XML', () => {
    expect(() => convertSvgToGcode('<svg><path d="M0,0"></svg>')).toThrow();
  });
});
