---
title: Manual del desarrollador
description: Guía paso a paso para colaborar en CallingSupportApp desde cero: instalar las herramientas, traer el repositorio, ver el sitio y llegar a tu primer PR.
updated: 2026-10-06
---

Esta guía te lleva **desde una computadora sin nada instalado hasta tu primer PR mergeado**, sin tener que preguntarle nada a nadie. Síguela en orden. Cada paso dice qué hacer, qué **deberías ver** y qué hacer **si falla**.

Las reglas del proyecto (el porqué de cada cosa) están en [CONTRIBUTING](https://github.com/MarAntBQ/CallingSupportApp/blob/main/CONTRIBUTING.md) y [AGENTS.md](https://github.com/MarAntBQ/CallingSupportApp/blob/main/AGENTS.md). Este manual es la secuencia exacta.

## 1. Antes de empezar (10 minutos de lectura)

- **Qué es:** herramientas gratuitas para que un barrio o rama organice actividades (viaje al templo, campamentos, EnglishConnect). **No es oficial** de la Iglesia y no reemplaza Herramientas para Miembros. Lee el [README](https://github.com/MarAntBQ/CallingSupportApp#readme).
- **Tres reglas que mandan sobre todo lo demás:**
  1. el **Manual General** de la Iglesia: si una idea lo contradice, no se construye;
  2. los **datos de los miembros** se cuidan como pide el Manual (33.8): solo lo necesario, solo para la actividad, nunca datos reales en el repositorio;
  3. la aplicación **no maneja dinero** (capítulo 34).
- **Cómo trabajamos:** CSATeam es un equipo de iguales; nadie es líder de nadie. Las dudas se hacen **por escrito, en el issue**, nunca por chat privado.

- [ ] Leí el README, las [Normas de uso](../rules/) y la [Política de datos](../privacy/).

## 2. Tu cuenta de GitHub

1. Crea una cuenta en [github.com](https://github.com) si no tienes.
2. Activa la **verificación en dos pasos**: *Settings → Password and authentication → Two-factor authentication*.
3. Activa el **correo privado** para los commits, así no publicas tu correo personal: *Settings → Emails → Keep my email addresses private*. Copia la dirección que te muestra (termina en `@users.noreply.github.com`); la usas en el paso 4.

- [ ] Tengo cuenta, verificación en dos pasos y mi correo noreply.

## 3. Instalar las herramientas

| Herramienta | Windows | macOS / Linux |
|---|---|---|
| Git | [git-scm.com](https://git-scm.com/download/win) (trae Git Bash) | ya viene, o `brew install git` / `sudo apt install git` |
| Node.js 22 | [nvm-windows](https://github.com/coreybutler/nvm-windows) y luego `nvm install 22` | [nvm](https://github.com/nvm-sh/nvm) y luego `nvm install 22` |
| GitHub CLI | [cli.github.com](https://cli.github.com) | `brew install gh` / [instrucciones para Linux](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) |
| Editor | [VS Code](https://code.visualstudio.com) o el que prefieras | igual |

Comprueba las versiones:

```sh
git --version
node -v
npm -v
gh --version
```

**Deberías ver** algo así (los números pueden ser más nuevos; Node tiene que ser 22):

```
git version 2.54.0
v22.14.0
10.9.2
gh version 2.100.0
```

**Si falla:** "no se reconoce el comando" significa que la herramienta no quedó en el `PATH`. Cierra y vuelve a abrir la terminal; si sigue, reinstálala.

Inicia sesión en GitHub desde la terminal:

```sh
gh auth login
```

Elige *GitHub.com → HTTPS → Login with a web browser* y sigue las instrucciones.

- [ ] Las cuatro herramientas responden y `gh auth status` dice que iniciaste sesión.

## 4. Configurar Git

```sh
git config --global user.name "Tu nombre"
git config --global user.email "123456+tu-usuario@users.noreply.github.com"
```

Saltos de línea (importante para que los scripts funcionen en el servidor):

```sh
git config --global core.autocrlf true     # Windows
git config --global core.autocrlf input    # macOS y Linux
```

- [ ] `git config --global user.email` muestra tu correo noreply.

## 5. Traer el repositorio

**Si todavía no eres colaborador oficial** (lo normal al empezar), trabaja desde tu fork:

```sh
gh repo fork MarAntBQ/CallingSupportApp --clone
cd CallingSupportApp
git remote -v
```

**Deberías ver** dos remotos: `origin` es tu copia y `upstream` el original:

```
origin    https://github.com/<tu-usuario>/CallingSupportApp.git (fetch)
origin    https://github.com/<tu-usuario>/CallingSupportApp.git (push)
upstream  https://github.com/MarAntBQ/CallingSupportApp.git (fetch)
upstream  https://github.com/MarAntBQ/CallingSupportApp.git (push)
```

**Si eres colaborador oficial**, clona el original directamente: `git clone https://github.com/MarAntBQ/CallingSupportApp.git` (solo tendrás `origin`).

**Si falla:** si `gh repo fork` pide iniciar sesión, vuelve al paso 3 (`gh auth login`).

- [ ] Tengo el repositorio en mi computadora y `git remote -v` muestra lo esperado.

## 6. Ver el sitio en tu computadora

```sh
npm ci --prefix site
node site/build.mjs
node site/scripts/seo-check.mjs
npx serve _site
```

**Deberías ver:**

```
found 0 vulnerabilities
Sitio generado en _site/: 15 páginas, cada una con es, pt, en; 1 perfil(es), 2 novedad(es), 3 manual(es).
Sin problemas: títulos ≤ 60, descripciones 150–160, etiquetas únicas y JSON-LD válido.
```

Y `npx serve _site` te da una dirección (normalmente `http://localhost:3000`): ábrela en el navegador. Cada vez que cambies un texto, vuelve a correr `node site/build.mjs` y recarga.

Las pruebas del bot y de los perfiles:

```sh
node --test .github/scripts/claim-logic.test.cjs .github/scripts/team-profiles.test.cjs
```

**Deberías ver** `# pass 15` y `# fail 0`.

**Si falla:**
- `npm ci` falla → revisa que tengas Node 22 (`node -v`).
- El build dice "El sitio no se generó" → lee la lista que imprime debajo: dice el archivo y lo que falta.

- [ ] El sitio se ve en mi navegador y las pruebas pasan.

## 7. Levantar la aplicación

Necesitas **Docker** ([Docker Desktop](https://www.docker.com/products/docker-desktop/) en Windows y macOS, o Docker Engine en Linux) para la base de datos de desarrollo: un Postgres 17 con datos inventados.

```sh
nvm use                    # Node 22, desde .nvmrc
npm install
docker compose up -d
cp .env.example .env
npm run db:migrate
npm run dev
```

**Deberías ver:**
- `npm run db:migrate` termina sin errores (con la versión actual de drizzle-kit dice `migrations applied successfully!`);
- `npm run dev` muestra `Ready` y la dirección `http://localhost:3000`;
- `http://localhost:3000/api/health` responde `{"ok":true,"db":true}`, y la portada dice "En construcción".

Antes de abrir un PR, estos cuatro tienen que terminar sin errores:

```sh
npm run typecheck
npm run lint
npm run test
npm run build
```

**Si falla:**
- `/api/health` responde `{"ok":false,"db":false}` → la base no está arriba. Revisa `docker compose ps` (debe decir `healthy`) y que Docker Desktop esté abierto.
- `Falta DIRECT_DATABASE_URL` → no copiaste `.env.example` a `.env`.
- El puerto 5432 está ocupado → ya tienes otro Postgres. Cámbialo en `docker-compose.yml` (por ejemplo, `'5433:5432'`) y en las dos URL de `.env`.

## 8. Tu primer aporte, guiado: tu perfil en el equipo

Es el único aporte que **no necesita issue ni `/tomar`**, y te hace recorrer el flujo completo sin riesgo.

1. Trae lo último y crea tu rama:

   ```sh
   git switch main
   git pull upstream main          # colaboradores oficiales: git pull origin main
   git switch -c docs/perfil-<tu-usuario>
   ```

2. Crea `team/<tu-usuario>.md` copiando la plantilla de [team/README.md](https://github.com/MarAntBQ/CallingSupportApp/blob/main/team/README.md). Escribe dos a cuatro líneas sobre ti, **sin títulos de jerarquía** ("líder", "fundador", "creador"…) y sin datos sensibles (teléfono, dirección, correo).

3. Valídalo:

   ```sh
   node site/build.mjs
   ```

   **Deberías ver** `2 perfil(es)` (o uno más que antes) en la línea de "Sitio generado".

   **Si falla**, el build dice qué corregir. Por ejemplo:

   ```
   El sitio no se generó:
     team/tu-usuario.md: no se usan títulos de jerarquía ("líder"): en CSATeam todos somos colaboradores
   ```

4. Commit y push:

   ```sh
   git add team/<tu-usuario>.md
   git commit -m "docs: perfil de <tu-usuario> en el equipo"
   git push -u origin docs/perfil-<tu-usuario>
   ```

5. Abre el PR **en borrador con la plantilla completa**. GitHub la carga sola si lo abres desde el botón *Compare & pull request* de tu fork. Si eres colaborador oficial, ábrelo en el repositorio original comparando tu rama con `main`. Complétala: qué cambiaste, cómo probarlo y lo que verificaste (pega la línea del build).

6. Cuando esté listo, pásalo a *Ready for review*. Responde las observaciones de la revisión con commits nuevos en la misma rama. Entra a `main` por **squash**.

7. Después del merge:

   ```sh
   git switch main
   git pull upstream main          # colaboradores oficiales: git pull origin main
   git push origin main            # solo desde un fork: actualiza tu copia
   git branch -d docs/perfil-<tu-usuario>
   ```

- [ ] Mi perfil aparece en la página [Equipo](../team/).

## 9. De ahí en adelante, con cualquier issue

1. **Elige** un issue sin asignar, sin `en-progreso`, sin `bloqueado` ni `necesita-diseño`. Si es tu primera vez, busca `good first issue`. [Ver issues libres](https://github.com/MarAntBQ/CallingSupportApp/issues?q=is%3Aopen+is%3Aissue+no%3Aassignee+-label%3Abloqueado).
2. **Léelo completo.** Si algo no se entiende, pregúntalo **en el issue** antes de programar.
3. **Tómalo** comentando `/tomar` en el issue. El bot te lo asigna y le pone `en-progreso`. Funciona también desde un fork. **Un issue a la vez.**
4. **Rama:** `feat/<número>-titulo-corto` (o `fix`, `docs`, `chore`…), creada desde `main` actualizado (`git switch main` y `git pull upstream main`; los colaboradores oficiales, `git pull origin main`).
5. **PR en borrador dentro de las 48 horas**, con la plantilla completa y `Refs #<número>`.
6. **Verifica ejecutando:** el build, las pruebas y un recorrido real. En el PR se pega la salida, no un resumen.
7. **Revisa tu propio código** con la skill `revisar-codigo`, y si toca datos de personas, con `datos-de-miembros`.
8. **Pásalo a listo** con `Closes #<número>`.

## 10. Si te trabas o ya no puedes seguir

- **Pregunta en el issue**, con lo que intentaste y lo que salió.
- **Si no puedes seguir**, comenta `/soltar`: el issue queda libre para otra persona. No pasa nada.
- **Sin actividad:** a los 7 días el bot te recuerda el issue, y a los 14 lo libera.

## 11. Si usas inteligencia artificial

Puedes usar el asistente que prefieras:
- **Claude Code** lee `CLAUDE.md` (que importa `AGENTS.md`) y las skills de `.claude/skills/`. Pídele, por ejemplo: *"toma el issue #12 siguiendo la skill trabajar-un-issue"*.
- **Otros agentes** (Codex, Cursor, Copilot): dales `AGENTS.md` y el `SKILL.md` que corresponda.

**Lo que entregas es tu responsabilidad:** revisa y prueba todo lo que escriba el agente.

## 12. Lo que nunca se hace

- Push directo a `main`: todo entra por PR.
- Datos reales de personas en el repositorio, ni en pruebas, ni en capturas.
- Secretos o archivos `.env` en el repositorio.
- Inventar requisitos fuera del issue.
- Presentarte como líder, fundador o creador del proyecto.
- Correos o avisos con información confidencial: avisan y enlazan; el detalle va dentro de la aplicación.

## 13. Lista final antes de pedir revisión

- [ ] El issue está tomado con `/tomar` y es el único que tengo en curso.
- [ ] La rama sale de `main` actualizado y tiene el número del issue.
- [ ] El PR usa la plantilla completa, con `Closes #<número>`.
- [ ] Corrí el build y las pruebas, y pegué la salida.
- [ ] Revisé mi código con `revisar-codigo` (y `datos-de-miembros` si toca datos).
- [ ] Los textos nuevos están en español, portugués e inglés.
- [ ] No hay datos reales, secretos ni `.env`.
