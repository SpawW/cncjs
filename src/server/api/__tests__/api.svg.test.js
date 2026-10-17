/* eslint-env jest */
import store from '../../store';
import { upload } from '../api.svg';

jest.mock('../../store', () => ({
  __esModule: true,
  default: {
    get: jest.fn()
  }
}));

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8"/></svg>';

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

describe('api.svg upload', () => {
  let controller;

  beforeEach(() => {
    controller = {
      command: jest.fn((name, gcodeName, gcode, context, callback) => {
        callback(null, { name: gcodeName, gcode });
      })
    };
    store.get.mockReturnValue(controller);
  });

  test('converts an SVG and loads the resulting G-code', () => {
    const req = makeReq({ port: '/dev/ttyUSB0', name: 'star.svg', svg: SVG, options: { power: 500 } });
    const res = makeRes();
    upload(req, res);

    expect(res.statusCode).toEqual(200);
    expect(controller.command).toHaveBeenCalledTimes(1);

    const [command, name, gcode, context, callback] = controller.command.mock.calls[0];
    expect(command).toEqual('gcode:load');
    expect(name).toEqual('star.svg');
    expect(context).toEqual({});
    expect(typeof callback).toEqual('function');
    expect(gcode).toContain('G21');
    expect(gcode).toContain('M4 S500');
    expect(res.payload.gcode).toContain('G21');
  });

  test('rejects a request without a port', () => {
    const res = makeRes();
    upload(makeReq({ svg: SVG }), res);
    expect(res.statusCode).toEqual(400);
    expect(res.payload).toEqual({ msg: 'No port specified' });
    expect(controller.command).not.toHaveBeenCalled();
  });

  test('rejects a request without SVG content', () => {
    const res = makeRes();
    upload(makeReq({ port: '/dev/ttyUSB0' }), res);
    expect(res.statusCode).toEqual(400);
    expect(res.payload).toEqual({ msg: 'Empty SVG' });
  });

  test('rejects when the controller is not connected', () => {
    store.get.mockReturnValue(undefined);
    const res = makeRes();
    upload(makeReq({ port: '/dev/ttyUSB0', svg: SVG }), res);
    expect(res.statusCode).toEqual(400);
    expect(res.payload).toEqual({ msg: 'Controller not found' });
  });

  test('rejects an invalid SVG with details', () => {
    const res = makeRes();
    upload(makeReq({ port: '/dev/ttyUSB0', svg: '<svg><text>x</text></svg>' }), res);
    expect(res.statusCode).toEqual(400);
    expect(res.payload.msg).toMatch(/Failed to convert SVG/);
    expect(controller.command).not.toHaveBeenCalled();
  });

  test('reports a failure to load the generated G-code', () => {
    controller.command = jest.fn((name, gcodeName, gcode, context, callback) => {
      callback(new Error('load failed'));
    });
    store.get.mockReturnValue(controller);

    const res = makeRes();
    upload(makeReq({ port: '/dev/ttyUSB0', svg: SVG }), res);
    expect(res.statusCode).toEqual(500);
    expect(res.payload.msg).toMatch(/Failed to load G-code/);
  });
});
