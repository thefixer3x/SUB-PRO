# Spec: card funding, bill set-asides and the AI subscription manager

Status: **draft for owner decisions** (section 8). Nothing here is built yet, and nothing here moves money. All build work is test mode only until the owner signs off.

## 1. What we are building

The product vision: one SubTrack card pays every bill. SubTrack splits that card out to each merchant, keeps money set aside for utilities in one view, and makes sure everything else is covered. Analytics on top say what to save on, cancel or upgrade, and an AI manager plans the whole pattern.

The user sees:
- **One card** ("SubTrack card") that all subscriptions and bills are moved onto.
- **Set-asides**: "Utilities ₦45,000 / month", "Streaming $30 / month". Each one shows what is planned, what has been spent and what is left.
- **A plan**: what to cancel, downgrade or upgrade, and what each change saves, with one tap to accept.

## 2. The constraint that shapes the design

Money a user loads into SubTrack and can spend later is **stored value**. A label like "card funding" in the app doesn't change that: the backend would hold a pool of customer money. That needs a licence, or a licensed partner holding the money (an e-money or money-transmission licence; in Nigeria, CBN licensing). Stripe also restricts stored-value use without approval.

Most of the vision can be delivered **without SubTrack ever holding customer funds**. The design therefore separates:

- **Planning money** (set-asides, budgets). These are numbers SubTrack tracks. No money moves.
- **Moving money** (paying a merchant). This always goes straight from the user's own funding source at the moment of the charge.

A real, held "set-aside" balance is a later phase, through a licensed partner (section 4, F2).

## 3. Card topology

| Option | How it works | Trade-off |
| --- | --- | --- |
| T1: one card | One virtual card. Each authorization is matched to a subscription by merchant. | Simplest for the user. A merchant can't be cut off without blocking the whole card. |
| T2: one card per subscription | A merchant-locked card for each subscription, shown in the app as one SubTrack card. | Cancelling means freezing that one card, and limits can be per merchant. More cards to manage, and per-card fees apply. |

**Recommendation:** T1 by default, with T2 for subscriptions the user marks "lock to merchant". That is a Pro feature and the clearest cancel/downgrade lever. The `virtual_cards.subscription_id` column already allows the link.

## 4. Funding models

| Model | Money flow | Holds customer funds? | Fits |
| --- | --- | --- | --- |
| **F1: pay-through** | SubTrack's issuing balance approves the authorization. The user's saved card or bank mandate is then charged for the same amount right away. | No (SubTrack fronts the amount for seconds or minutes) | Phase 1 |
| **F2: partner-held balance** | Each user gets an account held by a licensed partner bank (for example Stripe Treasury / financial accounts where available, or a licensed NGN wallet partner). Cards draw from it. | The partner holds the funds, not SubTrack | Phase 2, if real set-aside money is wanted |
| **F3: envelopes** | Set-asides are budgets. Authorizations are checked against the envelope, and money comes through F1. | No | Phase 1, alongside F1 |

**Recommendation:** Phase 1 uses F3 and F1 together. The user gets set-aside views, enforced budgets and one card, and SubTrack holds no money.

F1's risk is the charge failing after the merchant was approved, which leaves the user owing SubTrack. Limit it with:
- a per-user exposure cap that starts low and grows with history;
- declining when the funding source last failed;
- only allowing merchants and amounts the user's subscriptions predict.

**Real-time constraint:** Stripe Issuing's real-time authorization webhook must answer within about 2 seconds. The approve/decline decision is therefore rules only: envelope remaining, merchant lock, caps, price-change threshold. No AI call and no card charge happen on that path; the charge happens right after.

## 5. Where the AI subscription manager starts

The entry point is the **stream of money events** SubTrack already receives, not a chat screen:

1. **Card authorizations** (`issuing_authorization.*`, stored in `card_authorizations`).
2. **Detected bank transactions** (`bank_accounts` and the subscription-detection tables).
3. **Renewals** from `sm_subscriptions`.

Each event goes through a small **insight engine** that labels it and, when it matters, creates an *insight*:

| Insight | Trigger |
| --- | --- |
| Price increase | Same merchant, amount higher than last time by more than X% |
| New recurring merchant | Second charge from a merchant on a monthly or yearly rhythm |
| Unused subscription | No usage signal (`last_used`) for N days before a renewal |
| Duplicate | Two subscriptions in the same category doing the same job |
| Envelope at risk | Projected spend goes over the set-aside before month end |
| Cheaper plan | A known lower tier or annual plan for the same service |

Insights show up in a **Plan inbox** on the dashboard. The AI's jobs:

- **Explain** each insight in plain words, quoting the numbers it used.
- **Propose** an action: cancel, downgrade, move to annual, lock to merchant, or adjust a set-aside.
- **Monthly plan**: once a month, propose next month's set-asides and a short cancel/downgrade list, with the expected saving.

Guardrails:
- The AI never moves money, never approves an authorization and never cancels anything by itself. Every action needs the user's tap. Accepted actions become rules (envelope amounts, merchant locks, price-change thresholds) that the deterministic real-time path enforces.
- It only sees the user's own data, and only after the user opts in to AI insights. Prompts carry no card numbers or credentials.
- Every insight records which events it came from, so an explanation can always be checked.

## 6. Data model (proposed, not applied)

New tables. Each one is owner-readable, and only the service role writes it, following the S401 pattern:

| Table | Purpose |
| --- | --- |
| `sm_envelopes` | id, user_id, name, currency, monthly_amount_minor, category filter |
| `sm_envelope_spend` | envelope_id, card_authorization or detected transaction id, amount_minor, month |
| `sm_card_rules` | card or subscription, rule type (merchant lock, cap, price threshold), parameters, source (user or accepted insight) |
| `sm_insights` | user_id, type, payload, source event ids, status (new, accepted, dismissed), created_at |
| `sm_funding_sources` | user_id, gateway, gateway's saved-method reference (never card data), status, last failure |

Amounts are stored in minor units, with currencies never mixed in a total (`@lanonasis/fin-core`'s `toMinorUnits` and `totalsByCurrency`). Webhook handlers use fin-core's `runOnce`.

## 7. Phases

| Phase | Scope | Done when |
| --- | --- | --- |
| P0 | S401 applied; fin-core adopted in the SubTrack webhook (database-backed idempotency) | Webhook can't double-apply an event; client roles can't write cards or billing fields |
| P1 | Envelopes (F3) and the Plan inbox with the first three insights, using existing data, with no card funding yet | A user can create a set-aside and see spend against it; price-increase, new-merchant and unused insights appear with explanations |
| P2 | One SubTrack card (T1) with F1 pay-through and real-time rules, test mode | A test-mode authorization is approved or declined by rules within the time limit, then charged to the test funding source; failed charges block further approvals |
| P3 | Merchant-locked cards (T2) and accept-to-rule actions from insights | Accepting "cancel" freezes that merchant's card; accepting a set-aside change updates the envelope |
| P4 | Partner-held balances (F2), only after legal sign-off | Partner chosen, contract and licensing confirmed, funds never on SubTrack's books |

## 8. Decisions needed from the owner

| ID | Decision | Recommendation |
| --- | --- | --- |
| F1 | Funding model for phase 1: pay-through and envelopes (no funds held), or a held balance now? | Pay-through and envelopes |
| F2 | Card topology: one card, per-subscription cards, or both? | One card, plus per-subscription cards as a Pro option |
| F3 | Card issuer per region. Stripe Issuing covers some regions. NGN cards need a local issuing partner; Paystack covers payments, not issuing. | Start with Stripe Issuing (USD) in test mode; pick an NGN issuing partner separately |
| F4 | Exposure cap for pay-through: starting cap, growth rule, and what happens after a failed charge | Low starting cap; block approvals until a failed charge is settled |
| F5 | AI provider, data retention and consent wording for AI insights | Opt-in, owner-chosen provider, no card data in prompts, insights deleted with the account |
| F6 | Which insights ship first | Price increase, new recurring merchant, unused before renewal |
| F7 | Is the Plan inbox a Pro feature? | Insights free (they show the value); accept-to-rule actions in Pro |

## 9. Out of scope

Holding customer funds directly; paying billers by bank transfer on the user's behalf (this needs the merchant-of-record decision, W3 in VortexCore's `WALLET_FUNDING_PLAN.md`); and any live-mode money movement before owner sign-off.
