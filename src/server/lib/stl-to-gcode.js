import { polylinesToGcode } from './svg-to-gcode';

/**
 * Convert an STL mesh into 2D G-code for laser engraving/cutting.
 *
 * The mesh is sliced with a horizontal plane (Z height) and the resulting
 * segments are chained into closed contours, which are then handed to the same
 * G-code emitter used by the SVG importer.
 */

const HEADER_BYTES = 80;
const TRIANGLE_BYTES = 50;
const EPS = 1e-9;

const DEFAULT_OPTIONS = {
  z: null, // Slice height (mm); defaults to the vertical middle of the model
  scale: 1, // Additional scale applied to the model units
};

const isBinaryStl = (buffer) => {
  if (buffer.length < HEADER_BYTES + 4) {
    return false;
  }
  const count = buffer.readUInt32LE(HEADER_BYTES);
  return buffer.length === HEADER_BYTES + 4 + count * TRIANGLE_BYTES;
};

const parseBinaryStl = (buffer) => {
  const count = buffer.readUInt32LE(HEADER_BYTES);
  const triangles = [];
  let offset = HEADER_BYTES + 4;
  for (let i = 0; i < count; i++) {
    offset += 12; // Skip the normal vector
    const triangle = [];
    for (let j = 0; j < 3; j++) {
      triangle.push([
        buffer.readFloatLE(offset),
        buffer.readFloatLE(offset + 4),
        buffer.readFloatLE(offset + 8),
      ]);
      offset += 12;
    }
    offset += 2; // Skip the attribute byte count
    triangles.push(triangle);
  }
  return triangles;
};

const parseAsciiStl = (text) => {
  const triangles = [];
  const vertices = [];
  const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    vertices.push([parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]);
  }
  for (let i = 0; i + 2 < vertices.length; i += 3) {
    triangles.push([vertices[i], vertices[i + 1], vertices[i + 2]]);
  }
  return triangles;
};

/**
 * Parse an STL file into a list of triangles.
 *
 * @param {Buffer|string} input - Binary STL buffer or ASCII STL text
 * @returns {Array<Array<[number, number, number]>>}
 */
export const parseStl = (input) => {
  let buffer;
  if (Buffer.isBuffer(input)) {
    buffer = input;
  } else if (typeof input === 'string') {
    buffer = Buffer.from(input, 'utf8');
  } else {
    throw new Error('Invalid STL input');
  }

  if (isBinaryStl(buffer)) {
    return parseBinaryStl(buffer);
  }

  const text = buffer.toString('utf8');
  if (!/(solid|facet)/i.test(text)) {
    throw new Error('Invalid or unsupported STL file');
  }
  return parseAsciiStl(text);
};

/**
 * Intersect the triangles with the plane z = zc and return the resulting 2D
 * segments. Points shared by neighbouring triangles reuse the same array
 * instance so they can be chained by reference.
 */
const sliceTriangles = (triangles, zc) => {
  const cache = new Map();
  const keyOf = (v) => `${v[0]},${v[1]},${v[2]}`;

  const vertexPoint = (v) => {
    const key = 'v:' + keyOf(v);
    let point = cache.get(key);
    if (!point) {
      point = [v[0], v[1]];
      cache.set(key, point);
    }
    return point;
  };

  const edgePoint = (a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    const key = 'e:' + (ka < kb ? ka + '|' + kb : kb + '|' + ka);
    let point = cache.get(key);
    if (!point) {
      const da = a[2] - zc;
      const db = b[2] - zc;
      const t = da / (da - db);
      point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      cache.set(key, point);
    }
    return point;
  };

  const segments = [];
  triangles.forEach((tri) => {
    const dz = [tri[0][2] - zc, tri[1][2] - zc, tri[2][2] - zc];
    if (dz.every(d => Math.abs(d) <= EPS)) {
      return; // Triangle is coplanar with the slice plane
    }

    const points = [];
    for (let i = 0; i < 3; i++) {
      const a = tri[i];
      const b = tri[(i + 1) % 3];
      const da = dz[i];
      const db = dz[(i + 1) % 3];
      const aOnPlane = Math.abs(da) <= EPS;
      const bOnPlane = Math.abs(db) <= EPS;

      if (aOnPlane && bOnPlane) {
        continue; // Edge lies on the plane, other edges provide the vertices
      } else if (aOnPlane) {
        points.push(vertexPoint(a));
      } else if (bOnPlane) {
        points.push(vertexPoint(b));
      } else if ((da < 0) !== (db < 0)) {
        points.push(edgePoint(a, b));
      }
    }

    if (points.length >= 2) {
      segments.push([points[0], points[1]]);
    }
  });

  return segments;
};

/**
 * Chain segments into polylines by joining shared endpoints.
 */
const chainSegments = (segments) => {
  const adjacency = new Map();
  segments.forEach((segment, index) => {
    segment.forEach((point) => {
      if (!adjacency.has(point)) {
        adjacency.set(point, []);
      }
      adjacency.get(point).push(index);
    });
  });

  const other = (segment, point) => (segment[0] === point ? segment[1] : segment[0]);
  const visited = new Array(segments.length).fill(false);
  const polylines = [];

  for (let i = 0; i < segments.length; i++) {
    if (visited[i]) {
      continue;
    }
    visited[i] = true;
    const polyline = [segments[i][0], segments[i][1]];

    const extend = (atEnd) => {
      let extended = true;
      while (extended) {
        extended = false;
        const point = atEnd ? polyline[polyline.length - 1] : polyline[0];
        const candidates = adjacency.get(point) || [];
        for (let j = 0; j < candidates.length; j++) {
          const index = candidates[j];
          if (visited[index]) {
            continue;
          }
          const next = other(segments[index], point);
          if (atEnd) {
            polyline.push(next);
          } else {
            polyline.unshift(next);
          }
          visited[index] = true;
          extended = true;
          break;
        }
      }
    };

    extend(true);
    extend(false);
    polylines.push(polyline);
  }

  return polylines;
};

/**
 * @typedef {object} StlToGcodeResult
 * @property {string} gcode - Generated G-code
 * @property {object} bbox - Bounding box in mm
 * @property {number} z - Slice height that was used (mm)
 * @property {number} minZ - Model minimum height (mm)
 * @property {number} maxZ - Model maximum height (mm)
 */

/**
 * Convert an STL file into G-code by slicing it at a given height.
 *
 * @param {Buffer|string} input - Binary STL buffer or ASCII STL text
 * @param {object} [options] - Conversion options
 * @returns {StlToGcodeResult}
 */
export const convertStlToGcode = (input, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const triangles = parseStl(input);

  if (triangles.length === 0) {
    throw new Error('No geometry found in STL file');
  }

  let minZ = Infinity;
  let maxZ = -Infinity;
  triangles.forEach((triangle) => {
    triangle.forEach((vertex) => {
      if (vertex[2] < minZ) {
        minZ = vertex[2];
      }
      if (vertex[2] > maxZ) {
        maxZ = vertex[2];
      }
    });
  });

  const zc = Number.isFinite(opts.z) ? opts.z : (minZ + maxZ) / 2;
  if (zc < minZ - EPS || zc > maxZ + EPS) {
    throw new Error(`Slice Z (${zc} mm) is outside the model height (${minZ} to ${maxZ} mm)`);
  }

  const segments = sliceTriangles(triangles, zc);
  if (segments.length === 0) {
    throw new Error('The slice did not intersect the model; adjust the Z height');
  }

  const scale = Number.isFinite(opts.scale) && opts.scale > 0 ? opts.scale : 1;
  const polylines = chainSegments(segments)
    .filter(polyline => polyline.length >= 2)
    .map(polyline => polyline.map(([x, y]) => [x * scale, y * scale]));

  const result = polylinesToGcode(polylines, {
    ...opts,
    comment: 'Generated by CNCjs STL importer',
  });

  return {
    ...result,
    z: zc,
    minZ,
    maxZ,
  };
};

export default convertStlToGcode;
