export const makeHelpProgressKey = (kind, version, userId, guideId) =>
  `trendscore:${kind}:v${version}:${userId || 'anonymous'}:${guideId}`;

export const readHelpProgress = (storage, key) => {
  try { return JSON.parse(storage.getItem(key) || '{}'); } catch { return {}; }
};

export const writeHelpProgress = (storage, key, value) => {
  storage.setItem(key, JSON.stringify(value));
};
