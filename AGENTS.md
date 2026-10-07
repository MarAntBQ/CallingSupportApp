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
src/components/          componentes de interfaz compartidos
src/i18n/                configuración de idiomas (next-intl)
messages/                textos de la interfaz: es.json, pt.json, en.json
DESIGN.md                sistema de diseño: colores, tipografía y patrones de pantalla
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
| Costo estimado (referencial) | Custo estimado | estimated cost |
| Aporte sugerido | Contribuição sugerida | suggested contribution |
| Categoría de donativo | Categoria de doação | donation category |
| Habitación | Quarto | room |
| Campamento | Acampamento | camp |
| Grupo de EnglishConnect / maestro / estudiante | Grupo do EnglishConnect / professor / aluno | EnglishConnect group / teacher / student |

## El Manual General manda

CallingSupportApp es una herramienta al servicio de las unidades de la Iglesia, no un lugar
para inventar prácticas nuevas. **Toda idea, módulo, flujo y texto debe estar de acuerdo con
el [Manual General](https://www.churchofjesuschrist.org/study/manual/general-handbook?lang=spa)** ("Servir en La Iglesia de Jesucristo de los Santos de los Últimos
Días").

- **Si algo contradice el Manual, no se construye**, aunque sea útil o alguien lo pida.
- **Si el Manual no regula algo**, se dice explícitamente ("el Manual no regula X") y la
  decisión queda como decisión del proyecto, sin atribuírsela al Manual.
- **Al citar el Manual:** texto literal, número de sección y enlace. Nunca se le atribuye algo
  que no dice.
- Cada módulo deja escrito, en su issue, qué secciones del Manual lo rigen y cómo las cumple.
- **La app no maneja dinero de los miembros** ([capítulo 34 "Finanzas y auditorías"](https://www.churchofjesuschrist.org/study/manual/general-handbook/34-finances-and-audits?lang=spa)):
  - 34.5.2: «Solo el obispo y sus consejeros pueden recibir los diezmos y las otras ofrendas.»
  - 34.4: «El monto que un donante pague de diezmo y de otras ofrendas es confidencial.»
  - 34.3: «Se alienta a los miembros a que, donde sea posible, hagan sus contribuciones en línea»
    (o con el formulario de Diezmo y otras ofrendas entregado al obispo o a uno de sus consejeros).
  - 34.3.4: «Las estacas y los barrios no deben establecer categorías […] para proyectos que no
    estén aprobados por la Presidencia de Área».
  - 34.6.2.2: «Por lo general, los miembros no deben tener que pagar para participar en las
    actividades».

  Por eso no hay abonos, pagos, cobradores, saldos ni donativos registrados: solo costos
  estimados y las instrucciones para donar en la categoría que el obispado ya tenga autorizada
  (la app no crea categorías), en línea o con el formulario. Participar no depende de pagar.

Orden de las reglas: **1)** el Manual General en todo; **2)** dentro de él, para los datos de
los miembros, el 33.8 (sección siguiente); **3)** las reglas técnicas de este archivo.

## CSATeam: un equipo de iguales

El proyecto es de **CSATeam (Calling Support App Team)**: todos somos colaboradores y ninguno
es más que otro. En el repositorio, el sitio, los issues y los PRs **no se escribe "creador",
"autor del proyecto", "fundador" ni "líder"** para referirse a una persona del equipo
(cuando se habla de los líderes de una unidad de la Iglesia, sí). "Mantenedor" es solo la
función técnica de mergear ([`.github/maintainers.json`](.github/maintainers.json)). Ninguna
regla tiene excepciones por persona. Cada colaborador escribe su propio perfil en
[`team/`](team/README.md). **Cualquier miembro o amigo de la Iglesia puede participar** con un
fork y un PR, sin pedir permiso. Se llega a **colaborador oficial** (acceso de escritura, no un
rango) cuando alguien del equipo propone invitarte, o después de varios PRs mergeados; el
procedimiento está en [CONTRIBUTING.md](CONTRIBUTING.md#cómo-llegar-a-ser-colaborador-oficial).

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

1. **El Manual General manda** sobre toda idea; para los datos de los miembros, el **33.8**
   (secciones anteriores). Nunca importar listados de los sistemas oficiales de la Iglesia. Todo cambio que toque datos de personas pasa por la
   skill `datos-de-miembros`. Si una funcionalidad choca con el Manual, no se construye.
2. **Flujo:** issue → `/tomar` → rama → PR en borrador → pull request → squash. `main` está
   protegida: nadie hace push directo, sin excepción. **Un issue se toma
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
10. **Recursos en línea en los llamamientos (Manual General 38.8.24.2)** —
   [pautas oficiales](https://www.churchofjesuschrist.org/tools/help/use-of-online-resources-in-church-callings?lang=spa). Cada instalación necesita **la aprobación previa del
   obispo**, **al menos dos administradores**, un **contacto visible** y el **aviso de que no es
   oficial**; nunca el logotipo ni el nombre oficial de la Iglesia. Ningún módulo **duplica
   Herramientas para Miembros** ni LaIglesiadeJesucristo.org. **Los correos y las descripciones
   de calendario nunca llevan información confidencial ni delicada:** avisan y enlazan; el
   detalle se ve dentro de la aplicación. Sin publicidad. Cuando un barrio deja de usarla, se da
   de baja con borrado de datos.
11. **Commits** con tipo (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`) y en
   español. **Prohibido** agregar líneas de co-autoría de herramientas de IA.
12. **Nada de estado escrito a mano** en el README ni en el sitio ("ya está", "lo siguiente",
   "hoy muestra"): se queda viejo con el primer issue que se cierra. El avance lo muestran los
   badges en vivo (etiquetas `módulo:*` y milestones) y la página de Novedades del sitio, que
   se arma con los PR mergeados (#99).

## Seguridad (regla dura)

Una API donde "cualquiera puede hacer peticiones" casi siempre es una ruta nueva que se olvidó de
verificar la sesión. Por eso la protección se aplica **por defecto** y una prueba lo comprueba:

- **Toda ruta (`route.ts`) exporta sus métodos envueltos:** `export const GET = withAuth(handler, { permission })`
  o, si es pública a propósito, `publicRoute(handler, { reason: 'por qué es pública' })`. Una función
  exportada sin envoltorio hace fallar `npm run test` (`src/server/security/routes.test.ts`).
- **Toda Server Action** se define con `authedAction(schema, { permission }, fn)`: aunque se llame desde
  un formulario, cualquiera puede invocarla con una petición HTTP.
- **El `proxy.ts` no es una barrera de seguridad** (ya hubo una forma de saltárselo, CVE-2025-29927): la
  verificación real ocurre en cada handler, acción y layout del panel.
- **CSRF:** `withAuth` y `publicRoute` rechazan con 403 todo método que no sea GET/HEAD cuyo `Origin`
  no sea el del sitio.
- **Todo `body`, `params` y `searchParams` pasa por Zod** antes de usarse, y cada consulta filtra por el
  permiso del usuario (nadie lee el registro de otro cambiando un ID en la URL).
- **Errores:** la API responde `{ error: "internal_error", id }`; nunca trazas ni mensajes de la base.
  Los logs llevan el `id` y el tipo de error, **nunca datos de personas** (ni correos, ni nombres, ni cuerpos).
- Límite de intentos con `src/server/security/rate-limit.ts` en todo formulario público o de inicio de sesión.

Detalle y checklist en [SECURITY.md](SECURITY.md#cómo-se-protege-la-aplicación).

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
- **Cursor de mano en todo lo interactivo** (botones, enlaces, selectores, casillas, radios y
  sus etiquetas) y "no permitido" en lo deshabilitado. Lo pone la regla global de
  `src/app/globals.css` (`@layer base`), cuidada por `src/app/interaction-cursor.test.ts`. Un
  elemento interactivo que no sea uno de esos (un `div` clickeable) es un error: usa un
  `button`.

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
