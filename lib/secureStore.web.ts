/**
 * Web build of lib/secureStore: browser localStorage.
 *
 * Only for non-sensitive preferences (budget limit, toggles). localStorage is
 * readable by any script on the origin, so never store tokens or secrets here.
 *
 * Reads are soft: when storage is unavailable (private mode, blocked site
 * data) they return null so the screen still renders. Writes and deletes
 * reject, as expo-secure-store does on native, so callers can tell the user
 * a setting was not saved instead of showing it as saved.
 */

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function requireStorage(): Storage {
  const s = storage();
  if (!s) throw new Error('Browser storage is unavailable');
  return s;
}

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  requireStorage().setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  requireStorage().removeItem(key);
}
