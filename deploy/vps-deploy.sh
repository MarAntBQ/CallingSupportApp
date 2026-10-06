#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="/usr/local/lib/node22/bin:$PATH"
DUENO=callingsupportapp
DOCROOT="/home/$DUENO/domains/callingsupportapp.org/public_html"
ORIGEN="https://github.com/MarAntBQ/CallingSupportApp.git"
MAX_BORRADOS=200
EXCLUSIONES=(--exclude='.well-known' --exclude='cgi-bin' --exclude='.user.ini')

fallo() { echo "ABORTADO: $*" >&2; exit 1; }

[ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] || fallo "no es un clon de git"
git rev-parse --verify HEAD >/dev/null 2>&1 || fallo "sin commit válido"
[ "$(git remote get-url origin)" = "$ORIGEN" ] || fallo "el clon no viene de $ORIGEN"
REAL=$(realpath -e "$DOCROOT") || fallo "no existe el docroot $DOCROOT"
[ "$REAL" = "$DOCROOT" ] || fallo "el docroot apunta a otro lugar: $REAL"
[ "$(stat -c '%U' "$DOCROOT")" = "$DUENO" ] || fallo "el docroot no es de $DUENO"

echo "[deploy] $(git log --oneline -1) · node $(node -v)"
npm ci --prefix site --no-audit --no-fund
SITE_URL=https://callingsupportapp.org node site/build.mjs

for f in index.html pt/index.html en/index.html 404.html sitemap.xml robots.txt .htaccess; do
  [ -s "_site/$f" ] || fallo "el build no generó $f"
done

HTMLS=$(find _site -name '*.html') || fallo "no se pudo recorrer _site"
[ -n "$HTMLS" ] || fallo "el build no tiene páginas"
ROTAS=0
while IFS= read -r html; do
  dir=$(dirname "$html")
  refs=$(grep -oE '(src|href)="[^"]*"' "$html") || [ $? -eq 1 ] || fallo "no se pudo leer $html"
  while IFS= read -r ref; do
    ref=${ref#*=\"}
    ref=${ref%\"}
    case "$ref" in
      '' | '#'* | '?'* | http:* | https:* | mailto:* | //* | data:*) continue ;;
      /*) destino="_site$ref" ;;
      *) destino="$dir/$ref" ;;
    esac
    destino="${destino%%[?#]*}"
    [ -e "$destino" ] || { echo "referencia rota en ${html#_site/}: $ref" >&2; ROTAS=$((ROTAS + 1)); }
  done <<< "$refs"
done <<< "$HTMLS"
[ "$ROTAS" -eq 0 ] || fallo "$ROTAS referencia(s) interna(s) rota(s)"

EN_SECO=$(rsync -a --delete --dry-run --out-format='%o %n' "${EXCLUSIONES[@]}" _site/ "$DOCROOT/") || fallo "rsync en seco falló"
BORRARIA=$(printf '%s\n' "$EN_SECO" | grep -c '^del\.' || true)
[ "$BORRARIA" -le "$MAX_BORRADOS" ] || fallo "borraría $BORRARIA archivos del docroot (máximo $MAX_BORRADOS)"

rsync -a --delete "${EXCLUSIONES[@]}" _site/ "$DOCROOT/"
echo "[deploy] publicado en https://callingsupportapp.org ($BORRARIA archivo(s) retirado(s))"
