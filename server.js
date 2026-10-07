// Server propio para correr la app bajo pm2 en MBHostCloud (DirectAdmin + Apache).
// Next `next start` solo abre un puerto TCP; aquí envolvemos el handler de Next sobre el
// unix socket que asigna el hosting en process.env.APP_SOCKET (sin abrir puertos). En
// desarrollo, sin APP_SOCKET, cae al puerto de siempre.
const { createServer } = require('http');
const { lstatSync, unlinkSync, chmodSync } = require('fs');
const next = require('next');

const socket = process.env.APP_SOCKET;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  if (socket) {
    // Solo borramos un socket viejo; si en esa ruta hay otra cosa, dejamos que listen
    // falle ruidoso en vez de borrar un archivo que no es nuestro.
    try {
      if (lstatSync(socket).isSocket()) unlinkSync(socket);
    } catch {}
    server.listen(socket, () => {
      chmodSync(socket, 0o660);
      // Tras crear el socket (que ya quedó 0660), devolvemos el umask a 0022: con el 0117
      // que pone el hosting, Next no puede crear/escribir .next/cache (EACCES en el
      // optimizador de imágenes) y re-optimiza en cada visita.
      process.umask(0o022);
      console.log('escuchando en socket ' + socket);
    });
  } else {
    server.listen(process.env.PORT || 3000);
  }
});
