#!/usr/bin/env bash
#
# release.sh — publish a new release.
#
# It reads the latest published version from the remote tags, computes the next
# version using the "<year>.<month>.<sequence>" scheme and pushes the tag. The
# pushed tag triggers the "release-artifact" GitHub Actions workflow, which
# builds dist/cncjs and attaches it to the GitHub Release.
#
# Version scheme: <year>.<month>.<sequence>
#   - the sequence resets to 1 whenever the year or month changes
#   - example: 2026.10.1, 2026.10.2, 2026.11.1
#
# Usage:
#   ./release.sh [remote] [--dry-run] [--yes]
#
#   remote      git remote to read tags from and push to (default: origin)
#   --dry-run   compute and print the next version without tagging
#   -y, --yes   skip the confirmation prompt
#
# Environment overrides (mainly for testing):
#   RELEASE_YEAR, RELEASE_MONTH

set -euo pipefail

REMOTE="origin"
DRY_RUN=false
ASSUME_YES=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    -y|--yes) ASSUME_YES=true ;;
    -*)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
    *) REMOTE="$arg" ;;
  esac
done

year="${RELEASE_YEAR:-$(date +%Y)}"
month_raw="${RELEASE_MONTH:-$(date +%m)}"
month=$((10#$month_raw)) # strip a leading zero (e.g. 08 -> 8)

if ! git ls-remote --exit-code "$REMOTE" HEAD >/dev/null 2>&1; then
  echo "ERROR: cannot reach remote '${REMOTE}'." >&2
  exit 1
fi

# All published versions, read from the remote tags (v<year>.<month>.<seq>).
versions="$(
  git ls-remote --tags --refs "$REMOTE" 2>/dev/null \
    | awk -F/ '{print $NF}' \
    | sed 's/^v//' \
    | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' \
    | sort -t. -k1,1n -k2,2n -k3,3n \
    || true
)"
latest="$(echo "$versions" | tail -n 1)"

# Next sequence for the target <year>.<month>.
current_seq="$(
  echo "$versions" \
    | grep -E "^${year}\.${month}\.[0-9]+$" \
    | awk -F. '{print $3}' \
    | sort -n \
    | tail -n 1 \
    || true
)"
if [ -n "$current_seq" ]; then
  seq=$((current_seq + 1))
else
  seq=1
fi

version="${year}.${month}.${seq}"
tag="v${version}"

echo "Latest published version : ${latest:-<none>}"
echo "Next version             : ${version}  (tag: ${tag})"

if [ "$DRY_RUN" = true ]; then
  echo "(dry-run) not tagging."
  exit 0
fi

# A release must be built from the committed state.
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree has uncommitted changes. Commit or stash first." >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
  echo "ERROR: tag ${tag} already exists locally." >&2
  exit 1
fi

if [ "$ASSUME_YES" != true ]; then
  read -r -p "Create and push ${tag} to '${REMOTE}'? [y/N] " reply
  case "$reply" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

git tag "$tag"
git push "$REMOTE" "$tag"

echo "Pushed ${tag} to '${REMOTE}'. The 'release-artifact' workflow will build and publish the release asset."
