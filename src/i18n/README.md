# Idiomas

Configuración de next-intl. La aplicación no usa prefijo de idioma en las URLs ni detecta el idioma del navegador.

- `config.ts`: los tres idiomas (`es`, `pt`, `en`), el idioma por defecto, la cookie `csa_locale` y `pickLocale()`, que se queda con el primer idioma válido de una lista.
- `request.ts`: decide el idioma de cada petición, en este orden:
  1. el del usuario con sesión (`getUserLocale()`, lo completa #8);
  2. la cookie `csa_locale`, que pone el selector con `POST /api/locale`;
  3. el idioma por defecto de la instalación (`getInstallationLocale()`, lo completa #9);
  4. si ninguno es válido, español.
- `preferences.ts`: las dos funciones que completan #8 y #9. Hoy devuelven `null`.
- `app-config.d.ts`: tipa las claves con `messages/es.json`, así TypeScript avisa si usas una clave que no existe.

Los textos están en `messages/es.json`, `pt.json` y `en.json`, en la raíz del repositorio. Cómo agregar una clave: [CONTRIBUTING](../../CONTRIBUTING.md#idiomas).
