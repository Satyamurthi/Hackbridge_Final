#!/bin/bash
# =============================================================================
# HackBridge — One-Shot Deploy Script for Ubuntu Server
# Domain: hackbridge.mitt.edu.in
# Run as: sudo bash deploy-hackbridge.sh
# =============================================================================

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_ROOT="/var/www/hackbridge"
NGINX_SITE="/etc/nginx/sites-available/hackbridge"

echo ""
echo "=============================================="
echo "  HackBridge Deployment — hackbridge.mitt.edu.in"
echo "=============================================="
echo ""

# ── Step 1: Stop & disable Apache2 if running ─────────────────────────────────
echo "[1/7] Stopping Apache2 (if running)..."
if systemctl is-active --quiet apache2; then
    systemctl stop apache2
    systemctl disable apache2
    echo "      ✓ Apache2 stopped and disabled."
else
    echo "      ✓ Apache2 not running — skipping."
fi

# ── Step 2: Install Nginx if missing ──────────────────────────────────────────
echo "[2/7] Installing Nginx..."
apt-get install -y nginx > /dev/null 2>&1
systemctl start nginx
systemctl enable nginx
echo "      ✓ Nginx installed and running."

# ── Step 3: Install Node.js 20 if missing ─────────────────────────────────────
echo "[3/7] Checking Node.js..."
if ! command -v node &> /dev/null || [[ "$(node --version | cut -d. -f1 | tr -d 'v')" -lt 18 ]]; then
    echo "      Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
fi
echo "      ✓ Node.js $(node --version) ready."

# ── Step 4: Build the frontend ────────────────────────────────────────────────
echo "[4/7] Building frontend (npm install + npm run build)..."
cd "$REPO_DIR"
npm install --silent
npm run build
echo "      ✓ Build complete. dist/ created."

# ── Step 5: Deploy dist/ to web root ─────────────────────────────────────────
echo "[5/7] Deploying frontend files to $WEB_ROOT..."
mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}"/*
cp -r "$REPO_DIR/dist/." "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"
chmod -R 755 "$WEB_ROOT"
echo "      ✓ Files deployed:"
ls "$WEB_ROOT"

# ── Step 6: Configure Nginx ───────────────────────────────────────────────────
echo "[6/7] Configuring Nginx for hackbridge.mitt.edu.in..."

cat > "$NGINX_SITE" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name hackbridge.mitt.edu.in;

    root /var/www/hackbridge;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/json image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Backend API proxy (when backend is running)
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

    # Cache hashed Vite assets for 1 year
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform, immutable";
    }

    # SPA routing — CRITICAL: all routes fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /var/www/hackbridge;
    }
}
NGINX

# Enable site, disable default Apache/Nginx placeholder
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/hackbridge
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t
echo "      ✓ Nginx config valid."

# ── Step 7: Reload Nginx ──────────────────────────────────────────────────────
echo "[7/7] Reloading Nginx..."
systemctl reload nginx

# Open firewall
if command -v ufw &> /dev/null; then
    ufw allow OpenSSH > /dev/null 2>&1 || true
    ufw allow 80/tcp  > /dev/null 2>&1 || true
    ufw allow 443/tcp > /dev/null 2>&1 || true
    ufw --force enable > /dev/null 2>&1 || true
    echo "      ✓ Firewall: ports 22, 80, 443 open."
fi

# ── Verify ────────────────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  DEPLOYMENT COMPLETE ✓"
echo "=============================================="
echo ""
echo "  Status checks:"
echo "  • Nginx:   $(systemctl is-active nginx)"
echo "  • Apache2: $(systemctl is-active apache2 2>/dev/null || echo 'not installed')"
echo ""
echo "  Files in web root:"
ls -lh "$WEB_ROOT"
echo ""
echo "  Open in browser: http://hackbridge.mitt.edu.in"
echo ""
echo "  If still showing Apache page, run:"
echo "  sudo systemctl stop apache2 && sudo systemctl reload nginx"
echo ""
