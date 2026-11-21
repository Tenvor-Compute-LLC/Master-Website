#!/usr/bin/env python3
"""Add or remove Tenvor in a user's Pi configuration.

What it touches, and nothing else, all inside Pi's agent directory
(``~/.pi/agent``, or ``PI_CODING_AGENT_DIR`` when that is set):

* ``models.json``   adds the ``tenvor`` provider and the ``chat-35b-moe`` model
* ``auth.json``     stores the Tenvor API key as Pi's own credential store does
* ``settings.json`` makes tenvor/chat-35b-moe Pi's default model, but only when
  you have not chosen one; an existing default is never replaced
* ``.tenvor-pi-state.json`` remembers exactly what was added, so it can be undone
* ``extensions/tenvor-session-kv.js`` is a small Pi extension that turns on Tenvor's session
  cache for the Tenvor model (it adds three request headers to Tenvor requests and changes
  nothing else). It is part of this file, pinned by SHA-256, written only if no other file is
  there, and ``.tenvor-pi-cache-state.json`` remembers it so it can be updated and removed.
  ``--no-cache-extension`` skips it. If this step fails, the model setup is still complete. The step runs
  under a lock file (``.tenvor-pi-cache.lock``, removed when it ends), one run at a time.

Every other byte of those files is left as it is: new text is spliced into the
file, which is never parsed and written back. A copy of models.json and
settings.json is made first (auth.json is copied only for the length of the run,
because it holds keys), files are replaced atomically, and a failed run puts
everything back. If Pi does not accept the result, the run puts everything back.

The model's limits are read from Tenvor's public catalog before anything is
written. The key is read with echo off (or from a file you name), is never an
argument or an environment variable, and is never printed. Standard library
only; written for Python 3.8 and newer, on Linux and macOS (started by pi.sh)
and on Windows (started by pi.ps1 in PowerShell, Pi's folder then being
``%USERPROFILE%\\.pi\\agent``).
"""

from __future__ import annotations

import argparse
import contextlib
import copy
import errno
import getpass
import hashlib
import json
import os
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
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple, Union

try:
    import fcntl
except ImportError:  # no fcntl on native Windows; the extension step locks with msvcrt there
    fcntl = None  # type: ignore[assignment]
if os.name == "nt":
    import msvcrt
else:
    msvcrt = None  # type: ignore[assignment]


API_BASE = "https://orchestrator.tenvor.io"
CATALOG_URL = f"{API_BASE}/api/catalog/public"
MODEL_ID = "chat-35b-moe"
PROVIDER_ID = "tenvor"
MODEL_REF = f"{PROVIDER_ID}/{MODEL_ID}"
# Pi asks for min(maxTokens, contextWindow - its own size estimate - 4,096) tokens of
# reply on every request. That estimate can fall short of Tenvor's exact count by more
# than the 4,096-token margin (code-heavy tool output, for example), and the Orchestrator
# refuses any request whose input plus reply allowance exceeds the window. With maxTokens
# equal to the window, every request asks for all the room that is left, so one such
# shortfall is enough, and Pi's compact-and-retry asks for all the room again. Capping
# the reply at Pi's default compaction reserve keeps the allowance inside the room Pi
# already leaves before it compacts.
PI_MAX_REPLY_TOKENS = 16_384
STATE_FILENAME = ".tenvor-pi-state.json"
STATE_VERSION = 1
CONSOLE_USAGE_URL = "https://tenvor.io/console?view=usage"

# Tenvor's Pi extension for the session cache. Pi loads every .ts or .js file in
# <agent folder>/extensions by itself (package-manager.ts collectAutoExtensionEntries), so nothing
# in settings.json needs editing. The text of the extension is CACHE_EXTENSION_SOURCE at the end of
# this file, generated from site/pi-extension/tenvor-session-kv.js by site/scripts/pin_pi_setup.py,
# which also keeps CACHE_EXTENSION_SHA256 and the pins of this file in step.
CACHE_EXTENSION_FILENAME = "tenvor-session-kv.js"
CACHE_EXTENSIONS_DIRNAME = "extensions"
CACHE_STATE_FILENAME = ".tenvor-pi-cache-state.json"
CACHE_STATE_VERSION = 1
MAX_EXTENSION_BYTES = 256 * 1024
# The whole extension step runs under one exclusive flock on this file in the Pi folder. A second run waits this long
# for it, then skips the extension with a one-line notice. The kernel drops the lock when its holder dies.
CACHE_LOCK_FILENAME = ".tenvor-pi-cache.lock"
CACHE_LOCK_WAIT_SECONDS = 30

# The Pi releases this setup and the cache extension were run against, a real session on each
# (12 October 2026), and whose documentation and source were read. Older Pi is stopped (its file
# formats were not tested); a newer minor or patch release is allowed with a note; the next major
# release is stopped. The guide on the site lists the same releases (PI_TESTED_VERSIONS in
# site/src/content/docs.ts), and tests/docsContract.test.ts fails until the two agree.
TESTED_PI_VERSIONS = ("1.1.0", "1.2.0")
REVIEWED_PI_VERSION = "1.2.0"  # the newest of them
MIN_PI_VERSION = (1, 1, 0)  # the oldest of them
FIRST_UNREVIEWED_MAJOR = 2

# Pi's own installer, offered only after an explicit yes. pi.dev serves it
# without a version in the address, so the reviewed copy is pinned by SHA-256.
# If Pi changes it, setup stops and says so; nothing unpinned is ever run.
# What it pins is the installer script and nothing it downloads afterwards.
# To check the pin without running anything:  curl -fsSL https://pi.dev/install.sh | sha256sum
# (site/scripts/check-pi-installer-pin.mjs does the same.) Nothing here pipes into a shell.
PI_SITE = "https://pi.dev"
PI_INSTALLER_URL = "https://pi.dev/install.sh"
PI_INSTALLER_SHA256 = "ff4ed7b1ea1c058f33249a44093863b50cf95224ab4ff654e722fcbbbdaa31df"
# The same for Windows: pi.dev's PowerShell installer, reviewed on 21 October 2026. To check the pin without running
# anything:  curl -fsSL https://pi.dev/install.ps1 | sha256sum   (site/scripts/check-pi-installer-pin.mjs checks both).
PI_WINDOWS_INSTALLER_URL = "https://pi.dev/install.ps1"
PI_WINDOWS_INSTALLER_SHA256 = "fd418a3bc57022b8ac1b823f8e42bf2f58b832482ee5e04739b4b4f783767228"
MAX_INSTALLER_BYTES = 128 * 1024
INSTALLER_TIMEOUT_SECONDS = 900
# What the child installer may see: nothing that could carry a Tenvor key.
INSTALLER_ENV_ALLOWLIST = (
    "HOME", "PATH", "SHELL", "TERM", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR",
    "XDG_DATA_HOME", "ZDOTDIR", "USER", "LOGNAME", "PI_CODING_AGENT_DIR",
    "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy",
    "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS", "CURL_CA_BUNDLE",
)
# What the Windows installer may see. Windows itself needs the first group to start programs and find the profile. Not
# passed on, among others: PI_INSTALLER_API_BASE (it would change where the installer downloads Pi from), PI_LEGACY_INSTALL
# and PI_MANAGED_INSTALL_ROOT, NODE_OPTIONS and NODE_PATH (they can load code into Node), and npm_config_* settings.
# Windows compares these names without regard to case, and Python reports them in capitals there.
WINDOWS_INSTALLER_ENV_ALLOWLIST = (
    "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "SYSTEMDRIVE", "OS",
    "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "USERNAME", "USERDOMAIN", "COMPUTERNAME",
    "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "ALLUSERSPROFILE", "PUBLIC",
    "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432", "COMMONPROGRAMFILES", "COMMONPROGRAMFILES(X86)", "COMMONPROGRAMW6432",
    "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "PROCESSOR_ARCHITEW6432", "TERM", "PI_CODING_AGENT_DIR",
    "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS", "CURL_CA_BUNDLE",
)
NODE_MINIMUM = (22, 19, 0)

MAX_CATALOG_BYTES = 1024 * 1024
MAX_CONFIG_BYTES = 1024 * 1024
# Pi's auth.json and settings.json are guarded by proper-lockfile, which makes a
# "<file>.lock" directory and treats one older than Pi's own `stale` setting as
# abandoned (auth-storage.ts: stale: 30_000). This setup takes the same lock.
LOCK_FRESH_SECONDS = 30
# A temporary file of this setup's that is older than this was left by a killed run.
STALE_TEMPORARY_SECONDS = 30
JSON_MAX_DEPTH = 64


# ---------------------------------------------------------------------------
# Windows. The setup also runs on native Windows, where pi.ps1 starts it from PowerShell. Windows has no POSIX
# permission bits, no owner id that Python can compare, no sudo and no directory descriptors, and each place
# where that matters says what it does instead. A file this setup writes in Pi's folder keeps the permissions
# of the user profile it is in: by default only you, administrators and the system can read it. Pi keeps its
# own auth.json the same way there.
# ---------------------------------------------------------------------------

WINDOWS = os.name == "nt"
# Without O_BINARY, Windows opens an os.open file in text mode and changes its line endings.
_O_BINARY = getattr(os, "O_BINARY", 0)
_O_NOINHERIT = getattr(os, "O_NOINHERIT", 0)
# A reparse point that stands for another path (a symbolic link or a junction) has this bit in its tag.
_NAME_SURROGATE = 0x20000000
# What Windows says when a folder cannot hold hard links: ERROR_INVALID_FUNCTION, ERROR_NOT_SAME_DEVICE,
# ERROR_NOT_SUPPORTED and ERROR_TOO_MANY_LINKS.
_WINDOWS_NO_HARD_LINKS = (1, 17, 50, 1142)
# Pi's installer for Windows, run by Windows PowerShell 5.1, which every supported Windows has.
WINDOWS_POWERSHELL = ("System32", "WindowsPowerShell", "v1.0", "powershell.exe")


def _set_mode(descriptor: int, mode: int) -> None:
    """Give a file this setup writes its mode. On Windows there is no mode to give: the file keeps its folder's permissions."""
    if not WINDOWS:
        os.fchmod(descriptor, mode)


def _owned_by_me(info: "os.stat_result") -> bool:
    """Is the file yours? Windows reports no owner to compare. The files checked are inside your own Pi folder."""
    return WINDOWS or info.st_uid == os.geteuid()


def _is_link_stat(info: "os.stat_result") -> bool:
    """A symlink, or on Windows also a junction or another reparse point that stands for another path."""
    return stat.S_ISLNK(info.st_mode) or (WINDOWS and bool(getattr(info, "st_reparse_tag", 0) & _NAME_SURROGATE))


def _is_link(path: Path) -> bool:
    if not WINDOWS:
        return path.is_symlink()
    try:
        return _is_link_stat(os.lstat(str(path)))
    except OSError:
        return False


def which(command: str) -> Optional[str]:
    """Find a program on PATH. On Windows, only the folders on PATH are searched, and only for a program or a command
    script (.exe, .com, .cmd, .bat). Windows, and shutil.which there, would look in the current folder first, and a
    curl.exe or node.exe saved in the folder the launcher was downloaded to must not be the one that runs."""
    if not WINDOWS:
        return shutil.which(command)
    allowed = {".com", ".exe", ".bat", ".cmd"}
    extensions = [part.lower() for part in os.environ.get("PATHEXT", "").split(";") if part.lower() in allowed]
    for folder in os.environ.get("PATH", "").split(os.pathsep):
        folder = folder.strip().strip('"')
        if not folder or not os.path.isabs(folder):
            continue
        for extension in extensions or [".com", ".exe", ".bat", ".cmd"]:
            candidate = os.path.join(folder, command + extension)
            if os.path.isfile(candidate):
                return candidate
    return None


def _system_folder(*parts: str) -> Optional[str]:
    """A file in the Windows folder, found from SystemRoot, never from PATH or the current folder."""
    root = os.environ.get("SystemRoot") or os.environ.get("windir")
    if not root or not os.path.isabs(root):
        return None
    candidate = os.path.join(root, *parts)
    return candidate if os.path.isfile(candidate) else None


def _curl_program() -> Optional[str]:
    """Windows 10 and 11 ship curl.exe in System32, which is preferred to any other copy there."""
    if WINDOWS:
        found = _system_folder("System32", "curl.exe")
        if found:
            return found
    return which("curl")


def _powershell_quote(value: str) -> str:
    """A PowerShell single-quoted string, in which nothing is expanded. PowerShell reads the four curly single quotes as
    quotes too, so each of those is doubled as well as '."""
    return "'" + "".join(character * 2 if character in "'\u2018\u2019\u201a\u201b" else character for character in value) + "'"


_BUSY_RETRIES = 6


def _retry_if_busy(operation: Any) -> Any:
    """Run one file operation. Windows briefly refuses to replace, rename or delete a file that a virus scanner or the
    search indexer has just opened, so there, and only there, it waits a moment and tries again (about 1.5 s in all)."""
    delay = 0.05
    for attempt in range(_BUSY_RETRIES):
        try:
            return operation()
        except PermissionError:
            if not WINDOWS or attempt == _BUSY_RETRIES - 1:
                raise
            time.sleep(delay)
            delay *= 2
    return None


def _replace_file(source: Path, target: Path) -> None:
    _retry_if_busy(lambda: os.replace(source, target))


def _delete_file(path: Path) -> None:
    _retry_if_busy(lambda: path.unlink(missing_ok=True))


def shell_command(arguments: List[str]) -> str:
    """A command to paste into this person's shell: POSIX quoting, or PowerShell's on Windows (where a program path
    in quotes needs the call operator &)."""
    if not WINDOWS:
        return shlex.join(arguments)
    plain = re.compile(r"[A-Za-z0-9_./:=\\-]+")  # no , @ $ ` ; ( ) or space: PowerShell gives those a meaning
    words = [word if plain.fullmatch(word) else _powershell_quote(word) for word in arguments]
    if words and words[0].startswith("'"):
        words.insert(0, "&")
    return " ".join(words)


class SetupError(RuntimeError):
    """A safe, user-actionable setup failure. Its text never carries file contents."""


# ---------------------------------------------------------------------------
# Network: every request goes through curl, so macOS needs no Python certificates,
# the person's proxy settings apply, and the tests replace one command.
# ---------------------------------------------------------------------------

def curl_fetch(url: str, *, max_bytes: int, timeout: int, accept: Optional[str] = None) -> bytes:
    curl = _curl_program()
    if curl is None:
        raise SetupError("curl is required. Install it, then run this setup again.")
    command = [
        curl, "-q", "--proto", "=https", "--tlsv1.2", "--fail", "--silent", "--show-error",
        "--max-time", str(timeout), "--max-filesize", str(max_bytes),
        "-H", "User-Agent: Tenvor-Pi-Setup/1",
    ]
    if accept:
        command += ["-H", f"Accept: {accept}"]
    command.append(url)
    try:
        result = subprocess.run(
            command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            timeout=timeout + 15,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise SetupError(f"Could not run curl: {exc.__class__.__name__}.") from exc
    if result.returncode != 0:
        raise SetupError(f"curl could not fetch {url} (exit {result.returncode}).")
    if len(result.stdout) > max_bytes:
        raise SetupError(f"The response from {url} exceeded the safety limit.")
    return result.stdout


def _bounded_positive_int(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise SetupError(f"The public catalog returned an invalid {field}.")
    if value > 16_777_216:
        raise SetupError(f"The public catalog returned an implausible {field}.")
    return value


# Pi has seven thinking levels: off, minimal, low, medium, high, xhigh and max. Tenvor's reasoning_effort takes
# none, low, medium, high and max (xhigh is API-only, and "minimal" is only an alias for low), so Pi's levels map
# onto Tenvor's like this. The mapping is Pi's models[].thinkingLevelMap: a string is the value Pi sends for that
# level, and null hides the level from Pi's /thinking menu and Shift+Tab cycling (Pi then rounds a request for
# it up to the next level it has). Pi shows xhigh and max only when they are mapped to a string.
THINKING_LEVEL_MAP = {
    "off": "none", "minimal": None, "low": "low", "medium": "medium", "high": "high", "xhigh": None, "max": "max",
}
# What the catalog must offer, and not mark API-only, before any of it is written: every value the map sends.
THINKING_LEVELS = tuple(sorted({value for value in THINKING_LEVEL_MAP.values() if value is not None}))


def advertises_thinking(sku: Dict[str, Any]) -> bool:
    """True only when the catalog says the server takes reasoning_effort and offers the levels used here.

    The same object is published as data[].tenvor.reasoning by /v1/models. A server that does not publish it
    (an older one) must not be sent reasoning_effort: it refuses any field it does not know."""
    advert = sku.get("reasoning")
    if not isinstance(advert, dict) or advert.get("supported") is not True or advert.get("parameter") != "reasoning_effort":
        return False
    levels = advert.get("levels")
    if not isinstance(levels, list):
        return False
    offered = {level.get("id") for level in levels if isinstance(level, dict) and level.get("api_only") is not True}
    return set(THINKING_LEVELS) <= offered


def validate_catalog(payload: Any) -> Dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get("skus"), list):
        raise SetupError("The public catalog response is not in the expected format.")
    model = next(
        (
            sku for sku in payload["skus"]
            if isinstance(sku, dict) and sku.get("tag") == MODEL_ID and sku.get("availability") == "available"
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
    return {"display_name": display_name.strip(), "context": context, "output": output, "reasoning": advertises_thinking(model)}


def fetch_catalog_model() -> Dict[str, Any]:
    raw = curl_fetch(CATALOG_URL, max_bytes=MAX_CATALOG_BYTES, timeout=15, accept="application/json")
    try:
        return validate_catalog(json.loads(raw.decode("utf-8")))
    except (ValueError, UnicodeDecodeError) as exc:
        raise SetupError("The public catalog did not return valid JSON.") from exc


# ---------------------------------------------------------------------------
# The entries this setup owns. Field names are Pi's: providers.<id>.{name,
# baseUrl, api, compat, models[]}, models[].{id,name,reasoning,input,
# contextWindow,maxTokens} (models.json); <id>.{type,key} (auth.json);
# defaultProvider / defaultModel (settings.json).
# ---------------------------------------------------------------------------

def provider_config(model: Dict[str, Any]) -> Dict[str, Any]:
    # Whether the model thinks is decided by the catalog (see advertises_thinking). Pi then sends its thinking
    # level as reasoning_effort, translated by the model's thinkingLevelMap, and shows the reasoning_content the
    # reply streams back. With thinking off in Pi it sends "none", which is the server's own default: a direct reply.
    # compat.thinkingFormat names the request dialect Pi uses, not the field. "openai" is the dialect that sends
    # reasoning_effort. Pi accepts only its own list of dialect names: this setup once wrote "reasoning_effort"
    # there, which fails Pi's models.json schema, and Pi then drops every custom provider in the file.
    thinking = model.get("reasoning") is True
    compat: Dict[str, Any] = {"supportsStore": False, "supportsDeveloperRole": False, "supportsReasoningEffort": thinking}
    if thinking:
        compat["thinkingFormat"] = "openai"
    compat.update({"supportsStrictMode": False, "supportsLongCacheRetention": False, "maxTokensField": "max_tokens"})
    entry = {
        "id": MODEL_ID,
        "name": f"Tenvor {model['display_name']}",
        "reasoning": thinking,
        "input": ["text"],
        "contextWindow": model["context"],
        "maxTokens": min(model["output"], PI_MAX_REPLY_TOKENS),
    }
    if thinking:
        entry["thinkingLevelMap"] = dict(THINKING_LEVEL_MAP)
    return {
        "name": "Tenvor",
        "baseUrl": f"{API_BASE}/v1",
        "api": "openai-completions",
        # Tenvor's chat endpoint rejects any field outside its documented set, so
        # switch off what Pi would otherwise add for a host it does not recognise:
        # store, the developer role, strict tool schemas, and the long cache-retention
        # request field. reasoning_effort stays off unless the catalog says it is taken.
        "compat": compat,
        "models": [entry],
    }


def credential_entry(api_key: str) -> Dict[str, Any]:
    return {"type": "api_key", "key": api_key}


# The Orchestrator issues "sk-dc-" and 48 lowercase hexadecimal characters (24 random
# bytes). Anything else is a typo or a different kind of key. This also keeps `$` and
# a leading `!` out of auth.json, where Pi would read them as a variable or a command.
# If the server ever changes the format, change this pattern and re-pin the launcher.
API_KEY_PATTERN = re.compile(r"sk-dc-[0-9a-f]{48}")


def validate_api_key(value: str) -> str:
    key = value.strip()
    if not key.startswith("sk-dc-"):
        raise SetupError("That does not look like a Tenvor API key (expected sk-dc-…).")
    if len(key) > 4096 or API_KEY_PATTERN.fullmatch(key) is None:
        raise SetupError(
            "That is not a complete Tenvor API key. Keys are sk-dc- followed by 48 characters (0-9 and a-f); "
            "copy the whole key from the Console."
        )
    return key


def key_digest(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# JSON text editing. The file is scanned for the byte positions of its members,
# then new text is spliced in or an existing member cut out. Nothing else in the
# file is read back or rewritten, so comments, key order, spacing, number and
# string spellings all survive. models.json may carry // comments, which Pi
# accepts there; settings.json and auth.json are strict JSON in Pi.
# ---------------------------------------------------------------------------

class _Problem(Exception):
    def __init__(self, reason: str, offset: int = -1) -> None:
        super().__init__(reason)
        self.reason = reason
        self.offset = offset


class _Member:
    __slots__ = ("key", "key_start", "value")

    def __init__(self, key: str, key_start: int, value: "_Node") -> None:
        self.key = key
        self.key_start = key_start
        self.value = value


class _Node:
    __slots__ = ("kind", "start", "end", "members", "items")

    def __init__(self, kind: str, start: int, end: int, members: Optional[List[_Member]] = None,
                 items: Optional[List["_Node"]] = None) -> None:
        self.kind = kind
        self.start = start
        self.end = end
        self.members = members if members is not None else []
        self.items = items if items is not None else []


_NUMBER = re.compile(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?")


class _Scanner:
    def __init__(self, text: str, line_comments: bool) -> None:
        self.text = text
        self.size = len(text)
        self.line_comments = line_comments

    def skip(self, i: int) -> int:
        text, size = self.text, self.size
        while i < size:
            char = text[i]
            if char in " \t\r\n":
                i += 1
            elif self.line_comments and char == "/" and text.startswith("//", i):
                end = text.find("\n", i)
                i = size if end < 0 else end
            else:
                break
        return i

    def root(self) -> _Node:
        i = 1 if self.text.startswith("﻿") else 0
        i = self.skip(i)
        node, i = self.value(i, 0)
        i = self.skip(i)
        if i != self.size:
            raise _Problem("unexpected text after the JSON value", i)
        return node

    def value(self, i: int, depth: int) -> Tuple[_Node, int]:
        if depth > JSON_MAX_DEPTH:
            raise _Problem("nested too deeply", i)
        if i >= self.size:
            raise _Problem("the file ends early", i)
        char = self.text[i]
        if char == "{":
            return self.object(i, depth)
        if char == "[":
            return self.array(i, depth)
        if char == '"':
            end = self.string_end(i)
            return _Node("string", i, end), end
        match = _NUMBER.match(self.text, i)
        if match and match.end() > i:
            return _Node("number", i, match.end()), match.end()
        for literal in ("true", "false", "null"):
            if self.text.startswith(literal, i):
                return _Node("literal", i, i + len(literal)), i + len(literal)
        raise _Problem("unexpected character", i)

    def string_end(self, i: int) -> int:
        text, size = self.text, self.size
        j = i + 1
        while j < size:
            char = text[j]
            if char == "\\":
                j += 2
                continue
            if char == '"':
                try:
                    json.loads(text[i:j + 1])
                except ValueError:
                    raise _Problem("invalid string", i)
                return j + 1
            if ord(char) < 0x20:
                raise _Problem("control character in a string", j)
            j += 1
        raise _Problem("unterminated string", i)

    def object(self, start: int, depth: int) -> Tuple[_Node, int]:
        members: List[_Member] = []
        i = self.skip(start + 1)
        if i < self.size and self.text[i] == "}":
            return _Node("object", start, i + 1, members), i + 1
        while True:
            i = self.skip(i)
            if i >= self.size or self.text[i] != '"':
                raise _Problem("expected a quoted key", i)
            key_end = self.string_end(i)
            key = json.loads(self.text[i:key_end])
            key_start = i
            i = self.skip(key_end)
            if i >= self.size or self.text[i] != ":":
                raise _Problem("expected a colon", i)
            i = self.skip(i + 1)
            value, i = self.value(i, depth + 1)
            members.append(_Member(key, key_start, value))
            i = self.skip(i)
            if i >= self.size:
                raise _Problem("the file ends early", i)
            if self.text[i] == ",":
                i += 1
                continue
            if self.text[i] == "}":
                return _Node("object", start, i + 1, members), i + 1
            raise _Problem("expected a comma or a closing brace", i)

    def array(self, start: int, depth: int) -> Tuple[_Node, int]:
        items: List[_Node] = []
        i = self.skip(start + 1)
        if i < self.size and self.text[i] == "]":
            return _Node("array", start, i + 1, items=items), i + 1
        while True:
            i = self.skip(i)
            value, i = self.value(i, depth + 1)
            items.append(value)
            i = self.skip(i)
            if i >= self.size:
                raise _Problem("the file ends early", i)
            if self.text[i] == ",":
                i += 1
                continue
            if self.text[i] == "]":
                return _Node("array", start, i + 1, items=items), i + 1
            raise _Problem("expected a comma or a closing bracket", i)


def _scan(text: str, line_comments: bool) -> _Node:
    node = _Scanner(text, line_comments).root()
    if node.kind != "object":
        raise _Problem("the top level is not a JSON object")
    return node


def _to_python(text: str, node: _Node) -> Any:
    if node.kind == "object":
        return {member.key: _to_python(text, member.value) for member in node.members}
    if node.kind == "array":
        return [_to_python(text, item) for item in node.items]
    return json.loads(text[node.start:node.end])


def _find(node: _Node, key: str) -> Optional[_Member]:
    found = [member for member in node.members if member.key == key]
    if len(found) > 1:
        raise _Problem(f'the key "{key}" appears more than once')
    return found[0] if found else None


def _check_unique(node: _Node) -> None:
    keys = [member.key for member in node.members]
    if len(keys) != len(set(keys)):
        raise _Problem("an object has a repeated key")


def _line_indent(text: str, position: int) -> str:
    start = text.rfind("\n", 0, position) + 1
    end = start
    while end < len(text) and text[end] in " \t":
        end += 1
    return text[start:end]


def _first_on_line(text: str, position: int) -> bool:
    start = text.rfind("\n", 0, position) + 1
    return text[start:position].strip(" \t") == ""


def _indent_unit(text: str) -> str:
    for line in text.split("\n"):
        stripped = line.lstrip(" \t")
        if stripped and stripped != line and not stripped.startswith(("}", "]")):
            indent = line[: len(line) - len(stripped)]
            if "\t" in indent:
                return "\t"
            if 1 <= len(indent) <= 8:
                return indent
    return "  "


def _newline(text: str) -> str:
    return "\r\n" if "\r\n" in text else "\n"


def _pretty_file(text: str) -> bool:
    return "\n" in text.strip()


def _render(value: Any, unit: str, nl: str, indent: str, pretty: bool) -> str:
    if not pretty:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    body = json.dumps(value, ensure_ascii=False, indent=unit)
    return body.replace("\n", nl + indent)


def _insert_member(text: str, obj: _Node, key: str, value: Any, line_comments: bool, is_root: bool) -> str:
    unit, nl = _indent_unit(text), _newline(text)
    base = _line_indent(text, obj.start)
    key_text = json.dumps(key, ensure_ascii=False)
    if not obj.members:
        # An object that holds only // comments keeps them: the entry goes in right after the
        # opening brace and everything that was inside stays where it was.
        if line_comments and "//" in text[obj.start + 1:obj.end - 1]:
            member_indent = base + unit
            member = key_text + ": " + _render(value, unit, nl, member_indent, True)
            return text[:obj.start + 1] + nl + member_indent + member + text[obj.start + 1:]
        # An empty object has no style of its own: an empty file gets the usual layout,
        # and a nested empty object follows the file around it.
        pretty = is_root or _pretty_file(text) or "\n" in text[obj.start:obj.end]
        if not pretty:
            replacement = "{" + key_text + ":" + _render(value, unit, nl, "", False) + "}"
        else:
            member_indent = base + unit
            replacement = "{" + nl + member_indent + key_text + ": " + _render(value, unit, nl, member_indent, True) + nl + base + "}"
        return text[:obj.start] + replacement + text[obj.end:]
    last = obj.members[-1]
    insert_at = last.value.end
    if "\n" not in text[obj.start:obj.end]:
        return text[:insert_at] + "," + key_text + ":" + _render(value, unit, nl, "", False) + text[insert_at:]
    first = obj.members[0]
    member_indent = _line_indent(text, first.key_start) if _first_on_line(text, first.key_start) else base + unit
    # A same-line // comment after the last value stays attached to that value.
    after = insert_at
    if line_comments:
        probe = insert_at
        while probe < len(text) and text[probe] in " \t":
            probe += 1
        if text.startswith("//", probe):
            end = text.find("\n", probe)
            after = len(text) if end < 0 else end
            if after > probe and text[after - 1] == "\r":
                after -= 1
    member = key_text + ": " + _render(value, unit, nl, member_indent, True)
    return text[:insert_at] + "," + text[insert_at:after] + nl + member_indent + member + text[after:]


def _replace_value(text: str, member: _Member, value: Any) -> str:
    unit, nl = _indent_unit(text), _newline(text)
    pretty = _pretty_file(text)
    indent = _line_indent(text, member.key_start)
    return text[:member.value.start] + _render(value, unit, nl, indent, pretty) + text[member.value.end:]


def edit_set(text: str, path: List[str], value: Any, line_comments: bool) -> str:
    """Set the member at ``path`` to ``value``, creating missing objects on the way."""
    root = _scan(text, line_comments)
    node = root
    for depth, key in enumerate(path[:-1]):
        _check_unique(node)
        member = _find(node, key)
        if member is None:
            nested = value
            for inner in reversed(path[depth + 1:]):
                nested = {inner: nested}
            return _insert_member(text, node, key, nested, line_comments, node is root)
        if member.value.kind != "object":
            raise _Problem(f'"{key}" is not a JSON object')
        node = member.value
    _check_unique(node)
    member = _find(node, path[-1])
    if member is None:
        return _insert_member(text, node, path[-1], value, line_comments, node is root)
    return _replace_value(text, member, value)


def edit_remove(text: str, path: List[str], line_comments: bool) -> str:
    """Cut the member at ``path`` out, together with its comma. A missing member is a no-op."""
    root = _scan(text, line_comments)
    scanner = _Scanner(text, line_comments)
    node = root
    for key in path[:-1]:
        _check_unique(node)
        member = _find(node, key)
        if member is None:
            return text
        if member.value.kind != "object":
            raise _Problem(f'"{key}" is not a JSON object')
        node = member.value
    _check_unique(node)
    index = next((n for n, member in enumerate(node.members) if member.key == path[-1]), None)
    if index is None:
        return text
    members = node.members
    target = members[index]
    if len(members) == 1:
        # Comments that were beside the entry stay; with none, the object goes back to {}.
        before = text[node.start + 1:target.key_start]
        after = text[target.value.end:node.end - 1]
        kept = (before if line_comments and "//" in before else "") + (after if line_comments and "//" in after else "")
        return text[:node.start] + "{" + kept + "}" + text[node.end:]
    if index == len(members) - 1:
        comma = scanner.skip(members[index - 1].value.end)
        before = target.key_start
        while before > 0 and text[before - 1] in " \t\r\n":
            before -= 1
        if before == comma + 1:
            return text[:comma] + text[target.value.end:]
        return text[:comma] + text[comma + 1:before] + text[target.value.end:]
    line_start = text.rfind("\n", 0, target.key_start) + 1
    whole_line = _first_on_line(text, target.key_start)
    start = line_start if whole_line else target.key_start
    comma = scanner.skip(target.value.end)
    end = comma + 1
    if whole_line:
        probe = end
        while probe < len(text) and text[probe] in " \t\r":
            probe += 1
        if probe < len(text) and text[probe] == "\n":
            end = probe + 1
    else:
        end = members[index + 1].key_start
    return text[:start] + text[end:]


def read_python(text: str, line_comments: bool, name: str) -> Dict[str, Any]:
    """The parsed top-level object of a config file, with a safe error that quotes none of it."""
    try:
        root = _scan(text, line_comments)
        value = _to_python(text, root)
    except _Problem as problem:
        where = f" near offset {problem.offset}" if problem.offset >= 0 else ""
        hint = (
            " (// comments are fine; trailing commas and /* */ comments are not)" if line_comments else ""
        )
        raise SetupError(
            f"{name} is not JSON that this setup can edit safely: {problem.reason}{where}{hint}. "
            "It was left untouched. Fix or move that file, then run this setup again."
        ) from None
    return value


def splice(name: str, action: Any) -> str:
    try:
        return action()
    except _Problem as problem:
        where = f" near offset {problem.offset}" if problem.offset >= 0 else ""
        raise SetupError(f"{name} could not be edited safely: {problem.reason}{where}. It was left untouched.") from None


# ---------------------------------------------------------------------------
# Files: reading with refusals, atomic multi-file replacement, backups.
# ---------------------------------------------------------------------------

class ManagedFile:
    def __init__(self, directory: Path, name: str, line_comments: bool) -> None:
        self.path = directory / name
        self.name = name
        self.line_comments = line_comments
        self.exists = False
        self.text = ""
        self.mode: Optional[int] = None
        self.raw: Optional[bytes] = None
        path = self.path
        if path.is_symlink():
            raise SetupError(
                f"Refusing to modify {path}: it is a symlink. Edit it by hand, or point Pi at a real file."
            )
        if not path.exists():
            return
        if not path.is_file():
            raise SetupError(f"{path} is not a regular file.")
        info = path.stat()
        if info.st_size > MAX_CONFIG_BYTES:
            raise SetupError(f"{path} is larger than the 1 MiB safety limit.")
        raw = path.read_bytes()
        try:
            self.text = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise SetupError(f"{path} is not UTF-8 text.") from None
        self.exists = True
        self.raw = raw
        self.mode = stat.S_IMODE(info.st_mode)

    @property
    def blank(self) -> bool:
        return not self.text.replace("﻿", "").strip()

    @property
    def base_text(self) -> str:
        return "{}" if self.blank else self.text

    def python(self) -> Dict[str, Any]:
        if self.blank:
            return {}
        return read_python(self.text, self.line_comments, self.name)

    def refuse_if_pi_is_writing(self) -> None:
        lock = self.path.with_name(self.name + ".lock")
        try:
            age = time.time() - lock.lstat().st_mtime
        except OSError:
            return
        if age < LOCK_FRESH_SECONDS:
            raise SetupError(
                f"Pi is writing {self.name} right now ({lock.name} exists). "
                "Close Pi, wait a minute, and run this setup again. Nothing was changed."
            )


def _stage_write(path: Path, data: bytes, mode: int) -> Path:
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.tenvor-", dir=str(path.parent))
    temporary = Path(temporary_name)
    try:
        _set_mode(descriptor, mode)
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
        temporary.unlink(missing_ok=True)
        raise


def _snapshot(path: Path) -> Optional[Tuple[bytes, int]]:
    if path.is_symlink():
        raise SetupError(f"Refusing to modify symlinked managed path: {path}")
    if not path.exists():
        return None
    if not path.is_file():
        raise SetupError(f"Managed path is not a regular file: {path}")
    return path.read_bytes(), stat.S_IMODE(path.stat().st_mode)


def _atomic_write(path: Path, data: bytes, mode: int) -> None:
    temporary = _stage_write(path, data, mode)
    try:
        _replace_file(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


Snapshots = Dict[Path, Optional[Tuple[bytes, int]]]


def transactional_update(writes: List[Tuple[Path, bytes, int]], deletes: List[Path]) -> Snapshots:
    """Replace every file or none. A failure, an interrupt or a signal restores what was there.
    It returns what was there, so that a caller can put it back later."""
    targets = [path for path, _, _ in writes] + list(deletes)
    if len(targets) != len(set(targets)):
        raise SetupError("The managed update contains a duplicate path.")
    snapshots = {path: _snapshot(path) for path in targets}
    staged: List[Tuple[Path, Path]] = []
    try:
        for path, data, mode in writes:
            staged.append((path, _stage_write(path, data, mode)))
    except BaseException:
        for _, temporary in staged:
            temporary.unlink(missing_ok=True)
        raise
    try:
        for path, temporary in staged:
            _replace_file(temporary, path)
        for path in deletes:
            _delete_file(path)
    except BaseException as exc:
        problems: List[str] = []
        for path, snapshot in snapshots.items():
            try:
                if snapshot is None:
                    _delete_file(path)
                else:
                    _atomic_write(path, snapshot[0], snapshot[1])
            except BaseException as rollback:
                problems.append(f"{path}: {rollback.__class__.__name__}")
        for _, temporary in staged:
            temporary.unlink(missing_ok=True)
        if problems:
            raise SetupError(
                "The update failed and putting the files back was incomplete: " + "; ".join(problems)
            ) from exc
        if isinstance(exc, (KeyboardInterrupt, SystemExit)):
            raise
        raise SetupError("The update failed; every changed file was put back.") from exc
    return snapshots


def restore_snapshots(snapshots: Snapshots) -> None:
    """Put the files back as they were before a run. Used when Pi does not accept what was written."""
    writes = [(path, saved[0], saved[1]) for path, saved in snapshots.items() if saved is not None]
    deletes = [path for path, saved in snapshots.items() if saved is None]
    transactional_update(writes, deletes)


def write_backup(path: Path) -> Path:
    """Copy ``path`` beside itself, owner-only: auth.json and models.json can hold credentials."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    candidate = path.with_name(f"{path.name}.backup-{stamp}")
    counter = 1
    while candidate.exists() or candidate.is_symlink():
        candidate = path.with_name(f"{path.name}.backup-{stamp}-{counter}")
        counter += 1
    data = path.read_bytes()
    descriptor = os.open(str(candidate), os.O_WRONLY | os.O_CREAT | os.O_EXCL | _O_BINARY, 0o600)
    with os.fdopen(descriptor, "wb") as output:
        output.write(data)
        output.flush()
        os.fsync(output.fileno())
    return candidate


class HeldLocks:
    """Hold Pi's own lock on a file for the few milliseconds it is replaced.

    Pi guards auth.json and settings.json with proper-lockfile, which makes a
    ``<file>.lock`` directory (auth-storage.ts, settings-manager.ts). Taking that
    same lock means a Pi session that is refreshing a login waits for this setup,
    or this setup stops, instead of one overwriting the other.
    """

    def __init__(self, directory: Path, names: List[str]) -> None:
        self.directory = directory
        self.names = sorted(set(names))
        self.held: List[Path] = []

    def __enter__(self) -> "HeldLocks":
        try:
            for name in self.names:
                self._take(name)
        except BaseException:
            self.__exit__(None, None, None)
            raise
        return self

    def _take(self, name: str) -> None:
        lock = self.directory / (name + ".lock")
        for _ in range(2):
            try:
                os.mkdir(str(lock), 0o700)
                self.held.append(lock)
                return
            except FileExistsError:
                try:
                    age = time.time() - lock.lstat().st_mtime
                except OSError:
                    continue
                if age < LOCK_FRESH_SECONDS:
                    raise SetupError(
                        f"Pi is writing {name} right now ({lock.name} exists). "
                        "Close Pi, wait a minute, and run this setup again. Nothing was changed."
                    ) from None
                try:  # a lock Pi abandoned long ago
                    os.rmdir(str(lock))
                except OSError:
                    raise SetupError(f"{lock.name} is left over and could not be cleared. Nothing was changed.") from None
        raise SetupError(f"Could not take Pi's lock on {name}. Nothing was changed.")

    def __exit__(self, *_exc: Any) -> None:
        for lock in reversed(self.held):
            try:
                os.rmdir(str(lock))
            except OSError:
                pass
        self.held = []


_LEFTOVER_TEMPORARY = re.compile(r"^\..+\.tenvor-[A-Za-z0-9_]{6,}$")
_CREDENTIAL_BACKUP = re.compile(r"^auth\.json\.backup-\d{8}T\d{6}Z(?:-\d+)?$")


def tidy_leftovers(directory: Path) -> None:
    """Remove what a killed run of this setup can leave behind: a staged temporary file (it can hold
    the key) and an auth.json copy (it holds credentials). Both are this setup's own, by name."""
    if _is_link(directory) or not directory.is_dir():
        return
    now, me = time.time(), (None if WINDOWS else os.geteuid())
    for entry in directory.iterdir():
        temporary = _LEFTOVER_TEMPORARY.match(entry.name) is not None
        if not temporary and _CREDENTIAL_BACKUP.match(entry.name) is None:
            continue
        try:
            info = entry.lstat()
        except OSError:
            continue
        if not stat.S_ISREG(info.st_mode) or (not WINDOWS and info.st_uid != me):
            continue
        if temporary and now - info.st_mtime < STALE_TEMPORARY_SECONDS:
            continue
        try:
            entry.unlink()
        except OSError:
            pass


# Where a run has got to, so that an interrupt after the files were written is not
# reported as if nothing had been written.
_PHASE: Dict[str, Optional[str]] = {"committed": None}


# ---------------------------------------------------------------------------
# The state file: what setup added, so setup can be repeated and undone.
# ---------------------------------------------------------------------------

def _is_hex64(value: Any) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


def _valid_slot(slot: Any) -> bool:
    if not isinstance(slot, dict) or not isinstance(slot.get("present"), bool):
        return False
    return set(slot) == ({"present", "value"} if slot["present"] else {"present"})


def read_state(path: Path) -> Optional[Dict[str, Any]]:
    if path.is_symlink():
        raise SetupError(f"Refusing to read symlinked setup state: {path}")
    if not path.exists():
        return None
    if not path.is_file() or path.stat().st_size > MAX_CONFIG_BYTES:
        raise SetupError(f"Setup state is not a regular, bounded file: {path}")
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise SetupError(f"The Tenvor setup state in {path} is not valid JSON.") from None
    try:
        models, auth, settings = state["models"], state["auth"], state["settings"]
        valid = (
            isinstance(state, dict) and set(state) == {"version", "models", "auth", "settings"}
            and state["version"] == STATE_VERSION
            and set(models) == {"existed", "providers_created", "entry", "owned", "sha256"}
            and isinstance(models["existed"], bool) and isinstance(models["providers_created"], bool)
            and isinstance(models["entry"], dict) and isinstance(models["owned"], bool) and _is_hex64(models["sha256"])
            and set(auth) == {"existed", "key_sha256", "owned", "sha256"}
            and isinstance(auth["existed"], bool) and _is_hex64(auth["key_sha256"])
            and isinstance(auth["owned"], bool) and _is_hex64(auth["sha256"])
            and set(settings) == {"existed", "managed", "previous", "sha256"}
            and isinstance(settings["existed"], bool) and isinstance(settings["managed"], bool)
            and _is_hex64(settings["sha256"]) and isinstance(settings["previous"], dict)
            and set(settings["previous"]) == {"provider", "model"}
            and _valid_slot(settings["previous"]["provider"]) and _valid_slot(settings["previous"]["model"])
        )
    except (KeyError, TypeError):
        valid = False
    if not valid:
        raise SetupError(f"The Tenvor setup state in {path} has an unsupported format. Nothing was changed.")
    return state


def encode_state(state: Dict[str, Any]) -> bytes:
    return (json.dumps(state, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def _slot(settings: Dict[str, Any], key: str) -> Dict[str, Any]:
    return {"present": True, "value": settings[key]} if key in settings else {"present": False}


# ---------------------------------------------------------------------------
# Locating Pi, and the optional pinned install.
# ---------------------------------------------------------------------------

def resolve_agent_dir() -> Path:
    explicit = os.environ.get("PI_CODING_AGENT_DIR", "").strip()
    directory = Path(os.path.expanduser(explicit)) if explicit else Path.home() / ".pi" / "agent"
    if not directory.is_absolute():
        raise SetupError("PI_CODING_AGENT_DIR must be an absolute path.")
    return directory


def resolve_pi(agent_dir: Path) -> Optional[str]:
    found = which("pi")
    if found:
        return os.path.abspath(found)
    home = Path.home()
    if WINDOWS:
        # Pi's installer for Windows writes <agent folder>\bin\pi.cmd (and pi.ps1, and a pi for Git Bash, which Windows
        # cannot start); an npm install puts pi.cmd in %APPDATA%\npm. Found here, Pi works before PATH is reloaded.
        candidates = [agent_dir / "bin" / "pi.cmd", home / ".pi" / "agent" / "bin" / "pi.cmd"]
        appdata = os.environ.get("APPDATA", "")
        if appdata and os.path.isabs(appdata):
            candidates.append(Path(appdata) / "npm" / "pi.cmd")
        for candidate in candidates:
            if candidate.is_absolute() and candidate.is_file():
                return str(candidate)
        return None
    for candidate in (
        agent_dir / "bin" / "pi", home / ".pi" / "agent" / "bin" / "pi", home / ".local" / "bin" / "pi",
        home / "bin" / "pi", Path("/opt/homebrew/bin/pi"), Path("/usr/local/bin/pi"),
    ):
        if candidate.is_absolute() and candidate.is_file() and os.access(str(candidate), os.X_OK):
            return str(candidate)
    return None


_VERSION = re.compile(r"(?<![0-9.])(\d+)\.(\d+)\.(\d+)(?![0-9.])")


# On Windows, Node.js options that load code are not passed to the checks run through Pi (they run after auth.json
# holds the key), and no program is looked for in the current folder: cmd.exe, which runs pi.cmd, honours this.
_WINDOWS_CHECK_ENV_DROPPED = ("NODE_OPTIONS", "NODE_PATH")


def _quiet_pi_environment() -> Dict[str, str]:
    environment = dict(os.environ)
    if WINDOWS:
        for name in list(environment):
            if name.upper() in _WINDOWS_CHECK_ENV_DROPPED:
                del environment[name]
        environment["NoDefaultCurrentDirectoryInExePath"] = "1"
    environment.update({"PI_OFFLINE": "1", "PI_SKIP_VERSION_CHECK": "1", "PI_TELEMETRY": "0"})
    return environment


_FIXED_ARGUMENT = re.compile(r"[A-Za-z0-9._-]+")
_CMD_UNSAFE = re.compile(r'[%!"&^\x00-\x1f]')


def program_command(executable: str, arguments: List[str]) -> Union[List[str], str]:
    """What subprocess runs to start `executable` with this file's own fixed `arguments`.

    On Windows a .cmd or .bat file runs through cmd.exe, which reads & | < > ^ ( ) as its own syntax and expands
    %...%. Windows hands it the command line as it is, and Python quotes a path only when it has a space in it, so a
    Pi installed under a folder named R&D would be read as two commands. Here the path is always quoted, cmd.exe is
    the Windows folder's own, started without AutoRun (/d) and without delayed expansion (/v:off). That is not enough
    for what runs next: npm's pi.cmd sets its own folder with SET dp0=%~dp0, unquoted, where & and ^ act again. So a
    path with %, !, &, ^ or a quote in it is refused rather than guessed at."""
    if not WINDOWS or Path(executable).suffix.lower() not in {".cmd", ".bat"}:
        return [executable, *arguments]
    if not all(_FIXED_ARGUMENT.fullmatch(argument) for argument in arguments):
        raise SetupError("Internal error: only fixed arguments may be passed to a command script.")
    cmd = _system_folder("System32", "cmd.exe")
    if cmd is None:
        raise SetupError("cmd.exe was not found in the Windows folder, so Pi could not be run. Nothing was changed.")
    if _CMD_UNSAFE.search(executable):
        raise SetupError(
            f"Pi's path {executable} has %, !, &, ^ or a quote in it, which Windows command scripts such as pi.cmd cannot "
            "run safely. Install Pi in a folder without them, then run this setup again. Nothing was changed."
        )
    return '"' + cmd + '" /d /v:off /s /c ""' + executable + '" ' + " ".join(arguments) + '"'



@contextlib.contextmanager
def _scratch_folder(prefix: str) -> Iterator[Path]:
    """A private, empty folder, deleted afterwards. On Windows a program that has only just exited can still hold
    something in it for a moment; there that leaves the folder in your temporary folder rather than failing the run."""
    if not WINDOWS:
        with tempfile.TemporaryDirectory(prefix=prefix) as folder:
            yield Path(folder)
        return
    folder = tempfile.mkdtemp(prefix=prefix)
    try:
        yield Path(folder)
    finally:
        shutil.rmtree(folder, ignore_errors=True)


def run_pi(executable: str, arguments: List[str], timeout: int = 60) -> Optional["subprocess.CompletedProcess[bytes]"]:
    """Run Pi offline, from an empty folder: Pi reads project settings and extensions from the folder it
    is started in, and this setup should not depend on, or run, whatever is in the one it was pasted into.
    On Windows `executable` is usually pi.cmd, which runs through cmd.exe: see program_command. Only the fixed
    arguments in this file are ever passed, never a value that comes from the person or from a file."""
    command = program_command(executable, arguments)
    try:
        with _scratch_folder("tenvor-pi-check-") as scratch:
            return subprocess.run(
                command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, timeout=timeout, env=_quiet_pi_environment(), cwd=str(scratch),
            )
    except (OSError, subprocess.SubprocessError):
        return None


def pi_version(executable: str) -> Optional[Tuple[int, int, int]]:
    result = run_pi(executable, ["--version"], 30)
    if result is None or result.returncode != 0:
        return None
    text = (result.stdout + b"\n" + result.stderr).decode("utf-8", "replace")
    match = _VERSION.search(text[:400])
    return (int(match.group(1)), int(match.group(2)), int(match.group(3))) if match else None


def _tool_version(command: str) -> Optional[Tuple[int, int, int]]:
    path = which(command)
    if path is None:
        return None
    try:
        result = subprocess.run(
            [path, "--version"], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, timeout=30,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    match = _VERSION.search(result.stdout.decode("utf-8", "replace")[:100])
    return (int(match.group(1)), int(match.group(2)), int(match.group(3))) if match else None


def interactive() -> bool:
    return sys.stdin.isatty() and sys.stdout.isatty()


def run_pi_installer(script_path: Path, scratch: Path) -> None:
    """Run the reviewed installer as this user. Its prompts use the terminal; its stdout is
    relayed through a pipe so it does not offer to start Pi inside this setup."""
    if WINDOWS:
        _run_windows_installer(script_path, scratch)
        return
    environment = {key: os.environ[key] for key in INSTALLER_ENV_ALLOWLIST if key in os.environ}
    environment.setdefault("SHELL", "/bin/sh")
    environment["TMPDIR"] = str(scratch)
    process = subprocess.Popen(
        ["/bin/sh", str(script_path)], stdin=None, stdout=subprocess.PIPE, stderr=None, env=environment,
    )
    deadline = time.monotonic() + INSTALLER_TIMEOUT_SECONDS
    try:
        assert process.stdout is not None
        while True:
            chunk = os.read(process.stdout.fileno(), 4096)
            if not chunk:
                break
            sys.stdout.write(chunk.decode("utf-8", "replace"))
            sys.stdout.flush()
            if time.monotonic() > deadline:
                raise subprocess.TimeoutExpired("pi installer", INSTALLER_TIMEOUT_SECONDS)
        code = process.wait(timeout=60)
    except BaseException:
        process.kill()
        process.wait()
        raise
    finally:
        if process.stdout is not None:
            process.stdout.close()
    if code != 0:
        raise SetupError(f"Pi's installer stopped with exit code {code}. Nothing of Tenvor's was configured.")


def _run_windows_installer(script_path: Path, scratch: Path) -> None:
    """Run the reviewed PowerShell installer as this user, in this console: its menus read single keys from it, and with
    input that is not a console it would install without asking. It is started from the Windows folder's own
    PowerShell, never one found on PATH, with no profile, from the empty scratch folder, with its temporary files there
    too. It has no "start Pi now" question, so its output is not relayed. Its exit code does not tell an install from a
    "do nothing" (both are 0), so the caller looks for pi.cmd afterwards."""
    powershell = _system_folder(*WINDOWS_POWERSHELL)
    if powershell is None:
        raise SetupError(
            "Windows PowerShell was not found in the Windows folder, so Pi's installer was not run. "
            f"Install Pi by following the instructions at {PI_SITE}, then run this setup again."
        )
    environment = {key.upper(): value for key, value in os.environ.items() if key.upper() in WINDOWS_INSTALLER_ENV_ALLOWLIST}
    # Only absolute PATH entries: a relative one (such as .) would let the installer's own lookups find a program in
    # whatever folder it is working in.
    environment["PATH"] = os.pathsep.join(
        entry for entry in environment.get("PATH", "").split(os.pathsep) if entry.strip().strip('"') and os.path.isabs(entry.strip().strip('"'))
    )
    if "PI_CODING_AGENT_DIR" in environment:
        environment["PI_CODING_AGENT_DIR"] = str(resolve_agent_dir())  # the folder this setup checked, not the raw value
    environment["NoDefaultCurrentDirectoryInExePath"] = "1"  # cmd.exe and npm's shims then never run a program from it
    environment["TMP"] = environment["TEMP"] = str(scratch)
    process = subprocess.Popen(
        [powershell, "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script_path)],
        env=environment, cwd=str(scratch),
    )
    try:
        code = process.wait(timeout=INSTALLER_TIMEOUT_SECONDS)
    except BaseException:
        process.kill()
        process.wait()
        raise
    if code != 0:
        raise SetupError(f"Pi's installer stopped with exit code {code}. Nothing of Tenvor's was configured.")


def _explain_windows_installer() -> None:
    print("This setup can run a copy of Pi's installer for Windows that Tenvor reviewed, as your own user, in this window.")
    print("It checks the copy against this SHA-256 before it runs it:")
    print(f"  {PI_WINDOWS_INSTALLER_SHA256}")
    print("That pins the installer script only. The script then downloads the current Pi release and its npm")
    print("packages from pi.dev, and those are not pinned.")
    print("Pi's installer asks its own questions, and pressing Enter at each one means yes:")
    print("  - If Node.js 22.19 or newer is missing, it first offers to install Node.js for your user.")
    print("  - It then shows a menu, where Enter installs Pi in your Pi folder (and n does nothing).")
    print("  - If Git Bash is missing, it offers Portable Git, which it sets as Pi's shell in Pi's settings.json.")
    print("    It may also offer winget, which installs Git for every user and can ask for administrator rights.")
    print("  - At the end it may offer to add Pi to your user PATH.")


def offer_pi_install(agent_dir: Path) -> None:
    print("Pi is not installed (or it is not on your PATH). Nothing has been changed.")
    print("")
    print(f"To install Pi yourself, follow the instructions at {PI_SITE}.")
    print("")
    if not interactive():
        raise SetupError(
            f"Pi is not installed. Install it by following the instructions at {PI_SITE}, or run this setup in an "
            "interactive terminal to be asked. Then run this setup again."
        )
    if WINDOWS:
        _explain_windows_installer()
        _install_pi_when_asked(PI_WINDOWS_INSTALLER_URL, PI_WINDOWS_INSTALLER_SHA256, "install.ps1")
        return
    node, npm = _tool_version("node"), _tool_version("npm")
    if node is None or npm is None or node < NODE_MINIMUM:
        raise SetupError(
            "Pi needs Node.js 22.19.0 or newer and npm first, and they were not both found. Install them "
            f"(https://nodejs.org), or follow the instructions at {PI_SITE}: Pi's installer offers to install them "
            "for you and asks first, and on some systems that asks for your sudo password. This setup never uses "
            "sudo. Then run this setup again."
        )
    print("This setup can run a copy of Pi's installer that Tenvor reviewed, as your own user and without sudo.")
    print("It checks the copy against this SHA-256 before it runs it:")
    print(f"  {PI_INSTALLER_SHA256}")
    print("That pins the installer script only. The script then downloads the current Pi release and its npm")
    print("packages from pi.dev, and those are not pinned.")
    print("Pi's installer shows its own menu and asks again before it installs anything. It asks before it edits")
    print("a shell startup file, and pressing Enter there means yes. It puts Pi in your Pi folder and links the pi")
    print("command into a folder on your PATH: one in your home folder, or Homebrew's folder on a Mac.")
    _install_pi_when_asked(PI_INSTALLER_URL, PI_INSTALLER_SHA256, "install.sh")


def _install_pi_when_asked(url: str, pinned: str, filename: str) -> None:
    try:
        answer = input("Download and run Pi's installer now? [y/N] ")
    except EOFError:
        answer = ""
    if answer.strip().lower() not in {"y", "yes"}:
        raise SetupError(f"Pi was not installed. Install it by following the instructions at {PI_SITE}, then run this setup again.")
    source = curl_fetch(url, max_bytes=MAX_INSTALLER_BYTES, timeout=30)
    if len(source) > MAX_INSTALLER_BYTES or sha256_hex(source) != pinned:
        raise SetupError(
            "Pi's installer at pi.dev has changed since Tenvor last reviewed it, so it was not run. "
            f"Install Pi yourself by following the instructions at {PI_SITE} if you trust it, then run this setup again."
        )
    with _scratch_folder("tenvor-pi-install-") as scratch:
        script = scratch / filename
        script.write_bytes(source)
        script.chmod(0o600)
        run_pi_installer(script, scratch)


def ensure_pi(agent_dir: Path) -> Tuple[str, str]:
    executable = resolve_pi(agent_dir)
    if executable is None:
        offer_pi_install(agent_dir)
        executable = resolve_pi(agent_dir)
        if executable is None:
            raise SetupError(
                "Pi's installer finished, but no pi program was found. Open a new terminal and run this setup again."
            )
    version = pi_version(executable)
    if version is None:
        raise SetupError(
            f"{executable} did not report a version the way Pi does. Repair Pi's installation "
            "(try `pi --version`), then run this setup again. Nothing was changed."
        )
    text = ".".join(str(part) for part in version)
    if version < MIN_PI_VERSION:
        raise SetupError(
            f"Pi {text} is older than {'.'.join(str(part) for part in MIN_PI_VERSION)}, the oldest version Tenvor tested. "
            "Update it with `pi update`, then run this setup again. Nothing was changed."
        )
    if version[0] >= FIRST_UNREVIEWED_MAJOR:
        raise SetupError(
            f"Pi {text} is a newer major release than Tenvor has tested ({REVIEWED_PI_VERSION}). Nothing was "
            "changed. Add Tenvor by hand using Pi's documentation until this setup is updated."
        )
    return executable, text


# ---------------------------------------------------------------------------
# Setup and removal.
# ---------------------------------------------------------------------------

class Files:
    def __init__(self, directory: Path) -> None:
        if _is_link(directory):
            raise SetupError(f"Refusing to use a symlinked Pi folder: {directory}")
        if directory.exists() and not directory.is_dir():
            raise SetupError(f"{directory} is not a folder.")
        self.directory = directory
        self.models = ManagedFile(directory, "models.json", True)
        self.auth = ManagedFile(directory, "auth.json", False)
        self.settings = ManagedFile(directory, "settings.json", False)
        self.state_path = directory / STATE_FILENAME
        self.state = read_state(self.state_path)


def _refuse_if_changed_underfoot(managed_files: List[ManagedFile]) -> None:
    """Pi may write these files while setup runs. If one is not the bytes that were read, write nothing."""
    for managed in managed_files:
        path = managed.path
        try:
            current = path.read_bytes() if path.exists() and not path.is_symlink() else None
        except OSError:
            current = b"\0unreadable"
        if current != managed.raw:
            raise SetupError(f"{managed.name} changed while setup was running. Nothing was changed; run setup again.")


def _verify_edit(name: str, new_text: str, line_comments: bool, expected: Dict[str, Any]) -> None:
    """The edited text must parse to exactly the original plus the intended change, or nothing is written."""
    try:
        actual = _to_python(new_text, _scan(new_text, line_comments))
    except _Problem:
        actual = None
    if actual != expected:
        raise SetupError(f"Internal check failed while editing {name}; nothing was written.")


def _create_text(text: str, existed: bool, newline_source: str) -> str:
    return text if existed else text + _newline(newline_source)


def configure(directory: Path, model: Dict[str, Any], api_key: Optional[str]) -> Dict[str, Any]:
    tidy_leftovers(directory)
    files = Files(directory)
    state = files.state
    entry = provider_config(model)
    for managed in (files.auth, files.settings):
        managed.refuse_if_pi_is_writing()

    models_py, auth_py, settings_py = files.models.python(), files.auth.python(), files.settings.python()
    providers = models_py.get("providers")
    if providers is not None and not isinstance(providers, dict):
        raise SetupError("models.json: \"providers\" must be a JSON object. It was left untouched.")
    current_entry = providers.get(PROVIDER_ID) if isinstance(providers, dict) else None
    credential = auth_py.get(PROVIDER_ID)

    if state is None:
        collisions = []
        if current_entry is not None:
            collisions.append(f'models.json already has a provider named "{PROVIDER_ID}"')
        if credential is not None:
            collisions.append(f'auth.json already has a credential named "{PROVIDER_ID}"')
        if collisions:
            raise SetupError(
                "; ".join(collisions) + ". This setup did not create them, so it will not overwrite them. "
                "Remove or rename them, or keep your own setup. Nothing was changed."
            )
        if api_key is None:
            raise SetupError("No Tenvor key is stored yet; enter a new API key.")

    # ----- models.json: the provider and its model
    new_models_py = copy.deepcopy(models_py)
    models_text = files.models.base_text
    if state is None:
        manage_models = True
    elif current_entry is None:
        manage_models = True
    else:
        manage_models = bool(state["models"]["owned"]) and current_entry == state["models"]["entry"]
    providers_created = state["models"]["providers_created"] if state else ("providers" not in models_py)
    if state and current_entry is None and not isinstance(providers, dict):
        providers_created = True
    if manage_models and current_entry != entry:
        models_text = splice("models.json", lambda: edit_set(models_text, ["providers", PROVIDER_ID], entry, True))
        new_models_py.setdefault("providers", {})[PROVIDER_ID] = entry
    models_changed = models_text != files.models.base_text

    # ----- auth.json: the key
    auth_text = files.auth.base_text
    new_auth_py = copy.deepcopy(auth_py)
    stored_ok = isinstance(credential, dict) and credential.get("type") == "api_key" and isinstance(credential.get("key"), str)
    if api_key is not None:
        credential_value = credential_entry(api_key)
        if credential != credential_value:
            auth_text = splice("auth.json", lambda: edit_set(auth_text, [PROVIDER_ID], credential_value, False))
            new_auth_py[PROVIDER_ID] = credential_value
        manage_key = True
        digest = key_digest(api_key)
    else:
        digest = state["auth"]["key_sha256"] if state else ""
        manage_key = bool(state and stored_ok and key_digest(credential["key"]) == state["auth"]["key_sha256"])
    auth_changed = auth_text != files.auth.base_text

    # ----- settings.json: the default model
    settings_text = files.settings.base_text
    new_settings_py = copy.deepcopy(settings_py)
    ours = settings_py.get("defaultProvider") == PROVIDER_ID and settings_py.get("defaultModel") == MODEL_ID
    both_absent = "defaultProvider" not in settings_py and "defaultModel" not in settings_py
    if state is None:
        previous = {"provider": _slot(settings_py, "defaultProvider"), "model": _slot(settings_py, "defaultModel")}
        # A default the person already chose is theirs. It is never replaced, here or on a later run.
        manage_default = both_absent
    else:
        previous = state["settings"]["previous"]
        manage_default = bool(state["settings"]["managed"]) and (ours or both_absent)
    if manage_default and not ours:
        for key, value in (("defaultProvider", PROVIDER_ID), ("defaultModel", MODEL_ID)):
            settings_text = splice("settings.json", lambda k=key, v=value, t=settings_text: edit_set(t, [k], v, False))
            new_settings_py[key] = value
    if manage_default:
        default_state = "ours"
    elif state is None or not state["settings"]["managed"]:
        default_state = "yours"
    else:
        default_state = "changed"
    settings_changed = settings_text != files.settings.base_text
    enabled_models = settings_py.get("enabledModels")
    enabled_models_set = isinstance(enabled_models, list) and len(enabled_models) > 0

    # ----- verify every edit, then assemble the writes
    pending: List[Tuple[ManagedFile, str, Dict[str, Any], bool]] = []
    if models_changed:
        pending.append((files.models, models_text, new_models_py, True))
    if auth_changed:
        pending.append((files.auth, auth_text, new_auth_py, False))
    if settings_changed:
        pending.append((files.settings, settings_text, new_settings_py, False))
    texts: Dict[str, str] = {}
    for managed, text, expected, comments in pending:
        text = _create_text(text, managed.exists and not managed.blank, text)
        _verify_edit(managed.name, text, comments, expected)
        texts[managed.name] = text

    existed = {
        "models.json": state["models"]["existed"] if state else files.models.exists,
        "auth.json": state["auth"]["existed"] if state else files.auth.exists,
        "settings.json": state["settings"]["existed"] if state else files.settings.exists,
    }
    # A file's recorded checksum is the one setup wrote. It is renewed only when setup writes the file
    # again: remove may delete a file it created only while those bytes are still exactly its own.
    zero = "0" * 64

    def written(name: str, section: str) -> str:
        if name in texts:
            return sha256_hex(texts[name].encode("utf-8"))
        return state[section]["sha256"] if state else zero

    new_state = {
        "version": STATE_VERSION,
        "models": {
            "existed": existed["models.json"], "providers_created": providers_created,
            "entry": entry if manage_models else (state["models"]["entry"] if state else entry),
            "owned": manage_models, "sha256": written("models.json", "models"),
        },
        "auth": {
            "existed": existed["auth.json"],
            "key_sha256": digest if digest else (state["auth"]["key_sha256"] if state else zero),
            "owned": manage_key, "sha256": written("auth.json", "auth"),
        },
        "settings": {
            "existed": existed["settings.json"], "managed": manage_default, "previous": previous,
            "sha256": written("settings.json", "settings"),
        },
    }
    state_bytes = encode_state(new_state)
    state_changed = files.state is None or encode_state(files.state) != state_bytes

    # ----- write: backups first, then every file in one transaction. The state file goes first: a run
    # that is killed part-way then still leaves a record, so that a rerun finishes the job and --remove
    # undoes it. Pi's own locks are held while the files are compared, backed up and replaced.
    writes: List[Tuple[Path, bytes, int]] = []
    backups: List[Path] = []
    snapshots: Snapshots = {}
    tightened = False
    if state_changed:
        writes.append((files.state_path, state_bytes, 0o600))
    for managed, _, _, _ in pending:
        data = texts[managed.name].encode("utf-8")
        mode = managed.mode if managed.mode is not None else 0o600
        if managed is files.auth:
            # Windows reports every writable file as mode 666, which says nothing about who can read it.
            tightened = bool(managed.mode is not None and managed.mode & 0o077 and not WINDOWS)
            mode = 0o600
        writes.append((managed.path, data, mode))
    created_directory = False
    if writes:
        if not directory.exists():
            directory.mkdir(mode=0o700, parents=True, exist_ok=True)
            created_directory = True
        changing = [managed for managed, _, _, _ in pending]
        _refuse_if_changed_underfoot(changing)
        try:
            for managed in changing:
                if managed.exists and not managed.blank:
                    backups.append(write_backup(managed.path))
        except OSError as exc:
            for made in backups:
                made.unlink(missing_ok=True)
            _discard_new_directory(directory, created_directory)
            raise SetupError(f"Could not write a backup, so nothing was changed: {exc.__class__.__name__}.") from None
        committed = False
        try:
            with HeldLocks(directory, ["auth.json", "settings.json"]):
                _refuse_if_changed_underfoot(changing)  # once more, now that Pi cannot write
                snapshots = transactional_update(writes, [])
                committed = True
                _PHASE["committed"] = "setup"
        except BaseException:
            if committed:
                _drop_credential_backups(backups)
            else:
                for made in backups:
                    made.unlink(missing_ok=True)
                _discard_new_directory(directory, created_directory)
            raise
        backups = _drop_credential_backups(backups)
    return {
        "changed": bool(writes), "backups": backups, "models_path": files.models.path,
        "auth_path": files.auth.path, "settings_path": files.settings.path,
        "key_written": auth_changed, "key_owned": manage_key,
        "provider_owned": manage_models, "default_state": default_state,
        "enabled_models_set": enabled_models_set,
        "tightened": tightened, "first_run": state is None,
        "snapshots": snapshots, "created_directory": created_directory,
        "custom_providers": sorted(name for name in (providers if isinstance(providers, dict) else {}) if name != PROVIDER_ID),
    }


def _discard_new_directory(directory: Path, created: bool) -> None:
    """A run that stopped before writing anything leaves no folder that it made."""
    if created:
        try:
            directory.rmdir()
        except OSError:
            pass


def _drop_credential_backups(backups: List[Path]) -> List[Path]:
    """auth.json holds keys: its copy lives only for the length of the run, and is never kept."""
    kept = []
    for made in backups:
        if made.name.startswith("auth.json.backup-"):
            made.unlink(missing_ok=True)
        else:
            kept.append(made)
    return kept


def remove(directory: Path) -> Dict[str, Any]:
    tidy_leftovers(directory)
    files = Files(directory)
    state = files.state
    if state is None:
        raise SetupError("No Tenvor setup made by this script was found in Pi's folder. Nothing was removed.")
    for managed in (files.auth, files.settings):
        managed.refuse_if_pi_is_writing()
    models_py, auth_py, settings_py = files.models.python(), files.auth.python(), files.settings.python()
    providers = models_py.get("providers")
    if providers is not None and not isinstance(providers, dict):
        raise SetupError("models.json: \"providers\" must be a JSON object. Nothing was changed.")
    notes: List[str] = []
    texts: Dict[str, Optional[str]] = {}
    expected_by_file: Dict[str, Tuple[Dict[str, Any], bool]] = {}

    # models.json
    current_entry = providers.get(PROVIDER_ID) if isinstance(providers, dict) else None
    models_text = files.models.base_text
    if current_entry is None:
        pass
    elif state["models"]["owned"] and current_entry == state["models"]["entry"]:
        if (not state["models"]["existed"]) and files.models.raw is not None and sha256_hex(files.models.raw) == state["models"]["sha256"]:
            texts["models.json"] = None
        else:
            models_text = splice("models.json", lambda: edit_remove(models_text, ["providers", PROVIDER_ID], True))
            expected = copy.deepcopy(models_py)
            del expected["providers"][PROVIDER_ID]
            if state["models"]["providers_created"] and not expected["providers"]:
                models_text = splice("models.json", lambda: edit_remove(models_text, ["providers"], True))
                del expected["providers"]
            texts["models.json"] = models_text
            expected_by_file["models.json"] = (expected, True)
    else:
        notes.append("The Tenvor provider in models.json was changed after setup, so it was left in place.")

    # auth.json
    credential = auth_py.get(PROVIDER_ID)
    auth_text = files.auth.base_text
    if credential is not None:
        owned = isinstance(credential, dict) and credential.get("type") == "api_key" and isinstance(credential.get("key"), str) \
            and key_digest(credential["key"]) == state["auth"]["key_sha256"]
        if owned:
            if (not state["auth"]["existed"]) and files.auth.raw is not None and sha256_hex(files.auth.raw) == state["auth"]["sha256"]:
                texts["auth.json"] = None
            else:
                auth_text = splice("auth.json", lambda: edit_remove(auth_text, [PROVIDER_ID], False))
                expected = copy.deepcopy(auth_py)
                del expected[PROVIDER_ID]
                texts["auth.json"] = auth_text
                expected_by_file["auth.json"] = (expected, False)
        else:
            notes.append("The Tenvor credential in auth.json is not the one setup stored, so it was left in place.")

    # settings.json
    settings_text = files.settings.base_text
    ours = settings_py.get("defaultProvider") == PROVIDER_ID and settings_py.get("defaultModel") == MODEL_ID
    restored = None
    if state["settings"]["managed"] and ours:
        if (not state["settings"]["existed"]) and files.settings.raw is not None and sha256_hex(files.settings.raw) == state["settings"]["sha256"]:
            texts["settings.json"] = None
        else:
            expected = copy.deepcopy(settings_py)
            for key, slot in (("defaultProvider", state["settings"]["previous"]["provider"]), ("defaultModel", state["settings"]["previous"]["model"])):
                if slot["present"]:
                    settings_text = splice("settings.json", lambda k=key, v=slot["value"], t=settings_text: edit_set(t, [k], v, False))
                    expected[key] = slot["value"]
                else:
                    settings_text = splice("settings.json", lambda k=key, t=settings_text: edit_remove(t, [k], False))
                    expected.pop(key, None)
            texts["settings.json"] = settings_text
            expected_by_file["settings.json"] = (expected, False)
        previous = state["settings"]["previous"]
        if previous["provider"]["present"] and previous["model"]["present"]:
            restored = (previous["provider"]["value"], previous["model"]["value"])
    elif state["settings"]["managed"]:
        notes.append("Pi's default model was changed after setup, so it was left as it is.")

    writes: List[Tuple[Path, bytes, int]] = []
    deletes: List[Path] = [files.state_path]
    backups: List[Path] = []
    by_name = {"models.json": files.models, "auth.json": files.auth, "settings.json": files.settings}
    for name, text in texts.items():
        managed = by_name[name]
        if text is None:
            deletes.append(managed.path)
            continue
        expected, comments = expected_by_file[name]
        _verify_edit(name, text, comments, expected)
        mode = 0o600 if name == "auth.json" else (managed.mode if managed.mode is not None else 0o600)
        writes.append((managed.path, text.encode("utf-8"), mode))
    changing = [by_name[name] for name in texts]
    _refuse_if_changed_underfoot(changing)
    try:
        for name, text in texts.items():
            if text is not None and by_name[name].exists and not by_name[name].blank:
                backups.append(write_backup(by_name[name].path))
    except OSError as exc:
        for made in backups:
            made.unlink(missing_ok=True)
        raise SetupError(f"Could not write a backup, so nothing was changed: {exc.__class__.__name__}.") from None
    committed = False
    try:
        with HeldLocks(directory, ["auth.json", "settings.json"]):
            _refuse_if_changed_underfoot(changing)  # once more, now that Pi cannot write
            transactional_update(writes, deletes)
            committed = True
            _PHASE["committed"] = "remove"
    except BaseException:
        if committed:
            _drop_credential_backups(backups)
        else:
            for made in backups:
                made.unlink(missing_ok=True)
        raise
    backups = _drop_credential_backups(backups)
    return {
        "backups": backups, "notes": notes, "restored": restored,
        "removed_provider": "models.json" in texts, "removed_credential": "auth.json" in texts,
        "restored_default": "settings.json" in texts,
    }


# ---------------------------------------------------------------------------
# Tenvor's Pi extension for the session cache. It is a step of its own: the model
# setup above is complete without it, and nothing here can undo that.
#
# One run at a time. The whole step (install, upgrade, repair, removal) runs under an
# exclusive flock on .tenvor-pi-cache.lock in the Pi folder. A second run waits up to
# CACHE_LOCK_WAIT_SECONDS and then skips the step. The kernel drops the lock when its
# holder dies, so whatever a run finds while it holds the lock was left by a run that is
# not in this step any more: no process id or age is ever consulted. (Pi's own
# <file>.lock directories, which HeldLocks takes for auth.json and settings.json, are not
# reused: they exist to keep out a running Pi, and tell an abandoned one by its age.)
#
# Ownership is by record, never by name. The record (.tenvor-pi-cache-state.json) lists, in
# `pending`, the exact name of every private file this setup is about to create, and it is
# written before the file exists. Only a listed name is ever cleaned up, and only when the
# file there is a regular file you own whose bytes are ones this setup wrote (a recorded
# hash, or the start of the file it was staging), or is the second name of the extension
# file itself. Anything else at a listed name, and every file that merely looks like a
# temporary, is left alone and the record is kept. The one fixed-name exception is the
# record's own temporary, which cannot be listed in the record it is about to become: it is
# removed only if its bytes are (the start of) a record of this setup's.
#
# Everything works on directory descriptors, not on paths. The Pi folder and the extensions
# folder are opened once, with O_NOFOLLOW (a symlink at either is refused), and every later
# step is relative to those descriptors, so a folder swapped for a symlink after a check
# cannot redirect a write or a delete. A file that is replaced or deleted is first taken by
# renaming it to a listed private name inside the folder; what was taken is then examined
# (a regular file, one link, yours, the bytes that were recorded), and put back untouched if
# it is anything else, or if anything goes wrong. The record is written before the file it
# describes and lists the hashes the file may have while a change is under way, and it is
# deleted last, only once the extension file is gone and nothing is pending.
#
# Windows has no directory descriptors and no flock. There the same steps work on paths inside
# the Pi folder, after a symlink or junction at either folder, or at a file, has been refused.
# That is a weaker guarantee than the descriptors give: a program running as you that replaced
# one of the two folders with a junction between a check and a write could redirect that write.
# Such a program could already change every file this setup touches (they are yours, and on
# Windows nothing here is guarded by permissions it lacks), so the step does not pretend to
# defend against it there. The lock is a msvcrt lock on the first byte of the same file, which
# Windows also lets go of when its holder dies. Every call below that touches the file system
# goes through the helpers that follow, which do the one or the other.
# ---------------------------------------------------------------------------

_O_DIRECTORY = getattr(os, "O_DIRECTORY", 0)
_O_NOFOLLOW = getattr(os, "O_NOFOLLOW", 0)
_O_CLOEXEC = getattr(os, "O_CLOEXEC", 0)
_O_NONBLOCK = getattr(os, "O_NONBLOCK", 0)
_NO_HARD_LINKS = tuple(getattr(errno, name) for name in ("EPERM", "ENOTSUP", "EOPNOTSUPP", "ENOSYS", "EMLINK", "EXDEV") if hasattr(errno, name))
CACHE_RECORD_TEMPORARY = ".tenvor-pi-cache-state.json.next"
CACHE_PENDING_LIMIT = 8
CACHE_MOVE_IT_INSTALL = "Move or delete that file, then run this setup again"
CACHE_MOVE_IT_REMOVE = "Move or delete that file, then run --remove again"
_PENDING_NAME = re.compile(r"^\." + re.escape(CACHE_EXTENSION_FILENAME) + r"\.(?:tenvor|claimed)-[0-9a-f]{12}$")


class _Left(Exception):
    """The extension step stops without writing: `reason` is one sentence for the person."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def cache_extension_bytes() -> bytes:
    data = CACHE_EXTENSION_SOURCE.encode("utf-8")
    if len(data) > MAX_EXTENSION_BYTES or sha256_hex(data) != CACHE_EXTENSION_SHA256:
        raise SetupError("The cache extension inside this setup failed its SHA-256 check, so it was not installed.")
    return data


# A folder this step works in: a directory descriptor, or on Windows the folder's absolute path.
Folder = Union[int, str]


def _open_directory(name: str, dir_fd: Optional[Folder] = None) -> Folder:
    if WINDOWS:
        path = name if dir_fd is None else os.path.join(dir_fd, name)
        info = os.stat(path, follow_symlinks=False)  # FileNotFoundError, as os.open raises it
        if _is_link_stat(info):
            raise OSError(errno.ELOOP, "Is a symbolic link or junction", path)
        if not stat.S_ISDIR(info.st_mode):
            raise OSError(errno.ENOTDIR, "Not a directory", path)
        return os.path.abspath(path)
    return os.open(name, os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW | _O_CLOEXEC, dir_fd=dir_fd)


def _close_directory(directory: Folder) -> None:
    if not WINDOWS:
        os.close(directory)


def _lstat(directory: Folder, name: str) -> "os.stat_result":
    """The entry `name` itself, a symlink not followed."""
    if WINDOWS:
        return os.stat(os.path.join(directory, name), follow_symlinks=False)
    return os.stat(name, dir_fd=directory, follow_symlinks=False)


def _open_in(directory: Folder, name: str, flags: int, mode: int = 0o600) -> int:
    """Open `name` in the folder. A symlink at it is refused (ELOOP), unless the flags create a new file, which fails
    with FileExistsError whenever anything is at the name."""
    if not WINDOWS:
        return os.open(name, flags, mode, dir_fd=directory)
    path = os.path.join(directory, name)
    if not (flags & os.O_CREAT and flags & os.O_EXCL):
        try:
            if _is_link_stat(os.stat(path, follow_symlinks=False)):
                raise OSError(errno.ELOOP, "Is a symbolic link or junction", path)
        except FileNotFoundError:
            if not flags & os.O_CREAT:
                raise
    return os.open(path, flags | _O_BINARY | _O_NOINHERIT, mode)


def _unlink_in(directory: Folder, name: str) -> None:
    if WINDOWS:
        _retry_if_busy(lambda: os.unlink(os.path.join(directory, name)))
    else:
        os.unlink(name, dir_fd=directory)


def _mkdir_in(directory: Folder, name: str, mode: int) -> None:
    if WINDOWS:
        os.mkdir(os.path.join(directory, name), mode)
    else:
        os.mkdir(name, mode, dir_fd=directory)


def _rmdir_in(directory: Folder, name: str) -> None:
    if WINDOWS:
        os.rmdir(os.path.join(directory, name))
    else:
        os.rmdir(name, dir_fd=directory)


def _rename_in(directory: Folder, source: str, target: str) -> None:
    """Rename within the folder. Where `target` exists, POSIX replaces it and Windows refuses (FileExistsError). Every
    caller has made sure the name is free; _replace_in is for the one place that replaces."""
    if WINDOWS:
        _retry_if_busy(lambda: os.rename(os.path.join(directory, source), os.path.join(directory, target)))
    else:
        os.rename(source, target, src_dir_fd=directory, dst_dir_fd=directory)


def _replace_in(directory: Folder, source: str, target: str) -> None:
    if WINDOWS:
        _retry_if_busy(lambda: os.replace(os.path.join(directory, source), os.path.join(directory, target)))
    else:
        os.rename(source, target, src_dir_fd=directory, dst_dir_fd=directory)


def _link_in(directory: Folder, source: str, target: str, follow_symlinks: bool) -> None:
    """A second name for a file. The files linked here are regular files, so on Windows, which cannot choose,
    following or not is the same."""
    if WINDOWS:
        os.link(os.path.join(directory, source), os.path.join(directory, target))
    elif follow_symlinks:
        os.link(source, target, src_dir_fd=directory, dst_dir_fd=directory)
    else:
        os.link(source, target, src_dir_fd=directory, dst_dir_fd=directory, follow_symlinks=False)


def _no_hard_links(exc: OSError) -> bool:
    """Is this the error of a file system that cannot give a file a second name?"""
    return exc.errno in _NO_HARD_LINKS or (WINDOWS and getattr(exc, "winerror", None) in _WINDOWS_NO_HARD_LINKS)


def _not_a_directory_error(exc: OSError) -> bool:
    return exc.errno in (errno.ELOOP, errno.ENOTDIR, errno.EMLINK)


@contextlib.contextmanager
def _pi_folder(directory: Path) -> Iterator[Folder]:
    """The Pi folder as a descriptor. A symlink at the folder itself is refused, as the model setup refuses it."""
    try:
        descriptor = _open_directory(str(directory))
    except FileNotFoundError:
        raise SetupError(f"Pi's folder {directory} does not exist.") from None
    except OSError as exc:
        if _not_a_directory_error(exc):
            if _is_link(directory):
                raise SetupError(f"Refusing to use a symlinked Pi folder: {directory}") from None
            raise SetupError(f"{directory} is not a folder.") from None
        raise
    try:
        yield descriptor
    finally:
        _close_directory(descriptor)


def _lock_wait_reason() -> str:
    return (
        f"another run of this setup has been changing Pi's extension for {CACHE_LOCK_WAIT_SECONDS:g} seconds. "
        "Run this setup again when it has finished"
    )


@contextlib.contextmanager
def _cache_lock(root: Folder) -> Iterator[None]:
    """Hold the exclusive lock on the step for the length of the with block, or raise _Left after waiting for it."""
    if WINDOWS:
        with _cache_lock_windows(root):
            yield
        return
    deadline = time.monotonic() + CACHE_LOCK_WAIT_SECONDS
    while True:
        descriptor = os.open(CACHE_LOCK_FILENAME, os.O_RDWR | os.O_CREAT | _O_NOFOLLOW | _O_CLOEXEC, 0o600, dir_fd=root)
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            os.close(descriptor)
            if exc.errno not in (errno.EWOULDBLOCK, errno.EAGAIN, errno.EACCES):
                raise
            if time.monotonic() >= deadline:
                raise _Left(_lock_wait_reason()) from None
            time.sleep(0.05)
            continue
        # The run that held the lock before us deletes the file before it lets go, so a lock won on a file that no
        # longer has that name guards nothing: start again.
        try:
            try:
                named = os.stat(CACHE_LOCK_FILENAME, dir_fd=root, follow_symlinks=False)
            except FileNotFoundError:
                named = None
            mine = os.fstat(descriptor)
        except BaseException:
            os.close(descriptor)  # never leave a lock held by a descriptor nobody will close
            raise
        if named is not None and (named.st_dev, named.st_ino) == (mine.st_dev, mine.st_ino):
            break
        os.close(descriptor)
    try:
        yield
    finally:
        try:
            try:
                os.unlink(CACHE_LOCK_FILENAME, dir_fd=root)  # while still holding it
            except OSError:
                pass
        finally:
            os.close(descriptor)  # whatever went wrong above, the lock is let go


@contextlib.contextmanager
def _cache_lock_windows(root: str) -> Iterator[None]:
    """The same lock on Windows: msvcrt locks the first byte of the lock file. Windows cannot delete or rename a file
    that another run has open (Python opens files without FILE_SHARE_DELETE), so the file a run locks is always the one
    at the name, and its identity needs no check. The file is deleted after it is let go, unless another run has
    opened it by then; that run then locks the same file."""
    deadline = time.monotonic() + CACHE_LOCK_WAIT_SECONDS
    while True:
        descriptor = _open_in(root, CACHE_LOCK_FILENAME, os.O_RDWR | os.O_CREAT)
        try:
            msvcrt.locking(descriptor, msvcrt.LK_NBLCK, 1)
        except OSError:
            os.close(descriptor)
            if time.monotonic() >= deadline:
                raise _Left(_lock_wait_reason()) from None
            time.sleep(0.05)
            continue
        break
    try:
        yield
    finally:
        try:
            os.lseek(descriptor, 0, os.SEEK_SET)
            msvcrt.locking(descriptor, msvcrt.LK_UNLCK, 1)
        except OSError:
            pass
        finally:
            os.close(descriptor)  # whatever went wrong above, the lock is let go
        try:
            _unlink_in(root, CACHE_LOCK_FILENAME)
        except OSError:
            pass


def _child_directory(parent: Folder, name: str, shown: Path) -> Optional[Folder]:
    """A folder inside `parent` as a descriptor, or None when it is not there. A symlink or a file is refused."""
    try:
        info = _lstat(parent, name)
    except FileNotFoundError:
        return None
    if _is_link_stat(info):
        raise _Left(f"{shown} is a symlink, and this setup does not write through one")
    if not stat.S_ISDIR(info.st_mode):
        raise _Left(f"{shown} is not a folder")
    try:
        return _open_directory(name, parent)
    except FileNotFoundError:
        return None
    except OSError as exc:
        if _not_a_directory_error(exc):
            raise _Left(f"{shown} is a symlink or not a folder, and this setup does not write through one") from None
        raise


def _read_descriptor(descriptor: int, limit: int) -> bytes:
    os.lseek(descriptor, 0, os.SEEK_SET)
    chunks: List[bytes] = []
    total = 0
    while True:
        chunk = os.read(descriptor, 65536)
        if not chunk:
            return b"".join(chunks)
        total += len(chunk)
        if total > limit:
            raise _Left("is larger than the safety limit")
        chunks.append(chunk)


def _examine(directory: Folder, name: str, *, limit: int = MAX_EXTENSION_BYTES) -> Optional[Tuple[bytes, "os.stat_result"]]:
    """The bytes and identity of the entry `name`, opened without following a symlink and without blocking on a
    pipe. None when there is no such entry. Anything that is not one regular file with one name that you own
    raises _Left: it is not this setup's to read into, replace or delete."""
    try:
        descriptor = _open_in(directory, name, os.O_RDONLY | _O_NOFOLLOW | _O_NONBLOCK | _O_CLOEXEC)
    except FileNotFoundError:
        return None
    except OSError as exc:
        if exc.errno == errno.ELOOP:
            raise _Left(f"{name} is a symlink") from None
        raise _Left(f"{name} cannot be opened safely ({exc.__class__.__name__})") from None
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode):
            raise _Left(f"{name} is not a regular file")
        if info.st_nlink != 1:
            raise _Left(f"{name} has more than one name, so it is not one this setup can safely replace")
        if not _owned_by_me(info):
            raise _Left(f"{name} is not owned by you")
        if info.st_size > limit:
            raise _Left(f"{name} is larger than the safety limit")
        return _read_descriptor(descriptor, limit), info
    finally:
        os.close(descriptor)


def _exists(directory: Optional[Folder], name: str) -> bool:
    if directory is None:
        return False
    try:
        _lstat(directory, name)
        return True
    except FileNotFoundError:
        return False


def _private_name(directory: Optional[Folder], kind: str) -> str:
    """A fresh name for a private file of this setup's, to be listed in the record before the file is created."""
    for _ in range(16):
        name = f".{CACHE_EXTENSION_FILENAME}.{kind}-{os.urandom(6).hex()}"
        if not _exists(directory, name):
            return name
    raise SetupError("Could not choose a name for a temporary file.")


def _stage(directory: Folder, name: str, data: bytes) -> Tuple[int, int]:
    """Create `name` (it must not exist) holding `data`; return the identity (st_dev, st_ino) of the file made. Nothing
    is replaced yet."""
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | _O_NOFOLLOW | _O_CLOEXEC
    try:
        descriptor = _open_in(directory, name, flags, 0o600)
    except FileExistsError:
        raise _Left(f"{name} is already there, and this setup did not make it") from None
    try:
        _set_mode(descriptor, 0o600)
        view = memoryview(data)
        while view:
            view = view[os.write(descriptor, view):]
        os.fsync(descriptor)
        made = os.fstat(descriptor)
    except BaseException:
        os.close(descriptor)
        _forget(directory, name)
        raise
    os.close(descriptor)
    if WINDOWS:
        # It is compared later with what is at a name, which is read by path there: read it the same way.
        made = _lstat(directory, name)
    return made.st_dev, made.st_ino


def _forget(directory: Folder, name: str) -> None:
    try:
        _unlink_in(directory, name)
    except OSError:
        pass


def _link_into_place(directory: Folder, temporary: str, name: str) -> None:
    """Give the staged file its final name only if that name is free, then drop the staged name."""
    try:
        try:
            _link_in(directory, temporary, name, follow_symlinks=False)
        except NotImplementedError:
            _link_in(directory, temporary, name, follow_symlinks=True)
        except OSError as exc:
            if not _no_hard_links(exc):
                raise
            # A filesystem without hard links: rename instead, after checking again that the name is free.
            try:
                _lstat(directory, name)
            except FileNotFoundError:
                _rename_in(directory, temporary, name)
                return
            raise FileExistsError(errno.EEXIST, "exists") from None
    except FileExistsError:
        raise _Left(f"a file named {name} appeared while this setup was working. {CACHE_MOVE_IT_INSTALL}") from None
    try:
        placed, staged = _lstat(directory, name), _lstat(directory, temporary)
        if not stat.S_ISREG(placed.st_mode) or (placed.st_dev, placed.st_ino) != (staged.st_dev, staged.st_ino):
            raise _Left(f"{name} was not what this setup wrote")
    finally:
        _forget(directory, temporary)


def _record_bytes(digest: str, also_accepts: List[str], pending: List[str], created_directory: bool) -> bytes:
    record = {
        "version": CACHE_STATE_VERSION,
        "file": f"{CACHE_EXTENSIONS_DIRNAME}/{CACHE_EXTENSION_FILENAME}",
        "sha256": digest,
        "also_accepts": sorted(also_accepts),
        "pending": sorted(pending),
        "created_directory": created_directory,
    }
    return (json.dumps(record, indent=2) + "\n").encode("utf-8")


_RECORD_HEAD = _record_bytes("0" * 64, [], [], False).split(b'"sha256"')[0]


def _is_record_text(data: bytes) -> bool:
    """Are these bytes (the start of) a record of this setup's? Used for the record's own temporary only."""
    return data == b"" or _RECORD_HEAD.startswith(data) or (data.startswith(_RECORD_HEAD) and len(data) <= 4096)


def _read_cache_state(root: Folder) -> Optional[Dict[str, Any]]:
    try:
        found = _examine(root, CACHE_STATE_FILENAME, limit=MAX_CONFIG_BYTES)
    except _Left as left:
        raise SetupError(f"The cache extension state {CACHE_STATE_FILENAME}: {left.reason}. Nothing was changed.") from None
    if found is None:
        return None
    try:
        state = json.loads(found[0].decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise SetupError(f"The Tenvor cache extension state in {CACHE_STATE_FILENAME} is not valid JSON.") from None
    # Earlier formats (no also_accepts, no pending) are read as empty lists and rewritten.
    base = {"version", "file", "sha256", "created_directory"}
    legacy = isinstance(state, dict) and set(state) in (base, base | {"also_accepts"})
    if legacy:
        state = dict(state)
        state.setdefault("also_accepts", [])
        state.setdefault("pending", [])
    valid = (
        isinstance(state, dict) and set(state) == base | {"also_accepts", "pending"}
        and state["version"] == CACHE_STATE_VERSION
        and state["file"] == f"{CACHE_EXTENSIONS_DIRNAME}/{CACHE_EXTENSION_FILENAME}"
        and _is_hex64(state["sha256"]) and isinstance(state["created_directory"], bool)
        and isinstance(state["also_accepts"], list) and len(state["also_accepts"]) <= 4
        and all(_is_hex64(item) for item in state["also_accepts"])
        and isinstance(state["pending"], list) and len(state["pending"]) <= CACHE_PENDING_LIMIT
        and all(isinstance(item, str) and _PENDING_NAME.match(item) for item in state["pending"])
        and len(set(state["pending"])) == len(state["pending"])
    )
    if not valid:
        raise SetupError(f"The Tenvor cache extension state in {CACHE_STATE_FILENAME} has an unsupported format. Nothing was changed.")
    state["legacy"] = legacy
    return state


def _put_record(root: Folder, data: bytes) -> None:
    _stage(root, CACHE_RECORD_TEMPORARY, data)
    try:
        _replace_in(root, CACHE_RECORD_TEMPORARY, CACHE_STATE_FILENAME)
    except BaseException:
        _forget(root, CACHE_RECORD_TEMPORARY)
        raise


def _retire_record(root: Folder, extensions: Optional[Folder], pending: List[str]) -> bool:
    """The ONLY place that deletes the ownership record. It does so after it has positively established that the extension
    file does not exist and that no pending private file exists, each by an lstat that answered ENOENT, relative to the
    extensions folder this run holds (or, when this run holds none, that the folder itself does not exist). Any other
    outcome, a file that is there or a check that failed for any reason, keeps the record. Returns True when it deleted it."""
    try:
        if extensions is None:
            try:
                _lstat(root, CACHE_EXTENSIONS_DIRNAME)
            except FileNotFoundError:
                pass
            else:
                return False
        else:
            for name in [CACHE_EXTENSION_FILENAME, *pending]:
                try:
                    _lstat(extensions, name)
                except FileNotFoundError:
                    continue
                return False
        _unlink_in(root, CACHE_STATE_FILENAME)
        return True
    except OSError:
        return False


def _remove_created_folder(root: Folder) -> bool:
    """Remove the extensions folder this setup made, if it is empty. False when that failed for a reason other than the
    folder being gone or holding someone else's files: the caller then keeps the record, so that a later run finishes."""
    try:
        _rmdir_in(root, CACHE_EXTENSIONS_DIRNAME)
    except OSError as exc:
        return exc.errno in (errno.ENOENT, errno.ENOTEMPTY, errno.EEXIST)
    return True


def _clean_record_temporary(root: Folder) -> None:
    """The record is replaced through one temporary of a fixed name. Under the lock, one that is there was left by a
    run that stopped: remove it if its bytes are (the start of) a record of this setup's, and stop if they are not."""
    try:
        found = _examine(root, CACHE_RECORD_TEMPORARY, limit=MAX_CONFIG_BYTES)
        if found is None:
            return
        if not _is_record_text(found[0]):
            raise _Left("")
    except _Left:
        raise _Left(f"{CACHE_RECORD_TEMPORARY} in Pi's folder is not a file this setup wrote, so it was left alone") from None
    _unlink_in(root, CACHE_RECORD_TEMPORARY)


def _manifest_lists_extensions(extensions: Folder) -> bool:
    """Does extensions/package.json carry a non-empty pi.extensions list, whatever it lists? Pi then loads only what the
    list names (and only what exists), so a file beside it is not looked at, and adding a file this list names would
    switch Pi from scanning the folder to loading the list. A manifest this setup cannot read safely counts as listing."""
    try:
        found = _examine(extensions, "package.json", limit=MAX_CONFIG_BYTES)
    except _Left:
        return True
    if found is None:
        return False
    try:
        package = json.loads(found[0].decode("utf-8-sig"))
    except (ValueError, UnicodeDecodeError):
        return False  # Pi ignores a manifest it cannot parse and scans the folder
    section = package.get("pi") if isinstance(package, dict) else None
    listed = section.get("extensions") if isinstance(section, dict) else None
    return bool(listed) and isinstance(listed, (list, str, dict))


def _extension_root_entry(extensions: Folder) -> Optional[str]:
    """What makes Pi load one thing only from its extensions folder instead of scanning it (resolveExtensionEntries
    in Pi's package-manager.ts): an index.ts or index.js, or a package.json with a pi.extensions list."""
    for name in ("index.ts", "index.js"):
        try:
            _lstat(extensions, name)
            return name
        except FileNotFoundError:
            pass
    return "package.json" if _manifest_lists_extensions(extensions) else None


def _claim(directory: Folder, name: str, claimed: str) -> bool:
    """Take the entry `name` by renaming it to `claimed`, a name already listed in the record. What was taken, not
    the name, is then examined. False when there was no such entry."""
    try:
        _rename_in(directory, name, claimed)
    except FileNotFoundError:
        return False
    return True


def _put_back(directory: Folder, claimed: str, name: str, shown: Path) -> str:
    """Return a claimed entry that turned out not to be ours to its name, untouched. Never replaces a newer file:
    when the name is taken again, the entry stays under its private name and the return value says where."""
    try:
        try:
            _link_in(directory, claimed, name, follow_symlinks=False)
        except FileExistsError:
            raise
        except (NotImplementedError, OSError):
            # It cannot be hard-linked (a folder, say): move it back, but only if the name is still free.
            try:
                _lstat(directory, name)
            except FileNotFoundError:
                _rename_in(directory, claimed, name)
                return ""
            raise FileExistsError(errno.EEXIST, "exists") from None
        if not _unlink_listed(directory, claimed):
            return f"{shown.parent / claimed} is a second name for {name} that this setup could not remove; it stays listed in the record."
        return ""
    except FileExistsError:
        return f"A file you changed is at {shown.parent / claimed}, because another file took its name while this setup was working."
    except OSError:
        return f"A file you changed is at {shown.parent / claimed}, and this setup could not put it back."


def _inspect_target(directory: Folder, name: str) -> Optional[str]:
    found = _examine(directory, name)
    return None if found is None else sha256_hex(found[0])


def _unlink_listed(directory: Folder, name: str) -> bool:
    """Delete a listed private file. True when it is gone; False when that failed, so that its name stays listed."""
    try:
        _unlink_in(directory, name)
    except FileNotFoundError:
        return True
    except OSError:
        return False
    return True


def _recover_pending(extensions: Folder, state: Dict[str, Any], hashes: set, source: bytes, shown: Path) -> Tuple[List[str], List[str]]:
    """Deal with the private files that a run which stopped left behind, by the names the record lists and no others.
    Returns (the names that stay listed, notices). A listed name whose file is gone is dropped. A staged copy is
    removed if its bytes are ones this setup wrote or the start of the file it was staging, or if it is the second
    name of the extension file. A claimed file goes back to its name if that is free, and is otherwise removed only
    if its bytes are ones this setup wrote. Anything else is foreign: it stays, listed, and a notice says so."""
    remaining: List[str] = []
    notices: List[str] = []
    for name in state["pending"]:
        try:
            info = _lstat(extensions, name)
        except FileNotFoundError:
            continue
        foreign = f"{shown / name} is listed in Tenvor's cache extension record but is not a file this setup wrote, so it was left alone."
        try:
            placed = _lstat(extensions, CACHE_EXTENSION_FILENAME)
        except FileNotFoundError:
            placed = None
        if (
            placed is not None and stat.S_ISREG(info.st_mode) and info.st_nlink == 2 and _owned_by_me(info)
            and (info.st_dev, info.st_ino) == (placed.st_dev, placed.st_ino)
        ):
            # A second name of the extension file itself: linked into place and the stop came before this name was dropped,
            # or restored and the stop came before the claimed name was dropped.
            if not _unlink_listed(extensions, name):
                remaining.append(name)
            continue
        if ".claimed-" in name:
            if placed is None:
                notice = _put_back(extensions, name, CACHE_EXTENSION_FILENAME, shown / CACHE_EXTENSION_FILENAME)
                if notice:
                    remaining.append(name)
                    notices.append(notice)
                continue
            try:
                found = _examine(extensions, name)
            except _Left:
                found = None
            if found is not None and sha256_hex(found[0]) in hashes:
                if not _unlink_listed(extensions, name):
                    remaining.append(name)
            else:
                remaining.append(name)
                notices.append(foreign)
            continue
        try:
            found = _examine(extensions, name)
        except _Left:
            found = None
        if found is not None and (sha256_hex(found[0]) in hashes or source.startswith(found[0])):
            if not _unlink_listed(extensions, name):
                remaining.append(name)
        else:
            remaining.append(name)
            notices.append(foreign)
    return remaining, notices


def _replace_extension(directory: Folder, staged: str, name: str, claimed: str, accepted: set) -> None:
    """Swap the new bytes in for an old copy that this setup wrote, and for nothing else. The old copy is deleted only
    once the new one is in place; on any failure after it was claimed, it goes back to its name. Whatever happens, the
    staged file does not outlive this call."""
    try:
        if not _claim(directory, name, claimed):
            _link_into_place(directory, staged, name)  # it vanished between the check and now
            return
        try:
            try:
                found = _examine(directory, claimed)
            except _Left:
                found = None
            if found is None or sha256_hex(found[0]) not in accepted:
                raise _Left(f"{name} was changed after setup. {CACHE_MOVE_IT_INSTALL}")
            _link_into_place(directory, staged, name)
        except BaseException as exc:
            notice = _put_back(directory, claimed, name, Path(name))
            if isinstance(exc, _Left) and notice:
                exc.reason += f". {notice}"
            raise
        _forget(directory, claimed)
    finally:
        _forget(directory, staged)


def _take_out_extension(directory: Folder, name: str, claimed: str, accepted: set) -> bool:
    """Delete the copy this setup wrote. True when it was deleted, False when there was none; _Left when it is not ours.
    On any failure after it was claimed, it goes back to its name."""
    if not _claim(directory, name, claimed):
        return False
    try:
        try:
            found = _examine(directory, claimed)
        except _Left:
            found = None
        if found is None or sha256_hex(found[0]) not in accepted:
            raise _Left("was changed after setup")
        _unlink_in(directory, claimed)
    except BaseException as exc:
        notice = _put_back(directory, claimed, name, Path(name))
        if isinstance(exc, _Left) and notice:
            exc.reason += f". {notice}"
        raise
    return True


def install_cache_extension(directory: Path) -> Dict[str, Any]:
    """Put Tenvor's extension where Pi loads it from, and record it. Never overwrites a file this setup did not write.

    Returns {"status": "installed" | "updated" | "current" | "foreign_identical" | "left", "path": Path,
    "reason": str, "notice": str}. "left" means nothing was written, and the reason says why in one sentence; the
    notice, when there is one, is about a private file that was left alone. Anything unexpected is raised. The Pi folder
    and the extensions folder are opened without following a symlink, every step after that is relative to those two
    descriptors, and the whole step runs under the lock."""
    source = cache_extension_bytes()
    digest = sha256_hex(source)
    shown_folder = directory / CACHE_EXTENSIONS_DIRNAME
    target = shown_folder / CACHE_EXTENSION_FILENAME
    with _pi_folder(directory) as root:
        try:
            with _cache_lock(root):
                return _install_locked(root, source, digest, shown_folder, target)
        except _Left as left:
            return {"status": "left", "path": target, "reason": left.reason, "notice": ""}


def _install_locked(root: Folder, source: bytes, digest: str, shown_folder: Path, target: Path) -> Dict[str, Any]:
    _clean_record_temporary(root)
    state = _read_cache_state(root)
    hashes = {digest} | ({state["sha256"], *state["also_accepts"]} if state else set())
    extensions: Optional[Folder] = None
    made = False
    wrote_record = False
    remaining: List[str] = []
    listed: List[str] = []
    previous: List[str] = []
    created_directory = False
    notices: List[str] = []
    staged_identity: Optional[Tuple[int, int]] = None

    def result(status: str, reason: str = "") -> Dict[str, Any]:
        return {"status": status, "path": target, "reason": reason, "notice": " ".join(notices)}

    try:
        extensions = _child_directory(root, CACHE_EXTENSIONS_DIRNAME, shown_folder)
        actual: Optional[str] = None
        if extensions is not None:
            entry = _extension_root_entry(extensions)
            if entry:
                raise _Left(f"{shown_folder} has its own {entry}, so Pi loads only what that names and would not load this extension")
            if state is not None:
                remaining, notices = _recover_pending(extensions, state, hashes, source, shown_folder)
            try:
                actual = _inspect_target(extensions, CACHE_EXTENSION_FILENAME)
            except _Left as left:
                raise _Left(left.reason.replace(CACHE_EXTENSION_FILENAME, str(target), 1)) from None
        if state is None:
            if actual is not None:
                if actual == digest:
                    return result("foreign_identical")
                raise _Left(f"{target} already exists and this setup did not write it. {CACHE_MOVE_IT_INSTALL}")
            accepted = {digest}
        else:
            previous = sorted(({state["sha256"]} | set(state["also_accepts"])) - {digest})
            # Only what the record names is this setup's. A file that merely has the new bytes is not.
            accepted = {state["sha256"], *state["also_accepts"]}
            if actual is not None and actual not in accepted:
                raise _Left(f"{target} was changed after setup. {CACHE_MOVE_IT_INSTALL}")
        created_directory = state["created_directory"] if state else extensions is None
        need_file = actual != digest
        if need_file:
            listed.append(_private_name(extensions, "tenvor"))
            if actual is not None:
                listed.append(_private_name(extensions, "claimed"))
        final = _record_bytes(digest, [], remaining, created_directory)
        existing = None if state is None or state["legacy"] else _record_bytes(state["sha256"], state["also_accepts"], state["pending"], state["created_directory"])
        if existing == final and actual == digest:
            return result("current")
        # The record first, with every private name this run is about to create: from here on, whatever is at those
        # names and whatever file has one of its hashes is this setup's to repair or remove.
        transition = _record_bytes(digest, previous, remaining + listed, created_directory)
        if existing != transition:
            _put_record(root, transition)
            wrote_record = state is None
        if extensions is None:
            try:
                _mkdir_in(root, CACHE_EXTENSIONS_DIRNAME, 0o700)
                made = True
            except FileExistsError:
                pass
            extensions = _child_directory(root, CACHE_EXTENSIONS_DIRNAME, shown_folder)
            if extensions is None:
                raise _Left(f"{shown_folder} could not be created")
        if need_file:
            staged = listed[0]
            staged_identity = _stage(extensions, staged, source)
            try:
                if actual is None:
                    _link_into_place(extensions, staged, CACHE_EXTENSION_FILENAME)
                else:
                    _replace_extension(extensions, staged, CACHE_EXTENSION_FILENAME, listed[1], accepted)
            finally:
                _forget(extensions, staged)
        still = [name for name in listed if _exists(extensions, name)]
        # The hashes of the earlier versions stay in the record for as long as a listed file might still hold their bytes.
        finished = _record_bytes(digest, previous if still or remaining else [], remaining + still, created_directory)
        if finished != transition:
            _put_record(root, finished)
        if actual is None:
            status = "installed"
        elif actual != digest or previous:
            status = "updated"
        else:
            status = "current"
        return result(status)
    except BaseException as exc:
        _settle_failed_install(root, extensions, state, wrote_record, made, digest, previous, remaining, listed, created_directory, staged_identity)
        if isinstance(exc, _Left):
            return result("left", exc.reason)
        raise
    finally:
        if extensions is not None:
            _close_directory(extensions)


def _settle_failed_install(root: Folder, extensions: Optional[Folder], state: Optional[Dict[str, Any]], wrote_record: bool, made: bool,
                           digest: str, previous: List[str], remaining: List[str], listed: List[str], created_directory: bool,
                           staged_identity: Optional[Tuple[int, int]]) -> None:
    """After a failure. The record is never deleted here except through _retire_record, which does so only once the extension
    is shown to be absent. If this run made the record, it first takes back the extension it linked in, but only a file that
    can be shown to be its own (the staged file's identity); a file it cannot show to be its own, or cannot remove, stays,
    and so does the record, which then names it. If the record was only changed, the names of private files that are gone
    are dropped. Best effort: a stop before this runs is what the lock and the pending list are for."""
    try:
        if state is None:
            if not wrote_record:
                return
            if extensions is not None and staged_identity is not None:
                try:
                    placed = _lstat(extensions, CACHE_EXTENSION_FILENAME)
                    if stat.S_ISREG(placed.st_mode) and (placed.st_dev, placed.st_ino) == staged_identity and _owned_by_me(placed):
                        _unlink_in(extensions, CACHE_EXTENSION_FILENAME)
                except OSError:
                    pass
            for name in listed:
                if extensions is not None:
                    _forget(extensions, name)
            if (not made or _remove_created_folder(root)) and _retire_record(root, extensions, listed + remaining):
                return
        still = [name for name in listed if _exists(extensions, name)]
        if state is not None and not listed:
            return
        # The file at the extension's name may still be the old version (it is put back when a replacement fails), so the
        # old hashes stay in the record.
        _put_record(root, _record_bytes(digest, previous, remaining + still, created_directory))
    except BaseException:
        pass


def remove_cache_extension(directory: Path) -> Dict[str, Any]:
    """Take out the extension this setup recorded, if it is still exactly what was recorded. Returns
    {"present": bool, "removed": bool, "note": str, "kept_record": bool}. A symlink at the Pi folder is refused, as
    everywhere else. The record is deleted last, and only when the extension file is gone (or was never there) and
    nothing is pending: a path that leaves the file or a private file in place leaves the record in place too."""
    with _pi_folder(directory) as root:
        try:
            with _cache_lock(root):
                return _remove_locked(root, directory)
        except _Left as left:
            return {"present": True, "removed": False, "kept_record": True,
                    "note": f"The Tenvor cache extension was left in place, because {left.reason}."}


def _remove_locked(root: Folder, directory: Path) -> Dict[str, Any]:
    shown_folder = directory / CACHE_EXTENSIONS_DIRNAME
    _clean_record_temporary(root)
    state = _read_cache_state(root)
    if state is None:
        return {"present": False, "removed": False, "note": "", "kept_record": False}
    source = CACHE_EXTENSION_SOURCE.encode("utf-8")
    accepted = {state["sha256"], *state["also_accepts"]}
    hashes = accepted | {sha256_hex(source)}
    removed = False
    notes: List[str] = []
    keep = False
    remaining: List[str] = []
    recorded: List[str] = state["pending"]
    extensions: Optional[Folder] = None
    try:
        try:
            extensions = _child_directory(root, CACHE_EXTENSIONS_DIRNAME, shown_folder)
        except _Left as left:
            notes.append(f"The Tenvor cache extension was left in place, because {left.reason}.")
            keep = True
        if extensions is not None:
            remaining, notices = _recover_pending(extensions, state, hashes, source, shown_folder)
            if remaining:
                keep = True
                notes.extend(notices)
            if _exists(extensions, CACHE_EXTENSION_FILENAME):
                claimed = _private_name(extensions, "claimed")
                recorded = sorted(remaining + [claimed])
                _put_record(root, _record_bytes(state["sha256"], state["also_accepts"], recorded, state["created_directory"]))
                try:
                    removed = _take_out_extension(extensions, CACHE_EXTENSION_FILENAME, claimed, accepted)
                except _Left as left:
                    notes.append(f"The Tenvor cache extension was left in place, because {shown_folder / CACHE_EXTENSION_FILENAME} {left.reason.rstrip('.')}. {CACHE_MOVE_IT_REMOVE}.")
                    keep = True
                if _exists(extensions, claimed):
                    remaining.append(claimed)
                    keep = True
            if keep and sorted(remaining) != recorded:
                _put_record(root, _record_bytes(state["sha256"], state["also_accepts"], remaining, state["created_directory"]))
        if not keep:
            # The file is gone and nothing is pending, if the checks below can show it. The folder this setup made, then the
            # record last, and only through _retire_record: a stop or a failure anywhere leaves a record, and the next
            # --remove finishes what is left.
            if (not state["created_directory"] or _remove_created_folder(root)) and _retire_record(root, extensions, remaining):
                pass
            else:
                keep = True
                notes.append("Tenvor's record of the cache extension was kept, because it could not be shown that nothing of it is left.")
    finally:
        if extensions is not None:
            _close_directory(extensions)
    return {"present": True, "removed": removed, "note": " ".join(notes), "kept_record": keep}


def cache_extension_recorded(directory: Path) -> bool:
    """Is there a record of an extension this setup installed? False for anything it cannot read safely."""
    try:
        with _pi_folder(directory) as root:
            return _read_cache_state(root) is not None
    except (SetupError, OSError):
        return False


# ---------------------------------------------------------------------------
# The key prompt, the checks run through Pi, and the command line.
# ---------------------------------------------------------------------------

def read_key_file(path: Path) -> str:
    """A key file must be one only you can read: a regular file you own, with no access for group or others.
    On Windows, where who can read a file is set by its permissions list and Python cannot read that, the file
    must be a regular file and is otherwise taken as you made it."""
    try:
        info = path.lstat()
    except OSError:
        raise SetupError(f"API key file not found: {path}") from None
    if _is_link_stat(info):
        raise SetupError(f"API key file {path} is a symlink. Pass the real file.")
    if not stat.S_ISREG(info.st_mode):
        raise SetupError(f"API key file is not a regular file: {path}")
    if not _owned_by_me(info):
        raise SetupError(f"API key file {path} is not owned by you.")
    if info.st_mode & 0o077 and not WINDOWS:
        raise SetupError(
            f"API key file {path} can be read by other users. Run `chmod 600 {shlex.quote(str(path))}` "
            "and try again."
        )
    if info.st_size > 4096:
        raise SetupError("API key file exceeds the safety limit.")
    if WINDOWS:
        return validate_api_key(_read_windows_key_file(path))
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise SetupError("API key file is not UTF-8 text.") from None
    except OSError:
        raise SetupError(f"API key file could not be read: {path}") from None
    return validate_api_key(text)


def _read_windows_key_file(path: Path) -> str:
    """Windows PowerShell 5.1 writes UTF-16 for > and Out-File, and Set-Content -Encoding UTF8 adds a byte-order mark."""
    try:
        raw = path.read_bytes()
    except OSError:
        raise SetupError(f"API key file could not be read: {path}") from None
    try:
        return raw.decode("utf-16") if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise SetupError("API key file is not UTF-8 or UTF-16 text.") from None


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
    if WINDOWS:
        try:
            return validate_api_key(_read_masked_windows(WINDOWS_KEY_PROMPT))
        except EOFError:
            raise SetupError(
                "Typing the key needs a console window. Run setup in PowerShell, Windows Terminal or Command Prompt, "
                "or use --key-file with a file only you can read."
            ) from None
    # getpass falls back to echoed input without a usable terminal. Stop instead:
    # a Tenvor key can spend a balance.
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            return validate_api_key(getpass.getpass("Tenvor API key (input hidden): "))
    except (getpass.GetPassWarning, EOFError):
        raise SetupError(
            "Hidden terminal input is unavailable. Run setup in an interactive terminal, "
            "or use --key-file with a file only you can read."
        ) from None


def pi_listing(executable: str) -> Optional[Dict[str, Any]]:
    """What `pi --list-models` shows, read offline. Pi prints a table whose first two columns are the
    provider and the model id (cli/list-models.ts), and warns on stderr when models.json did not load."""
    result = run_pi(executable, ["--offline", "--list-models"])
    if result is None or result.returncode != 0:
        return None
    output = result.stdout.decode("utf-8", "replace")[:2_000_000]
    rows = [line.split() for line in output.splitlines()]
    rows = [row for row in rows if len(row) >= 2 and row[0] != "provider"]
    return {
        "rows": rows,
        "providers": {row[0] for row in rows},
        "rejected": "errors loading models.json" in result.stderr.decode("utf-8", "replace").lower(),
    }


def verify_with_pi(executable: str, baseline: Optional[Dict[str, Any]], custom_providers: List[str]) -> Dict[str, Any]:
    """Ask Pi itself, offline, whether it now lists the model. Pi drops every custom provider in
    models.json if any of it fails its schema, so also compare with what Pi listed before the change."""
    after = pi_listing(executable)
    listed = None if after is None else any(row[0] == PROVIDER_ID and row[1] == MODEL_ID for row in after["rows"])
    lost: List[str] = []
    if after is not None and baseline is not None:
        lost = sorted(name for name in custom_providers if name in baseline["providers"] and name not in after["providers"])
    auth = run_pi(executable, ["auth", "check", "--provider", PROVIDER_ID])
    return {
        "listed": listed,
        "rejected": bool(after and after["rejected"]),
        "baseline_rejected": bool(baseline and baseline["rejected"]),
        "lost": lost,
        "credential_ready": None if auth is None else auth.returncode == 0,
    }


def pi_command(executable: str, *arguments: str) -> str:
    on_path = which("pi")
    same = bool(on_path) and os.path.normcase(os.path.abspath(on_path)) == os.path.normcase(os.path.abspath(executable))
    program = "pi" if same else executable
    if same and WINDOWS and Path(executable).suffix.lower() == ".cmd" and Path(executable).with_suffix(".ps1").exists():
        # PowerShell runs pi.ps1 for a bare pi when both are there (npm writes both), and a default execution policy
        # refuses it. Named in full, pi.cmd runs either way.
        program = "pi.cmd"
    return shell_command([program, *arguments])


def credential_protection(path: Path) -> str:
    """Who can read the credential file, said truly for this system."""
    if not WINDOWS:
        return "mode 600"
    try:
        path.resolve().relative_to(Path.home().resolve())
    except (OSError, RuntimeError, ValueError):
        return "outside your user profile, so that folder's Windows permissions apply"
    return "in your user profile: by default only you, administrators and the system can read it"


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Configure Tenvor for Pi.")
    parser.add_argument("--key-file", type=Path, help="Read the Tenvor API key from this file instead of prompting.")
    parser.add_argument("--rotate-key", action="store_true", help="Prompt for a new Tenvor key and replace the stored one.")
    parser.add_argument("--remove", action="store_true", help="Remove only what this setup added to Pi (the extension included), and put back the default model setting it replaced, if it set one.")
    parser.add_argument(
        "--no-cache-extension", action="store_true",
        help="Do not install Tenvor's small Pi extension that turns on the session cache. One installed by an earlier run is left as it is.",
    )
    return parser.parse_args(argv)


def _undo_this_run(directory: Path, result: Dict[str, Any]) -> None:
    """Put every file back as it was before this run, because Pi did not accept what was written."""
    snapshots = result["snapshots"]
    if snapshots:
        with HeldLocks(directory, ["auth.json", "settings.json"]):
            restore_snapshots(snapshots)
        for made in result["backups"]:  # the files are back, so their copies are no use
            made.unlink(missing_ok=True)
    _PHASE["committed"] = None
    if result["created_directory"]:
        try:
            directory.rmdir()
        except OSError:
            pass


def _cache_extension_step(args: argparse.Namespace, directory: Path, confirmed: bool) -> List[str]:
    """The lines to print about the cache extension. It runs after the model setup is complete and confirmed, and
    whatever goes wrong in it is one line here: it can never undo or fail the setup."""
    if args.no_cache_extension:
        line = "Cache extension: not installed, because you asked for --no-cache-extension."
        if cache_extension_recorded(directory):
            line += " The one from an earlier run is still installed; --remove takes it out."
        return [line]
    if not confirmed:
        return ["Cache extension: not installed, because Pi did not list the model. Run this setup again once it does."]
    try:
        result = install_cache_extension(directory)
    except Exception as exc:  # the model setup is already done; this step may fail in any way
        if isinstance(exc, SetupError):
            reason = str(exc)
        elif isinstance(exc, OSError):
            reason = f"a file operation failed ({exc})"
        else:
            reason = f"unexpected {exc.__class__.__name__}"
        reason = " ".join(reason.split())
        return [f"Cache extension: NOT installed ({reason}). Pi works with Tenvor without it; only long sessions are not kept warm."]
    path = result["path"]
    extra = [f"Cache extension: {result['notice']}"] if result.get("notice") else []
    if result["status"] == "left":
        return [f"Cache extension: not installed ({result['reason']}). Pi works with Tenvor without it; only long sessions are not kept warm."] + extra
    if result["status"] == "current":
        return ["Cache extension: already installed and current."] + extra
    if result["status"] == "foreign_identical":
        return [
            f"Cache extension: {path} is identical to Tenvor's, but this setup did not write it, so it is left as it is and "
            "--remove will not delete it. Pi uses it."
        ] + extra
    verb = "installed at" if result["status"] == "installed" else "updated at"
    return [
        f"Cache extension: {verb} {path}.",
        "It adds three request headers to Tenvor requests so a follow-up can reuse the node's working state, and does nothing else. Pi loads it at its next start.",
    ] + extra


def _setup_command(args: argparse.Namespace, directory: Path) -> int:
    executable, version = ensure_pi(directory)
    model = fetch_catalog_model()
    state = read_state(directory / STATE_FILENAME)
    api_key: Optional[str] = None
    credential_ok = False
    if state is not None:
        stored = ManagedFile(directory, "auth.json", False).python().get(PROVIDER_ID)
        credential_ok = isinstance(stored, dict) and stored.get("type") == "api_key" and isinstance(stored.get("key"), str)
    if args.key_file:
        api_key = read_key_file(args.key_file.expanduser())
    elif state is None or args.rotate_key or not credential_ok:
        api_key = prompt_api_key()
    baseline = pi_listing(executable)
    result = configure(directory, model, api_key)

    # Pi is asked before anything is called ready, and a change Pi rejects is taken back.
    verdict = verify_with_pi(executable, baseline, result["custom_providers"])
    if verdict["rejected"] or (verdict["listed"] is False and verdict["lost"]):
        _undo_this_run(directory, result)
        if verdict["baseline_rejected"]:
            reason = "Pi already reported errors in your models.json before this setup changed anything, so Tenvor cannot be used until that is fixed. Run `pi --list-models` to see what Pi says."
        else:
            lost = f" and stopped listing {', '.join(verdict['lost'])}" if verdict["lost"] else ""
            reason = (
                f"Pi did not accept the change to models.json{lost}. This setup may need an update for Pi {version}."
            )
        if result["snapshots"]:
            ending = "Every file was put back as it was before this run."
        else:
            ending = "This run changed nothing; Tenvor from an earlier setup is still in your Pi files. Run this launcher again with --remove to take it out."
        print(f"Tenvor Pi setup stopped: {reason} {ending}", file=sys.stderr)
        return 1

    confirmed = verdict["listed"] is True
    print("Tenvor is set up in Pi." if confirmed else
          f"Tenvor was added to Pi's files, but it is NOT confirmed: Pi did not list {MODEL_REF}.")
    if not result["changed"]:
        print("Nothing needed changing: it was already set up and current.")
    print(f"Provider: {PROVIDER_ID} in {result['models_path']}")
    print(f"Model: {MODEL_REF}")
    print(f"Live limits: {model['context']:,} context / {model['output']:,} output tokens")
    if model.get("reasoning") is True:
        print(
            "Thinking: Pi sends its thinking levels (off, low, medium, high, max) to Tenvor as reasoning_effort, and "
            "starts at medium unless you set another default. Change the level with /thinking or Shift+Tab. "
            "Thinking is billed as output tokens."
        )
    if result["key_written"]:
        print(f"Credential: stored in {result['auth_path']} ({credential_protection(result['auth_path'])})")
    elif result["key_owned"]:
        print("Credential: the key stored earlier was kept.")
    else:
        print("Credential: the Tenvor credential in auth.json is not the one setup stored; it was left as it is.")
    if result["tightened"]:
        print("auth.json was readable by other users. It is now readable only by you.")
    if not result["provider_owned"]:
        print("The Tenvor provider in models.json was changed after setup. Your version was kept.")
    if result["default_state"] == "ours":
        print(f"Pi starts with {MODEL_REF} by default, because no default model was set.")
    elif result["default_state"] == "yours":
        print("Your default model was left as it is. To start Pi with Tenvor, use the command below.")
    else:
        print("Pi's default model was changed after setup. Your choice was kept; Pi does not start with Tenvor by default.")
    if result["enabled_models_set"]:
        print("Your settings list enabledModels, and Pi starts with the first model that matches it, before the default. Use the command below to be sure.")
    for backup in result["backups"]:
        print(f"Backup: {backup}")
    print(
        f"Checked with Pi: it lists {MODEL_REF}." if confirmed else
        f"Pi did not list {MODEL_REF}. Run `pi --list-models` to see what Pi says."
    )
    print(
        "Checked with Pi: it reports the Tenvor credential ready." if verdict["credential_ready"] else
        f"Could not confirm with Pi that the credential is ready. Run `pi auth check --provider {PROVIDER_ID}` to see."
    )
    for line in _cache_extension_step(args, directory, confirmed):
        print(line)
    if version in TESTED_PI_VERSIONS:
        print(f"Pi {version} is a version this setup was tested on.")
    else:
        print(f"Pi {version} is newer than {REVIEWED_PI_VERSION}, the newest version this setup was tested on. The files it edits are expected to be the same shape.")
    print("")
    print("Start Pi with the Tenvor model:")
    print(f"  {pi_command(executable, '--provider', PROVIDER_ID, '--model', MODEL_ID)}")
    print("Check that it works (one short request):")
    print(f"  {pi_command(executable, '--provider', PROVIDER_ID, '--model', MODEL_ID, '--print', 'Say hello in one line.')}")
    print(f"Then look for the charge on the Usage page: {CONSOLE_USAGE_URL}")
    print("If Pi is already running, restart it so that it reads the change.")
    print("To undo all of this, run this launcher again with --remove.")
    print("")
    print("Pi does not ask before it reads, edits or runs. Try it on a synthetic or non-sensitive project during the alpha.")
    return 0 if confirmed else 2


def _extension_failure_text(exc: BaseException) -> str:
    if isinstance(exc, SetupError):
        reason = str(exc)
    elif isinstance(exc, OSError):
        reason = f"a file operation failed ({exc})"
    else:
        reason = f"unexpected {exc.__class__.__name__}"
    return " ".join(reason.split())


def _cache_record_present(directory: Path) -> bool:
    """Is there a record of the extension? If it cannot be read now, True: the removal then reports what it finds."""
    try:
        with _pi_folder(directory) as root:
            return _read_cache_state(root) is not None
    except (SetupError, OSError):
        return True


def _remove_command(directory: Path) -> int:
    if not os.path.lexists(str(directory)):
        raise SetupError("No Tenvor setup made by this script was found in Pi's folder. Nothing was removed.")
    # The Pi folder is opened without following a symlink before anything in it is read, cache-only removal included.
    # If the record cannot be read now, the removal below reports what it finds.
    cache_present = _cache_record_present(directory)
    models_present = read_state(directory / STATE_FILENAME) is not None
    if not cache_present and not models_present:
        raise SetupError("No Tenvor setup made by this script was found in Pi's folder. Nothing was removed.")
    # The model setup goes first: it is the part that can be refused (Pi writing its files), and a refusal then changes nothing.
    result = remove(directory) if models_present else None
    extension = {"present": False, "removed": False, "note": "", "kept_record": False}
    failure: Optional[str] = None
    again = ""
    if cache_present:
        # The extension is a step of its own. Once the model setup is removed, a failure here is one line and does not
        # change the exit code; when it is all there was to remove, it is the failure.
        try:
            extension = remove_cache_extension(directory)
        except (SetupError, OSError) as exc:
            failure = _extension_failure_text(exc)
            again = " Run --remove again to finish." if isinstance(exc, OSError) else ""
    if extension["present"] or failure:
        _PHASE["committed"] = "remove"
    if result is None:
        if failure:
            raise SetupError(f"The Tenvor cache extension was not removed ({failure}).{again}")
        if not extension["present"]:
            raise SetupError("No Tenvor setup made by this script was found in Pi's folder. Nothing was removed.")
    kept = "Tenvor's record of it was kept, so that running --remove again finishes the job once the file is gone."
    if result is None:
        if extension["kept_record"]:
            print("Tenvor's cache extension was left in Pi's configuration.")
        else:
            print("Tenvor's cache extension was removed from Pi's configuration." if extension["removed"] else "Tenvor's cache extension record was removed.")
        if extension["note"]:
            print(extension["note"])
        if extension["kept_record"]:
            print(kept)
        print("Nothing else of Tenvor's was found in Pi's folder. Pi itself was not uninstalled, and your key was not revoked on Tenvor.")
        return 0
    print("Tenvor was removed from Pi's configuration.")
    print(f"Provider removed from models.json: {'yes' if result['removed_provider'] else 'no'}")
    print(f"Credential removed from auth.json: {'yes' if result['removed_credential'] else 'no'}")
    if result["removed_credential"]:
        print("No copy of the key was kept in Pi's folder.")
    if result["restored_default"]:
        if result["restored"]:
            print("Pi's default model is back to " + "/".join(str(part) for part in result["restored"]) + ".")
        else:
            print("Pi's default model setting is back to how it was before setup.")
    if failure:
        print(f"Cache extension: NOT removed ({failure}).{again}")
    elif extension["present"]:
        print(f"Cache extension removed: {'yes' if extension['removed'] else 'no'}")
        if extension["note"]:
            print(extension["note"])
        if extension["kept_record"]:
            print(kept)
    for note in result["notes"]:
        print(note)
    for backup in result["backups"]:
        print(f"Backup: {backup}")
    print("Pi itself was not uninstalled, and your key was not revoked on Tenvor. Use the Console for that.")
    return 0


def _stopped_after_writing(cause: str) -> str:
    """What to tell a person whose run was cut short after the files had already been written."""
    if _PHASE["committed"] == "remove":
        return (
            f"Tenvor Pi setup {cause} after it had removed Tenvor from your Pi files. The removal is done. "
            "Run this launcher again with --remove to confirm that nothing is left."
        )
    return (
        f"Tenvor Pi setup {cause} after it had written your Pi files. Tenvor is now in your Pi configuration "
        "and your key is stored in auth.json. To undo it, run this launcher again with --remove."
    )


def main(argv: Optional[List[str]] = None) -> int:
    if WINDOWS:
        # A redirected Windows console can use a code page that cannot show a path or the ellipsis in the key error.
        # Printing must never end the run with a traceback.
        for stream in (sys.stdout, sys.stderr):
            reconfigure = getattr(stream, "reconfigure", None)
            if reconfigure is not None:
                reconfigure(errors="replace")
    args = parse_args(argv)
    _PHASE["committed"] = None
    previous_umask = os.umask(0o077)
    try:
        if sys.platform not in {"linux", "darwin", "win32"}:
            raise SetupError("This setup supports Linux, macOS and Windows.")
        if not WINDOWS and os.environ.get("SUDO_USER") and os.geteuid() == 0:
            raise SetupError("Run this as your regular user, not with sudo: it changes your own Pi configuration.")
        directory = resolve_agent_dir()
        if args.remove:
            if args.key_file or args.rotate_key or args.no_cache_extension:
                raise SetupError("--remove cannot be combined with credential options or --no-cache-extension.")
            return _remove_command(directory)
        return _setup_command(args, directory)
    except SetupError as exc:
        print(f"Tenvor Pi setup stopped: {exc}", file=sys.stderr)
        return 1
    except OSError as exc:
        if _PHASE["committed"]:
            print(_stopped_after_writing(f"could not finish ({exc.__class__.__name__})"), file=sys.stderr)
        else:
            print(f"Tenvor Pi setup stopped: a file operation failed ({exc}). Any change it had started was put back.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        if _PHASE["committed"]:
            print(_stopped_after_writing("was interrupted"), file=sys.stderr)
        else:
            print("Tenvor Pi setup was interrupted. Any file it had started to change was put back.", file=sys.stderr)
        return 130
    finally:
        os.umask(previous_umask)


def _install_signal_handlers() -> None:
    def interrupt(signum: int, frame: Any) -> None:
        raise KeyboardInterrupt()
    for name in ("SIGTERM", "SIGHUP"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), interrupt)


# The cache extension, byte for byte as site/pi-extension/tenvor-session-kv.js. Do not edit it here: edit that
# file and run `python3 scripts/pin_pi_setup.py` from the site folder, which copies it in and re-pins everything.
# Read it before you run this setup if you like: it is plain JavaScript, it has no imports, and its first
# comment says what it does and what it relies on in Pi.
CACHE_EXTENSION_SHA256 = "e6d58a94253ce7fda36dcc561a3d19c78cded006f214bb702c02d174b7a5098e"
CACHE_EXTENSION_SOURCE = r"""// Tenvor session cache for Pi (https://tenvor.io).
//
// Installed by Tenvor's Pi setup as <Pi folder>/extensions/tenvor-session-kv.js,
// where Pi loads it by itself. It changes nothing but three request headers, and
// only on requests for the Tenvor model this setup configured. If anything here
// fails, the request goes out exactly as Pi built it, without the cache.
//
// The protocol (the Orchestrator's header parser, and the reviewed OpenCode
// plugin tenvor-session-kv-plugin.mjs, which this follows):
//   - A request opts in with X-Tenvor-Session-KV: v1 and an
//     X-Tenvor-Session-Scope of 64 lowercase hex characters, not all zero. The
//     scope names one conversation. It is random, kept in memory, and never
//     shared between conversations.
//   - From the second request on it adds X-Tenvor-Session-Lease, the 43
//     characters the node returned in the tenvor_session_kv object on the final
//     (finish_reason) chunk of the previous reply. Without a lease every request
//     is served cold. A lease the node no longer knows is served cold too.
//   - A lease idles out 120 s after its last use and ends 900 s after the first
//     accepted reply of the chain, whatever happens. The reply says when, in
//     idle_expires_at_unix_ms and absolute_expires_at_unix_ms.
//
// Pi API used (read from Pi 1.1.0 and compared with 1.2.0, where it is the same):
//   pi.on("context_with_system", (event, ctx))  event.messages is the full
//       transcript, including system content, sections and toolsAdded/toolsRemoved.
//       Fingerprint it before headers; never retain the transcript itself.
//   pi.on("before_provider_headers", (event, ctx))  event.headers is mutated in
//       place; the return value is ignored. The event carries nothing else, so
//       the destination comes from ctx.model (the model of the session).
//   pi.on("provider_stream_event", (event))  event.provider / api / model name
//       the model, event.data is each parsed chunk before Pi normalizes it.
//   pi.on("message_end", (event))  event.message is the finished assistant
//       message (also after an error or a cancel); it ends a request that never
//       sent a finish chunk.
//   pi.on("session_start" | "session_shutdown", ...)  a new session runs in a
//       new runtime with a new copy of this state; both events reset it anyway.
//   pi.on("session_compact" | "session_tree", ...)  invalidate retained state
//       after compaction or tree navigation, including replies still in flight.
//   ctx.sessionManager.getSessionId()  tells conversations apart.
//   ctx.model / ctx.thinkingLevel  expose model rendering options and reasoning.
// This extension never aborts, retries, sends a request, or touches anything
// else of Pi's.
//
// At headers compare this turn's snapshot, model/thinking controls, effective
// system prompt and active tools. Failure/end boundaries and the BEFORE
// compact/tree/fork/switch events clear pending snapshots before side requests.
// before_provider_request fingerprints the payload as observed by this extension
// and verifies extension of the previous observed payload; observation is
// mandatory before a reply may install a lease. Message conversion is left to
// Pi, so an unmodelled content shape cannot disable reuse for the entire history.
// Sequential foreign-provider exchanges leave an unspent Tenvor lease intact;
// their snapshots/payloads/replies cannot supply its cache authority. Returning
// to Tenvor checks a newly captured snapshot against the stored fingerprints.
// Headers freeze the destination, scope, snapshot, sent lease and control digest
// in an exchange record. Later hooks never consult the selected model or other
// live context. Anonymous payload hooks use the latest header record; overlapping
// Tenvor exchanges are tainted. Known stream ids find their bounded records;
// unknown ids use the sole current record, with destination checks and fencing.
// Both versions dispatch payload handlers in extension load order, after headers;
// load this extension after payload editors to observe their changes.
//
// A prompt change after the header check, or a concurrent custom request taking
// another request's turn snapshot, can still send an incompatible lease. A
// shorter request may then be refused at no charge; Pi's agent retry rebuilds it
// cold, while enabled provider retries may resend the same headers. A payload
// handler after this observer can also change the body unseen, so this extension
// does not claim to observe the final sent payload or a unique request identity.
//
// When a reply may give its lease back (Pi's events carry no request identity, so
// this is deliberately conservative). A lease is kept only from a reply that
//   - carries a response id, the same on every chunk of the reply;
//   - belongs to a request that was the ONLY Tenvor request in flight from the
//     moment its headers were written until its finish chunk: if another request
//     starts, or the session is reset, in that window, nothing is kept from either
//     reply, and the requests that follow go out cold until one clean reply
//     completes;
//   - was issued in the current epoch (a reset starts a new one), checked on the
//     request the chunk belongs to, never on the newest request;
//   - carries its cache object on or before the finish chunk, and shows no error
//     chunk or second cache object afterwards. A kept lease that is not spent yet
//     is taken back by any of those, and by any chunk that cannot be attributed
//     (no id, an id the request does not own, an id of an overtaken reply).
// A request that was overtaken before it said anything may still answer later and
// cannot be told from the next request's first chunk, so after one the next
// fifteen minutes (longer than the node keeps any request) keep nothing.
//
// The header hook is the gate. Stream events name only the provider, the API and
// the model, never the address, so another server under the same names cannot be
// told apart by its chunks. Therefore ANY request that passes through the header
// hook while a Tenvor request is pending overlaps it (whatever its model, provider
// or address). A foreign header gets an ineligible record for payload isolation;
// it cannot be bound to a cache reply: its reply produces no lease, and
// a look-alike (our names, another address) quarantines like an overtaken request.
//
// What follows the finish chunk, from the Orchestrator's stream code, in this order:
// content and tool chunks (each with "usage": null), the finish chunk (finish_reason,
// and the cache object), then, only when the request set stream_options.include_usage
// (Pi does), ONE usage-only chunk ("choices": [], a usage object, no cache object),
// then [DONE]. They all carry one response id. That usage-only chunk is the only
// chunk allowed after the finish chunk; any other chunk of the same reply takes an
// unspent lease back.
//
// Differences from the OpenCode plugin, all forced by what Pi lets an extension
// see: Pi gives no request identity, so replies are matched by their response id and
// the rule above; Pi shows no end-of-stream event, so a lease is kept at the finish
// chunk that carries it; an invalid cache object drops the lease where OpenCode
// raises a stream error; Pi gives no Authorization header, so a changed key is not
// noticed (the node binds a lease to the key and serves cold); and any
// X-Tenvor-Session-* header already on the request means someone set it up by
// hand, so it is left alone.

const PROVIDER = "tenvor";
const MODEL = "chat-35b-moe";
const API = "openai-completions";
const BASE_URL = "https://orchestrator.tenvor.io/v1";

const KV_HEADER = "X-Tenvor-Session-KV";
const SCOPE_HEADER = "X-Tenvor-Session-Scope";
const LEASE_HEADER = "X-Tenvor-Session-Lease";

const SCOPE = /^[0-9a-f]{64}$/;
// 43 base64url characters that decode to 32 bytes: the last one carries only 4
// bits, so it is one of sixteen. The node rejects anything else with HTTP 400.
const LEASE = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const MAX_INPUT_TOKENS = 65536;
const MAX_REMEMBERED_RESPONSES = 16;
const MAX_RESPONSE_ID = 256;
const MAX_PROMPT_BYTES = 16 << 20;
// The node stops any request after 2 minutes queued and 11 minutes active.
const ORPHAN_QUARANTINE_MS = 15 * 60 * 1000;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const positive = (n) => Number.isSafeInteger(n) && n > 0;
const count = (n) => Number.isSafeInteger(n) && n >= 0 && n <= MAX_INPUT_TOKENS;

function randomScope() {
  const source = globalThis.crypto;
  if (!source || typeof source.getRandomValues !== "function") throw new Error("no random source");
  const bytes = new Uint8Array(32);
  source.getRandomValues(bytes);
  let scope = "";
  for (const byte of bytes) scope += (byte < 16 ? "0" : "") + byte.toString(16);
  if (!SCOPE.test(scope) || /^0+$/.test(scope)) throw new Error("bad scope");
  return scope;
}

// Pi requires Node >= 22.19. Use its synchronous builtin without imports or
// loader dependencies. If unavailable, the guarded context hook goes cold.
function newDigest() {
  return globalThis.process.getBuiltinModule("node:crypto").createHash("sha256");
}

const canonical = (value) => JSON.stringify(value, (_, part) =>
  part && typeof part === "object" && !Array.isArray(part)
    ? Object.fromEntries(Object.keys(part).sort().map((key) => [key, part[key]])) : part);
// The reviewed Orchestrator parses these separately from rendered input:
// dynamic_chat_production_v1.go:2259, session_kv_render_policy_v1.go:398.
// Unknown fields remain rendering-relevant. Do not discard an entire sampling
// map: Pi permits it to override tool and chat-template fields.
const GENERATION_FIELDS = new Set(["temperature", "top_p", "top_k", "seed", "stop", "max_tokens", "max_completion_tokens", "reasoning_effort", "reasoning", "thinking"]);
const renderOptions = (options) => Object.fromEntries(Object.entries(options || {}).filter(([key]) => !GENERATION_FIELDS.has(key)));

function renderingControls(selectedModel, thinkingLevel, systemPrompt, activeTools) {
  // Metadata and headers do not render; all other model fields are conservative
  // inputs, including compat, reasoning, thinkingLevelMap, maxTokens and the
  // samplingParams maps (which can override tool_choice/parallel_tool_calls or
  // thinking/reasoning/chat-template fields, despite their name).
  const model = Object.fromEntries(Object.entries(selectedModel).filter(([key]) =>
    !["name", "cost", "headers", "contextWindow"].includes(key)));
  if (model.samplingParams) model.samplingParams = renderOptions(model.samplingParams);
  if (model.samplingParamsByThinkingLevel) model.samplingParamsByThinkingLevel = Object.fromEntries(
    Object.entries(model.samplingParamsByThinkingLevel).map(([level, options]) => [level, renderOptions(options)]));
  // Omitted and sampling-only maps describe the same rendered prompt.
  if (model.samplingParams && !Object.keys(model.samplingParams).length) delete model.samplingParams;
  if (model.samplingParamsByThinkingLevel) {
    model.samplingParamsByThinkingLevel = Object.fromEntries(Object.entries(model.samplingParamsByThinkingLevel)
      .filter(([, options]) => Object.keys(options).length));
    if (!Object.keys(model.samplingParamsByThinkingLevel).length) delete model.samplingParamsByThinkingLevel;
  }
  if (typeof systemPrompt !== "string" || !Array.isArray(activeTools) || activeTools.some((name) => typeof name !== "string")) throw new Error("unobservable projection");
  return newDigest().update(canonical({ model, thinkingLevel, systemPrompt, activeTools })).digest("hex");
}

function destinationOf(model) {
  if (!model || typeof model !== "object") return undefined;
  const destination = { provider: model.provider, id: model.id, api: model.api, baseUrl: model.baseUrl };
  // Copy only bounded primitives, never the mutable model object or its options.
  for (const [key, value] of Object.entries(destination)) {
    if (value !== undefined && (typeof value !== "string" || value.length > (key === "baseUrl" ? 2048 : 256))) throw new Error("invalid destination");
  }
  if (destination.baseUrl) destination.baseUrl = destination.baseUrl.replace(/\/+$/, "");
  return Object.freeze(destination);
}

function promptFingerprint(messages, controls, previous) {
  if (!Array.isArray(messages) || messages[0]?.role !== "system") return undefined;
  const digest = newDigest(), rendering = newDigest().update(controls).update("\n");
  let prefix, bytes = 0;
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message || typeof message.role !== "string" || !message.role) return undefined;
    // Timestamps and receipt/UI metadata do not render. Keep other fields, but
    // canonicalize ordinary JSON objects as the server does. Sections are the
    // exception: Pi renders their insertion order.
    const projected = Object.fromEntries(Object.entries(message).filter(([key]) =>
      !["timestamp", "usage", "diagnostics", "responseId"].includes(key)));
    // Section order renders, unlike ordinary JSON object property ordering.
    if (projected.sections) projected.sections = Object.entries(projected.sections);
    const text = canonical(projected);
    bytes += Buffer.byteLength(text) + 1;
    if (bytes > MAX_PROMPT_BYTES) return undefined;
    digest.update(text).update("\n");
    if (i + 1 === previous?.count) prefix = digest.copy().digest("hex");
    // Later system/tool updates may be hoisted into the leading rendered prompt
    // or tool list. They must invalidate reuse even when appended to the context.
    if (message.role === "system") rendering.update(text).update("\n");
  }
  const prompt = { count: messages.length, messages: digest.digest("hex"), rendering: rendering.digest("hex") };
  return { prompt, extendsPrevious: !!previous && previous.messages === prefix && previous.rendering === prompt.rendering };
}

function payloadFingerprint(body, previous) {
  if (!body || body.model !== MODEL || !Array.isArray(body.messages) || !body.messages.length) return undefined;
  const fields = renderOptions(body);
  delete fields.messages; delete fields.stream; delete fields.stream_options;
  fields.tools = body.tools || [];
  fields.tool_choice = body.tool_choice ?? (fields.tools.length ? "auto" : "none");
  fields.parallel_tool_calls = body.parallel_tool_calls ?? !!fields.tools.length;
  const rendering = newDigest().update(canonical(fields)).digest("hex"), digest = newDigest();
  let prefix, bytes = 0;
  for (let i = 0; i < body.messages.length; i++) {
    const message = { ...body.messages[i] };
    if (Array.isArray(message.content) && message.content.every((part) => part?.type === "text" && typeof part.text === "string")) {
      // chat_content_parts_v1.go joins accepted text-only parts with newlines.
      message.content = message.content.map((part) => part.text).join("\n");
    }
    if (Array.isArray(message.tool_calls)) message.tool_calls = message.tool_calls.map((call) => {
      // Normalize known JSON function arguments as the server does. Other
      // provider tool shapes/argument encodings remain exactly as observed.
      if (typeof call?.function?.arguments !== "string") return call;
      let args;
      try { args = canonical(JSON.parse(call.function.arguments)); } catch (_) { return call; }
      return { ...call, function: { ...call.function, arguments: args } };
    });
    const text = canonical(message);
    bytes += Buffer.byteLength(text) + 1;
    if (bytes > MAX_PROMPT_BYTES) return undefined;
    digest.update(text).update("\n");
    if (i + 1 === previous?.count) prefix = digest.copy().digest("hex");
  }
  const prompt = { count: body.messages.length, messages: digest.digest("hex"), rendering };
  return { prompt, extendsPrevious: !!previous && previous.messages === prefix && previous.rendering === rendering };
}

// Only the Tenvor model this setup configured: the provider id, the model id, the
// API and the exact base URL. A provider that someone repointed gets nothing.
function isTenvorModel(model) {
  return !!model && typeof model === "object" &&
    model.provider === PROVIDER && model.id === MODEL && model.api === API &&
    typeof model.baseUrl === "string" && model.baseUrl.replace(/\/+$/, "") === BASE_URL;
}

// The cache object of a reply, or undefined if it is anything but the closed
// shape the node sends.
// The chunk Tenvor sends after the finish chunk when stream_options.include_usage is set: no choice, a usage object,
// no error and no cache object.
function isUsageOnlyChunk(data) {
  return Array.isArray(data.choices) && data.choices.length === 0 &&
    !!data.usage && typeof data.usage === "object" && !Array.isArray(data.usage) &&
    !hasOwn(data, "error") && !hasOwn(data, "tenvor_session_kv");
}

function parseCacheObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  value = { ...value }; // later handlers may edit the chunk; retain only the validated observation
  const required = ["version", "disposition", "status", "reused_input_tokens", "evaluated_input_tokens"];
  const allowed = required.concat(["lease", "idle_expires_at_unix_ms", "absolute_expires_at_unix_ms"]);
  if (required.some((key) => !hasOwn(value, key)) || Object.keys(value).some((key) => !allowed.includes(key))) return undefined;
  if (value.version !== 1 || !["retained", "erased", "quarantined"].includes(value.disposition) ||
      !["cold", "reused", "fallback"].includes(value.status)) return undefined;
  if (!count(value.reused_input_tokens) || !count(value.evaluated_input_tokens) ||
      value.reused_input_tokens + value.evaluated_input_tokens > MAX_INPUT_TOKENS) return undefined;
  if (value.status === "reused" ? value.reused_input_tokens === 0 : value.reused_input_tokens !== 0) return undefined;
  if (value.disposition === "retained") {
    if (typeof value.lease !== "string" || !LEASE.test(value.lease) ||
        !positive(value.idle_expires_at_unix_ms) || !positive(value.absolute_expires_at_unix_ms) ||
        value.idle_expires_at_unix_ms > value.absolute_expires_at_unix_ms) return undefined;
  } else if (hasOwn(value, "lease") || hasOwn(value, "idle_expires_at_unix_ms") || hasOwn(value, "absolute_expires_at_unix_ms")) {
    return undefined;
  }
  return Object.freeze(value);
}

// TENVOR_PI_CACHE_LOG=<file> appends one JSON line per request and reply: whether
// a lease was sent, the node's verdict, token counts. Never a scope or a lease.
// Off unless asked for, and silent if the file cannot be written.
function createLog() {
  try {
    const process = globalThis.process;
    const path = process && process.env && process.env.TENVOR_PI_CACHE_LOG;
    const fs = path && typeof process.getBuiltinModule === "function" ? process.getBuiltinModule("node:fs") : undefined;
    if (!fs) return () => {};
    return (entry) => {
      try { fs.appendFileSync(path, JSON.stringify(Object.assign({ at: new Date().toISOString() }, entry)) + "\n", { mode: 0o600 }); } catch (_) { /* logging must never matter */ }
    };
  } catch (_) {
    return () => {};
  }
}

export default function tenvorSessionKV(pi) {
  if (!pi || typeof pi.on !== "function") return;
  const log = createLog();

  // All state is per factory call, which Pi makes once per session runtime. Nothing
  // lives at module level, so no conversation can see another's scope or lease.
  //
  // Each header gets one bounded record. Its destination/scope/control/snapshot
  // values are copied at commitment, never references to Pi's live model/context.
  let epoch = 0;
  let sessionId;
  let scope;
  let lease;                 // one lease with observed-payload/context fingerprints
  let pendingPrompt;         // this turn's bounded snapshot, never message text
  let turn;                  // one ordinary request ticket between turn_start and its completion
  let turnSequence = 0;
  let current;               // the one request in flight, or undefined
  let exchange;              // latest header record (Tenvor or foreign); at most one anonymous payload slot
  let carryTaint = false;    // a reset orphaned a request: the next one did not have the node to itself
  let quarantineUntil = 0;   // an orphan that never spoke may still answer, up to this time
  const responses = new Map(); // response id -> record, oldest first, at most MAX_REMEMBERED_RESPONSES

  function remember(id, record) {
    responses.delete(id);
    responses.set(id, record);
    while (responses.size > MAX_REMEMBERED_RESPONSES) responses.delete(responses.keys().next().value);
  }

  function retire(record) {
    record.ended = true;
    if (current === record) current = undefined;
  }

  // A request that ends without a finish chunk while another request starts or the session resets: its reply, if
  // it ever comes, must not be kept or mistaken for another's.
  function orphan(record) {
    record.tainted = true;
    retire(record);
    if (!record.finished && !record.id) quarantineUntil = Math.max(quarantineUntil, Date.now() + ORPHAN_QUARANTINE_MS);
  }

  // Something that cannot be attributed happened: whatever waits to be kept is not trusted any more.
  function poison() {
    lease = undefined;
    if (current) current.tainted = true;
  }

  function invalidatePrompt() {
    epoch += 1;
    if (current) {
      carryTaint = true;
      orphan(current);
    }
    lease = undefined;
    pendingPrompt = undefined;
    turn = undefined;
    exchange = undefined;
  }

  function reset() {
    invalidatePrompt();
    sessionId = undefined;
    scope = undefined;
  }

  function currentSessionId(ctx) {
    const id = ctx.sessionManager.getSessionId();
    if (typeof id !== "string" || id.length === 0 || id.length > 256) throw new Error("no session id");
    return id;
  }

  function capturePrompt(event) {
    pendingPrompt = undefined;
    if (!turn || turn.claimed) return;
    // Context captures only message digests for a future header. Rendering
    // controls and session identity are read once, when that header commits.
    const result = promptFingerprint(event && event.messages, "", lease && lease.snapshot);
    if (result) pendingPrompt = { turn, prompt: result.prompt,
      matchedLease: result.extendsPrevious ? lease : undefined };
  }

  function carriesTenvorHeader(headers) {
    const names = [KV_HEADER, SCOPE_HEADER, LEASE_HEADER].map((name) => name.toLowerCase());
    return Object.keys(headers).some((key) => names.includes(key.toLowerCase()));
  }

  // A request that is not ours passes through the hook. Its reply cannot be told from ours by its stream events,
  // so a Tenvor request pending now overlapped it, and one that looks like ours (same names, another address) may
  // still be in flight when the next of ours starts.
  function foreignRequest(model) {
    if (model && typeof model === "object" && model.provider === PROVIDER && model.id === MODEL && model.api === API) {
      quarantineUntil = Math.max(quarantineUntil, Date.now() + ORPHAN_QUARANTINE_MS);
    }
  }

  function addHeaders(event, ctx) {
    const snapshot = pendingPrompt;
    pendingPrompt = undefined;           // one context event may authorize only one header hook
    const ticket = turn;
    const matchesTicket = !!turn && !turn.claimed && snapshot?.turn === turn;
    if (turn) turn.claimed = true;
    const pending = current;
    const record = { epoch, destination: undefined, optedIn: false, sessionId: undefined, scope: undefined,
      controls: undefined, turnSequence: ticket?.sequence, sent: undefined, snapshot: undefined, prompt: undefined,
      payloadSeen: false, id: undefined, tainted: false, terminal: undefined, finished: false, ended: false, usageSeen: false, kept: undefined };
    // Even a failed header hook replaces the anonymous slot before any live
    // accessor can throw; its payload must never land on the previous record.
    exchange = record;
    const model = ctx && ctx.model;
    const destination = record.destination = destinationOf(model);
    const ours = isTenvorModel(destination);
    if (pending) orphan(pending);        // anything passing through here overlaps a request in flight, whatever it is
    if (!ours) { foreignRequest(destination); return; }
    const headers = event && event.headers;
    if (!headers || typeof headers !== "object") { foreignRequest(destination); return; }
    const matchesTurn = matchesTicket && !ctx.isIdle();
    const id = currentSessionId(ctx);
    if (carriesTenvorHeader(headers)) { foreignRequest(destination); return; }

    if (sessionId !== undefined && sessionId !== id) reset();
    if (scope === undefined) scope = randomScope();
    const now = Date.now();
    const overlapped = !!pending || carryTaint;
    const controls = renderingControls(model, ctx.thinkingLevel, ctx.getSystemPrompt(), pi.getActiveTools());
    const prompt = matchesTurn ? snapshot.prompt : undefined;
    const sent = !overlapped && prompt && lease && snapshot.matchedLease === lease &&
      lease.controls === controls &&
      lease.idle > now && lease.absolute > now ? lease : undefined;

    const next = {};
    next[KV_HEADER] = "v1";
    next[SCOPE_HEADER] = scope;
    if (sent) next[LEASE_HEADER] = sent.token;
    const touched = [];
    try {
      for (const name of Object.keys(next)) {
        touched.push(name);
        headers[name] = next[name];
      }
    } catch (error) {
      for (const name of touched) { try { delete headers[name]; } catch (_) { /* best effort */ } }
      throw error;
    }

    // Only now is the request committed to the cache: the lease it carries is spent.
    sessionId = id;
    lease = undefined;
    carryTaint = false;
    Object.assign(record, { epoch, optedIn: true, sessionId: id, scope, controls, sent, snapshot: prompt, tainted: overlapped });
    exchange = current = record;
    log({ event: "request", leaseSent: !!sent, overlapped });
  }

  function observePayload(event) {
    const record = exchange;
    // The selected model may already have changed. Only the header commitment
    // classifies this payload. An overlapping older Tenvor record was orphaned
    // at those headers and cannot be replaced by the foreign observation.
    if (record && !record.optedIn) {
      pendingPrompt = undefined;
      turn = undefined;
      return;
    }
    if (!record || record !== current || record.ended || record.payloadSeen) {
      pendingPrompt = undefined; turn = undefined;
      poison(); return;
    }
    record.payloadSeen = true;
    const result = payloadFingerprint(event && event.payload, record.sent && record.sent.prompt);
    record.prompt = result && result.prompt;
    if (record.sent && !result?.extendsPrevious) {
      // Headers are already in Pi's client. Retire cache authority, not the HTTP
      // exchange: keep its attribution/taint so its reply cannot install a lease.
      epoch += 1;
      record.epoch = epoch;
      record.tainted = true;
      record.prompt = record.snapshot = undefined;
      lease = pendingPrompt = undefined;
      log({ event: "prompt_mismatch", leaseSent: true });
    }
  }

  function finish(record) {
    retire(record);
    const value = record.terminal;
    const now = Date.now();
    const stored = !!value && record.payloadSeen && !!record.prompt && !!record.snapshot && !record.tainted && record.epoch === epoch &&
      value.disposition === "retained" &&
      value.idle_expires_at_unix_ms > now && value.absolute_expires_at_unix_ms > now &&
      // The chain's end is fixed by its first accepted reply: moving it later is not trusted.
      !(value.status === "reused" && (!record.sent || value.absolute_expires_at_unix_ms > record.sent.absolute));
    if (stored) {
      lease = { token: value.lease, idle: value.idle_expires_at_unix_ms, absolute: value.absolute_expires_at_unix_ms,
        prompt: record.prompt, snapshot: record.snapshot, controls: record.controls };
      record.kept = lease;
    }
    log(value ? {
      event: "reply", disposition: value.disposition, status: value.status,
      reusedInputTokens: value.reused_input_tokens, evaluatedInputTokens: value.evaluated_input_tokens,
      leaseSent: !!record.sent, leaseKept: stored,
    } : { event: "reply", disposition: "none", leaseSent: !!record.sent, leaseKept: false });
  }

  function observe(event) {
    if (!event || event.provider !== PROVIDER || event.api !== API || event.model !== MODEL) return;
    const data = event.data;
    const id = data && typeof data === "object" && typeof data.id === "string" && data.id.length > 0 && data.id.length <= MAX_RESPONSE_ID ? data.id : undefined;
    if (id === undefined) { poison(); return; }

    let record = responses.get(id);
    if (record === undefined) {
      // An id never seen is the first chunk of the request in flight, if it has not heard from the node yet.
      if (!current || current.id !== undefined) { poison(); return; }
      record = current;
      if (!matchesModel(record, event.provider, event.model, event.api)) { poison(); return; }
      record.id = id;
      if (Date.now() < quarantineUntil) record.tainted = true;
      remember(id, record);
    }
    if (!matchesModel(record, event.provider, event.model, event.api)) return;
    // A reply of an earlier epoch, or of a request that ended without finishing, is still speaking.
    if (record.epoch !== epoch || (record.ended && !record.finished)) { poison(); return; }

    if (record.finished) {
      // After the finish chunk only the one usage-only chunk is expected (see the order above). Anything else on
      // this reply takes a kept lease back.
      if (!record.usageSeen && isUsageOnlyChunk(data)) { record.usageSeen = true; return; }
      if (record.kept && lease === record.kept) lease = undefined;
      // Already spent into the request in flight: that request rests on a lease the node has now doubted.
      else if (record.kept && current && current.sent === record.kept) current.tainted = true;
      log({ event: "reply", disposition: "withdrawn" });
      return;
    }
    if (current !== record) { poison(); return; }

    if (data.error) { record.tainted = true; retire(record); return; }
    if (hasOwn(data, "tenvor_session_kv")) {
      const parsed = record.terminal === undefined ? parseCacheObject(data.tenvor_session_kv) : undefined;
      if (parsed) record.terminal = parsed;
      else record.tainted = true;
    }
    const choice = Array.isArray(data.choices) ? data.choices[0] : undefined;
    if (choice && choice.finish_reason !== null && choice.finish_reason !== undefined) {
      record.finished = true;
      finish(record);
    }
  }

  // Pi says the assistant message is over, whether it finished, failed or was cancelled. A request that sent no
  // finish chunk is over too, so the next one has the node to itself.
  function matchesModel(record, provider, model, api) {
    const destination = record?.destination;
    return !!destination && provider === destination.provider && model === destination.id &&
      (api === undefined || api === destination.api);
  }

  function messageEnded(event) {
    const message = event && event.message;
    if (message?.role === "assistant") { pendingPrompt = undefined; turn = undefined; }
    if (!message || message.role !== "assistant") return;
    const id = typeof message.responseId === "string" ? message.responseId : undefined;
    // Known response ids select their original records. Unknown or absent ids
    // fall back to current/latest, with provider/model/API and bound-id checks.
    const record = (id && responses.get(id)) || current || exchange;
    if (!record) return;
    if (!matchesModel(record, message.provider, message.model, message.api)) return;
    if (id !== undefined && record.id !== undefined && id !== record.id) return;
    if (record.finished || record.ended) return;
    if (record.optedIn) record.tainted = true;
    retire(record);
  }

  // Every handler is guarded: whatever goes wrong, Pi continues with the request as it is.
  pi.on("context_with_system", (event) => {
    // An unreadable snapshot supplies no authority. A later fresh snapshot can
    // still validate the unspent lease; headers without one spend/drop it cold.
    try { capturePrompt(event); } catch (_) { pendingPrompt = undefined; }
  });
  // Register at factory initialization, never from inside the event being
  // dispatched. Runner ordering is by extension then registration, not priority.
  pi.on("before_provider_request", (event) => {
    try { observePayload(event); } catch (_) {
      try { poison(); if (current) current.prompt = undefined; } catch (__) { /* nothing more to do */ }
    }
  });
  pi.on("before_provider_headers", (event, ctx) => {
    try {
      addHeaders(event, ctx);
    } catch (_) {
      // A failed header with an unknown origin may still answer under our names.
      try {
        quarantineUntil = Math.max(quarantineUntil, Date.now() + ORPHAN_QUARANTINE_MS);
        if (current) orphan(current);
      } catch (__) { /* nothing more to do */ }
    }
  });
  pi.on("provider_stream_event", (event) => {
    try { observe(event); } catch (_) { try { poison(); } catch (__) { /* nothing more to do */ } }
  });
  pi.on("message_end", (event) => {
    try { messageEnded(event); } catch (_) { pendingPrompt = undefined; turn = undefined; }
  });
  pi.on("message_start", (event) => {
    try {
      if (event?.message?.role === "assistant") { pendingPrompt = undefined; turn = undefined; }
    } catch (_) { pendingPrompt = undefined; turn = undefined; }
  });
  pi.on("session_start", () => {
    try { reset(); } catch (_) { /* nothing to undo */ }
  });
  pi.on("session_shutdown", () => {
    try { reset(); } catch (_) { /* nothing to undo */ }
  });
  pi.on("session_compact", () => {
    try { invalidatePrompt(); } catch (_) { /* nothing to undo */ }
  });
  pi.on("session_tree", () => {
    try { invalidatePrompt(); } catch (_) { /* nothing to undo */ }
  });
  for (const name of ["session_before_compact", "session_before_tree", "session_before_fork", "session_before_switch"]) {
    pi.on(name, () => { try { invalidatePrompt(); } catch (_) { /* nothing to undo */ } });
  }
  pi.on("turn_start", () => {
    pendingPrompt = undefined;
    turn = { sequence: ++turnSequence, claimed: false };
  });
  for (const name of ["before_agent_start", "agent_start", "turn_end", "agent_end", "agent_before_settle", "agent_settled"]) {
    pi.on(name, () => { pendingPrompt = undefined; turn = undefined; });
  }
}
"""


if __name__ == "__main__":
    _install_signal_handlers()
    raise SystemExit(main())
