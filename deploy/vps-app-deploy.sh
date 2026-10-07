#!/usr/bin/env bash
# Despliega la app Next.js (staging o demo) en MBHostCloud, como el usuario cliente.
# Corre EN EL VPS, invocado por el forced-command del deploy. Reutilizable:
#   APP        nombre del proceso pm2         (def. csa-staging)
#   CLONE_DIR  carpeta del clon de la app     (def. $HOME/csa-app)
#   REF        ref de git a desplegar         (def. origin/main; demo pasa un tag)
# Hace: reset duro al REF, npm ci, build y pm2 reload. NO hace git clean (preserva el .env).
set -euo pipefail
export PATH="/usr/local/lib/node22/bin:$PATH"

APP="${APP:-csa-staging}"
CLONE_DIR="${CLONE_DIR:-$HOME/csa-app}"
REF="${REF:-origin/main}"
ORIGEN="https://github.com/MarAntBQ/CallingSupportApp.git"

fallo() { echo "ABORTADO: $*" >&2; exit 1; }

# Un deploy a la vez por app.
LOCK="$HOME/.deploy-$APP.lock"
exec 9>"$LOCK"
flock -w 600 9 || fallo "otro deploy de $APP sigue corriendo"

# Guards: tiene que ser el clon git correcto, tuyo.
[ -d "$CLONE_DIR/.git" ] || fallo "no existe el clon $CLONE_DIR"
cd "$CLONE_DIR"
[ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] || fallo "$CLONE_DIR no es un clon git"
[ "$(git remote get-url origin)" = "$ORIGEN" ] || fallo "el clon no viene de $ORIGEN"
[ "$(stat -c '%U' "$CLONE_DIR")" = "$(id -un)" ] || fallo "el clon no es tuyo"

git fetch --prune -q origin --tags
git reset --hard -q "$REF"
# Sin `git clean`: el .env (gitignored) y node_modules/.next se conservan; npm ci y build los refrescan.

echo "[deploy] $APP · $(git log --oneline -1) · node $(node -v)"
npm ci --no-audit --no-fund
npm run build

# Reload (sin --update-env: el APP_SOCKET lo fijó el wrapper del manager al enlazar; no lo pisamos).
pm2 reload "$APP"
pm2 save >/dev/null 2>&1 || true
echo "[deploy] $APP recargado OK"
