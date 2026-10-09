#!/bin/bash
# =============================================================================
# HackBridge — Nginx Conflict Fix Script
# Run as: sudo bash fix-nginx.sh
# =============================================================================

echo ""
echo "=============================================="
echo "  HackBridge — Nginx Conflict Fix"
echo "=============================================="
echo ""

DIST_DIR="/apps/hackbridge/Hackbridge_Final/dist"
WEB_ROOT="$DIST_DIR"
NGINX_SITE="/etc/nginx/sites-available/hackbridge"

# ── Step 1: Show what's currently in sites-enabled ───────────────────────────
echo "[1/6] Current Nginx sites-enabled:"
ls -la /etc/nginx/sites-enabled/
echo ""

# ── Step 2: Find & show every config that mentions hackbridge.mitt.edu.in ─────
echo "[2/6] Searching for conflicting server_name configs..."
echo "--- Configs with hackbridge.mitt.edu.in ---"
grep -rl "hackbridge.mitt.edu.in" /etc/nginx/ 2>/dev/null || echo "      (none found)"
echo ""

# ── Step 3: Find the broken shared memory zone ────────────────────────────────
echo "[3/6] Searching for broken 'hackmitten_login_v3' zone..."
grep -rl "hackmitten_login_v3" /etc/nginx/ 2>/dev/null || echo "      (none found)"
echo ""

# ── Step 4: Disable ALL sites-enabled, start clean ───────────────────────────
echo "[4/6] Removing ALL sites from sites-enabled (clean slate)..."
rm -f /etc/nginx/sites-enabled/*
echo "      ✓ All sites disabled."

# Remove any conf.d files that have hackbridge or hackmitten in the name
echo "      Checking conf.d for conflicts..."
for f in /etc/nginx/conf.d/*.conf; do
    if grep -q "hackbridge.mitt.edu.in\|hackmitten_login_v3" "$f" 2>/dev/null; then
        echo "      Removing conflicting conf.d file: $f"
        rm -f "$f"
    fi
done

# ── Step 5: Write clean Nginx config for HackBridge ──────────────────────────
echo "[5/6] Writing clean Nginx config..."

# Confirm dist/ exists and has index.html
if [ ! -f "$DIST_DIR/index.html" ]; then
    echo "ERROR: index.html not found in $DIST_DIR"
    echo "Run: cd /apps/hackbridge/Hackbridge_Final && npm run build"
    exit 1
fi

cat > "$NGINX_SITE" <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name hackbridge.mitt.edu.in _;

    root $DIST_DIR;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/json image/svg+xml;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 300;
    }

    # Cache Vite hashed assets forever
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform, immutable";
    }

    # SPA fallback — MUST have this for React Router
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
NGINX

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/hackbridge
echo "      ✓ Config written and enabled."
echo "      ✓ Serving from: $DIST_DIR"

# ── Step 6: Test & reload ─────────────────────────────────────────────────────
echo "[6/6] Testing Nginx config..."
if nginx -t 2>&1; then
    echo "      ✓ Config OK — reloading Nginx..."
    systemctl reload nginx
    echo "      ✓ Nginx reloaded!"
else
    echo ""
    echo "!!! Config test still failing. Full error output:"
    nginx -T 2>&1 | grep -A5 "emerg\|crit\|error" | head -40
    echo ""
    echo "Please share the above error output."
    exit 1
fi

# ── Final check ───────────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  FIX COMPLETE ✓"
echo "=============================================="
echo ""
echo "  Active sites:"
ls /etc/nginx/sites-enabled/
echo ""
echo "  Nginx status: $(systemctl is-active nginx)"
echo "  Serving from: $DIST_DIR"
echo "  Files: $(ls $DIST_DIR)"
echo ""
echo "  Test: curl -I http://hackbridge.mitt.edu.in"
curl -s -o /dev/null -w "  HTTP Status: %{http_code}\n" http://hackbridge.mitt.edu.in || true
echo ""
echo "  Open in browser: http://hackbridge.mitt.edu.in"
echo "  Hard refresh if cached: Ctrl+Shift+R"
echo ""
