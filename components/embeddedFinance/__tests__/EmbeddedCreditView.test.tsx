import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { FEATURE_FLAGS } from '@/config/featureFlags';
import { embeddedCreditService } from '@/services/embeddedCredit';
import { EmbeddedCreditView } from '@/components/embeddedFinance/EmbeddedCreditView';

const renderView = (expanded = true) =>
  render(
    <EmbeddedCreditView
      subscriptionId="sub-1"
      subscriptionName="Netflix"
      subscriptionCost={15.99}
      userId="user-1"
      expanded={expanded}
      onToggle={() => {}}
    />,
  );

describe('EmbeddedCreditView feature flag (issue #39)', () => {
  const originalFlag = FEATURE_FLAGS.CREDIT_SERVICE;

  afterEach(() => {
    FEATURE_FLAGS.CREDIT_SERVICE = originalFlag;
  });

  describe('with the flag off (the shipped default)', () => {
    beforeEach(() => {
      FEATURE_FLAGS.CREDIT_SERVICE = false;
    });

    it('shows a coming soon state', () => {
      const { getByText } = renderView();

      expect(getByText('Coming soon')).toBeTruthy();
      expect(getByText('Embedded Finance')).toBeTruthy();
    });

    it('does not offer a credit application', () => {
      const { queryByText } = renderView();

      expect(queryByText('Apply for Credit Service')).toBeNull();
    });

    it('does not display a simulated credit limit or balance', async () => {
      const { queryByText } = renderView();

      // The stub service returns a $5,000 limit, $3,250 available and a $1,750
      // balance. None of it may reach the screen while the flag is off.
      await waitFor(() => {
        expect(queryByText('$3,250 available')).toBeNull();
      });
      expect(queryByText('$1,750 of $5,000 used')).toBeNull();
      expect(queryByText('$3,250')).toBeNull();
      expect(queryByText('$5,000')).toBeNull();
    });

    it('does not render an approval, even if the service hands one back', async () => {
      // Defence in depth: the service refuses to serve simulated data while
      // the flag is off, but the view must not depend on that alone. If the
      // service returned an approved account anyway, the view still has to
      // refuse to render it. This test pins the view's own gate rather than
      // the service's.
      const getCreditAccount = jest
        .spyOn(embeddedCreditService, 'getCreditAccount')
        .mockResolvedValue({
          id: 'credit_user-1',
          userId: 'user-1',
          status: 'active',
          creditLimit: 5000,
          availableCredit: 3250,
          currentBalance: 1750,
          nextSettlementDate: '2024-03-15',
          monthlySettlementDay: 15,
          autoPayEnabled: true,
          paymentMethodId: 'pm_example123',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
        });

      const { queryByText, getByText } = renderView();

      await waitFor(() => {
        expect(getByText('Coming soon')).toBeTruthy();
      });

      // An approved account with a $5,000 limit is exactly what must not
      // reach the screen.
      expect(queryByText('$3,250 available')).toBeNull();
      expect(queryByText('$1,750 of $5,000 used')).toBeNull();
      expect(queryByText('$5,000')).toBeNull();
      expect(queryByText('Credit Payment Active')).toBeNull();

      getCreditAccount.mockRestore();
    });

    it('never asks the service for credit data while the flag is off', () => {
      const getCreditAccount = jest.spyOn(embeddedCreditService, 'getCreditAccount');

      renderView();

      // The view must not even request simulated data. Requesting it and
      // discarding the answer would still be a code path that touches a
      // simulated approval.
      expect(getCreditAccount).not.toHaveBeenCalled();

      getCreditAccount.mockRestore();
    });

    it('does not enable a subscription for credit payment', () => {
      const { queryByText } = renderView();

      expect(queryByText('Enable Credit Payment')).toBeNull();
      expect(queryByText('Credit Payment Active')).toBeNull();
    });
  });

  describe('with the flag on', () => {
    beforeEach(() => {
      FEATURE_FLAGS.CREDIT_SERVICE = true;
    });

    it('renders the credit service UI again', async () => {
      const { getByText } = renderView();

      await waitFor(() => {
        expect(getByText('$3,250 available')).toBeTruthy();
      });
    });
  });
});
