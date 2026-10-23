import { ensureString } from 'ensure-type';
import _castArray from 'lodash/castArray';
import _find from 'lodash/find';
import _isPlainObject from 'lodash/isPlainObject';
import uuid from 'uuid';
import settings from '../config/settings';
import logger from '../lib/logger';
import config from '../services/configstore';
import { getPagingRange } from './paging';
import {
  ERR_BAD_REQUEST,
  ERR_NOT_FOUND,
  ERR_INTERNAL_SERVER_ERROR
} from '../constants';

const log = logger('api:profiles');
const CONFIG_KEY = 'jobProfiles';

const MATERIALS = [
  'paper',
  'cardboard',
  'adhesive',
  'wood',
  'acrylic',
  'leather',
  'fabric',
  'glass',
  'metal',
  'pla',
  'abs',
  'petg',
  'other'
];

const OPERATIONS = ['engrave', 'cut'];
const ENGRAVE_MODES = ['line', 'fill', 'both'];
const LASER_MODES = ['M3', 'M4'];

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getMachines = () => _castArray(config.get('machines', []));

const findMachine = (machineProfileId) => {
  return _find(getMachines(), { id: machineProfileId });
};

const getSanitizedRecords = () => {
  const records = _castArray(config.get(CONFIG_KEY, []));

  let shouldUpdate = false;
  for (let i = 0; i < records.length; ++i) {
    if (!_isPlainObject(records[i])) {
      records[i] = {};
    }

    const record = records[i];

    if (!record.id) {
      record.id = uuid.v4();
      shouldUpdate = true;
    }
  }

  if (shouldUpdate) {
    log.debug(`update sanitized records: ${JSON.stringify(records)}`);

    // Pass `{ silent changes }` will suppress the change event
    config.set(CONFIG_KEY, records, { silent: true });
  }

  return records;
};

const ensureProfileParams = (payload = {}) => {
  const params = { ...payload };

  return {
    powerPercent: clamp(num(params.powerPercent, 100), 0, 100),
    laserMode: LASER_MODES.includes(params.laserMode) ? params.laserMode : 'M4',
    feedRate: Math.max(1, num(params.feedRate, 300)),
    travelRate: Math.max(1, num(params.travelRate, 3000)),
    passes: Math.max(1, Math.round(num(params.passes, 1))),
    engraveMode: ENGRAVE_MODES.includes(params.engraveMode) ? params.engraveMode : 'line',
    fillSpacing: Math.max(0.01, num(params.fillSpacing, 0.2)),
    fillAngle: num(params.fillAngle, 0),
    fan: params.fan === undefined ? true : !!params.fan,
  };
};

// Derives the machine profile name from the current machine list so a renamed
// machine is reflected everywhere without duplicating data.
const ensureLaserProfile = (payload = {}) => {
  const machineProfileId = ensureString(payload.machineProfileId);
  const machine = machineProfileId ? findMachine(machineProfileId) : null;
  const material = MATERIALS.includes(payload.material) ? payload.material : 'other';
  const operation = OPERATIONS.includes(payload.operation) ? payload.operation : 'engrave';

  return {
    id: payload.id,
    version: 1,
    machineProfileId,
    machineProfileName: machine ? ensureString(machine.name) : '',
    name: ensureString(payload.name).slice(0, 80),
    material,
    materialLabel: ensureString(payload.materialLabel).slice(0, 80),
    thickness: Math.max(0, num(payload.thickness, 0)),
    operation,
    notes: ensureString(payload.notes).slice(0, 500),
    favorite: !!payload.favorite,
    params: ensureProfileParams(payload.params),
    createdAt: ensureString(payload.createdAt),
    updatedAt: ensureString(payload.updatedAt),
  };
};

const validateMachineProfile = (machineProfileId) => {
  if (!machineProfileId) {
    return 'The "machineProfileId" parameter must not be empty';
  }
  if (!findMachine(machineProfileId)) {
    return 'The machine profile was not found';
  }
  return '';
};

export const fetch = (req, res) => {
  const { machineProfileId } = req.query;
  let records = getSanitizedRecords();

  if (machineProfileId) {
    records = records.filter(record => record.machineProfileId === machineProfileId);
  }

  // Favorites first, then alphabetical, so the setting holds for paging and
  // for the profile selector in the import dialog.
  records = [...records].sort((a, b) => {
    const favoriteDiff = Number(!!b.favorite) - Number(!!a.favorite);
    if (favoriteDiff !== 0) {
      return favoriteDiff;
    }
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  const paging = !!req.query.paging;

  if (paging) {
    const { page = 1, pageLength = 10 } = req.query;
    const totalRecords = records.length;
    const [begin, end] = getPagingRange({ page, pageLength, totalRecords });
    const pagedRecords = records.slice(begin, end);

    res.send({
      pagination: {
        page: Number(page),
        pageLength: Number(pageLength),
        totalRecords: Number(totalRecords)
      },
      records: pagedRecords.map(record => ensureLaserProfile(record))
    });
  } else {
    res.send({
      records: records.map(record => ensureLaserProfile(record))
    });
  }
};

export const create = (req, res) => {
  const record = { ...req.body };
  const name = ensureString(record.name).trim();

  if (!name) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'The "name" parameter must not be empty'
    });
    return;
  }

  const machineError = validateMachineProfile(record.machineProfileId);
  if (machineError) {
    res.status(ERR_BAD_REQUEST).send({ msg: machineError });
    return;
  }

  try {
    const records = getSanitizedRecords();
    const now = new Date().toISOString();
    const profile = ensureLaserProfile({
      ...record,
      id: uuid.v4(),
      name,
      createdAt: now,
      updatedAt: now,
    });

    records.push(profile);
    config.set(CONFIG_KEY, records);

    res.send(profile);
  } catch (err) {
    log.error(`Failed to create job profile: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to save ' + JSON.stringify(settings.rcfile)
    });
  }
};

export const read = (req, res) => {
  const id = req.params.id;
  const records = getSanitizedRecords();
  const record = _find(records, { id: id });

  if (!record) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Not found'
    });
    return;
  }

  res.send(ensureLaserProfile(record));
};

export const update = (req, res) => {
  const id = req.params.id;
  const records = getSanitizedRecords();
  const record = _find(records, { id: id });

  if (!record) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Not found'
    });
    return;
  }

  const nextRecord = { ...req.body };
  const name = ensureString(nextRecord.name !== undefined ? nextRecord.name : record.name).trim();

  if (!name) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'The "name" parameter must not be empty'
    });
    return;
  }

  const machineProfileId = nextRecord.machineProfileId !== undefined
    ? nextRecord.machineProfileId
    : record.machineProfileId;
  const machineError = validateMachineProfile(machineProfileId);

  if (machineError) {
    res.status(ERR_BAD_REQUEST).send({ msg: machineError });
    return;
  }

  try {
    const updated = ensureLaserProfile({
      ...record,
      ...nextRecord,
      id: record.id,
      name,
      machineProfileId,
      params: {
        ...(record.params || {}),
        ...((nextRecord.params && typeof nextRecord.params === 'object') ? nextRecord.params : {}),
      },
      createdAt: record.createdAt,
      updatedAt: new Date().toISOString(),
    });

    config.set(CONFIG_KEY, records.map(item => (item.id === record.id ? updated : item)));

    res.send(updated);
  } catch (err) {
    log.error(`Failed to update job profile: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to save ' + JSON.stringify(settings.rcfile)
    });
  }
};

export const __delete = (req, res) => {
  const id = req.params.id;
  const records = getSanitizedRecords();
  const record = _find(records, { id: id });

  if (!record) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Not found'
    });
    return;
  }

  try {
    const filteredRecords = records.filter(item => item.id !== id);
    config.set(CONFIG_KEY, filteredRecords);

    res.send({ id: record.id });
  } catch (err) {
    log.error(`Failed to delete job profile: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to save ' + JSON.stringify(settings.rcfile)
    });
  }
};
