#requires -Version 5.1
# Construit l'installateur Windows : electron-builder --dir, métadonnées de l'exécutable (rcedit),
# puis compilation Inno Setup.
# L'installateur final : release\ApexLauncher-Setup-x64.exe
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $Root

$Pkg = Get-Content (Join-Path $Root "package.json") | ConvertFrom-Json
$Version = $Pkg.version
Write-Host "Apex Launcher v$Version — construction de l'installateur" -ForegroundColor Cyan

# 1. Compilation
Write-Host "[1/5] Compilation (renderer + main)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Échec de la compilation." }
node scripts/verify-build.mjs
if ($LASTEXITCODE -ne 0) { throw "Vérification de la compilation échouée." }

# 2. Empaquetage Electron (dossier, sans signature)
# Note : signAndEditExecutable=false dans package.json (winCodeSign exige des privilèges
# de liens symboliques indisponibles sans admin ; l'icône et les métadonnées sont
# appliquées à l'étape suivante avec rcedit).
Write-Host "[2/5] Empaquetage Electron (win-unpacked)..." -ForegroundColor Yellow
npx electron-builder --dir
if ($LASTEXITCODE -ne 0) { throw "Échec d'electron-builder." }
$Exe = Join-Path $Root "release\win-unpacked\Apex Launcher.exe"
if (-not (Test-Path $Exe)) { throw "Fichier introuvable : $Exe" }
Write-Host "Application empaquetée : $Exe" -ForegroundColor Green

# 3. Icône + métadonnées de version de l'exécutable (rcedit officiel Electron)
Write-Host "[3/5] Icône et métadonnées de l'exécutable..." -ForegroundColor Yellow
$ToolsDir = Join-Path $Root "tools"
New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
$Rcedit = Join-Path $ToolsDir "rcedit-x64.exe"
if (-not (Test-Path $Rcedit)) {
  Write-Host "Téléchargement de rcedit (outil officiel Electron)..." -ForegroundColor Yellow
  Invoke-WebRequest -Uri "https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe" -OutFile $Rcedit -UseBasicParsing
}
$Icon = Join-Path $Root "assets\icon.ico"
& $Rcedit "$Exe" --set-icon "$Icon" --set-file-version "$Version" --set-product-version "$Version" `
  --set-version-string "CompanyName" "ApexDevlabs" `
  --set-version-string "FileDescription" "Apex Launcher" `
  --set-version-string "ProductName" "Apex Launcher" `
  --set-version-string "OriginalFilename" "Apex Launcher.exe"
if ($LASTEXITCODE -ne 0) { throw "Échec de rcedit." }
Write-Host "Exécutable signé visuellement : icône + ApexDevlabs + v$Version" -ForegroundColor Green

# 4. Recherche d'Inno Setup
Write-Host "[4/5] Recherche d'Inno Setup..." -ForegroundColor Yellow
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
  Write-Host "Inno Setup 6 n'est pas installé." -ForegroundColor Red
  Write-Host "Installez-le puis relancez ce script (droits admin non requis pour une installation par utilisateur)." -ForegroundColor Yellow
  Write-Host "L'application compilée reste disponible dans : release\win-unpacked\" -ForegroundColor Yellow
  exit 2
}
Write-Host "Inno Setup trouvé : $ISCC" -ForegroundColor Green

# 5. Compilation du setup
Write-Host "[5/5] Compilation de l'installateur..." -ForegroundColor Yellow
& $ISCC "/DAppVersion=$Version" (Join-Path $Root "installer\apex-launcher.iss")
if ($LASTEXITCODE -ne 0) { throw "Échec de la compilation Inno Setup." }

$Setup = Join-Path $Root "release\ApexLauncher-Setup-x64.exe"
if (-not (Test-Path $Setup)) { throw "Installateur introuvable après compilation." }
$Size = [math]::Round((Get-Item $Setup).Length / 1MB, 1)
Write-Host ""
Write-Host "SUCCÈS : $Setup ($Size Mo)" -ForegroundColor Green
Write-Host "Installateur non signé (signature Authenticode optionnelle, voir README)." -ForegroundColor Yellow
Get-FileHash $Setup -Algorithm SHA256 | Format-List
