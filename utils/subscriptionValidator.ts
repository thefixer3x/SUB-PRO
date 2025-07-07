import { SubscriptionCategory, SubscriptionStatus, Priority, BillingCycle } from '@/types/subscription';

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: any;
}

export interface MappedSubscriptionData {
  subscriptionName: string;
  category: SubscriptionCategory;
  status: SubscriptionStatus;
  planName: string;
  monthlyCost: number;
  billingCycle: BillingCycle;
  renewalDate?: Date;
  paymentMethod: string;
  notes?: string;
  lastUsed?: Date;
  priority: Priority;
  deactivationDate?: Date;
}

export const REQUIRED_FIELDS = [
  'subscriptionName',
  'category', 
  'status',
  'monthlyCost'
] as const;

export const VALID_STATUSES: SubscriptionStatus[] = ['Active', 'Inactive', 'Paused', 'Trial', 'Expired'];
export const VALID_CATEGORIES: SubscriptionCategory[] = [
  'Productivity', 'Entertainment', 'Creative', 'Finance', 'AI', 
  'Utilities', 'Health', 'Education', 'Communication', 'Other'
];
export const VALID_PRIORITIES: Priority[] = ['High', 'Medium', 'Low'];
export const VALID_BILLING_CYCLES: BillingCycle[] = ['Monthly', 'Quarterly', 'Annually', 'Weekly'];

const parseDate = (value: any): Date | undefined => {
  if (!value || value === '') return undefined;
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD format.');
  }
  return date;
};

const parseNumber = (value: any): number => {
  if (value === '' || value === null || value === undefined) {
    throw new Error('Value is required');
  }
  
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) {
    throw new Error('Invalid number format');
  }
  return num;
};

const validateEnum = <T extends string>(value: any, validValues: readonly T[], fieldName: string): T => {
  const stringValue = String(value).trim();
  const matchedValue = validValues.find(v => v.toLowerCase() === stringValue.toLowerCase());
  
  if (!matchedValue) {
    throw new Error(`Invalid ${fieldName}. Valid options: ${validValues.join(', ')}`);
  }
  
  return matchedValue;
};

export const validateSubscriptionRow = (
  rowData: any[], 
  fieldMapping: Record<string, number>,
  rowIndex: number
): { data: MappedSubscriptionData; errors: ValidationError[] } => {
  const errors: ValidationError[] = [];
  const data: Partial<MappedSubscriptionData> = {};

  // Helper function to add validation errors
  const addError = (field: string, message: string, value: any) => {
    errors.push({ row: rowIndex, field, message, value });
  };

  // Validate required fields
  try {
    // Subscription Name
    const nameIndex = fieldMapping.subscriptionName;
    if (nameIndex !== undefined) {
      const name = String(rowData[nameIndex] || '').trim();
      if (!name) {
        addError('subscriptionName', 'Subscription name is required', rowData[nameIndex]);
      } else {
        data.subscriptionName = name;
      }
    } else {
      addError('subscriptionName', 'Subscription name column not mapped', '');
    }

    // Category
    const categoryIndex = fieldMapping.category;
    if (categoryIndex !== undefined && rowData[categoryIndex]) {
      try {
        data.category = validateEnum(rowData[categoryIndex], VALID_CATEGORIES, 'category');
      } catch (error) {
        addError('category', error instanceof Error ? error.message : 'Invalid category', rowData[categoryIndex]);
      }
    } else {
      addError('category', 'Category is required', rowData[categoryIndex] || '');
    }

    // Status
    const statusIndex = fieldMapping.status;
    if (statusIndex !== undefined && rowData[statusIndex]) {
      try {
        data.status = validateEnum(rowData[statusIndex], VALID_STATUSES, 'status');
      } catch (error) {
        addError('status', error instanceof Error ? error.message : 'Invalid status', rowData[statusIndex]);
      }
    } else {
      addError('status', 'Status is required', rowData[statusIndex] || '');
    }

    // Monthly Cost
    const costIndex = fieldMapping.monthlyCost;
    if (costIndex !== undefined) {
      try {
        data.monthlyCost = parseNumber(rowData[costIndex]);
        if (data.monthlyCost < 0) {
          addError('monthlyCost', 'Monthly cost cannot be negative', rowData[costIndex]);
        }
      } catch (error) {
        addError('monthlyCost', error instanceof Error ? error.message : 'Invalid monthly cost', rowData[costIndex]);
      }
    } else {
      addError('monthlyCost', 'Monthly cost is required', '');
    }

    // Optional fields
    const planNameIndex = fieldMapping.planName;
    if (planNameIndex !== undefined && rowData[planNameIndex]) {
      data.planName = String(rowData[planNameIndex]).trim();
    } else {
      data.planName = 'Basic'; // Default value
    }

    const billingCycleIndex = fieldMapping.billingCycle;
    if (billingCycleIndex !== undefined && rowData[billingCycleIndex]) {
      try {
        data.billingCycle = validateEnum(rowData[billingCycleIndex], VALID_BILLING_CYCLES, 'billing cycle');
      } catch (error) {
        data.billingCycle = 'Monthly'; // Default value
      }
    } else {
      data.billingCycle = 'Monthly'; // Default value
    }

    const priorityIndex = fieldMapping.priority;
    if (priorityIndex !== undefined && rowData[priorityIndex]) {
      try {
        data.priority = validateEnum(rowData[priorityIndex], VALID_PRIORITIES, 'priority');
      } catch (error) {
        data.priority = 'Medium'; // Default value
      }
    } else {
      data.priority = 'Medium'; // Default value
    }

    // Date fields
    const renewalDateIndex = fieldMapping.renewalDate;
    if (renewalDateIndex !== undefined && rowData[renewalDateIndex]) {
      try {
        data.renewalDate = parseDate(rowData[renewalDateIndex]);
      } catch (error) {
        addError('renewalDate', error instanceof Error ? error.message : 'Invalid renewal date', rowData[renewalDateIndex]);
      }
    }

    const lastUsedIndex = fieldMapping.lastUsed;
    if (lastUsedIndex !== undefined && rowData[lastUsedIndex]) {
      try {
        data.lastUsed = parseDate(rowData[lastUsedIndex]);
      } catch (error) {
        addError('lastUsed', error instanceof Error ? error.message : 'Invalid last used date', rowData[lastUsedIndex]);
      }
    }

    const deactivationDateIndex = fieldMapping.deactivationDate;
    if (deactivationDateIndex !== undefined && rowData[deactivationDateIndex]) {
      try {
        data.deactivationDate = parseDate(rowData[deactivationDateIndex]);
      } catch (error) {
        addError('deactivationDate', error instanceof Error ? error.message : 'Invalid deactivation date', rowData[deactivationDateIndex]);
      }
    }

    // Text fields
    const paymentMethodIndex = fieldMapping.paymentMethod;
    data.paymentMethod = paymentMethodIndex !== undefined && rowData[paymentMethodIndex] 
      ? String(rowData[paymentMethodIndex]).trim() 
      : 'Not specified';

    const notesIndex = fieldMapping.notes;
    if (notesIndex !== undefined && rowData[notesIndex]) {
      data.notes = String(rowData[notesIndex]).trim();
    }

  } catch (error) {
    addError('general', error instanceof Error ? error.message : 'Unknown validation error', '');
  }

  return { data: data as MappedSubscriptionData, errors };
};

export const validateBatchData = (
  rows: any[][],
  fieldMapping: Record<string, number>
): { validData: MappedSubscriptionData[]; errors: ValidationError[] } => {
  const validData: MappedSubscriptionData[] = [];
  const allErrors: ValidationError[] = [];

  rows.forEach((row, index) => {
    const { data, errors } = validateSubscriptionRow(row, fieldMapping, index + 1);
    
    if (errors.length === 0) {
      validData.push(data);
    } else {
      allErrors.push(...errors);
    }
  });

  return { validData, errors: allErrors };
};