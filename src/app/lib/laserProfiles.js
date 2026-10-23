import i18n from 'app/lib/i18n';

// Keep this list in sync with src/server/api/api.profiles.js
export const MATERIALS = [
  { value: 'paper' },
  { value: 'cardboard' },
  { value: 'adhesive' },
  { value: 'wood' },
  { value: 'acrylic' },
  { value: 'leather' },
  { value: 'fabric' },
  { value: 'glass' },
  { value: 'metal' },
  { value: 'pla' },
  { value: 'abs' },
  { value: 'petg' },
  { value: 'other' },
];

export const OPERATIONS = [
  { value: 'engrave' },
  { value: 'cut' },
];

export const PROFILE_PARAM_KEYS = [
  'powerPercent',
  'laserMode',
  'feedRate',
  'travelRate',
  'passes',
  'engraveMode',
  'fillSpacing',
  'fillAngle',
  'fan',
];

export const DEFAULT_PROFILE_PARAMS = {
  powerPercent: 100,
  laserMode: 'M4',
  feedRate: 300,
  travelRate: 3000,
  passes: 1,
  engraveMode: 'line',
  fillSpacing: 0.2,
  fillAngle: 0,
  fan: true,
};

// Starting points for the Mecpow M1 (3.5 W diode). They are intentionally
// conservative; always test on a scrap piece before running a real job.
export const RECOMMENDED_PROFILES = [
  {
    name: 'Papel 0,1 mm — Corte',
    material: 'paper',
    materialLabel: 'Papel',
    thickness: 0.1,
    operation: 'cut',
    notes: 'Risco de fogo. Use velocidade alta e supervise o trabalho.',
    params: { powerPercent: 12, feedRate: 800, passes: 1, engraveMode: 'line' },
  },
  {
    name: 'Papelão 2 mm — Corte',
    material: 'cardboard',
    materialLabel: 'Papelão',
    thickness: 2,
    operation: 'cut',
    notes: 'Air assist ligado.',
    params: { powerPercent: 50, feedRate: 350, passes: 2, engraveMode: 'line' },
  },
  {
    name: 'Adesivo/Vinil — Corte',
    material: 'adhesive',
    materialLabel: 'Vinil',
    thickness: 0.1,
    operation: 'cut',
    notes: 'Evite PVC (gases). Ventilação e air assist.',
    params: { powerPercent: 20, feedRate: 800, passes: 1, engraveMode: 'line' },
  },
  {
    name: 'Adesivo/Vinil — Gravação',
    material: 'adhesive',
    materialLabel: 'Vinil',
    thickness: 0.1,
    operation: 'engrave',
    notes: '',
    params: { powerPercent: 15, feedRate: 2500, passes: 1, engraveMode: 'fill', fillSpacing: 0.12 },
  },
  {
    name: 'MDF 3 mm — Corte',
    material: 'wood',
    materialLabel: 'MDF',
    thickness: 3,
    operation: 'cut',
    notes: 'Air assist obrigatório.',
    params: { powerPercent: 100, feedRate: 150, passes: 4, engraveMode: 'line' },
  },
  {
    name: 'MDF 3 mm — Gravação',
    material: 'wood',
    materialLabel: 'MDF',
    thickness: 3,
    operation: 'engrave',
    notes: '',
    params: { powerPercent: 45, feedRate: 1500, passes: 1, engraveMode: 'fill', fillSpacing: 0.15 },
  },
  {
    name: 'Madeira dura 5 mm — Corte',
    material: 'wood',
    materialLabel: 'Madeira dura',
    thickness: 5,
    operation: 'cut',
    notes: 'Muitos passes; acompanhe a profundidade.',
    params: { powerPercent: 100, feedRate: 110, passes: 8, engraveMode: 'line' },
  },
  {
    name: 'Acrílico preto 3 mm — Corte',
    material: 'acrylic',
    materialLabel: 'Acrílico preto',
    thickness: 3,
    operation: 'cut',
    notes: 'Acrílico transparente/colorido exige testes diferentes.',
    params: { powerPercent: 80, feedRate: 250, passes: 3, engraveMode: 'line' },
  },
  {
    name: 'Couro 2 mm — Corte',
    material: 'leather',
    materialLabel: 'Couro',
    thickness: 2,
    operation: 'cut',
    notes: '',
    params: { powerPercent: 55, feedRate: 350, passes: 2, engraveMode: 'line' },
  },
  {
    name: 'Metal — Marcação',
    material: 'metal',
    materialLabel: 'Metal',
    thickness: 0,
    operation: 'engrave',
    notes: 'Diodo 3.5 W não corta metal. Use spray de marcação.',
    params: { powerPercent: 100, feedRate: 450, passes: 2, engraveMode: 'line' },
  },
  {
    name: 'PLA 2 mm — Corte',
    material: 'pla',
    materialLabel: 'PLA',
    thickness: 2,
    operation: 'cut',
    notes: 'Ventilação.',
    params: { powerPercent: 65, feedRate: 250, passes: 3, engraveMode: 'line' },
  },
  {
    name: 'ABS 2 mm — Corte',
    material: 'abs',
    materialLabel: 'ABS',
    thickness: 2,
    operation: 'cut',
    notes: 'Ventilação/filtro; evite respirar os gases.',
    params: { powerPercent: 55, feedRate: 300, passes: 3, engraveMode: 'line' },
  },
];

export const getRecommendedProfiles = (machineProfileId) => {
  return RECOMMENDED_PROFILES.map(profile => ({
    machineProfileId,
    name: profile.name,
    material: profile.material,
    materialLabel: profile.materialLabel,
    thickness: profile.thickness,
    operation: profile.operation,
    notes: profile.notes,
    favorite: false,
    params: {
      ...DEFAULT_PROFILE_PARAMS,
      ...profile.params,
    },
  }));
};

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const sanitizeProfileParams = (payload = {}) => {
  const params = { ...payload };

  return {
    powerPercent: clamp(num(params.powerPercent, DEFAULT_PROFILE_PARAMS.powerPercent), 0, 100),
    laserMode: ['M3', 'M4'].includes(params.laserMode) ? params.laserMode : DEFAULT_PROFILE_PARAMS.laserMode,
    feedRate: Math.max(1, num(params.feedRate, DEFAULT_PROFILE_PARAMS.feedRate)),
    travelRate: Math.max(1, num(params.travelRate, DEFAULT_PROFILE_PARAMS.travelRate)),
    passes: Math.max(1, Math.round(num(params.passes, DEFAULT_PROFILE_PARAMS.passes))),
    engraveMode: ['line', 'fill', 'both'].includes(params.engraveMode) ? params.engraveMode : DEFAULT_PROFILE_PARAMS.engraveMode,
    fillSpacing: Math.max(0.01, num(params.fillSpacing, DEFAULT_PROFILE_PARAMS.fillSpacing)),
    fillAngle: num(params.fillAngle, DEFAULT_PROFILE_PARAMS.fillAngle),
    fan: params.fan === undefined ? DEFAULT_PROFILE_PARAMS.fan : !!params.fan,
  };
};

// Profile params are stored with native types, but the import form uses
// "yes"/"no" for the fan select. Keep the conversion in one place.
export const profileToFormValues = (profile = {}) => {
  const params = sanitizeProfileParams(profile.params);

  return {
    ...params,
    fan: params.fan ? 'yes' : 'no',
  };
};

export const formValuesToProfileParams = (values = {}) => {
  return sanitizeProfileParams({
    powerPercent: values.powerPercent,
    laserMode: values.laserMode,
    feedRate: values.feedRate,
    travelRate: values.travelRate,
    passes: values.passes,
    engraveMode: values.engraveMode,
    fillSpacing: values.fillSpacing,
    fillAngle: values.fillAngle,
    fan: values.fan !== 'no',
  });
};

// The import dialog stores the last values used in localStorage. The Run
// dialog reuses them as a base when creating a profile on the fly, so passes
// and fill settings are not lost just because no profile was selected.
export const getLastImportProfileParams = () => {
  try {
    const raw = window.localStorage.getItem('cncjs.import.lastValues');
    const values = raw ? JSON.parse(raw) : {};
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return { ...DEFAULT_PROFILE_PARAMS };
    }
    return formValuesToProfileParams(values);
  } catch (err) {
    return { ...DEFAULT_PROFILE_PARAMS };
  }
};

export const getMaterialLabel = (material, materialLabel) => {
  if (materialLabel) {
    return materialLabel;
  }

  switch (material) {
    case 'paper': return i18n._('Paper');
    case 'cardboard': return i18n._('Cardboard');
    case 'adhesive': return i18n._('Adhesive / Vinyl');
    case 'wood': return i18n._('Wood');
    case 'acrylic': return i18n._('Acrylic');
    case 'leather': return i18n._('Leather');
    case 'fabric': return i18n._('Fabric');
    case 'glass': return i18n._('Glass');
    case 'metal': return i18n._('Metal');
    case 'pla': return i18n._('PLA');
    case 'abs': return i18n._('ABS');
    case 'petg': return i18n._('PETG');
    default: return i18n._('Other');
  }
};

export const getOperationLabel = (operation) => {
  switch (operation) {
    case 'cut': return i18n._('Cut');
    default: return i18n._('Engrave');
  }
};

export const getProfileSummary = (profile) => {
  if (!profile) {
    return '';
  }

  const params = sanitizeProfileParams(profile.params);
  const parts = [
    getMaterialLabel(profile.material, profile.materialLabel),
  ];

  if (Number(profile.thickness) > 0) {
    parts.push(`${profile.thickness} mm`);
  }

  parts.push(getOperationLabel(profile.operation));
  parts.push(`${params.powerPercent}%`);
  parts.push(`${params.feedRate} mm/min`);
  parts.push(`${params.passes} ${params.passes === 1 ? i18n._('pass') : i18n._('passes')}`);

  return parts.join(' · ');
};

export const importProfileFromEngraveMode = (engraveMode) => {
  return engraveMode === 'line' ? 'cut' : 'engrave';
};

export const readLastProfileId = (machineProfileId) => {
  if (!machineProfileId) {
    return '';
  }

  try {
    return window.localStorage.getItem(`cncjs.import.lastProfile.${machineProfileId}`) || '';
  } catch (err) {
    return '';
  }
};

export const writeLastProfileId = (machineProfileId, profileId) => {
  if (!machineProfileId) {
    return;
  }

  try {
    const key = `cncjs.import.lastProfile.${machineProfileId}`;
    if (profileId) {
      window.localStorage.setItem(key, profileId);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch (err) {
    // Ignore unavailable storage (private mode or quota exceeded)
  }
};
