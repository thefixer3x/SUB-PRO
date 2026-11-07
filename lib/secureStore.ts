/**
 * Key-value storage for small user settings.
 *
 * Native (iOS/Android): expo-secure-store (Keychain / Keystore).
 * Web: see secureStore.web.ts, which Metro picks for the web bundle.
 * expo-secure-store has no web implementation, so calling it on web
 * throws "getValueWithKeyAsync is not a function".
 */
export { getItemAsync, setItemAsync, deleteItemAsync } from 'expo-secure-store';
