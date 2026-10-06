# Lógica del servidor

- `db/`: el cliente único de la base (`getDb()`) y el esquema de Drizzle (`db/schema/`).
- `<módulo>/`: la lógica de negocio y los permisos de cada módulo (por ejemplo, `temple-trips/`).

Nada de esta carpeta se importa desde el navegador: los archivos que tocan la base empiezan con `import 'server-only'`.
