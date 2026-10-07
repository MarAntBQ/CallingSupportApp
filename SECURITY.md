# Seguridad

Si encuentras una falla de seguridad en CallingSupportApp, gracias por avisarnos. **No abras un
issue público:** los datos que protege esta aplicación son de personas reales.

## Cómo reportarla

- Usa **[Report a vulnerability](https://github.com/MarAntBQ/CallingSupportApp/security/advisories/new)**
  (pestaña *Security* del repositorio), o
- escribe a **devteam@callingsupportapp.org** con el asunto "Seguridad: …".

Incluye qué encontraste y dónde (ruta, archivo, commit), los pasos para reproducirlo y el
impacto que crees que tiene.

## Lo que pedimos

- No accedas, modifiques ni borres datos que no son tuyos; usa siempre datos inventados.
- No hagas pruebas que degraden un servicio sobre instalaciones reales.
- Danos tiempo razonable para corregir antes de hacerlo público.

## Cómo se protege la aplicación

| Riesgo | Protección | Dónde |
|---|---|---|
| Rutas o acciones sin proteger | `withAuth` / `publicRoute` / `authedAction`; una prueba falla si un método no los usa | `src/server/security/`, `routes.test.ts` |
| Robo o reuso de sesión | Token aleatorio de 32 bytes en una cookie `httpOnly`, `secure`, `sameSite=lax` y con prefijo `__Host-` en producción; en la base solo su SHA-256; se revoca al instante; vence a la hora (o a los 7 días con "Recordar mi sesión") y tras 8 horas sin uso | `src/server/auth/` |
| Peticiones desde otro sitio (CSRF) | `sameSite=lax` y comprobación de `Origin` en todo método que no sea GET/HEAD | `src/server/security/http.ts` |
| Fuerza bruta | 5 intentos fallidos por correo y 20 por IP cada 15 minutos; 10 setups por IP por hora; las claves se guardan con HMAC, nunca el correo ni la IP en claro | `src/server/security/rate-limit.ts` |
| Saber qué correos existen | La misma respuesta para correo inexistente y contraseña incorrecta, y se compara contra un hash de relleno para que tarde lo mismo | `src/server/auth/login.ts` |
| Inyección de scripts (XSS) | CSP con nonce por petición, sin `unsafe-inline` en scripts; React escapa el texto | `src/proxy.ts`, `src/lib/security-headers.ts` |
| Clickjacking y sniffing | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS de 2 años | `next.config.ts` |
| Fugas en errores | `{ error: "internal_error", id }` sin traza; los logs no llevan datos de personas | `src/server/auth/errors.ts` |
| Dependencias vulnerables | Dependabot semanal (npm y Actions) y CodeQL en cada PR y cada semana | `.github/` |

## Versiones con soporte

Solo la rama `main`. La rama `legacy` (primera versión) no recibe arreglos.

Somos un equipo voluntario (CSATeam): procuramos responder en pocos días y contamos el arreglo en
la sección *Novedades* del [sitio del proyecto](https://callingsupportapp.org/updates/).
