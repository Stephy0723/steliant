#!/usr/bin/env bash
# Respaldo diario de GlitchGang en el VPS: base de datos Mongo + archivos subidos
# por usuarios (backend/uploads: logos, banners, evidencias, comprobantes) +
# grabaciones de voz de las partidas (MATCH_RECORDINGS_DIR, por defecto
# backend/data/recordings; privadas, el respaldo queda con permisos 700).
#
# Uso manual:   bash backend/scripts/backup.sh
# Cron diario (crontab -e, como el usuario que corre PM2), 4:15 am:
#   15 4 * * * /var/www/glitchgang/backend/scripts/backup.sh >> /var/log/glitchgang-backup.log 2>&1
#
# Variables opcionales (exportarlas en el cron o antes de correrlo):
#   BACKUP_DIR      carpeta destino            (por defecto /var/backups/glitchgang)
#   KEEP_DAYS       dias que se conservan      (por defecto 14)
#   REC_KEEP_DAYS   dias que se conservan los respaldos de GRABACIONES (por defecto 1).
#                   Cada respaldo ya trae todas las grabaciones vigentes, asi que con
#                   1 dia alcanza para recuperar el disco, y una grabacion borrada a
#                   los 30 dias (lo que promete el aviso del bot) no sigue viva aqui
#                   dos semanas mas.
#   RCLONE_REMOTE   copia FUERA del VPS con rclone, p. ej. "b2:glitchgang-backups"
#                   (sin esto el respaldo vive en el mismo disco: si el VPS muere, se pierde).
#                   La limpieza de abajo tambien borra alla lo que pasa de KEEP_DAYS /
#                   REC_KEEP_DAYS (antes solo se borraba en el VPS y la copia remota crecia
#                   para siempre, con datos de cuentas ya eliminadas incluidos).
#
# Restaurar (ojo: --drop reemplaza las colecciones actuales):
#   mongorestore --uri "$MONGODB_URI" --gzip --archive=glitchgang-db-AAAAMMDD-HHMM.archive.gz --drop
#   tar -xzf glitchgang-uploads-AAAAMMDD-HHMM.tar.gz -C /var/www/glitchgang/backend
#   tar -xzf glitchgang-recordings-AAAAMMDD-HHMM.tar.gz -C <carpeta padre de MATCH_RECORDINGS_DIR>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$BACKEND_DIR/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/glitchgang}"
KEEP_DAYS="${KEEP_DAYS:-14}"
REC_KEEP_DAYS="${REC_KEEP_DAYS:-1}"
STAMP="$(date +%Y%m%d-%H%M)"

log() { echo "[$(date '+%F %T')] $*"; }

# El .env del VPS tiene "MONGODB_URI = ..." CON espacios alrededor del "=",
# asi que no se puede hacer `source .env`: se lee la linea a mano.
# Una variable que no esta en el .env devuelve vacio: grep sin coincidencias
# sale con 1 y, con set -e + pipefail, cortaba el script entero sin avisar.
read_env() {
  { grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" || true; } | tail -n1 \
    | sed -E "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//; s/[[:space:]]+$//; s/^[\"']//; s/[\"']$//"
}

MONGODB_URI="${MONGODB_URI:-$(read_env MONGODB_URI)}"
if [ -z "$MONGODB_URI" ]; then
  log "ERROR: no hay MONGODB_URI (ni en el entorno ni en $ENV_FILE)"
  exit 1
fi
command -v mongodump >/dev/null || { log "ERROR: falta mongodump (apt install mongodb-database-tools)"; exit 1; }

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" # el volcado incluye correos y hashes de contrasenas

DB_FILE="$BACKUP_DIR/glitchgang-db-$STAMP.archive.gz"
UP_FILE="$BACKUP_DIR/glitchgang-uploads-$STAMP.tar.gz"
REC_FILE="$BACKUP_DIR/glitchgang-recordings-$STAMP.tar.gz"
REC_DIR="${MATCH_RECORDINGS_DIR:-$(read_env MATCH_RECORDINGS_DIR)}"
REC_DIR="${REC_DIR:-$BACKEND_DIR/data/recordings}"
case "$REC_DIR" in /*) ;; *) REC_DIR="$BACKEND_DIR/$REC_DIR" ;; esac

log "Volcando Mongo -> $DB_FILE"
# Se escribe a .tmp y se renombra al final: un respaldo a medias nunca queda
# con nombre de respaldo valido (ni lo cuenta la limpieza de abajo).
mongodump --uri="$MONGODB_URI" --gzip --archive="$DB_FILE.tmp" --quiet
mv "$DB_FILE.tmp" "$DB_FILE"

if [ -d "$BACKEND_DIR/uploads" ]; then
  log "Empaquetando uploads -> $UP_FILE"
  tar -czf "$UP_FILE.tmp" -C "$BACKEND_DIR" uploads
  mv "$UP_FILE.tmp" "$UP_FILE"
fi

# Grabaciones de voz: el backend borra cada una a los 30 dias sin reclamo;
# este respaldo las conserva REC_KEEP_DAYS dias mas como maximo.
if [ -d "$REC_DIR" ] && [ -n "$(ls -A "$REC_DIR" 2>/dev/null)" ]; then
  log "Empaquetando grabaciones -> $REC_FILE"
  tar -czf "$REC_FILE.tmp" -C "$(dirname "$REC_DIR")" "$(basename "$REC_DIR")"
  mv "$REC_FILE.tmp" "$REC_FILE"
fi

if [ -n "${RCLONE_REMOTE:-}" ]; then
  log "Copiando fuera del VPS -> $RCLONE_REMOTE"
  rclone copy "$DB_FILE" "$RCLONE_REMOTE"
  [ -f "$UP_FILE" ] && rclone copy "$UP_FILE" "$RCLONE_REMOTE"
  [ -f "$REC_FILE" ] && rclone copy "$REC_FILE" "$RCLONE_REMOTE"
fi

log "Borrando respaldos de mas de $KEEP_DAYS dias (grabaciones: $REC_KEEP_DAYS)"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'glitchgang-*' ! -name 'glitchgang-recordings-*' -mtime "+$KEEP_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'glitchgang-recordings-*' -mtime "+$REC_KEEP_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.tmp' -delete
if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone delete "$RCLONE_REMOTE" --min-age "${KEEP_DAYS}d" --include 'glitchgang-db-*' --include 'glitchgang-uploads-*'
  rclone delete "$RCLONE_REMOTE" --min-age "${REC_KEEP_DAYS}d" --include 'glitchgang-recordings-*'
fi

log "OK $(du -h "$DB_FILE" | cut -f1) base de datos$( [ -f "$UP_FILE" ] && echo ", $(du -h "$UP_FILE" | cut -f1) uploads")$( [ -f "$REC_FILE" ] && echo ", $(du -h "$REC_FILE" | cut -f1) grabaciones")"
