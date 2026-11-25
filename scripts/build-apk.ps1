# Build Daftar's release APK from a short path.
# Windows' 260-character path limit breaks the native (C++) build under the long project path,
# so this mirrors the project to C:\dt and builds there. Usage: .\scripts\build-apk.ps1 [-Install]
param([switch]$Install, [switch]$Clean)
$ErrorActionPreference = 'Stop'
$src = Split-Path $PSScriptRoot -Parent
$dst = 'C:\dt'

# 1. Mirror the project (skip generated folders; node_modules copies once, then only changes)
$skip = 'android', '.expo', '.impeccable', '.git', 'desktop', 'dist-web' | ForEach-Object { Join-Path $src $_ }
robocopy $src $dst /MIR /XD @skip (Join-Path $dst 'android') /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copy to $dst failed ($LASTEXITCODE)" }

# 2. Generate the Android project and build for 64-bit ARM phones only
Push-Location $dst
try {
    $env:CI = '1'
    # -Clean regenerates the Android project (needed after adding native packages or changing app.json)
    if ($Clean -and (Test-Path android)) { Remove-Item android -Recurse -Force }
    if (-not (Test-Path android)) { npx expo prebuild --platform android --clean }

    # Use CMake 3.31 (Ninja 1.12 handles long paths; the default 3.22 does not)
    $cmake = (Join-Path $env:LOCALAPPDATA 'Android\Sdk\cmake\3.31.6') -replace '\\', '/'
    $props = 'android\local.properties'
    $lines = @(if (Test-Path $props) { Get-Content $props | Where-Object { $_ -notmatch '^cmake\.dir=' } })
    Set-Content $props ($lines + "cmake.dir=$cmake") -Encoding ascii

    Push-Location android
    .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }
    Pop-Location
} finally { Pop-Location }

$apk = Join-Path $dst 'android\app\build\outputs\apk\release\app-release.apk'
Copy-Item $apk (Join-Path $src 'daftar.apk') -Force
Write-Host "APK ready: $(Join-Path $src 'daftar.apk')"

# 3. Optionally install on the connected phone (keeps existing app data)
if ($Install) { adb install -r (Join-Path $src 'daftar.apk') }
