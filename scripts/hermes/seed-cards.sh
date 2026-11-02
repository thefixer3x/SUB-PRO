#!/usr/bin/env bash
# Seed the Hermes Kanban board with the agent cards from docs/agents/CARDS.md.
#
# Usage (from the repo root, on the machine running Hermes):
#   bash scripts/hermes/seed-cards.sh --dry-run   # print what would be created
#   bash scripts/hermes/seed-cards.sh             # create the cards
#
# Safe to re-run: cards whose title already exists on the board are skipped.
# Assignee profiles and priority numbers are configurable via env vars below.
set -euo pipefail

BUILDER="${HERMES_BUILDER:-builder}"
REVIEWER="${HERMES_REVIEWER:-reviewer}"
QA="${HERMES_QA:-qa}"
# Check `hermes kanban create --help` for your priority scale. These assume
# lower number = more urgent; swap the values if your board is the other way.
P0="${HERMES_P0:-1}"; P1="${HERMES_P1:-2}"; P2="${HERMES_P2:-3}"; P3="${HERMES_P3:-4}"

REPO_URL="https://github.com/thefixer3x/SUB-PRO"
GUIDE="$REPO_URL/blob/main/docs/agents/WORKER_GUIDE.md"
CARDS="$REPO_URL/blob/main/docs/agents/CARDS.md"

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

command -v hermes >/dev/null || { echo "hermes CLI not found on PATH" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required to read JSON output" >&2; exit 1; }

hermes kanban init >/dev/null 2>&1 || true
EXISTING="$(hermes kanban list --json 2>/dev/null || echo '[]')"

# Print the id of the first object whose title starts with the given card id.
find_id() {
  CARD="$1" python3 -c '
import json, os, sys
data = json.loads(sys.stdin.read() or "[]")
items = data.get("tasks", data.get("items", [])) if isinstance(data, dict) else data
for t in items:
    if str(t.get("title", "")).startswith(os.environ["CARD"] + ":"):
        print(t.get("id", "")); break
' <<<"$EXISTING"
}

# Card ids are kept in ID_<card> variables (macOS ships bash 3.2: no associative arrays).
set_id() { printf -v "ID_$1" "%s" "$2"; }
get_id() { local v="ID_$1"; echo "${!v:-}"; }

# create_card <card-id> <title> <assignee> <priority> <issue-number|-> <depends-on|->
create_card() {
  local cid="$1" title="$2" who="$3" pri="$4" issue="$5" dep="$6"
  local full="$cid: $title"
  local existing; existing="$(find_id "$cid")"
  if [[ -n "$existing" ]]; then
    echo "skip  $full (exists as $existing)"; set_id "$cid" "$existing"; return
  fi
  local anchor; anchor="$(echo "$cid" | tr '[:upper:]' '[:lower:]')"
  local issue_line="none"; [[ "$issue" != "-" ]] && issue_line="$REPO_URL/issues/$issue"
  local note="Goal: see $CARDS (section $cid). Issue: $issue_line. Rules: $GUIDE (read sections 2-5 before starting). Done when: as written in the card; post handoff evidence per guide section 5. Constraints: public repo, no secrets, no production writes."
  [[ "$dep" != "-" ]] && note="$note Depends on: $dep (start only after its PR is merged)."

  if (( DRY_RUN )); then
    echo "would create [$who p$pri] $full"; set_id "$cid" "DRY-$cid"; return
  fi
  local out id
  out="$(hermes kanban create "$full" --assignee "$who" --priority "$pri" --json)"
  id="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); d=d.get("task", d) if isinstance(d, dict) else d; print(d.get("id",""))' <<<"$out")"
  [[ -z "$id" ]] && { echo "could not read id for $full: $out" >&2; exit 1; }
  hermes kanban comment "$id" "$note" >/dev/null
  echo "made  $full -> $id"
  set_id "$cid" "$id"
}

link_dep() { # link_dep <parent-card> <child-card>
  local p c; p="$(get_id "$1")"; c="$(get_id "$2")"
  [[ -z "$p" || -z "$c" ]] && return
  if (( DRY_RUN )); then echo "would link $1 -> $2"; return; fi
  hermes kanban link "$p" "$c" >/dev/null && echo "link  $1 -> $2"
}

# Wave 1: security fixes in server code
create_card C01 "Require login on virtual-cards function"          "$BUILDER" "$P0" 27 -
create_card C02 "Require login on checkout + CORS allowlist"       "$BUILDER" "$P1" 28 C01
create_card C03 "Lock down Claude GitHub workflows"                "$BUILDER" "$P1" 29 -
create_card C04 "Security headers (CSP report-only)"               "$BUILDER" "$P1" 30 -
# Wave 2: make the product real
create_card C05 "Real subscriptions + dashboard data"              "$BUILDER" "$P1" 33 -
create_card C06 "One reliable Free to Pro upgrade flow"            "$BUILDER" "$P1" 34 C02
create_card C07 "Hide fake credit approvals behind flag"           "$BUILDER" "$P2" 39 -
create_card C08 "Move Splitwise/HIBP calls server-side"            "$BUILDER" "$P2" 35 C01
# Wave 3: database and platform
create_card C09 "Write live-DB permission fixes as SQL (owner applies)" "$BUILDER" "$P1" 31 C06
create_card C10 "Expo Doctor patch alignment"                      "$BUILDER" "$P2" 40 -
create_card C11 "CI supply chain: pins, Dependabot, CodeQL"        "$BUILDER" "$P2" 38 C03
create_card C12 "Retire unserved app/api routes"                   "$BUILDER" "$P2" 36 -
create_card C13 "Hardening bundle"                                 "$BUILDER" "$P3" 41 -
# Review and QA
create_card R00 "Review each agent PR against WORKER_GUIDE"        "$REVIEWER" "$P1" - -
create_card Q01 "End-to-end smoke test after Wave 2"               "$QA"      "$P1" - "C05, C06"

link_dep C01 C02
link_dep C01 C08
link_dep C02 C06
link_dep C06 C09
link_dep C03 C11
link_dep C05 Q01
link_dep C06 Q01

echo "done. Review with: hermes kanban list --json"
