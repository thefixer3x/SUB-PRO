import {
  detectAll,
  detectDuplicateSubscriptions,
  detectEnvelopesAtRisk,
  detectNewRecurringMerchants,
  detectPriceIncreases,
  detectUnusedBeforeRenewal,
  formatMinor,
  fromMinorUnits,
  toMinorUnits,
  type CardAuthorizationRow,
  type EnvelopeRow,
  type EnvelopeSpendRow,
  type SubscriptionRow,
} from '../services/insightEngine';

const NOW = new Date('2026-11-07T12:00:00.000Z');
const USER = '11111111-1111-4111-8111-111111111111';

function auth(overrides: Partial<CardAuthorizationRow> & { id: string }): CardAuthorizationRow {
  const { id, ...rest } = overrides;
  return {
    id,
    merchant_name: 'Netflix',
    merchant_category: 'streaming',
    amount: 1599,
    currency: 'USD',
    transaction_date: '2026-10-01T00:00:00.000Z',
    approved: true,
    ...rest,
  };
}

function sub(overrides: Partial<SubscriptionRow> & { id: string }): SubscriptionRow {
  const { id, ...rest } = overrides;
  return {
    id,
    name: 'Netflix',
    category: 'Entertainment',
    monthly_cost: 15.99,
    currency: 'USD',
    renewal_date: '2026-11-10T00:00:00.000Z',
    last_used: '2026-10-01T00:00:00.000Z',
    status: 'Active',
    ...rest,
  };
}

function envelope(overrides: Partial<EnvelopeRow> & { id: string }): EnvelopeRow {
  const { id, ...rest } = overrides;
  return {
    id,
    name: 'Streaming',
    currency: 'USD',
    monthly_amount_minor: 3000,
    category_filter: 'streaming',
    ...rest,
  };
}

describe('price increases', () => {
  it('detects an increase above the threshold', () => {
    const events = detectPriceIncreases([
      auth({ id: 'a1', amount: 1599, transaction_date: '2026-10-01T00:00:00.000Z' }),
      auth({ id: 'a2', amount: 1899, transaction_date: '2026-11-01T00:00:00.000Z' }),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('price_increase');
    expect(events[0].sourceEventIds).toEqual(['a1', 'a2']);
    expect(events[0].explanation).toContain('$15.99');
    expect(events[0].explanation).toContain('$18.99');
    expect(events[0].explanation).toContain('19%');
    expect(events[0].dedupeKey).toBe('price_increase:netflix:USD:2026-11');
  });

  it('does not fire below the threshold', () => {
    const events = detectPriceIncreases([
      auth({ id: 'a1', amount: 1599, transaction_date: '2026-10-01T00:00:00.000Z' }),
      auth({ id: 'a2', amount: 1679, transaction_date: '2026-11-01T00:00:00.000Z' }),
    ]);
    expect(events).toHaveLength(0);
  });

  it('ignores declined authorizations', () => {
    const events = detectPriceIncreases([
      auth({ id: 'a1', amount: 1599, approved: true }),
      auth({ id: 'a2', amount: 2599, approved: false }),
    ]);
    expect(events).toHaveLength(0);
  });

  it('never compares across currencies', () => {
    const events = detectPriceIncreases([
      auth({ id: 'a1', amount: 1599, currency: 'USD' }),
      auth({ id: 'a2', amount: 2000, currency: 'EUR' }),
    ]);
    expect(events).toHaveLength(0);
  });
});

describe('new recurring merchants', () => {
  it('detects two charges one month apart', () => {
    const events = detectNewRecurringMerchants([
      auth({ id: 'a1', merchant_name: 'Canva', transaction_date: '2026-09-20T00:00:00.000Z' }),
      auth({ id: 'a2', merchant_name: 'Canva', transaction_date: '2026-10-21T00:00:00.000Z' }),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('new_recurring_merchant');
    expect(events[0].explanation).toContain('31 days');
    expect(events[0].explanation).toContain('monthly');
    expect(events[0].payload.cadence).toBe('monthly');
  });

  it('does not treat two charges 10 days apart as recurring', () => {
    const events = detectNewRecurringMerchants([
      auth({ id: 'a1', merchant_name: 'Canva', transaction_date: '2026-10-01T00:00:00.000Z' }),
      auth({ id: 'a2', merchant_name: 'Canva', transaction_date: '2026-10-11T00:00:00.000Z' }),
    ]);
    expect(events).toHaveLength(0);
  });

  it('does not flag a merchant that is already a tracked subscription', () => {
    const events = detectNewRecurringMerchants(
      [
        auth({ id: 'a1', merchant_name: 'Netflix', transaction_date: '2026-09-20T00:00:00.000Z' }),
        auth({ id: 'a2', merchant_name: 'Netflix', transaction_date: '2026-10-21T00:00:00.000Z' }),
      ],
      { knownSubscriptionNames: ['Netflix'] },
    );
    expect(events).toHaveLength(0);
  });

  it('matches a merchant variant to an existing subscription name', () => {
    const events = detectNewRecurringMerchants(
      [
        auth({ id: 'a1', merchant_name: 'Netflix.com', transaction_date: '2026-09-20T00:00:00.000Z' }),
        auth({ id: 'a2', merchant_name: 'Netflix.com', transaction_date: '2026-10-21T00:00:00.000Z' }),
      ],
      { knownSubscriptionNames: ['Netflix Premium'] },
    );
    expect(events).toHaveLength(0);
  });
});

describe('unused before renewal', () => {
  it('flags a subscription that renews soon and has not been used', () => {
    const events = detectUnusedBeforeRenewal(
      [sub({ id: 's1', renewal_date: '2026-11-10T00:00:00.000Z', last_used: '2026-09-20T00:00:00.000Z' })],
      { now: NOW },
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('unused_before_renewal');
    expect(events[0].explanation).toContain('renews in 3 days');
    expect(events[0].explanation).toContain('48 days');
  });

  it('flags a subscription with no usage signal at all', () => {
    const events = detectUnusedBeforeRenewal(
      [sub({ id: 's1', renewal_date: '2026-11-10T00:00:00.000Z', last_used: null })],
      { now: NOW },
    );
    expect(events).toHaveLength(1);
    expect(events[0].explanation).toContain('no recorded usage');
  });

  it('does not flag a recently used subscription', () => {
    const events = detectUnusedBeforeRenewal(
      [sub({ id: 's1', renewal_date: '2026-11-10T00:00:00.000Z', last_used: '2026-11-05T00:00:00.000Z' })],
      { now: NOW },
    );
    expect(events).toHaveLength(0);
  });

  it('does not flag a renewal outside the window', () => {
    const events = detectUnusedBeforeRenewal(
      [sub({ id: 's1', renewal_date: '2026-12-20T00:00:00.000Z', last_used: null })],
      { now: NOW },
    );
    expect(events).toHaveLength(0);
  });

  it('does not flag inactive subscriptions', () => {
    const events = detectUnusedBeforeRenewal(
      [sub({ id: 's1', status: 'Paused', renewal_date: '2026-11-10T00:00:00.000Z', last_used: null })],
      { now: NOW },
    );
    expect(events).toHaveLength(0);
  });
});

describe('duplicate subscriptions', () => {
  it('flags same-category subscriptions with the same name stem', () => {
    const events = detectDuplicateSubscriptions([
      sub({ id: 's1', name: 'Netflix', monthly_cost: 15.99 }),
      sub({ id: 's2', name: 'Netflix Premium', monthly_cost: 22.99 }),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('duplicate_subscription');
    expect(events[0].sourceEventIds).toEqual(['s1', 's2']);
    expect(events[0].explanation).toContain('paying twice');
  });

  it('does not flag different services in the same category', () => {
    const events = detectDuplicateSubscriptions([
      sub({ id: 's1', name: 'Netflix' }),
      sub({ id: 's2', name: 'Spotify' }),
    ]);
    expect(events).toHaveLength(0);
  });

  it('does not flag the same service across different currencies', () => {
    const events = detectDuplicateSubscriptions([
      sub({ id: 's1', name: 'Netflix', currency: 'USD' }),
      sub({ id: 's2', name: 'Netflix', currency: 'EUR' }),
    ]);
    expect(events).toHaveLength(0);
  });
});

describe('envelopes at risk', () => {
  it('flags a projected overspend', () => {
    // 7 Nov: 7/30 of the month elapsed. $12 spent projects to ~$51.43 > $30.
    const spend: EnvelopeSpendRow[] = [
      { envelope_id: 'e1', amount_minor: 1200, currency: 'USD', month: '2026-11' },
    ];
    const events = detectEnvelopesAtRisk([envelope({ id: 'e1' })], spend, { now: NOW });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('envelope_at_risk');
    expect(events[0].payload.projected_minor).toBe(5143);
    expect(events[0].explanation).toContain('$12.00');
    expect(events[0].explanation).toContain('$30.00');
  });

  it('does not flag an envelope that is on pace', () => {
    const spend: EnvelopeSpendRow[] = [
      { envelope_id: 'e1', amount_minor: 300, currency: 'USD', month: '2026-11' },
    ];
    const events = detectEnvelopesAtRisk([envelope({ id: 'e1' })], spend, { now: NOW });
    expect(events).toHaveLength(0);
  });

  it('ignores spend from other months', () => {
    const spend: EnvelopeSpendRow[] = [
      { envelope_id: 'e1', amount_minor: 5000, currency: 'USD', month: '2026-10' },
    ];
    const events = detectEnvelopesAtRisk([envelope({ id: 'e1' })], spend, { now: NOW });
    expect(events).toHaveLength(0);
  });
});

describe('detectAll', () => {
  it('returns one event per finding with unique dedupe keys', () => {
    const events = detectAll(
      {
        authorizations: [
          auth({ id: 'a1', merchant_name: 'Netflix', amount: 1599, transaction_date: '2026-10-01T00:00:00.000Z' }),
          auth({ id: 'a2', merchant_name: 'Netflix', amount: 1899, transaction_date: '2026-11-01T00:00:00.000Z' }),
          auth({ id: 'a3', merchant_name: 'Canva', transaction_date: '2026-09-20T00:00:00.000Z' }),
          auth({ id: 'a4', merchant_name: 'Canva', transaction_date: '2026-10-21T00:00:00.000Z' }),
        ],
        subscriptions: [
          sub({ id: 's1', name: 'Netflix', renewal_date: '2026-11-10T00:00:00.000Z', last_used: null }),
          sub({ id: 's2', name: 'Netflix Premium', category: 'Entertainment', renewal_date: '2026-12-20T00:00:00.000Z' }),
        ],
        envelopes: [envelope({ id: 'e1' })],
        envelopeSpend: [
          { envelope_id: 'e1', amount_minor: 1200, currency: 'USD', month: '2026-11' },
        ],
      },
      { now: NOW },
    );

    const types = events.map((event) => event.type).sort();
    expect(types).toEqual([
      'duplicate_subscription',
      'envelope_at_risk',
      'new_recurring_merchant',
      'price_increase',
      'unused_before_renewal',
    ]);
    expect(new Set(events.map((event) => event.dedupeKey)).size).toBe(events.length);
  });
});

describe('formatMinor', () => {
  it('formats and falls back for unknown currencies', () => {
    expect(formatMinor(1599, 'USD')).toBe('$15.99');
    expect(formatMinor(1000, 'ZZZ')).toMatch(/ZZZ|¤/);
  });

  it('uses the ISO minor-unit scale for zero- and three-decimal currencies', () => {
    expect(toMinorUnits(1500, 'JPY')).toBe(1500);
    expect(formatMinor(1500, 'JPY')).toContain('1,500');
    expect(toMinorUnits(12.345, 'KWD')).toBe(12345);
    expect(fromMinorUnits(12345, 'KWD')).toBe(12.345);
  });
});
