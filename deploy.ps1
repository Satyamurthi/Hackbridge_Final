# HackBridge Deployment Script
# Usage: .\deploy.ps1 -ServerIP "10.10.0.5" -ServerUser "ubuntu"
# Requires: OpenSSH client + VPN connected

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,
    [string]$ServerUser = "ubuntu",
    [switch]$BackendToo
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  HackBridge Deployment Script" -ForegroundColor Magenta  
Write-Host "  Target: $ServerUser@$ServerIP" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Step 1: Build frontend
Write-Host "[1/4] Building React frontend..." -ForegroundColor Cyan
Set-Location "D:\hackbridge-main"
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD FAILED. Fix TypeScript/Vite errors before deploying." -ForegroundColor Red
    exit 1
}

Write-Host "      Frontend built successfully." -ForegroundColor Green

# Step 2: Upload frontend dist
Write-Host "[2/4] Uploading frontend to server..." -ForegroundColor Cyan
scp -r "D:\hackbridge-main\dist\*" "${ServerUser}@${ServerIP}:/tmp/hackbridge-dist/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "SCP upload failed. Check VPN connection and SSH credentials." -ForegroundColor Red
    exit 1
}

Write-Host "      Upload complete." -ForegroundColor Green

# Step 3: Upload backend (optional)
if ($BackendToo) {
    Write-Host "[3/4] Uploading backend source..." -ForegroundColor Cyan
    scp -r "D:\hackbridge-main\backend\*" "${ServerUser}@${ServerIP}:/home/ubuntu/hackbridge-main/backend/"
    Write-Host "      Backend uploaded." -ForegroundColor Green
} else {
    Write-Host "[3/4] Skipping backend upload (use -BackendToo to include)" -ForegroundColor Yellow
}

# Step 4: Deploy on server
Write-Host "[4/4] Deploying on server..." -ForegroundColor Cyan

$remoteCmd = @"
set -e
sudo cp -r /tmp/hackbridge-dist/* /var/www/hackbridge/
sudo chown -R www-data:www-data /var/www/hackbridge
sudo chmod -R 755 /var/www/hackbridge
sudo systemctl reload nginx
echo 'Frontend deployed!'
"@

if ($BackendToo) {
    $remoteCmd = @"
set -e
cd /home/ubuntu/hackbridge-main/backend
npm install --production
npm run build
pm2 restart hackbridge-backend
sudo cp -r /tmp/hackbridge-dist/* /var/www/hackbridge/
sudo chown -R www-data:www-data /var/www/hackbridge
sudo chmod -R 755 /var/www/hackbridge
sudo systemctl reload nginx
pm2 status
echo 'Full deployment complete!'
"@
}

ssh "${ServerUser}@${ServerIP}" $remoteCmd

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "  Visit: http://$ServerIP" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
