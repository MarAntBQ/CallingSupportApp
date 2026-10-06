# Esquema de la base de datos

Un archivo por módulo (por ejemplo, `users.ts`, `temple-trips.ts`), con sus tablas de Drizzle. Cada archivo se reexporta desde `index.ts`.

El esquema cambia **solo por migraciones**: después de editar una tabla, `npm run db:generate` crea la migración en `drizzle/`, y `npm run db:migrate` la aplica. Las tablas llegan desde #8 en adelante.
