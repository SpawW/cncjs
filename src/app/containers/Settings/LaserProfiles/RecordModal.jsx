import _get from 'lodash/get';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Form, Field } from 'react-final-form';
import { Input, Select, Textarea } from 'app/components/FormControl';
import FormGroup from 'app/components/FormGroup';
import { Row, Col } from 'app/components/GridSystem';
import Margin from 'app/components/Margin';
import Modal from 'app/components/Modal';
import { ToastNotification } from 'app/components/Notifications';
import SectionGroup from 'app/components/SectionGroup';
import SectionTitle from 'app/components/SectionTitle';
import i18n from 'app/lib/i18n';
import store from 'app/store';
import {
  DEFAULT_PROFILE_PARAMS,
  MATERIALS,
  OPERATIONS,
  formValuesToProfileParams,
  getMaterialLabel,
  getOperationLabel,
  profileToFormValues,
} from 'app/lib/laserProfiles';
import Error from '../common/Error';
import * as validations from '../common/validations';

class RecordModal extends Component {
    static propTypes = {
      mode: PropTypes.oneOf(['create', 'update']),
      state: PropTypes.object,
      actions: PropTypes.object,
      machines: PropTypes.array,
      machinesError: PropTypes.bool,
    };

    state = this.getInitialState();

    getInitialState() {
      const { mode, state, machines } = this.props;
      const record = state.modal.params || {};
      const isUpdate = mode === 'update';
      const firstMachine = machines && machines.length > 0 ? machines[0] : null;
      const currentMachineProfile = store.get('workspace.machineProfile') || {};

      if (isUpdate) {
        return {
          values: {
            name: _get(record, 'name', ''),
            machineProfileId: _get(record, 'machineProfileId', ''),
            material: _get(record, 'material', 'wood'),
            materialLabel: _get(record, 'materialLabel', ''),
            thickness: Number(_get(record, 'thickness', 0)) || 0,
            operation: _get(record, 'operation', 'cut'),
            notes: _get(record, 'notes', ''),
            favorite: !!_get(record, 'favorite', false),
            ...profileToFormValues(record),
          }
        };
      }

      return {
        values: {
          name: '',
          machineProfileId: _get(
            record,
            'machineProfileId',
            currentMachineProfile.id || (firstMachine ? firstMachine.id : '')
          ),
          material: 'wood',
          materialLabel: '',
          thickness: 0,
          operation: 'cut',
          notes: '',
          favorite: false,
          ...DEFAULT_PROFILE_PARAMS,
          fan: DEFAULT_PROFILE_PARAMS.fan ? 'yes' : 'no',
        }
      };
    }

    onSubmit = (values) => {
      const { mode, state, actions } = this.props;

      const payload = {
        name: _get(values, 'name', ''),
        machineProfileId: _get(values, 'machineProfileId', ''),
        material: _get(values, 'material', 'other'),
        materialLabel: _get(values, 'materialLabel', ''),
        thickness: Number(_get(values, 'thickness', 0)) || 0,
        operation: _get(values, 'operation', 'cut'),
        notes: _get(values, 'notes', ''),
        favorite: !!_get(values, 'favorite', false),
        params: formValuesToProfileParams(values),
      };

      if (mode === 'update') {
        actions.updateRecord(state.modal.params.id, payload, true);
      } else {
        actions.createRecord(payload);
      }
    };

    render() {
      const { mode, state, actions, machines, machinesError } = this.props;
      const { closeModal, updateModalParams } = actions;
      const { alertMessage } = state.modal.params;
      const isUpdate = mode === 'update';
      const hasMachines = machines && machines.length > 0;

      return (
        <Modal disableOverlay onClose={closeModal}>
          <Form
            initialValues={this.state.values}
            onSubmit={this.onSubmit}
            render={({ handleSubmit, invalid, values }) => (
              <div>
                <Modal.Header>
                  <Modal.Title>
                    {isUpdate ? i18n._('Edit Laser Profile') : i18n._('Add Laser Profile')}
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  {alertMessage && (
                    <ToastNotification
                      style={{ margin: '-16px -24px 10px -24px' }}
                      type="error"
                      onDismiss={() => {
                        updateModalParams({ alertMessage: '' });
                      }}
                    >
                      {alertMessage}
                    </ToastNotification>
                  )}
                  {machinesError && (
                    <ToastNotification style={{ margin: '-16px -24px 10px -24px' }} type="error">
                      {i18n._('Unable to load machine profiles.')}
                    </ToastNotification>
                  )}
                  {!hasMachines && !machinesError && (
                    <ToastNotification style={{ margin: '-16px -24px 10px -24px' }} type="warning">
                      {i18n._('Create a Machine Profile before adding a laser profile.')}
                    </ToastNotification>
                  )}
                  <SectionGroup>
                    <SectionTitle>{i18n._('Identification')}</SectionTitle>
                    <Margin left={24}>
                      <Field name="name" validate={validations.required}>
                        {({ input, meta }) => (
                          <FormGroup>
                            <label>{i18n._('Name')}</label>
                            <Input aria-label="Name" {...input} type="text" />
                            {meta.touched && meta.error && <Error>{meta.error}</Error>}
                          </FormGroup>
                        )}
                      </Field>
                      <Row>
                        <Col>
                          <Field name="machineProfileId" validate={validations.required}>
                            {({ input, meta }) => (
                              <FormGroup>
                                <label>{i18n._('Machine Profile')}</label>
                                <Select aria-label="Machine Profile" {...input}>
                                  <option value="">{i18n._('Select a machine profile')}</option>
                                  {machines.map(machine => (
                                    <option key={machine.id} value={machine.id}>{machine.name}</option>
                                  ))}
                                </Select>
                                {meta.touched && meta.error && <Error>{meta.error}</Error>}
                              </FormGroup>
                            )}
                          </Field>
                        </Col>
                        <Col>
                          <Field name="favorite">
                            {({ input }) => (
                              <FormGroup>
                                <label>{i18n._('Favorite')}</label>
                                <div className="checkbox">
                                  <label>
                                    <input type="checkbox" {...input} />
                                    {i18n._('Show first in the profile list')}
                                  </label>
                                </div>
                              </FormGroup>
                            )}
                          </Field>
                        </Col>
                      </Row>
                    </Margin>
                  </SectionGroup>

                  <SectionGroup>
                    <SectionTitle>{i18n._('Material')}</SectionTitle>
                    <Margin left={24}>
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
                      <Field name="notes">
                        {({ input }) => (
                          <FormGroup>
                            <label>{i18n._('Notes')}</label>
                            <Textarea aria-label="Notes" {...input} rows={2} />
                          </FormGroup>
                        )}
                      </Field>
                    </Margin>
                  </SectionGroup>

                  <SectionGroup>
                    <SectionTitle>{i18n._('Laser')}</SectionTitle>
                    <Margin left={24}>
                      <Row>
                        <Col>
                          <Field name="powerPercent">
                            {({ input }) => (
                              <FormGroup>
                                <label>{i18n._('Power (%)')}</label>
                                <Input aria-label="Power (%)" {...input} type="number" min={0} max={100} step={1} />
                              </FormGroup>
                            )}
                          </Field>
                        </Col>
                        <Col>
                          <Field name="laserMode">
                            {({ input }) => (
                              <FormGroup>
                                <label>{i18n._('Laser Mode')}</label>
                                <Select aria-label="Laser Mode" {...input}>
                                  <option value="M4">{i18n._('M4 - Dynamic power')}</option>
                                  <option value="M3">{i18n._('M3 - Constant power')}</option>
                                </Select>
                              </FormGroup>
                            )}
                          </Field>
                        </Col>
                      </Row>
                      <Row>
                        <Col>
                          <Field name="feedRate">
                            {({ input }) => (
                              <FormGroup>
                                <label>{i18n._('Feed Rate (mm/min)')}</label>
                                <Input aria-label="Feed Rate" {...input} type="number" min={1} />
                              </FormGroup>
                            )}
                          </Field>
                        </Col>
                        <Col>
                          <Field name="travelRate">
                            {({ input }) => (
                              <FormGroup>
                                <label>{i18n._('Travel Rate (mm/min)')}</label>
                                <Input aria-label="Travel Rate" {...input} type="number" min={1} />
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
                                <Input aria-label="Passes" {...input} type="number" min={1} step={1} />
                              </FormGroup>
                            )}
                          </Field>
                        </Col>
                        <Col>
                          <Field name="engraveMode">
                            {({ input }) => (
                              <FormGroup>
                                <label>{i18n._('Engraving Mode')}</label>
                                <Select aria-label="Engraving Mode" {...input}>
                                  <option value="line">{i18n._('Line (outline)')}</option>
                                  <option value="fill">{i18n._('Fill (hatch)')}</option>
                                  <option value="both">{i18n._('Line + Fill')}</option>
                                </Select>
                              </FormGroup>
                            )}
                          </Field>
                        </Col>
                      </Row>
                      {values.engraveMode !== 'line' && (
                        <Row>
                          <Col>
                            <Field name="fillSpacing">
                              {({ input }) => (
                                <FormGroup>
                                  <label>{i18n._('Fill Spacing (mm)')}</label>
                                  <Input aria-label="Fill Spacing" {...input} type="number" min={0.01} step={0.01} />
                                </FormGroup>
                              )}
                            </Field>
                          </Col>
                          <Col>
                            <Field name="fillAngle">
                              {({ input }) => (
                                <FormGroup>
                                  <label>{i18n._('Fill Angle (deg)')}</label>
                                  <Input aria-label="Fill Angle" {...input} type="number" step={1} />
                                </FormGroup>
                              )}
                            </Field>
                          </Col>
                        </Row>
                      )}
                      <Row>
                        <Col>
                          <Field name="fan">
                            {({ input }) => (
                              <FormGroup>
                                <label>{i18n._('Fan (M8)')}</label>
                                <Select aria-label="Fan (M8)" {...input}>
                                  <option value="yes">{i18n._('Yes')}</option>
                                  <option value="no">{i18n._('No')}</option>
                                </Select>
                              </FormGroup>
                            )}
                          </Field>
                        </Col>
                        <Col />
                      </Row>
                    </Margin>
                  </SectionGroup>
                </Modal.Body>
                <Modal.Footer>
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={closeModal}
                  >
                    {i18n._('Cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={invalid}
                    onClick={handleSubmit}
                  >
                    {i18n._('OK')}
                  </button>
                </Modal.Footer>
              </div>
            )}
          />
        </Modal>
      );
    }
}

export default RecordModal;
