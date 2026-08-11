/**
 * src/storage.ts
 *
 * Thin, safe wrappers around window.localStorage. Every call is guarded
 * because localStorage can throw (private browsing quota, disabled
 * storage, non-browser test runners, etc.) - callers should never have to
 * think about that, they just get a fallback value back.
 *
 * Convention borrowed from the human-kernel sibling repo: getX/setX pairs,
 * pure with respect to their inputs/outputs (no DOM), easy to unit test.
 */

export function getString(key: string, fallback: string | null = null): string | null {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function setString(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function getJSON<T>(key: string, fallback: T): T {
  const raw = getString(key, null);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON<T>(key: string, value: T): boolean {
  try {
    return setString(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
