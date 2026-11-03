import { FEATURE_FLAGS } from '@/config/featureFlags';
import {
  embeddedCreditService,
  isEmbeddedCreditEnabled,
  EmbeddedCreditDisabledError,
} from '@/services/embeddedCredit';

describe('embedded credit feature flag (issue #39)', () => {
  const originalFlag = FEATURE_FLAGS.CREDIT_SERVICE;

  afterEach(() => {
    FEATURE_FLAGS.CREDIT_SERVICE = originalFlag;
  });

  describe('the shipped default', () => {
    it('ships with CREDIT_SERVICE disabled', () => {
      // Read the flag from a fresh copy of the config module so this asserts
      // what actually ships, not a value this test file mutated. The module
      // applies its __DEV__ overrides on load, so this also proves that
      // developers running a dev build do not get fake approvals.
      jest.resetModules();
      const freshFlags = require('@/config/featureFlags').FEATURE_FLAGS;

      expect(freshFlags.CREDIT_SERVICE).toBe(false);
    });
  });

  describe('with the flag off (the shipped default)', () => {
    beforeEach(() => {
      FEATURE_FLAGS.CREDIT_SERVICE = false;
    });

    it('reports the feature as disabled', () => {
      expect(isEmbeddedCreditEnabled()).toBe(false);
    });

    it('does not hand out a simulated credit account', async () => {
      await expect(embeddedCreditService.getCreditAccount('user-1')).rejects.toThrow(
        EmbeddedCreditDisabledError,
      );
    });

    it('does not approve an application', async () => {
      await expect(embeddedCreditService.createCreditAccount('user-1')).rejects.toThrow(
        EmbeddedCreditDisabledError,
      );
    });

    it('does not report a user as eligible or suggest a credit limit', async () => {
      await expect(embeddedCreditService.checkEligibility('user-1')).rejects.toThrow(
        EmbeddedCreditDisabledError,
      );
    });

    it('does not hand out a settlement, a balance or transaction history', async () => {
      await expect(embeddedCreditService.getMonthlySettlement('credit_user-1')).rejects.toThrow(
        EmbeddedCreditDisabledError,
      );
      await expect(embeddedCreditService.getTransactionHistory('credit_user-1')).rejects.toThrow(
        EmbeddedCreditDisabledError,
      );
    });

    it('does not enable subscription credit or take payments', async () => {
      await expect(
        embeddedCreditService.enableSubscriptionCredit('credit_user-1', 'sub-1', 9.99, 'Netflix'),
      ).rejects.toThrow(EmbeddedCreditDisabledError);

      await expect(
        embeddedCreditService.processSubscriptionPayment('credit_user-1', 'sub-1', 9.99, 'Netflix'),
      ).rejects.toThrow(EmbeddedCreditDisabledError);
    });

    it('does not change account settings or expose configuration', async () => {
      await expect(embeddedCreditService.toggleAutoPay('credit_user-1', true)).rejects.toThrow(
        EmbeddedCreditDisabledError,
      );
      await expect(embeddedCreditService.updatePaymentMethod('credit_user-1', 'pm_1')).rejects.toThrow(
        EmbeddedCreditDisabledError,
      );
      // getConfig() is synchronous, so it throws instead of rejecting.
      expect(() => embeddedCreditService.getConfig()).toThrow(EmbeddedCreditDisabledError);
    });
  });

  describe('with the flag on', () => {
    beforeEach(() => {
      FEATURE_FLAGS.CREDIT_SERVICE = true;
    });

    it('reports the feature as enabled', () => {
      expect(isEmbeddedCreditEnabled()).toBe(true);
    });

    it('still serves the stubbed data, so the flag is what gates it', async () => {
      // The flag - not a broken service - is what keeps the simulated data out
      // of the app. Once a real provider replaces these stubs the same gate
      // still applies.
      const account = await embeddedCreditService.getCreditAccount('user-1');
      expect(account?.userId).toBe('user-1');

      const eligibility = await embeddedCreditService.checkEligibility('user-1');
      expect(eligibility.eligible).toBe(true);
    });
  });
});
