import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import pubsub from 'pubsub-js';
import { ensureArray } from 'ensure-type';
import api from 'app/api';
import SaveProfileModal from 'app/containers/Workspace/modals/SaveProfileModal';
import { Input } from 'app/components/FormControl';
import FormGroup from 'app/components/FormGroup';
import Modal from 'app/components/Modal';
import { Nav, NavItem } from 'app/components/Navs';
import { ToastNotification } from 'app/components/Notifications';
import controller from 'app/lib/controller';
import ensurePositiveNumber from 'app/lib/ensure-positive-number';
import i18n from 'app/lib/i18n';
import { percentToS } from 'app/lib/laser';
import { getLastImport, setLastImport } from 'app/lib/lastImport';
import {
  DEFAULT_PROFILE_PARAMS,
  PROFILE_PARAM_KEYS,
  getProfileSummary,
  readLastProfileId,
  sanitizeProfileParams,
  writeLastProfileId,
} from 'app/lib/laserProfiles';
import store from 'app/store';

const getErrorMessage = (res, fallback) => {
  return (res && res.body && res.body.msg) || fallback;
};

const FIELD_GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 220px))',
  columnGap: 12,
  rowGap: 0,
  alignItems: 'start',
};

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const optionalNumber = (value) => {
  if (value === '' || value === undefined || value === null) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

class RunModal extends PureComponent {
    static propTypes = {
      state: PropTypes.object,
      actions: PropTypes.object
    };

    constructor(props) {
      super(props);

      const machineProfile = store.get('workspace.machineProfile') || {};
      this.machineProfileId = machineProfile.id || '';
      this.machineProfileName = machineProfile.name || '';

      this.state = {
        ...this.getInitialDraft(),
        profiles: [],
        selectedProfileId: '',
        savingProfile: false,
        busy: '',
        regenerate: !!getLastImport(),
        saveAsOpen: false,
        profileError: '',
        profileNotice: '',
        activeTab: 'laser',
      };
    }

    getInitialDraft() {
      const { state } = this.props;
      const maxS = state.modal.params.maxS;
      const lastImport = getLastImport();
      const options = (lastImport && lastImport.options) || {};
      const hasPower = Number.isFinite(Number(options.power)) && Number(maxS) > 0;
      const powerPercent = hasPower
        ? Math.round((Number(options.power) / Number(maxS)) * 100)
        : state.modal.params.powerPercent;

      return {
        powerPercent: powerPercent !== undefined ? powerPercent : 100,
        feedRate: options.feedRate !== undefined ? options.feedRate : state.modal.params.feedRate,
        fan: options.fan !== undefined ? !!options.fan : !!state.modal.params.fan,
        travelRate: num(options.travelRate, DEFAULT_PROFILE_PARAMS.travelRate),
        laserMode: options.laserMode === 'M3' ? 'M3' : 'M4',
        passes: num(options.passes, DEFAULT_PROFILE_PARAMS.passes),
        engraveMode: ['line', 'fill', 'both'].includes(options.engraveMode)
          ? options.engraveMode
          : DEFAULT_PROFILE_PARAMS.engraveMode,
        fillSpacing: num(options.fillSpacing, DEFAULT_PROFILE_PARAMS.fillSpacing),
        fillAngle: num(options.fillAngle, DEFAULT_PROFILE_PARAMS.fillAngle),
        focusZ: options.focusZ === undefined || options.focusZ === null ? '' : options.focusZ,
        z: options.z === undefined || options.z === null ? '' : options.z,
        scale: num(options.scale, 1),
        offsetX: num(options.offsetX, 0),
        offsetY: num(options.offsetY, 0),
        invertY: options.invertY === true ? 'yes' : 'no',
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
          const selectedProfile = profiles.find(profile => profile.id === lastProfileId)
            || profiles.find(profile => profile.favorite)
            || null;

          this.setState({
            profiles,
            selectedProfileId: selectedProfile ? selectedProfile.id : '',
          });
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

    getDraftProfileParams = () => {
      return sanitizeProfileParams({
        powerPercent: this.state.powerPercent,
        laserMode: this.state.laserMode,
        feedRate: this.state.feedRate,
        travelRate: this.state.travelRate,
        passes: this.state.passes,
        engraveMode: this.state.engraveMode,
        fillSpacing: this.state.fillSpacing,
        fillAngle: this.state.fillAngle,
        fan: this.state.fan,
      });
    };

    getDraftOptions = () => {
      const lastImport = getLastImport();
      const base = (lastImport && lastImport.options) || {};
      const maxS = this.props.state.modal.params.maxS;

      return {
        ...base,
        feedRate: num(this.state.feedRate, 300),
        travelRate: num(this.state.travelRate, 3000),
        power: percentToS(num(this.state.powerPercent, 100), maxS),
        laserMode: this.state.laserMode,
        engraveMode: this.state.engraveMode,
        fillSpacing: Math.max(0.01, num(this.state.fillSpacing, 0.2)),
        fillAngle: num(this.state.fillAngle, 0),
        passes: Math.max(1, Math.round(num(this.state.passes, 1))),
        focusZ: optionalNumber(this.state.focusZ),
        z: optionalNumber(this.state.z),
        scale: num(this.state.scale, 1),
        offsetX: num(this.state.offsetX, 0),
        offsetY: num(this.state.offsetY, 0),
        invertY: this.state.invertY !== 'no',
        fan: !!this.state.fan,
      };
    };

    isProfileModified = () => {
      const profile = this.getSelectedProfile();

      if (!profile) {
        return false;
      }

      const draft = this.getDraftProfileParams();
      const saved = sanitizeProfileParams(profile.params);

      return PROFILE_PARAM_KEYS.some((key) => {
        return String(draft[key]) !== String(saved[key]);
      });
    };

    applyProfile = (profile) => {
      const params = sanitizeProfileParams(profile.params);
      const lastImport = getLastImport();

      this.setState({
        selectedProfileId: profile.id,
        powerPercent: params.powerPercent,
        feedRate: params.feedRate,
        travelRate: params.travelRate,
        laserMode: params.laserMode,
        passes: params.passes,
        engraveMode: params.engraveMode,
        fillSpacing: params.fillSpacing,
        fillAngle: params.fillAngle,
        fan: params.fan,
        regenerate: lastImport ? true : this.state.regenerate,
        profileNotice: '',
      });
      writeLastProfileId(this.machineProfileId, profile.id);
    };

    handleTabSelect = (activeTab) => {
      this.setState({ activeTab });
    };

    handleChangeField = (key, value) => {
      const requiresRegeneration = !['powerPercent', 'feedRate', 'fan'].includes(key);
      const nextState = { [key]: value };

      if (requiresRegeneration && getLastImport()) {
        nextState.regenerate = true;
      }

      this.setState(nextState);
    };

    handleChangeFan = (event) => {
      this.setState({ fan: event.target.checked });
    };

    handleChangeRegenerate = (event) => {
      this.setState({ regenerate: event.target.checked });
    };

    handleChangeProfile = (event) => {
      const id = event.target.value;
      const profile = this.state.profiles.find(item => item.id === id);

      if (!profile) {
        this.setState({ selectedProfileId: '' });
        return;
      }

      this.applyProfile(profile);
    };

    handleApplyProfile = () => {
      const profile = this.getSelectedProfile();

      if (profile) {
        this.applyProfile(profile);
      }
    };

    handleSaveProfile = () => {
      const profile = this.getSelectedProfile();

      if (!profile) {
        return;
      }

      this.setState({ savingProfile: true, profileError: '', profileNotice: '' });

      api.profiles.update(profile.id, {
        params: this.getDraftProfileParams(),
      })
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

      this.setState({ savingProfile: true, profileError: '', profileNotice: '' });

      api.profiles.create({
        machineProfileId: this.machineProfileId,
        name: meta.name,
        material: meta.material,
        materialLabel: meta.materialLabel,
        thickness: Number(meta.thickness) || 0,
        operation: meta.operation,
        notes: this.getSelectedProfile() ? this.getSelectedProfile().notes : '',
        favorite: false,
        params: this.getDraftProfileParams(),
      })
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
      const profile = this.getSelectedProfile();
      let operation = 'cut';

      if (profile) {
        operation = profile.operation;
      } else if (this.state.engraveMode !== 'line') {
        operation = 'engrave';
      }

      return {
        name: profile ? `${profile.name} (${i18n._('copy')})` : '',
        material: profile ? profile.material : 'other',
        materialLabel: profile ? profile.materialLabel : '',
        thickness: profile ? profile.thickness : 0,
        operation,
      };
    };

    regenerateGCode = () => {
      const lastImport = getLastImport();

      if (!lastImport) {
        return Promise.resolve(null);
      }

      const options = this.getDraftOptions();
      const port = controller.port || lastImport.port;
      const request = lastImport.mode === 'stl'
        ? api.loadSTL({
          port,
          name: lastImport.name,
          stl: lastImport.content,
          options,
        })
        : api.loadSVG({
          port,
          name: lastImport.name,
          svg: lastImport.content,
          options,
        });

      return request.then((res) => {
        const { name = '', gcode = '' } = { ...res.body };
        pubsub.publish('gcode:load', { name, gcode });
        setLastImport({ ...lastImport, port, options });
        this.previewedSignature = JSON.stringify(options);
        return res;
      });
    };

    handlePreview = () => {
      if (!getLastImport() || this.state.busy) {
        return;
      }

      this.setState({ busy: 'preview', profileError: '', profileNotice: '' });

      this.regenerateGCode()
        .then((res) => {
          if (!res) {
            return;
          }
          this.setState({
            busy: '',
            profileNotice: i18n._('G-code updated.'),
          });
        })
        .catch((res) => {
          this.setState({
            busy: '',
            profileError: getErrorMessage(res, i18n._('Unable to regenerate the G-code.')),
          });
        });
    };

    handleStart = () => {
      const { state, actions } = this.props;
      const lastImport = getLastImport();
      const shouldRegenerate = lastImport && this.state.regenerate;
      const start = () => {
        actions.startGCode({
          powerPercent: ensurePositiveNumber(this.state.powerPercent),
          feedRate: ensurePositiveNumber(this.state.feedRate),
          fan: !!this.state.fan,
        });
      };

      if (shouldRegenerate) {
        const options = this.getDraftOptions();

        if (this.previewedSignature === JSON.stringify(options)) {
          start();
          actions.closeModal();
          return;
        }

        this.setState({ busy: 'start', profileError: '', profileNotice: '' });

        this.regenerateGCode()
          .then((res) => {
            if (!res) {
              return;
            }
            this.setState({ busy: '' });
            start();
            actions.closeModal();
          })
          .catch((res) => {
            this.setState({
              busy: '',
              profileError: getErrorMessage(res, i18n._('Unable to regenerate the G-code.')),
            });
          });
        return;
      }

      actions.runGCode({
        powerPercent: ensurePositiveNumber(this.state.powerPercent),
        feedRate: ensurePositiveNumber(this.state.feedRate),
        fan: !!this.state.fan,
        maxS: state.modal.params.maxS
      });
      actions.closeModal();
    };

    renderNumberField = (label, key, props = {}, hint = '') => {
      const { ariaLabel, ...inputProps } = props;
      const disabled = !!props.disabled || !!this.state.busy;

      return (
        <FormGroup>
          <label>{label}</label>
          <Input
            {...inputProps}
            aria-label={ariaLabel || label}
            type="number"
            value={this.state[key]}
            disabled={disabled}
            onChange={event => this.handleChangeField(key, event.target.value)}
          />
          {hint && <small className="text-muted">{hint}</small>}
        </FormGroup>
      );
    };

    renderSelectField = (label, key, options, props = {}) => {
      const { ariaLabel, ...selectProps } = props;
      const disabled = !!props.disabled || !!this.state.busy;

      return (
        <FormGroup>
          <label>{label}</label>
          <select
            {...selectProps}
            aria-label={ariaLabel || label}
            className="form-control"
            value={this.state[key]}
            disabled={disabled}
            onChange={event => this.handleChangeField(key, event.target.value)}
          >
            {options}
          </select>
        </FormGroup>
      );
    };

    renderFanField = () => {
      const disabled = !!this.state.busy;

      return (
        <FormGroup>
          <label>{i18n._('Fan (M8)')}</label>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={!!this.state.fan}
                disabled={disabled}
                onChange={this.handleChangeFan}
              />
              {i18n._('Enabled')}
            </label>
          </div>
        </FormGroup>
      );
    };

    renderLaserTab = (canRegenerate) => {
      const lastImport = getLastImport();
      const isStl = !!(lastImport && lastImport.mode === 'stl');
      const maxS = this.props.state.modal.params.maxS;

      return (
        <div style={FIELD_GRID_STYLE}>
          {this.renderNumberField(
            i18n._('Speed (mm/min)'),
            'feedRate',
            { ariaLabel: 'Cutting speed' },
            i18n._('Speed while the laser is on. Lower = more energy per mm.')
          )}
          {this.renderNumberField(
            i18n._('Travel Rate (mm/min)'),
            'travelRate',
            { disabled: !canRegenerate },
            i18n._('Speed while the laser is off (G0 moves).')
          )}
          <FormGroup>
            <label>{i18n._('Power (%)')}</label>
            <Input
              aria-label="Laser power percentage"
              type="number"
              value={this.state.powerPercent}
              min={0}
              max={100}
              step={1}
              disabled={!!this.state.busy}
              onChange={event => this.handleChangeField('powerPercent', event.target.value)}
            />
            <small className="text-muted">
              {`= S${percentToS(this.state.powerPercent, maxS)} · ${i18n._('Maximum value')} S${maxS}`}
            </small>
          </FormGroup>
          {this.renderSelectField(i18n._('Laser Mode'), 'laserMode', [
            <option key="M4" value="M4">{i18n._('M4 - Dynamic power')}</option>,
            <option key="M3" value="M3">{i18n._('M3 - Constant power')}</option>,
          ], { disabled: !canRegenerate })}
          {this.renderNumberField(i18n._('Passes'), 'passes', {
            min: 1,
            step: 1,
            disabled: !canRegenerate,
          })}
          {this.renderFanField()}
          {isStl && this.renderNumberField(i18n._('Slice Z (mm, optional)'), 'z', {
            disabled: !canRegenerate,
          })}
          {this.renderNumberField(i18n._('Focus Z (mm, optional)'), 'focusZ', {
            disabled: !canRegenerate,
          })}
        </div>
      );
    };

    renderEngravingTab = (canRegenerate) => (
      <div style={FIELD_GRID_STYLE}>
        {this.renderSelectField(i18n._('Engraving Mode'), 'engraveMode', [
          <option key="line" value="line">{i18n._('Line (outline)')}</option>,
          <option key="fill" value="fill">{i18n._('Fill (hatch)')}</option>,
          <option key="both" value="both">{i18n._('Line + Fill')}</option>,
        ], { disabled: !canRegenerate })}
        {this.state.engraveMode !== 'line' && this.renderNumberField(
          i18n._('Fill Spacing (mm)'),
          'fillSpacing',
          { min: 0.01, step: 0.01, disabled: !canRegenerate }
        )}
        {this.state.engraveMode !== 'line' && this.renderNumberField(
          i18n._('Fill Angle (deg)'),
          'fillAngle',
          { step: 1, disabled: !canRegenerate }
        )}
        {this.state.engraveMode === 'line' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <small className="text-muted">
              {i18n._('Line mode traces only the outline. Select Fill or Line + Fill to generate hatch lines.')}
            </small>
          </div>
        )}
      </div>
    );

    renderPlacementTab = (canRegenerate) => (
      <div style={FIELD_GRID_STYLE}>
        {this.renderNumberField(i18n._('Scale'), 'scale', {
          disabled: !canRegenerate,
        }, i18n._('1 = original size, 0.5 = half, 2 = double.'))}
        {this.renderSelectField(i18n._('Invert Y Axis'), 'invertY', [
          <option key="yes" value="yes">{i18n._('Yes')}</option>,
          <option key="no" value="no">{i18n._('No')}</option>,
        ], { disabled: !canRegenerate })}
        {this.renderNumberField(i18n._('Offset X (mm)'), 'offsetX', {
          disabled: !canRegenerate,
        })}
        {this.renderNumberField(i18n._('Offset Y (mm)'), 'offsetY', {
          disabled: !canRegenerate,
        })}
      </div>
    );

    renderProfilePanel = (lastImport) => {
      const {
        profiles,
        selectedProfileId,
        savingProfile,
        busy,
      } = this.state;
      const hasMachineProfile = !!this.machineProfileId;
      const selectedProfile = this.getSelectedProfile();
      const profileModified = this.isProfileModified();

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
                className="form-control input-sm"
                style={{ width: '100%' }}
                value={selectedProfileId}
                disabled={!hasMachineProfile || profiles.length === 0 || !!busy}
                onChange={this.handleChangeProfile}
              >
                <option value="">
                  {profiles.length > 0
                    ? i18n._('Select a profile')
                    : i18n._('No profiles for this machine')}
                </option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.favorite ? '★ ' : ''}{profile.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <button
                type="button"
                className="btn btn-default btn-sm"
                disabled={!selectedProfile || !!busy}
                onClick={this.handleApplyProfile}
              >
                {i18n._('Apply')}
              </button>
              <button
                type="button"
                className="btn btn-default btn-sm"
                disabled={!selectedProfile || savingProfile || !!busy}
                onClick={this.handleSaveProfile}
              >
                {i18n._('Save')}
              </button>
              <button
                type="button"
                className="btn btn-default btn-sm"
                disabled={!hasMachineProfile || savingProfile || !!busy}
                onClick={this.handleOpenSaveAs}
              >
                {i18n._('Save as…')}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, marginTop: 4 }}>
            <small
              className={hasMachineProfile ? 'text-muted' : 'text-danger'}
              style={{
                display: 'block',
                flex: '1 1 auto',
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={selectedProfile ? getProfileSummary(selectedProfile) : ''}
            >
              {!hasMachineProfile
                && i18n._('Select a Machine Profile in the Visualizer to use laser profiles.')}
              {hasMachineProfile && (selectedProfile
                ? `${this.machineProfileName} · ${getProfileSummary(selectedProfile)}`
                : this.machineProfileName)}
            </small>
            {profileModified && (
              <span className="label label-warning" style={{ marginLeft: 8, flex: '0 0 auto' }}>
                {i18n._('modified')}
              </span>
            )}
          </div>
          {hasMachineProfile && profiles.length === 0 && (
            <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>
              {i18n._('No profiles for this machine yet. Use Save as… to create one from the current values.')}
            </small>
          )}
          {lastImport && (
            <small
              className="text-muted"
              style={{
                display: 'block',
                marginTop: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={lastImport.name}
            >
              {i18n._('Source: {{name}}', { name: lastImport.name })}
            </small>
          )}
        </div>
      );
    };

    render() {
      const { actions } = this.props;
      const {
        busy,
        regenerate,
        saveAsOpen,
        profileError,
        profileNotice,
        activeTab,
      } = this.state;
      const lastImport = getLastImport();
      const canRegenerate = !!lastImport;

      return (
        <div>
          <Modal
            disableOverlay
            size="lg"
            style={{ width: '95vw', maxWidth: 1100 }}
            onClose={actions.closeModal}
          >
            <Modal.Header>
              <Modal.Title>
                {i18n._('Run')}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
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
              {this.renderProfilePanel(lastImport)}
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
              {activeTab === 'laser' && this.renderLaserTab(canRegenerate)}
              {activeTab === 'engraving' && this.renderEngravingTab(canRegenerate)}
              {activeTab === 'placement' && this.renderPlacementTab(canRegenerate)}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
                <label style={{ fontWeight: 'normal' }}>
                  <input
                    type="checkbox"
                    checked={!!regenerate && canRegenerate}
                    disabled={!canRegenerate || !!busy}
                    onChange={this.handleChangeRegenerate}
                    style={{ marginRight: 6 }}
                  />
                  {i18n._('Regenerate G-code from source before starting')}
                </label>
                <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>
                  {!canRegenerate && i18n._('Reimport an SVG/STL to change passes, fill, engraving mode or placement. Only power, speed and fan can be applied to the loaded G-code.')}
                  {canRegenerate && regenerate && i18n._('The G-code will be rebuilt from {{name}} with the values above before starting.', { name: lastImport.name })}
                  {canRegenerate && !regenerate && i18n._('Only power, speed and fan will be applied to the loaded G-code.')}
                </small>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <button
                type="button"
                className="btn btn-default"
                disabled={!!busy}
                onClick={actions.closeModal}
              >
                {i18n._('Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-default"
                disabled={!canRegenerate || !!busy}
                onClick={this.handlePreview}
              >
                {busy === 'preview' ? i18n._('Previewing...') : i18n._('Preview')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!!busy}
                onClick={this.handleStart}
              >
                {busy === 'start' ? i18n._('Starting...') : i18n._('Start')}
              </button>
            </Modal.Footer>
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

export default RunModal;
