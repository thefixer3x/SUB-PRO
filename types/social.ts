export interface SharedGroup {
  id: string;
  subscriptionId: string;
  ownerId: string;
  name: string;
  description?: string;
  totalCost: number;
  splitMethod: 'equal' | 'percentage' | 'custom';
  splitwiseGroupId?: string;
  status: 'active' | 'pending' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId?: string;
  email: string;
  name: string;
  shareAmount: number;
  sharePercentage: number;
  status: 'invited' | 'accepted' | 'declined' | 'removed';
  invitedAt: Date;
  respondedAt?: Date;
  lastNotificationAt?: Date;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  email: string;
  invitedBy: string;
  token: string;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
}

export interface SplitExpense {
  id: string;
  groupId: string;
  amount: number;
  description: string;
  paidBy: string;
  splitwiseExpenseId?: string;
  dueDate: Date;
  status: 'pending' | 'settled' | 'overdue';
  createdAt: Date;
}

export interface CommunityStats {
  id: string;
  serviceName: string;
  category: string;
  userCount: number;
  averageCost: number;
  medianCost: number;
  costRange: {
    min: number;
    max: number;
  };
  popularPlans: Array<{
    planName: string;
    userCount: number;
    averageCost: number;
  }>;
  updatedAt: Date;
}

export interface UserDataSharing {
  userId: string;
  enabled: boolean;
  dataTypes: {
    subscriptionCosts: boolean;
    categories: boolean;
    planTypes: boolean;
  };
  consentDate: Date;
  lastOptOut?: Date;
}

export interface SplitCalculation {
  memberId: string;
  memberEmail: string;
  memberName: string;
  shareAmount: number;
  sharePercentage: number;
  totalOwed: number;
  totalPaid: number;
  balance: number;
}