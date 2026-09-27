import { describe, expect, it, vi } from 'vitest';
import { createEditorCreature } from '../src/game/geometry';
import { EDITOR_DRAFT_KEY, loadEditorDraft, normalizeEditorDraft, saveEditorDraft } from '../src/game/editorDraft';

const world = () => ({
  offset: 320,
  platforms: [{ x: 0, y: 500, width: 800, height: 100, type: 'ground', isUsed: true }],
  coins: [{ x: 144, y: 160, collected: true }],
  enemies: [{ ...createEditorCreature('warden', 224, 256), hp: 1, alive: false }],
  powerUps: [{ x: 192, y: 224, type: 'heart', spawned: true, collected: true }],
  flag: { x: 1800, y: 200, width: 20, height: 300 },
  enemyProjectiles: [{ x: 10, y: 10 }],
});

describe('Level Creator draft', () => {
  it('stores authored objects and rebuilds creature defaults on load', () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    const saved = saveEditorDraft(world(), () => storage);
    expect(saved.persisted).toBe(true);
    expect(saved.level.offset).toBeUndefined();
    expect(saved.level.platforms[0].isUsed).toBeUndefined();
    expect(saved.level.enemies[0].hp).toBe(5);
    expect(saved.level.enemies[0].alive).toBe(true);
    expect(saved.level.coins[0].collected).toBeUndefined();
    expect(saved.level.powerUps[0].collected).toBeUndefined();
    expect(loadEditorDraft(() => storage)).toEqual(saved.level);
    expect(JSON.parse(values.get(EDITOR_DRAFT_KEY)).version).toBe(1);
  });

  it('rejects incompatible, corrupt, oversized, and unknown item data', () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    storage.getItem.mockReturnValue(JSON.stringify({ version: 2, level: world() }));
    expect(loadEditorDraft(() => storage)).toBeNull();
    storage.getItem.mockReturnValue('{broken');
    expect(loadEditorDraft(() => storage)).toBeNull();
    storage.getItem.mockReturnValue('x'.repeat(256_001));
    expect(loadEditorDraft(() => storage)).toBeNull();
    expect(normalizeEditorDraft({ ...world(), enemies: [{ type: 'unknown', x: 0, y: 0 }] })).toBeNull();
    expect(normalizeEditorDraft({ ...world(), coins: [{ x: Infinity, y: 0 }] })).toBeNull();
    expect(normalizeEditorDraft({ ...world(), platforms: Array(1_001).fill(world().platforms[0]) })).toBeNull();
  });

  it('retains a session draft when browser storage denies access', () => {
    const denied = () => { throw new Error('storage denied'); };
    expect(saveEditorDraft(world(), denied)).toMatchObject({ persisted: false, level: expect.any(Object) });
    expect(loadEditorDraft(denied)).toBeNull();
    expect(saveEditorDraft({ ...world(), flag: null }, denied)).toEqual({ level: null, persisted: false });
  });
});
