#!/usr/bin/env bash
# deploy.sh — Build and push the recipe site to GitHub Pages
#
# Usage:
#   ./deploy.sh                        # Auto-commit message: "Update recipes (YYYY-MM-DD)"
#   ./deploy.sh "Add gochujang salmon" # Custom commit message
#
# Requirements: git, python3, pyyaml (pip install pyyaml)

set -e  # Exit immediately on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── 1. Build recipes.json ──────────────────────────────────────
echo "Building recipes.json..."
python3 build.py

# ── 2. Stage all changes ──────────────────────────────────────
git add -A

# ── 3. Commit (skip if nothing changed) ───────────────────────
if git diff --cached --quiet; then
  echo "Nothing to commit — already up to date."
else
  COMMIT_MSG="${1:-Update recipes ($(date '+%Y-%m-%d'))}"
  git commit -m "$COMMIT_MSG"
  echo "Committed: $COMMIT_MSG"
fi

# ── 4. Push ────────────────────────────────────────────────────
echo "Pushing to GitHub..."
git push

echo ""
echo "Done! Site will update at https://elee03.github.io/recipes in ~30 seconds."
