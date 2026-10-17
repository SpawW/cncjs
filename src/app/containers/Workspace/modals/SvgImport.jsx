import PropTypes from 'prop-types';
import React from 'react';
import { Form, Field } from 'react-final-form';
import { Input } from 'app/components/FormControl';
import FormGroup from 'app/components/FormGroup';
import { Row, Col } from 'app/components/GridSystem';
import Modal from 'app/components/Modal';
import { ToastNotification } from 'app/components/Notifications';
import i18n from 'app/lib/i18n';

const parseOptions = (values) => {
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
    power: toNumber(values.power, 1000),
    laserMode: values.laserMode === 'M3' ? 'M3' : 'M4',
    passes: Math.max(1, Math.round(toNumber(values.passes, 1))),
    focusZ: optionalNumber(values.focusZ),
    z: optionalNumber(values.z),
    scale: toNumber(values.scale, 1),
    offsetX: toNumber(values.offsetX, 0),
    offsetY: toNumber(values.offsetY, 0),
    invertY: values.invertY !== 'no',
    fan: values.fan !== 'no',
  };
};

const SvgImport = ({ fileName, mode = 'svg', onClose, onSubmit }) => {
  const isStl = mode === 'stl';

  return (
    <Modal size="sm" disableOverlay onClose={onClose}>
      <Form
        initialValues={{
          feedRate: 300,
          travelRate: 3000,
          power: 1000,
          laserMode: 'M4',
          passes: 1,
          focusZ: '',
          z: '',
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          invertY: 'yes',
          fan: 'yes',
        }}
        onSubmit={(values) => onSubmit(parseOptions(values))}
        render={({ handleSubmit, invalid, submitting, submitError }) => (
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
                  <Field name="power">
                    {({ input }) => (
                      <FormGroup>
                        <label>{i18n._('Power (S)')}</label>
                        <Input aria-label="Power" {...input} type="number" />
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
