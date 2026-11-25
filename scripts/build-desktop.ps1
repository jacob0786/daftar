# Build Daftar for desktop (Windows installer).
# 1. Export the app's web build  2. Copy it into the Electron wrapper  3. Package an installer.
# Usage: .\scripts\build-desktop.ps1        Output: desktop\release\Daftar Setup <version>.exe
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    $env:CI = '1'
    npx expo export --platform web --output-dir dist-web
    if ($LASTEXITCODE -ne 0) { throw 'Web export failed' }

    $app = Join-Path $root 'desktop\app'
    if (Test-Path $app) { Remove-Item $app -Recurse -Force }
    Copy-Item dist-web $app -Recurse
    Copy-Item assets\images\icon.png desktop\icon.png -Force

    Push-Location desktop
    if (-not (Test-Path node_modules)) { npm install }
    npx electron-builder --win nsis
    if ($LASTEXITCODE -ne 0) { throw 'Packaging failed' }
    Pop-Location
    Write-Host "Installer ready in $(Join-Path $root 'desktop\release')"
} finally { Pop-Location }
