#!/usr/bin/env bash
# Runs the proposed SQL and its rollback against a throwaway local database.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres supabase/proposed/test/run.sh
# Never point this at a real project: it creates and drops a scratch database.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db="sm_permissions_test_$$"
createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT
q() { psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@" 2> >(grep -v "NOTICE" >&2); }

q -f "$here/fixture.sql"
q -f "$here/../../migrations/20261107000000_s401_permissions.sql"
q -f "$here/checks.sql" -tA | tail -1

# The rollback must restore the original policies and grants exactly.
snapshot() {
  q -tA -c "select tablename||'|'||policyname||'|'||cmd||'|'||roles::text||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'')
            from pg_policies where tablename in ('sm_subscriptions','virtual_cards','profiles') order by 1;
            select (select string_agg(a::text, ',' order by a::text) from unnest(proacl) a) from pg_proc where proname = 'sm_update_feature_flag';
            select relname||'|'||(select string_agg(a::text, ',' order by a::text) from unnest(relacl) a)
              from pg_class where relname in ('sm_subscriptions','virtual_cards') order by 1;
            select count(*) from pg_trigger where tgname = 'trg_profiles_protect_billing';"
}
fresh="sm_permissions_fresh_$$"
createdb "$fresh"; trap 'dropdb --if-exists "$db"; dropdb --if-exists "$fresh"' EXIT
before="$(psql -X -q -v ON_ERROR_STOP=1 -d "$fresh" -f "$here/fixture.sql" >/dev/null && db="$fresh" snapshot)"
q -f "$here/../../rollbacks/20261107000000_s401_permissions.rollback.sql"
after="$(snapshot)"
if [ "$before" = "$after" ]; then echo "ROLLBACK RESTORES ORIGINAL STATE"; else
  echo "ROLLBACK DIFFERS:"; diff <(echo "$before") <(echo "$after") || true; exit 1; fi

bash "$here/run-baseline.sh"
