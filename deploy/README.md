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

## Purga diaria de la app en el VPS (staging y demo)

La app borra cada día lo que ya venció: inscripciones por retención (#20, #26), sesiones vencidas o
revocadas y registros de correos. Lo hace la ruta `/api/cron/daily`. En Vercel la llama Vercel Cron
(`vercel.json`); en el VPS la llama el cron de [`app-daily.cron`](app-daily.cron) (#162).

- [`app-daily.sh`](app-daily.sh) lee `CRON_SECRET` del `.env` de cada instalación y llama la
  ruta con `Authorization: Bearer …`. El secreto no está en el archivo cron ni en los argumentos de
  `curl`. La respuesta y el log son solo números, sin datos de personas.
- Si `CRON_SECRET` falta o la llamada falla, deja `ABORTADO: …` en el log y termina con error.

**Instalar** (quien administra el servidor, una vez):

```sh
# 1. Cada .env (csa-app y csa-demo) necesita CRON_SECRET (openssl rand -hex 32) y pm2 reload.
# 2. Carpeta del log, del usuario de la app:
sudo -u callingsupportapp mkdir -p -m 700 /home/callingsupportapp/.mbtmp
# 3. El archivo cron, de root y sin permisos de escritura para otros:
sudo install -m 644 -o root -g root /home/callingsupportapp/csa-app/deploy/app-daily.cron /etc/cron.d/callingsupportapp-daily
```

**Comprobar:** correr la línea a mano como `callingsupportapp` y mirar el log:

```sh
sudo -u callingsupportapp /home/callingsupportapp/csa-app/deploy/app-daily.sh /home/callingsupportapp/csa-app https://staging.callingsupportapp.org
tail -n 5 /home/callingsupportapp/.mbtmp/app-daily.log
```

Debe imprimir algo como `… {"purgedRegistrations":0,"purgedParticipants":0,"deletedSessions":0,"deletedEmailLogs":0}`.
Sin el encabezado, la ruta responde 401.
