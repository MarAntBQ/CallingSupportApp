# Cómo colaborar

Gracias por querer ayudar. Esta guía es todo lo que necesitas para tomar un issue y
entregarlo, aunque nunca hayas hablado con nadie del equipo.

**¿Primera vez?** Sigue el [Manual del desarrollador](https://callingsupportapp.org/developers/) paso a paso: te lleva desde una
computadora sin nada instalado hasta tu primer PR mergeado.

**La regla que manda:** el [Manual General de la Iglesia](https://www.churchofjesuschrist.org/study/manual/general-handbook?lang=spa)
rige toda idea del proyecto. Si algo lo contradice, no se construye. Detalle en
[AGENTS.md](AGENTS.md#el-manual-general-manda).

Antes de empezar, lee el [README](README.md) (qué es el proyecto y cómo trata los datos de
los miembros) y [AGENTS.md](AGENTS.md) (stack, idioma, glosario y reglas del repositorio).

## Quién puede participar

**Cualquier persona, miembro o amigo de La Iglesia de Jesucristo de los Santos de los Últimos
Días, puede ayudar sin pedir permiso.** Haz un fork del repositorio, toma un issue libre
comentando `/tomar` (el bot también asigna a quien trabaja desde un fork), trabaja en tu fork y
abre un PR. Si se aprueba, tu trabajo entra al
proyecto. Las reglas son las mismas para todos, y también el
[código de conducta](https://callingsupportapp.org/conduct/).

## El recorrido

```
Issue  →  Rama  →  Pull Request  →  Revisión  →  Squash a main
```

`main` está protegida: nadie hace push directo, sin excepción. Todo entra por PR.

## Cómo nos organizamos: CSATeam

Lo hacemos entre todos como **CSATeam (Calling Support App Team)**. **Todos somos
colaboradores y ninguno es más que otro:** no hay creador, ni dueños, ni líderes del proyecto.

- **Cualquiera** propone (abre un issue), toma (`/tomar`), implementa y revisa (skill
  `revisar-codigo`).
- **Las decisiones se toman en los issues**, con argumentos y por escrito. Por encima de todo
  manda el [Manual General]({MG}).
- **"Mantenedor" es una función técnica, no un rango:** quien tiene permiso de escritura puede
  mergear y cambiar la configuración del repositorio. La lista está en
  [`.github/maintainers.json`](.github/maintainers.json) y puede crecer.
- **Las reglas son iguales para todos.** Nadie tiene excepciones: un issue a la vez, PR en
  borrador en 48 horas, revisión obligatoria.

## Cómo llegar a ser colaborador oficial

Ser **colaborador oficial** te da acceso de escritura al repositorio: puedes crear ramas en él
en vez de trabajar desde un fork. **No es un rango:** no te pone por encima de nadie y las
reglas siguen siendo las mismas para todos. Hay dos caminos:

1. **Que alguien del equipo proponga tu invitación.**
2. **Colaborar abiertamente:** después de varios PRs mergeados (como referencia, tres o más),
   alguien del equipo propone invitarte.

La invitación se propone **en público**, como toda decisión del proyecto:

1. Alguien del equipo abre un issue *Invitación al equipo: @usuario*, con el motivo (por
   ejemplo, los PRs mergeados).
2. Si en una semana nadie del equipo plantea una objeción fundada, quien tiene permisos de
   administración en GitHub envía la invitación.
3. La persona invitada la acepta y, si quiere, agrega su perfil en `team/`.

## Tu primer aporte: agrega tu perfil al equipo

Crea `team/<tu-usuario-de-github>.md` con la plantilla de [`team/README.md`](team/README.md) y
abre un PR solo con ese archivo. Es el **único aporte que no necesita issue ni `/tomar`**. Ahí
cuentas quién eres y cómo te gusta aportar, en tus palabras; sin títulos de jerarquía y sin
datos sensibles.

## 1. Elige un issue

**El repositorio coordina solo: no hace falta preguntarle a nadie.** Para saber si alguien ya
está trabajando en un issue, mira tres cosas: **a quién está asignado**, si tiene la etiqueta
**`en-progreso`** y el último comentario del bot.

Busca uno que:

- **no tenga a nadie asignado** ni la etiqueta `en-progreso`;
- **no tenga la etiqueta `bloqueado`** (sus dependencias están cerradas) ni `necesita-diseño`;
- idealmente tenga `good first issue` si es tu primera vez.

[Ver los issues libres](https://github.com/MarAntBQ/CallingSupportApp/issues?q=is%3Aopen+is%3Aissue+no%3Aassignee+-label%3Abloqueado+-label%3A%22necesita-dise%C3%B1o%22)

### Tomarlo: comenta `/tomar`

Escribe en el issue un comentario que empiece con **`/tomar`** (también sirven `/assumir` y
`/take`). Un bot revisa que esté libre y, si lo está, te lo asigna, le pone la etiqueta
`en-progreso` y te responde con los pasos. Si ya lo tiene alguien, te dice quién; si está
bloqueado, te dice por qué. **Nunca empieces a programar sin que el bot te haya confirmado.**

Reglas para que nadie trabaje dos veces en lo mismo:

1. **Un issue a la vez por persona.** Para tomar otro, termina o suelta el que tienes.
2. **Abre un PR en borrador con `Refs #<número>` dentro de las 48 horas**, aunque tenga poco.
   Así todos ven el avance.
3. **Comenta tus avances en el issue.** Si pasan **7 días sin actividad**, el bot te lo
   recuerda; a los **14 días** lo libera para que lo tome otra persona. Con un comentario como
   «sigo en esto» basta para seguir.
4. **Si no puedes seguir, comenta `/soltar`** (o `/liberar`, `/release`). No pasa nada: es
   mejor soltarlo que dejarlo detenido.
5. **Si encuentras un issue `en-progreso` que te interesa**, no empieces en paralelo: comenta
   en el issue para coordinar con quien lo tiene, o elige otro.

El orden recomendado está en los [milestones](../../milestones): primero **1 · Base**, que
crea el esqueleto sobre el que se construye todo lo demás. Cada issue dice en
*Dependencias* qué tiene que estar cerrado antes.

## 2. Asegúrate de que se entiende

Los issues de este repositorio **se autocontienen**: tienen que poder terminarse leyendo solo
el issue y los archivos que enlaza. Si algo falta o es ambiguo, **pregunta en el issue antes
de programar**. La respuesta se agrega al cuerpo del issue para el siguiente que lo lea.

Muchos issues portan funcionalidad de la primera versión, que vive completa en la rama
[`legacy`](../../tree/legacy). La skill `portar-desde-legacy` explica cómo leerla.

## 3. Crea tu rama

**Si eres colaborador oficial** (tienes permiso de escritura), trabaja en una rama del propio
repositorio:

```sh
git clone https://github.com/MarAntBQ/CallingSupportApp.git
cd CallingSupportApp
git switch -c feat/<número>-titulo-corto
```

**Si todavía no lo eres** (la forma normal de empezar), trabaja desde tu fork:

```sh
gh repo fork MarAntBQ/CallingSupportApp --clone   # o "Fork" en GitHub y git clone de tu copia
cd CallingSupportApp
git remote -v                                     # origin = tu fork, upstream = el original
git switch -c feat/<número>-titulo-corto
```

Antes de empezar y antes de abrir el PR, trae lo último de `main`:

```sh
git fetch upstream            # colaboradores: git fetch origin
git rebase upstream/main      # colaboradores: git rebase origin/main
```

Tipos de rama: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`.

## 4. Trabaja dentro del alcance

Haz lo que pide el issue, ni más ni menos. Si encuentras otro problema, abre un issue nuevo
con la plantilla y sigue con el tuyo.

Commits en español, con tipo: `feat: inscripción pública con cupos`. **No agregues líneas de
co-autoría de herramientas de IA.**

## 5. Verifica ejecutando

Typecheck, lint, build, pruebas, y un recorrido real del flujo en el navegador (escritorio y
teléfono si tocaste la interfaz). Guarda el output: va pegado en el PR.

## 6. Revisa tu propio código

**Obligatorio:** antes de abrir el PR, revisa tu diff con la skill
[`revisar-codigo`](.claude/skills/revisar-codigo/SKILL.md). Si el cambio toca datos de
personas, también con [`datos-de-miembros`](.claude/skills/datos-de-miembros/SKILL.md).

## 7. Abre el PR

Llena la plantilla completa: `Closes #<número>`, cómo probar, la verificación con su output y
la revisión. Marca solo lo que de verdad corriste; lo que no aplique, N/A con el motivo.

## 8. Revisión y merge

Responde cada comentario con la corrección o con la evidencia de por qué no aplica, y
resuelve las conversaciones. El merge lo hace alguien que mantiene el repositorio, siempre por
**squash**: un issue, un PR, un commit en `main`.

## Si usas IA

Puedes usar el asistente que prefieras. Las reglas y las skills del repositorio están
escritas para que los agentes las sigan:

- **Claude Code** carga solo `CLAUDE.md` (que importa `AGENTS.md`) y las skills de
  `.claude/skills/`. Pídele, por ejemplo: *"toma el issue #12 siguiendo la skill
  trabajar-un-issue"*.
- **Otros agentes** (Codex, Cursor, Copilot): dales `AGENTS.md` y el `SKILL.md` que corresponda.

Lo que entregas es tu responsabilidad: revisa y prueba todo lo que el agente escriba.

Las tres skills base (`trabajar-un-issue`, `escribir-un-issue`, `revisar-codigo`) se sincronizan automáticamente desde el directorio oficial `MarbustTechnologyCompany/ClaudeSkills` (workflow `sync-skills`) y **no se editan a mano**: una mejora se hace en el oficial y se propaga por un PR. Las skills de dominio (`datos-de-miembros`, `portar-desde-legacy`) son propias de este repo y no se sincronizan.

## Datos de los miembros

**Rige el Manual General de la Iglesia, 33.8 "Carácter confidencial de los registros":** la
información de los miembros se limita a lo necesario, se usa solo para el propósito aprobado,
se entrega solo a quien está autorizado y nunca se usa para fines personales, políticos ni
comerciales, ni para estudios o encuestas. Ver [AGENTS.md](AGENTS.md#la-regla-que-manda-los-datos-de-los-miembros).

Este repositorio es **público**. Nunca subas datos reales de personas: ni en el código, ni en
seeds, ni en pruebas, ni en capturas de pantalla, ni en issues. Los datos de prueba son
inventados. Detalle completo en la skill `datos-de-miembros`.

## Idiomas

La aplicación es **trilingüe: español, portugués e inglés**, porque la usan unidades de
varios países. Ningún texto visible se escribe dentro de un componente: va en
`messages/es.json`, `pt.json` y `en.json`. Los issues traen los textos en español; tú agregas
el portugués y el inglés usando el glosario de [AGENTS.md](AGENTS.md#idiomas).

**Los tres idiomas van completos en tu PR** y `npm run i18n:check` tiene que pasar. Si no
dominas alguno, tradúcelo con la herramienta que prefieras respetando el glosario, y anota
en el PR qué textos conviene que revise un hablante nativo.

**Cómo agregar un texto:**

1. Agrega la clave en `messages/es.json`, dentro del área que corresponda (`common`, `home`,
   `admin`, `templeTrips`…). Crea un área nueva si tu módulo todavía no tiene una.
2. Agrega **la misma clave** en `pt.json` y `en.json`.
3. Úsala con `t(clave)`:
   - en un Server Component, `const t = await getTranslations(area)` (de `next-intl/server`);
   - en un Client Component, `const t = useTranslations(area)` (de `next-intl`).
4. Para variables y plurales usa el formato ICU:
   `"slots": "{count, plural, one {# cupo} other {# cupos}}"` → `t(slots, { count: 3 })`.
5. Corre `npm run i18n:check`. Si falta o sobra una clave en algún idioma, la nombra y termina
   con error; la misma comprobación corre dentro de `npm run test`.

TypeScript conoce las claves de `es.json`: si escribes una que no existe, `npm run typecheck`
falla. Para fechas, números y dinero usa `formatDate`, `formatNumber` y `formatMoney` de
`src/lib/format.ts`, con el idioma activo (`useLocale()` o `getLocale()`).

## Colores y estilos

El sistema de diseño está en [DESIGN.md](DESIGN.md): qué color usar para qué, la tipografía y
los patrones de las pantallas (tablas, formularios, avisos). Los valores viven en
`src/app/globals.css`.

- Usa los tokens con sus clases de Tailwind: `bg-surface`, `text-text-muted`, `text-primary`,
  `border-border`.
- Para un texto de color usa la variante `-strong` (`text-danger-strong`): las versiones vivas no
  alcanzan el contraste mínimo para leer.
- No escribas colores sueltos (`#…`, `rgb(…)`) en los componentes ni uses la paleta por defecto
  de Tailwind (`text-red-500`). Si necesitas un color nuevo, agrégalo primero a `globals.css` y a
  `DESIGN.md`. `npm run test` falla si encuentra un color fuera de `globals.css` o un texto
  sin el contraste mínimo.

## Instalación local

Necesitas Node 22 (`.nvmrc`) y Docker. Desde la raíz del repositorio:

```sh
npm install
docker compose up -d
cp .env.example .env
npm run db:migrate
npm run dev
```

Abre `http://localhost:3000/api/health`: debe responder `{"ok":true,"db":true}`. La base de
desarrollo es un Postgres 17 en Docker, con datos inventados; nunca uses datos reales.

Antes de abrir un PR, todo esto tiene que terminar sin errores:

```sh
npm run typecheck
npm run lint
npm run test
npm run build
```

**Pruebas con base de datos.** Las pruebas que hablan con Postgres (por ejemplo, las del inicio
de sesión) se saltan si no existe `TEST_DATABASE_URL`. Si copiaste `.env.example` a `.env`, ya
la tienes: `npm run test` lee `.env` y la base `csa_test` la crea Docker la primera vez que
levanta el contenedor. (Si tu contenedor es anterior a este cambio, créala una vez con
`docker compose exec db createdb -U callingsupportapp csa_test`.)

Esa base se **vacía** en cada corrida, por eso su nombre tiene que contener `test`: la prueba se
niega a correr contra otra base.

**Correo de pruebas (Mailpit).** `docker compose up -d` levanta también Mailpit, un servidor SMTP
que **no entrega nada**: guarda cada correo para que lo veas en `http://localhost:8025`. Para
probar el correo:

1. En `.env`, pon una `ENC_KEY` (`openssl rand -hex 32`); con ella se cifra la contraseña SMTP.
2. En la app, entra a **Configuración → Correo (SMTP)**: servidor `localhost`, puerto `1025`, sin
   TLS, usuario `avisos@example.com` y cualquier contraseña.
3. "Enviar correo de prueba" y ábrelo en `http://localhost:8025`. Nunca uses un SMTP real para
   probar.

Con `npm run dev` funciona tal cual. Con un build de producción (`npm run build` y `npm run start`),
agrega `SMTP_ALLOW_PRIVATE_HOSTS=true` en `.env`: en producción la app no se conecta a servidores con
dirección interna, y `localhost` lo es.

**Pruebas de punta a punta (E2E).** Recorren en un navegador real los flujos críticos: `/setup`,
inicio y cierre de sesión, redirecciones de `/admin`, Configuración, los tres idiomas y el ancho
de un teléfono. Corren en el job `e2e` de cada PR. Para correrlas en tu máquina necesitas una base
**vacía** (el primer paso crea el primer administrador) y el build de producción:

```sh
docker compose exec db createdb -U callingsupportapp csa_e2e
export DATABASE_URL=postgres://callingsupportapp:callingsupportapp@localhost:5432/csa_e2e
DIRECT_DATABASE_URL=$DATABASE_URL npm run db:migrate
npm run build
npx playwright install chromium
npm run test:e2e
```

Para repetirlas, borra y vuelve a crear `csa_e2e` (`dropdb` y `createdb`). Si una falla, el
*trace* queda en `test-results/` (`npx playwright show-trace …/trace.zip`).

El paso a paso con lo que deberías ver y qué hacer si algo falla está en el
[Manual del desarrollador](https://callingsupportapp.org/developers/).

## Ambientes

El proyecto tiene tres ambientes, todos bajo `callingsupportapp.org` y alojados en el VPS del equipo:

| Ambiente | Dominio | Qué publica |
|---|---|---|
| Documentación | callingsupportapp.org | El sitio de `site/`. |
| Staging | staging.callingsupportapp.org | La app tal como está en `main`, en cada merge. |
| Demo pública | demo.callingsupportapp.org | Solo versiones etiquetadas `v*`. |

La variable `APP_ENV` (`development` | `staging` | `demo` | `production`) distingue el ambiente: en `staging` y `demo` se muestra el banner «los datos son inventados» y el `robots.txt` bloquea el rastreo. **Staging y demo solo llevan datos inventados** (semilla `npm run db:seed:demo`); nunca datos reales de personas. Las credenciales de acceso a staging se comparten por mensaje privado, nunca en el repo ni en un issue.

Detrás de un proxy que no pasa el host público (staging y demo en el VPS), el `.env` de la app necesita `APP_ORIGINS` con su dirección pública (`https://staging.callingsupportapp.org`, `https://demo.callingsupportapp.org`). Sin esa variable, la app rechaza todo `POST` del navegador, incluido el inicio de sesión, con `403 bad_origin` (#157).

La app es Next.js SSR: en el VPS corre como un proceso Node (`next build` + un `server.js` propio que escucha en el socket que asigna MBHostCloud) bajo pm2, detrás de Apache, y se despliega sola por GitHub Actions (staging en cada merge a `main`; demo al etiquetar `v*`).

## Reportar un problema o proponer una idea

- **Bug:** plantilla *Bug*, con pasos para reproducirlo.
- **Tarea concreta:** plantilla *Tarea*.
- **Idea de módulo nuevo:** plantilla *Propuesta de módulo*. Se diseña primero y después se
  divide en tareas.
