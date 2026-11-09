import type { SupabaseClient } from '@supabase/supabase-js';
import { updateEnvelope } from '../server/envelopes';
import type { EnvelopeInput } from '../types/planInbox';

describe('updateEnvelope partial fields', () => {
  function setup() {
    const query: Record<string, jest.Mock> = {};
    for (const method of ['update', 'eq', 'select', 'maybeSingle']) {
      query[method] = jest.fn(() => query);
    }
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    const admin = {
      from: jest.fn(() => query),
    } as unknown as SupabaseClient;
    return { admin, query };
  }

  const input: EnvelopeInput = {
    name: 'Renamed envelope',
    currency: 'USD',
    monthly_amount_minor: 2500,
    category_filter: null,
  };

  it('preserves currency and category when omitted from a PATCH body', async () => {
    const { admin, query } = setup();

    await updateEnvelope(
      admin,
      'user-1',
      'envelope-1',
      input,
      { name: input.name, monthly_amount_minor: input.monthly_amount_minor },
    );

    const patch = query.update.mock.calls[0][0] as Record<string, unknown>;
    expect(patch).toMatchObject({
      name: 'Renamed envelope',
      monthly_amount_minor: 2500,
    });
    expect(patch).not.toHaveProperty('currency');
    expect(patch).not.toHaveProperty('category_filter');
  });

  it('applies currency and explicit category clearing when supplied', async () => {
    const { admin, query } = setup();

    await updateEnvelope(
      admin,
      'user-1',
      'envelope-1',
      { ...input, currency: 'EUR', category_filter: null },
      { name: input.name, monthly_amount_minor: input.monthly_amount_minor, currency: 'EUR', category_filter: null },
    );

    expect(query.update.mock.calls[0][0]).toMatchObject({
      currency: 'EUR',
      category_filter: null,
    });
  });
});
