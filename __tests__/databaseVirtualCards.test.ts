jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const { createClient } = require('@supabase/supabase-js') as {
  createClient: jest.Mock;
};

describe('DatabaseService.storeVirtualCardReference', () => {
  it('inserts the Stripe card identifier using virtual_cards.card_id', async () => {
    const insert = jest.fn().mockResolvedValue({ data: null, error: null });
    const from = jest.fn().mockReturnValue({ insert });
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
});
