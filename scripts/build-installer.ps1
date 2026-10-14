#requires -Version 5.1
# Builds the Windows installer: electron-builder --dir, exe metadata (rcedit),
# then Inno Setup compile.
# Final installer: release\ApexLauncher-Setup-x64.exe
# NOTE: this file must stay pure ASCII (no accents) so it parses identically
# on every PowerShell version and locale.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $Root

$Pkg = Get-Content (Join-Path $Root "package.json") | ConvertFrom-Json
$Version = $Pkg.version
Write-Host "Apex Launcher v$Version - building installer"

# 1. Compile
Write-Host "[1/5] Compiling (renderer + main)..."
& npm run build
Write-Host "npm run build exit=$LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { throw "Build failed." }
& node scripts/verify-build.mjs
Write-Host "verify-build exit=$LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { throw "Build verification failed." }

# 2. Electron packaging (folder, unsigned)
# Note: signAndEditExecutable=false in package.json (winCodeSign needs symlink
# privileges unavailable without admin; icon and metadata are applied next
# with rcedit).
Write-Host "[2/5] Electron packaging (win-unpacked)..."
& npx electron-builder --dir
Write-Host "electron-builder exit=$LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { throw "electron-builder failed." }
$Exe = Join-Path $Root "release\win-unpacked\Apex Launcher.exe"
if (-not (Test-Path $Exe)) { throw "File not found: $Exe" }
Write-Host "Packaged app: $Exe"

# 3. Exe icon + version metadata (official Electron rcedit)
Write-Host "[3/5] Exe icon and metadata..."
$ToolsDir = Join-Path $Root "tools"
New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
$Rcedit = Join-Path $ToolsDir "rcedit-x64.exe"
if (-not (Test-Path $Rcedit)) {
  Write-Host "Downloading rcedit (official Electron tool)..."
  Invoke-WebRequest -Uri "https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe" -OutFile $Rcedit -UseBasicParsing
}
$Icon = Join-Path $Root "assets\icon.ico"
& $Rcedit "$Exe" --set-icon "$Icon" --set-file-version "$Version" --set-product-version "$Version" `
  --set-version-string "CompanyName" "ApexDevlabs" `
  --set-version-string "FileDescription" "Apex Launcher" `
  --set-version-string "ProductName" "Apex Launcher" `
  --set-version-string "OriginalFilename" "Apex Launcher.exe"
Write-Host "rcedit exit=$LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { throw "rcedit failed." }
Write-Host "Exe branded: icon + ApexDevlabs + v$Version"

# 4. Locate Inno Setup
Write-Host "[4/5] Locating Inno Setup..."
$ISCC = $null
foreach ($Candidate in @(
  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
  "C:\Program Files\Inno Setup 6\ISCC.exe",
  (Join-Path $env:LOCALAPPDATA "Programs\InnoSetup6\ISCC.exe")
)) {
  if ($Candidate -and (Test-Path $Candidate)) { $ISCC = $Candidate; break }
}
if (-not $ISCC) {
  $Cmd = Get-Command iscc -ErrorAction SilentlyContinue
  if ($Cmd) { $ISCC = $Cmd.Source }
}
if (-not $ISCC) {
  Write-Host ""
  Write-Host "Inno Setup 6 is not installed."
  Write-Host "Install it, then re-run this script (no admin rights needed for a per-user install)."
  Write-Host "The compiled app remains available in: release\win-unpacked\"
  exit 2
}
Write-Host "Inno Setup found: $ISCC"

# 5. Compile the setup
Write-Host "[5/5] Compiling installer..."
& $ISCC "/DAppVersion=$Version" (Join-Path $Root "installer\apex-launcher.iss")
Write-Host "ISCC exit=$LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compile failed." }

$Setup = Join-Path $Root "release\ApexLauncher-Setup-x64.exe"
if (-not (Test-Path $Setup)) { throw "Installer not found after compile." }
$Size = [math]::Round((Get-Item $Setup).Length / 1MB, 1)
Write-Host ""
Write-Host "SUCCESS: $Setup ($Size MB)"
Write-Host "Unsigned installer (optional Authenticode signing, see README)."
# SHA-256 via .NET directly (no dependency on optional cmdlet modules).
$sha = [System.Security.Cryptography.SHA256]::Create()
$stream = [System.IO.File]::OpenRead($Setup)
try {
  $hash = (($sha.ComputeHash($stream)) | ForEach-Object { $_.ToString("x2") }) -join ""
} finally {
  $stream.Close()
  $sha.Dispose()
}
Write-Host "SHA256: $hash"
