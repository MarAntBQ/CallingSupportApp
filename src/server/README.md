# Lógica del servidor

- `db/`: el cliente único de la base (`getDb()`) y el esquema de Drizzle (`db/schema/`).
- `auth/`: sesiones (token aleatorio en una cookie `httpOnly`; en la base solo su SHA-256), contraseñas con bcrypt, `getSession()`, `requireSession()` y `requireGlobalAdmin()`.
- `setup/`: el asistente del primer administrador, en una transacción que bloquea la tabla `users` para que dos setups simultáneos no creen dos cuentas.
- `<módulo>/`: la lógica de negocio y los permisos de cada módulo (por ejemplo, `temple-trips/`).

Nada de esta carpeta se importa desde el navegador: los archivos que tocan la base empiezan con `import 'server-only'`.
