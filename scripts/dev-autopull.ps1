# Sky Roadster - local dev server that follows GitHub automatically (Windows PowerShell 5+).
# Runs `npm run dev`, then checks origin/main every $Interval seconds; on a new commit it
# pulls, reinstalls packages if package.json changed, and Vite reloads the browser.
# Started by SkyRoadster-Dev.bat - you normally don't run this file directly.

param([int]$Interval = 20)

$ErrorActionPreference = 'Continue'
$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo
$Host.UI.RawUI.WindowTitle = 'Sky Roadster - localhost (auto update)'

function Say($msg, $color = 'Gray') {
  Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg) -ForegroundColor $color
}

function PkgHash {
  $h = ''
  foreach ($f in 'package.json', 'package-lock.json') {
    if (Test-Path $f) { $h += (Get-FileHash $f -Algorithm SHA1).Hash }
  }
  return $h
}

function Install-Packages {
  Say 'Installing packages (npm install)...' 'Yellow'
  & npm install --no-fund --no-audit --no-package-lock
  if ($LASTEXITCODE -ne 0) { Say 'npm install failed - see the messages above.' 'Red' }
}

function Start-Dev {
  Say 'Starting game server: http://localhost:5173' 'Green'
  return Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev' -NoNewWindow -PassThru
}

function Stop-Dev($proc) {
  if ($proc -and -not $proc.HasExited) { & taskkill /PID $proc.Id /T /F *> $null }
}

# --- first start --------------------------------------------------------------
Say 'Getting the latest version from GitHub...'
& git pull --ff-only
if (-not (Test-Path 'node_modules')) { Install-Packages }
$pkg = PkgHash
$dev = Start-Dev
Start-Sleep -Seconds 4
Start-Process 'http://localhost:5173'
Say "Watching GitHub every $Interval s. Close this window to stop." 'Cyan'

# --- follow GitHub --------------------------------------------------------------
try {
  while ($true) {
    Start-Sleep -Seconds $Interval

    if ($dev.HasExited) { Say 'Game server stopped - restarting.' 'Yellow'; $dev = Start-Dev }

    & git fetch --quiet origin 2>$null
    if ($LASTEXITCODE -ne 0) { continue }   # offline: try again next round
    $local  = (& git rev-parse HEAD).Trim()
    $remote = (& git rev-parse '@{u}').Trim()
    if ($local -eq $remote) { continue }

    & git pull --ff-only --quiet
    if ($LASTEXITCODE -ne 0) {
      Say 'Could not update: files were changed on this PC. Run "git status" to see them.' 'Red'
      continue
    }
    $msg = (& git log -1 --pretty=format:'%h %s').Trim()
    Say "Updated -> $msg" 'Green'

    $newPkg = PkgHash
    if ($newPkg -ne $pkg) {
      Stop-Dev $dev
      Install-Packages
      $pkg = $newPkg
      $dev = Start-Dev
    }
    # otherwise Vite sees the changed files and reloads the browser by itself
  }
}
finally {
  Stop-Dev $dev
}
