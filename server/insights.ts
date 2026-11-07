/**
 * Server-side insight storage and scan orchestration.
 *
 * The pure detection lives in `services/insightEngine.ts`. This module wires it
 * to Supabase and enforces two rules:
 *
 *   1. Nothing is read until the user has opted in (`sm_ai_consent`).
 *   2. Every query filters on the user id from the verified session, even
 *      though the service role bypasses RLS.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { InsightRecord, InsightStatus } from '../types/planInbox';
import {
  detectAll,
  monthOf,
  type CardAuthorizationRow,
  type DetectOptions,
  type EnvelopeRow,
  type EnvelopeSpendRow,
  type InsightData,
  type InsightEvent,
  type SubscriptionRow,
} from '../services/insightEngine';
import { isStripeTestMode } from './stripe-mode';

export interface InsightStore {
  getConsent(userId: string): Promise<boolean>;
  listAuthorizations(userId: string): Promise<CardAuthorizationRow[]>;
  listSubscriptions(userId: string): Promise<SubscriptionRow[]>;
  listEnvelopes(userId: string): Promise<EnvelopeRow[]>;
  listEnvelopeSpend(envelopeIds: string[], month: string): Promise<EnvelopeSpendRow[]>;
  listInsightKeys(userId: string): Promise<Set<string>>;
  insertInsights(userId: string, events: InsightEvent[]): Promise<number>;
}

export interface ScanResult {
  consented: boolean;
  detected: number;
  created: number;
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'unknown error'}`);
}

export function createSupabaseInsightStore(admin: SupabaseClient): InsightStore {
  return {
    async getConsent(userId) {
      const { data, error } = await admin
        .from('sm_ai_consent')
        .select('enabled')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) fail('failed to read insight consent', error);
      return Boolean((data as { enabled?: boolean } | null)?.enabled);
    },

    async listAuthorizations(userId) {
      // The persisted authorization table does not record Stripe's `livemode`
      // bit. Until it does, do not analyze card events unless this deployment
      // is explicitly configured with a Stripe test-mode key.
      if (!isStripeTestMode()) return [];

      const { data: cards, error: cardError } = await admin
        .from('virtual_cards')
        .select('card_id')
        .eq('user_id', userId)
        .not('card_id', 'is', null);
      if (cardError) fail('failed to list virtual cards', cardError);

      const cardIds = ((cards ?? []) as { card_id: string | null }[])
        .map((row) => row.card_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (cardIds.length === 0) return [];

      const { data, error } = await admin
        .from('card_authorizations')
        .select('id, merchant_name, merchant_category, amount, currency, transaction_date, approved, livemode')
        .in('stripe_card_id', cardIds)
        .eq('livemode', false)
        .order('transaction_date', { ascending: true });
      if (error) fail('failed to list card authorizations', error);
      return (data ?? []) as CardAuthorizationRow[];
    },

    async listSubscriptions(userId) {
      const { data, error } = await admin
        .from('sm_subscriptions')
        .select('id, name, category, monthly_cost, currency, renewal_date, last_used, status')
        .eq('user_id', userId);
      if (error) fail('failed to list subscriptions', error);
      return (data ?? []) as SubscriptionRow[];
    },

    async listEnvelopes(userId) {
      const { data, error } = await admin
        .from('sm_envelopes')
        .select('id, name, currency, monthly_amount_minor, category_filter')
        .eq('user_id', userId);
      if (error) fail('failed to list envelopes', error);
      return (data ?? []) as EnvelopeRow[];
    },

    async listEnvelopeSpend(envelopeIds, month) {
      if (envelopeIds.length === 0) return [];
      const { data, error } = await admin
        .from('sm_envelope_spend')
        .select('id, envelope_id, amount_minor, currency, month')
        .in('envelope_id', envelopeIds)
        .eq('month', month);
      if (error) fail('failed to list envelope spend', error);
      return (data ?? []) as EnvelopeSpendRow[];
    },

    async listInsightKeys(userId) {
      const { data, error } = await admin
        .from('sm_insights')
        .select('dedupe_key')
        .eq('user_id', userId);
      if (error) fail('failed to list existing insights', error);
      return new Set(((data ?? []) as { dedupe_key: string }[]).map((row) => row.dedupe_key));
    },

    async insertInsights(userId, events) {
      if (events.length === 0) return 0;
      const rows = events.map((event) => ({
        user_id: userId,
        type: event.type,
        payload: event.payload,
        explanation: event.explanation,
        source_event_ids: event.sourceEventIds,
        dedupe_key: event.dedupeKey,
      }));

      const { data, error } = await admin
        .from('sm_insights')
        .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
        .select('id');
      if (error) fail('failed to insert insights', error);
      return (data ?? []).length;
    },
  };
}

/** Run every detector once, then store only insights the user has not seen. */
export async function scanInsights(
  store: InsightStore,
  userId: string,
  options: DetectOptions = {},
): Promise<ScanResult> {
  const consented = await store.getConsent(userId);
  if (!consented) {
    return { consented: false, detected: 0, created: 0 };
  }

  const now = options.now ?? new Date();
  const envelopes = await store.listEnvelopes(userId);
  const data: InsightData = {
    authorizations: await store.listAuthorizations(userId),
    subscriptions: await store.listSubscriptions(userId),
    envelopes,
    envelopeSpend: await store.listEnvelopeSpend(
      envelopes.map((envelope) => envelope.id),
      monthOf(now.toISOString()),
    ),
  };

  const detected = detectAll(data, { ...options, now });
  const existing = await store.listInsightKeys(userId);
  const fresh = detected.filter((event) => !existing.has(event.dedupeKey));
  const created = await store.insertInsights(userId, fresh);

  return { consented: true, detected: detected.length, created };
}

// ---------------------------------------------------------------------------
// Reads and status changes used by the API routes
// ---------------------------------------------------------------------------

export async function listInsights(
  admin: SupabaseClient,
  userId: string,
  status?: InsightStatus,
): Promise<InsightRecord[]> {
  let query = admin
    .from('sm_insights')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) fail('failed to list insights', error);
  return (data ?? []) as InsightRecord[];
}

export async function updateInsightStatus(
  admin: SupabaseClient,
  userId: string,
  insightId: string,
  status: InsightStatus,
): Promise<InsightRecord | null> {
  const { data, error } = await admin
    .from('sm_insights')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', insightId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) fail('failed to update insight', error);
  return (data as InsightRecord | null) ?? null;
}

export async function getConsent(
  admin: SupabaseClient,
  userId: string,
): Promise<{ enabled: boolean; consent_version: string | null; consented_at: string | null }> {
  const { data, error } = await admin
    .from('sm_ai_consent')
    .select('enabled, consent_version, consented_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) fail('failed to read insight consent', error);
  const row = data as { enabled?: boolean; consent_version?: string; consented_at?: string } | null;
  return {
    enabled: Boolean(row?.enabled),
    consent_version: row?.consent_version ?? null,
    consented_at: row?.consented_at ?? null,
  };
}

export async function setConsent(
  admin: SupabaseClient,
  userId: string,
  enabled: boolean,
  consentVersion = '2026-11',
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from('sm_ai_consent')
    .upsert(
      {
        user_id: userId,
        enabled,
        consent_version: consentVersion,
        consented_at: enabled ? now : null,
        revoked_at: enabled ? null : now,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    );
  if (error) fail('failed to update insight consent', error);
}

/** F7: insights are free; accept-to-rule is Pro. */
export async function getUserTier(
  admin: SupabaseClient,
  userId: string,
): Promise<'free' | 'pro' | 'team'> {
  const { data, error } = await admin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();
  if (error) fail('failed to read subscription tier', error);
  const tier = (data as { subscription_tier?: string } | null)?.subscription_tier;
  return tier === 'pro' || tier === 'team' ? tier : 'free';
}
