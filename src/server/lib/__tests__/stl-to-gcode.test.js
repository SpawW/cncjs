/* eslint-env jest */
import defaultConvert, { convertStlToGcode, parseStl } from '../stl-to-gcode';

const isFiniteGcode = (gcode) => !/(NaN|Infinity)/.test(gcode);

// Axis-aligned box from (0, 0, 0) to (w, h, d).
const boxTriangles = (w = 20, h = 10, d = 5) => {
  const v = [
    [0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0],
    [0, 0, d], [w, 0, d], [w, h, d], [0, h, d],
  ];
  const faces = [
    [0, 1, 2], [0, 2, 3], // bottom
    [4, 6, 5], [4, 7, 6], // top
    [0, 1, 5], [0, 5, 4], // front
    [3, 2, 6], [3, 6, 7], // back
    [0, 3, 7], [0, 7, 4], // left
    [1, 2, 6], [1, 6, 5], // right
  ];
  return faces.map(face => face.map(index => v[index]));
};

const writeAsciiStl = (triangles) => {
  const lines = ['solid test'];
  triangles.forEach((triangle) => {
    lines.push('  facet normal 0 0 0', '    outer loop');
    triangle.forEach(v => lines.push(`      vertex ${v[0]} ${v[1]} ${v[2]}`));
    lines.push('    endloop', '  endfacet');
  });
  lines.push('endsolid test');
  return lines.join('\n');
};

const writeBinaryStl = (triangles) => {
  const buffer = Buffer.alloc(84 + triangles.length * 50);
  buffer.writeUInt32LE(triangles.length, 80);
  let offset = 84;
  triangles.forEach((triangle) => {
    offset += 12; // normal
    triangle.forEach((v) => {
      buffer.writeFloatLE(v[0], offset);
      buffer.writeFloatLE(v[1], offset + 4);
      buffer.writeFloatLE(v[2], offset + 8);
      offset += 12;
    });
    offset += 2; // attribute byte count
  });
  return buffer;
};

describe('stl-to-gcode', () => {
  test('exports the converter as default and named export', () => {
    expect(defaultConvert).toBe(convertStlToGcode);
  });

  test('parses an ASCII STL', () => {
    const triangles = parseStl(writeAsciiStl(boxTriangles()));
    expect(triangles.length).toBe(12);
  });

  test('parses a binary STL', () => {
    const triangles = parseStl(writeBinaryStl(boxTriangles()));
    expect(triangles.length).toBe(12);
  });

  test('slices the middle of a box into a closed rectangle contour', () => {
    const { gcode, bbox, z } = convertStlToGcode(writeAsciiStl(boxTriangles(20, 10, 5)), {
      invertY: false,
    });

    expect(isFiniteGcode(gcode)).toBe(true);
    expect(gcode).toContain('G21');
    expect(gcode).toContain('G90');
    expect(gcode).toContain('M5');
    expect(z).toBeCloseTo(2.5, 6);
    expect(bbox.width).toBeCloseTo(20, 6);
    expect(bbox.height).toBeCloseTo(10, 6);
  });

  test('produces the same bounding box for binary and ASCII input', () => {
    const triangles = boxTriangles(20, 10, 5);
    const ascii = convertStlToGcode(writeAsciiStl(triangles), { invertY: false });
    const binary = convertStlToGcode(writeBinaryStl(triangles), { invertY: false });

    expect(binary.bbox.width).toBeCloseTo(ascii.bbox.width, 6);
    expect(binary.bbox.height).toBeCloseTo(ascii.bbox.height, 6);
  });

  test('honours the slice Z height', () => {
    const { z } = convertStlToGcode(writeAsciiStl(boxTriangles(20, 10, 5)), { z: 1 });
    expect(z).toBe(1);
  });

  test('applies a scale factor', () => {
    const { bbox } = convertStlToGcode(writeAsciiStl(boxTriangles(20, 10, 5)), {
      invertY: false,
      scale: 2,
    });
    expect(bbox.width).toBeCloseTo(40, 6);
    expect(bbox.height).toBeCloseTo(20, 6);
  });

  test('throws when the slice Z is outside the model', () => {
    expect(() => convertStlToGcode(writeAsciiStl(boxTriangles()), { z: 100 })).toThrow(
      'outside the model height'
    );
  });

  test('throws for an empty STL document', () => {
    expect(() => convertStlToGcode('solid empty\nendsolid empty')).toThrow(
      'No geometry found in STL file'
    );
  });
});
