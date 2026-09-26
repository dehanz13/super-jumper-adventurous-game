const KEY = 'nova-orbit-jump.guest-credential.v1';
const CREDENTIAL = /^[A-Za-z0-9_-]{32,128}$/;

// Keep only the week-scoped guest credential. Per-run bearer tokens stay in memory.
export function createGuestCredentialStore(storage) {
  if (!storage || typeof storage.getItem !== 'function'
    || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    throw new TypeError('browser storage is required');
  }
  return {
    read(nowMs = Date.now()) {
      try {
        const raw = storage.getItem(KEY);
        if (raw === null) return null;
        const item = JSON.parse(raw);
        if (typeof item?.credential === 'string' && CREDENTIAL.test(item.credential)
          && Number.isFinite(Date.parse(item.expiresAt)) && nowMs < Date.parse(item.expiresAt)) {
          return item.credential;
        }
        storage.removeItem(KEY);
      } catch {
        try { storage.removeItem(KEY); } catch { /* Private browsing can deny storage access. */ }
      }
      return null;
    },
    save(credential, expiresAt) {
      if (typeof credential !== 'string' || !CREDENTIAL.test(credential)
        || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
        throw new TypeError('valid unexpired guest credential is required');
      }
      try {
        storage.setItem(KEY, JSON.stringify({ credential, expiresAt }));
        return true;
      } catch { return false; }
    },
    clear() {
      try { storage.removeItem(KEY); } catch { /* Private browsing can deny writes. */ }
    },
  };
}
