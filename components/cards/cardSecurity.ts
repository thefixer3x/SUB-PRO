import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Native: confirm it is the device owner before a card action (freeze,
 * unfreeze). Uses Face ID / fingerprint, falling back to the device passcode.
 *
 * A device with no lock screen at all cannot be challenged; the signed-in
 * session is then the only check, the same as before this gate existed.
 */
export async function confirmCardAction(reason: string): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!hasHardware || !enrolled) {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return true;
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    disableDeviceFallback: false,
  });
  return result.success;
}
