import { createEditorCreature } from './geometry';

export const EDITOR_DRAFT_KEY = 'nova-orbit-jump.editor-draft.v1';
const VERSION = 1;
const MAX_BYTES = 256_000;
const MAX_ITEMS = 1_000;
const CREATURES = new Set(['pebblit', 'rollpod', 'signalSnare', 'prismite', 'hovermite', 'warden', 'skitter', 'orbitSkimmer', 'pulseDrone']);
const PICKUPS = new Set(['powerCell', 'plasma', 'spectrum', 'armor', 'heart']);
const TERRAIN = new Set(['ground', 'brick', 'question']);

const coordinate = value => Number.isFinite(value) && value >= -1_000 && value <= 100_000;
const dimension = value => Number.isFinite(value) && value > 0 && value <= 2_000;

function normalizeItems(items, limit, normalize) {
  if (!Array.isArray(items) || items.length > limit) return null;
  const result = items.map(normalize);
  return result.every(Boolean) ? result : null;
}

export function normalizeEditorDraft(source) {
  if (!source || typeof source !== 'object') return null;
  const platforms = normalizeItems(source.platforms, MAX_ITEMS, item =>
    item && coordinate(item.x) && coordinate(item.y) && dimension(item.width) && dimension(item.height) && TERRAIN.has(item.type)
      ? { x: item.x, y: item.y, width: item.width, height: item.height, type: item.type }
      : null);
  const coins = normalizeItems(source.coins, MAX_ITEMS, item =>
    item && coordinate(item.x) && coordinate(item.y) ? { x: item.x, y: item.y } : null);
  const enemies = normalizeItems(source.enemies, MAX_ITEMS, item => {
    if (!item || !CREATURES.has(item.type) || !coordinate(item.x) || !coordinate(item.y)) return null;
    const gridY = item.type === 'signalSnare' ? item.y : item.y - 32 + createEditorCreature(item.type, 0, 0).height;
    return createEditorCreature(item.type, item.x, gridY);
  });
  const powerUps = normalizeItems(source.powerUps, MAX_ITEMS, item =>
    item && coordinate(item.x) && coordinate(item.y) && PICKUPS.has(item.type) && typeof item.spawned === 'boolean'
      ? { x: item.x, y: item.y, type: item.type, spawned: item.spawned }
      : null);
  const flag = source.flag && coordinate(source.flag.x) && coordinate(source.flag.y)
    && dimension(source.flag.width) && dimension(source.flag.height)
    ? { x: source.flag.x, y: source.flag.y, width: source.flag.width, height: source.flag.height }
    : null;
  if (!platforms || !coins || !enemies || !powerUps || !flag) return null;

  return { name: 'Custom Level', maxOffset: 2_000, platforms, coins, enemies, powerUps, flag };
}

export function loadEditorDraft(storageProvider = () => window.localStorage) {
  try {
    const raw = storageProvider().getItem(EDITOR_DRAFT_KEY);
    if (!raw || raw.length > MAX_BYTES) return null;
    const record = JSON.parse(raw);
    return record?.version === VERSION ? normalizeEditorDraft(record.level) : null;
  } catch {
    return null;
  }
}

export function saveEditorDraft(world, storageProvider = () => window.localStorage) {
  const level = normalizeEditorDraft(world);
  if (!level) return { level: null, persisted: false };
  const raw = JSON.stringify({ version: VERSION, level });
  if (raw.length > MAX_BYTES) return { level, persisted: false };
  try {
    storageProvider().setItem(EDITOR_DRAFT_KEY, raw);
    return { level, persisted: true };
  } catch {
    return { level, persisted: false };
  }
}
