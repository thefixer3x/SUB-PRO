import { FEATURE_FLAGS } from '@/config/featureFlags';
import { VIRTUAL_CARDS_FLAG } from '@/hooks/useFeatureFlags';

describe('Virtual Cards feature flag', () => {
  it('defaults to off so the screen never renders card data unasked', () => {
    expect(VIRTUAL_CARDS_FLAG).toBe('virtualCardsEnabled');
    expect(FEATURE_FLAGS.virtualCardsEnabled).toBe(false);
  });

  it('stays off in development too', () => {
    // __DEV__ is true under Jest; the gate must not be flipped on there either.
    expect(FEATURE_FLAGS.virtualCardsEnabled).toBe(false);
  });
});
