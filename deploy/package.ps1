####################################################################
# Solid Pod App -- Package for PrivateDataPod.com Upload
#
# Usage:
#   .\deploy\package.ps1
#   .\deploy\package.ps1 -OutputDir "C:\Releases"
#
# What it does:
#   1. Verifies Node.js is available
#   2. Installs npm dependencies (if node_modules is missing)
#   3. Runs 'npm run build' to produce the dist/ folder
#   4. Zips the dist/ contents into a deployable package
#
# Upload the resulting .zip to PrivateDataPod.com to deploy.
# AWS S3 + CloudFront provisioning is handled by PrivateDataPod.com.
####################################################################

param(
    [string]$OutputDir = "."   # Directory where the zip file is saved
)

$ErrorActionPreference = "Stop"
$DIST_DIR = "dist"

Write-Host ""
Write-Host "Solid Pod App -- Package Builder" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# ---- 1. Check prerequisites ----
Write-Host ""
Write-Host "[1/3] Checking prerequisites..." -ForegroundColor Cyan

# Help find Node on common Windows install path
$nodePath = "C:\Program Files\nodejs"
if (Test-Path "$nodePath\node.exe") { $env:PATH = "$nodePath;" + $env:PATH }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not found. Install it from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "  Node $(node --version) OK" -ForegroundColor Green

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: npm not found." -ForegroundColor Red
    exit 1
}
Write-Host "  npm $(npm --version) OK" -ForegroundColor Green

# Warn if .env is missing (build will use Vite defaults)
if (-not (Test-Path ".env")) {
    Write-Host ""
    Write-Host "WARNING: .env file not found." -ForegroundColor Yellow
    Write-Host "  The build will use default placeholder values." -ForegroundColor Yellow
    Write-Host "  Copy .env.example to .env and fill in your app details before packaging." -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        Write-Host "Aborted." -ForegroundColor Red
        exit 1
    }
}

# ---- 2. Install dependencies if needed ----
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "  node_modules not found -- running npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm install failed." -ForegroundColor Red
        exit 1
    }
}

# ---- 3. Build ----
Write-Host ""
Write-Host "[2/3] Building application..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Build failed. Fix the errors above and try again." -ForegroundColor Red
    exit 1
}
Write-Host "  Build complete." -ForegroundColor Green

# ---- 4. Create zip ----
Write-Host ""
Write-Host "[3/3] Creating deployment package..." -ForegroundColor Cyan

if (-not (Test-Path $DIST_DIR)) {
    Write-Host "ERROR: dist/ folder not found after build." -ForegroundColor Red
    exit 1
}

# Derive zip name from package.json name + version + timestamp
$pkg       = Get-Content "package.json" -Raw | ConvertFrom-Json
$appName   = ($pkg.name -replace '[^a-zA-Z0-9\-]', '-').ToLower()
$version   = $pkg.version
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName   = "$appName-$version-$timestamp.zip"
$zipPath   = Join-Path (Resolve-Path $OutputDir) $zipName

# Remove any existing file with the same name
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Zip the contents of dist/ (not the dist/ folder itself)
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    (Resolve-Path $DIST_DIR).Path,
    $zipPath
)

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

Write-Host ""
Write-Host "  Package ready : $zipName ($sizeMB MB)" -ForegroundColor Green
Write-Host "  Location      : $zipPath" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Upload $zipName to PrivateDataPod.com to deploy." -ForegroundColor Cyan
Write-Host ""
