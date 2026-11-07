/**
 * Envelope CRUD, summaries and the nightly authorization-to-envelope match.
 *
 * Every query filters on a user id taken from `requireUser` (except the job,
 * which resolves the owner through `virtual_cards`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { EnvelopeInput, EnvelopeRecord } from '../types/planInbox';
import {
  matchAuthorizationToEnvelope,
  summarizeEnvelopes,
  type EnvelopeSummary,
} from '../services/envelopeMath';
import { monthOf, type EnvelopeRow, type EnvelopeSpendRow } from '../services/insightEngine';
import { chunks, readAllPages } from './pagination';
import { isStripeTestMode } from './stripe-mode';

export class EnvelopeValidationError extends Error {}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'unknown error'}`);
}

export function validateEnvelopeInput(input: unknown): EnvelopeInput {
  const body = (input ?? {}) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length === 0 || name.length > 80) {
    throw new EnvelopeValidationError('name must be between 1 and 80 characters');
  }

  const amount = body.monthly_amount_minor;
  if (
    typeof amount !== 'number' ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    amount > 100_000_000
  ) {
    throw new EnvelopeValidationError('monthly_amount_minor must be a positive integer (minor units)');
  }

  const rawCurrency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'USD';
  if (!/^[A-Z]{3}$/.test(rawCurrency)) {
    throw new EnvelopeValidationError('currency must be a three-letter ISO code');
  }

  const rawCategory = typeof body.category_filter === 'string' ? body.category_filter.trim() : null;
  if (rawCategory && rawCategory.length > 80) {
    throw new EnvelopeValidationError('category_filter must be at most 80 characters');
  }

  return {
    name,
    currency: rawCurrency,
    monthly_amount_minor: amount,
    category_filter: rawCategory || null,
  };
}

export async function listEnvelopes(
  admin: SupabaseClient,
  userId: string,
): Promise<EnvelopeRecord[]> {
  return readAllPages<EnvelopeRecord>(
    (from, to) => admin
      .from('sm_envelopes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
    'failed to list envelopes',
  );
}

export async function getEnvelopeSummary(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<EnvelopeSummary[]> {
  const envelopes = await listEnvelopes(admin, userId);
  if (envelopes.length === 0) return [];
  if (!isStripeTestMode()) {
    return summarizeEnvelopes(envelopes as EnvelopeRow[], [], now);
  }

  const spendRows: EnvelopeSpendRow[] = [];
  for (const envelopeIds of chunks(envelopes.map((envelope) => envelope.id), 100)) {
    const rows = await readAllPages<EnvelopeSpendRow>(
      (from, to) => admin
        .from('sm_envelope_spend')
        .select('id, envelope_id, amount_minor, currency, month')
        .in('envelope_id', envelopeIds)
        .eq('month', monthOf(now.toISOString()))
        .order('envelope_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
      'failed to list envelope spend',
    );
    spendRows.push(...rows);
  }

  return summarizeEnvelopes(envelopes as EnvelopeRow[], spendRows, now);
}

export async function createEnvelope(
  admin: SupabaseClient,
  userId: string,
  input: EnvelopeInput,
): Promise<EnvelopeRecord> {
  const { data, error } = await admin
    .from('sm_envelopes')
    .insert({ user_id: userId, ...input })
    .select('*')
    .single();
  if (error) fail('failed to create envelope', error);
  return data as EnvelopeRecord;
}

export async function updateEnvelope(
  admin: SupabaseClient,
  userId: string,
  envelopeId: string,
  input: EnvelopeInput,
): Promise<EnvelopeRecord | null> {
  const { data, error } = await admin
    .from('sm_envelopes')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', envelopeId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) fail('failed to update envelope', error);
  return (data as EnvelopeRecord | null) ?? null;
}

export async function deleteEnvelope(
  admin: SupabaseClient,
  userId: string,
  envelopeId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('sm_envelopes')
    .delete()
    .eq('id', envelopeId)
    .eq('user_id', userId)
    .select('id');
  if (error) fail('failed to delete envelope', error);
  return (data ?? []).length > 0;
}

export interface LinkSpendResult {
  scanned: number;
  matched: number;
  created: number;
}

/**
 * Idempotent matcher used by the nightly job. Skips authorizations that are
 * already linked, so a re-run cannot double-count.
 */
export async function linkEnvelopeSpend(
  admin: SupabaseClient,
  options: { since: Date },
): Promise<LinkSpendResult> {
  const cards = await readAllPages<{ card_id: string | null; user_id: string | null }>(
    (from, to) => admin
      .from('virtual_cards')
      .select('card_id, user_id')
      .not('card_id', 'is', null)
      .order('user_id', { ascending: true })
      .order('card_id', { ascending: true })
      .range(from, to),
    'failed to list virtual cards',
  );

  const owners = new Map<string, string>();
  for (const card of cards) {
    if (card.card_id && card.user_id) owners.set(card.card_id, card.user_id);
  }
  if (owners.size === 0) return { scanned: 0, matched: 0, created: 0 };

  const envelopeRows = await readAllPages<EnvelopeRow & { user_id: string }>(
    (from, to) => admin
      .from('sm_envelopes')
      .select('id, user_id, name, currency, monthly_amount_minor, category_filter')
      .order('user_id', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
    'failed to list envelopes',
  );

  const envelopesByUser = new Map<string, EnvelopeRow[]>();
  for (const envelope of envelopeRows) {
    const list = envelopesByUser.get(envelope.user_id) ?? [];
    list.push(envelope);
    envelopesByUser.set(envelope.user_id, list);
  }
  if (envelopesByUser.size === 0) return { scanned: 0, matched: 0, created: 0 };

  type AuthorizationRow = {
    id: string;
    stripe_card_id: string;
    merchant_name: string;
    merchant_category: string | null;
    amount: number;
    currency: string;
    transaction_date: string;
    approved: boolean | null;
    livemode: boolean;
  };
  const authorizations: AuthorizationRow[] = [];
  for (const cardIds of chunks([...owners.keys()], 100)) {
    const rows = await readAllPages<AuthorizationRow>(
      (from, to) => admin
        .from('card_authorizations')
        .select('id, stripe_card_id, merchant_name, merchant_category, amount, currency, transaction_date, approved, livemode')
        .in('stripe_card_id', cardIds)
        .eq('livemode', false)
        .gte('transaction_date', options.since.toISOString())
        .order('transaction_date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
      'failed to list card authorizations',
    );
    authorizations.push(...rows);
  }

  if (authorizations.length === 0) return { scanned: 0, matched: 0, created: 0 };

  const alreadyLinked = new Set<string>();
  for (const authorizationIds of chunks(authorizations.map((authorization) => authorization.id), 100)) {
    const rows = await readAllPages<{ card_authorization_id: string | null }>(
      (from, to) => admin
        .from('sm_envelope_spend')
        .select('card_authorization_id')
        .in('card_authorization_id', authorizationIds)
        .order('card_authorization_id', { ascending: true })
        .range(from, to),
      'failed to list linked spend',
    );
    for (const row of rows) {
      if (row.card_authorization_id) alreadyLinked.add(row.card_authorization_id);
    }
  }

  const rows: Record<string, unknown>[] = [];
  for (const authorization of authorizations) {
    if (authorization.approved === false) continue;
    if (authorization.livemode) continue;
    if (alreadyLinked.has(authorization.id)) continue;
    const userId = owners.get(authorization.stripe_card_id);
    if (!userId) continue;
    const envelope = matchAuthorizationToEnvelope(
      authorization,
      envelopesByUser.get(userId) ?? [],
    );
    if (!envelope) continue;

    rows.push({
      envelope_id: envelope.id,
      card_authorization_id: authorization.id,
      amount_minor: authorization.amount,
      currency: authorization.currency || 'USD',
      transaction_date: authorization.transaction_date,
      month: monthOf(authorization.transaction_date),
    });
  }

  if (rows.length === 0) {
    return { scanned: authorizations.length, matched: 0, created: 0 };
  }

  let created = 0;
  for (const row of rows) {
    const { error: insertError } = await admin.from('sm_envelope_spend').insert(row);
    // 23505 means another run linked the row in the meantime; the job is
    // idempotent, so count only the inserts that actually succeeded.
    if (insertError?.code === '23505') continue;
    if (insertError) fail('failed to link envelope spend', insertError);
    created += 1;
  }

  return { scanned: authorizations.length, matched: rows.length, created };
}
