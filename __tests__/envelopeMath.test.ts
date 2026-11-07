import {
  getEnvelopeSpendScanStart,
  matchAuthorizationToEnvelope,
  parseEnvelopeAmount,
  summarizeEnvelopes,
} from '../services/envelopeMath';
import type { EnvelopeRow, EnvelopeSpendRow } from '../services/insightEngine';

const NOW = new Date('2026-11-07T12:00:00.000Z');

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

describe('matchAuthorizationToEnvelope', () => {
  it('matches on the merchant category', () => {
    const match = matchAuthorizationToEnvelope(
      { merchant_name: 'Unknown Merchant', merchant_category: 'streaming', currency: 'USD' },
      [envelope({ id: 'e1' })],
    );
    expect(match?.id).toBe('e1');
  });

  it('falls back to the envelope name inside the merchant name', () => {
    const match = matchAuthorizationToEnvelope(
      { merchant_name: 'Netflix.com', merchant_category: 'general', currency: 'USD' },
      [envelope({ id: 'e1', name: 'Netflix', category_filter: null })],
    );
    expect(match?.id).toBe('e1');
  });

  it('matches when the merchant name is contained in the envelope name', () => {
    const match = matchAuthorizationToEnvelope(
      { merchant_name: 'Adobe', merchant_category: null, currency: 'USD' },
      [envelope({ id: 'e1', name: 'Adobe Creative Cloud', category_filter: null })],
    );
    expect(match?.id).toBe('e1');
  });

  it('never matches across currencies', () => {
    const match = matchAuthorizationToEnvelope(
      { merchant_name: 'Netflix', merchant_category: 'streaming', currency: 'EUR' },
      [envelope({ id: 'e1', currency: 'USD' })],
    );
    expect(match).toBeNull();
  });

  it('returns null when nothing matches', () => {
    const match = matchAuthorizationToEnvelope(
      { merchant_name: 'Corner Shop', merchant_category: 'groceries', currency: 'USD' },
      [envelope({ id: 'e1' })],
    );
    expect(match).toBeNull();
  });

  it('does not match short envelope names as arbitrary merchant substrings', () => {
    for (const [name, merchant] of [['Go', 'Google'], ['TV', 'TVA Fuel'], ['Car', 'Carrefour']]) {
      const match = matchAuthorizationToEnvelope(
        { merchant_name: merchant, merchant_category: null, currency: 'USD' },
        [envelope({ id: 'e1', name, category_filter: null })],
      );
      expect(match).toBeNull();
    }
  });

  it('still matches short names as complete merchant words', () => {
    const match = matchAuthorizationToEnvelope(
      { merchant_name: 'Car Rental', merchant_category: null, currency: 'USD' },
      [envelope({ id: 'e1', name: 'Car', category_filter: null })],
    );
    expect(match?.id).toBe('e1');
  });

  it('does not assign a charge arbitrarily when the category is ambiguous', () => {
    const match = matchAuthorizationToEnvelope(
      { merchant_name: 'Corner Shop', merchant_category: 'streaming', currency: 'USD' },
      [
        envelope({ id: 'e1', name: 'Entertainment', category_filter: 'streaming' }),
        envelope({ id: 'e2', name: 'Media', category_filter: 'streaming' }),
      ],
    );
    expect(match).toBeNull();
  });
});

describe('getEnvelopeSpendScanStart', () => {
  it('starts at the previous month boundary and handles year rollover', () => {
    expect(getEnvelopeSpendScanStart(new Date('2026-11-01T03:00:00.000Z')).toISOString())
      .toBe('2026-10-01T00:00:00.000Z');
    expect(getEnvelopeSpendScanStart(new Date('2027-01-01T03:00:00.000Z')).toISOString())
      .toBe('2026-12-01T00:00:00.000Z');
  });
});

describe('parseEnvelopeAmount', () => {
  it('accepts locale decimal commas and rejects malformed amounts', () => {
    expect(parseEnvelopeAmount(' 30,50 ')).toBe(30.5);
    expect(parseEnvelopeAmount('30.50')).toBe(30.5);
    expect(Number.isNaN(parseEnvelopeAmount('30,5,0'))).toBe(true);
    expect(Number.isNaN(parseEnvelopeAmount('1,000'))).toBe(true);
    expect(parseEnvelopeAmount('12,345', 'KWD')).toBe(12.345);
    expect(Number.isNaN(parseEnvelopeAmount('12,3', 'JPY'))).toBe(true);
  });
});

describe('summarizeEnvelopes', () => {
  it('totals this month and projects to month end', () => {
    const spend: EnvelopeSpendRow[] = [
      { envelope_id: 'e1', amount_minor: 1200, currency: 'USD', month: '2026-11' },
      { envelope_id: 'e1', amount_minor: 300, currency: 'USD', month: '2026-11' },
      { envelope_id: 'e1', amount_minor: 9999, currency: 'USD', month: '2026-10' },
    ];

    const [summary] = summarizeEnvelopes([envelope({ id: 'e1' })], spend, NOW);

    expect(summary.spent_minor).toBe(1500);
    expect(summary.remaining_minor).toBe(1500);
    expect(summary.projected_minor).toBe(6429);
    expect(summary.month).toBe('2026-11');
    expect(summary.days_left).toBe(23);
  });

  it('reports zero spend as zero, not NaN', () => {
    const [summary] = summarizeEnvelopes([envelope({ id: 'e1' })], [], NOW);
    expect(summary.spent_minor).toBe(0);
    expect(summary.remaining_minor).toBe(3000);
    expect(summary.projected_minor).toBe(0);
  });

  it('does not add spend recorded in a different currency', () => {
    const spend: EnvelopeSpendRow[] = [
      { envelope_id: 'e1', amount_minor: 99999, currency: 'USD', month: '2026-11' },
    ];
    const [summary] = summarizeEnvelopes(
      [envelope({ id: 'e1', currency: 'EUR' })],
      spend,
      NOW,
    );
    expect(summary.spent_minor).toBe(0);
    expect(summary.remaining_minor).toBe(3000);
  });
});
