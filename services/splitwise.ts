interface SplitwiseConfig {
  apiKey: string;
  baseUrl: string;
}

export interface SplitwiseGroup {
  id: number;
  name: string;
  type: 'apartment' | 'house' | 'trip' | 'other';
  description?: string;
  simplify_by_default: boolean;
  members: SplitwiseMember[];
}

export interface SplitwiseMember {
  user_id: number;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  balance: Array<{
    currency_code: string;
    amount: string;
  }>;
}

export interface SplitwiseExpense {
  id: number;
  group_id: number;
  description: string;
  cost: string;
  currency_code: string;
  date: string;
  created_at: string;
  users: Array<{
    user_id: number;
    paid_share: string;
    owed_share: string;
    net_balance: string;
  }>;
}

class SplitwiseService {
  private config: SplitwiseConfig;

  constructor() {
    this.config = {
      apiKey: process.env.SPLITWISE_API_KEY || '',
      baseUrl: 'https://secure.splitwise.com/api/v3.0',
    };
  }

  async createGroup(groupData: {
    name: string;
    description?: string;
    members: Array<{ email: string; first_name: string; last_name?: string }>;
  }): Promise<SplitwiseGroup> {
    try {
      const response = await fetch(`${this.config.baseUrl}/create_group`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: groupData.name,
          description: groupData.description,
          type: 'other',
          simplify_by_default: true,
          users: groupData.members,
        }),
      });

      if (!response.ok) {
        throw new Error(`Splitwise API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.group;
    } catch (error) {
      console.error('Failed to create Splitwise group:', error);
      throw new Error('Failed to create Splitwise group');
    }
  }

  async addExpense(expenseData: {
    group_id: number;
    description: string;
    cost: number;
    currency_code?: string;
    paid_by_user: number;
    users: Array<{
      user_id: number;
      owed_share: number;
    }>;
  }): Promise<SplitwiseExpense> {
    try {
      const response = await fetch(`${this.config.baseUrl}/create_expense`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...expenseData,
          currency_code: expenseData.currency_code || 'USD',
          split_equally: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Splitwise API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.expense;
    } catch (error) {
      console.error('Failed to create Splitwise expense:', error);
      throw new Error('Failed to create Splitwise expense');
    }
  }

  async getGroupBalances(groupId: number): Promise<SplitwiseMember[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/get_group/${groupId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Splitwise API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.group.members;
    } catch (error) {
      console.error('Failed to get Splitwise group balances:', error);
      throw new Error('Failed to get group balances');
    }
  }

  async deleteGroup(groupId: number): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/delete_group/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Splitwise API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to delete Splitwise group:', error);
      throw new Error('Failed to delete Splitwise group');
    }
  }

  async removeMemberFromGroup(groupId: number, userId: number): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/remove_user_from_group`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          group_id: groupId,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Splitwise API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to remove member from Splitwise group:', error);
      throw new Error('Failed to remove member from group');
    }
  }
}

export const splitwiseService = new SplitwiseService();