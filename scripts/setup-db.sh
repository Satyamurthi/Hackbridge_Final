#!/usr/bin/env bash
# ==============================================================================
# 🚀 HackBridge — One-Command Database Setup Script for Ubuntu Server
#
#run command
#cd /home/ubuntu/hackbridge-main
#sudo bash scripts/setup-db.sh

# ==============================================================================
# Usage:
#   sudo bash scripts/setup-db.sh [options]
#
# Options:
#   -p, --password <PASS>   Set PostgreSQL password for hackbridge_user
#                           (Default: Prompt interactively or generate secure pass)
#   -d, --dbname <NAME>     Database name (Default: hackbridge)
#   -u, --user <USER>       Database username (Default: hackbridge_user)
#   -m, --mode <MODE>       Mode: 'standalone' (backend PostgreSQL) or 'supabase'
#                           (Default: standalone)
#   -h, --help              Show this help message
# ==============================================================================

set -euo pipefail

# ANSI Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

DB_NAME="hackbridge"
DB_USER="hackbridge_user"
DB_PASSWORD=""
MODE="standalone"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--password)
      DB_PASSWORD="$2"
      shift 2
      ;;
    -d|--dbname)
      DB_NAME="$2"
      shift 2
      ;;
    -u|--user)
      DB_USER="$2"
      shift 2
      ;;
    -m|--mode)
      MODE="$2"
      shift 2
      ;;
    -h|--help)
      echo "HackBridge Database Setup Utility"
      echo "Usage: sudo bash scripts/setup-db.sh [-p password] [-d dbname] [-u user] [-m standalone|supabase]"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown argument: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${MAGENTA}${BOLD}====================================================================${NC}"
echo -e "${MAGENTA}${BOLD}       🚀 HackBridge Database Initialization Engine (Ubuntu)       ${NC}"
echo -e "${MAGENTA}${BOLD}====================================================================${NC}"
echo ""

# 1. Check Root / Sudo privileges
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Please run this script with sudo or as root:${NC}"
   echo "   sudo bash scripts/setup-db.sh"
   exit 1
fi

# Locate project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo -e "${CYAN}📁 Project directory detected at:${NC} ${PROJECT_ROOT}"

# 2. Check if PostgreSQL is installed
echo -e "${CYAN}[1/5] Checking PostgreSQL service...${NC}"
if ! command -v psql &> /dev/null; then
  echo -e "${YELLOW}⚠️  PostgreSQL is not installed.${NC} Installing PostgreSQL 15 & contrib..."
  apt-get update -y
  apt-get install -y postgresql postgresql-contrib
  systemctl start postgresql
  systemctl enable postgresql
  echo -e "${GREEN}✓ PostgreSQL installed and started successfully.${NC}"
else
  # Ensure service is running
  if ! systemctl is-active --quiet postgresql; then
    echo -e "${YELLOW}Starting PostgreSQL service...${NC}"
    systemctl start postgresql
    systemctl enable postgresql
  fi
  echo -e "${GREEN}✓ PostgreSQL is active and running.${NC}"
fi

# 3. Handle Database Password
if [[ -z "${DB_PASSWORD}" ]]; then
  echo ""
  echo -e "${YELLOW}Enter a secure password for the database user '${DB_USER}':${NC}"
  read -s -p "Password (leave blank for random secure password): " DB_PASSWORD
  echo ""
  if [[ -z "${DB_PASSWORD}" ]]; then
    DB_PASSWORD=$(tr -dc A-Za-z0-9_!% 2>/dev/null < /dev/urandom | head -c 20 || openssl rand -base64 16)
    echo -e "${GREEN}✓ Generated secure password:${NC} ${DB_PASSWORD}"
  fi
fi

# 4. Create User and Database
echo -e "${CYAN}[2/5] Configuring PostgreSQL role and database...${NC}"

# Escape single quotes in password for SQL
ESCAPED_PW=$(echo "${DB_PASSWORD}" | sed "s/'/''/g")

sudo -u postgres psql <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE USER ${DB_USER} WITH PASSWORD '${ESCAPED_PW}';
  ELSE
    ALTER USER ${DB_USER} WITH PASSWORD '${ESCAPED_PW}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
EOSQL

echo -e "${GREEN}✓ User '${DB_USER}' and database '${DB_NAME}' are ready.${NC}"

# Grant schema permissions inside database
sudo -u postgres psql -d "${DB_NAME}" <<EOSQL
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOSQL

# 5. Apply Schema Migrations
echo -e "${CYAN}[3/5] Applying full database schema & seed data (${MODE} mode)...${NC}"

STANDALONE_SQL="${PROJECT_ROOT}/backend/database/hackbridge_full_standalone.sql"
SUPABASE_MIGRATIONS_DIR="${PROJECT_ROOT}/supabase/migrations"

if [[ "${MODE}" == "standalone" ]]; then
  if [[ ! -f "${STANDALONE_SQL}" ]]; then
    echo -e "${RED}❌ Consolidated schema file not found at: ${STANDALONE_SQL}${NC}"
    exit 1
  fi

  PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -f "${STANDALONE_SQL}" > /dev/null

  echo -e "${GREEN}✓ All tables, relations, and seed data applied successfully!${NC}"
else
  # Supabase migrations sequentially
  export PGPASSWORD="${DB_PASSWORD}"
  for file in $(ls "${SUPABASE_MIGRATIONS_DIR}"/*.sql | sort); do
    echo "  Applying $(basename "$file")..."
    psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -f "$file" > /dev/null
  done
  echo -e "${GREEN}✓ All 14 Supabase migrations applied successfully!${NC}"
fi

# 6. Verification
echo -e "${CYAN}[4/5] Verifying database integrity...${NC}"

TABLE_COUNT=$(PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | xargs)
echo -e "  Found ${BOLD}${TABLE_COUNT}${NC} public tables."

TENANT_CHECK=$(PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT name FROM tenants LIMIT 1;" 2>/dev/null | xargs || true)
if [[ -n "${TENANT_CHECK}" ]]; then
  echo -e "  Pilot Tenant: ${BOLD}${TENANT_CHECK}${NC}"
fi

# 7. Output Configuration
echo -e "${CYAN}[5/5] Finalizing deployment configuration...${NC}"

ENV_DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"

# Optionally update backend/.env if it exists
BACKEND_ENV="${PROJECT_ROOT}/backend/.env"
if [[ -f "${BACKEND_ENV}" ]]; then
  if grep -q "DATABASE_URL=" "${BACKEND_ENV}"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"${ENV_DB_URL}\"|" "${BACKEND_ENV}"
  else
    echo "DATABASE_URL=\"${ENV_DB_URL}\"" >> "${BACKEND_ENV}"
  fi
  echo -e "${GREEN}✓ Updated ${BACKEND_ENV} with active DATABASE_URL.${NC}"
else
  echo "DATABASE_URL=\"${ENV_DB_URL}\"" > "${BACKEND_ENV}"
  echo "PORT=4000" >> "${BACKEND_ENV}"
  echo "NODE_ENV=production" >> "${BACKEND_ENV}"
  echo -e "${GREEN}✓ Created ${BACKEND_ENV} with production settings.${NC}"
fi

echo ""
echo -e "${GREEN}${BOLD}====================================================================${NC}"
echo -e "${GREEN}${BOLD}  🎉 HackBridge Database Setup Complete!                           ${NC}"
echo -e "${GREEN}${BOLD}====================================================================${NC}"
echo ""
echo -e "Database Name:     ${BOLD}${DB_NAME}${NC}"
echo -e "Database User:     ${BOLD}${DB_USER}${NC}"
echo -e "Database Password: ${BOLD}${DB_PASSWORD}${NC}"
echo ""
echo -e "Connection String (DATABASE_URL):"
echo -e "  ${CYAN}${ENV_DB_URL}${NC}"
echo ""
echo -e "To start or restart the backend with PM2:"
echo -e "  ${BOLD}pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs${NC}"
echo ""
