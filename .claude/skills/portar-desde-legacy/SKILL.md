---
name: portar-desde-legacy
description: Cómo llevar una funcionalidad de la v1 de CallingSupportApp (rama legacy — NestJS + TypeORM + MySQL + React/Vite) a la versión nueva en Next.js + Drizzle + Postgres. Cómo leer la v1 sin cambiar de rama, la equivalencia pieza por pieza (controladores, guards, DTOs, entidades, servicios, páginas), las lecciones de la v1 que no se repiten y los arreglos que se portan sin el bug. Úsala en todo issue con la etiqueta port-v1, o cuando digan "pasa esto de la v1", "cómo lo hacía la versión vieja", "porta el módulo X".
---

# Portar desde la v1 (rama `legacy`)

La rama `legacy` es la primera versión completa y **funciona como especificación**: dice qué
hace cada pantalla y cada regla. Se porta **el comportamiento, no el código**.

## Leer la v1 sin salir de tu rama

```sh
git fetch origin legacy:legacy
git ls-tree -r --name-only legacy | grep templo        # qué archivos hay
git show legacy:backend/src/templo/templo.service.ts   # leer un archivo
git log legacy --oneline -- backend/src/templo         # su historia
git show <sha>                                          # qué arregló un commit
```

Si necesitas correrla, usa un worktree aparte; nunca la mezcles con tu rama:

```sh
git worktree add ../callingsupport-legacy legacy
```

## Dónde está cada cosa en la v1

| Área | Backend (`backend/src/`) | Frontend (`frontend/src/`) |
|---|---|---|
| Autenticación y sesiones | `auth/`, `sessions/` | `pages/LoginPage.tsx`, `RegisterPage.tsx`, `VerifyOtpPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `pages/admin/SesionesPage.tsx`, `PerfilPage.tsx` |
| Usuarios, organizaciones, llamamientos, permisos | `usuarios/` | `pages/admin/usuarios/`, `pages/admin/organizaciones/`, `ConsejoBarrioPage.tsx` |
| Configuración | `core/config/` | `pages/admin/ConfigPage.tsx`, `lib/useConfig.ts` |
| Correo | `core/mail/` | `pages/admin/CorreosPage.tsx` |
| Telegram | `telegram-bot/` | perfil y configuración |
| Viaje al Templo | `templo/` | `pages/InscripcionPage.tsx`, `pages/admin/templo/` |
| Política de datos | — | `pages/PoliticaDatosPage.tsx` |
| Tablas (orden, búsqueda, paginación) | — | `components/TableControls.tsx`, `lib/use-table-controls.ts` |

## Equivalencias

| v1 (NestJS + TypeORM + Vite) | Versión nueva (Next.js + Drizzle) |
|---|---|
| Controlador `@Get/@Post` | Route Handler en `src/app/api/<módulo>/.../route.ts` |
| Guard JWT + `@RequiereModulo` + `ModuloAccessGuard` | Helpers del servidor `requireSession()` y `requireModulePermission(módulo, acción)`, llamados al inicio de cada handler |
| `@RequiereAdminGlobal` | `requireGlobalAdmin()` |
| DTO con `class-validator` | Esquema **Zod** compartido entre el formulario y el handler |
| Entidad TypeORM | Tabla Drizzle en `src/server/db/schema/<módulo>.ts` |
| `synchronize: true` | Migración con `drizzle-kit generate`, revisada y commiteada |
| Seeds en `OnModuleInit` | Migración de datos o script idempotente; nunca en el arranque |
| Servicio inyectable | Funciones en `src/server/<módulo>/` |
| JWT guardado en la tabla `jwt_generated` | Tabla de sesiones + cookie `httpOnly` |
| `axios` + React Router | `fetch` con TanStack Query + App Router |
| Bot de Telegram por long-polling | Webhook en un Route Handler |
| Nombres en español (`viaje`, `llamamiento`) | Nombres en inglés según el glosario de `AGENTS.md` |

## Lecciones de la v1 (no repetirlas)

- **Correos y mayúsculas.** La v1 buscaba usuarios con `where: { email }` y funcionaba porque
  MySQL ignora mayúsculas. En Postgres, `Juan@x.com` y `juan@x.com` son distintos: guardar y
  buscar siempre en minúsculas, con índice único sobre el correo normalizado.
- **Tipos de MySQL.** `mediumtext` y similares no existen en Postgres: usar `text`. Los
  `decimal` llegan como string: convertir con cuidado y redondear a 2 decimales.
- **Esquema automático.** La v1 usaba `synchronize`. Aquí todo cambio es una migración.
- **Procesos que no terminan.** El polling de Telegram vivía en un bucle infinito; en
  serverless no existe "proceso corriendo". Todo lo periódico es cron, todo lo entrante es
  webhook.
- **Cosas fijas de un barrio.** La v1 tenía el logo, el nombre "Los Laureles" y el responsable
  de los datos escritos en el código. Aquí todo sale de la configuración.
- **Nombres que no coinciden.** Hubo un bug real porque una columna decía "Iniciatoria" y la
  constante "Iniciatorias". Un solo nombre por concepto, derivado de una sola constante.

## Arreglos de la v1 que se portan (sin el bug)

Antes de portar un área, revisa sus commits `fix:` con `git show <sha>`:

| Commit | Qué enseña |
|---|---|
| `e98aeb5` | Pantalla en blanco por un hook de React llamado después de un `return` |
| `3966b8b` | Pantalla en blanco si la sesión en caché no traía los módulos permitidos |
| `c1000d5` | Ocultar los módulos que el usuario no puede administrar |
| `5fc704c` | Llamamientos y matriz de permisos también se protegen con el módulo de usuarios |
| `0582cee` | Piso de nivel líder para no heredar permisos de organización con un llamamiento raso |
| `592c906` | No se asignan llamamientos en "Miembro / Amigo de la Iglesia" |
| `820374b` | Si falla el envío de un correo, la operación principal no se cae |
| `cc45606` | El scroll horizontal es de la tabla, no de toda la página |

## Cómo entregar un port

1. Lista las reglas de negocio de la v1 que cubre el issue, con su archivo y función.
2. Implementa esas reglas, ni más ni menos. Las mejoras van en otro issue.
3. Si la v1 tenía un bug, porta el arreglo y menciónalo en el PR.
4. En el PR, sección *Resumen*: qué se portó igual y qué cambió a propósito, y por qué.
