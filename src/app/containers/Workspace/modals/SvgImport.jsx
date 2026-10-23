import { ensureArray } from 'ensure-type';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Form, Field } from 'react-final-form';
import api from 'app/api';
import { Input } from 'app/components/FormControl';
import FormGroup from 'app/components/FormGroup';
import Modal from 'app/components/Modal';
import { Nav, NavItem } from 'app/components/Navs';
import { ToastNotification } from 'app/components/Notifications';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import { percentToS, resolveMaxS } from 'app/lib/laser';
import {
  PROFILE_PARAM_KEYS,
  formValuesToProfileParams,
  getProfileSummary,
  importProfileFromEngraveMode,
  profileToFormValues,
  readLastProfileId,
  writeLastProfileId,
} from 'app/lib/laserProfiles';
import store from 'app/store';
import SaveProfileModal from './SaveProfileModal';

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

const getMachineProfile = () => store.get('workspace.machineProfile') || {};

// Park target taken from the selected machine profile limits (the real bed
// size the user configured in CNCjs), in work coordinates.
const getParkTarget = () => {
  const machineProfile = getMachineProfile();
  const limits = machineProfile.limits;
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

const getErrorMessage = (res, fallback) => {
  return (res && res.body && res.body.msg) || fallback;
};

// Keep the dialog compact: fields flow into as many columns as fit, but never
// grow wider than a comfortable numeric/select input.
const FIELD_GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 220px))',
  columnGap: 12,
  rowGap: 0,
  alignItems: 'start',
};

class SvgImport extends Component {
    static propTypes = {
      fileName: PropTypes.string,
      mode: PropTypes.oneOf(['svg', 'stl']),
      onClose: PropTypes.func.isRequired,
      onSubmit: PropTypes.func.isRequired,
    };

    constructor(props) {
      super(props);

      const machineProfile = getMachineProfile();
      this.machineProfileId = machineProfile.id || '';
      this.machineProfileName = machineProfile.name || '';
      this.form = null;

      this.state = {
        profiles: [],
        selectedProfileId: readLastProfileId(this.machineProfileId),
        profileError: '',
        profileNotice: '',
        savingProfile: false,
        saveAsOpen: false,
        activeTab: 'laser',
      };
    }

    componentDidMount() {
      if (!this.machineProfileId) {
        return;
      }

      api.profiles.fetch({ machineProfileId: this.machineProfileId })
        .then((res) => {
          const profiles = ensureArray(res.body.records);
          const lastProfileId = readLastProfileId(this.machineProfileId);
          const nextProfile = profiles.find(profile => profile.id === lastProfileId)
            || profiles.find(profile => profile.favorite)
            || null;

          this.setState({
            profiles,
            selectedProfileId: nextProfile ? nextProfile.id : '',
          });

          if (nextProfile) {
            writeLastProfileId(this.machineProfileId, nextProfile.id);
            this.applyProfile(nextProfile);
          }
        })
        .catch((res) => {
          this.setState({
            profileError: getErrorMessage(res, i18n._('Unable to load laser profiles.')),
          });
        });
    }

    getSelectedProfile = () => {
      return this.state.profiles.find(profile => profile.id === this.state.selectedProfileId) || null;
    };

    // React Final Form ignores new initialValues after initialization, so a
    // profile is applied with form.initialize(), preserving the job setup fields.
    applyProfile = (profile) => {
      if (!this.form) {
        return;
      }

      const values = this.form.getState().values;
      this.form.initialize({
        ...values,
        ...profileToFormValues(profile),
      });
    };

    buildProfilePayload = (meta = {}) => {
      const values = this.form ? this.form.getState().values : {};
      const profile = this.getSelectedProfile() || {};

      return {
        machineProfileId: this.machineProfileId,
        name: meta.name !== undefined ? meta.name : (profile.name || ''),
        material: meta.material !== undefined ? meta.material : (profile.material || 'other'),
        materialLabel: meta.materialLabel !== undefined ? meta.materialLabel : (profile.materialLabel || ''),
        thickness: meta.thickness !== undefined
          ? (Number(meta.thickness) || 0)
          : (Number(profile.thickness) || 0),
        operation: meta.operation !== undefined
          ? meta.operation
          : (profile.operation || importProfileFromEngraveMode(values.engraveMode)),
        notes: profile.notes || '',
        favorite: meta.favorite !== undefined ? !!meta.favorite : !!profile.favorite,
        params: formValuesToProfileParams(values),
      };
    };

    handleProfileChange = (event) => {
      const id = event.target.value;
      this.setState({
        selectedProfileId: id,
        profileError: '',
        profileNotice: '',
      });
      writeLastProfileId(this.machineProfileId, id);

      const profile = this.state.profiles.find(item => item.id === id);
      if (profile) {
        this.applyProfile(profile);
      }
    };

    handleRestoreProfile = () => {
      const profile = this.getSelectedProfile();

      if (profile) {
        this.applyProfile(profile);
        this.setState({ profileNotice: '' });
      }
    };

    handleSaveProfile = () => {
      const profile = this.getSelectedProfile();

      if (!profile || !this.machineProfileId) {
        return;
      }

      this.setState({ savingProfile: true, profileError: '', profileNotice: '' });

      api.profiles.update(profile.id, this.buildProfilePayload())
        .then((res) => {
          const updated = res.body;
          this.setState(state => ({
            profiles: state.profiles.map(item => (item.id === updated.id ? updated : item)),
            profileNotice: i18n._('Profile updated.'),
          }));
        })
        .catch((res) => {
          this.setState({
            profileError: getErrorMessage(res, i18n._('Unable to save the profile.')),
          });
        })
        .then(() => {
          this.setState({ savingProfile: false });
        });
    };

    handleOpenSaveAs = () => {
      this.setState({
        profileError: '',
        profileNotice: '',
        saveAsOpen: true,
      });
    };

    handleSaveAs = (meta) => {
      if (!this.machineProfileId) {
        return;
      }

      const values = this.form ? this.form.getState().values : {};

      this.setState({ savingProfile: true, profileError: '', profileNotice: '' });

      api.profiles.create(this.buildProfilePayload({
        ...meta,
        favorite: false,
        operation: meta.operation || importProfileFromEngraveMode(values.engraveMode),
      }))
        .then((res) => {
          const created = res.body;
          writeLastProfileId(this.machineProfileId, created.id);
          this.setState(state => ({
            profiles: [...state.profiles, created],
            selectedProfileId: created.id,
            saveAsOpen: false,
            profileNotice: i18n._('Profile created.'),
          }));
        })
        .catch((res) => {
          this.setState({
            profileError: getErrorMessage(res, i18n._('Unable to save the profile.')),
          });
        })
        .then(() => {
          this.setState({ savingProfile: false });
        });
    };

    getSaveAsInitialValues = () => {
      const values = this.form ? this.form.getState().values : {};
      const profile = this.getSelectedProfile();
      const operation = profile
        ? profile.operation
        : importProfileFromEngraveMode(values.engraveMode);

      return {
        name: profile ? `${profile.name} (${i18n._('copy')})` : '',
        material: profile ? profile.material : 'other',
        materialLabel: profile ? profile.materialLabel : '',
        thickness: profile ? profile.thickness : 0,
        operation,
      };
    };

    handleTabSelect = (activeTab) => {
      this.setState({ activeTab });
    };

    renderProfileSelector = (values, fileName) => {
      const { profiles, selectedProfileId, savingProfile } = this.state;
      const selectedProfile = this.getSelectedProfile();
      const profileValues = selectedProfile ? profileToFormValues(selectedProfile) : null;
      const modified = profileValues && PROFILE_PARAM_KEYS.some((key) => {
        const current = values[key] === undefined ? '' : values[key];
        const saved = profileValues[key] === undefined ? '' : profileValues[key];
        return String(current) !== String(saved);
      });

      return (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            backgroundColor: '#f8f8f8',
            border: '1px solid #e5e5e5',
            borderRadius: 3,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ flex: '1 1 240px', minWidth: 180, maxWidth: 420 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>
                {i18n._('Laser Profile')}
              </label>
              <select
                aria-label="Laser Profile"
                className="form-control"
                style={{ width: '100%' }}
                value={selectedProfileId}
                disabled={!this.machineProfileId || profiles.length === 0}
                onChange={this.handleProfileChange}
              >
                <option value="">
                  {profiles.length > 0
                    ? i18n._('Last used (not saved)')
                    : i18n._('No profiles for this machine')}
                </option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.favorite ? '★ ' : ''}{profile.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className="btn btn-default btn-sm"
                disabled={!selectedProfile || savingProfile}
                onClick={this.handleSaveProfile}
              >
                {i18n._('Save')}
              </button>
              <button
                type="button"
                className="btn btn-default btn-sm"
                disabled={!this.machineProfileId || savingProfile}
                onClick={this.handleOpenSaveAs}
              >
                {i18n._('Save as…')}
              </button>
              <button
                type="button"
                className="btn btn-default btn-sm"
                disabled={!selectedProfile || savingProfile}
                onClick={this.handleRestoreProfile}
              >
                {i18n._('Restore')}
              </button>
            </div>
            <div style={{ flex: '1 1 100%', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                <small
                  className={this.machineProfileId ? 'text-muted' : 'text-danger'}
                  style={{
                    display: 'block',
                    flex: '1 1 auto',
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={fileName || ''}
                >
                  {fileName ? `${i18n._('File: {{name}}', { name: fileName })} · ` : ''}
                  {!this.machineProfileId && i18n._('Select a Machine Profile to use laser profiles.')}
                  {this.machineProfileId && this.machineProfileName}
                  {selectedProfile ? ` · ${getProfileSummary(selectedProfile)}` : ''}
                </small>
                {modified && (
                  <span className="label label-warning" style={{ marginLeft: 8, flex: '0 0 auto' }}>
                    {i18n._('modified')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };

    renderLaserTab = (maxS, isStl) => (
      <div style={FIELD_GRID_STYLE}>
        <Field name="feedRate">
          {({ input }) => (
            <FormGroup>
              <label>{i18n._('Feed Rate (mm/min)')}</label>
              <Input aria-label="Feed Rate" {...input} type="number" />
              <small className="text-muted">
                {i18n._('Speed while the laser is on. Lower = more energy per mm.')}
              </small>
            </FormGroup>
          )}
        </Field>
        <Field name="travelRate">
          {({ input }) => (
            <FormGroup>
              <label>{i18n._('Travel Rate (mm/min)')}</label>
              <Input aria-label="Travel Rate" {...input} type="number" />
              <small className="text-muted">
                {i18n._('Speed while the laser is off (G0 moves).')}
              </small>
            </FormGroup>
          )}
        </Field>
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
        <Field name="passes">
          {({ input }) => (
            <FormGroup>
              <label>{i18n._('Passes')}</label>
              <Input aria-label="Passes" {...input} type="number" />
            </FormGroup>
          )}
        </Field>
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
        {isStl && (
          <Field name="z">
            {({ input }) => (
              <FormGroup>
                <label>{i18n._('Slice Z (mm, optional)')}</label>
                <Input aria-label="Slice Z" {...input} type="number" />
              </FormGroup>
            )}
          </Field>
        )}
        <Field name="focusZ">
          {({ input }) => (
            <FormGroup>
              <label>{i18n._('Focus Z (mm, optional)')}</label>
              <Input aria-label="Focus Z" {...input} type="number" />
            </FormGroup>
          )}
        </Field>
      </div>
    );

    renderEngravingTab = (values) => (
      <div style={FIELD_GRID_STYLE}>
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
        {values.engraveMode !== 'line' && (
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
        )}
        {values.engraveMode === 'line' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <small className="text-muted">
              {i18n._('Line mode traces only the outline. Select Fill or Line + Fill to generate hatch lines.')}
            </small>
          </div>
        )}
      </div>
    );

    renderPlacementTab = () => (
      <div style={FIELD_GRID_STYLE}>
        <Field name="scale">
          {({ input }) => (
            <FormGroup>
              <label>{i18n._('Scale')}</label>
              <Input aria-label="Scale" {...input} type="number" />
              <small className="text-muted">
                {i18n._('1 = original size, 0.5 = half, 2 = double.')}
              </small>
            </FormGroup>
          )}
        </Field>
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
        <Field name="offsetX">
          {({ input }) => (
            <FormGroup>
              <label>{i18n._('Offset X (mm)')}</label>
              <Input aria-label="Offset X" {...input} type="number" />
            </FormGroup>
          )}
        </Field>
        <Field name="offsetY">
          {({ input }) => (
            <FormGroup>
              <label>{i18n._('Offset Y (mm)')}</label>
              <Input aria-label="Offset Y" {...input} type="number" />
            </FormGroup>
          )}
        </Field>
      </div>
    );

    render() {
      const { fileName, mode = 'svg', onClose, onSubmit } = this.props;
      const { profileError, profileNotice, saveAsOpen, selectedProfileId, activeTab } = this.state;
      const isStl = mode === 'stl';
      const maxS = resolveMaxS(controller);
      const park = getParkTarget();
      const initialValues = { ...DEFAULT_VALUES, ...readStoredValues() };

      return (
        <div>
          <Modal
            size="lg"
            style={{ width: '95vw', maxWidth: 1100 }}
            disableOverlay
            onClose={onClose}
          >
            <Form
              initialValues={initialValues}
              onSubmit={(values) => {
                writeStoredValues(values);
                writeLastProfileId(this.machineProfileId, selectedProfileId);
                onSubmit(parseOptions(values, maxS, park));
              }}
              render={({ form, handleSubmit, invalid, submitting, submitError, values }) => {
                this.form = form;

                return (
                  <div>
                    <Modal.Header>
                      <Modal.Title>
                        {isStl ? i18n._('Import STL') : i18n._('Import SVG')}
                      </Modal.Title>
                    </Modal.Header>
                    <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
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
                      {profileError && (
                        <ToastNotification
                          style={{ margin: '0 0 10px 0' }}
                          type="error"
                          onDismiss={() => this.setState({ profileError: '' })}
                        >
                          {profileError}
                        </ToastNotification>
                      )}
                      {profileNotice && (
                        <ToastNotification
                          style={{ margin: '0 0 10px 0' }}
                          type="success"
                          onDismiss={() => this.setState({ profileNotice: '' })}
                        >
                          {profileNotice}
                        </ToastNotification>
                      )}
                      {this.renderProfileSelector(values, fileName)}
                      <Nav
                        navStyle="tabs"
                        activeKey={activeTab}
                        onSelect={this.handleTabSelect}
                        style={{ marginBottom: 10 }}
                      >
                        <NavItem eventKey="laser">{i18n._('Laser')}</NavItem>
                        <NavItem eventKey="engraving">{i18n._('Engraving')}</NavItem>
                        <NavItem eventKey="placement">{i18n._('Placement')}</NavItem>
                      </Nav>
                      {activeTab === 'laser' && this.renderLaserTab(maxS, isStl)}
                      {activeTab === 'engraving' && this.renderEngravingTab(values)}
                      {activeTab === 'placement' && this.renderPlacementTab()}
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
                );
              }}
            />
          </Modal>
          {saveAsOpen && (
            <SaveProfileModal
              initialValues={this.getSaveAsInitialValues()}
              onClose={() => this.setState({ saveAsOpen: false })}
              onSubmit={this.handleSaveAs}
            />
          )}
        </div>
      );
    }
}

export default SvgImport;
