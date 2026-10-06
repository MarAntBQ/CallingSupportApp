# Cómo colaborar

Gracias por querer ayudar. Esta guía es todo lo que necesitas para tomar un issue y
entregarlo, aunque nunca hayas hablado con el autor del proyecto.

Antes de empezar, lee el [README](README.md) (qué es el proyecto y cómo trata los datos de
los miembros) y [AGENTS.md](AGENTS.md) (stack, idioma, glosario y reglas del repositorio).

## El recorrido

```
Issue  →  Rama  →  Pull Request  →  Revisión  →  Squash a main
```

`main` está protegida: nadie hace push directo, tampoco el autor. Todo entra por PR.

## 1. Elige un issue

En [Issues](../../issues), busca uno que:

- **no tenga a nadie asignado**,
- **no tenga la etiqueta `bloqueado`** (sus dependencias están cerradas),
- idealmente tenga `good first issue` si es tu primera vez.

Comenta **"Lo tomo"** y asígnatelo. Un issue a la vez.

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

**Si eres colaborador del repositorio** (tienes permiso de escritura), trabaja en una rama
del propio repositorio:

```sh
git clone https://github.com/MarAntBQ/CallingSupportApp.git
cd CallingSupportApp
git switch -c feat/<número>-titulo-corto
```

**Si no lo eres**, trabaja desde tu fork:

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
resuelve las conversaciones. El merge lo hace el responsable del repositorio, siempre por
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
