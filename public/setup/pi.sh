#!/usr/bin/env bash
# Configure the current user's Pi; no sudo and no global package installation.
# Pi's own installer runs only if you answer yes, and only from a copy pinned by SHA-256.
set -euo pipefail

readonly tenvor_helper_url='https://tenvor.io/setup/pi.py'
readonly tenvor_helper_sha256='b862fbe20c8c171807f427b691cefb53fefe29b41cb069105390381ece436fb9'

if ! command -v python3 >/dev/null 2>&1 ||
   ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 8))'; then
  printf '%s\n' 'Tenvor setup requires Python 3.8 or newer. Install it, then run this command again.' >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  printf '%s\n' 'Tenvor setup requires curl. Install it, then run this command again.' >&2
  exit 1
fi

umask 077
tenvor_setup_dir=$(mktemp -d "${TMPDIR:-/tmp}/tenvor-pi.XXXXXXXXXX")
trap 'rm -f -- "$tenvor_setup_dir/pi.py"; rmdir -- "$tenvor_setup_dir"' EXIT
trap 'exit 130' HUP INT TERM

# Never execute a redirect, error page, truncated helper, or unpinned update.
curl -q --proto '=https' --tlsv1.2 --fail --silent --show-error \
  --max-time 30 --max-filesize 1048576 \
  "$tenvor_helper_url" --output "$tenvor_setup_dir/pi.py"
python3 - "$tenvor_setup_dir/pi.py" "$tenvor_helper_sha256" <<'PY'
import hashlib
import sys

with open(sys.argv[1], "rb") as helper:
    content = helper.read(1048577)
if len(content) > 1048576 or hashlib.sha256(content).hexdigest() != sys.argv[2]:
    sys.exit(
        "Tenvor setup: downloaded helper failed SHA-256 verification; nothing was configured. "
        "If you saved this launcher a while ago it may be out of date, because the helper it checks for "
        "has been replaced. Download the launcher again with "
        "'curl -fsS https://tenvor.io/setup/pi.sh -o tenvor-pi.sh' and run it again."
    )
PY

# Credentials are prompted for by Python with echo disabled, never shell args.
python3 "$tenvor_setup_dir/pi.py" "$@"
