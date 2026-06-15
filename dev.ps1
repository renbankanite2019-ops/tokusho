# Tokusho Dev Startup Script
# Usage: .\dev.ps1
# Starts cloudflared, updates URLs, then starts Vite + Shopify CLI

$ErrorActionPreference = "Stop"
$AppDir = $PSScriptRoot

Write-Host "=== Tokusho Dev ===" -ForegroundColor Cyan

# Step 1: Start cloudflared and capture URL
Write-Host "[1/3] Starting cloudflared tunnel -> localhost:3000..." -ForegroundColor Yellow
$cfJob = Start-Job -ScriptBlock {
    & cloudflared tunnel --url http://localhost:3000 2>&1
}

# Wait for tunnel URL to appear
$tunnelUrl = $null
$timeout = 30
$elapsed = 0
Write-Host "    Waiting for tunnel URL..." -NoNewline
while (-not $tunnelUrl -and $elapsed -lt $timeout) {
    Start-Sleep -Seconds 1
    $elapsed++
    Write-Host "." -NoNewline
    $output = Receive-Job $cfJob
    foreach ($line in $output) {
        if ($line -match "https://[a-z0-9\-]+\.trycloudflare\.com") {
            $tunnelUrl = $Matches[0]
            break
        }
    }
}
Write-Host ""

if (-not $tunnelUrl) {
    Write-Host "ERROR: Could not get tunnel URL. Is cloudflared installed?" -ForegroundColor Red
    Remove-Job $cfJob -Force
    exit 1
}

Write-Host "    Tunnel URL: $tunnelUrl" -ForegroundColor Green

# Step 2: Update .env and toml
Write-Host "[2/3] Updating config files..." -ForegroundColor Yellow

$envPath = Join-Path $AppDir ".env"
$envContent = Get-Content $envPath -Raw
$envContent = $envContent -replace "SHOPIFY_APP_URL=https://[^\r\n]+", "SHOPIFY_APP_URL=$tunnelUrl"
Set-Content $envPath $envContent -NoNewline
Write-Host "    Updated .env" -ForegroundColor Green

$tomlPath = Join-Path $AppDir "shopify.app.tokusho.toml"
$tomlContent = Get-Content $tomlPath -Raw
$tomlContent = $tomlContent -replace 'application_url = "https://[^"]*"', "application_url = `"$tunnelUrl`""
$tomlContent = $tomlContent -replace 'https://[^/"]*/auth/', "$tunnelUrl/auth/"
Set-Content $tomlPath $tomlContent -NoNewline
Write-Host "    Updated shopify.app.tokusho.toml" -ForegroundColor Green

# Step 3: Start Vite + CLI in new windows
Write-Host "[3/3] Starting Vite and Shopify CLI..." -ForegroundColor Yellow

# Start Vite in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$AppDir'; Write-Host 'VITE SERVER' -ForegroundColor Cyan; npx vite --port 3000"

# Wait a moment for Vite to start
Start-Sleep -Seconds 3

# Start Shopify CLI in new window
$cliCmd = "cd '$AppDir'; Write-Host 'SHOPIFY CLI' -ForegroundColor Cyan; npm run dev -- --tunnel-url ${tunnelUrl}:54000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $cliCmd

Write-Host ""
Write-Host "=== All services started! ===" -ForegroundColor Green
Write-Host "Tunnel URL: $tunnelUrl" -ForegroundColor Cyan
Write-Host "Vite:       http://localhost:3000" -ForegroundColor Cyan
Write-Host "GraphiQL:   http://localhost:3457" -ForegroundColor Cyan
Write-Host ""
Write-Host "This window keeps cloudflared running. Close to stop tunnel." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop all." -ForegroundColor Yellow

# Keep cloudflared running in foreground
try {
    while ($true) {
        $output = Receive-Job $cfJob
        if ($output) { $output | Write-Host -ForegroundColor DarkGray }
        Start-Sleep -Seconds 2
    }
} finally {
    Remove-Job $cfJob -Force
    Write-Host "Tunnel stopped." -ForegroundColor Red
}
