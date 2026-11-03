import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { FEATURE_FLAGS } from '@/config/featureFlags';
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
