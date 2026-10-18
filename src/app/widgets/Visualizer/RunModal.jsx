import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Modal from 'app/components/Modal';
import ensurePositiveNumber from 'app/lib/ensure-positive-number';
import i18n from 'app/lib/i18n';
import { percentToS } from 'app/lib/laser';

class RunModal extends PureComponent {
    static propTypes = {
      state: PropTypes.object,
      actions: PropTypes.object
    };

    state = {
      powerPercent: this.props.state.modal.params.powerPercent,
      feedRate: this.props.state.modal.params.feedRate,
      fan: this.props.state.modal.params.fan
    };

    handleChangePower = (event) => {
      const value = event.target.value;
      this.setState({ powerPercent: value === '' ? '' : Number(value) });
    };

    handleChangeFeedRate = (event) => {
      const value = event.target.value;
      this.setState({ feedRate: value === '' ? '' : Number(value) });
    };

    handleChangeFan = (event) => {
      this.setState({ fan: event.target.checked });
    };

    handleStart = () => {
      const { state, actions } = this.props;

      actions.runGCode({
        powerPercent: ensurePositiveNumber(this.state.powerPercent),
        feedRate: ensurePositiveNumber(this.state.feedRate),
        fan: !!this.state.fan,
        maxS: state.modal.params.maxS
      });
      actions.closeModal();
    };

    render() {
      const { state, actions } = this.props;
      const { powerPercent, feedRate, fan } = this.state;
      const maxS = state.modal.params.maxS;

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
                  {i18n._('Power (%)')}
                </div>
                <div className="table-form-col">
                  <div className="input-group input-group-sm" style={{ width: '100%' }}>
                    <input
                      aria-label="Laser power percentage"
                      type="number"
                      className="form-control"
                      style={{ borderRadius: 0 }}
                      value={powerPercent}
                      min={0}
                      max={100}
                      step={1}
                      onChange={this.handleChangePower}
                    />
                    <span className="input-group-addon">%</span>
                  </div>
                  <small className="text-muted">
                    {`= S${percentToS(powerPercent, maxS)} · ${i18n._('Maximum value')} S${maxS}`}
                  </small>
                </div>
              </div>
              <div className="table-form-row">
                <div className="table-form-col table-form-col-label middle">
                  {i18n._('Speed (mm/min)')}
                </div>
                <div className="table-form-col">
                  <div className="input-group input-group-sm" style={{ width: '100%' }}>
                    <input
                      aria-label="Cutting speed"
                      type="number"
                      className="form-control"
                      style={{ borderRadius: 0 }}
                      value={feedRate}
                      min={0}
                      step={1}
                      onChange={this.handleChangeFeedRate}
                    />
                    <span className="input-group-addon">mm/min</span>
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
