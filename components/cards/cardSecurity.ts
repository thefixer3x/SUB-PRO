import * as LocalAuthentication from 'expo-local-authentication';

export type CardActionCheck = 'confirmed' | 'declined' | 'no_device_lock';

/**
 * Native: confirm it is the device owner before a card action (freeze,
 * unfreeze). Uses Face ID / fingerprint, falling back to the device passcode.
 *
 * A device with no screen lock at all cannot be challenged, so the action is
 * refused until the user sets one up.
 */
export async function confirmCardAction(reason: string): Promise<CardActionCheck> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) return 'no_device_lock';
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    disableDeviceFallback: false,
  });
  return result.success ? 'confirmed' : 'declined';
}
