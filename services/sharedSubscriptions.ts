import { SharedGroup, GroupMember, GroupInvitation, SplitCalculation } from '@/types/social';

class SharedSubscriptionsService {
  async createSharedGroup(data: {
    subscriptionId: string;
    name: string;
    description?: string;
    totalCost: number;
    members: Array<{ email: string; name: string; sharePercentage: number }>;
    splitMethod: 'equal' | 'percentage' | 'custom';
  }): Promise<SharedGroup> {
    try {
      // Create group in our database
      const response = await fetch('/api/social/shared-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create shared group');
      }

      const group = await response.json();

      // Create corresponding Splitwise group via server-side proxy
      try {
        const splitwiseMembers = data.members.map(member => ({
          email: member.email,
          first_name: member.name.split(' ')[0],
          last_name: member.name.split(' ').slice(1).join(' ') || '',
        }));

        const swResponse = await fetch('/api/splitwise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_group',
            groupData: {
              name: data.name,
              description: data.description,
              members: splitwiseMembers,
            },
          }),
        });

        if (swResponse.ok) {
          const swResult = await swResponse.json();
          const splitwiseGroup = swResult.group;

          // Update our group with Splitwise ID
          await this.updateGroupSplitwise(group.id, splitwiseGroup.id);
          group.splitwiseGroupId = splitwiseGroup.id;
        }
        // If Splitwise fails, continue without it (graceful degradation)
      } catch (error) {
        console.error('Failed to create Splitwise group:', error);
      }

      return group;
    } catch (error) {
      console.error('Failed to create shared group:', error);
      throw error;
    }
  }

  async getSharedGroup(groupId: string): Promise<SharedGroup | null> {
    try {
      const response = await fetch(`/api/social/shared-groups/${groupId}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Failed to get shared group:', error);
      return null;
    }
  }

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    try {
      const response = await fetch(`/api/social/shared-groups/${groupId}/members`);
      if (!response.ok) {
        throw new Error('Failed to fetch group members');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get group members:', error);
      return [];
    }
  }

  async inviteMember(data: {
    groupId: string;
    email: string;
    name: string;
    sharePercentage: number;
  }): Promise<GroupInvitation> {
    try {
      const response = await fetch('/api/social/group-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to send invitation');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to invite member:', error);
      throw error;
    }
  }

  async respondToInvitation(token: string, response: 'accept' | 'decline'): Promise<void> {
    try {
      const apiResponse = await fetch(`/api/social/group-invitations/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });

      if (!apiResponse.ok) {
        throw new Error('Failed to respond to invitation');
      }
    } catch (error) {
      console.error('Failed to respond to invitation:', error);
      throw error;
    }
  }

  async removeMember(groupId: string, memberId: string): Promise<void> {
    try {
      const response = await fetch(`/api/social/shared-groups/${groupId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove member');
      }

      // Also remove from Splitwise if integrated via server-side proxy
      const group = await this.getSharedGroup(groupId);
      if (group?.splitwiseGroupId) {
        try {
          const member = await this.getGroupMember(memberId);
          if (member?.userId) {
            const swResponse = await fetch('/api/splitwise', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'remove_member',
                groupId: parseInt(group.splitwiseGroupId),
                userId: parseInt(member.userId),
              }),
            });
            // Ignore failures — graceful degradation
            if (!swResponse.ok) {
              console.error('Failed to remove member from Splitwise:', swResponse.status);
            }
          }
        } catch (error) {
          console.error('Failed to remove member from Splitwise:', error);
        }
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
      throw error;
    }
  }

  async calculateSplits(groupId: string): Promise<SplitCalculation[]> {
    try {
      const response = await fetch(`/api/social/shared-groups/${groupId}/calculate-splits`);
      if (!response.ok) {
        throw new Error('Failed to calculate splits');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to calculate splits:', error);
      return [];
    }
  }

  async addExpense(data: {
    groupId: string;
    amount: number;
    description: string;
    paidBy: string;
    dueDate: Date;
  }): Promise<void> {
    try {
      const response = await fetch('/api/social/split-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to add expense');
      }

      // Also add to Splitwise if integrated via server-side proxy
      const group = await this.getSharedGroup(data.groupId);
      if (group?.splitwiseGroupId) {
        try {
          const members = await this.getGroupMembers(data.groupId);
          const paidByMember = members.find(m => m.id === data.paidBy);
          
          if (paidByMember?.userId) {
            const splitUsers = members
              .filter(m => m.status === 'accepted' && m.userId)
              .map(m => ({
                user_id: parseInt(m.userId!),
                owed_share: (data.amount * m.sharePercentage) / 100,
              }));

            const swResponse = await fetch('/api/splitwise', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add_expense',
                expenseData: {
                  group_id: parseInt(group.splitwiseGroupId),
                  description: data.description,
                  cost: data.amount,
                  paid_by_user: parseInt(paidByMember.userId),
                  users: splitUsers,
                },
              }),
            });
            // Ignore failures — graceful degradation
            if (!swResponse.ok) {
              console.error('Failed to add expense to Splitwise:', swResponse.status);
            }
          }
        } catch (error) {
          console.error('Failed to add expense to Splitwise:', error);
        }
      }
    } catch (error) {
      console.error('Failed to add expense:', error);
      throw error;
    }
  }

  async getUserSharedGroups(userId: string): Promise<SharedGroup[]> {
    try {
      const response = await fetch(`/api/social/users/${userId}/shared-groups`);
      if (!response.ok) {
        throw new Error('Failed to fetch user shared groups');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get user shared groups:', error);
      return [];
    }
  }

  async deleteSharedGroup(groupId: string): Promise<void> {
    try {
      const group = await this.getSharedGroup(groupId);
      
      // Delete from Splitwise first if integrated via server-side proxy
      if (group?.splitwiseGroupId) {
        try {
          const swResponse = await fetch('/api/splitwise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete_group',
              groupId: parseInt(group.splitwiseGroupId),
            }),
          });
          // Ignore failures — graceful degradation
          if (!swResponse.ok) {
            console.error('Failed to delete Splitwise group:', swResponse.status);
          }
        } catch (error) {
          console.error('Failed to delete Splitwise group:', error);
        }
      }

      // Delete from our database
      const response = await fetch(`/api/social/shared-groups/${groupId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete shared group');
      }
    } catch (error) {
      console.error('Failed to delete shared group:', error);
      throw error;
    }
  }

  private async updateGroupSplitwise(groupId: string, splitwiseGroupId: number): Promise<void> {
    try {
      await fetch(`/api/social/shared-groups/${groupId}/splitwise`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splitwiseGroupId }),
      });
    } catch (error) {
      console.error('Failed to update group with Splitwise ID:', error);
    }
  }

  private async getGroupMember(memberId: string): Promise<GroupMember | null> {
    try {
      const response = await fetch(`/api/social/group-members/${memberId}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Failed to get group member:', error);
      return null;
    }
  }
}

export const sharedSubscriptionsService = new SharedSubscriptionsService();