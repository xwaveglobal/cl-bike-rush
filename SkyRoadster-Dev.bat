@echo off
setlocal
title Sky Roadster - localhost
rem Double-click to run Sky Roadster on http://localhost:5173 and keep it in sync with GitHub.
rem Works from inside the repo folder, or standalone (it clones to Documents\sky-roadster).

where git >nul 2>nul || (echo Git is not installed. Get it from https://git-scm.com & pause & exit /b 1)
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org & pause & exit /b 1)

if exist "%~dp0scripts\dev-autopull.ps1" (
  set "REPO=%~dp0"
) else (
  set "REPO=%USERPROFILE%\Documents\g-bike-rush"
)

if not exist "%REPO%\.git" (
  echo Downloading the game from GitHub into %REPO% ...
  git clone https://github.com/xwaveglobal/g-bike-rush.git "%REPO%" || (echo Clone failed. & pause & exit /b 1)
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO%\scripts\dev-autopull.ps1"
pause
