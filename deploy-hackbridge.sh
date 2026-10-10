#!/bin/bash
# =============================================================================
# HackBridge — One-Shot Deploy Script for Ubuntu Server
# Domain: hackbridge.mitt.edu.in
# Run as: sudo bash deploy-hackbridge.sh
# =============================================================================

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

# ── Step 4: Ensure PM2 log directory exists ──────────────────────────────────
echo "[4/8] Creating PM2 log directory..."
mkdir -p "$REPO_DIR/logs"
echo "      ✓ Log directory ready: $REPO_DIR/logs"

# ── Step 5: Build the frontend ────────────────────────────────────────────────
echo "[5/8] Building frontend (npm install + npm run build)..."
cd "$REPO_DIR"
npm install --silent
npm run build
echo "      ✓ Build complete. dist/ created."

# ── Step 6: Deploy dist/ to web root ─────────────────────────────────────────
echo "[6/8] Deploying frontend files to $WEB_ROOT..."
mkdir -p "$WEB_ROOT"

# Resolve real paths to detect if web root is already a symlink to dist/
DIST_REAL="$(realpath "$REPO_DIR/dist" 2>/dev/null || echo "$REPO_DIR/dist")"
WEB_REAL="$(realpath "$WEB_ROOT"   2>/dev/null || echo "$WEB_ROOT")"

if [ "$DIST_REAL" = "$WEB_REAL" ]; then
    # Web root is already pointing at dist/ — skip copy, files are already there
    echo "      ✓ Web root already points to dist/ — no copy needed."
else
    # Fresh copy: wipe old files, copy new build
    rm -rf "${WEB_ROOT:?}"/*
    cp -r "$REPO_DIR/dist/." "$WEB_ROOT/"
    echo "      ✓ Files copied to $WEB_ROOT."
fi

chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || true
chmod -R 755 "$WEB_ROOT"
echo "      ✓ Files in web root:"
ls "$WEB_ROOT"

# ── Step 7: Write Nginx site config ──────────────────────────────────────────
echo "[7/8] Configuring Nginx for hackbridge.mitt.edu.in..."

# Determine the correct document root
# If web root was symlinked to dist, point Nginx there directly
if [ "$DIST_REAL" = "$WEB_REAL" ]; then
    DOC_ROOT="$DIST_REAL"
else
    DOC_ROOT="$WEB_ROOT"
fi

cat > "$NGINX_SITE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name hackbridge.mitt.edu.in;

    root $DOC_ROOT;
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

    # Backend API proxy (when backend is running on port 4000)
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # Cache hashed Vite assets for 1 year
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform, immutable";
    }

    # SPA routing — ALL routes fall back to index.html (React Router)
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root $DOC_ROOT;
    }
}
NGINX

# Enable site, remove default placeholder
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/hackbridge
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t
echo "      ✓ Nginx config valid."

# ── Step 8: Reload Nginx ──────────────────────────────────────────────────────
echo "[8/8] Reloading Nginx..."
systemctl reload nginx

# Open firewall ports
if command -v ufw &> /dev/null; then
    ufw allow OpenSSH > /dev/null 2>&1 || true
    ufw allow 80/tcp  > /dev/null 2>&1 || true
    ufw allow 443/tcp > /dev/null 2>&1 || true
    ufw --force enable > /dev/null 2>&1 || true
    echo "      ✓ Firewall: ports 22, 80, 443 open."
fi

# ── Step 9: Build & start backend with PM2 ────────────────────────────────────
echo ""
echo "[9/9] Starting backend with PM2..."

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
    echo "      ✓ PM2 installed."
fi

# Build backend TypeScript
cd "$REPO_DIR/backend"
npm install --silent
npm run build
cd "$REPO_DIR"

# Start or restart the backend
pm2 describe hackbridge-backend > /dev/null 2>&1 \
  && pm2 restart ecosystem.config.cjs \
  || pm2 start ecosystem.config.cjs
pm2 save
echo "      ✓ Backend running on port 4000."

# ── Final Verification ────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  DEPLOYMENT COMPLETE ✓"
echo "=============================================="
echo ""
echo "  Status checks:"
echo "  • Nginx:    $(systemctl is-active nginx)"
echo "  • Apache2:  $(systemctl is-active apache2 2>/dev/null || echo 'not installed/disabled')"
echo "  • Backend:  $(pm2 describe hackbridge-backend 2>/dev/null | grep -oP 'status.*' | head -1 || echo 'check: pm2 status')"
echo "  • Doc root: $DOC_ROOT"
echo ""
echo "  Files being served:"
ls -lh "$DOC_ROOT"
echo ""
echo "  Open in browser: http://hackbridge.mitt.edu.in"
echo ""
echo "  If page still cached, do a hard refresh: Ctrl+Shift+R"
echo ""
