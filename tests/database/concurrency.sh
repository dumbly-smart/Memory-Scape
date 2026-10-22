#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a disposable MemoryScape database}"

concurrency=${CONCURRENCY_COUNT:-8}
if ! [[ "$concurrency" =~ ^[1-9][0-9]*$ ]] || (( concurrency > 32 )); then
  echo 'CONCURRENCY_COUNT must be an integer from 1 to 32' >&2
  exit 2
fi

memory_id=$(psql "$DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c \
  "INSERT INTO memories(title,occurred_at,strength,decay_rate,last_strength_at) VALUES('Concurrent reinforcement contract',now(),0.5,0,now()) RETURNING id")
cleanup() {
  psql "$DATABASE_URL" -Xq -v ON_ERROR_STOP=1 -c "DELETE FROM memories WHERE id='$memory_id'" >/dev/null || true
}
trap cleanup EXIT

pids=()
for ((index=0; index<concurrency; index++)); do
  psql "$DATABASE_URL" -Xq -v ON_ERROR_STOP=1 -c \
    "BEGIN; SELECT reinforce_memory('$memory_id',0.2,'concurrency_contract'); SELECT pg_sleep(0.03); COMMIT" \
    >/dev/null &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done

expected="(1.0 - 0.5 * power(0.8, ${concurrency}))"
psql "$DATABASE_URL" -Xq -v ON_ERROR_STOP=1 -c \
  "DO \$\$ BEGIN
    IF abs((SELECT strength FROM memories WHERE id='$memory_id')-${expected})>1e-9 THEN
      RAISE EXCEPTION 'concurrent reinforcements lost an update';
    END IF;
    IF (SELECT count(*) FROM memory_reinforcements WHERE memory_id='$memory_id')<>${concurrency} THEN
      RAISE EXCEPTION 'reinforcement history count mismatch';
    END IF;
  END \$\$"
echo "Concurrent reinforcement contract passed: ${concurrency} sessions preserved every strength update and history event."
