#!/usr/bin/env python3
"""Add or remove Tenvor in a user's global OpenCode configuration.

The installer deliberately keeps the API key outside opencode.json and reads
the current model limits from Tenvor's public catalog before writing anything.
It uses only Python's standard library. On native Windows it makes the same
changes but never installs or upgrades OpenCode itself.
"""

from __future__ import annotations

import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time
import warnings
from datetime import datetime, timezone
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, url2pathname, urlopen

if os.name == "nt":
    import msvcrt
else:
    msvcrt = None  # type: ignore[assignment]


API_BASE = "https://orchestrator.tenvor.io"
CATALOG_URL = f"{API_BASE}/api/catalog/public"
MODEL_ID = "chat-35b-moe"
MODEL_REF = f"tenvor/{MODEL_ID}"
AGENT_ID = "tenvor-agent"
STATE_FILENAME = ".tenvor-opencode-state.json"
STATE_VERSION = 2
TESTED_OPENCODE_VERSION = "1.19.0"
# Official V1 installer, reviewed at its immutable upstream commit.
OPENCODE_INSTALLER_URL = (
    "https://raw.githubusercontent.com/anomalyco/opencode/"
    "ef2880f379129aa048be9e9353e30aa168d42c17/install"
)
OPENCODE_INSTALLER_SHA256 = "fc3c1b2123f49b6df545a7622e5127d21cd794b15134fc3b66e1ca49f7fb297e"
MAX_CATALOG_BYTES = 1024 * 1024
MAX_CONFIG_BYTES = 1024 * 1024
CACHE_PLUGIN_URL = "https://tenvor.io/setup/tenvor-session-kv-plugin.mjs"
CACHE_PLUGIN_SHA256 = "de4311f8d4bef789fb8f9335ddc4fe9f586bc25e648b6ef8fffe716d37c769f0"
CACHE_PLUGIN_FILENAME = "tenvor-session-kv-plugin.mjs"
CACHE_STATE_FILENAME = ".tenvor-opencode-cache-state.json"
MAX_PLUGIN_BYTES = 256 * 1024

# Native Windows has no POSIX permission bits, owners, process groups or (before Python 3.13) os.fchmod. The
# helper skips those checks there. Files under the user's profile already carry the profile's access list (the
# user, SYSTEM and Administrators), which is also how OpenCode itself stores credentials on Windows.
_WINDOWS = os.name == "nt"
# The only launcher names ever run on Windows. npm creates opencode.cmd; Scoop, Chocolatey, WinGet and the
# release archive provide opencode.exe. The extensionless npm file is a Bash script and is deliberately ignored.
_WINDOWS_LAUNCHERS = ("opencode.exe", "opencode.cmd")
_RETRIES_FOR_BUSY_FILES = 6


class SetupError(RuntimeError):
    """A safe, user-actionable setup failure."""


def _bounded_positive_int(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise SetupError(f"The public catalog returned an invalid {field}.")
    if value > 16_777_216:
        raise SetupError(f"The public catalog returned an implausible {field}.")
    return value


# The levels OpenCode offers as variants. Tenvor also takes "max" (no thinking limit) and "xhigh"; both are left
# to API callers because a variant list this short is what a person can tell apart.
THINKING_VARIANTS = ("low", "medium", "high")


def advertises_thinking(sku: dict[str, Any]) -> bool:
    """True only when the catalog says the server takes reasoning_effort and offers the levels used here.

    The same object is published as data[].tenvor.reasoning by /v1/models. A server that does not publish it
    (an older one) must not be sent reasoning_effort: it refuses any field it does not know."""
    advert = sku.get("reasoning")
    if not isinstance(advert, dict) or advert.get("supported") is not True or advert.get("parameter") != "reasoning_effort":
        return False
    levels = advert.get("levels")
    if not isinstance(levels, list):
        return False
    offered = {level.get("id") for level in levels if isinstance(level, dict)}
    return {"none", *THINKING_VARIANTS} <= offered


def validate_catalog(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get("skus"), list):
        raise SetupError("The public catalog response is not in the expected format.")

    model = next(
        (
            sku
            for sku in payload["skus"]
            if isinstance(sku, dict)
            and sku.get("tag") == MODEL_ID
            and sku.get("availability") == "available"
        ),
        None,
    )
    if model is None:
        raise SetupError(f"{MODEL_ID} is not currently available in the public catalog.")

    context = _bounded_positive_int(model.get("max_context_tokens"), "context limit")
    output = _bounded_positive_int(model.get("max_output_tokens"), "output limit")
    if output > context:
        raise SetupError("The public catalog output limit exceeds its context limit.")

    display_name = model.get("display_name")
    if not isinstance(display_name, str) or not display_name.strip() or len(display_name) > 160:
        raise SetupError("The public catalog returned an invalid model display name.")

    return {
        "display_name": display_name.strip(),
        "context": context,
        "output": output,
        "reasoning": advertises_thinking(model),
    }


def fetch_catalog_model() -> dict[str, Any]:
    request = Request(
        CATALOG_URL,
        headers={"Accept": "application/json", "User-Agent": "Tenvor-OpenCode-Setup/1"},
    )
    try:
        with urlopen(request, timeout=15) as response:
            if response.status != 200:
                raise SetupError(f"The public catalog returned HTTP {response.status}.")
            raw = response.read(MAX_CATALOG_BYTES + 1)
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise SetupError(f"Could not read Tenvor's public catalog: {exc}") from exc

    if len(raw) > MAX_CATALOG_BYTES:
        raise SetupError("The public catalog response exceeded the safety limit.")
    try:
        return validate_catalog(json.loads(raw))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise SetupError("The public catalog did not return valid JSON.") from exc


def resolve_config_directory() -> Path:
    explicit = os.environ.get("OPENCODE_CONFIG_DIR", "").strip()
    if explicit:
        directory = Path(os.path.expanduser(explicit))
    else:
        xdg = os.environ.get("XDG_CONFIG_HOME", "").strip()
        directory = Path(os.path.expanduser(xdg)) if xdg else Path.home() / ".config"
        directory = directory / "opencode"
    if not directory.is_absolute():
        raise SetupError("The OpenCode configuration directory must be an absolute path.")
    return directory


def validate_api_key(value: str) -> str:
    key = value.strip()
    if not key.startswith("sk-dc-"):
        raise SetupError("That does not look like a Tenvor API key (expected sk-dc-…).")
    if len(key) > 4096 or "\n" in key or "\r" in key or "\0" in key:
        raise SetupError("The Tenvor API key has an invalid length or format.")
    return key


def read_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    if path.is_symlink():
        raise SetupError(f"Refusing to replace symlinked configuration: {path}")
    if not path.is_file():
        raise SetupError(f"OpenCode configuration is not a regular file: {path}")
    if path.stat().st_size > MAX_CONFIG_BYTES:
        raise SetupError("OpenCode configuration exceeds the 1 MiB safety limit.")
    try:
        # Windows editors and PowerShell 5.1 can save UTF-8 with a byte order mark, which strict JSON rejects.
        value = json.loads(path.read_text(encoding="utf-8-sig" if _WINDOWS else "utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise SetupError(
            f"{path} is not strict JSON. The installer left it untouched; "
            "use the manual JSONC instructions instead."
        ) from exc
    if not isinstance(value, dict):
        raise SetupError("The OpenCode configuration root must be a JSON object.")
    return value


def _apply_mode(descriptor: int, mode: int) -> None:
    """Apply POSIX permission bits. Windows has none, so the folder's access list stays in force."""
    if not _WINDOWS:
        os.fchmod(descriptor, mode)


def _has_private_mode(path: Path) -> bool:
    """True when the file is already mode 600. Windows has no mode bits to compare, so it always is."""
    return _WINDOWS or stat.S_IMODE(path.stat().st_mode) == 0o600


def _retry_if_busy(operation: Callable[[], None]) -> None:
    """Run one file operation. Windows briefly refuses to replace or delete a file that a virus scanner or
    indexer has just opened, so only there is a short, bounded wait and retry worth having."""
    delay = 0.05
    for attempt in range(_RETRIES_FOR_BUSY_FILES):
        try:
            operation()
            return
        except PermissionError:
            if not _WINDOWS or attempt == _RETRIES_FOR_BUSY_FILES - 1:
                raise
            time.sleep(delay)
            delay *= 2


def _replace(source: Path, destination: Path) -> None:
    # os.replace, never os.rename: on Windows rename refuses an existing destination.
    _retry_if_busy(lambda: os.replace(source, destination))


def _delete(path: Path) -> None:
    _retry_if_busy(lambda: path.unlink(missing_ok=True))


def _stage_write(path: Path, data: bytes, mode: int) -> Path:
    # mkstemp opens the file in binary mode (O_BINARY on Windows), so no line endings are translated.
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.tenvor-", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        _apply_mode(descriptor, mode)
        with os.fdopen(descriptor, "wb") as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        return temporary
    except BaseException:
        try:
            os.close(descriptor)
        except OSError:
            pass
        _delete(temporary)
        raise


def _atomic_write(path: Path, data: bytes, mode: int) -> None:
    temporary = _stage_write(path, data, mode)
    try:
        _replace(temporary, path)
    except BaseException:
        _delete(temporary)
        raise


def _snapshot(path: Path) -> tuple[bytes, int] | None:
    if path.is_symlink():
        raise SetupError(f"Refusing to modify symlinked managed path: {path}")
    if not path.exists():
        return None
    if not path.is_file():
        raise SetupError(f"Managed path is not a regular file: {path}")
    return path.read_bytes(), stat.S_IMODE(path.stat().st_mode)


def _restore_snapshots(snapshots: dict[Path, tuple[bytes, int] | None]) -> None:
    writes = [(path, data, mode) for path, snapshot in snapshots.items()
              if snapshot is not None for data, mode in [snapshot]]
    deletes = [path for path, snapshot in snapshots.items() if snapshot is None]
    _transactional_update(writes, deletes)


def _transactional_update(
    writes: list[tuple[Path, bytes, int]], deletes: list[Path] | None = None
) -> None:
    deletes = deletes or []
    targets = [path for path, _, _ in writes] + deletes
    if len(targets) != len(set(targets)):
        raise SetupError("The managed update contains a duplicate path.")

    snapshots = {path: _snapshot(path) for path in targets}
    staged: list[tuple[Path, Path]] = []
    try:
        for path, data, mode in writes:
            staged.append((path, _stage_write(path, data, mode)))
    except BaseException:
        for _, temporary in staged:
            _delete(temporary)
        raise

    try:
        for path, temporary in staged:
            _replace(temporary, path)
        for path in deletes:
            _delete(path)
    except BaseException as exc:
        rollback_errors: list[str] = []
        for path, snapshot in snapshots.items():
            try:
                if snapshot is None:
                    _delete(path)
                else:
                    data, mode = snapshot
                    _atomic_write(path, data, mode)
            except BaseException as rollback_exc:
                rollback_errors.append(f"{path}: {rollback_exc}")
        for _, temporary in staged:
            _delete(temporary)
        if rollback_errors:
            raise SetupError(
                "The managed update failed and automatic rollback was incomplete: "
                + "; ".join(rollback_errors)
            ) from exc
        raise SetupError("The managed update failed; all changed files were rolled back.") from exc


def _backup(path: Path) -> Path | None:
    if not path.exists():
        return None
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    candidate = path.with_name(f"{path.name}.backup-{stamp}")
    counter = 1
    while candidate.exists():
        candidate = path.with_name(f"{path.name}.backup-{stamp}-{counter}")
        counter += 1
    shutil.copy2(path, candidate)
    return candidate


def provider_config(model: dict[str, Any]) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "name": f"Tenvor {model['display_name']}",
        "limit": {
            "context": model["context"],
            "output": model["output"],
        },
    }
    if model.get("reasoning") is True:
        # The model thinks before it answers, sends the thinking as reasoning_content, and OpenCode's variants
        # choose how long it may think. Without a variant OpenCode sends no thinking level and the reply is direct.
        entry = {
            "name": entry["name"],
            "reasoning": True,
            "interleaved": {"field": "reasoning_content"},
            "variants": {level: {"reasoningEffort": level} for level in THINKING_VARIANTS},
            "limit": entry["limit"],
        }
    return {
        "npm": "@ai-sdk/openai-compatible",
        "name": "Tenvor",
        "options": {
            "baseURL": f"{API_BASE}/v1",
            "apiKey": "{file:tenvor-api-key}",
        },
        "models": {MODEL_ID: entry},
    }


def agent_config() -> dict[str, Any]:
    return {
        "description": "Tenvor alpha with explicit approval for every workspace tool",
        "mode": "primary",
        "model": MODEL_REF,
        "permission": {
            "*": "ask",
            "external_directory": "deny",
        },
    }


def _key_digest(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def _managed_state(
    provider: dict[str, Any], agent: dict[str, Any] | None, api_key: str, config_existed: bool
) -> dict[str, Any]:
    return {
        "version": STATE_VERSION,
        "provider": provider,
        "agent": agent,
        "agent_owned": agent is not None,
        "key_sha256": _key_digest(api_key),
        "config_existed": config_existed,
    }


def read_managed_state(path: Path) -> dict[str, Any] | None:
    if path.is_symlink():
        raise SetupError(f"Refusing to read symlinked installer state: {path}")
    if not path.exists():
        return None
    if not path.is_file():
        raise SetupError(f"Installer state is not a regular file: {path}")
    if path.stat().st_size > MAX_CONFIG_BYTES:
        raise SetupError("Installer state exceeds the 1 MiB safety limit.")
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise SetupError("The Tenvor installer state is not valid JSON.") from exc
    legacy = isinstance(state, dict) and state.get("version") == 1
    expected_keys = {"version", "provider", "agent", "key_sha256", "config_existed"}
    if not legacy:
        expected_keys.add("agent_owned")
    if (
        not isinstance(state, dict)
        or set(state) != expected_keys
        or state.get("version") not in {1, STATE_VERSION}
        or not isinstance(state.get("provider"), dict)
        or (not isinstance(state.get("agent"), dict) if legacy or state.get("agent_owned") is True
            else state.get("agent") is not None)
        or (not legacy and not isinstance(state.get("agent_owned"), bool))
        or not isinstance(state.get("config_existed"), bool)
        or not isinstance(state.get("key_sha256"), str)
        or len(state["key_sha256"]) != 64
        or any(character not in "0123456789abcdef" for character in state["key_sha256"])
    ):
        raise SetupError("The Tenvor installer state has an unsupported format.")
    if legacy:
        state["agent_owned"] = True
    return state


def read_managed_key(path: Path) -> str:
    if path.is_symlink():
        raise SetupError(f"Refusing to read symlinked credential file: {path}")
    if not path.exists() or not path.is_file():
        raise SetupError(f"Managed credential is not a regular file: {path}")
    if path.stat().st_size > 4096:
        raise SetupError("Managed credential exceeds the safety limit.")
    try:
        return validate_api_key(path.read_text(encoding="utf-8"))
    except UnicodeDecodeError as exc:
        raise SetupError("Managed credential is not valid UTF-8.") from exc


def manual_tenvor_provider(config_directory: Path) -> bool:
    """Recognize an existing account without taking ownership of its credential."""
    if (config_directory / STATE_FILENAME).exists():
        return False
    providers = read_config(config_directory / "opencode.json").get("provider", {})
    if not isinstance(providers, dict):
        raise SetupError("The existing OpenCode provider setting must be a JSON object.")
    provider = providers.get("tenvor")
    if provider is None:
        return False
    if not isinstance(provider, dict) or not isinstance(provider.get("options"), dict) or (
        provider["options"].get("baseURL") != f"{API_BASE}/v1"
        or not isinstance(provider.get("models"), dict)
        or MODEL_ID not in provider["models"]
    ):
        raise SetupError(
            "An existing Tenvor provider has different endpoint or model settings. "
            "Review it manually; setup will not redirect its credential."
        )
    return True


def _cache_entry(plugin_path: Path) -> list[Any]:
    # On Windows this is file:///C:/Users/..., the form OpenCode turns back into a path with fileURLToPath.
    return [plugin_path.resolve().as_uri(), {"baseURL": f"{API_BASE}/v1"}]


def _is_tenvor_cache_entry(entry: Any) -> bool:
    module = entry[0] if isinstance(entry, list) and entry else entry
    if not isinstance(module, str):
        return False
    name = module.removeprefix("file://")
    # A file: URI always uses "/", on either platform. Only Windows also accepts a plain C:\... path.
    return name.endswith("/" + CACHE_PLUGIN_FILENAME) or (_WINDOWS and name.endswith("\\" + CACHE_PLUGIN_FILENAME))


def _file_uri_to_path(uri: str) -> Path | None:
    """The local path named by a file: URI, or None when it names a remote host or cannot be converted.

    Path.as_uri() writes file:///C:/Users/a%20b/x.mjs on Windows and file://server/share/x.mjs for a network
    share; stripping "file://" would leave /C:/Users/a%20b/x.mjs. url2pathname undoes both, as Node's
    fileURLToPath does for OpenCode. A query or fragment is ignored, as it is there."""
    try:
        parts = urlsplit(uri)
    except ValueError:  # file://[bad]/... and the like
        return None
    if parts.scheme.lower() != "file":
        return None
    try:
        if parts.netloc.lower() in {"", "localhost"}:
            local = url2pathname(parts.path)
        elif _WINDOWS:
            local = url2pathname("//" + parts.netloc + parts.path)
        else:
            return None
    except OSError:
        return None
    return Path(local) if local else None


def _cache_entry_path(module: str) -> Path | None:
    return _file_uri_to_path(module) if module.lower().startswith("file:") else Path(module)


def _read_cache_state(path: Path) -> dict[str, Any] | None:
    if path.is_symlink():
        raise SetupError("Refusing to read symlinked cache installer state.")
    if not path.exists():
        return None
    if not path.is_file() or path.stat().st_size > MAX_CONFIG_BYTES:
        raise SetupError("The cache installer state is not a regular bounded file.")
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeError, ValueError) as exc:
        raise SetupError("The cache installer state is not valid JSON.") from exc
    if (not isinstance(state, dict) or state.get("version") != 1 or
        not isinstance(state.get("entry"), list) or
        not isinstance(state.get("plugin_owned"), bool) or
        not isinstance(state.get("agent_owned"), bool)):
        raise SetupError("The cache installer state has an unsupported format.")
    return state


def fetch_cache_plugin() -> bytes:
    request = Request(CACHE_PLUGIN_URL, headers={"User-Agent": "Tenvor-OpenCode-Setup/1"})
    try:
        with urlopen(request, timeout=15) as response:
            if response.status != 200:
                raise SetupError(f"The cache plugin returned HTTP {response.status}.")
            source = response.read(MAX_PLUGIN_BYTES + 1)
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise SetupError(f"Could not download Tenvor's cache plugin: {exc}") from exc
    if len(source) > MAX_PLUGIN_BYTES or hashlib.sha256(source).hexdigest() != CACHE_PLUGIN_SHA256:
        raise SetupError("The cache plugin failed SHA-256 verification; setup was not changed.")
    return source


def install_cache_plugin(config_directory: Path, source: bytes, *, backup_config: bool = True) -> dict[str, Any]:
    """Install the pinned V1 adapter and optionally add the restricted agent."""
    if hashlib.sha256(source).hexdigest() != CACHE_PLUGIN_SHA256:
        raise SetupError("The cache plugin failed SHA-256 verification; setup was not changed.")
    config_path = config_directory / "opencode.json"
    plugin_path = config_directory / CACHE_PLUGIN_FILENAME
    state_path = config_directory / CACHE_STATE_FILENAME
    config = read_config(config_path)
    plugins = config.setdefault("plugin", [])
    agents = config.setdefault("agent", {})
    if not isinstance(plugins, list) or not isinstance(agents, dict):
        raise SetupError("The existing OpenCode plugin or agent setting has the wrong type.")
    state = _read_cache_state(state_path)
    if state is None:
        existing = [entry for entry in plugins if _is_tenvor_cache_entry(entry)]
        if len(existing) > 1:
            raise SetupError("Multiple Tenvor cache plugins are configured; review them manually.")
        owned = not existing
        entry = _cache_entry(plugin_path) if owned else existing[0]
        if owned and (plugin_path.exists() or plugin_path.is_symlink()):
            raise SetupError(f"Refusing to overwrite pre-existing cache plugin: {plugin_path}")
        if not owned:
            if not isinstance(entry, list):
                raise SetupError("The existing Tenvor cache plugin needs an explicit endpoint option.")
            options = entry[1] if len(entry) > 1 else None
            if not isinstance(options, dict) or options.get("baseURL") != f"{API_BASE}/v1" or options.get("enabled") is False:
                raise SetupError("The existing Tenvor cache plugin options differ; review them manually.")
            existing_path = _cache_entry_path(entry[0])
            if existing_path is None or not existing_path.is_file():
                raise SetupError("The existing Tenvor cache plugin file is missing.")
        agent_owned = AGENT_ID not in agents
        agent = agent_config() if agent_owned else None
        if agent_owned:
            agents[AGENT_ID] = agent
        if owned:
            plugins.append(entry)
        state = {"version": 1, "entry": entry, "plugin_owned": owned,
                 "agent_owned": agent_owned, "agent": agent,
                 "plugin_sha256": CACHE_PLUGIN_SHA256 if owned else None}
    else:
        entry = state.get("entry")
        if not isinstance(entry, list) or entry not in plugins:
            raise SetupError("The script-managed cache plugin entry was changed.")
        owned = state.get("plugin_owned") is True
        agent_owned = state.get("agent_owned") is True
        if owned and entry != _cache_entry(plugin_path):
            raise SetupError("The script-managed cache plugin endpoint was changed.")
        if agent_owned and AGENT_ID in agents and agents[AGENT_ID] != state.get("agent"):
            # A changed agent belongs to the user. Keep it and relinquish ownership.
            agent_owned = False
            state["agent_owned"] = False
            state["agent"] = None
        if AGENT_ID not in agents:
            # A rerun may adopt the now-vacant name without replacing a custom agent.
            agent_owned = True
            state["agent_owned"] = True
            agents[AGENT_ID] = agent_config()
            state["agent"] = agents[AGENT_ID]
        if owned and (plugin_path.is_symlink() or not plugin_path.is_file() or
                      hashlib.sha256(plugin_path.read_bytes()).hexdigest() != state.get("plugin_sha256")):
            raise SetupError("The script-managed cache plugin file was changed.")
        if not owned and state.get("plugin_sha256") is not None:
            raise SetupError("The cache installer state has an unsupported format.")
        state["plugin_sha256"] = CACHE_PLUGIN_SHA256 if owned else None
    encoded = (json.dumps(config, indent=2, ensure_ascii=False) + "\n").encode()
    encoded_state = (json.dumps(state, indent=2, ensure_ascii=False) + "\n").encode()
    writes = []
    if config_path.read_bytes() != encoded:
        writes.append((config_path, encoded, stat.S_IMODE(config_path.stat().st_mode)))
    if owned and (not plugin_path.exists() or plugin_path.read_bytes() != source):
        writes.append((plugin_path, source, 0o600))
    if not state_path.exists() or state_path.read_bytes() != encoded_state:
        writes.append((state_path, encoded_state, 0o600))
    try:
        backup = _backup(config_path) if backup_config and any(path == config_path for path, _, _ in writes) else None
        plugin_backup = None
        # An installer-owned plugin may change across releases. Retain its exact
        # previous bytes before replacing it, just as for opencode.json.
        if state_path.exists() and any(path == plugin_path for path, _, _ in writes):
            plugin_backup = _backup(plugin_path)
    except OSError as exc:
        raise SetupError(f"Could not back up the OpenCode configuration or plugin: {exc}") from exc
    if writes:
        _transactional_update(writes)
    return {"owned": owned, "agent_owned": agent_owned, "backup": backup,
            "plugin_backup": plugin_backup,
            "plugin_path": plugin_path if owned else None}


def remove_cache_plugin(config_directory: Path) -> bool:
    config_path = config_directory / "opencode.json"
    plugin_path = config_directory / CACHE_PLUGIN_FILENAME
    state_path = config_directory / CACHE_STATE_FILENAME
    if not state_path.exists() and not state_path.is_symlink():
        return False
    state = _read_cache_state(state_path)
    config = read_config(config_path)
    plugins = config.get("plugin")
    agents = config.get("agent")
    entry = state.get("entry")
    if not isinstance(plugins, list) or entry not in plugins or not isinstance(agents, dict):
        raise SetupError("The script-managed cache plugin configuration was changed.")
    owned = state.get("plugin_owned") is True
    if owned and (plugin_path.is_symlink() or not plugin_path.is_file() or
                  hashlib.sha256(plugin_path.read_bytes()).hexdigest() != state.get("plugin_sha256")):
        raise SetupError("The script-managed cache plugin file was changed.")
    if state.get("agent_owned") is True and agents.get(AGENT_ID) != state.get("agent"):
        raise SetupError("The script-managed Tenvor agent was changed.")
    deletes = [state_path]
    if owned:
        plugins.remove(entry)
        if not plugins:
            del config["plugin"]
        deletes.append(plugin_path)
    if state.get("agent_owned") is True:
        del agents[AGENT_ID]
        if not agents:
            del config["agent"]
    encoded = (json.dumps(config, indent=2, ensure_ascii=False) + "\n").encode()
    writes = []
    if config_path.read_bytes() != encoded:
        _backup(config_path)
        writes.append((config_path, encoded, stat.S_IMODE(config_path.stat().st_mode)))
    _transactional_update(writes, deletes)
    return True


def install(config_directory: Path, model: dict[str, Any], api_key: str | None) -> dict[str, Any]:
    if config_directory.is_symlink():
        raise SetupError(f"Refusing to use symlinked configuration directory: {config_directory}")
    config_directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    config_path = config_directory / "opencode.json"
    key_path = config_directory / "tenvor-api-key"
    state_path = config_directory / STATE_FILENAME
    jsonc_path = config_directory / "opencode.jsonc"
    config_existed_now = config_path.exists()
    config = read_config(config_path)
    state = read_managed_state(state_path)

    providers = config.get("provider")
    if providers is None:
        providers = {}
        config["provider"] = providers
    if not isinstance(providers, dict):
        raise SetupError("The existing OpenCode provider setting must be a JSON object.")

    agents = config.get("agent")
    if agents is None:
        agents = {}
        config["agent"] = agents
    if not isinstance(agents, dict):
        raise SetupError("The existing OpenCode agent setting must be a JSON object.")

    if state is None:
        collisions = []
        if "tenvor" in providers:
            collisions.append("provider.tenvor")
        if AGENT_ID in agents:
            collisions.append(f"agent.{AGENT_ID}")
        if key_path.exists() or key_path.is_symlink():
            collisions.append(str(key_path))
        if collisions:
            raise SetupError(
                "Refusing to overwrite pre-existing state: " + ", ".join(collisions)
            )
        if api_key is None:
            raise SetupError("No script-managed credential exists; enter a new API key.")
        selected_key = validate_api_key(api_key)
        config_existed = config_existed_now
    else:
        if providers.get("tenvor") != state["provider"]:
            raise SetupError(
                "The script-managed Tenvor provider was changed. Restore it or remove it manually."
            )
        agent_owned = state["agent_owned"] is True
        if agent_owned and AGENT_ID in agents and agents[AGENT_ID] != state["agent"]:
            # Preserve an edited agent, including edited approval rules. The provider,
            # credential, and plugin can still be upgraded independently.
            agent_owned = False
        if AGENT_ID not in agents:
            # A removed custom agent no longer owns this name; restore the
            # restricted default when setup is explicitly rerun.
            agent_owned = True
        existing_key = read_managed_key(key_path)
        if _key_digest(existing_key) != state["key_sha256"]:
            raise SetupError(
                "The script-managed credential was changed. Refusing to overwrite or remove it."
            )
        selected_key = validate_api_key(api_key) if api_key is not None else existing_key
        config_existed = state["config_existed"]
    if state is None:
        agent_owned = True

    managed_provider = provider_config(model)
    managed_agent = agent_config()
    providers["tenvor"] = managed_provider
    if agent_owned:
        agents[AGENT_ID] = managed_agent

    encoded = (json.dumps(config, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    current = config_path.read_bytes() if config_path.exists() else None
    managed = _managed_state(managed_provider, managed_agent if agent_owned else None,
                             selected_key, config_existed)
    encoded_state = (json.dumps(managed, indent=2, ensure_ascii=False) + "\n").encode("utf-8")

    backup = None
    if current != encoded and config_path.exists():
        try:
            backup = _backup(config_path)
        except OSError as exc:
            raise SetupError(f"Could not back up the OpenCode configuration: {exc}") from exc

    writes: list[tuple[Path, bytes, int]] = []
    config_mode = stat.S_IMODE(config_path.stat().st_mode) if config_path.exists() else 0o600
    if current != encoded:
        writes.append((config_path, encoded, config_mode))
    key_bytes = selected_key.encode("utf-8")
    if (
        not key_path.exists()
        or key_path.read_bytes() != key_bytes
        or not _has_private_mode(key_path)
    ):
        writes.append((key_path, key_bytes, 0o600))
    if (
        not state_path.exists()
        or state_path.read_bytes() != encoded_state
        or not _has_private_mode(state_path)
    ):
        writes.append((state_path, encoded_state, 0o600))
    if writes:
        _transactional_update(writes)

    return {
        "config_path": config_path,
        "key_path": key_path,
        "backup": backup,
        "jsonc_conflict_possible": jsonc_path.exists(),
        "agent_customized": not agent_owned,
    }


def remove(config_directory: Path) -> dict[str, Any]:
    config_path = config_directory / "opencode.json"
    key_path = config_directory / "tenvor-api-key"
    state_path = config_directory / STATE_FILENAME
    state = read_managed_state(state_path)
    if state is None:
        raise SetupError(
            "No script-managed Tenvor installation was found; nothing was removed."
        )
    config = read_config(config_path)

    providers = config.get("provider")
    agents = config.get("agent")
    if not isinstance(providers, dict) or providers.get("tenvor") != state["provider"]:
        raise SetupError(
            "The script-managed Tenvor provider was changed. Refusing partial removal."
        )
    if (state["agent_owned"] and
        (not isinstance(agents, dict) or agents.get(AGENT_ID) != state["agent"])):
        raise SetupError(
            f"The script-managed {AGENT_ID} agent was changed. Refusing partial removal."
        )
    existing_key = read_managed_key(key_path)
    if _key_digest(existing_key) != state["key_sha256"]:
        raise SetupError(
            "The script-managed credential was changed. Refusing partial removal."
        )

    del providers["tenvor"]
    if not providers:
        del config["provider"]
    if state["agent_owned"]:
        del agents[AGENT_ID]
        if not agents:
            del config["agent"]

    try:
        backup = _backup(config_path)
    except OSError as exc:
        raise SetupError(f"Could not back up the OpenCode configuration: {exc}") from exc

    writes: list[tuple[Path, bytes, int]] = []
    deletes = [key_path, state_path]
    if config or state["config_existed"]:
        encoded = (json.dumps(config, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
        writes.append((config_path, encoded, stat.S_IMODE(config_path.stat().st_mode)))
    else:
        deletes.append(config_path)
    _transactional_update(writes, deletes)

    return {"config_path": config_path, "backup": backup, "key_removed": True}


def read_key_file(path: Path) -> str:
    # Only the file's existence, size and content matter. POSIX mode bits are not consulted on any platform.
    if not path.is_file():
        raise SetupError(f"API key file is not a regular file: {path}")
    if path.stat().st_size > 4096:
        raise SetupError("API key file exceeds the safety limit.")
    if _WINDOWS:
        # Windows PowerShell 5.1 writes UTF-16 with a byte order mark for ">" and Out-File, and Set-Content
        # -Encoding UTF8 adds a UTF-8 one. Accept all of them; the key itself is plain ASCII.
        raw = path.read_bytes()
        try:
            text = raw.decode("utf-16") if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else raw.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise SetupError("The API key file is not UTF-8 or UTF-16 text.") from exc
        return validate_api_key(text)
    return validate_api_key(path.read_text(encoding="utf-8"))


WINDOWS_KEY_PROMPT = "Paste your Tenvor API key, then press Enter: "
_MAX_TYPED_KEY = 4096


def _drain_windows_input() -> None:
    """Throw away whatever else a paste carried (text after a line break in it). Left in the queue it would reach your
    shell when the setup ends, and the shell would show it. Reads until the input has been quiet for 100 ms, and for half
    a second at most."""
    deadline = time.monotonic() + 0.5
    quiet_since = time.monotonic()
    while time.monotonic() < deadline:
        if msvcrt.kbhit():
            msvcrt.getwch()
            quiet_since = time.monotonic()
        elif time.monotonic() - quiet_since >= 0.1:
            return
        else:
            time.sleep(0.01)


def _read_masked_windows(prompt: str) -> str:
    """Read the key on Windows with a * for each character, so that a paste visibly lands while the key itself never
    shows. Windows users do not expect a prompt that shows nothing at all, and took that for a paste that failed.
    Backspace takes a character back, Ctrl+C stops, and keys that are not characters (arrows and the like) are ignored."""
    if not sys.stdin.isatty():
        raise EOFError
    out = sys.stdout
    out.write(prompt)
    out.flush()
    typed = []
    while True:
        character = msvcrt.getwch()
        if character in ("\r", "\n"):
            if not typed:  # a paste that starts with a line break
                continue
            break
        if character == "\uffff":  # what getwch returns when there is no console to read
            raise EOFError
        if character == "\x03":
            out.write("\n")
            out.flush()
            _drain_windows_input()
            raise KeyboardInterrupt
        if character == "\x1a":  # Ctrl+Z, Windows' end of input
            out.write("\n")
            out.flush()
            _drain_windows_input()
            raise EOFError
        if character in ("\x00", "\xe0"):  # the first half of an arrow or function key
            msvcrt.getwch()
            continue
        if character == "\x08":
            if typed:
                typed.pop()
                out.write("\b \b")
                out.flush()
            continue
        if character < " " or "\x7f" <= character <= "\x9f" or len(typed) >= _MAX_TYPED_KEY:
            continue  # other control characters, and anything past the longest key
        typed.append(character)
        out.write("*")
        out.flush()
    out.write("\n")
    out.flush()
    _drain_windows_input()
    return "".join(typed)


def prompt_api_key() -> str:
    if _WINDOWS:
        try:
            return validate_api_key(_read_masked_windows(WINDOWS_KEY_PROMPT))
        except EOFError as exc:
            raise SetupError(
                "Typing the key needs a console window. Run setup in PowerShell, Windows Terminal or Command Prompt, "
                "or use --key-file with an existing private credential file."
            ) from exc
    # getpass normally falls back to echoed input without a usable terminal.
    # Stop before that fallback can expose a balance-bearing credential.
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            return validate_api_key(getpass.getpass("Tenvor API key (input hidden): "))
    except (getpass.GetPassWarning, EOFError) as exc:
        raise SetupError(
            "Hidden terminal input is unavailable. Run setup in an interactive "
            "terminal, or use --key-file with an existing private credential file."
        ) from exc


def _find_windows_launcher(directories: list[str]) -> str | None:
    """The first opencode.exe or opencode.cmd in the given directories, searched in order.

    This replaces shutil.which on Windows for two reasons. which() looks in the working directory first, so a
    file planted in the folder where setup was started would be run by "--version". And it can return the
    extensionless npm shim, which is a Bash script that Windows cannot run. Only absolute directories count."""
    for directory in directories:
        directory = directory.strip().strip('"')
        if not directory or not Path(directory).is_absolute():
            continue
        for name in _WINDOWS_LAUNCHERS:
            candidate = Path(directory) / name
            if candidate.is_file():
                return os.path.abspath(candidate)
    return None


def _windows_install_directories() -> list[str]:
    """Where the documented Windows install methods put the command: npm's global folder (%APPDATA%\\npm unless
    npm's prefix is changed), Scoop's shims folder, Chocolatey's bin folder and WinGet's links folder."""
    home = Path.home()
    appdata = os.environ.get("APPDATA") or str(home / "AppData" / "Roaming")
    local_appdata = os.environ.get("LOCALAPPDATA") or str(home / "AppData" / "Local")
    program_data = os.environ.get("ProgramData") or "C:\\ProgramData"
    chocolatey = os.environ.get("ChocolateyInstall") or str(Path(program_data) / "chocolatey")
    scoop = os.environ.get("SCOOP") or str(home / "scoop")
    return [
        os.environ.get("NPM_CONFIG_PREFIX", ""),
        str(Path(appdata) / "npm"),
        str(Path(scoop) / "shims"),
        str(Path(chocolatey) / "bin"),
        str(Path(local_appdata) / "Microsoft" / "WinGet" / "Links"),
    ]


def resolve_opencode() -> str | None:
    """Check PATH and a fixed set of documented user install locations."""
    if _WINDOWS:
        executable = _find_windows_launcher(os.environ.get("PATH", "").split(os.pathsep))
    else:
        executable = shutil.which("opencode")
    if executable:
        return os.path.abspath(executable)
    directories = [
        os.environ.get("OPENCODE_INSTALL_DIR", ""),
        os.environ.get("XDG_BIN_DIR", ""),
        str(Path.home() / ".opencode" / "bin"),
        str(Path.home() / "bin"),
        str(Path.home() / ".local" / "bin"),
    ]
    if _WINDOWS:
        expanded = [os.path.expanduser(directory) for directory in directories]
        return _find_windows_launcher(expanded + _windows_install_directories())
    for directory in directories:
        if not directory:
            continue
        candidate = Path(directory).expanduser() / "opencode"
        if candidate.is_absolute() and candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


_CMD_UNSAFE = re.compile(r'[%!"&^\x00-\x1f]')


def _windows_opencode_version(executable: str) -> str:
    """opencode --version on Windows, run so that nothing but OpenCode can be started by it.

    npm's opencode.cmd falls back to a bare node, and OpenCode's own wrapper starts PowerShell by name, and Windows
    looks for a bare name in the current folder first. So the check runs in an empty private folder, with
    NoDefaultCurrentDirectoryInExePath set (cmd.exe then never searches the current folder) and without the Node.js
    options that load code. A .cmd file runs through cmd.exe, which reads & | < > ^ ( ) as syntax and expands %...%;
    Windows passes it the command line as it is, and Python quotes a path only when it has a space. So the path is
    always quoted, cmd.exe is the Windows folder's own, without AutoRun (/d) or delayed expansion (/v:off). npm's
    opencode.cmd then sets its own folder with SET dp0=%~dp0, unquoted, where & and ^ act again, so a path with %, !,
    &, ^ or a quote in it is refused. Only the constant --version is ever passed."""
    command: list[str] | str = [executable, "--version"]
    if Path(executable).suffix.lower() in {".cmd", ".bat"}:
        root = os.environ.get("SystemRoot") or os.environ.get("windir") or ""
        cmd = os.path.join(root, "System32", "cmd.exe") if os.path.isabs(root) else ""
        if not cmd or not os.path.isfile(cmd):
            raise SetupError("cmd.exe was not found in the Windows folder, so OpenCode could not be checked. Nothing was changed.")
        if _CMD_UNSAFE.search(executable):
            raise SetupError(
                f"OpenCode's path {executable} has %, !, &, ^ or a quote in it, which Windows command scripts such as opencode.cmd cannot run safely. "
                "Install OpenCode in a folder without them, then run this setup again. No Tenvor configuration was changed."
            )
        command = '"' + cmd + '" /d /v:off /s /c ""' + executable + '" --version"'
    environment = {key: value for key, value in os.environ.items() if key.upper() not in {"NODE_OPTIONS", "NODE_PATH"}}
    environment["NoDefaultCurrentDirectoryInExePath"] = "1"
    try:
        scratch = tempfile.mkdtemp(prefix="tenvor-opencode-check-")
    except OSError as exc:
        raise SetupError(f"Could not make a temporary folder to check OpenCode in ({exc.__class__.__name__}). Nothing was changed.") from exc
    try:
        result = subprocess.run(
            command, check=True, capture_output=True, text=True, timeout=30,
            env=environment, cwd=scratch, stdin=subprocess.DEVNULL,
        )
    except (OSError, UnicodeError, subprocess.SubprocessError):
        return "unknown"
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
    version = result.stdout.strip()
    return version if re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?", version) else "unknown"


def opencode_version(executable: str) -> str:
    if _WINDOWS:
        return _windows_opencode_version(executable)
    try:
        result = subprocess.run(
            [executable, "--version"],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, UnicodeError, subprocess.SubprocessError):
        return "unknown"
    version = result.stdout.strip()
    return version if re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?", version) else "unknown"


def windows_opencode_guidance(executable: str | None, version: str | None) -> str:
    """What to run on Windows, where setup never installs or upgrades OpenCode itself.

    The pinned official installer is a Bash script for Linux and macOS, and an upgrade needs the package manager
    that owns the installation. The commands are the ones OpenCode's own docs and upgrade code use for npm,
    Scoop and Chocolatey, with the tested version pinned where each tool supports it."""
    if executable is None:
        lines = [
            "OpenCode was not found. Setup never installs or upgrades OpenCode on Windows.",
            f"Install OpenCode {TESTED_OPENCODE_VERSION} yourself with one of these commands in PowerShell, "
            "then run the Tenvor setup again:",
            f"  npm install -g opencode-ai@{TESTED_OPENCODE_VERSION}",
            f"  scoop install opencode@{TESTED_OPENCODE_VERSION}",
            f"  choco install opencode --version={TESTED_OPENCODE_VERSION}   (in an administrator PowerShell)",
            "If setup still cannot find OpenCode afterwards, open a new PowerShell window and run it there.",
            "If you use OpenCode inside WSL, run Tenvor's Linux setup command in that WSL terminal instead.",
        ]
    else:
        lines = [
            f"OpenCode {version} at {executable} is older than the tested {TESTED_OPENCODE_VERSION}. "
            "Setup never installs or upgrades OpenCode on Windows.",
            "Upgrade it yourself, with the tool that installed it, in PowerShell, then run the Tenvor setup again:",
            f"  npm install -g opencode-ai@{TESTED_OPENCODE_VERSION}",
            "  scoop update opencode",
            f"  choco upgrade opencode --version={TESTED_OPENCODE_VERSION}   (in an administrator PowerShell)",
        ]
    lines.append("No API key was read and no Tenvor configuration was changed.")
    return "\n".join(lines)


def install_opencode_client() -> None:
    """Run only the pinned official, user-local installer after consent."""
    if _WINDOWS:
        # ensure_opencode stops first; this guard keeps the POSIX-only code below from ever running here.
        raise SetupError("Setup never installs or upgrades OpenCode on Windows.")
    if sys.platform not in {"linux", "darwin"}:
        raise SetupError("Optional installation supports Linux/macOS; use WSL or https://opencode.ai/docs/.")
    if os.geteuid() == 0:
        raise SetupError("Run optional OpenCode installation as your regular user, not with sudo.")
    required = ["bash", "curl", "tar" if sys.platform == "linux" else "unzip"]
    commands = {name: shutil.which(name) for name in required}
    if any(value is None for value in commands.values()):
        raise SetupError("Optional OpenCode installation requires " + ", ".join(required) + "; install missing prerequisites first.")
    target = Path.home() / ".opencode" / "bin" / "opencode"
    if any(path.is_symlink() for path in (target.parent.parent, target.parent, target)) or target.exists():
        raise SetupError("The default OpenCode installation path already exists or is symlinked; repair it manually.")
    # Do not pass provider credentials, shell hooks, or Actions file commands.
    environment = {
        key: value for key, value in os.environ.items()
        if key in {"HOME", "PATH", "SHELL", "LANG", "LC_ALL"}
    }
    environment.setdefault("SHELL", str(commands["bash"]))
    try:
        with tempfile.TemporaryDirectory(prefix="tenvor-opencode-install-") as directory:
            scratch = Path(directory)
            installer = scratch / "install.sh"
            subprocess.run(
                [str(commands["curl"]), "-q", "--proto", "=https", "--tlsv1.2",
                 "--fail", "--silent", "--show-error", "--max-time", "30",
                 "--max-filesize", "65536", OPENCODE_INSTALLER_URL, "--output", str(installer)],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                env=environment, timeout=45,
            )
            source = installer.read_bytes()
            if len(source) > 65536 or hashlib.sha256(source).hexdigest() != OPENCODE_INSTALLER_SHA256:
                raise SetupError("The official OpenCode installer failed SHA-256 verification; it was not run.")
            environment["TMPDIR"] = str(scratch)
            environment["CURL_HOME"] = str(scratch)
            # The upstream script's curl must not load user credential headers.
            (scratch / ".curlrc").write_text("", encoding="utf-8")
            with subprocess.Popen(
                [str(commands["bash"]), "--noprofile", "--norc", str(installer),
                 "--version", TESTED_OPENCODE_VERSION, "--no-modify-path"],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, env=environment, start_new_session=True,
            ) as process:
                try:
                    result = process.wait(timeout=180)
                except (subprocess.TimeoutExpired, KeyboardInterrupt):
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()
                    raise
                if result != 0:
                    raise subprocess.CalledProcessError(result, "official OpenCode installer")
    except (OSError, subprocess.SubprocessError) as exc:
        raise SetupError(
            "OpenCode installation failed. No Tenvor key or configuration was changed. "
            "Check https://opencode.ai/docs/; a partial client installation may need repair."
        ) from exc


def upgrade_opencode_client(executable: str) -> None:
    """Upgrade only the official user-local binary with OpenCode's curl method."""
    if _WINDOWS:
        # ensure_opencode stops first; this guard keeps the POSIX-only code below from ever running here.
        raise SetupError("Setup never installs or upgrades OpenCode on Windows.")
    target = Path.home() / ".opencode" / "bin" / "opencode"
    path = Path(executable)
    if (sys.platform not in {"linux", "darwin"} or os.geteuid() == 0 or
        path != target or any(item.is_symlink() for item in
                              (target.parent.parent, target.parent, target)) or
        not target.is_file() or target.stat().st_uid != os.geteuid()):
        raise SetupError(
            f"OpenCode at {executable} is older than {TESTED_OPENCODE_VERSION}. "
            "Update this nonstandard or package-managed installation with its own "
            "package manager, then rerun Tenvor setup; no Tenvor configuration was changed."
        )
    environment = {
        key: value for key, value in os.environ.items()
        if key in {"HOME", "PATH", "SHELL", "LANG", "LC_ALL"}
    }
    try:
        with tempfile.TemporaryDirectory(prefix="tenvor-opencode-upgrade-") as directory:
            scratch = Path(directory)
            environment["TMPDIR"] = str(scratch)
            environment["CURL_HOME"] = str(scratch)
            environment["XDG_CONFIG_HOME"] = str(scratch)
            environment["OPENCODE_CONFIG_DIR"] = str(scratch / "opencode")
            (scratch / "opencode").mkdir()
            (scratch / ".curlrc").write_text("", encoding="utf-8")
            with subprocess.Popen(
                [str(target), "upgrade", TESTED_OPENCODE_VERSION,
                 "--method", "curl"],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, env=environment, cwd=scratch,
                start_new_session=True,
            ) as process:
                try:
                    result = process.wait(timeout=180)
                except (subprocess.TimeoutExpired, KeyboardInterrupt):
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()
                    raise
                if result != 0:
                    raise subprocess.CalledProcessError(result, "OpenCode upgrade")
    except (OSError, subprocess.SubprocessError) as exc:
        raise SetupError(
            "The user-local OpenCode upgrade failed. Check the OpenCode installation "
            "and rerun setup; no Tenvor key or configuration was changed."
        ) from exc
    if (resolve_opencode() != str(target) or target.is_symlink() or
        opencode_version(str(target)) != TESTED_OPENCODE_VERSION):
        raise SetupError(
            "OpenCode upgrade did not leave the tested version at the same user-local "
            "path. Repair OpenCode and rerun setup; no Tenvor configuration was changed."
        )


def ensure_opencode() -> tuple[str, str]:
    executable = resolve_opencode()
    if executable is None:
        if _WINDOWS:
            raise SetupError(windows_opencode_guidance(None, None))
        if not sys.stdin.isatty():
            raise SetupError(
                "OpenCode was not found. Run setup in an interactive terminal to choose "
                "installation, or install it using https://opencode.ai/docs/ and retry. "
                "No API key was read or Tenvor configuration changed."
            )
        print(f"OpenCode was not found. Optional install: tested version {TESTED_OPENCODE_VERSION}.")
        print("Installs for your user only; no sudo, system packages, or shell startup file changes.")
        try:
            approved = input("Download and run the pinned official OpenCode installer? [y/N] ")
        except EOFError:
            approved = ""
        if approved.strip().lower() not in {"y", "yes"}:
            raise SetupError("OpenCode installation declined; no API key was read or configuration changed.")
        install_opencode_client()
        executable = resolve_opencode()
        if executable is None:
            raise SetupError("OpenCode installation did not produce an executable; Tenvor was not configured.")
    version = opencode_version(executable)
    if version == "unknown":
        raise SetupError("OpenCode could not report its version; repair its installation before configuring Tenvor.")
    exact_version = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", version)
    if exact_version and tuple(map(int, exact_version.groups())) < tuple(map(int, TESTED_OPENCODE_VERSION.split("."))):
        if _WINDOWS:
            raise SetupError(windows_opencode_guidance(executable, version))
        upgrade_opencode_client(executable)
        version = opencode_version(executable)
    return executable, version


def _powershell_literal(value: str) -> str:
    """Quote text as a PowerShell single-quoted string, where nothing is expanded. A single quote is doubled;
    PowerShell also treats the four curly single quotes as quotes, so each of those is doubled too."""
    return "'" + "".join(character * 2 if character in "'\u2018\u2019\u201a\u201b" else character
                         for character in value) + "'"


def run_command(executable: str) -> str:
    """The command that starts the Tenvor agent, written for the terminal the person is already using."""
    arguments = ["--agent", AGENT_ID]
    if not _WINDOWS:
        return shlex.join([executable, *arguments])
    on_path = _find_windows_launcher(os.environ.get("PATH", "").split(os.pathsep))
    same_file = on_path is not None and os.path.normcase(os.path.abspath(on_path)) == os.path.normcase(
        os.path.abspath(executable)
    )
    # Typing a bare name makes PowerShell prefer a sibling opencode.ps1 (npm writes one), which a default
    # Windows PowerShell 5.1 execution policy blocks. The explicit launcher path below does not hit that.
    if same_file and not Path(executable).with_suffix(".ps1").exists():
        return " ".join(["opencode", *arguments])
    return " ".join(["&", _powershell_literal(executable), *arguments])


def credential_protection(key_path: Path) -> str:
    """A true, short description of who can read the credential file on this platform."""
    if not _WINDOWS:
        return "mode 600"
    try:
        key_path.resolve().relative_to(Path.home().resolve())
    except (OSError, RuntimeError, ValueError):
        return "outside your user profile, so that folder's Windows permissions apply"
    return "in your user profile: by default only you, administrators and the system can read it"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Configure Tenvor for OpenCode.")
    parser.add_argument(
        "--key-file",
        type=Path,
        help="Read the Tenvor API key from this file instead of prompting.",
    )
    parser.add_argument(
        "--rotate-key",
        action="store_true",
        help="Prompt for and replace an existing Tenvor credential.",
    )
    parser.add_argument(
        "--remove",
        action="store_true",
        help="Remove only the Tenvor provider and its managed credential.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    if _WINDOWS:
        # A redirected Windows console can use a code page that cannot show a path or the ellipsis in the key
        # error. Printing must never end the run with a traceback.
        for stream in (sys.stdout, sys.stderr):
            reconfigure = getattr(stream, "reconfigure", None)
            if reconfigure is not None:
                reconfigure(errors="replace")
    args = parse_args(argv)
    config_directory = resolve_config_directory()

    try:
        if args.remove:
            if args.key_file or args.rotate_key:
                raise SetupError("--remove cannot be combined with credential options.")
            has_provider_state = (config_directory / STATE_FILENAME).exists()
            has_cache_state = (config_directory / CACHE_STATE_FILENAME).exists()
            if not has_provider_state and not has_cache_state:
                raise SetupError("No script-managed Tenvor installation was found; nothing was removed.")
            paths = [config_directory / "opencode.json", config_directory / CACHE_PLUGIN_FILENAME,
                     config_directory / CACHE_STATE_FILENAME]
            if has_provider_state:
                paths.extend([config_directory / "tenvor-api-key", config_directory / STATE_FILENAME])
            snapshots = {path: _snapshot(path) for path in paths}
            try:
                if has_cache_state:
                    remove_cache_plugin(config_directory)
                result = remove(config_directory) if has_provider_state else None
            except BaseException as exc:
                try:
                    _restore_snapshots(snapshots)
                except BaseException as rollback_exc:
                    raise SetupError(f"Removal failed and rollback was incomplete: {rollback_exc}") from exc
                raise
            print("Tenvor setup was removed from the global OpenCode configuration.")
            print(f"Config: {config_directory / 'opencode.json'}")
            print(f"Credential removed: {'yes' if result and result['key_removed'] else 'not script-managed'}")
            if result and result["backup"]:
                print(f"Config backup: {result['backup']}")
            return 0

        executable, version = ensure_opencode()
        if not version.startswith("1."):
            raise SetupError("This cache plugin supports OpenCode 1.x; use the OpenCode 1 installer until the V2 plugin is released.")
        model = fetch_catalog_model()
        manual = manual_tenvor_provider(config_directory)
        if manual and (args.key_file or args.rotate_key):
            raise SetupError("This Tenvor provider uses an existing OpenCode credential; change it with OpenCode auth before rerunning setup.")
        plugin_source = fetch_cache_plugin()
        key_path = config_directory / "tenvor-api-key"
        result = None
        new_provider = not (config_directory / STATE_FILENAME).exists()
        api_key: str | None = None
        if not manual:
            if args.key_file:
                api_key = read_key_file(args.key_file.expanduser())
            elif args.rotate_key or not key_path.is_file() or key_path.is_symlink():
                api_key = prompt_api_key()
        paths = [config_directory / "opencode.json", config_directory / CACHE_PLUGIN_FILENAME,
                 config_directory / CACHE_STATE_FILENAME]
        if not manual:
            paths.extend([key_path, config_directory / STATE_FILENAME])
        snapshots = {path: _snapshot(path) for path in paths}
        try:
            if not manual:
                result = install(config_directory, model, api_key)
            cache = install_cache_plugin(config_directory, plugin_source,
                                         backup_config=not (result and new_provider))
        except BaseException as exc:
            if config_directory.exists():
                try:
                    _restore_snapshots(snapshots)
                except BaseException as rollback_exc:
                    raise SetupError(f"Setup failed and rollback was incomplete: {rollback_exc}") from exc
            raise
        print("Tenvor is ready in OpenCode.")
        print(f"Config: {config_directory / 'opencode.json'}")
        if result:
            print(f"Credential: {result['key_path']} ({credential_protection(result['key_path'])})")
        else:
            print("Credential: existing OpenCode account (preserved)")
        print(f"Model: {MODEL_REF}")
        print(f"Live limits: {model['context']:,} context / {model['output']:,} output tokens")
        if result and result["backup"]:
            print(f"Config backup: {result['backup']}")
        if cache["backup"]:
            print(f"Config backup: {cache['backup']}")
        if cache["plugin_backup"]:
            print(f"Cache plugin backup: {cache['plugin_backup']}")
        print("Session cache plugin: installed" if cache["owned"] else "Session cache plugin: existing installation preserved")
        print("Your existing default model and agents were preserved.")
        if (config_directory / 'opencode.jsonc').exists():
            print(
                "Note: opencode.jsonc also exists and loads after opencode.json; "
                "its conflicting settings may take precedence."
            )

        if version == TESTED_OPENCODE_VERSION:
            print(f"OpenCode {version} matches Tenvor's tested integration version.")
        else:
            print(
                f"OpenCode version: {version}. Tenvor's currently published test evidence "
                f"is for {TESTED_OPENCODE_VERSION}."
            )
        print(f"Run: {run_command(executable)}")
        print("This exact command works in your current terminal; no shell restart is needed.")
        if (result and not result["agent_customized"]) or cache["agent_owned"]:
            print("Every workspace tool call will require approval; outside-workspace access is denied.")
        else:
            print("Your changed tenvor-agent was preserved and is no longer script-managed; review its model and tool permissions before using it.")
        return 0
    except SetupError as exc:
        print(f"Tenvor OpenCode setup stopped: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
