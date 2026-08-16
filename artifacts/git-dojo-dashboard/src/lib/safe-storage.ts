// Module-level fallback for when localStorage is unavailable (private browsing,
// storage quotas, or security exceptions). Values written here survive component
// unmount/remount within the same page session.
const _memStore = new Map<string, string>();

/**
 * Drop-in wrapper around localStorage that:
 * 1. Catches exceptions (quota errors, security errors in private browsing).
 * 2. Mirrors every write to an in-memory map so values survive a mid-session
 *    `localStorage.clear()` or other unexpected storage wipe.
 *
 * The mirror is the source of truth for the current page session. It is
 * seeded from localStorage on the first successful `getItem` for each key
 * and is only deleted by explicit `removeItem` calls — never by a null read
 * from localStorage (which is what a storage clear produces).
 */
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        // Sync mirror with whatever is persisted.
        _memStore.set(key, value);
        return value;
      }
      // localStorage returned null — the key was never set, or storage was
      // cleared mid-session. Prefer the in-memory value so a clear doesn't
      // wipe hint progress. The mirror is only deleted by explicit removeItem.
      return _memStore.get(key) ?? null;
    } catch {
      return _memStore.get(key) ?? null;
    }
  },
  setItem(key: string, value: string): void {
    // Always update in-memory mirror first so it is accurate even if
    // localStorage throws.
    _memStore.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      // Persisted to _memStore above; value survives remounts in this session.
    }
  },
  removeItem(key: string): void {
    _memStore.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      // Already removed from _memStore above.
    }
  },
  /** Exposed for testing only — clears the in-memory fallback store. */
  _resetMemStore(): void {
    _memStore.clear();
  },
};
