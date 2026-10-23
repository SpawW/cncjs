import _get from 'lodash/get';
import chainedFunction from 'chained-function';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Anchor from 'app/components/Anchor';
import { Button } from 'app/components/Buttons';
import FormGroup from 'app/components/FormGroup';
import Modal from 'app/components/Modal';
import ModalTemplate from 'app/components/ModalTemplate';
import Space from 'app/components/Space';
import Table from 'app/components/Table';
import { TablePagination } from 'app/components/Paginations';
import i18n from 'app/lib/i18n';
import { getMaterialLabel, getOperationLabel } from 'app/lib/laserProfiles';
import portal from 'app/lib/portal';
import {
  MODAL_CREATE_RECORD,
  MODAL_UPDATE_RECORD
} from './constants';
import styles from './index.styl';

class TableRecords extends PureComponent {
    static propTypes = {
      state: PropTypes.object,
      actions: PropTypes.object,
      machines: PropTypes.array,
      addingRecommended: PropTypes.bool,
      onAddRecommended: PropTypes.func,
    };

    render() {
      const { state, actions, machines, addingRecommended, onAddRecommended } = this.props;
      const hasMachines = machines && machines.length > 0;
      const showRecommended = hasMachines
        && !state.api.fetching
        && state.pagination.totalRecords === 0
        && onAddRecommended;

      return (
        <Table
          bordered={false}
          justified={false}
          data={(state.api.err || state.api.fetching) ? [] : state.records}
          rowKey={(record) => {
            return record.id;
          }}
          emptyText={() => {
            if (state.api.err) {
              return (
                <span className="text-danger">
                  {i18n._('An unexpected error has occurred.')}
                </span>
              );
            }

            if (state.api.fetching) {
              return (
                <span>
                  <i className="fa fa-fw fa-spin fa-circle-o-notch" />
                  <Space width="8" />
                  {i18n._('Loading...')}
                </span>
              );
            }

            return i18n._('No data to display');
          }}
          title={() => (
            <div className={styles.tableToolbar}>
              <button
                type="button"
                className="btn btn-default"
                onClick={() => {
                  actions.openModal(MODAL_CREATE_RECORD);
                }}
              >
                <i className="fa fa-plus" />
                <Space width="8" />
                {i18n._('Add')}
              </button>
              {showRecommended && (
                <button
                  type="button"
                  className="btn btn-default"
                  style={{ marginLeft: 8 }}
                  disabled={addingRecommended}
                  onClick={onAddRecommended}
                >
                  <i className="fa fa-magic" />
                  <Space width="8" />
                  {addingRecommended
                    ? i18n._('Adding...')
                    : i18n._('Add recommended profiles')}
                </button>
              )}
              <TablePagination
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0
                }}
                page={state.pagination.page}
                pageLength={state.pagination.pageLength}
                totalRecords={state.pagination.totalRecords}
                onPageChange={({ page, pageLength }) => {
                  actions.fetchRecords({ page, pageLength });
                }}
                prevPageRenderer={() => <i className="fa fa-angle-left" />}
                nextPageRenderer={() => <i className="fa fa-angle-right" />}
              />
            </div>
          )}
          columns={[
            {
              title: i18n._('Name'),
              key: 'name',
              render: (value, row, index) => {
                return (
                  <Anchor
                    onClick={(event) => {
                      actions.openModal(MODAL_UPDATE_RECORD, row);
                    }}
                  >
                    {row.name}
                  </Anchor>
                );
              }
            },
            {
              title: i18n._('Machine'),
              key: 'machineProfileName',
              render: (value, row, index) => {
                return row.machineProfileName || (
                  <span className="text-danger">{i18n._('Machine not found')}</span>
                );
              }
            },
            {
              title: i18n._('Material'),
              key: 'material',
              render: (value, row, index) => getMaterialLabel(row.material, row.materialLabel)
            },
            {
              title: i18n._('Thickness'),
              key: 'thickness',
              render: (value, row, index) => {
                const thickness = Number(row.thickness) || 0;
                return thickness > 0 ? `${thickness} mm` : '-';
              }
            },
            {
              title: i18n._('Operation'),
              key: 'operation',
              render: (value, row, index) => getOperationLabel(row.operation)
            },
            {
              title: i18n._('Power'),
              key: 'powerPercent',
              render: (value, row, index) => `${_get(row, 'params.powerPercent', 0)}%`
            },
            {
              title: i18n._('Feed'),
              key: 'feedRate',
              render: (value, row, index) => _get(row, 'params.feedRate', 0)
            },
            {
              title: i18n._('Passes'),
              key: 'passes',
              render: (value, row, index) => _get(row, 'params.passes', 1)
            },
            {
              title: i18n._('Favorite'),
              key: 'favorite',
              className: 'text-nowrap',
              render: (value, row, index) => {
                return (
                  <button
                    aria-label={`${row.favorite ? i18n._('Remove from favorites') : i18n._('Add to favorites')}: ${row.name}`}
                    type="button"
                    className="btn btn-xs btn-default"
                    title={row.favorite ? i18n._('Remove from favorites') : i18n._('Add to favorites')}
                    onClick={() => {
                      actions.updateRecord(row.id, { favorite: !row.favorite }, true);
                    }}
                  >
                    <i
                      aria-hidden="true"
                      className={`fa fa-fw ${row.favorite ? 'fa-star' : 'fa-star-o'}`}
                    />
                  </button>
                );
              }
            },
            {
              title: i18n._('Action'),
              className: 'text-nowrap',
              key: 'action',
              render: (value, row, index) => {
                return (
                  <div>
                    <button
                      aria-label={`Edit profile: ${row.name}`}
                      type="button"
                      className="btn btn-xs btn-default"
                      title={i18n._('Update')}
                      onClick={() => {
                        actions.openModal(MODAL_UPDATE_RECORD, row);
                      }}
                    >
                      <i aria-hidden="true" className="fa fa-fw fa-edit" />
                    </button>
                    <button
                      aria-label={`Duplicate profile: ${row.name}`}
                      type="button"
                      className="btn btn-xs btn-default"
                      title={i18n._('Duplicate')}
                      onClick={() => {
                        actions.createRecord({
                          machineProfileId: row.machineProfileId,
                          name: `${row.name} (${i18n._('copy')})`,
                          material: row.material,
                          materialLabel: row.materialLabel,
                          thickness: row.thickness,
                          operation: row.operation,
                          notes: row.notes,
                          favorite: false,
                          params: row.params,
                        });
                      }}
                    >
                      <i aria-hidden="true" className="fa fa-fw fa-copy" />
                    </button>
                    <button
                      aria-label={`Delete profile: ${row.name}`}
                      type="button"
                      className="btn btn-xs btn-default"
                      title={i18n._('Delete')}
                      onClick={() => {
                        portal(({ onClose }) => (
                          <Modal disableOverlay onClose={onClose}>
                            <Modal.Body>
                              <ModalTemplate type="warning">
                                <FormGroup>
                                  <strong>{i18n._('Delete laser profile')}</strong>
                                </FormGroup>
                                <div>
                                  {row.name}
                                </div>
                              </ModalTemplate>
                            </Modal.Body>
                            <Modal.Footer>
                              <Button onClick={onClose}>
                                {i18n._('Cancel')}
                              </Button>
                              <Button
                                btnStyle="primary"
                                onClick={chainedFunction(
                                  () => {
                                    actions.deleteRecord(row.id);
                                  },
                                  onClose
                                )}
                              >
                                {i18n._('OK')}
                              </Button>
                            </Modal.Footer>
                          </Modal>
                        ));
                      }}
                    >
                      <i aria-hidden="true" className="fa fa-fw fa-trash" />
                    </button>
                  </div>
                );
              }
            }
          ]}
        />
      );
    }
}

export default TableRecords;
