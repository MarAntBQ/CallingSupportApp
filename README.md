# CallingSupportApp

[![CI](https://github.com/MarAntBQ/CallingSupportApp/actions/workflows/ci.yml/badge.svg)](https://github.com/MarAntBQ/CallingSupportApp/actions/workflows/ci.yml)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-7C3AED.svg)](LICENSE)
[![Sitio de documentación](https://github.com/MarAntBQ/CallingSupportApp/actions/workflows/deploy-site.yml/badge.svg)](https://github.com/MarAntBQ/CallingSupportApp/actions/workflows/deploy-site.yml)
[![Probar la demo](https://img.shields.io/badge/probar-la%20demo-7C3AED.svg)](https://demo.callingsupportapp.org)
[![Documentación](https://img.shields.io/badge/docs-callingsupportapp.org-57534E.svg)](https://callingsupportapp.org)

Aplicación open source para apoyar la administración de un barrio o rama: usuarios,
organizaciones, llamamientos con permisos por módulo, y módulos de actividades como el
**Viaje para Adorar en el Templo**, el **campamento** o las clases de **EnglishConnect**.

> **No es un sitio oficial** de La Iglesia de Jesucristo de los Santos de los Últimos Días.
> Es una herramienta comunitaria. La información oficial está en
> [churchofjesuschrist.org](https://www.churchofjesuschrist.org).

## Pruébala

| Ambiente | Qué muestra | Se actualiza |
|---|---|---|
| [**Demo**](https://demo.callingsupportapp.org) | La última versión publicada, para conocer la aplicación | Al publicar una versión (`v*`, [#51](../../issues/51)) |
| [**Staging**](https://staging.callingsupportapp.org) | Lo último de `main`, para probar los cambios | Solo, en cada merge |

Las dos usan **datos inventados** y cada una tiene su propia base. **No escribas datos reales en ellas.**

## Qué es y qué no es

**No reemplaza a Herramientas para Miembros**
([Member Tools](https://play.google.com/store/apps/details?id=org.lds.ldstools)), la
aplicación oficial de la Iglesia. Directorio, calendario, llamamientos y ministración siguen
viviendo ahí.

El objetivo de este proyecto es **agregar lo que las herramientas oficiales no ofrecen**: organizar
una actividad de principio a fin, con sus inscripciones, cupos, costos estimados y listados, sin hojas
de cálculo sueltas ni grupos de chat.

## Módulos

| Módulo | Qué resuelve | Avance |
|---|---|---|
| Usuarios, organizaciones y llamamientos | Quién entra a la aplicación y qué puede ver o hacer en cada módulo, según su llamamiento | [![Usuarios, organizaciones y llamamientos: issues listos](https://img.shields.io/github/issues-search?query=repo%3AMarAntBQ%2FCallingSupportApp%20is%3Aissue%20is%3Aclosed%20label%3A%22m%C3%B3dulo%3Ausuarios%22&label=listos&color=15803d)](../../issues?q=is%3Aissue%20is%3Aclosed%20label%3A%22m%C3%B3dulo%3Ausuarios%22) [![Usuarios, organizaciones y llamamientos: issues pendientes](https://img.shields.io/github/issues-search?query=repo%3AMarAntBQ%2FCallingSupportApp%20is%3Aissue%20is%3Aopen%20label%3A%22m%C3%B3dulo%3Ausuarios%22&label=pendientes&color=b45309)](../../issues?q=is%3Aissue%20is%3Aopen%20label%3A%22m%C3%B3dulo%3Ausuarios%22) |
| Viaje para Adorar en el Templo | Inscripción pública, cupos por ordenanza y género, transporte y hospedaje, costo estimado y cómo contribuir (la app no maneja dinero), habitaciones, listados imprimibles | [![Viaje para Adorar en el Templo: issues listos](https://img.shields.io/github/issues-search?query=repo%3AMarAntBQ%2FCallingSupportApp%20is%3Aissue%20is%3Aclosed%20label%3A%22m%C3%B3dulo%3Aviaje-templo%22&label=listos&color=15803d)](../../issues?q=is%3Aissue%20is%3Aclosed%20label%3A%22m%C3%B3dulo%3Aviaje-templo%22) [![Viaje para Adorar en el Templo: issues pendientes](https://img.shields.io/github/issues-search?query=repo%3AMarAntBQ%2FCallingSupportApp%20is%3Aissue%20is%3Aopen%20label%3A%22m%C3%B3dulo%3Aviaje-templo%22&label=pendientes&color=b45309)](../../issues?q=is%3Aissue%20is%3Aopen%20label%3A%22m%C3%B3dulo%3Aviaje-templo%22) |
| Campamento | Inscripción de jóvenes y líderes, aporte sugerido si el obispado lo autoriza (sin manejar dinero), formulario oficial de permiso, lista personal de qué llevar y reparto del equipo del barrio | [![Campamento: issues listos](https://img.shields.io/github/issues-search?query=repo%3AMarAntBQ%2FCallingSupportApp%20is%3Aissue%20is%3Aclosed%20label%3A%22m%C3%B3dulo%3Acampamento%22&label=listos&color=15803d)](../../issues?q=is%3Aissue%20is%3Aclosed%20label%3A%22m%C3%B3dulo%3Acampamento%22) [![Campamento: issues pendientes](https://img.shields.io/github/issues-search?query=repo%3AMarAntBQ%2FCallingSupportApp%20is%3Aissue%20is%3Aopen%20label%3A%22m%C3%B3dulo%3Acampamento%22&label=pendientes&color=b45309)](../../issues?q=is%3Aissue%20is%3Aopen%20label%3A%22m%C3%B3dulo%3Acampamento%22) |
| EnglishConnect | Ciclos y grupos por nivel, con sede, día, hora y enlaces. Cada estudiante se inscribe y ve su grupo; cada maestro ve solo a sus estudiantes | [![EnglishConnect: issues listos](https://img.shields.io/github/issues-search?query=repo%3AMarAntBQ%2FCallingSupportApp%20is%3Aissue%20is%3Aclosed%20label%3A%22m%C3%B3dulo%3Aenglishconnect%22&label=listos&color=15803d)](../../issues?q=is%3Aissue%20is%3Aclosed%20label%3A%22m%C3%B3dulo%3Aenglishconnect%22) [![EnglishConnect: issues pendientes](https://img.shields.io/github/issues-search?query=repo%3AMarAntBQ%2FCallingSupportApp%20is%3Aissue%20is%3Aopen%20label%3A%22m%C3%B3dulo%3Aenglishconnect%22&label=pendientes&color=b45309)](../../issues?q=is%3Aissue%20is%3Aopen%20label%3A%22m%C3%B3dulo%3Aenglishconnect%22) |
| Autosuficiencia | Portal de recursos públicos y gratuitos de autosuficiencia, sin datos de las personas | [![Autosuficiencia: issues listos](https://img.shields.io/github/issues-search?query=repo%3AMarAntBQ%2FCallingSupportApp%20is%3Aissue%20is%3Aclosed%20label%3A%22m%C3%B3dulo%3Aautosuficiencia%22&label=listos&color=15803d)](../../issues?q=is%3Aissue%20is%3Aclosed%20label%3A%22m%C3%B3dulo%3Aautosuficiencia%22) [![Autosuficiencia: issues pendientes](https://img.shields.io/github/issues-search?query=repo%3AMarAntBQ%2FCallingSupportApp%20is%3Aissue%20is%3Aopen%20label%3A%22m%C3%B3dulo%3Aautosuficiencia%22&label=pendientes&color=b45309)](../../issues?q=is%3Aissue%20is%3Aopen%20label%3A%22m%C3%B3dulo%3Aautosuficiencia%22) |

Los números salen en vivo de los issues de cada módulo (etiquetas `módulo:*`): se actualizan solos cuando un issue se cierra.

## Cuidado de los datos de los miembros

Los datos de los miembros de la Iglesia son de sumo cuidado y no se pueden filtrar. Por eso
el proyecto sigue una regla simple:

**Solo se manejan datos que cada persona entrega por sí misma, con su consentimiento, para
una actividad concreta.** Por ejemplo, quien se inscribe al viaje al templo o al campamento
acepta que lo anoten en esa lista, y esa lista es justo lo que el organizador necesita.

Esa regla viene del **Manual General de la Iglesia, 33.8 "Carácter confidencial de los registros"**
([fuente](https://www.churchofjesuschrist.org/study/manual/general-handbook/33-records-and-reports?lang=spa)):
la información de los miembros se limita a lo necesario, se usa solo para el propósito aprobado,
se entrega solo a quien está autorizado, nunca se usa para fines personales, políticos ni
comerciales, y nunca se entrega para estudios de investigación o encuestas. Rige todo el proyecto.

En la práctica:

- **Nunca** se importan listados de los sistemas oficiales de la Iglesia (cédulas de
  miembros, directorios, informes de llamamientos). Esos datos se quedan donde están.
- Cada formulario pide **consentimiento explícito** antes de guardar nada. Las ordenanzas
  del templo son datos de creencia religiosa y se tratan como datos sensibles.
- Los datos tienen un **plazo de retención** y se purgan al cumplirlo.
- Este repositorio es público: **jamás** se suben datos reales, exportaciones ni archivos
  `.env`. El `.gitignore` bloquea PDF, XLSX y CSV por esa razón.

## Estado

La aplicación es **100% Next.js**, pensada para que cualquier barrio la despliegue sin servidor propio:

- **Vercel** para la aplicación (frontend y API en un solo proyecto).
- **Supabase** (Postgres) para la base de datos.
- Ambos con plan gratuito, sin VPS ni configuración de servidor.

**Avance por etapa**, en vivo desde los [milestones](../../milestones):

- [![1 · Base: porcentaje de issues cerrados](https://img.shields.io/github/milestones/progress-percent/MarAntBQ/CallingSupportApp/1)](../../milestone/1)
- [![2 · Viaje al Templo: porcentaje de issues cerrados](https://img.shields.io/github/milestones/progress-percent/MarAntBQ/CallingSupportApp/2)](../../milestone/2)
- [![3 · Listo para otros barrios: porcentaje de issues cerrados](https://img.shields.io/github/milestones/progress-percent/MarAntBQ/CallingSupportApp/3)](../../milestone/3)
- [![4 · Módulos nuevos: porcentaje de issues cerrados](https://img.shields.io/github/milestones/progress-percent/MarAntBQ/CallingSupportApp/4)](../../milestone/4)

[![Último cambio en main](https://img.shields.io/github/last-commit/MarAntBQ/CallingSupportApp/main?label=%C3%BAltimo%20cambio%20en%20main)](../../commits/main) · Qué cambió y para quién: [Novedades](https://callingsupportapp.org/updates/).

La primera versión del proyecto (NestJS + React/Vite + MySQL, autoalojada) se conserva
completa en la rama [`legacy`](../../tree/legacy) como referencia funcional para el port.

## Principios

- **El Manual General manda.** Toda idea y todo módulo deben estar de acuerdo con el
  [Manual General](https://www.churchofjesuschrist.org/study/manual/general-handbook?lang=spa)
  de la Iglesia. Si algo lo contradice, no se construye.
- **Una instalación por barrio.** Cada barrio despliega su propia copia y es responsable
  de sus datos. No existe un servidor central que guarde datos de varios barrios.
- **Nada fijo de un barrio en el código.** Nombre, logo, responsable de los datos y textos
  se configuran desde la aplicación.
- **Para varios países.** La aplicación es trilingüe (**español, portugués e inglés**), con
  un selector de idioma en el menú y el idioma por defecto en la configuración.

## Equipo: CSATeam

CallingSupportApp lo hace **CSATeam (Calling Support App Team)**, una comunidad de
colaboradores voluntarios. **Todos somos colaboradores y ninguno es más que otro:** no hay
creador, ni dueños, ni líderes del proyecto. Las decisiones se toman en los issues y, por
encima de todo, manda el [Manual General](https://www.churchofjesuschrist.org/study/manual/general-handbook?lang=spa).

Cada persona que se suma escribe su propio perfil en [`team/`](team/). Conoce al equipo ahí, y
si quieres sumarte, tu primer aporte puede ser agregar el tuyo.

**No está patrocinado por ninguna empresa.** Es un proyecto voluntario, abierto para que
cualquier barrio lo use y para que quien quiera colabore.

## Colaborar

**Cualquier persona, miembro o amigo de la Iglesia, puede participar sin pedir permiso:** fork,
`/tomar` en un issue y PR. Para ser colaborador oficial del equipo hay dos caminos: que alguien
del equipo proponga invitarte, o colaborar abiertamente hasta tener varios PRs mergeados. Detalle en
[CONTRIBUTING](CONTRIBUTING.md#quién-puede-participar).

Toda contribución entra por **issue → `/tomar` → rama → PR en borrador → squash**. Cada issue
se autocontiene: trae todo lo necesario para trabajarlo sin preguntar. Para tomar uno, se
comenta **`/tomar`** y un bot lo asigna y le pone la etiqueta `en-progreso`, así todos saben
que está en curso. Un issue a la vez por persona, PR en borrador en 48 horas y `/soltar` si no
se puede seguir; con 14 días sin actividad se libera solo.

- **¿Primera vez?** El [Manual del desarrollador](https://callingsupportapp.org/developers/): de cero a tu primer PR, paso a paso.
- **Cómo colaborar paso a paso:** [CONTRIBUTING](CONTRIBUTING.md).
- **Reglas del repositorio** (stack, idiomas, glosario), para personas y agentes de IA:
  [AGENTS.md](AGENTS.md).
- **Roadmap:** los [milestones](../../milestones) en orden, empezando por **1 · Base**.
- **Para empezar:** issues con
  [`good first issue`](../../issues?q=is%3Aopen+no%3Aassignee+label%3A%22good+first+issue%22+-label%3Abloqueado) sin asignar que no
  estén `bloqueado`.

## Documentación

- [Wiki técnica](../../wiki): arquitectura, ambientes, ramas y versiones, decisiones y seguridad.
- [Sitio de documentación](https://callingsupportapp.org): manuales, normas, privacidad y el Manual del desarrollador.
- [DESIGN.md](DESIGN.md): colores, tipografía y patrones de pantalla.
- [CONTRIBUTING](CONTRIBUTING.md) · [Código de conducta](CODE_OF_CONDUCT.md) · [Ayuda](SUPPORT.md) · [Seguridad](SECURITY.md) · [AGENTS.md](AGENTS.md)

## Licencia

[MIT](LICENSE) © 2026 CSATeam OpenSource (Calling Support App Team) and contributors.
