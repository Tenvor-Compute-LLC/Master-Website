# Configure the current user's OpenCode on Windows for Tenvor; no administrator rights and no global package installation.
# It installs nothing: if OpenCode is missing, it says how to install the tested release, and stops.
#
# In PowerShell or Windows Terminal (it asks for your key at a hidden prompt):
#   irm https://tenvor.io/setup/opencode.ps1 | iex
# With an option, such as --remove or --rotate-key:
#   & ([scriptblock]::Create((irm https://tenvor.io/setup/opencode.ps1))) --remove
# Saved as a file, it runs the same way:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\tenvor-opencode.ps1 --remove
#
# Everything runs inside the script block below, so its settings stay out of your PowerShell session, and it never
# closes your window: it leaves its exit code in $LASTEXITCODE, and only a run as a file ends with exit.

& {
  Set-StrictMode -Version 2
  $ErrorActionPreference = 'Stop'

  $TenvorHelperUrl = 'https://tenvor.io/setup/opencode.py'
  $TenvorHelperSha256 = 'ae2d4f74bc90b3b7a5e4abfc715e3f341181d44b7213d97a801f1e1b7ad0f02d'
  $MinimumPython = '3.10'

  # A stop with a message for you. It is thrown, so it ends this script block and not your PowerShell session.
  function Stop-Setup([string] $Message) {
    throw (New-Object System.OperationCanceledException $Message)
  }

  $global:LASTEXITCODE = 1
  $setupDirectory = $null
  try {
    if ($PSVersionTable.PSVersion.Major -lt 5) {
      Stop-Setup 'Tenvor setup needs Windows PowerShell 5.1 or PowerShell 7. Update PowerShell, then run this command again.'
    }
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
      Stop-Setup 'This launcher is for Windows. On Linux and macOS, use https://tenvor.io/setup/opencode.sh instead.'
    }

    # curl.exe from the Windows folder, never one found in the current folder.
    $curl = Join-Path $env:SystemRoot 'System32\curl.exe'
    if (-not (Test-Path -LiteralPath $curl -PathType Leaf)) {
      $found = Get-Command -Name 'curl.exe' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($null -eq $found) {
        Stop-Setup 'Tenvor setup requires curl.exe, which Windows 10 and 11 include. Install it, then run this command again.'
      }
      $curl = $found.Path
    }

    # Python 3.10 or newer: the Python launcher (py -3) first, then python.exe. Each is asked for its version, which
    # also skips the Microsoft Store placeholder that only opens the Store.
    $python = $null
    $candidates = @()
    $launcher = Get-Command -Name 'py.exe' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $launcher) { $candidates += , @($launcher.Path, '-3') }
    foreach ($name in @('python.exe', 'python3.exe')) {
      foreach ($command in @(Get-Command -Name $name -CommandType Application -All -ErrorAction SilentlyContinue)) {
        $candidates += , @($command.Path)
      }
    }
    $probe = 'import sys; sys.exit(0 if sys.version_info >= (' + $MinimumPython.Replace('.', ', ') + ') else 1)'
    foreach ($candidate in $candidates) {
      $program = $candidate[0]
      $prefix = @($candidate | Select-Object -Skip 1)
      # Windows PowerShell 5.1 turns anything a program writes to stderr into an error, which 'Stop' makes fatal, so a
      # Python that prints a warning would be passed over. Only the exit code counts here.
      $ErrorActionPreference = 'Continue'
      try {
        & $program @prefix -I -c $probe 2>$null | Out-Null
        $works = ($LASTEXITCODE -eq 0)
      } catch {
        $works = $false
      } finally {
        $ErrorActionPreference = 'Stop'
      }
      if ($works) {
        $python = $candidate
        break
      }
    }
    if ($null -eq $python) {
      Stop-Setup ("Tenvor setup requires Python $MinimumPython or newer. Install it from https://www.python.org/downloads/windows/ " +
        "(or run: winget install --id Python.Python.3.13 --exact), then open a new PowerShell window and run this command again.")
    }

    $setupDirectory = Join-Path ([IO.Path]::GetTempPath()) ('tenvor-opencode.' + [IO.Path]::GetRandomFileName())
    $helper = Join-Path $setupDirectory 'opencode.py'
    New-Item -ItemType Directory -Path $setupDirectory | Out-Null

    # Never execute a redirect, error page, truncated helper, or unpinned update.
    & $curl -q --proto '=https' --tlsv1.2 --fail --silent --show-error --max-time 30 --max-filesize 1048576 `
      $TenvorHelperUrl --output $helper
    if ($LASTEXITCODE -ne 0) {
      Stop-Setup "Tenvor setup: curl.exe could not download the helper (exit $LASTEXITCODE); nothing was configured."
    }
    $bytes = [IO.File]::ReadAllBytes($helper)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
      $actual = -join ($sha256.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
    } finally {
      $sha256.Dispose()
    }
    if ($bytes.Length -gt 1048576 -or $actual -ne $TenvorHelperSha256) {
      Stop-Setup ("Tenvor setup: downloaded helper failed SHA-256 verification; nothing was configured. " +
        "If you saved this launcher a while ago it may be out of date, because the helper it checks for " +
        "has been replaced. Run the setup command again instead: irm https://tenvor.io/setup/opencode.ps1 | iex")
    }

    # Credentials are prompted for by Python with echo disabled, never passed as arguments. -I keeps PYTHONPATH,
    # PYTHONSTARTUP and your own site-packages out of the run. Python's exit code is left in $LASTEXITCODE.
    $program = $python[0]
    $prefix = @($python | Select-Object -Skip 1)
    & $program @prefix -I $helper @args
  } catch [System.OperationCanceledException] {
    [Console]::Error.WriteLine($_.Exception.Message)
    $global:LASTEXITCODE = 1
  } catch [System.Management.Automation.PipelineStoppedException] {
    throw  # Ctrl+C: let it stop as it always does
  } catch {
    # Anything else (a temporary folder that cannot be made, a download that cannot be read) ends the run as a failure,
    # never as the success a Python check before it left in $LASTEXITCODE.
    [Console]::Error.WriteLine("Tenvor setup stopped: $($_.Exception.Message) Nothing was configured.")
    $global:LASTEXITCODE = 1
  } finally {
    if ($null -ne $setupDirectory -and (Test-Path -LiteralPath $setupDirectory)) {
      Remove-Item -LiteralPath $setupDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
} @args

# Run as a file (-File), hand the exit code to whoever started it. Typed or piped into a session, end quietly instead.
if ($PSCommandPath -and (Select-String -LiteralPath $PSCommandPath -SimpleMatch -Quiet -Pattern '$TenvorHelperSha256 = ')) {
  exit $LASTEXITCODE
}
