# CallingSupportApp

Aplicación open source para apoyar la administración de un barrio o rama: usuarios,
organizaciones, llamamientos con permisos por módulo, y módulos de actividades como el
**Viaje para Adorar en el Templo**, el **campamento** o las clases de **EnglishConnect**.

> **No es un sitio oficial** de La Iglesia de Jesucristo de los Santos de los Últimos Días.
> Es una herramienta comunitaria. La información oficial está en
> [churchofjesuschrist.org](https://www.churchofjesuschrist.org).

## Qué es y qué no es

**No reemplaza a Herramientas para Miembros**
([Member Tools](https://play.google.com/store/apps/details?id=org.lds.ldstools)), la
aplicación oficial de la Iglesia. Directorio, calendario, llamamientos y ministración siguen
viviendo ahí.

El objetivo de este proyecto es **agregar las funcionalidades que hoy no existen**: organizar
una actividad de principio a fin, con sus inscripciones, cupos, pagos y listados, sin hojas
de cálculo sueltas ni grupos de chat.

## Módulos

| Módulo | Qué resuelve | Estado |
|---|---|---|
| Usuarios, organizaciones y llamamientos | Quién entra a la aplicación y qué puede ver o hacer en cada módulo, según su llamamiento | En la v1, por portar |
| Viaje para Adorar en el Templo | Inscripción pública, cupos por ordenanza y género, transporte y hospedaje, abonos, habitaciones, listados imprimibles | En la v1, por portar |
| Campamento | Inscripción, cupos, costos y abonos de un campamento | Planeado |
| EnglishConnect | Grupos por nivel con su sede o aula, día y hora de clase, enlace a la clase y al grupo de WhatsApp. Cada estudiante se inscribe en un grupo y ve el suyo; cada maestro ve a sus estudiantes | Planeado |

## Cuidado de los datos de los miembros

Los datos de los miembros de la Iglesia son de sumo cuidado y no se pueden filtrar. Por eso
el proyecto sigue una regla simple:

**Solo se manejan datos que cada persona entrega por sí misma, con su consentimiento, para
una actividad concreta.** Por ejemplo, quien se inscribe al viaje al templo o al campamento
acepta que lo anoten en esa lista, y esa lista es justo lo que el organizador necesita.

En la práctica:

- **Nunca** se importan listados de los sistemas oficiales de la Iglesia (cédulas de
  miembros, directorios, informes de llamamientos). Esos datos se quedan donde están.
- Cada formulario pide **consentimiento explícito** antes de guardar nada. Las ordenanzas
  del templo son datos de creencia religiosa y se tratan como datos sensibles.
- Los datos tienen un **plazo de retención** y se purgan al cumplirlo.
- Este repositorio es público: **jamás** se suben datos reales, exportaciones ni archivos
  `.env`. El `.gitignore` bloquea PDF, XLSX y CSV por esa razón.

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

## Acerca del creador

Soy **Marco Antonio Bustillos Quiroz**, desarrollador de software de Ecuador. Me gradué de
**Brigham Young University–Idaho** (Licenciatura en Diseño y Desarrollo Web) y serví una
**misión de tiempo completo** en Paraguay.

Este proyecto nace de algo sencillo: hacer herramientas que ayuden a las unidades de la
Iglesia. No es la primera vez. En 2022, cuando en mi estaca dábamos EnglishConnect, hice una
aplicación para organizar los grupos, los maestros y los estudiantes; de esa experiencia
sale el módulo de EnglishConnect que está planeado aquí.

**No está patrocinado por ninguna empresa.** Es un proyecto personal y voluntario, abierto
para que cualquier barrio lo use y para que quien quiera colabore.

[MarAntBQ.dev](https://marantbq.dev)

## Colaborar

Toda contribución entra por **issue → rama → pull request → squash**. Abre un issue con la
plantilla antes de escribir código; ahí se acuerdan el alcance y los criterios de
aceptación.

## Licencia

[MIT](LICENSE)
