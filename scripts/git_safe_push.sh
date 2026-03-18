#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting git_safe_push (HTTPS, cache credentials)"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: this script must be run inside a Git repository."
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
current_dir="$(pwd)"

if [ "$repo_root" != "$current_dir" ]; then
  echo "Error: run this script from the repository root (${repo_root})."
  exit 1
fi

remote_url="$(git remote get-url origin 2>/dev/null || true)"
if [ -z "$remote_url" ]; then
  echo "Error: remote 'origin' is not configured."
  exit 1
fi

if [[ "$remote_url" != https://* ]]; then
  echo "Error: remote 'origin' is not using HTTPS (found: $remote_url)."
  echo "Please switch origin to an HTTPS URL before running this script."
  exit 1
fi

echo "==> Clearing existing credential helpers and enabling HTTPS cache"
git config --global --unset-all credential.helper >/dev/null 2>&1 || true
git config --global credential.helper 'cache --timeout=21600'

current_branch="$(git rev-parse --abbrev-ref HEAD)"
branch_suffix="$(date +%Y%m%d-%H%M%S)"
new_branch="pana/dev-onecommand-${branch_suffix}"

echo "==> Preparing to commit any working tree changes on new branch ${new_branch}"
changes="$(git status --porcelain)"

echo "==> Creating branch ${new_branch} from ${current_branch}"
git switch -c "${new_branch}"

if [ -n "$changes" ]; then
  echo "==> Staging all modifications"
  git add -A
  echo "==> Committing staged work"
  git commit -m "save: dev flow + parser updates"
else
  echo "==> Working tree is clean; no commit created."
fi

echo "==> Pushing ${new_branch} to origin via HTTPS"
if git push -u origin HEAD; then
  if [[ "$remote_url" =~ ^https://github\.com/([^/]+)/([^.]+)(\.git)?$ ]]; then
    owner="${BASH_REMATCH[1]}"
    repo="${BASH_REMATCH[2]}"
    echo "==> Push complete."
    echo "Remote branch URL: https://github.com/${owner}/${repo}/tree/${new_branch}"
  else
    echo "==> Push complete. Inspect branch '${new_branch}' on origin."
  fi
  echo
  echo "Next steps:"
  echo "  1. Verify the branch on GitHub."
  echo "  2. Open a pull request or continue working locally."
else
  echo "Error: git push failed."
  echo "Ensure you provide a GitHub Personal Access Token when prompted."
  echo "Credentials will cache for 6 hours via 'credential.helper cache'."
  exit 1
fi
