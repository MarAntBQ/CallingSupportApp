---
name: datos-de-miembros
description: Reglas para tratar datos de personas en CallingSupportApp, regidas por el Manual General de la Iglesia 33.8 (carácter confidencial de los registros) y 33.9 (administración de los registros) — solo lo necesario, solo para el propósito aprobado, solo para quien está autorizado, nunca para fines personales, políticos, comerciales ni estudios; además consentimiento, datos sensibles (las ordenanzas son creencia religiosa), menores de edad, prohibición de importar listados de los sistemas oficiales de la Iglesia, retención y purga, permisos, exportaciones, logs, y qué nunca puede llegar al repositorio público. Úsala SIEMPRE que un cambio recoja, guarde, muestre, exporte, notifique o borre datos de personas — formularios de inscripción, tablas, reportes, imprimibles, Excel, correos, Telegram — y al escribir o revisar la política de datos.
---

# Datos de miembros

Los datos de los miembros de la Iglesia son de sumo cuidado y **no se pueden filtrar**. Un
error aquí no es un bug más: expone a personas reales de un barrio.

## La regla que manda: Manual General 33.8

Esta sección rige por encima de todo lo demás del proyecto. Fuente:
[Manual General, capítulo 33](https://www.churchofjesuschrist.org/study/manual/general-handbook/33-records-and-reports?lang=spa),
sección 33.8 "Carácter confidencial de los registros". Los líderes se aseguran de que la
información que se recabe de los miembros:

> - «Se limite a lo que la Iglesia requiere.»
> - «Se utilice solo para los propósitos aprobados de la Iglesia.»
> - «Se entregue únicamente a las personas que estén autorizadas a utilizarla.»

Y de que esos datos **«no se empleen para objetivos personales, políticos ni comerciales»**.
Además: «No se debe dar información de los registros de la Iglesia, incluida la información
histórica, a ninguna persona ni agencia que lleve a cabo estudios de investigación o
encuestas».

| 33.8 | En el código |
|---|---|
| Se limite a lo que se requiere | Cada campo tiene un uso concreto en la actividad. Nada "por si acaso", nada "puede servir después" |
| Solo para los propósitos aprobados | Un dato vive y se usa solo en el módulo y la actividad donde se entregó. Prohibido cruzar módulos (por ejemplo, usar los teléfonos del viaje para el directorio o para avisos de otra cosa) |
| Solo a personas autorizadas | Permiso del módulo en el servidor para leer, exportar, imprimir y avisar. Ocultar un botón no autoriza ni desautoriza |
| Ni personales, ni políticos, ni comerciales | Ningún dato de miembros alimenta promociones, campañas ni negocios. El directorio de emprendimientos solo muestra lo que cada hermano publica de sí mismo, y viene apagado hasta que el obispado lo apruebe (Manual 38.8.5) |
| Ni estudios ni encuestas | Sin analítica que envíe datos de personas, sin integraciones con terceros que reciban datos, sin exportaciones "para un estudio" |

**Si una funcionalidad choca con el 33.8, no se construye**, aunque técnicamente sea posible
o alguien la pida.

### Lo que agrega el 33.9 (administración de los registros)

- **Protección** contra acceso, modificación, destrucción o divulgación no autorizados.
  Secretos cifrados (AES-256-GCM con `ENC_KEY`) y contraseñas con hash.
- **Nunca compartir cuentas.** Cada persona tiene la suya; no hay usuarios genéricos ("secretario").
  **Verificación en dos pasos** para quien tiene acceso a datos (#36).
- **Computadoras compartidas.** "Recordar mi sesión" viene sin marcar. Al descargar un Excel o
  imprimir una lista se muestra: «Este archivo tiene datos de miembros. No lo guardes en una
  computadora compartida y bórralo cuando ya no lo necesites.»
- **Dinero:** la app no registra pagos, abonos, donativos ni saldos de los miembros. Los
  registros financieros son confidenciales (33.8), y el [capítulo 34](https://www.churchofjesuschrist.org/study/manual/general-handbook/34-finances-and-audits?lang=spa) dice: «Solo el
  obispo y sus consejeros pueden recibir los diezmos y las otras ofrendas.» (34.5.2) y «El monto
  que un donante pague de diezmo y de otras ofrendas es confidencial.» (34.4). Detalle en
  `AGENTS.md` → "El Manual General manda".
- **Retención:** solo el tiempo necesario para la actividad.
- **Destrucción irrecuperable:** el Manual pide destruir lo que ya no se necesita «de tal modo
  que no sea posible recuperar ni reconstruir ninguna información». **Decisión del proyecto**
  para cumplirlo: la purga hace borrado físico (`DELETE`), nunca un borrado lógico ni una papelera.
- **Uso indebido:** ingresar a propósito información falsa o usar datos para fines ajenos a la
  Iglesia es grave, según el Manual. La aplicación no lo facilita: sin exportaciones masivas,
  sin copias entre módulos.

## El principio

> **Solo se manejan datos que cada persona entrega por sí misma, con su consentimiento,
> para una actividad concreta.**

Quien se inscribe al viaje al templo acepta que lo anoten en esa lista. Esa lista es lo que
el organizador necesita, y para eso se usa. Nada más.

## Prohibido

- **Importar listados de los sistemas oficiales de la Iglesia** (Herramientas para Miembros,
  directorios, informes, cédulas de miembro). Esos datos se quedan donde están. Ningún issue,
  script ni seed los incorpora.
- **Subir datos reales al repositorio:** ni seeds, ni pruebas, ni capturas, ni exportaciones,
  ni logs. Los datos de prueba son inventados (`Persona Prueba`, `prueba@example.com`).
- **Usar un dato para algo distinto** de la actividad para la que se entregó (por ejemplo,
  usar los teléfonos del viaje para avisos de otra cosa).
- **Casillas de consentimiento premarcadas** o un solo "acepto" para varias finalidades.

## Obligatorio en cada formulario

1. **Aviso corto junto al formulario**, antes de enviar: quién es el responsable, para qué
   se usan los datos, cuánto tiempo se guardan y dónde está la política completa.
2. **Casilla de consentimiento sin premarcar.** El servidor rechaza el envío sin ella.
3. **Evidencia del consentimiento:** guardar que se aceptó, la versión de la política
   vigente y el idioma en que se mostró (`consent`, `policyVersion`, `locale`).
4. **Pedir solo lo necesario.** Cada campo nuevo tiene que poder justificarse con un uso
   concreto de la actividad.

## Datos sensibles

- **Las ordenanzas del templo son datos de creencia religiosa.** Requieren consentimiento
  explícito y no aparecen en ningún lugar que no las necesite.
- **Menores de edad:** un padre o madre puede inscribir a sus hijos. Quien inscribe da el
  consentimiento por ellos, y el formulario lo dice así.
- Datos de salud (alergias, medicamentos para un campamento) son sensibles: mismo trato que
  las ordenanzas, y solo los ve quien tiene el permiso del módulo.

## Acceso, exportaciones y avisos

- **Cada lectura pasa por el permiso del módulo** en el servidor. Ocultar un botón no protege.
- **Exportaciones (Excel, imprimibles, reportes):** solo con permiso, y solo con las columnas
  que ese documento necesita. Una lista de transporte no lleva ordenanzas.
- **Correos y Telegram:** el mínimo indispensable ("Nueva inscripción en el viaje del 24 de
  octubre"), sin cédulas ni ordenanzas en el texto.
- **Logs y errores:** nunca imprimir cuerpos de formularios, cédulas, teléfonos ni correos.
- La API devuelve **solo los campos** que la pantalla usa.

## Retención

Cada actividad define su plazo de conservación, y se **cumple**: una tarea diaria (Vercel
Cron) borra o anonimiza los datos vencidos. Documentarlo sin implementarlo no basta.

## Política de datos

Cada instalación es responsable de sus propios datos. Por eso la política **no tiene datos
fijos**: responsable, contacto, plazos y finalidades salen de la configuración. La plantilla
por defecto sigue la **Ley Orgánica de Protección de Datos Personales de Ecuador** (LOPDP):

- art. 7: base de licitud (aquí, el consentimiento);
- art. 8: consentimiento libre, específico, informado e inequívoco;
- art. 12: lo que hay que informar antes de recoger el dato, incluido el tiempo de
  conservación y las transferencias internacionales;
- art. 26: datos sensibles, con consentimiento explícito;
- art. 39: protección de datos desde el diseño.

**Transferencias internacionales:** Vercel y Supabase guardan los datos fuera del país, y
reCAPTCHA los envía a Google. La política tiene que nombrarlos como destinatarios.

Una instalación en otro país adapta la política a su ley; la estructura sigue sirviendo.

La política, el aviso corto y la casilla de consentimiento existen **en los tres idiomas**:
una persona solo puede consentir lo que entiende. Se guarda en qué idioma se aceptó
(`locale`) junto con `policyVersion`.

## Lista para el PR

- [ ] **33.8:** solo lo necesario, solo para el propósito de esta actividad, solo para quien tiene el permiso, y nada que sirva a fines personales, políticos, comerciales o a estudios.
- [ ] **33.9:** sin cuentas compartidas, sin datos en computadoras compartidas (aviso al exportar o imprimir) y destrucción irrecuperable (en este proyecto, borrado físico).
- [ ] Ningún dato viene de un sistema oficial de la Iglesia.
- [ ] El formulario tiene aviso corto y casilla sin premarcar; el servidor exige el consentimiento.
- [ ] Se guarda `consent` + `policyVersion`.
- [ ] Cada campo nuevo tiene un uso concreto.
- [ ] Lecturas, exportaciones y avisos pasan por el permiso del módulo y llevan solo lo necesario.
- [ ] Nada de datos de personas en logs, errores, correos de más ni en el repositorio.
- [ ] El plazo de retención está definido y la purga lo cubre.
