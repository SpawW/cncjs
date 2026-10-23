import PropTypes from 'prop-types';
import React from 'react';
import { Form, Field } from 'react-final-form';
import { Input, Select } from 'app/components/FormControl';
import FormGroup from 'app/components/FormGroup';
import { Row, Col } from 'app/components/GridSystem';
import Modal from 'app/components/Modal';
import i18n from 'app/lib/i18n';
import { MATERIALS, OPERATIONS, getMaterialLabel, getOperationLabel } from 'app/lib/laserProfiles';

const SaveProfileModal = ({ initialValues, onClose, onSubmit }) => (
  <Modal size="sm" disableOverlay onClose={onClose}>
    <Form
      initialValues={initialValues}
      onSubmit={onSubmit}
      render={({ handleSubmit, invalid }) => (
        <div>
          <Modal.Header>
            <Modal.Title>
              {i18n._('Save Laser Profile As')}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Field
              name="name"
              validate={value => ((value && value.trim()) ? undefined : i18n._('This field is required.'))}
            >
              {({ input, meta }) => (
                <FormGroup>
                  <label>{i18n._('Name')}</label>
                  <Input aria-label="Profile name" {...input} type="text" />
                  {meta.touched && meta.error && (
                    <span className="text-danger">{meta.error}</span>
                  )}
                </FormGroup>
              )}
            </Field>
            <Row>
              <Col>
                <Field name="material">
                  {({ input }) => (
                    <FormGroup>
                      <label>{i18n._('Material Type')}</label>
                      <Select aria-label="Material Type" {...input}>
                        {MATERIALS.map(material => (
                          <option key={material.value} value={material.value}>
                            {getMaterialLabel(material.value)}
                          </option>
                        ))}
                      </Select>
                    </FormGroup>
                  )}
                </Field>
              </Col>
              <Col>
                <Field name="materialLabel">
                  {({ input }) => (
                    <FormGroup>
                      <label>{i18n._('Material Description')}</label>
                      <Input aria-label="Material Description" {...input} type="text" />
                    </FormGroup>
                  )}
                </Field>
              </Col>
            </Row>
            <Row>
              <Col>
                <Field name="thickness">
                  {({ input }) => (
                    <FormGroup>
                      <label>{i18n._('Thickness (mm)')}</label>
                      <Input aria-label="Thickness" {...input} type="number" min={0} step={0.1} />
                    </FormGroup>
                  )}
                </Field>
              </Col>
              <Col>
                <Field name="operation">
                  {({ input }) => (
                    <FormGroup>
                      <label>{i18n._('Operation')}</label>
                      <Select aria-label="Operation" {...input}>
                        {OPERATIONS.map(operation => (
                          <option key={operation.value} value={operation.value}>
                            {getOperationLabel(operation.value)}
                          </option>
                        ))}
                      </Select>
                    </FormGroup>
                  )}
                </Field>
              </Col>
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
              disabled={invalid}
              onClick={handleSubmit}
            >
              {i18n._('Save')}
            </button>
          </Modal.Footer>
        </div>
      )}
    />
  </Modal>
);

SaveProfileModal.propTypes = {
  initialValues: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default SaveProfileModal;
