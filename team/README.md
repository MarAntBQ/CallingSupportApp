# Equipo: CSATeam

**CSATeam (Calling Support App Team)** es la comunidad de personas que hacen CallingSupportApp.
Todas somos colaboradoras y ninguna es más que otra: no hay creador, ni dueños, ni líderes del
proyecto. Las decisiones se toman en los issues y, por encima de todo, manda el
[Manual General](https://www.churchofjesuschrist.org/study/manual/general-handbook?lang=spa).

Cada persona que se suma agrega aquí **su propio perfil**, escrito por ella misma. Todos
los perfiles tienen el mismo formato y aparecen en orden alfabético.

## Agrega tu perfil (tu primer aporte)

1. Crea el archivo `team/<tu-usuario-de-github>.md` copiando la plantilla de abajo.
2. Escribe lo que quieras que se sepa de ti, en el idioma que prefieras.
3. Abre un PR solo con ese archivo. Es el único aporte que no necesita issue ni `/tomar`.
4. La prueba `node --test .github/scripts/team-profiles.test.cjs` revisa el formato.

```markdown
---
name: Nombre con el que quieres aparecer
github: tu-usuario
country: País (opcional)
languages: [es, pt, en]
since: 2026-10
links:
  - https://tu-sitio.dev
---

Dos a cuatro líneas sobre ti, en tus palabras.

**Cómo aporto:** qué te gusta hacer en el proyecto (código, diseño, traducciones, pruebas, ideas…).
```

## Reglas del perfil

- `name` y `github` son obligatorios, y `github` debe coincidir con el nombre del archivo.
- `country`, `languages`, `since` y `links` son opcionales.
- El texto tiene como máximo 600 caracteres.
- **Nada de datos sensibles:** ni cédula, ni teléfono, ni dirección.
- **Sin títulos de jerarquía:** ni «líder», ni «fundador», ni «creador», ni «jefe». En CSATeam
  todos somos colaboradores.
- Solo tú escribes y cambias tu perfil. Si quieres salir del equipo, abre un PR que lo borre.
