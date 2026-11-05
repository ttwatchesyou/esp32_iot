#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/firmware"
CLI="${ARDUINO_CLI:-arduino-cli}"
mkdir -p "$OUT"

for board in esp32 esp32s3 esp32c3 esp32c6; do
  build="$(mktemp -d)"
  trap 'rm -rf "$build"' EXIT
  "$CLI" compile --jobs 1 --fqbn "esp32:esp32:$board" --output-dir "$build" "$ROOT/firmware/universal"
  merged="$(find "$build" -maxdepth 1 -name '*.merged.bin' -print -quit)"
  if [[ -z "$merged" ]]; then
    echo "Missing merged binary for $board" >&2
    exit 1
  fi
  python3 - "$merged" "$OUT/$board.merged.bin" <<'PY'
from pathlib import Path
import sys

data = Path(sys.argv[1]).read_bytes()
end = len(data)
while end and data[end - 1] == 0xff:
    end -= 1
end = min(len(data), ((end + 4095) // 4096) * 4096)
Path(sys.argv[2]).write_bytes(data[:end])
PY
  rm -rf "$build"
  trap - EXIT
  echo "Built $OUT/$board.merged.bin"
done
