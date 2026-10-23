/* eslint-env jest */
import config from '../../services/configstore';
import {
  create,
  fetch,
  read,
  update,
  __delete,
} from '../api.profiles';

jest.mock('../../services/configstore', () => {
  const state = {
    machines: [
      { id: 'machine-1', name: 'Mecpow M1' },
      { id: 'machine-2', name: 'Other Laser' },
    ],
    jobProfiles: [],
  };

  return {
    __esModule: true,
    default: {
      __state: state,
      get: jest.fn((key, defaultValue) => {
        return state[key] !== undefined ? state[key] : defaultValue;
      }),
      set: jest.fn((key, value) => {
        state[key] = value;
      }),
    },
  };
});

const makeReq = (body = {}, params = {}, query = {}) => ({ body, params, query });

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

const baseProfile = {
  machineProfileId: 'machine-1',
  name: 'MDF 3mm — Corte',
  material: 'wood',
  materialLabel: 'MDF',
  thickness: 3,
  operation: 'cut',
  params: {
    powerPercent: 85,
    laserMode: 'M4',
    feedRate: 180,
    travelRate: 3000,
    passes: 4,
    engraveMode: 'line',
    fillSpacing: 0.2,
    fillAngle: 0,
    fan: true,
  },
};

describe('api.profiles', () => {
  beforeEach(() => {
    config.__state.jobProfiles = [];
    config.get.mockClear();
    config.set.mockClear();
  });

  test('creates a profile bound to an existing machine profile', () => {
    const req = makeReq(baseProfile);
    const res = makeRes();

    create(req, res);

    expect(res.statusCode).toEqual(200);
    expect(res.payload.id).toBeTruthy();
    expect(res.payload.name).toEqual(baseProfile.name);
    expect(res.payload.machineProfileName).toEqual('Mecpow M1');
    expect(res.payload.params.passes).toEqual(4);
    expect(config.__state.jobProfiles).toHaveLength(1);
  });

  test('rejects a profile without a name', () => {
    const req = makeReq({ ...baseProfile, name: '  ' });
    const res = makeRes();

    create(req, res);

    expect(res.statusCode).toEqual(400);
    expect(config.__state.jobProfiles).toHaveLength(0);
  });

  test('rejects a profile with an unknown machine profile', () => {
    const req = makeReq({ ...baseProfile, machineProfileId: 'missing' });
    const res = makeRes();

    create(req, res);

    expect(res.statusCode).toEqual(400);
    expect(config.__state.jobProfiles).toHaveLength(0);
  });

  test('normalizes out-of-range params', () => {
    const req = makeReq({
      ...baseProfile,
      params: {
        ...baseProfile.params,
        powerPercent: 150,
        passes: 0,
        fillSpacing: -1,
      },
    });
    const res = makeRes();

    create(req, res);

    expect(res.payload.params.powerPercent).toEqual(100);
    expect(res.payload.params.passes).toEqual(1);
    expect(res.payload.params.fillSpacing).toEqual(0.01);
  });

  test('fetches profiles filtered by machine profile', () => {
    const other = {
      ...baseProfile,
      machineProfileId: 'machine-2',
      name: 'Vinyl — Corte',
      material: 'adhesive',
    };

    create(makeReq(baseProfile), makeRes());
    create(makeReq(other), makeRes());

    const res = makeRes();
    fetch(makeReq({}, {}, { machineProfileId: 'machine-1' }), res);

    expect(res.payload.records).toHaveLength(1);
    expect(res.payload.records[0].name).toEqual(baseProfile.name);
  });

  test('updates a profile keeping id and creation date', () => {
    const createRes = makeRes();
    create(makeReq(baseProfile), createRes);
    const created = createRes.payload;

    const res = makeRes();
    update(makeReq({ name: 'MDF 3mm — Corte lento', params: { passes: 6 } }, { id: created.id }), res);

    expect(res.statusCode).toEqual(200);
    expect(res.payload.id).toEqual(created.id);
    expect(res.payload.createdAt).toEqual(created.createdAt);
    expect(res.payload.name).toEqual('MDF 3mm — Corte lento');
    expect(res.payload.params.passes).toEqual(6);
    expect(res.payload.params.powerPercent).toEqual(85);
  });

  test('reads a profile by id', () => {
    const createRes = makeRes();
    create(makeReq(baseProfile), createRes);

    const res = makeRes();
    read(makeReq({}, { id: createRes.payload.id }), res);

    expect(res.statusCode).toEqual(200);
    expect(res.payload.name).toEqual(baseProfile.name);
  });

  test('returns 404 for an unknown profile', () => {
    const res = makeRes();
    read(makeReq({}, { id: 'missing' }), res);

    expect(res.statusCode).toEqual(404);
  });

  test('deletes a profile', () => {
    const createRes = makeRes();
    create(makeReq(baseProfile), createRes);

    const res = makeRes();
    __delete(makeReq({}, { id: createRes.payload.id }), res);

    expect(res.statusCode).toEqual(200);
    expect(config.__state.jobProfiles).toHaveLength(0);
  });
});
