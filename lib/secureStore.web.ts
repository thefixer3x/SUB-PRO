/**
 * Web build of lib/secureStore: browser localStorage.
 *
 * Only for non-sensitive preferences (budget limit, toggles). localStorage is
 * readable by any script on the origin, so never store tokens or secrets here.
 * Storage can be unavailable (private mode, blocked site data): reads then
 * return null and writes are dropped, so the screen still renders.
 */

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Storage full or blocked: keep the in-memory value only.
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    storage()?.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}
