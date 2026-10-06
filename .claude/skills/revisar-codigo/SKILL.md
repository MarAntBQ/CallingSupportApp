---
name: revisar-codigo
description: Revisión adversarial de código para CallingSupportApp. OBLIGATORIA en dos momentos — sobre tu propio diff antes de abrir un PR, y al revisar el PR de otra persona. Busca lo que un revisor exigente encontraría (huecos entre las pruebas, permisos que se validan en la capa equivocada, validación solo en el cliente, datos de personas expuestos, migraciones faltantes, cosas fijas de un barrio) y entrega los hallazgos con severidad y archivo:línea. Úsala cuando digan "revisa el código", "revisa este PR", "¿está listo para abrir el PR?", o antes de hacer push de una rama para PR.
---

# Revisar código

El objetivo es que **el revisor no encuentre nada que el autor pudo encontrar solo**. No es una
revisión de estilo: es buscar lo que rompe, filtra o miente.

## 1. Prepara el terreno

```sh
git fetch origin
git status --short --branch
git diff --stat origin/main...HEAD      # tu propio diff
gh pr view <n> --json title,body,files  # si revisas el PR de otro
gh pr checkout <n>                      # para correrlo, no solo leerlo
```

Lee **el issue enlazado completo** antes que el diff. La pregunta base es: ¿el PR entrega
exactamente lo que el issue pide? Si hace más o algo distinto, tiene que decirlo en la
descripción.

## 2. Corre las pruebas tú mismo

Sobre el HEAD del PR, no sobre `main`. Se juzga por el **código de salida**, no por buscar
palabras en el output:

```sh
npm run typecheck > /tmp/out.txt 2>&1; echo "exit=$?"
npm run lint      > /tmp/out.txt 2>&1; echo "exit=$?"
npm run build     > /tmp/out.txt 2>&1; echo "exit=$?"
npm test          > /tmp/out.txt 2>&1; echo "exit=$?"
```

Si el PR toca la interfaz, recorre el flujo en el navegador, en escritorio y en un ancho de
teléfono. Una prueba que nadie vio pasar **no es cobertura**.

## 3. Caza de defectos

Recorre el diff completo con esta lista. Cada punto es un error que ya pasó en proyectos reales.

0. **¿Contradice el Manual General?** Si el cambio introduce una práctica, un flujo o un
   texto que va contra el [Manual General](https://www.churchofjesuschrist.org/study/manual/general-handbook?lang=spa),
   es un `[bug]` que bloquea, aunque el código sea perfecto. Revisa también que las citas del
   Manual sean textuales y con su número de sección.
1. **El hueco entre las pruebas.** No leas las pruebas buscando errores: escribe en una línea
   qué caso cubre cada una y busca el caso que **ninguna** cubre. Ahí está el bug.
2. **Revierte el cambio y mira si algo se pone rojo.** Si quitar el arreglo deja todo en
   verde, nada lo sostiene: falta la prueba.
3. **¿La aserción puede fallar?** Una prueba que pasa con o sin el cambio, o un
   `if (x) expect(...)` que no corre cuando no hay `x`, no prueba nada.
4. **Permisos en la capa que corre primero.** Cada Route Handler y cada Server Action
   verifica sesión **y** permiso del módulo antes de tocar datos. Ocultar un botón no es un
   permiso: alguien puede llamar la API directo.
5. **Validación en el servidor.** El esquema Zod del formulario también se aplica en el
   servidor. Un aviso en pantalla no es una guarda.
6. **Quitar un valor por defecto afecta a todos los que caían ahí.** Antes de cambiar un
   `?? valor`, un `default:` o un `return` final, busca quién llegaba a ese camino.
7. **Una lista vacía no es "no hay bug".** Los errores de filtrado (por viaje, por módulo,
   por permiso) aparecen como listas vacías, no como errores. Prueba con datos que sí
   deberían aparecer.
8. **Todas las pantallas dicen lo mismo.** Si cambia un estado o un cálculo (cupos, saldo,
   aprobado), revisa cada lugar que lo muestra: tabla, detalle, reporte, imprimible, correo.
9. **Base de datos.** Todo cambio de esquema trae su migración y se probó desde una base
   vacía. Los correos se guardan y se buscan en minúsculas. Las operaciones de varios pasos
   (aprobar y descontar cupo) van en una transacción.
10. **Nada fijo de un barrio.** Nombres, logos, correos o textos de una unidad concreta
    salen de la configuración, no del código.
11. **Datos de personas: rige el Manual General 33.8.** ¿El diff recoge algo que la actividad
    no necesita? ¿Usa un dato fuera del módulo donde se entregó? ¿Lo muestra o lo exporta a
    alguien sin el permiso del módulo? ¿Puede servir a fines personales, políticos, comerciales o
    a un estudio? Cualquier "sí" es un `[bug]` que bloquea. Corre también la skill `datos-de-miembros`. Revisa que no queden en logs, mensajes de
    error ni respuestas de la API que no los necesitan.
12. **Secretos.** Ningún token, contraseña o `.env` en el diff. Las variables nuevas están en
    `.env.example` sin valores reales.
13. **Tres idiomas.** Ningún texto visible escrito en el código (incluidos mensajes de
    error, correos y avisos). Cada clave nueva existe en `es`, `pt` y `en`, y
    `npm run i18n:check` pasa. Fechas, números y moneda con `Intl`. Los correos usan el
    idioma de quien los recibe. Mira la pantalla en los tres idiomas: el portugués y el
    inglés suelen ser más largos y rompen botones.
14. **Interfaz.** Tablas con orden, búsqueda y paginación. Modales con título y botones fijos
    y solo el contenido con scroll. Formularios públicos usables en un teléfono.
15. **Comentarios y nombres describen lo que el código hace hoy**, no la historia de cómo se
    llegó. Desconfía de los absolutos ("nunca", "siempre"): busca la rama que no cumple.

Antes de reportar un hallazgo, **verifícalo contra la línea**. Un hallazgo equivocado cuesta
una ronda de revisión.

## 4. Formato del resultado

Empieza con el conteo por severidad y después cada hallazgo:

```
2 bugs · 1 sugerencia · 1 detalle

[bug] src/app/api/temple-trips/[id]/approve/route.ts:18
Aprueba al participante sin verificar el permiso "editar" del módulo; cualquier usuario con
sesión puede aprobar llamando la API directo.
Sugerencia: llamar requireModulePermission("temple-trips", "update") antes de leer el body.
```

- `[bug]`: rompe algo, expone datos o contradice el issue. Bloquea el merge.
- `[sugerencia]`: mejora real que no bloquea.
- `[detalle]`: estilo o legibilidad.

Termina con lo que **no** pudiste verificar y por qué. Si no hay hallazgos, dilo directo y
nombra el riesgo que queda.

## 5. Después de la revisión

- **Autor:** responde cada hallazgo con `CORREGIDO` (y el commit) o con la evidencia
  `archivo:línea` de por qué no aplica. Nada de "tienes razón" sin cambio.
- **Revisor:** no apruebes con un `[bug]` abierto. Al aprobar, di en una línea qué
  verificaste y cómo.
