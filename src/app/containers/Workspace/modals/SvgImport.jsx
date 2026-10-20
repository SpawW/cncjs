import PropTypes from 'prop-types';
import React from 'react';
import { Form, Field } from 'react-final-form';
import { Input } from 'app/components/FormControl';
import FormGroup from 'app/components/FormGroup';
import { Row, Col } from 'app/components/GridSystem';
import Modal from 'app/components/Modal';
import { ToastNotification } from 'app/components/Notifications';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import { percentToS, resolveMaxS } from 'app/lib/laser';
import store from 'app/store';

const STORAGE_KEY = 'cncjs.import.lastValues';

const DEFAULT_VALUES = {
  feedRate: 300,
  travelRate: 3000,
  powerPercent: 100,
  laserMode: 'M4',
  engraveMode: 'line',
  fillSpacing: 0.2,
  fillAngle: 0,
  passes: 1,
  focusZ: '',
  z: '',
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  invertY: 'no',
  fan: 'yes',
};

// Restore the last values used in this dialog. Unknown keys are discarded so
// stale entries never leak into the form.
const sanitizeStoredValue = (key, value) => {
  if (key === 'engraveMode') {
    return ['line', 'fill', 'both'].includes(value) ? value : undefined;
  }
  if (key === 'laserMode') {
    return value === 'M3' || value === 'M4' ? value : undefined;
  }
  if (key === 'invertY' || key === 'fan') {
    return value === 'yes' || value === 'no' ? value : undefined;
  }
  return value;
};

const readStoredValues = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const values = {};
    Object.keys(DEFAULT_VALUES).forEach((key) => {
      const value = sanitizeStoredValue(key, parsed[key]);
      if (value !== undefined && value !== null) {
        values[key] = value;
      }
    });
    return values;
  } catch (err) {
    // Ignore unavailable or corrupted storage
    return {};
  }
};

const writeStoredValues = (values) => {
  try {
    const stored = {};
    Object.keys(DEFAULT_VALUES).forEach((key) => {
      if (values[key] !== undefined) {
        stored[key] = values[key];
      }
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (err) {
    // Ignore unavailable storage (private mode or quota exceeded)
  }
};

// Park target taken from the selected machine profile limits (the real bed
// size the user configured in CNCjs), in work coordinates.
const getParkTarget = () => {
  const machineProfile = store.get('workspace.machineProfile');
  const limits = machineProfile && machineProfile.limits;
  if (!limits) {
    return {};
  }
  const x = Number(limits.xmax);
  const y = Number(limits.ymax);
  if (Number.isFinite(x) && x > 0 && Number.isFinite(y) && y > 0) {
    return { parkX: x, parkY: y };
  }
  return {};
};

const parseOptions = (values, maxS, park) => {
  const toNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const optionalNumber = (value) => {
    if (value === '' || value === undefined || value === null) {
      return null;
    }
    return toNumber(value, null);
  };

  return {
    feedRate: toNumber(values.feedRate, 300),
    travelRate: toNumber(values.travelRate, 3000),
    power: percentToS(toNumber(values.powerPercent, 100), maxS),
    laserMode: values.laserMode === 'M3' ? 'M3' : 'M4',
    engraveMode: ['line', 'fill', 'both'].includes(values.engraveMode) ? values.engraveMode : 'line',
    fillSpacing: Math.max(0.01, toNumber(values.fillSpacing, 0.2)),
    fillAngle: toNumber(values.fillAngle, 0),
    passes: Math.max(1, Math.round(toNumber(values.passes, 1))),
    focusZ: optionalNumber(values.focusZ),
    z: optionalNumber(values.z),
    scale: toNumber(values.scale, 1),
    offsetX: toNumber(values.offsetX, 0),
    offsetY: toNumber(values.offsetY, 0),
    invertY: values.invertY !== 'no',
    fan: values.fan !== 'no',
    ...park,
  };
};

const SvgImport = ({ fileName, mode = 'svg', onClose, onSubmit }) => {
  const isStl = mode === 'stl';
  const maxS = resolveMaxS(controller);
  const park = getParkTarget();
  const initialValues = { ...DEFAULT_VALUES, ...readStoredValues() };

  return (
    <Modal size="sm" disableOverlay onClose={onClose}>
      <Form
        initialValues={initialValues}
        onSubmit={(values) => {
          writeStoredValues(values);
          onSubmit(parseOptions(values, maxS, park));
        }}
        render={({ handleSubmit, invalid, submitting, submitError, values }) => (
          <div>
            <Modal.Header>
              <Modal.Title>
                {isStl ? i18n._('Import STL') : i18n._('Import SVG')}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {submitError && (
                <ToastNotification
                  role="alert"
                  aria-live="assertive"
                  style={{ margin: '0 0 10px 0' }}
                  type="error"
                >
                  {submitError}
                </ToastNotification>
              )}
              {fileName && (
                <p style={{ wordBreak: 'break-all' }}>
                  {i18n._('File: {{name}}', { name: fileName })}
                </p>
              )}
              {isStl && (
                <Row>
                  <Col>
                    <Field name="z">
                      {({ input }) => (
                        <FormGroup>
                          <label>{i18n._('Slice Z (mm, optional)')}</label>
                          <Input aria-label="Slice Z" {...input} type="number" />
                        </FormGroup>
                      )}
                    </Field>
                  </Col>
                  <Col />
                </Row>
              )}
              <Row>
                <Col>
                  <Field name="feedRate">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Feed Rate (mm/min)')}</label>
                        <Input aria-label="Feed Rate" {...input} type="number" />
                      </FormGroup>
                    )}
                  </Field>
                </Col>
                <Col>
                  <Field name="travelRate">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Travel Rate (mm/min)')}</label>
                        <Input aria-label="Travel Rate" {...input} type="number" />
                      </FormGroup>
                    )}
                  </Field>
                </Col>
              </Row>
              <Row>
                <Col>
                  <Field name="powerPercent">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Power (%)')}</label>
                        <Input
                          aria-label="Power (%)" {...input} type="number"
                          min={0} max={100} step={1}
                        />
                        <small className="text-muted">
                          {`= S${percentToS(input.value, maxS)} · ${i18n._('Maximum value')} S${maxS}`}
                        </small>
                      </FormGroup>
                    )}
                  </Field>
                </Col>
                <Col>
                  <Field name="laserMode">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Laser Mode')}</label>
                        <select aria-label="Laser Mode" className="form-control" {...input}>
                          <option value="M4">{i18n._('M4 - Dynamic power')}</option>
                          <option value="M3">{i18n._('M3 - Constant power')}</option>
                        </select>
                      </FormGroup>
                    )}
                  </Field>
                </Col>
              </Row>
              <Row>
                <Col>
                  <Field name="engraveMode">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Engraving Mode')}</label>
                        <select aria-label="Engraving Mode" className="form-control" {...input}>
                          <option value="line">{i18n._('Line (outline)')}</option>
                          <option value="fill">{i18n._('Fill (hatch)')}</option>
                          <option value="both">{i18n._('Line + Fill')}</option>
                        </select>
                      </FormGroup>
                    )}
                  </Field>
                </Col>
                <Col>
                  {values.engraveMode !== 'line' && (
                    <Field name="fillSpacing">
                      {({ input }) => (
                        <FormGroup>
                          <label>{i18n._('Fill Spacing (mm)')}</label>
                          <Input
                            aria-label="Fill Spacing" {...input} type="number"
                            min={0.01} step={0.01}
                          />
                        </FormGroup>
                      )}
                    </Field>
                  )}
                </Col>
              </Row>
              {values.engraveMode !== 'line' && (
                <Row>
                  <Col>
                    <Field name="fillAngle">
                      {({ input }) => (
                        <FormGroup>
                          <label>{i18n._('Fill Angle (deg)')}</label>
                          <Input
                            aria-label="Fill Angle" {...input} type="number"
                            step={1}
                          />
                        </FormGroup>
                      )}
                    </Field>
                  </Col>
                  <Col />
                </Row>
              )}
              <Row>
                <Col>
                  <Field name="passes">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Passes')}</label>
                        <Input aria-label="Passes" {...input} type="number" />
                      </FormGroup>
                    )}
                  </Field>
                </Col>
                <Col>
                  <Field name="focusZ">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Focus Z (mm, optional)')}</label>
                        <Input aria-label="Focus Z" {...input} type="number" />
                      </FormGroup>
                    )}
                  </Field>
                </Col>
              </Row>
              <Row>
                <Col>
                  <Field name="scale">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Scale')}</label>
                        <Input aria-label="Scale" {...input} type="number" />
                      </FormGroup>
                    )}
                  </Field>
                </Col>
                <Col>
                  <Field name="invertY">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Invert Y Axis')}</label>
                        <select aria-label="Invert Y Axis" className="form-control" {...input}>
                          <option value="yes">{i18n._('Yes')}</option>
                          <option value="no">{i18n._('No')}</option>
                        </select>
                      </FormGroup>
                    )}
                  </Field>
                </Col>
              </Row>
              <Row>
                <Col>
                  <Field name="offsetX">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Offset X (mm)')}</label>
                        <Input aria-label="Offset X" {...input} type="number" />
                      </FormGroup>
                    )}
                  </Field>
                </Col>
                <Col>
                  <Field name="offsetY">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Offset Y (mm)')}</label>
                        <Input aria-label="Offset Y" {...input} type="number" />
                      </FormGroup>
                    )}
                  </Field>
                </Col>
              </Row>
              <Row>
                <Col>
                  <Field name="fan">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Fan (M8)')}</label>
                        <select aria-label="Fan (M8)" className="form-control" {...input}>
                          <option value="yes">{i18n._('Yes')}</option>
                          <option value="no">{i18n._('No')}</option>
                        </select>
                      </FormGroup>
                    )}
                  </Field>
                </Col>
                <Col />
              </Row>
            </Modal.Body>
            <Modal.Footer>
              <button
                type="button"
                className="btn btn-default"
                onClick={onClose}
              >
                {i18n._('Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={invalid || submitting}
                onClick={handleSubmit}
              >
                {submitting ? i18n._('Importing...') : i18n._('Import')}
              </button>
            </Modal.Footer>
          </div>
        )}
      />
    </Modal>
  );
};

SvgImport.propTypes = {
  fileName: PropTypes.string,
  mode: PropTypes.oneOf(['svg', 'stl']),
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default SvgImport;
