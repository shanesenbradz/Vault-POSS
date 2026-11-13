@echo off
title VaultPOS
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node.js 22.13 or newer from https://nodejs.org ^(choose the LTS installer^), then run this again.
  echo.
  pause
  exit /b 1
)
echo Starting VaultPOS...
echo.
node --disable-warning=ExperimentalWarning server.js
echo.
echo VaultPOS has stopped.
pause
