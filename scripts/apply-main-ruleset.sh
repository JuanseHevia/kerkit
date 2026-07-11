#!/usr/bin/env bash
#
# apply-main-ruleset.sh — apply (or update) the `main` branch-protection ruleset.
#
# This is a LAUNCH-STEP helper for the maintainer. It changes repository
# settings and therefore needs a token with admin rights on the repo, so it is
# NOT run by CI and NOT run automatically. Run it by hand, once, around the
# public-visibility flip. See docs/public-launch-runbook.md.
#
# Usage:
#   scripts/apply-main-ruleset.sh            # create or update the ruleset
#   DRY_RUN=1 scripts/apply-main-ruleset.sh  # print what would happen, change nothing
#
# Requires: gh (authenticated with a repo-admin token) and jq.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULESET_FILE="$REPO_ROOT/.github/rulesets/main-branch-protection.json"

command -v gh >/dev/null 2>&1 || { echo "error: gh (GitHub CLI) is required." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "error: jq is required." >&2; exit 1; }
[ -f "$RULESET_FILE" ] || { echo "error: ruleset file not found: $RULESET_FILE" >&2; exit 1; }

# Resolve owner/repo from the gh context (falls back to the origin remote).
REPO_SLUG="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
RULESET_NAME="$(jq -r .name "$RULESET_FILE")"

echo "Repository : $REPO_SLUG"
echo "Ruleset    : $RULESET_NAME"
echo "Source     : $RULESET_FILE"
echo

# Is there already a ruleset with this name? If so, update it in place.
EXISTING_ID="$(gh api "repos/$REPO_SLUG/rulesets" --jq \
  ".[] | select(.name == \"$RULESET_NAME\") | .id" 2>/dev/null || true)"

if [ -n "${DRY_RUN:-}" ]; then
  if [ -n "$EXISTING_ID" ]; then
    echo "DRY_RUN: would PUT repos/$REPO_SLUG/rulesets/$EXISTING_ID (update existing)."
  else
    echo "DRY_RUN: would POST repos/$REPO_SLUG/rulesets (create new)."
  fi
  echo "DRY_RUN: no changes made."
  exit 0
fi

if [ -n "$EXISTING_ID" ]; then
  echo "Updating existing ruleset #$EXISTING_ID ..."
  gh api --method PUT "repos/$REPO_SLUG/rulesets/$EXISTING_ID" --input "$RULESET_FILE"
else
  echo "Creating ruleset ..."
  gh api --method POST "repos/$REPO_SLUG/rulesets" --input "$RULESET_FILE"
fi

echo
echo "Done. Verify in Settings → Rules → Rulesets, or with:"
echo "  gh api repos/$REPO_SLUG/rulesets --jq '.[].name'"
