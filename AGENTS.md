# Reglas del repositorio

Este archivo es para **todas las personas y agentes de IA** que trabajan en el repositorio
(Claude Code, Codex, Cursor, Copilot u otros). Si usas Claude Code, se carga solo a través
de `CLAUDE.md`. Qué es el proyecto y por qué existe: ver [README](README.md). Cómo colaborar
paso a paso: ver [CONTRIBUTING](CONTRIBUTING.md).

## Stack (decidido, no se vuelve a discutir dentro de un PR)

| Pieza | Elección |
|---|---|
| Aplicación | **Next.js** (App Router) + TypeScript, un solo proyecto para frontend y API |
| Base de datos | **Postgres**. En producción, Supabase; en desarrollo, cualquier Postgres local |
| ORM y migraciones | **Drizzle ORM** + `drizzle-kit`. El esquema cambia **solo** por migraciones |
| Acceso a datos | **Solo desde el servidor** (Route Handlers, Server Components, Server Actions). El navegador nunca habla con la base |
| Autenticación | Propia: sesiones guardadas en la base + cookie `httpOnly`, contraseñas con bcrypt, códigos OTP por correo, sesiones revocables |
| Validación | **Zod**, el mismo esquema en el formulario y en el servidor |
| Interfaz | React 19, Tailwind CSS v4, React Hook Form, TanStack Query |
| Idiomas | **next-intl**, con tres idiomas: español (`es`), portugués (`pt`) e inglés (`en`) |
| Avisos | Correo por SMTP (configurable desde la app) y bot de Telegram por **webhook** |
| Tareas diarias | Vercel Cron (purga por retención, mantenimiento) |
| Despliegue | Vercel + Supabase, plan gratuito. **Una instalación por barrio** |

Estructura de carpetas prevista (la crea el issue del esqueleto):

```
src/app/(public)/        páginas públicas (inscripciones, política de datos)
src/app/(admin)/         panel de administración, requiere sesión
src/app/api/<módulo>/    Route Handlers
src/server/db/schema/    tablas de Drizzle, un archivo por módulo
src/server/<módulo>/     lógica de negocio y permisos del módulo
src/lib/                 utilidades compartidas con el cliente
drizzle/                 migraciones generadas
```

## Idiomas

El proyecto es para miembros de la Iglesia en varios países, así que **la aplicación es
trilingüe: español, portugués e inglés.**

- **Ningún texto visible queda escrito en el código.** Textos, mensajes de error, correos y
  avisos de Telegram salen de `messages/es.json`, `messages/pt.json` y `messages/en.json`.
- **Todo PR que agrega o cambia un texto lo hace en los tres archivos.** El español es el
  idioma de origen. La revisión rechaza claves faltantes y la prueba de idiomas falla si
  falta una.
- **Cómo se elige el idioma:**
  1. el que eligió el usuario con sesión;
  2. si no hay sesión, el que se eligió en el selector (se guarda en una cookie);
  3. si tampoco, el idioma por defecto de la instalación (Configuración).

  No se detecta el idioma del navegador y las URLs no llevan prefijo de idioma.
- **Selector de idioma** en el menú del panel y en las páginas públicas.
- **Correos y avisos** van en el idioma de quien los recibe: el de su usuario, o el que se
  usó al inscribirse.
- Fechas, números y moneda con `Intl`, según el idioma activo.
- **Código en inglés:** nombres de archivos, tablas, columnas, funciones y variables.
- **Rutas y URLs en inglés:** `/temple-trips`, no `/viajes-templo`.
- Issues, PRs y commits en español.

Glosario para nombrar las cosas igual en el código y en las traducciones:

| Español | Português | English (código) |
|---|---|---|
| Barrio / rama / unidad | Ala / ramo / unidade | ward / branch / unit |
| Organización | Organização | organization |
| Llamamiento | Chamado | calling |
| Permiso por módulo | Permissão por módulo | module permission |
| Viaje para Adorar en el Templo | Viagem ao Templo | temple trip |
| Inscripción | Inscrição | registration |
| Participante | Participante | participant |
| Ordenanza (bautismo, iniciatoria, investidura, sellamiento) | Ordenança (batismo, iniciatória, investidura, selamento) | ordinance (baptism, initiatory, endowment, sealing) |
| Cupo | Vaga | quota / slot |
| Abono | Pagamento | payment |
| Cobrador | Recebedor | collector |
| Habitación | Quarto | room |
| Campamento | Acampamento | camp |
| Grupo de EnglishConnect / maestro / estudiante | Grupo do EnglishConnect / professor / aluno | EnglishConnect group / teacher / student |

## La regla que manda: los datos de los miembros

Por encima de cualquier conveniencia técnica, los datos de los miembros se rigen por el
**Manual General de la Iglesia, 33.8 "Carácter confidencial de los registros"**
([fuente](https://www.churchofjesuschrist.org/study/manual/general-handbook/33-records-and-reports?lang=spa)).
Los líderes se aseguran de que la información que se recabe de los miembros:

> - «Se limite a lo que la Iglesia requiere.»
> - «Se utilice solo para los propósitos aprobados de la Iglesia.»
> - «Se entregue únicamente a las personas que estén autorizadas a utilizarla.»

Y de que esos datos **«no se empleen para objetivos personales, políticos ni comerciales»**.
Además: «No se debe dar información de los registros de la Iglesia, incluida la información
histórica, a ninguna persona ni agencia que lleve a cabo estudios de investigación o
encuestas».

En este código eso significa:

1. **Solo lo necesario.** Cada campo se justifica con un uso concreto de la actividad.
2. **Solo para el propósito aprobado.** Un dato se usa únicamente en la actividad para la que
   se entregó. Nunca se cruza entre módulos, nunca se reutiliza para otra cosa y nunca se usa
   para fines personales, políticos ni comerciales.
3. **Solo para quien está autorizado.** Cada lectura, exportación, impresión y aviso pasa por
   el permiso del módulo en el servidor.
4. **Nunca para estudios ni encuestas.** No se comparten datos con terceros, no hay analítica
   que envíe datos de personas y no se exportan datos para investigaciones.

La sección **33.9** agrega el cómo: proteger contra acceso, cambios, destrucción o divulgación
no autorizados; cada persona con su propia cuenta y sin compartir contraseñas; verificación en
dos pasos; nada de datos en computadoras compartidas; conservar solo lo necesario; y destruir
de forma irrecuperable. **Decisión del proyecto** para cumplir esto último: la purga hace
borrado físico (`DELETE`), sin borrado lógico ni papelera. Detalle y lista para el PR: skill
[`datos-de-miembros`](.claude/skills/datos-de-miembros/SKILL.md).

## Reglas duras

1. **Datos de miembros: Manual General 33.8** (sección anterior). Nunca importar listados de
   los sistemas oficiales de la Iglesia. Todo cambio que toque datos de personas pasa por la
   skill `datos-de-miembros`. Si una funcionalidad choca con el Manual, no se construye.
2. **Flujo:** issue → `/tomar` → rama → PR en borrador → pull request → squash. `main` está
   protegida: nadie hace push directo, tampoco el autor del proyecto. **Un issue se toma
   comentando `/tomar`** (el bot lo asigna y le pone `en-progreso`); un issue a la vez por
   persona; PR en borrador dentro de las 48 horas; `/soltar` si no se puede seguir. Nunca
   trabajar en un issue asignado a otra persona.
3. **El issue se autocontiene.** Si algo no está en el issue, se pide en el issue antes de
   programar, y el issue se corrige. Ver skill `escribir-un-issue`.
4. **Revisión obligatoria.** Antes de abrir un PR, corre la skill `revisar-codigo` sobre tu
   propio diff. Al revisar el PR de otra persona, usa la misma skill.
5. **Nada fijo de un barrio** en el código: nombre, logo, responsable de los datos y textos
   salen de la configuración de la instalación.
6. **Trilingüe siempre.** Ningún texto visible queda escrito en el código, y cada texto
   existe en español, portugués e inglés.
7. **Nada sensible en el repositorio:** ni `.env`, ni secretos, ni datos o capturas de
   personas reales. Las variables nuevas se documentan en `.env.example`.
8. **Verificar ejecutando, no leyendo.** Typecheck, lint, build, pruebas y un recorrido real
   del flujo. En el PR se pega el output, no un resumen.
9. **Correos siempre en minúsculas** al guardar y al buscar. En la v1 funcionaba solo porque
   MySQL ignora mayúsculas; Postgres no.
10. **Commits** con tipo (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`) y en
   español. **Prohibido** agregar líneas de co-autoría de herramientas de IA.

## Reglas de interfaz

- **Tablas de datos:** siempre con ordenamiento, búsqueda y paginación.
- **Modales:** título fijo arriba, botones fijos abajo y **solo el contenido** con scroll.
  Nunca scroll en todo el contenedor.

  ```tsx
  <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-lg">
    <div className="shrink-0 border-b px-6 py-4">{/* título */}</div>
    <div className="flex-1 overflow-y-auto px-6 py-5">{/* contenido */}</div>
    <div className="shrink-0 border-t px-6 py-4">{/* botones */}</div>
  </div>
  ```

- **Móvil primero:** todo formulario público se prueba en un teléfono, sin zoom ni
  desborde horizontal.

## Skills del repositorio

Viven en [`.claude/skills/`](.claude/skills). Claude Code las carga solas; con otros agentes,
pásale el `SKILL.md` correspondiente.

| Skill | Cuándo se usa |
|---|---|
| [`trabajar-un-issue`](.claude/skills/trabajar-un-issue/SKILL.md) | Al tomar un issue, de principio a fin |
| [`escribir-un-issue`](.claude/skills/escribir-un-issue/SKILL.md) | Al crear o corregir un issue |
| [`revisar-codigo`](.claude/skills/revisar-codigo/SKILL.md) | **Obligatoria** antes de abrir un PR y al revisar el de otro |
| [`datos-de-miembros`](.claude/skills/datos-de-miembros/SKILL.md) | Al recoger, guardar, mostrar o exportar datos de personas |
| [`portar-desde-legacy`](.claude/skills/portar-desde-legacy/SKILL.md) | Al llevar una función de la v1 (rama `legacy`) a la versión nueva |
