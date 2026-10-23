import { ensureArray } from 'ensure-type';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import api from 'app/api';
import { getRecommendedProfiles } from 'app/lib/laserProfiles';
import store from 'app/store';
import RecordModal from './RecordModal';
import TableRecords from './TableRecords';
import {
  MODAL_CREATE_RECORD,
  MODAL_UPDATE_RECORD
} from './constants';

class LaserProfiles extends PureComponent {
    static propTypes = {
      initialState: PropTypes.object,
      state: PropTypes.object,
      stateChanged: PropTypes.bool,
      actions: PropTypes.object
    };

    state = {
      machines: [],
      machinesError: false,
      addingRecommended: false,
    };

    componentDidMount() {
      const { actions } = this.props;

      actions.fetchRecords();

      api.machines.fetch()
        .then(res => {
          this.setState({
            machines: ensureArray(res.body.records),
            machinesError: false,
          });
        })
        .catch(() => {
          this.setState({
            machines: [],
            machinesError: true,
          });
        });
    }

    handleAddRecommended = () => {
      const { actions } = this.props;
      const { machines } = this.state;
      const currentMachineProfile = store.get('workspace.machineProfile') || {};
      const machineProfileId = currentMachineProfile.id
        || (machines[0] ? machines[0].id : '');

      if (!machineProfileId || this.state.addingRecommended) {
        return;
      }

      this.setState({ addingRecommended: true });

      const profiles = getRecommendedProfiles(machineProfileId);
      Promise.all(profiles.map(profile => api.profiles.create(profile)))
        .then(() => {
          actions.fetchRecords();
        })
        .catch(() => {
          // Ignore; the table will show the profiles that were created
        })
        .then(() => {
          this.setState({ addingRecommended: false });
        });
    };

    render() {
      const { state, actions } = this.props;
      const { machines, machinesError, addingRecommended } = this.state;

      return (
        <div style={{ margin: -15 }}>
          {state.modal.name === MODAL_CREATE_RECORD &&
            <RecordModal
              mode="create"
              state={state}
              actions={actions}
              machines={machines}
              machinesError={machinesError}
            />}
          {state.modal.name === MODAL_UPDATE_RECORD &&
            <RecordModal
              mode="update"
              state={state}
              actions={actions}
              machines={machines}
              machinesError={machinesError}
            />}
          <TableRecords
            state={state}
            actions={actions}
            machines={machines}
            addingRecommended={addingRecommended}
            onAddRecommended={this.handleAddRecommended}
          />
        </div>
      );
    }
}

export default LaserProfiles;
