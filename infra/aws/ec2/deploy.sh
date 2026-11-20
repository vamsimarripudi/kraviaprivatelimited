#!/usr/bin/env bash
# Approved, manual deployment of a reviewed main-branch commit on EC2.
set -Eeuo pipefail
umask 077
SHA="${1:-}"
if [[ ! "$SHA" =~ ^[a-f0-9]{40}$ ]]; then
  echo '40-character commit SHA required' >&2
  exit 2
fi
if [[ "${EUID}" -ne 0 ]]; then
  echo 'Root execution through SSM Run Command required' >&2
  exit 2
fi
exec 9>/run/lock/kravia-office-deploy.lock
flock -n 9 || { echo 'Another KRAVIA deployment is active' >&2; exit 1; }

ROOT=/opt/kravia/repo
if [[ ! -d "$ROOT/.git" ]]; then
  echo 'Missing /opt/kravia/repo; bootstrap instance first' >&2
  exit 1
fi
cd "$ROOT"
PREVIOUS_SHA="$(git rev-parse HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Refusing deployment from a dirty host checkout' >&2
  exit 1
fi
git fetch origin main --quiet
git cat-file -e "${SHA}^{commit}"
git merge-base --is-ancestor "$SHA" origin/main || {
  echo 'Refusing unreviewed commit not on origin/main' >&2
  exit 1
}
git checkout --detach --force "$SHA" --quiet
test "$(stat -c '%a' /etc/kravia)" = "700"
test "$(stat -c '%a' /etc/kravia/api.env)" = "600"
test "$(stat -c '%a' /etc/kravia/worker.env)" = "600"
# Backup, compatibility and staging checks are required before approving
# the production GitHub Environment that authorizes this operation.
python3 infra/aws/ec2/ssm_to_env.py --region ap-south-2
COMPOSE=(docker compose -f infra/aws/ec2/compose.yaml)
"${COMPOSE[@]}" version >/dev/null
"${COMPOSE[@]}" build api worker
"${COMPOSE[@]}" up -d clamav
"${COMPOSE[@]}" run --rm --no-deps api sh -c \
  'alembic upgrade head && python -c "from backend.main import initialize_database; initialize_database()"'
"${COMPOSE[@]}" up -d api worker

for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1:8000/health/live >/dev/null 2>&1; then
    echo "EC2 health passed for $SHA (previous $PREVIOUS_SHA)"
    exit 0
  fi
  sleep 2
done
echo 'EC2 liveness failed; retain Railway fallback' >&2
exit 1
