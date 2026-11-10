/**
 * Native card actions need the device owner: a device with no screen lock is
 * refused rather than waved through.
 */
const mockLevel = jest.fn();
const mockAuth = jest.fn();
jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: () => mockLevel(),
  authenticateAsync: (...a: unknown[]) => mockAuth(...a),
}));

// eslint-disable-next-line import/first
import { confirmCardAction } from '@/components/cards/cardSecurity';

beforeEach(() => {
  mockLevel.mockReset();
  mockAuth.mockReset();
});

describe('confirmCardAction (native)', () => {
  it('refuses when the device has no screen lock, without prompting', async () => {
    mockLevel.mockResolvedValue(0);
    await expect(confirmCardAction('Freeze card')).resolves.toBe('no_device_lock');
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it('confirms after a successful biometric or passcode check', async () => {
    mockLevel.mockResolvedValue(3);
    mockAuth.mockResolvedValue({ success: true });
    await expect(confirmCardAction('Freeze card')).resolves.toBe('confirmed');
    expect(mockAuth).toHaveBeenCalledWith({ promptMessage: 'Freeze card', disableDeviceFallback: false });
  });

  it('declines when the user cancels', async () => {
    mockLevel.mockResolvedValue(1);
    mockAuth.mockResolvedValue({ success: false, error: 'user_cancel' });
    await expect(confirmCardAction('Unfreeze card')).resolves.toBe('declined');
  });
});
