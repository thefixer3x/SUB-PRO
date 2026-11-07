/**
 * lib/secureStore.web.ts: expo-secure-store has no web implementation, so the
 * web bundle uses localStorage. It must also survive storage being blocked.
 */
import * as store from '../lib/secureStore.web';

function fakeLocalStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    removeItem: (k: string) => void data.delete(k),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
  };
}

describe('lib/secureStore.web', () => {
  const g = globalThis as unknown as { window?: unknown };
  const original = g.window;

  afterEach(() => {
    g.window = original;
  });

  it('stores, reads and deletes through localStorage', async () => {
    g.window = { localStorage: fakeLocalStorage() };
    expect(await store.getItemAsync('budgetLimit')).toBeNull();
    await store.setItemAsync('budgetLimit', '150.5');
    expect(await store.getItemAsync('budgetLimit')).toBe('150.5');
    await store.deleteItemAsync('budgetLimit');
    expect(await store.getItemAsync('budgetLimit')).toBeNull();
  });

  it('degrades to no-ops when storage is blocked', async () => {
    g.window = {
      get localStorage(): Storage {
        throw new Error('SecurityError: access denied');
      },
    };
    await expect(store.setItemAsync('k', 'v')).resolves.toBeUndefined();
    await expect(store.getItemAsync('k')).resolves.toBeNull();
    await expect(store.deleteItemAsync('k')).resolves.toBeUndefined();
  });

  it('returns null when there is no window (server render)', async () => {
    g.window = undefined;
    await expect(store.getItemAsync('k')).resolves.toBeNull();
  });
});
