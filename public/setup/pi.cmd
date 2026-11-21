@echo off
rem Configure the current user's Pi on Windows for Tenvor, from Command Prompt:
rem   curl -fsSL https://tenvor.io/setup/pi.cmd -o tenvor-pi.cmd && tenvor-pi.cmd
rem Options, such as --remove, go after the file name: tenvor-pi.cmd --remove
rem
rem It downloads Tenvor's current PowerShell launcher (https://tenvor.io/setup/pi.ps1) and runs it with this window's
rem Windows PowerShell, which then checks the setup helper against its pinned SHA-256 before it runs it. Execution
rem policy is set aside for that one run only. No administrator rights are needed.
setlocal EnableExtensions DisableDelayedExpansion
set "TENVOR_LAUNCHER=%TEMP%\tenvor-pi-%RANDOM%%RANDOM%.ps1"
"%SystemRoot%\System32\curl.exe" -q --proto "=https" --tlsv1.2 --fail --silent --show-error --max-time 30 --max-filesize 1048576 "https://tenvor.io/setup/pi.ps1" --output "%TENVOR_LAUNCHER%"
if errorlevel 1 (
  echo Tenvor setup: could not download https://tenvor.io/setup/pi.ps1, so nothing was configured. 1>&2
  del "%TENVOR_LAUNCHER%" 2>nul
  exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%TENVOR_LAUNCHER%" %*
set "TENVOR_EXIT=%ERRORLEVEL%"
del "%TENVOR_LAUNCHER%" 2>nul
exit /b %TENVOR_EXIT%
