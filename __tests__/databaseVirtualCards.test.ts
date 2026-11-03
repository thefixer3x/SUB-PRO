jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const { createClient } = require('@supabase/supabase-js') as {
  createClient: jest.Mock;
};

describe('DatabaseService.storeVirtualCardReference', () => {
  it('inserts the Stripe card identifier using virtual_cards.card_id', async () => {
    const insert = jest.fn().mockResolvedValue({ data: null, error: null });
    const limit = jest.fn().mockResolvedValue({ data: [], error: null });
    const eq = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ insert, select });
    createClient.mockReturnValue({ from });

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    let databaseService: typeof import('../services/database').databaseService;
    jest.isolateModules(() => {
      ({ databaseService } = require('../services/database'));
    });

    await databaseService!.storeVirtualCardReference('user-123', {
      card_id: 'ic_card_123',
      last4: '4242',
      brand: 'visa',
      status: 'active',
    });

    expect(from).toHaveBeenCalledWith('virtual_cards');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-123',
      card_id: 'ic_card_123',
    }));
    expect(insert.mock.calls[0][0]).not.toHaveProperty('stripe_card_id');
  });

  it('skips the insert when the card reference already exists (idempotent webhook)', async () => {
    const insert = jest.fn();
    const limit = jest.fn().mockResolvedValue({ data: [{ card_id: 'ic_card_123' }], error: null });
    const eq = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ eq });
    createClient.mockReturnValue({ from: jest.fn().mockReturnValue({ insert, select }) });

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    let databaseService: typeof import('../services/database').databaseService;
    jest.isolateModules(() => {
      ({ databaseService } = require('../services/database'));
    });

    const ok = await databaseService!.storeVirtualCardReference('user-123', {
      card_id: 'ic_card_123',
      last4: '4242',
      brand: 'visa',
      status: 'active',
    });

    expect(ok).toBe(true);
    expect(insert).not.toHaveBeenCalled();
  });
});
