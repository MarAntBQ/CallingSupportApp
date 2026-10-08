#!/usr/bin/env bash
# Llama una vez la purga diaria de una instalación de la app (#162). Lo ejecuta el cron del VPS
# (deploy/app-daily.cron), como el usuario dueño de la app. En Vercel la llama Vercel Cron.
#   $1  carpeta del clon de la app, bajo $HOME (de ahí se lee CRON_SECRET del .env)
#   $2  URL pública de la instalación, https://…
# El secreto nunca va en el archivo cron ni en los argumentos de curl (se ven en `ps`): se pasa
# el encabezado por la entrada estándar. La respuesta de la ruta son solo números.
set -euo pipefail

fallo() { echo "$(date -u +%FT%TZ) ABORTADO: $*" >&2; exit 1; }

[ $# -eq 2 ] || fallo "uso: app-daily.sh <carpeta-de-la-app> <https://url-publica>"
APP_DIR="$(realpath -m "$1")"
BASE_URL="${2%/}"

case "$APP_DIR/" in
  "$HOME"/*) ;;
  *) fallo "la carpeta de la app está fuera de \$HOME: $APP_DIR" ;;
esac
[[ "$BASE_URL" =~ ^https://[A-Za-z0-9.-]+$ ]] || fallo "la URL debe ser https://dominio, sin ruta: $BASE_URL"
[ -f "$APP_DIR/.env" ] || fallo "no existe $APP_DIR/.env"

# `|| true`: si no hay línea CRON_SECRET, grep sale con 1 y set -e cortaría aquí sin dejar el motivo.
SECRET="$({ grep -E '^CRON_SECRET=' "$APP_DIR/.env" || true; } | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r')"
[ -n "$SECRET" ] || fallo "falta CRON_SECRET (o está vacío) en $APP_DIR/.env: la ruta respondería 401"
[ ${#SECRET} -ge 32 ] || fallo "CRON_SECRET es demasiado corto (usa openssl rand -hex 32)"

RESPUESTA="$(printf 'Authorization: Bearer %s\n' "$SECRET" | curl -fsS --max-time 120 -H @- "$BASE_URL/api/cron/daily")" ||
  fallo "la llamada a $BASE_URL/api/cron/daily falló"
echo "$(date -u +%FT%TZ) $BASE_URL $RESPUESTA"
