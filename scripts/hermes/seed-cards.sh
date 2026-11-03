#!/usr/bin/env bash
# Seed a Hermes Kanban board with the agent cards from docs/agents/CARDS.md.
#
# Usage (on the machine running Hermes, from anywhere inside the repo):
#   bash scripts/hermes/seed-cards.sh --dry-run   # print the plan; does not touch the board
#   bash scripts/hermes/seed-cards.sh             # create the cards
#
# Safe to re-run: every card is created with a fixed --idempotency-key, so Hermes
# returns the existing card instead of making a duplicate. Each card body carries
# its full section from CARDS.md, because Hermes workers only see their own card.
# Dependencies use --parent, so a child card stays in `todo` until its parents are done.
set -euo pipefail

BUILDER="${HERMES_BUILDER:-builder}"
REVIEWER="${HERMES_REVIEWER:-reviewer}"
QA="${HERMES_QA:-qa}"
TENANT="${HERMES_TENANT:-sub-pro}"
# Hermes dispatches higher priority first (ORDER BY priority DESC; default 0).
P0="${HERMES_P0:-40}"; P1="${HERMES_P1:-30}"; P2="${HERMES_P2:-20}"; P3="${HERMES_P3:-10}"
KEY_PREFIX="${HERMES_KEY_PREFIX:-sub-pro-cards-v1}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CARDS_FILE="$ROOT/docs/agents/CARDS.md"
REPO_URL="https://github.com/thefixer3x/SUB-PRO"
GUIDE_URL="$REPO_URL/blob/main/docs/agents/WORKER_GUIDE.md"

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

# Print the CARDS.md section for a card id ("### C01: ..." up to the next heading).
card_section() {
  CARD="$1" python3 - "$CARDS_FILE" <<'PY'
import os, re, sys
text = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r"^### %s:.*?(?=^#{2,3} |\Z)" % re.escape(os.environ["CARD"]), text, re.S | re.M)
if not m:
    sys.exit("card %s not found in CARDS.md" % os.environ["CARD"])
print(m.group(0).rstrip())
PY
}

# create_card <card-id> <title> <assignee> <priority> <issue-number|-> [parent-card-id...]
create_card() {
  local cid="$1" title="$2" who="$3" pri="$4" issue="$5"; shift 5
  local full="$cid: $title" section body issue_line="none" parents=() p pid
  section="$(card_section "$cid")"
  [[ "$issue" != "-" ]] && issue_line="$REPO_URL/issues/$issue"
  body="$(printf '%s\n\nIssue: %s\nRules (read sections 2-5 before starting): %s\nPublic repo: no secrets, no production writes. Post handoff evidence per guide section 5.\n' \
    "$section" "$issue_line" "$GUIDE_URL")"

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
# Wave 1: security fixes in server code
create_card C01 "Require login on virtual-cards function"          "$BUILDER" "$P0" 27
create_card C02 "Require login on checkout + CORS allowlist"       "$BUILDER" "$P1" 28 C01
create_card C03 "Lock down Claude GitHub workflows"                "$BUILDER" "$P1" 29
create_card C04 "Security headers (CSP report-only)"               "$BUILDER" "$P1" 30
# Wave 2: make the product real
create_card C05 "Real subscriptions + dashboard data"              "$BUILDER" "$P1" 33
create_card C06 "One reliable Free to Pro upgrade flow"            "$BUILDER" "$P1" 34 C02
create_card C07 "Hide fake credit approvals behind flag"           "$BUILDER" "$P2" 39
create_card C08 "Move Splitwise/HIBP calls server-side"            "$BUILDER" "$P2" 35 C01
# Wave 3: database and platform
create_card C09 "Write live-DB permission fixes as SQL (owner applies)" "$BUILDER" "$P1" 31 C06
create_card C10 "Expo Doctor patch alignment"                      "$BUILDER" "$P2" 40
create_card C11 "CI supply chain: pins, Dependabot, CodeQL"        "$BUILDER" "$P2" 38 C03
create_card C12 "Retire unserved app/api routes"                   "$BUILDER" "$P2" 36
create_card C13 "Hardening bundle"                                 "$BUILDER" "$P3" 41
# Wave 4: Vercel migration (docs/agents/VERCEL_MIGRATION.md)
create_card M00 "Consolidate PRs #57 and #59 into one PR"          "$BUILDER" "$P0" 27
create_card M01 "Fix virtual_cards column drift on main"           "$BUILDER" "$P0" -
create_card M02 "Shared server/ module + Vercel checkout and webhook" "$BUILDER" "$P1" 28 M00 M01
create_card M03 "Port cards, banking, HIBP, Splitwise to Vercel"   "$BUILDER" "$P1" 35 M02
create_card M04 "Stripe webhook cutover to Vercel (owner)"         "$BUILDER" "$P1" 34 M02
create_card M05 "Retire Netlify"                                    "$BUILDER" "$P2" - M03 M04
# Review and QA
create_card R00 "Review each agent PR against WORKER_GUIDE"        "$REVIEWER" "$P1" -
create_card Q01 "End-to-end smoke test after Wave 2"               "$QA"      "$P1" - C05 C06

if (( DRY_RUN )); then
  echo "dry run: nothing was written to the board"
else
  echo "done. Review with: hermes kanban list --tenant $TENANT"
fi
