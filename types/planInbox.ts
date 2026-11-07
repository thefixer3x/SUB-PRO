import type { EnvelopeRow } from '@/services/insightEngine';

export type InsightStatus = 'new' | 'accepted' | 'dismissed';

export interface InsightRecord {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  explanation: string;
  source_event_ids: string[];
  dedupe_key: string;
  status: InsightStatus;
  created_at: string;
  updated_at: string;
}

export interface EnvelopeRecord extends EnvelopeRow {
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface EnvelopeInput {
  name: string;
  currency?: string;
  monthly_amount_minor: number;
  category_filter?: string | null;
}
