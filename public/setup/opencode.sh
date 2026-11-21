#!/usr/bin/env bash
# Configure the current user's OpenCode; no sudo or global package installation.
set -euo pipefail

readonly tenvor_helper_url='https://tenvor.io/setup/opencode.py'
readonly tenvor_helper_sha256='ae2d4f74bc90b3b7a5e4abfc715e3f341181d44b7213d97a801f1e1b7ad0f02d'

if ! command -v python3 >/dev/null 2>&1 ||
   ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
  printf '%s\n' 'Tenvor setup requires Python 3.10 or newer. Install it, then run this command again.' >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  printf '%s\n' 'Tenvor setup requires curl. Install it, then run this command again.' >&2
  exit 1
fi

umask 077
tenvor_setup_dir=$(mktemp -d "${TMPDIR:-/tmp}/tenvor-opencode.XXXXXXXXXX")
trap 'rm -f -- "$tenvor_setup_dir/opencode.py"; rmdir -- "$tenvor_setup_dir"' EXIT
trap 'exit 130' HUP INT TERM

# Never execute a redirect, error page, truncated helper, or unpinned update.
curl -q --proto '=https' --tlsv1.2 --fail --silent --show-error \
  --max-time 30 --max-filesize 1048576 \
  "$tenvor_helper_url" --output "$tenvor_setup_dir/opencode.py"
python3 -I - "$tenvor_setup_dir/opencode.py" "$tenvor_helper_sha256" <<'PY'
import hashlib
import sys

with open(sys.argv[1], "rb") as helper:
    content = helper.read(1048577)
if len(content) > 1048576 or hashlib.sha256(content).hexdigest() != sys.argv[2]:
    sys.exit("Tenvor setup: downloaded helper failed SHA-256 verification; nothing was configured.")
PY

# Credentials are prompted for by Python with echo disabled, never shell args.
python3 "$tenvor_setup_dir/opencode.py" "$@"
