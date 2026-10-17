import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Modal from 'app/components/Modal';
import ensurePositiveNumber from 'app/lib/ensure-positive-number';
import i18n from 'app/lib/i18n';

class RunModal extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    state = {
        power: this.props.state.modal.params.power,
        fan: this.props.state.modal.params.fan
    };

    handleChangePower = (event) => {
        const value = event.target.value;
        this.setState({ power: value === '' ? '' : Number(value) });
    };

    handleChangeFan = (event) => {
        this.setState({ fan: event.target.checked });
    };

    handleStart = () => {
        const { actions } = this.props;

        actions.runGCode({
            power: ensurePositiveNumber(this.state.power),
            fan: !!this.state.fan
        });
        actions.closeModal();
    };

    render() {
        const { actions } = this.props;
        const { power, fan } = this.state;

        return (
          <Modal disableOverlay size="xs" onClose={actions.closeModal}>
            <Modal.Header>
              <Modal.Title>
                {i18n._('Run')}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="table-form" style={{ marginBottom: 0 }}>
                <div className="table-form-row">
                  <div className="table-form-col table-form-col-label middle">
                    {i18n._('Laser Power (S)')}
                  </div>
                  <div className="table-form-col">
                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                      <span className="input-group-addon">S</span>
                      <input
                        aria-label="Laser power S"
                        type="number"
                        className="form-control"
                        style={{ borderRadius: 0 }}
                        value={power}
                        min={1}
                        step={1}
                        onChange={this.handleChangePower}
                      />
                    </div>
                  </div>
                </div>
                <div className="table-form-row">
                  <div className="table-form-col table-form-col-label middle">
                    <label style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={fan}
                        onChange={this.handleChangeFan}
                        style={{ marginRight: 4, verticalAlign: 'middle' }}
                      />
                      {i18n._('Fan (M8)')}
                    </label>
                  </div>
                  <div className="table-form-col" />
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

export default RunModal;
