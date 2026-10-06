## Resumen

<!-- Qué cambió y por qué. Si el PR hace algo más o distinto de lo que pidió el issue, dilo aquí. -->

## Issue enlazado

<!-- `Closes #123` si este PR completa el issue, o `Refs #123` si no lo cierra. En inglés: GitHub no reconoce "Cierra". -->

## Cómo probar

<!-- Pasos para que el revisor lo compruebe por su cuenta: ruta, qué hacer, qué debería ver. -->

1.

## Verificación

<!-- Solo lo que SÍ se corrió, con el output pegado. Un checkbox marcado sin haberlo probado convierte el PR en un documento que miente. N/A con el motivo si no aplica. -->

- [ ] `typecheck`, `lint` y `build` pasan (pega el output)
- [ ] Pruebas automáticas relevantes
- [ ] Recorrido manual del flujo afectado, en escritorio y en móvil si toca la interfaz
- [ ] Capturas de pantalla si cambió la interfaz (sin datos de personas reales)
- [ ] Textos nuevos en español, portugués e inglés; `npm run i18n:check` pasa

## Revisión

- [ ] Corrí la skill `revisar-codigo` sobre mi propio diff y resolví lo que encontró
- [ ] Si toca datos de personas: pasé la skill `datos-de-miembros`

## Seguridad y operación

<!-- Migración de datos, datos personales, efectos en servicios externos, rollback. N/A si no aplica. -->

- [ ] No se agregaron credenciales, archivos `.env` ni datos de personas reales
- [ ] Si cambia el esquema: incluye su migración y se probó desde una base vacía
- [ ] Si recoge datos de personas: pide consentimiento y respeta la retención

---

> Este PR entra a `main` por **squash**. Un issue, un PR, un commit.
