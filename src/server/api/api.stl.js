import store from '../store';
import { convertStlToGcode } from '../lib/stl-to-gcode';
import logger from '../lib/logger';
import {
  ERR_BAD_REQUEST,
  ERR_INTERNAL_SERVER_ERROR
} from '../constants';

const log = logger('api:stl');

export const upload = (req, res) => {
  const { port, name = 'noname.gcode', stl, options = {} } = req.body;

  if (!port) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'No port specified'
    });
    return;
  }
  if (!stl) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'Empty STL'
    });
    return;
  }

  const controller = store.get('controllers["' + port + '"]');
  if (!controller) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'Controller not found'
    });
    return;
  }

  let gcode;
  try {
    const buffer = Buffer.from(stl, 'base64');
    ({ gcode } = convertStlToGcode(buffer, options));
  } catch (err) {
    log.error(`Failed to convert STL: ${err.message}`);
    res.status(ERR_BAD_REQUEST).send({
      msg: 'Failed to convert STL: ' + err.message
    });
    return;
  }

  // Load G-code
  controller.command('gcode:load', name, gcode, {}, (err, state) => {
    if (err) {
      log.error(`Failed to load G-code: ${err}`);
      res.status(ERR_INTERNAL_SERVER_ERROR).send({
        msg: 'Failed to load G-code: ' + err
      });
      return;
    }

    res.send({ ...state });
  });
};
