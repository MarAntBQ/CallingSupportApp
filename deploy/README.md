# Publicación del sitio

El sitio de documentación (`site/`) se publica solo en **https://callingsupportapp.org** cada vez
que un merge a `main` toca `site/`, `team/`, `deploy/` o el validador de perfiles. Nadie lo
despliega a mano.

## Cómo funciona

1. El workflow [`deploy-site.yml`](../.github/workflows/deploy-site.yml) entra por SSH al hosting
   con una llave propia de este sitio (secreto `VPS_DEPLOY_KEY`).
2. Esa llave tiene un **forced-command**: lo único que puede ejecutar es
   `/home/callingsupportapp/deploy-site.sh`, sin terminal ni reenvío de puertos. Si alguien la
   robara, solo podría volver a publicar lo que ya está en `main`.
3. Ese disparador baja `main` en `/home/callingsupportapp/CallingSupportApp` y ejecuta
   [`vps-deploy.sh`](vps-deploy.sh), que está versionado aquí.
4. `vps-deploy.sh` genera el sitio con `node site/build.mjs` y lo publica con `rsync --delete`.

## Guardas (si alguna falla, no se publica nada)

- El clon es de git, tiene commit y viene del repositorio oficial.
- El docroot existe, no es un enlace a otro lugar y es del usuario `callingsupportapp`.
- El build generó las páginas (cada una con los tres idiomas), la 404, el sitemap, el `robots.txt` y el `.htaccess`.
- Ninguna página enlaza a un archivo interno que no exista.
- En seco, `rsync --delete` no borraría más de 200 archivos del docroot.

`.well-known/` (certificados), `cgi-bin/` y `.user.ini` nunca se tocan.

## Archivos del servidor que no viven en el repo

| Archivo | Para qué |
|---|---|
| `/home/callingsupportapp/deploy-site.sh` | Disparador: `git fetch` + `reset --hard origin/main` + `vps-deploy.sh`, con un candado para que no corran dos a la vez |
| `/home/callingsupportapp/.ssh/authorized_keys` | La llave pública de CI con `command="…/deploy-site.sh",no-pty,…` |

## Si algo sale mal

- **El workflow falla:** el log de Actions muestra la salida completa del servidor, incluido el
  motivo de `ABORTADO: …`. El sitio publicado no cambia.
- **Volver a publicar sin cambios:** *Actions → Publicar el sitio → Run workflow*.
- **Revertir:** se revierte el commit en `main` con un PR, y el merge lo publica.
