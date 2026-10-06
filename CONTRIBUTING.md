# Cómo colaborar

Gracias por querer ayudar. Esta guía es todo lo que necesitas para tomar un issue y
entregarlo, aunque nunca hayas hablado con nadie del equipo.

**La regla que manda:** el [Manual General de la Iglesia](https://www.churchofjesuschrist.org/study/manual/general-handbook?lang=spa)
rige toda idea del proyecto. Si algo lo contradice, no se construye. Detalle en
[AGENTS.md](AGENTS.md#el-manual-general-manda).

Antes de empezar, lee el [README](README.md) (qué es el proyecto y cómo trata los datos de
los miembros) y [AGENTS.md](AGENTS.md) (stack, idioma, glosario y reglas del repositorio).

## Quién puede participar

**Cualquier persona, miembro o amiga de La Iglesia de Jesucristo de los Santos de los Últimos
Días, puede ayudar sin pedir permiso.** Haz un fork del repositorio, toma un issue libre
comentando `/tomar`, trabaja en tu fork y abre un PR. Si se aprueba, tu trabajo entra al
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

1. **Que alguien del equipo te invite.**
2. **Colaborar abiertamente:** después de varios PRs mergeados (como referencia, tres o más),
   el equipo te invita a participar.

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

## Instalación local

La guía para levantar el proyecto en tu máquina llega con el issue
[#4](../../issues/4) (esqueleto). Hasta entonces, ese es el issue por donde empieza todo,
seguido de [#5](../../issues/5) (idiomas).

## Reportar un problema o proponer una idea

- **Bug:** plantilla *Bug*, con pasos para reproducirlo.
- **Tarea concreta:** plantilla *Tarea*.
- **Idea de módulo nuevo:** plantilla *Propuesta de módulo*. Se diseña primero y después se
  divide en tareas.
