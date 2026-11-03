#!/usr/bin/env bash
# Seed a Hermes Kanban board with the sprint cards from docs/agents/EXECUTION_PLAN.md.
# (CARDS.md is history; its open work was folded into the plan.)
#
# Usage (on the machine running Hermes, from anywhere inside the repo):
#   bash scripts/hermes/seed-cards.sh --dry-run   # print the plan; does not touch the board
#   bash scripts/hermes/seed-cards.sh             # create the cards
#
# Safe to re-run: every card is created with a fixed --idempotency-key, so Hermes
# returns the existing card instead of making a duplicate. Each card body carries
# its full section from EXECUTION_PLAN.md, because Hermes workers only see their own card.
# Dependencies use --parent, so a child card stays in `todo` until its parents are done.
set -euo pipefail

BUILDER="${HERMES_BUILDER:-builder}"
REVIEWER="${HERMES_REVIEWER:-reviewer}"
QA="${HERMES_QA:-qa}"
TENANT="${HERMES_TENANT:-sub-pro}"
# Hermes dispatches higher priority first (ORDER BY priority DESC; default 0).
P0="${HERMES_P0:-40}"; P1="${HERMES_P1:-30}"; P2="${HERMES_P2:-20}"; P3="${HERMES_P3:-10}"
KEY_PREFIX="${HERMES_KEY_PREFIX:-sub-pro-exec-v2}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CARDS_FILE="$ROOT/docs/agents/EXECUTION_PLAN.md"
REPO_URL="https://github.com/thefixer3x/SUB-PRO"
GUIDE_URL="$REPO_URL/blob/main/docs/agents/WORKER_GUIDE.md"
PLAN_URL="$REPO_URL/blob/main/docs/agents/EXECUTION_PLAN.md"

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }
[[ -f "$CARDS_FILE" ]] || { echo "missing $CARDS_FILE" >&2; exit 1; }
if (( ! DRY_RUN )); then
  command -v hermes >/dev/null || { echo "hermes CLI not found on PATH" >&2; exit 1; }
  hermes kanban init >/dev/null
fi

# Card ids are kept in ID_<card> variables (macOS ships bash 3.2: no associative arrays).
set_id() { printf -v "ID_$1" "%s" "$2"; }
get_id() { local v="ID_$1"; echo "${!v:-}"; }

# Print the plan section for a card id ("### S101: ..." up to the next heading).
card_section() {
  CARD="$1" python3 - "$CARDS_FILE" <<'PY'
import os, re, sys
text = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r"^### %s:.*?(?=^#{2,3} |\Z)" % re.escape(os.environ["CARD"]), text, re.S | re.M)
if not m:
    sys.exit("card %s not found in %s" % (os.environ["CARD"], sys.argv[1]))
print(m.group(0).rstrip())
PY
}

# create_card <card-id> <title> <assignee> <priority> <issue-number|-> [parent-card-id...]
create_card() {
  local cid="$1" title="$2" who="$3" pri="$4" issue="$5"; shift 5
  local full="$cid: $title" section body issue_line="none" parents=() p pid
  section="$(card_section "$cid")"
  [[ "$issue" != "-" ]] && issue_line="$REPO_URL/issues/$issue"
  body="$(printf '%s\n\nIssue: %s\nRunbook (sections 0-3 and the Definition of done apply to every card): %s\nRules (read sections 2-5 before starting): %s\nPublic repo: no secrets, no production writes. Never merge: the orchestrator reviews and merges.\n' \
    "$section" "$issue_line" "$PLAN_URL" "$GUIDE_URL")"

  for p in "$@"; do
    pid="$(get_id "$p")"
    [[ -z "$pid" ]] && { echo "parent $p of $cid has no id yet; check card order" >&2; exit 1; }
    parents+=(--parent "$pid")
  done

  if (( DRY_RUN )); then
    echo "would create [$who prio=$pri${*:+ parents=$*}] $full"
    set_id "$cid" "DRY-$cid"; return
  fi
  local out id
  out="$(hermes kanban create "$full" --body "$body" --assignee "$who" --priority "$pri" \
    --tenant "$TENANT" --idempotency-key "$KEY_PREFIX-$cid" ${parents[@]+"${parents[@]}"} --json)"
  id="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); d=d.get("task", d); print(d.get("id",""))' <<<"$out")"
  [[ -z "$id" ]] && { echo "could not read id for $full: $out" >&2; exit 1; }
  echo "ok    $full -> $id"
  set_id "$cid" "$id"
}

# Order matters: parents are created before their children.
# Owner decisions (D1-D3, A1-A5) are not cards: workers check the decisions log in the plan.
# S402 (webhook cutover) is owner work and is not seeded.
# Sprint 1: stop showing fake or unsafe things (parallel)
create_card S101 "Sign Out in Settings"                               "$BUILDER" "$P1" -
create_card S102 "Shared Groups: own feature gate and real share flow" "$BUILDER" "$P1" -
create_card S103 "Virtual Cards screen shows no invented card data"   "$BUILDER" "$P0" -
create_card S104 "Finish C07 embedded credit flag"                    "$BUILDER" "$P2" 39
# Sprint 2: payments on Vercel (serial)
create_card S201 "server/ module + Vercel checkout and webhook"       "$BUILDER" "$P0" 28
create_card S202 "One Free to Pro upgrade flow"                       "$BUILDER" "$P1" 34 S201
create_card S203 "Port cards, banking, HIBP, Splitwise to Vercel"     "$BUILDER" "$P1" 35 S201
# Sprint 3: real data (parallel with Sprint 2 where no parent)
create_card S301 "Real subscriptions and dashboard"                   "$BUILDER" "$P1" 33
create_card S302 "Settings: real user, working rows, saved prefs"     "$BUILDER" "$P2" - S101
create_card S303 "Analytics built on real data"                       "$BUILDER" "$P2" - S301
create_card S304 "Real virtual-card management"                       "$BUILDER" "$P1" - S203 S103
# Sprint 4: database, QA, retirement
create_card S401 "Live-DB permission fixes as SQL (owner applies)"    "$BUILDER" "$P1" 31 S202
create_card S403 "End-to-end smoke and layout screenshots"            "$QA"      "$P1" - S202 S301
create_card S404 "Retire Netlify (after owner cutover + 7 days)"      "$BUILDER" "$P2" - S203 S403
# Review
create_card R00 "Review each agent PR against the plan's review gate" "$REVIEWER" "$P1" -

if (( DRY_RUN )); then
  echo "dry run: nothing was written to the board"
else
  echo "done. Review with: hermes kanban list --tenant $TENANT"
fi
