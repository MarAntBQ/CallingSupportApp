---
title: Política de datos y privacidad
description: Cómo CallingSupportApp protege los datos de los miembros según el Manual General 33.8: qué se guarda, quién puede verlo, cuánto tiempo y qué trata este sitio.
updated: 2026-10-06
---

Esta página explica las **reglas de diseño** que sigue el software. Cada barrio que instala CallingSupportApp tiene, dentro de su aplicación, **su propia política de datos** con su propio responsable: la unidad que la usa.

## La regla que manda: Manual General 33.8

Los datos de los miembros se rigen por el [Manual General, sección 33.8 "Carácter confidencial de los registros"](https://www.churchofjesuschrist.org/study/manual/general-handbook/33-records-and-reports?lang=spa). Los líderes se aseguran de que la información que se recabe de los miembros:

> - «Se limite a lo que la Iglesia requiere.»
> - «Se utilice solo para los propósitos aprobados de la Iglesia.»
> - «Se entregue únicamente a las personas que estén autorizadas a utilizarla.»

Y de que esos datos «no se empleen para objetivos personales, políticos ni comerciales». Además: «No se debe dar información de los registros de la Iglesia, incluida la información histórica, a ninguna persona ni agencia que lleve a cabo estudios de investigación o encuestas».

Si una funcionalidad choca con esto, no se construye.

## Qué datos trata cada módulo

Solo se tratan datos que **cada persona entrega por sí misma, con su consentimiento**, para una actividad concreta. **Nunca** se importan listados de los sistemas oficiales de la Iglesia.

| Módulo | Datos | Para qué |
|---|---|---|
| Usuarios y llamamientos | Nombre, correo, teléfono (opcional), rol y llamamientos | Saber quién entra a la aplicación y qué puede hacer |
| Viaje al Templo | Cédula o pasaporte, fecha de nacimiento, nombre, teléfono, correo, género, servicios elegidos y ordenanzas; fecha, IP e idioma del consentimiento | Organizar el viaje: cupos, transporte, comidas, hospedaje |
| Campamento | Del joven: nombre, fecha de nacimiento, género y contacto de emergencia. De su padre, madre o tutor: nombre, teléfono y correo | Organizar el campamento. **No se guardan datos médicos**: van en el formulario oficial firmado por los padres |
| EnglishConnect | Nombre, correo y teléfono (opcional); el representante, si es menor | Organizar los grupos |
| Autosuficiencia | En el directorio, solo lo que cada hermano publica de su negocio, más un correo privado | Que la unidad pueda apoyarlo |

**Las ordenanzas son datos de creencia religiosa**: se piden con consentimiento explícito y solo las ve quien las necesita. Cuando se inscribe a un **menor**, consiente su padre, madre o tutor.

## Cómo se protegen

- **Consentimiento**: casilla sin marcar antes de enviar; se guarda la versión de la política y el idioma en que se aceptó.
- **Acceso por llamamiento**: cada lectura, exportación, impresión y aviso pasa por el permiso del módulo, verificado en el servidor.
- **Cuentas personales y verificación en dos pasos** para quien tiene acceso a datos.
- **Un dato se usa solo en la actividad donde se entregó**: nunca se cruza entre módulos.
- **Sin dinero**: la aplicación no registra pagos, abonos ni donativos ([Manual General, capítulo 34](https://www.churchofjesuschrist.org/study/manual/general-handbook/34-finances-and-audits?lang=spa)).

## Cuánto tiempo se guardan

Cada instalación define su plazo de conservación, y una tarea diaria **borra** los datos vencidos. El Manual pide que los registros se guarden «solamente durante el tiempo necesario» (33.9.2) y que lo que ya no se necesita se destruya «de tal modo que no sea posible recuperar ni reconstruir ninguna información» (33.9.3). Por eso el borrado es definitivo: sin papelera.

## Una instalación por barrio

No existe un servidor central con datos de varios barrios. Cada unidad instala su propia copia y es la **responsable** de sus datos. Si usa Vercel y Supabase, los datos se alojan fuera del país; su política de datos debe decirlo.

## Este sitio

- **Formulario de contacto** (página Contacto): recoge tu nombre, tu correo y tu mensaje, solo para responderte. Lo recibe el equipo del proyecto en devteam@callingsupportapp.org y se guarda en la base de datos del servidor del proyecto **90 días**; después se borra solo, cada día. Tu IP no se guarda: solo una huella irreversible, para limitar el spam. Para protegerlo se usa **Google reCAPTCHA v3**, que se carga **solo en esa página**: tu navegador se conecta con Google y le envía datos técnicos (incluida tu IP), según su [política de privacidad](https://policies.google.com/privacy). Nuestro servidor no le envía tu IP a Google. Guardamos también que aceptaste, con qué versión de esta política y en qué idioma.
- No tiene cuentas, cookies propias ni analítica.
- Las fuentes se sirven desde este mismo dominio.
- Desde tu navegador se consulta la **API pública de GitHub** (`api.github.com`) para mostrar el avance y los colaboradores, y se cargan sus avatares desde GitHub.
- El hosting guarda registros técnicos del servidor (como la IP) por seguridad, según su propia política.

## Contacto

Por los datos guardados en la aplicación de **un barrio**, escribe al responsable de esa unidad. Por el proyecto: [devteam@callingsupportapp.org](mailto:devteam@callingsupportapp.org).
