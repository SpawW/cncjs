import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Modal from 'app/components/Modal';
import ModalTemplate from 'app/components/ModalTemplate';
import ensurePositiveNumber from 'app/lib/ensure-positive-number';
import i18n from 'app/lib/i18n';
import { SIMULATE_MODE_CORNERS } from './constants';

class SimulateModal extends PureComponent {
    static propTypes = {
      state: PropTypes.object,
      actions: PropTypes.object
    };

    state = {
      power: this.props.state.modal.params.power,
      maxS: this.props.state.modal.params.maxS
    };

    handleChangePower = (event) => {
      const value = event.target.value;
      this.setState({ power: value === '' ? '' : Number(value) });
    };

    handleChangeMaxS = (event) => {
      const value = event.target.value;
      this.setState({ maxS: value === '' ? '' : Number(value) });
    };

    handleStart = () => {
      const { state, actions } = this.props;
      const { mode } = state.modal.params;

      actions.runSimulate({
        mode,
        power: ensurePositiveNumber(this.state.power),
        maxS: ensurePositiveNumber(this.state.maxS)
      });
      actions.closeModal();
    };

    render() {
      const { state, actions } = this.props;
      const { mode } = state.modal.params;
      const { power, maxS } = this.state;

      return (
        <Modal disableOverlay size="xs" onClose={actions.closeModal}>
          <Modal.Header>
            <Modal.Title>
              {i18n._('Simulate')}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <ModalTemplate type="warning">
              <p>
                {mode === SIMULATE_MODE_CORNERS
                  ? i18n._('The machine will move to the four corners of the work area and briefly turn on the laser at each corner.')
                  : i18n._('The machine will follow the toolpath and turn on the laser where it would engrave.')}
              </p>
              <p style={{ marginBottom: 0 }}>
                {i18n._('This turns on the laser and moves the machine. Make sure the work area is clear and it is safe to operate the laser.')}
              </p>
            </ModalTemplate>
            <div className="table-form" style={{ marginBottom: 0 }}>
              <div className="table-form-row">
                <div className="table-form-col table-form-col-label middle">
                  {i18n._('Power (%)')}
                </div>
                <div className="table-form-col">
                  <div className="input-group input-group-sm" style={{ width: '100%' }}>
                    <input
                      aria-label="Simulation power percentage"
                      type="number"
                      className="form-control"
                      style={{ borderRadius: 0 }}
                      value={power}
                      min={0}
                      max={100}
                      step={1}
                      onChange={this.handleChangePower}
                    />
                    <span className="input-group-addon">%</span>
                  </div>
                </div>
              </div>
              <div className="table-form-row">
                <div className="table-form-col table-form-col-label middle">
                  {i18n._('Maximum value')}
                </div>
                <div className="table-form-col">
                  <div className="input-group input-group-sm" style={{ width: '100%' }}>
                    <span className="input-group-addon">S</span>
                    <input
                      aria-label="Maximum S value"
                      type="number"
                      className="form-control"
                      style={{ borderRadius: 0 }}
                      value={maxS}
                      min={1}
                      step={1}
                      onChange={this.handleChangeMaxS}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn btn-default"
              onClick={actions.closeModal}
            >
              {i18n._('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={this.handleStart}
            >
              {i18n._('Start')}
            </button>
          </Modal.Footer>
        </Modal>
      );
    }
}

export default SimulateModal;
