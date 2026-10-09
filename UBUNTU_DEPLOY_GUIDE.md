# 🚀 HackBridge — Complete Ubuntu Server Deployment Guide

> **Platform:** React 18 + Vite Frontend · Express.js Backend · PostgreSQL 15  
> **Target OS:** Ubuntu Server 20.04 / 22.04 / 24.04 LTS  
> **Access Method:** VPN-provided IP Address  
> **Last Updated:** October 2026

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1 — Connect via VPN](#phase-1--connect-via-vpn)
4. [Phase 2 — Update Server and Install Core Tools](#phase-2--update-server)
5. [Phase 3 — Install PostgreSQL 15](#phase-3--install-postgresql-15)
6. [Phase 4 — Create HackBridge Database](#phase-4--create-database)
7. [Phase 5 — Install Node.js 20 LTS](#phase-5--install-nodejs-20)
8. [Phase 6 — Transfer Project to Server](#phase-6--transfer-project)
9. [Phase 7 — Configure Environment Variables](#phase-7--environment-variables)
10. [Phase 8 — Build the Frontend](#phase-8--build-frontend)
11. [Phase 9 — Install and Configure Nginx](#phase-9--nginx)
12. [Phase 10 — Deploy Backend with PM2](#phase-10--backend-pm2)
13. [Phase 11 — Run SQL Migrations](#phase-11--sql-migrations)
14. [Phase 12 — Configure Firewall](#phase-12--firewall)
15. [Phase 13 — VPN Daily Push/Pull Workflow](#phase-13--vpn-workflow)
16. [Phase 14 — Verify Everything Works](#phase-14--verify)
17. [Troubleshooting Reference](#troubleshooting)
18. [Configuration Cheatsheet](#cheatsheet)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│               UBUNTU SERVER (VPN IP)                     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │         NGINX (Port 80) — Reverse Proxy            │  │
│  │  Serves React SPA /var/www/hackbridge/             │  │
│  │  Proxies /api/* to Backend Port 4000               │  │
│  │  SPA fallback: all routes to index.html            │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────▼─────────────────────────────┐  │
│  │     PM2 → Backend API (Port 4000)                  │  │
│  │     Express.js + TypeScript + pg driver            │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────▼─────────────────────────────┐  │
│  │     PostgreSQL 15 (Port 5432 — internal only)      │  │
│  │     Database: hackbridge                           │  │
│  │     User: hackbridge_user                         │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         ▲  VPN Connection
┌────────┴────────┐
│  Your Windows PC │
│  (Development)   │
└──────────────────┘
```

---

## Prerequisites

Collect from your server provider before starting:

| Item | Example |
|------|---------|
| VPN IP Address | `10.10.0.5` |
| SSH Username | `ubuntu` |
| SSH Password | `yourpassword` |
| VPN Config File | `hackbridge.ovpn` |

**Tools to install on your Windows PC:**
- **OpenVPN** — https://openvpn.net/community-downloads/
- **MobaXterm** — https://mobaxterm.mobatek.net/download.html
- **WinSCP** — https://winscp.net/eng/download.php

> Replace `YOUR_SERVER_IP` everywhere in this guide with the actual IP given by the server team.

---

## Phase 1 — Connect via VPN

### Step 1.1 — Connect OpenVPN

```
1. Install OpenVPN on Windows
2. Copy your .ovpn file to: C:\Program Files\OpenVPN\config\
3. Right-click OpenVPN icon in system tray → Connect
4. Wait for "Connected" status
```

### Step 1.2 — SSH into the server

**MobaXterm:**
```
Session → SSH
Remote host: YOUR_SERVER_IP
Username: ubuntu
Password: (from server team)
Click OK
```

**PowerShell:**
```powershell
ssh ubuntu@YOUR_SERVER_IP
```

---

## Phase 2 — Update Server

> All commands run in your SSH terminal on the Ubuntu server.

### Step 2.1 — Update and upgrade
```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2.2 — Install essential tools
```bash
sudo apt install -y \
  curl wget git unzip build-essential \
  software-properties-common apt-transport-https \
  ca-certificates gnupg lsb-release
```

### Step 2.3 — Verify
```bash
git --version && curl --version
```

---

## Phase 3 — Install PostgreSQL 15

### Step 3.1 — Add PostgreSQL official repository
```bash
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] \
  https://apt.postgresql.org/pub/repos/apt \
  $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update
```

### Step 3.2 — Install PostgreSQL 15
```bash
sudo apt install -y postgresql-15 postgresql-client-15
```

### Step 3.3 — Start and enable the service
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl status postgresql
```

You should see `Active: active (running)` in green.

### Step 3.4 — Verify
```bash
sudo -u postgres psql -c "SELECT version();"
```

Expected: `PostgreSQL 15.x on x86_64-pc-linux-gnu ...`

---

## Phase 4 — Create Database

### Step 4.1 — Enter PostgreSQL as superuser
```bash
sudo -i -u postgres
psql
```

### Step 4.2 — Create user and database

> Replace `CHOOSE_A_STRONG_PASSWORD` with a real password like `H@ckBr1dge2026!`.  
> Write it down — you will use it in the `.env` file later.

```sql
CREATE USER hackbridge_user WITH PASSWORD 'CHOOSE_A_STRONG_PASSWORD';

CREATE DATABASE hackbridge OWNER hackbridge_user;

GRANT ALL PRIVILEGES ON DATABASE hackbridge TO hackbridge_user;

\c hackbridge

GRANT ALL ON SCHEMA public TO hackbridge_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO hackbridge_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO hackbridge_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hackbridge_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hackbridge_user;

\q
```

### Step 4.3 — Exit postgres shell
```bash
exit
```

### Step 4.4 — Test connection
```bash
psql -U hackbridge_user -d hackbridge -h localhost \
  -c "SELECT current_user, current_database();"
```

Enter your password when prompted. Expected output:
```
   current_user   | current_database
-----------------+-----------------
 hackbridge_user  | hackbridge
```

---

## Phase 5 — Install Node.js 20

### Step 5.1 — Install via NodeSource
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node --version   # v20.x.x
npm --version    # 10.x.x
```

### Step 5.2 — Install PM2 globally
```bash
sudo npm install -g pm2
pm2 --version
```

### Step 5.3 — Install TypeScript globally
```bash
sudo npm install -g typescript tsx
tsc --version
```

---

## Phase 6 — Transfer Project to Server

### Option A — WinSCP (Recommended for beginners)

```
1. Open WinSCP on Windows
2. File Protocol: SCP
3. Host name: YOUR_SERVER_IP
4. Username: ubuntu
5. Password: your SSH password
6. Left panel: D:\hackbridge-main\
7. Right panel: /home/ubuntu/
8. Drag "hackbridge-main" to right panel
9. Wait for transfer to finish (2-5 minutes)
```

### Option B — SCP via PowerShell

```powershell
scp -r "D:\hackbridge-main" ubuntu@YOUR_SERVER_IP:/home/ubuntu/hackbridge-main
```

### Step 6.1 — Verify on server
```bash
ls -la /home/ubuntu/hackbridge-main/
```

You should see: `Dockerfile`, `package.json`, `src/`, `backend/`, `supabase/`, etc.

---

## Phase 7 — Environment Variables

### Step 7.1 — Frontend `.env`
```bash
cd /home/ubuntu/hackbridge-main
cp .env.example .env
nano .env
```

Set these values (Ctrl+X → Y → Enter to save):

```bash
# If using Supabase Cloud for auth:
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Your server VPN IP
VITE_API_BASE_URL=http://YOUR_SERVER_IP/api

VITE_DEFAULT_TENANT_SLUG=mitt
```

### Step 7.2 — Generate a JWT Secret
```bash
openssl rand -base64 32
```

Copy the output — use it below.

### Step 7.3 — Backend `.env`
```bash
cd /home/ubuntu/hackbridge-main/backend
cp .env.example .env
nano .env
```

```bash
PORT=4000
NODE_ENV=production
DATABASE_URL=postgresql://hackbridge_user:CHOOSE_A_STRONG_PASSWORD@localhost:5432/hackbridge
JWT_SECRET=PASTE_RANDOM_SECRET_FROM_ABOVE
CORS_ORIGIN=http://YOUR_SERVER_IP
DEFAULT_TENANT_SLUG=mitt
UPLOAD_DIR=./uploads
```

---

## Phase 8 — Build Frontend

### Step 8.1 — Install dependencies
```bash
cd /home/ubuntu/hackbridge-main
npm install
```

### Step 8.2 — Build production bundle
```bash
npm run build
```

### Step 8.3 — Verify build output
```bash
ls -la dist/
```

Expected: `index.html` and `assets/` folder.

---

## Phase 9 — Nginx

### Step 9.1 — Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl status nginx
```

### Step 9.2 — Deploy frontend files
```bash
sudo mkdir -p /var/www/hackbridge
sudo cp -r /home/ubuntu/hackbridge-main/dist/* /var/www/hackbridge/
sudo chown -R www-data:www-data /var/www/hackbridge
sudo chmod -R 755 /var/www/hackbridge
```

### Step 9.3 — Create Nginx config
```bash
sudo nano /etc/nginx/sites-available/hackbridge
```

Paste the following (replace `YOUR_SERVER_IP`):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name YOUR_SERVER_IP;

    root /var/www/hackbridge;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/json image/svg+xml;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /var/www/hackbridge;
    }
}
```

### Step 9.4 — Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/hackbridge /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
```

Expected:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Step 9.5 — Reload Nginx
```bash
sudo systemctl reload nginx
```

---

## Phase 10 — Backend PM2

### Step 10.1 — Install backend dependencies
```bash
cd /home/ubuntu/hackbridge-main/backend
npm install
```

### Step 10.2 — Build TypeScript backend
```bash
npm run build
```

### Step 10.3 — Create PM2 config
```bash
cd /home/ubuntu/hackbridge-main
nano ecosystem.config.cjs
```

Paste:

```javascript
module.exports = {
  apps: [
    {
      name: 'hackbridge-backend',
      script: './backend/dist/server.js',
      cwd: '/home/ubuntu/hackbridge-main',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      env_file: './backend/.env',
      error_file: '/home/ubuntu/logs/hackbridge-error.log',
      out_file: '/home/ubuntu/logs/hackbridge-out.log',
      time: true
    }
  ]
};
```

### Step 10.4 — Create logs directory
```bash
mkdir -p /home/ubuntu/logs
```

### Step 10.5 — Start the backend
```bash
cd /home/ubuntu/hackbridge-main
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs hackbridge-backend --lines 20
```

### Step 10.6 — Auto-start on reboot
```bash
pm2 startup
```

Copy the command it prints and run it. Then:

```bash
pm2 save
```

### Step 10.7 — Verify backend
```bash
curl http://localhost:4000/health
```

---

## Phase 11 — SQL Migrations

> **CRITICAL:** Run migrations in exact order. Never skip. Never re-run Migration 1 after Migration 2.

### Step 11.1 — Set environment variables
```bash
cd /home/ubuntu/hackbridge-main/supabase/migrations

export PGPASSWORD='CHOOSE_A_STRONG_PASSWORD'
export DB_HOST=localhost
export DB_USER=hackbridge_user
export DB_NAME=hackbridge
```

### Step 11.2 — Run all 14 migrations in order

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260915000001_initial_foundation.sql
echo "Migration 1 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260916000001_phase1_5_security_hardening.sql
echo "Migration 2 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260917000001_pilot_tenant_mitt.sql
echo "Migration 3 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260918000001_phase2a_hackathon_foundation.sql
echo "Migration 4 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260919000001_phase2c_companies_foundation.sql
echo "Migration 5 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260920000001_phase3a_problem_statements.sql
echo "Migration 6 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260921000001_phase4_teams_foundation.sql
echo "Migration 7 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260922000001_phase5_submissions_foundation.sql
echo "Migration 8 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260923000001_phase7_evaluation_foundation.sql
echo "Migration 9 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260924000001_phase8_leaderboard_foundation.sql
echo "Migration 10 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260925000001_phase9_talent_profiles_foundation.sql
echo "Migration 11 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260926000001_phase10_hiring_pipeline_foundation.sql
echo "Migration 12 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260927000001_phase11_audit_and_notifications_foundation.sql
echo "Migration 13 done"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f 20260928000001_phase12_storage_and_production_infrastructure.sql
echo "Migration 14 done"

echo "All 14 migrations complete!"
```

### Step 11.3 — (Optional) Load demo seed data
```bash
cd /home/ubuntu/hackbridge-main/supabase
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f seed_demo_data.sql
echo "Demo data loaded — test password: Password123!"
```

### Step 11.4 — Verify tables
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt public.*" | head -40
```

---

## Phase 12 — Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

> **Never open ports 5432 or 4000** to the public internet. They are internal only.

---

## Phase 13 — VPN Daily Workflow

### Quick Frontend Update

**On Windows PC (PowerShell):**
```powershell
cd D:\hackbridge-main
npm run build
scp -r "D:\hackbridge-main\dist\*" ubuntu@YOUR_SERVER_IP:/tmp/hackbridge-dist/
```

**On server SSH:**
```bash
sudo cp -r /tmp/hackbridge-dist/* /var/www/hackbridge/
sudo chown -R www-data:www-data /var/www/hackbridge
sudo systemctl reload nginx
echo "Frontend updated!"
```

### Backend Update

**On Windows PC:**
```powershell
scp -r "D:\hackbridge-main\backend\*" ubuntu@YOUR_SERVER_IP:/home/ubuntu/hackbridge-main/backend/
```

**On server SSH:**
```bash
cd /home/ubuntu/hackbridge-main/backend
npm install
npm run build
pm2 restart hackbridge-backend
pm2 status
```

### Automated Script — `deploy.ps1`

Save this as `D:\hackbridge-main\deploy.ps1`:

```powershell
param(
    [string]$ServerIP = "YOUR_SERVER_IP",
    [string]$ServerUser = "ubuntu"
)

Write-Host "Building frontend..." -ForegroundColor Cyan
Set-Location "D:\hackbridge-main"
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Uploading to $ServerIP..." -ForegroundColor Cyan
scp -r "D:\hackbridge-main\dist\*" "${ServerUser}@${ServerIP}:/tmp/hackbridge-dist/"

ssh "${ServerUser}@${ServerIP}" @"
sudo cp -r /tmp/hackbridge-dist/* /var/www/hackbridge/
sudo chown -R www-data:www-data /var/www/hackbridge
sudo systemctl reload nginx
echo 'Deployed!'
"@

Write-Host "Done! Visit: http://$ServerIP" -ForegroundColor Green
```

Run it:
```powershell
.\deploy.ps1 -ServerIP "YOUR_SERVER_IP"
```

---

## Phase 14 — Verify

### Check all services
```bash
sudo systemctl status nginx
pm2 status
sudo systemctl status postgresql
sudo ss -tlnp | grep -E ':(80|4000|5432)'
```

### Test in browser
```
Open: http://YOUR_SERVER_IP
```

You should see the HackBridge login page.

### Check logs
```bash
pm2 logs hackbridge-backend
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Cannot SSH | Check VPN connected; verify IP |
| 502 Bad Gateway | `pm2 restart hackbridge-backend` |
| Nginx test fails | `sudo nginx -t` — check for typos |
| Build TypeScript errors | `npm run build 2>&1 \| head -100` |
| PostgreSQL refused | `sudo systemctl restart postgresql` |
| Migration permission denied | Run grant commands in Phase 4.2 |
| Blank page in browser | Check `ls /var/www/hackbridge/` has `index.html` |
| PM2 keeps restarting | `pm2 logs hackbridge-backend --lines 100` |

---

## Cheatsheet

**Fill in and save securely:**

```
VPN IP Address:     ___________________________________
SSH Username:       ___________________________________
DB Password:        ___________________________________
JWT Secret:         ___________________________________
Supabase URL:       ___________________________________
Supabase Anon Key:  ___________________________________
```

**Server file locations:**

| What | Where |
|------|-------|
| Frontend files | `/var/www/hackbridge/` |
| Nginx config | `/etc/nginx/sites-available/hackbridge` |
| Backend source | `/home/ubuntu/hackbridge-main/backend/` |
| PM2 config | `/home/ubuntu/hackbridge-main/ecosystem.config.cjs` |
| Frontend .env | `/home/ubuntu/hackbridge-main/.env` |
| Backend .env | `/home/ubuntu/hackbridge-main/backend/.env` |
| Logs | `/home/ubuntu/logs/` |
| Migrations | `/home/ubuntu/hackbridge-main/supabase/migrations/` |

**Health check all services:**
```bash
echo "Nginx:" && sudo systemctl is-active nginx && \
echo "Backend:" && pm2 status hackbridge-backend && \
echo "PostgreSQL:" && sudo systemctl is-active postgresql
```

**Restart all services:**
```bash
sudo systemctl restart nginx && pm2 restart hackbridge-backend && sudo systemctl restart postgresql
```

---

## Final Checklist

- [ ] VPN connected, SSH works
- [ ] Ubuntu packages updated
- [ ] PostgreSQL 15 installed and running
- [ ] Database `hackbridge` created, `hackbridge_user` has all grants
- [ ] Node.js 20 installed
- [ ] PM2 installed globally
- [ ] Project transferred to `/home/ubuntu/hackbridge-main/`
- [ ] Frontend `.env` configured
- [ ] Backend `.env` configured
- [ ] Frontend built (`dist/` folder exists)
- [ ] Frontend files in `/var/www/hackbridge/`
- [ ] Nginx configured with correct server IP and passing `nginx -t`
- [ ] Backend compiled and running in PM2
- [ ] PM2 configured to start on reboot (`pm2 startup && pm2 save`)
- [ ] All 14 SQL migrations applied in order
- [ ] UFW firewall active (SSH + 80 + 443 only)
- [ ] Website loads at `http://YOUR_SERVER_IP`

---

*HackBridge — Multi-Stakeholder Hackathon SaaS Platform*  
*Pilot Institution: Maharaja Institute of Technology Thandavapura (MITT)*
