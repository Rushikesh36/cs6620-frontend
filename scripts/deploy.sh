#!/usr/bin/env bash
# Builds the site and uploads it to an S3 website bucket.
#
#   scripts/deploy.sh <bucket-name> [--dry-run] [--skip-build]
#
# - Terraform owns config.json (it holds each lab's API address), so this script never uploads,
#   overwrites or deletes it. The only thing it touches on that file is its Cache-Control header.
# - Files in _next/static/ have hashed names that change with their contents, so browsers may keep
#   them for a year. Everything else (HTML, page data) must be re-checked on every visit.
# - Needs the AWS CLI, logged in to the right account (in Learner Lab, copy the credentials first).
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/deploy.sh <bucket-name> [--dry-run] [--skip-build]

  <bucket-name>  the S3 bucket that serves the site (for example my-lab-frontend)
  --dry-run      show what would be uploaded or deleted, and change nothing
  --skip-build   upload what is already in out/ instead of building first
USAGE
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

BUCKET=""
DRY_RUN=0
SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    -h | --help) usage; exit 0 ;;
    --dry-run) DRY_RUN=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -*) usage >&2; fail "Unknown option: $arg" ;;
    *)
      [ -z "$BUCKET" ] || { usage >&2; fail "Give one bucket name only."; }
      BUCKET="$arg"
      ;;
  esac
done

[ -n "$BUCKET" ] || { usage >&2; fail "Give the bucket name."; }
# S3 bucket names: 3 to 63 characters, lower case letters, digits, dots and hyphens.
[[ "$BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || fail "'$BUCKET' is not a valid S3 bucket name."
command -v aws >/dev/null 2>&1 || fail "The AWS CLI is not installed (see https://aws.amazon.com/cli/)."

cd "$(dirname "$0")/.."
OUT_DIR="${OUT_DIR:-out}"

if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "Building the site..."
  npm run build
fi

[ -f "$OUT_DIR/index.html" ] || fail "No build found in $OUT_DIR/. Run npm run build first."

# npm run build:e2e (the end-to-end tests) fills the same folder with a build that contains the
# fake backend. It must never reach a real bucket.
if grep -rqF "mock-upload.s3.amazonaws.com" "$OUT_DIR/_next/static" 2>/dev/null; then
  fail "$OUT_DIR/ holds a build with the mock backend inside. Run npm run build (without mocks) and try again."
fi

DRY=()
if [ "$DRY_RUN" -eq 1 ]; then
  DRY=(--dryrun)
  echo "Dry run: nothing will be changed."
fi

# 1. Hashed files first, so a page can never point at a file that is not there yet.
echo "Uploading _next/static/ (cached for a year)..."
aws s3 sync "$OUT_DIR/_next/static" "s3://$BUCKET/_next/static" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  ${DRY[@]+"${DRY[@]}"}

# 2. Everything else. config.json is excluded, so it is neither uploaded nor deleted.
#    mockServiceWorker.js and config.example.json are development files.
echo "Uploading pages and everything else (checked again on every visit)..."
aws s3 sync "$OUT_DIR" "s3://$BUCKET" \
  --delete \
  --cache-control "no-cache" \
  --exclude "_next/static/*" \
  --exclude "config.json" \
  --exclude "config.example.json" \
  --exclude "mockServiceWorker.js" \
  ${DRY[@]+"${DRY[@]}"}

# 3. config.json is replaced whenever Terraform runs, so a browser must never keep an old copy.
if aws s3api head-object --bucket "$BUCKET" --key config.json >/dev/null 2>&1; then
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "Would set Cache-Control: no-cache on config.json."
  else
    echo "Setting Cache-Control: no-cache on config.json..."
    aws s3 cp "s3://$BUCKET/config.json" "s3://$BUCKET/config.json" \
      --metadata-directive REPLACE \
      --cache-control "no-cache" \
      --content-type "application/json"
    echo "(Terraform should set the same Cache-Control, or the next terraform apply will remove it.)"
  fi
else
  echo "Note: s3://$BUCKET/config.json does not exist yet. Terraform must create it, or the site shows a configuration error."
fi

echo "Done: s3://$BUCKET"
