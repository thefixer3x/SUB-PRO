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
import { chunks, readAllPages } from './pagination';

export interface InsightStore {
  getConsent(userId: string): Promise<boolean>;
  listAuthorizations(userId: string): Promise<CardAuthorizationRow[]>;
  listSubscriptions(userId: string): Promise<SubscriptionRow[]>;
  listEnvelopes(userId: string): Promise<EnvelopeRow[]>;
  listEnvelopeSpend(envelopeIds: string[], month: string): Promise<EnvelopeSpendRow[]>;
  listInsightKeys(userId: string): Promise<Set<string>>;
  insertInsights(userId: string, events: InsightEvent[]): Promise<number>;
  deleteInsights(userId: string): Promise<void>;
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
      // Require both deployment-level test mode and per-row Stripe provenance.
      // The migration backfills unknown legacy rows as live.
      if (!isStripeTestMode()) return [];

      const cards = await readAllPages<{ card_id: string | null }>(
        (from, to) => admin
          .from('virtual_cards')
          .select('card_id')
          .eq('user_id', userId)
          .not('card_id', 'is', null)
          .order('card_id', { ascending: true })
          .range(from, to),
        'failed to list virtual cards',
      );

      const cardIds = cards
        .map((row) => row.card_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (cardIds.length === 0) return [];

      const authorizations: CardAuthorizationRow[] = [];
      for (const ids of chunks(cardIds, 100)) {
        const rows = await readAllPages<CardAuthorizationRow>(
          (from, to) => admin
            .from('card_authorizations')
            .select('id, merchant_name, merchant_category, amount, currency, transaction_date, approved, livemode')
            .in('stripe_card_id', ids)
            .eq('livemode', false)
            .order('transaction_date', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
          'failed to list card authorizations',
        );
        authorizations.push(...rows);
      }
      return authorizations;
    },

    async listSubscriptions(userId) {
      return readAllPages<SubscriptionRow>(
        (from, to) => admin
          .from('sm_subscriptions')
          .select('id, name, category, monthly_cost, currency, renewal_date, last_used, status')
          .eq('user_id', userId)
          .order('id', { ascending: true })
          .range(from, to),
        'failed to list subscriptions',
      );
    },

    async listEnvelopes(userId) {
      return readAllPages<EnvelopeRow>(
        (from, to) => admin
          .from('sm_envelopes')
          .select('id, name, currency, monthly_amount_minor, category_filter')
          .eq('user_id', userId)
          .order('id', { ascending: true })
          .range(from, to),
        'failed to list envelopes',
      );
    },

    async listEnvelopeSpend(envelopeIds, month) {
      if (envelopeIds.length === 0) return [];
      const spend: EnvelopeSpendRow[] = [];
      for (const ids of chunks(envelopeIds, 100)) {
        const rows = await readAllPages<EnvelopeSpendRow>(
          (from, to) => admin
            .from('sm_envelope_spend')
            .select('id, envelope_id, amount_minor, currency, month')
            .in('envelope_id', ids)
            .eq('month', month)
            .order('envelope_id', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
          'failed to list envelope spend',
        );
        spend.push(...rows);
      }
      return spend;
    },

    async listInsightKeys(userId) {
      const rows = await readAllPages<{ dedupe_key: string }>(
        (from, to) => admin
          .from('sm_insights')
          .select('dedupe_key')
          .eq('user_id', userId)
          .order('dedupe_key', { ascending: true })
          .range(from, to),
        'failed to list existing insights',
      );
      return new Set(rows.map((row) => row.dedupe_key));
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

    async deleteInsights(userId) {
      await deleteUserInsights(admin, userId);
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

  // Consent can be revoked while the source reads and insert are in flight.
  // Re-check after the write and clean up anything that raced with revocation.
  if (!(await store.getConsent(userId))) {
    await store.deleteInsights(userId);
    return { consented: false, detected: detected.length, created: 0 };
  }

  return { consented: true, detected: detected.length, created };
}

export async function deleteUserInsights(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.from('sm_insights').delete().eq('user_id', userId);
  if (error) fail('failed to delete insights', error);
}

// ---------------------------------------------------------------------------
// Reads and status changes used by the API routes
// ---------------------------------------------------------------------------

export async function listInsights(
  admin: SupabaseClient,
  userId: string,
  status?: InsightStatus,
): Promise<InsightRecord[]> {
  return readAllPages<InsightRecord>(
    (from, to) => {
      let query = admin
        .from('sm_insights')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });
      if (status) query = query.eq('status', status);
      return query.range(from, to);
    },
    'failed to list insights',
  );
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
