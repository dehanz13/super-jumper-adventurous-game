import { describe, expect, it, vi } from 'vitest';
import { createGuestCredentialStore } from '../src/game/guestCredentialStore.js';

const credential = 'a'.repeat(43);
const expiresAt = '2030-01-07T00:00:00.000Z';

describe('guest credential storage', () => {
  it('persists only the week credential and removes it at expiry', () => {
    const storage = new Map();
    const backend = {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    };
    const store = createGuestCredentialStore(backend);
    expect(store.save(credential, expiresAt)).toBe(true);
    expect(Array.from(storage.keys())).toEqual(['nova-orbit-jump.guest-credential.v1']);
    expect(store.read(Date.parse(expiresAt) - 1)).toBe(credential);
    expect(Array.from(storage.values())[0]).not.toContain('runToken');
    expect(store.read(Date.parse(expiresAt))).toBeNull();
    expect(storage.size).toBe(0);
  });

  it('fails closed when storage is unavailable or corrupt', () => {
    const backend = { getItem: vi.fn(() => '{bad'), setItem: vi.fn(() => { throw new Error('denied'); }), removeItem: vi.fn() };
    const store = createGuestCredentialStore(backend);
    expect(store.read()).toBeNull();
    expect(backend.removeItem).toHaveBeenCalledTimes(1);
    expect(store.save(credential, expiresAt)).toBe(false);
    expect(() => store.clear()).not.toThrow();
    expect(() => store.save('bad', expiresAt)).toThrow(TypeError);
  });
});
