# Send an over-the-air update to every installed copy of Daftar (Android).
# Use for changes to screens, text and logic. Changes to native parts (new permissions, widgets,
# packages with Android code) or the app version need a new APK instead: .\scripts\build-apk.ps1 -Clean -Install
# Usage: .\scripts\publish-update.ps1 "What changed"
param([Parameter(Mandatory = $true)][string]$Message)
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    npx eas-cli@latest update --channel production --platform android --message $Message --non-interactive
    if ($LASTEXITCODE -ne 0) { throw 'Publishing the update failed' }
    Write-Host 'Update published. Phones pick it up the next time Daftar opens, and use it from the launch after that.'
} finally { Pop-Location }
