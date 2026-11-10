import type { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';

/**
 * Every user-facing SUB-PRO feature, with its honest status.
 *
 * This is the single list the Features hub, the Home "Explore" strip and the
 * per-screen previews read from, so a feature is described once and its badge
 * cannot drift between screens.
 *
 * Status rules:
 * - `live`: works for every signed-in user on real data.
 * - `pro`: works on real data, but needs a paid plan (`gate` names the plan
 *   limit that decides access).
 * - `coming_soon`: not available yet. It is shown as a description only. It
 *   must never render simulated numbers, invented alerts or fake approvals as
 *   if they were the user's own.
 *
 * `pillar` follows the product promise: users *see* their recurring spend,
 * *decide* what to change, then *act* on it.
 */
export type FeatureStatus = 'live' | 'pro' | 'coming_soon';
export type FeaturePillar = 'see' | 'decide' | 'act';
export type PlanGate = keyof typeof SUBSCRIPTION_PLANS.free.limits;

export interface FeatureEntry {
  id: string;
  title: string;
  summary: string;
  status: FeatureStatus;
  pillar: FeaturePillar;
  /** Screen that opens the feature. Required for live and pro features. */
  route?: string;
  /** Plan limit that grants access. Required for pro features. */
  gate?: PlanGate;
}

export const PILLARS: Record<FeaturePillar, { title: string; summary: string }> = {
  see: { title: 'See', summary: 'Know exactly what you pay for, and when.' },
  decide: { title: 'Decide', summary: 'Spot waste and plan what to keep.' },
  act: { title: 'Act', summary: 'Stop unwanted charges at the source.' },
};

export const FEATURE_CATALOG: readonly FeatureEntry[] = [
  // ── See ─────────────────────────────────────────────────────────────────
  {
    id: 'subscriptions',
    title: 'Subscriptions',
    summary: 'Every subscription in one list, with cost, billing cycle and next renewal.',
    status: 'live',
    pillar: 'see',
    route: '/(tabs)/subscriptions',
  },
  {
    id: 'activity',
    title: 'Spending activity',
    summary: 'Monthly and yearly totals, category breakdown and renewals due soon.',
    status: 'live',
    pillar: 'see',
    route: '/(tabs)/analytics',
  },
  {
    id: 'renewal-reminders',
    title: 'Renewal reminders',
    summary: 'Choose when to be reminded before a subscription renews.',
    status: 'live',
    pillar: 'see',
    route: '/reminder-settings',
  },
  {
    id: 'multi-currency',
    title: 'Multi-currency totals',
    summary: 'One total across every currency you pay in, using daily exchange rates.',
    status: 'coming_soon',
    pillar: 'see',
  },
  // ── Decide ──────────────────────────────────────────────────────────────
  {
    id: 'plan-inbox',
    title: 'Plan inbox',
    summary: 'Price increases, duplicates and renewals that need a decision, on your Home screen.',
    status: 'live',
    pillar: 'decide',
    route: '/(tabs)',
  },
  {
    id: 'smart-insights',
    title: 'Smart insights',
    summary: 'Savings opportunities and a deeper category breakdown of your spending.',
    status: 'pro',
    pillar: 'decide',
    route: '/(tabs)/analytics',
    gate: 'smartInsights',
  },
  {
    id: 'shared-groups',
    title: 'Shared groups',
    summary: 'Split a subscription with family, friends or coworkers and track who owes what.',
    status: 'pro',
    pillar: 'decide',
    route: '/(tabs)/shared-groups',
    gate: 'subscriptionSharing',
  },
  {
    id: 'ai-assistant',
    title: 'AI assistant',
    summary: 'Recommendations on what to pause, cancel or switch, based on how you actually use each service.',
    status: 'coming_soon',
    pillar: 'decide',
  },
  {
    id: 'bulk-import',
    title: 'Import from CSV',
    summary: 'Add many subscriptions at once from a spreadsheet or bank export.',
    status: 'coming_soon',
    pillar: 'decide',
  },
  // ── Act ─────────────────────────────────────────────────────────────────
  {
    id: 'virtual-cards',
    title: 'Virtual cards',
    summary: 'A separate card for each subscription, so one leaked card never exposes the rest.',
    status: 'coming_soon',
    pillar: 'act',
  },
  {
    id: 'card-freeze',
    title: 'Freeze on cancel',
    summary: 'Freeze the linked card when you cancel, so the merchant cannot charge you again.',
    status: 'coming_soon',
    pillar: 'act',
  },
  {
    id: 'cancellation-assistant',
    title: 'Cancellation assistant',
    summary: 'Guided or automated cancellation, with a check that the charges really stopped.',
    status: 'coming_soon',
    pillar: 'act',
  },
  {
    id: 'pay-later',
    title: 'Pay later',
    summary: 'We pay your subscriptions upfront and you settle once a month.',
    status: 'coming_soon',
    pillar: 'act',
  },
  {
    id: 'partner-deals',
    title: 'Partner deals',
    summary: 'Discounts on services you already pay for.',
    status: 'coming_soon',
    pillar: 'act',
  },
] as const;

export function getFeature(id: string): FeatureEntry | undefined {
  return FEATURE_CATALOG.find((f) => f.id === id);
}

export function featuresByPillar(pillar: FeaturePillar): FeatureEntry[] {
  return FEATURE_CATALOG.filter((f) => f.pillar === pillar);
}

export const STATUS_LABEL: Record<FeatureStatus, string> = {
  live: 'Available',
  pro: 'Pro',
  coming_soon: 'Coming soon',
};
