import { HandlerEvent, HandlerContext } from '@netlify/functions';
import { requireUser } from '../_shared/auth';
import { handlePreflight } from '../_shared/cors';

/**
 * Server-side proxy for Splitwise API calls.
 * Holds SPLITWISE_API_KEY server-side — never exposed to client.
 */

const SPLITWISE_API_KEY = process.env.SPLITWISE_API_KEY;
const SPLITWISE_BASE_URL = 'https://secure.splitwise.com/api/v3.0';

if (!SPLITWISE_API_KEY) {
  throw new Error('SPLITWISE_API_KEY environment variable is required');
}

interface SplitwiseRequest {
  action: string;
  groupId?: number;
  userId?: number;
  groupData?: Record<string, unknown>;
  expenseData?: Record<string, unknown>;
}

export async function handler(event: HandlerEvent, _context: HandlerContext) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight();
  }

  // Require auth
  const userId = await requireUser(event);
  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const { action, groupId, userId: reqUserId, groupData, expenseData } = (event.body && JSON.parse(event.body)) as SplitwiseRequest;

  try {
    switch (action) {
      case 'create_group': {
        if (!groupData) {
          return { statusCode: 400, body: JSON.stringify({ error: 'groupData required' }) };
        }
        const response = await fetch(`${SPLITWISE_BASE_URL}/create_group`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SPLITWISE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...groupData,
            type: 'other',
            simplify_by_default: true,
          }),
        });
        if (!response.ok) {
          return { statusCode: response.status, body: await response.text() };
        }
        const result = await response.json();
        return { statusCode: 200, body: JSON.stringify(result) };
      }

      case 'add_expense': {
        if (!expenseData) {
          return { statusCode: 400, body: JSON.stringify({ error: 'expenseData required' }) };
        }
        const response = await fetch(`${SPLITWISE_BASE_URL}/create_expense`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SPLITWISE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...expenseData,
            currency_code: expenseData.currency_code || 'USD',
            split_equally: false,
          }),
        });
        if (!response.ok) {
          return { statusCode: response.status, body: await response.text() };
        }
        const result = await response.json();
        return { statusCode: 200, body: JSON.stringify(result) };
      }

      case 'get_group_balances': {
        if (!groupId) {
          return { statusCode: 400, body: JSON.stringify({ error: 'groupId required' }) };
        }
        const response = await fetch(`${SPLITWISE_BASE_URL}/get_group/${groupId}`, {
          headers: {
            'Authorization': `Bearer ${SPLITWISE_API_KEY}`,
          },
        });
        if (!response.ok) {
          return { statusCode: response.status, body: await response.text() };
        }
        const result = await response.json();
        return { statusCode: 200, body: JSON.stringify(result) };
      }

      case 'delete_group': {
        if (!groupId) {
          return { statusCode: 400, body: JSON.stringify({ error: 'groupId required' }) };
        }
        const response = await fetch(`${SPLITWISE_BASE_URL}/delete_group/${groupId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${SPLITWISE_API_KEY}`,
          },
        });
        if (!response.ok) {
          return { statusCode: response.status, body: await response.text() };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      }

      case 'remove_member': {
        if (!groupId || !reqUserId) {
          return { statusCode: 400, body: JSON.stringify({ error: 'groupId and userId required' }) };
        }
        const response = await fetch(`${SPLITWISE_BASE_URL}/remove_user_from_group`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SPLITWISE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ group_id: groupId, user_id: reqUserId }),
        });
        if (!response.ok) {
          return { statusCode: response.status, body: await response.text() };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      }

      default:
        return { statusCode: 400, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
