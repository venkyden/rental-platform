#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Roomivo — PostgreSQL Automated Backup Script
# ─────────────────────────────────────────────────────────
#
# Usage:
#   ./scripts/backup_db.sh
#
# Cron (daily at 3 AM):
#   0 3 * * * /path/to/rental-platform/scripts/backup_db.sh >> /var/log/roomivo-backup.log 2>&1
#
# Environment variables (set in .env or export):
#   DB_HOST      — default: localhost
#   DB_PORT      — default: 5432
#   DB_NAME      — default: rental_platform
#   DB_USER      — default: rental
#   PGPASSWORD   — required (or use .pgpass)
#   BACKUP_DIR   — default: ./backups
#   RETENTION    — default: 30 (days)
# ─────────────────────────────────────────────────────────

set -euo pipefail

# Defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-rental_platform}"
DB_USER="${DB_USER:-rental}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
RETENTION="${RETENTION:-30}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "────────────────────────────────────────"
echo "📦 Roomivo DB Backup — $(date)"
echo "   Host: ${DB_HOST}:${DB_PORT}"
echo "   Database: ${DB_NAME}"
echo "   Output: ${BACKUP_FILE}"
echo "────────────────────────────────────────"

# Run pg_dump and compress
if pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --verbose 2>/dev/null | gzip > "$BACKUP_FILE"; then

    SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup successful: ${BACKUP_FILE} (${SIZE})"
else
    echo "❌ Backup FAILED at $(date)"
    rm -f "$BACKUP_FILE"  # Clean up partial file
    exit 1
fi

# Prune old backups (older than $RETENTION days)
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$RETENTION" -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "🗑️  Pruned ${DELETED} backup(s) older than ${RETENTION} days"
fi

echo "📊 Current backups:"
ls -lhS "$BACKUP_DIR"/${DB_NAME}_*.sql.gz 2>/dev/null || echo "   (none)"
echo "────────────────────────────────────────"
echo "✅ Done at $(date)"
