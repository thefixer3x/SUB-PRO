# Proposed database changes

These SQL files are **not migrations and are not applied automatically**.
Each file is written for review, and the project owner applies it to the
live Supabase project.

| File | Card | Status |
| --- | --- | --- |
| `2026-11-sm-permissions.sql` | S401 / C09 (#31) | **Superseded** — migration applied at `migrations/20261107000000_s401_permissions.sql` |
| `2026-11-sm-permissions.rollback.sql` | Rollback for the file above | Use only to undo it |

## 2026-11-sm-permissions.sql

The file's header lists each change and the live state it replaces. In short:

1. **Feature-flag function:** `sm_update_feature_flag` runs with elevated privileges (`SECURITY DEFINER`), and anyone could execute it. After this change only the service role can.
2. **`virtual_cards`:** owners can read their own card rows. Only the service role writes them (card creation and the Stripe webhook already use it).
3. **`sm_subscriptions`:** owners keep add, edit and delete on their own rows. The app writes this table from the client, so the card's "SELECT only" would break it. The `FOR ALL` policy becomes four per-command policies for `authenticated`, each with an explicit owner check.
4. **`profiles` billing fields:** a trigger stops client roles from changing `subscription_tier` and `stripe_customer_id`. The Stripe webhooks use the service role and are unaffected. A client-side profile insert gets the default values.
5. **`anon`:** loses its direct table access to `sm_subscriptions` and `virtual_cards`.

### Before applying
- Confirm the app has no client code path that writes `virtual_cards`, or the billing fields on `profiles`. As of 2026-11-06 there is none in SubTrack Pro or VortexCore.

### Test it locally first
`test/` holds a minimal stand-in for the live state, behaviour checks, and a runner. The runner applies the change, checks it, applies the rollback, and confirms the original grants and policies come back. Use a throwaway local Postgres, never a real project:

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres supabase/proposed/test/run.sh
```

The expected output is `ALL CHECKS PASSED` followed by `ROLLBACK RESTORES ORIGINAL STATE`.

### Apply
In the Supabase SQL editor, run the whole file once; it is a single transaction. Then run the read-only checks at the bottom of the file, and in the app:

- add, edit and delete a subscription;
- edit your profile name;
- run a test-mode checkout and confirm the plan changes.

### Roll back
Run `2026-11-sm-permissions.rollback.sql`. It restores the exact previous grants and policies.
