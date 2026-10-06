# CallingSupportApp

Aplicación open source para apoyar la administración de un barrio o rama: usuarios,
organizaciones, llamamientos con permisos por módulo, y módulos de actividades como el
**Viaje para Adorar en el Templo** (inscripciones, cupos, abonos, habitaciones) y, más
adelante, el **campamento**.

> **No es un sitio oficial** de La Iglesia de Jesucristo de los Santos de los Últimos Días.
> Es una herramienta comunitaria. La información oficial está en
> [churchofjesuschrist.org](https://www.churchofjesuschrist.org).

## Estado

**En reescritura.** Esta rama (`main`) arranca desde cero como una aplicación **100%
Next.js**, pensada para que cualquier barrio la despliegue sin servidor propio:

- **Vercel** para la aplicación (frontend y API en un solo proyecto).
- **Supabase** (Postgres) para la base de datos.
- Ambos con plan gratuito, sin VPS ni configuración de servidor.

La primera versión del proyecto (NestJS + React/Vite + MySQL, autoalojada) se conserva
completa en la rama [`legacy`](../../tree/legacy) como referencia funcional para el port.

## Principios

- **Una instalación por barrio.** Cada barrio despliega su propia copia y es responsable
  de sus datos. No existe un servidor central que guarde datos de varios barrios.
- **Nada fijo de un barrio en el código.** Nombre, logo, responsable de los datos y textos
  se configuran desde la aplicación.
- **Datos sensibles con cuidado.** Las ordenanzas son datos de creencia religiosa: se piden
  con consentimiento explícito y se purgan al cumplir el plazo de retención.

## Colaborar

Toda contribución entra por **issue → rama → pull request → squash**. Abre un issue con la
plantilla antes de escribir código; ahí se acuerdan el alcance y los criterios de
aceptación.

## Licencia

[MIT](LICENSE)
