#!/usr/bin/env bash
# Despliega la app Next.js (staging o demo) en MBHostCloud, como el usuario cliente.
# Corre EN EL VPS, invocado por el forced-command del deploy. Reutilizable:
#   APP        nombre del proceso pm2         (def. csa-staging; solo csa-staging|csa-demo)
#   CLONE_DIR  carpeta del clon de la app     (def. $HOME/csa-app; debe estar bajo $HOME)
#   REF        ref de git a desplegar         (def. origin/main; solo origin/main o un tag vX.Y.Z)
# Hace: reset duro al REF, limpia lo no rastreado salvo el .env, npm ci, build y pm2 reload.
set -euo pipefail
export PATH="/usr/local/lib/node22/bin:$PATH"

APP="${APP:-csa-staging}"
CLONE_DIR="${CLONE_DIR:-$HOME/csa-app}"
REF="${REF:-origin/main}"
ORIGEN="https://github.com/MarAntBQ/CallingSupportApp.git"

fallo() { echo "ABORTADO: $*" >&2; exit 1; }

# Validar las entradas (defensa en profundidad; vienen del forced-command, no del cliente).
case "$APP" in
  csa-staging | csa-demo) ;;
  *) fallo "APP no permitido: $APP" ;;
esac
if [[ "$REF" != "origin/main" && ! "$REF" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  fallo "REF no permitido: $REF"
fi
REAL_CLONE="$(realpath -m "$CLONE_DIR")"
case "$REAL_CLONE/" in
  "$HOME"/*) ;;
  *) fallo "CLONE_DIR fuera de \$HOME: $REAL_CLONE" ;;
esac

# Un deploy a la vez por app.
exec 9>"$HOME/.deploy-$APP.lock"
flock -w 600 9 || fallo "otro deploy de $APP sigue corriendo"

# Guards: tiene que ser el clon git correcto, tuyo.
[ -d "$REAL_CLONE/.git" ] || fallo "no existe el clon $REAL_CLONE"
cd "$REAL_CLONE"
[ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] || fallo "$REAL_CLONE no es un clon git"
[ "$(git remote get-url origin)" = "$ORIGEN" ] || fallo "el clon no viene de $ORIGEN"
[ "$(stat -c '%U' "$REAL_CLONE")" = "$(id -un)" ] || fallo "el clon no es tuyo"

git fetch --prune -q origin --tags main
# Para un tag (ref != origin/main), re-verificar contra el main recién traído que el commit del
# tag sea ancestro de origin/main. Cierra la ventana TOCTOU: aunque el tag se haya movido entre
# el check de CI y este deploy, aquí solo desplegamos algo que esté en main.
if [ "$REF" != "origin/main" ]; then
  git merge-base --is-ancestor "$REF" origin/main || fallo "$REF no es ancestro de origin/main"
fi
git reset --hard -q "$REF"
# Quita lo no rastreado (builds viejos, basura) PERO conserva el .env (secretos, gitignored).
# node_modules y .next se eliminan aquí y los regeneran npm ci y build.
git clean -fdxq -e .env

echo "[deploy] $APP · $(git log --oneline -1) · node $(node -v)"
npm ci --no-audit --no-fund
npm run build

# El esquema debe existir ANTES de recargar el código nuevo: si no, Postgres responde 42703
# ("columna inexistente") y la app devuelve 500 (le pasó a staging con las migraciones 0014-0017).
# drizzle-kit migrate es idempotente y usa DIRECT_DATABASE_URL del .env del clon. Si falla, el
# deploy aborta (set -e) ANTES del reload: mejor no desplegar que servir código contra un esquema viejo.
npm run db:migrate

# Reload sin --update-env: el APP_SOCKET lo fija el wrapper del manager al enlazar; no lo pisamos.
pm2 reload "$APP"
# pm2 save asegura que sobreviva un reinicio; si falla, avisamos fuerte (no lo ocultamos).
pm2 save || echo "::warning::pm2 save falló en $APP; el proceso puede no sobrevivir un reinicio del VPS"
echo "[deploy] $APP recargado OK"
