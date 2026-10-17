/* eslint-env jest */
import store from '../../store';
import { upload } from '../api.stl';

jest.mock('../../store', () => ({
  __esModule: true,
  default: {
    get: jest.fn()
  }
}));

const boxTriangles = (w = 20, h = 10, d = 5) => {
  const v = [
    [0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0],
    [0, 0, d], [w, 0, d], [w, h, d], [0, h, d],
  ];
  const faces = [
    [0, 1, 2], [0, 2, 3],
    [4, 6, 5], [4, 7, 6],
    [0, 1, 5], [0, 5, 4],
    [3, 2, 6], [3, 6, 7],
    [0, 3, 7], [0, 7, 4],
    [1, 2, 6], [1, 6, 5],
  ];
  return faces.map(face => face.map(index => v[index]));
};

const asciiStl = (triangles) => {
  const lines = ['solid test'];
  triangles.forEach((triangle) => {
    lines.push('  facet normal 0 0 0', '    outer loop');
    triangle.forEach(v => lines.push(`      vertex ${v[0]} ${v[1]} ${v[2]}`));
    lines.push('    endloop', '  endfacet');
  });
  lines.push('endsolid test');
  return lines.join('\n');
};

const STL = Buffer.from(asciiStl(boxTriangles()), 'utf8').toString('base64');

const makeReq = (body = {}) => ({ body });

const makeRes = () => {
  const res = { statusCode: 200, payload: undefined };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.send = (payload) => {
    res.payload = payload;
    return res;
  };
  return res;
};

describe('api.stl upload', () => {
  let controller;

  beforeEach(() => {
    controller = {
      command: jest.fn((name, gcodeName, gcode, context, callback) => {
        callback(null, { name: gcodeName, gcode });
      })
    };
    store.get.mockReturnValue(controller);
  });

  test('converts an STL and loads the resulting G-code', () => {
    const req = makeReq({ port: '/dev/ttyUSB0', name: 'box.stl', stl: STL, options: { power: 500 } });
    const res = makeRes();
    upload(req, res);

    expect(res.statusCode).toEqual(200);
    expect(controller.command).toHaveBeenCalledTimes(1);

    const [command, name, gcode, context, callback] = controller.command.mock.calls[0];
    expect(command).toEqual('gcode:load');
    expect(name).toEqual('box.stl');
    expect(context).toEqual({});
    expect(typeof callback).toEqual('function');
    expect(gcode).toContain('G21');
    expect(gcode).toContain('M4 S500');
    expect(res.payload.gcode).toContain('G21');
  });

  test('rejects a request without a port', () => {
    const res = makeRes();
    upload(makeReq({ stl: STL }), res);
    expect(res.statusCode).toEqual(400);
    expect(res.payload).toEqual({ msg: 'No port specified' });
    expect(controller.command).not.toHaveBeenCalled();
  });

  test('rejects a request without STL content', () => {
    const res = makeRes();
    upload(makeReq({ port: '/dev/ttyUSB0' }), res);
    expect(res.statusCode).toEqual(400);
    expect(res.payload).toEqual({ msg: 'Empty STL' });
  });

  test('rejects when the controller is not connected', () => {
    store.get.mockReturnValue(undefined);
    const res = makeRes();
    upload(makeReq({ port: '/dev/ttyUSB0', stl: STL }), res);
    expect(res.statusCode).toEqual(400);
    expect(res.payload).toEqual({ msg: 'Controller not found' });
  });

  test('rejects an invalid STL with details', () => {
    const res = makeRes();
    upload(makeReq({ port: '/dev/ttyUSB0', stl: Buffer.from('not an stl').toString('base64') }), res);
    expect(res.statusCode).toEqual(400);
    expect(res.payload.msg).toMatch(/Failed to convert STL/);
    expect(controller.command).not.toHaveBeenCalled();
  });

  test('reports a failure to load the generated G-code', () => {
    controller.command = jest.fn((name, gcodeName, gcode, context, callback) => {
      callback(new Error('load failed'));
    });
    store.get.mockReturnValue(controller);

    const res = makeRes();
    upload(makeReq({ port: '/dev/ttyUSB0', stl: STL }), res);
    expect(res.statusCode).toEqual(500);
    expect(res.payload.msg).toMatch(/Failed to load G-code/);
  });
});
