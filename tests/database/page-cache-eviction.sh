#!/usr/bin/env bash
set -euo pipefail

volume="memoryscape-page-cache-test-$$"
docker volume create "$volume" >/dev/null
cleanup() {
  docker volume rm -f "$volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --rm --volume "$volume:/data" python:3.12-alpine python3 -c '
from pathlib import Path
root = Path("/data")
(root / "base" / "1").mkdir(parents=True)
(root / "global").mkdir()
(root / "base" / "1" / "16384").write_bytes(b"m" * (1024 * 1024))
(root / "global" / "pg_control").write_bytes(b"g" * 4096)
'

report="$(docker run --rm \
  --volume "$volume:/data:ro" \
  --volume "$PWD/scripts/evict-postgres-cache.py:/tmp/evict-postgres-cache.py:ro" \
  python:3.12-alpine python3 /tmp/evict-postgres-cache.py --data-directory /data)"

node -e '
const report = JSON.parse(process.argv[1]);
if (!report.success || report.filesVisited < 2 || report.bytesTargeted < 1024 * 1024) {
  throw new Error(`Unexpected page-cache eviction report: ${JSON.stringify(report)}`);
}
if (report.strategy !== "posix_fadvise_dontneed") throw new Error("Wrong cache-eviction strategy");
console.log(`Cache-eviction helper visited ${report.filesVisited} files (${report.bytesTargeted} bytes).`);
' "$report"
