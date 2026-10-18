import svgpath from 'svgpath';
import { XMLParser } from 'fast-xml-parser';

/**
 * Convert SVG geometry (vector outlines) into GRBL-compatible G-code for laser
 * engraving/cutting.
 *
 * Only vector geometry is supported: path, line, polyline, polygon, rect,
 * circle and ellipse. Text, embedded raster images and CSS styles are ignored.
 */

const PX_TO_MM = 25.4 / 96; // 96 dpi

const UNIT_TO_MM = {
  '': PX_TO_MM,
  px: PX_TO_MM,
  mm: 1,
  cm: 10,
  in: 25.4,
  pt: 25.4 / 72,
  pc: 25.4 / 6,
};

const DEFAULT_OPTIONS = {
  feedRate: 300, // G1 cutting feed rate (mm/min)
  travelRate: 3000, // G0 rapid feed rate (mm/min)
  power: 1000, // Laser power (S word)
  laserMode: 'M4', // 'M3' (constant) or 'M4' (dynamic)
  passes: 1,
  focusZ: null, // Optional fixed Z position (mm)
  scale: 1, // Additional scale applied on top of the SVG size
  offsetX: 0, // X offset of the lower-left corner (mm)
  offsetY: 0, // Y offset of the lower-left corner (mm)
  invertY: true, // Flip Y (SVG grows down, machine grows up)
  curveTolerance: 0.2, // Max curve flattening error (mm)
  decimals: 3,
  fan: false, // Enable fan (M8) at start and M9 at end
};

const NUMERIC_RE = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([a-z%]*)\s*$/i;

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseLength = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'number') {
    return { value, unit: '' };
  }
  const match = NUMERIC_RE.exec(String(value));
  if (!match) {
    return null;
  }
  return { value: parseFloat(match[1]), unit: match[2].toLowerCase() };
};

const lengthToMm = (length) => {
  if (!length) {
    return null;
  }
  const factor = UNIT_TO_MM[length.unit];
  return Number.isFinite(factor) ? length.value * factor : null;
};

const formatNumber = (value, decimals) => {
  let s = value.toFixed(decimals);
  if (s.includes('.')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return s === '-0' ? '0' : s;
};

const parsePoints = (value) => {
  if (!value) {
    return [];
  }
  const numbers = String(value).match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || [];
  const points = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    points.push([parseFloat(numbers[i]), parseFloat(numbers[i + 1])]);
  }
  return points;
};

const rectToPath = (attrs) => {
  const x = num(attrs['@_x']);
  const y = num(attrs['@_y']);
  const width = num(attrs['@_width']);
  const height = num(attrs['@_height']);
  if (!(width > 0) || !(height > 0)) {
    return '';
  }
  let rx = num(attrs['@_rx'], -1);
  let ry = num(attrs['@_ry'], -1);
  if (rx < 0) {
    rx = ry >= 0 ? ry : 0;
  }
  if (ry < 0) {
    ry = rx;
  }
  rx = Math.min(rx, width / 2);
  ry = Math.min(ry, height / 2);
  if (rx <= 0 || ry <= 0) {
    return `M${x},${y} H${x + width} V${y + height} H${x} Z`;
  }
  return [
    `M${x + rx},${y}`,
    `H${x + width - rx}`,
    `A${rx},${ry} 0 0 1 ${x + width},${y + ry}`,
    `V${y + height - ry}`,
    `A${rx},${ry} 0 0 1 ${x + width - rx},${y + height}`,
    `H${x + rx}`,
    `A${rx},${ry} 0 0 1 ${x},${y + height - ry}`,
    `V${y + ry}`,
    `A${rx},${ry} 0 0 1 ${x + rx},${y}`,
    'Z',
  ].join(' ');
};

const ellipseToPath = (cx, cy, rx, ry) => {
  if (!(rx > 0) || !(ry > 0)) {
    return '';
  }
  return [
    `M${cx - rx},${cy}`,
    `A${rx},${ry} 0 1 0 ${cx + rx},${cy}`,
    `A${rx},${ry} 0 1 0 ${cx - rx},${cy}`,
    'Z',
  ].join(' ');
};

const GEOMETRY_TAGS = {
  path: (attrs) => attrs['@_d'] || '',
  line: (attrs) => `M${num(attrs['@_x1'])},${num(attrs['@_y1'])} L${num(attrs['@_x2'])},${num(attrs['@_y2'])}`,
  polyline: (attrs) => {
    const points = parsePoints(attrs['@_points']);
    return points.length >= 2 ? `M${points[0][0]},${points[0][1]} ` + points.slice(1).map(p => `L${p[0]},${p[1]}`).join(' ') : '';
  },
  polygon: (attrs) => {
    const points = parsePoints(attrs['@_points']);
    return points.length >= 2 ? `M${points[0][0]},${points[0][1]} ` + points.slice(1).map(p => `L${p[0]},${p[1]}`).join(' ') + ' Z' : '';
  },
  rect: rectToPath,
  circle: (attrs) => ellipseToPath(num(attrs['@_cx']), num(attrs['@_cy']), num(attrs['@_r']), num(attrs['@_r'])),
  ellipse: (attrs) => ellipseToPath(num(attrs['@_cx']), num(attrs['@_cy']), num(attrs['@_rx']), num(attrs['@_ry'])),
};

// Distance of point p from the line through a and b.
const pointLineDistance = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const denom = Math.hypot(dx, dy);
  if (denom === 0) {
    return Math.hypot(p[0] - a[0], p[1] - a[1]);
  }
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / denom;
};

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

const flattenCubic = (p0, p1, p2, p3, tolerance, out, depth = 0) => {
  if (depth >= 16 || (pointLineDistance(p1, p0, p3) <= tolerance && pointLineDistance(p2, p0, p3) <= tolerance)) {
    out.push(p3);
    return;
  }
  const p01 = mid(p0, p1);
  const p12 = mid(p1, p2);
  const p23 = mid(p2, p3);
  const p012 = mid(p01, p12);
  const p123 = mid(p12, p23);
  const p0123 = mid(p012, p123);
  flattenCubic(p0, p01, p012, p0123, tolerance, out, depth + 1);
  flattenCubic(p0123, p123, p23, p3, tolerance, out, depth + 1);
};

const quadraticToCubic = (p0, q, p2) => [
  p0,
  [p0[0] + (2 / 3) * (q[0] - p0[0]), p0[1] + (2 / 3) * (q[1] - p0[1])],
  [p2[0] + (2 / 3) * (q[0] - p2[0]), p2[1] + (2 / 3) * (q[1] - p2[1])],
  p2,
];

/**
 * Convert path data (already transformed to absolute user units) into a list of
 * polylines expressed in mm.
 */
const pathToPolylines = (d, transform, mapPoint, tolerance) => {
  let normalized = svgpath(d);
  if (transform) {
    normalized = normalized.transform(transform);
  }
  normalized = normalized.abs().unarc().unshort();

  const polylines = [];
  let current = null;
  let start = null;
  let cursor = [0, 0];
  const toMm = (x, y) => mapPoint(x, y);

  normalized.iterate((segment) => {
    const command = segment[0];
    switch (command) {
      case 'M': {
        cursor = [segment[1], segment[2]];
        start = cursor;
        current = [toMm(cursor[0], cursor[1])];
        polylines.push(current);
        break;
      }
      case 'L': {
        cursor = [segment[1], segment[2]];
        if (!current) {
          current = [toMm(cursor[0], cursor[1])];
          polylines.push(current);
          start = cursor;
        } else {
          current.push(toMm(cursor[0], cursor[1]));
        }
        break;
      }
      case 'H': {
        cursor = [segment[1], cursor[1]];
        if (current) {
          current.push(toMm(cursor[0], cursor[1]));
        }
        break;
      }
      case 'V': {
        cursor = [cursor[0], segment[1]];
        if (current) {
          current.push(toMm(cursor[0], cursor[1]));
        }
        break;
      }
      case 'C': {
        const p0 = toMm(cursor[0], cursor[1]);
        const p1 = toMm(segment[1], segment[2]);
        const p2 = toMm(segment[3], segment[4]);
        const p3 = toMm(segment[5], segment[6]);
        const points = [];
        if (!current) {
          current = [p0];
          polylines.push(current);
        }
        flattenCubic(p0, p1, p2, p3, tolerance, points);
        current.push(...points);
        cursor = [segment[5], segment[6]];
        break;
      }
      case 'Q': {
        const p0 = toMm(cursor[0], cursor[1]);
        const q = toMm(segment[1], segment[2]);
        const p3 = toMm(segment[3], segment[4]);
        const [c0, c1, c2, c3] = quadraticToCubic(p0, q, p3);
        const points = [];
        if (!current) {
          current = [c0];
          polylines.push(current);
        }
        flattenCubic(c0, c1, c2, c3, tolerance, points);
        current.push(...points);
        cursor = [segment[3], segment[4]];
        break;
      }
      case 'Z': {
        if (current && start) {
          current.push(toMm(start[0], start[1]));
        }
        cursor = start ? [...start] : cursor;
        current = null;
        start = null;
        break;
      }
      default:
        break;
    }
  });

  return polylines
    .map(polyline => polyline.filter((point, index) => (
      index === 0 ||
      Math.abs(point[0] - polyline[index - 1][0]) > 1e-9 ||
      Math.abs(point[1] - polyline[index - 1][1]) > 1e-9
    )))
    .filter(polyline => polyline.length >= 2);
};

const collectShapes = (nodes, parentTransform, out) => {
  nodes.forEach((node) => {
    if (node['#text'] !== undefined) {
      return;
    }
    const tag = Object.keys(node).find(key => key !== ':@');
    if (!tag) {
      return;
    }
    const attrs = node[':@'] || {};
    const transform = [
      parentTransform,
      attrs['@_transform'] || '',
    ].filter(Boolean).join(' ');

    if (typeof GEOMETRY_TAGS[tag] === 'function') {
      const d = GEOMETRY_TAGS[tag](attrs);
      if (d) {
        out.push({ d, transform });
      }
    }

    const children = node[tag];
    if (Array.isArray(children)) {
      collectShapes(children, transform, out);
    }
  });
};

const computeScale = (attrs) => {
  const viewBoxAttr = attrs['@_viewBox'];
  let viewBox = null;
  if (viewBoxAttr) {
    const numbers = String(viewBoxAttr).match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || [];
    if (numbers.length === 4) {
      viewBox = numbers.map(Number);
    }
  }

  const widthMm = lengthToMm(parseLength(attrs['@_width']));
  const heightMm = lengthToMm(parseLength(attrs['@_height']));
  const widthUser = parseLength(attrs['@_width']);
  const heightUser = parseLength(attrs['@_height']);

  let userToMm = PX_TO_MM;
  if (viewBox && viewBox[2] > 0 && viewBox[3] > 0) {
    const sx = widthMm !== null && widthMm > 0 ? widthMm / viewBox[2] : null;
    const sy = heightMm !== null && heightMm > 0 ? heightMm / viewBox[3] : null;
    if (sx !== null && sy !== null) {
      userToMm = Math.min(sx, sy);
    } else if (sx !== null) {
      userToMm = sx;
    } else if (sy !== null) {
      userToMm = sy;
    }
  } else if (!viewBox && widthUser && heightUser && widthMm && heightMm && widthUser.value > 0 && heightUser.value > 0) {
    viewBox = [0, 0, widthUser.value, heightUser.value];
    userToMm = Math.min(widthMm / widthUser.value, heightMm / heightUser.value);
  }

  return {
    viewBox: viewBox || [0, 0, 0, 0],
    userToMm,
  };
};

/**
 * @typedef {object} SvgToGcodeResult
 * @property {string} gcode - Generated G-code
 * @property {object} bbox - Bounding box in mm: { minX, minY, maxX, maxY, width, height }
 */

/**
 * Convert contour polylines expressed in millimeters into G-code. Shared by the
 * SVG and STL importers so both emit identical laser toolpaths.
 *
 * @param {Array<Array<[number, number]>>} inputPolylines - Contours in mm
 * @param {object} [options] - Conversion options
 * @returns {SvgToGcodeResult}
 */
export const polylinesToGcode = (inputPolylines, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let polylines = (inputPolylines || []).filter(polyline => (
    Array.isArray(polyline) && polyline.length >= 2
  ));

  if (polylines.length === 0) {
    throw new Error('No drawable geometry found');
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  polylines.forEach((polyline) => {
    polyline.forEach(([x, y]) => {
      if (x < minX) {
        minX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    });
  });

  const offsetX = num(opts.offsetX);
  const offsetY = num(opts.offsetY);
  const place = ([x, y]) => [
    offsetX + (x - minX),
    offsetY + (opts.invertY ? (maxY - y) : (y - minY)),
  ];
  polylines = polylines.map(polyline => polyline.map(place));

  const decimals = Math.max(0, Math.min(6, num(opts.decimals, 3)));
  const fmt = value => formatNumber(value, decimals);
  const laserMode = String(opts.laserMode).toUpperCase() === 'M3' ? 'M3' : 'M4';
  const passes = Math.max(1, Math.round(num(opts.passes, 1)));
  const power = num(opts.power, DEFAULT_OPTIONS.power);
  const comment = opts.comment || 'Generated by CNCjs importer';
  const enableFan = !!opts.fan;

  const lines = [
    `; ${comment}`,
    'G21 ; Units in millimeters',
    'G90 ; Absolute positioning',
    'M5 ; Laser off',
    `G0 F${fmt(num(opts.travelRate))} ; Travel feed rate`,
  ];
  if (opts.focusZ !== null && opts.focusZ !== undefined) {
    lines.push(`G0 Z${fmt(num(opts.focusZ))} ; Focus height`);
  }
  if (enableFan) {
    lines.push('M8 ; fan');
  }

  for (let pass = 1; pass <= passes; pass++) {
    lines.push(`; Pass ${pass}/${passes}`);
    polylines.forEach((polyline) => {
      const [startX, startY] = polyline[0];
      lines.push(`G0 X${fmt(startX)} Y${fmt(startY)}`);
      lines.push(`${laserMode} S${fmt(power)}`);
      for (let i = 1; i < polyline.length; i++) {
        const [x, y] = polyline[i];
        lines.push(`G1 X${fmt(x)} Y${fmt(y)} F${fmt(num(opts.feedRate))}`);
      }
      lines.push('M5');
    });
  }

  const bbox = {
    minX: offsetX,
    minY: offsetY,
    maxX: offsetX + (maxX - minX),
    maxY: offsetY + (maxY - minY),
    width: maxX - minX,
    height: maxY - minY,
  };

  // Park at the corner opposite to the origin (home) so the finished part is
  // clear of the laser head and can be removed safely. Uses the target given
  // by the caller (e.g. the selected machine profile limits), otherwise falls
  // back to the design bounds.
  const parkX = opts.parkX == null ? NaN : num(opts.parkX, NaN);
  const parkY = opts.parkY == null ? NaN : num(opts.parkY, NaN);
  const hasPark = Number.isFinite(parkX) && Number.isFinite(parkY);
  const parkTargetX = hasPark ? parkX : bbox.maxX;
  const parkTargetY = hasPark ? parkY : bbox.maxY;

  lines.push('M5 ; Laser off');
  lines.push(`G0 X${fmt(parkTargetX)} Y${fmt(parkTargetY)} ; Park away from origin`);
  if (enableFan) {
    lines.push('M9 ; fan');
  }

  return {
    gcode: lines.join('\n') + '\n',
    bbox,
  };
};

/**
 * Convert an SVG string into G-code.
 *
 * @param {string} svgString - SVG document
 * @param {object} [options] - Conversion options
 * @returns {SvgToGcodeResult}
 */
export const convertSvgToGcode = (svgString, options = {}) => {
  if (typeof svgString !== 'string' || svgString.trim() === '') {
    throw new Error('Empty SVG document');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    preserveOrder: true,
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
    allowBooleanAttributes: true,
  });

  let parsed;
  try {
    parsed = parser.parse(svgString);
  } catch (err) {
    throw new Error('Invalid SVG document: ' + err.message);
  }

  const rootNode = Array.isArray(parsed) ? parsed.find(node => node.svg !== undefined) : null;
  if (!rootNode) {
    throw new Error('Invalid SVG document: <svg> element not found');
  }

  const rootAttrs = rootNode[':@'] || {};
  const { viewBox, userToMm: baseScale } = computeScale(rootAttrs);
  const scale = baseScale * (Number.isFinite(opts.scale) ? opts.scale : 1);

  // Transform user units into mm (scaling + viewBox origin shift); Y flip and
  // offsets are applied after the bounding box is known.
  const mapPoint = (x, y) => [
    (x - viewBox[0]) * scale,
    (y - viewBox[1]) * scale,
  ];

  const shapes = [];
  collectShapes(rootNode.svg, '', shapes);

  const tolerance = Math.max(opts.curveTolerance, 1e-4);
  let polylines = [];
  shapes.forEach(({ d, transform }) => {
    polylines = polylines.concat(pathToPolylines(d, transform, mapPoint, tolerance));
  });

  if (polylines.length === 0) {
    throw new Error('No drawable vector geometry found in SVG');
  }

  return polylinesToGcode(polylines, {
    ...opts,
    comment: 'Generated by CNCjs SVG importer',
  });
};

export default convertSvgToGcode;
