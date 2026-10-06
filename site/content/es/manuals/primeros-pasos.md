---
title: Primeros pasos: instalar en tu barrio
description: Cómo instalar CallingSupportApp en tu barrio o rama y dejarlo listo para usar: requisitos, configuración inicial y primeros usuarios. Manual en preparación.
updated: 2026-10-06
order: 1
---

> **Estado:** en preparación. La instalación llega con los issues [#4](https://github.com/MarAntBQ/CallingSupportApp/issues/4) (esqueleto), [#8](https://github.com/MarAntBQ/CallingSupportApp/issues/8) (primer administrador) y [#27](https://github.com/MarAntBQ/CallingSupportApp/issues/27) (guía de despliegue).

## Antes de empezar

Antes de instalar, revisa esta lista. Sale de las [pautas oficiales para recursos en línea en los llamamientos](https://www.churchofjesuschrist.org/tools/help/use-of-online-resources-in-church-callings?lang=spa) (Manual General 38.8.24.2):

- [ ] **La aprobación de tu obispo** para usar la aplicación en la unidad.
- [ ] **Al menos dos administradores**, para que la aplicación siga funcionando cuando cambie un llamamiento.
- [ ] Quién será el **responsable de los datos** de tu instalación, y un **contacto visible** dentro de la aplicación.
- [ ] El **aviso de que no es un producto oficial** de la Iglesia, sin su logotipo ni su nombre oficial en el nombre de la instalación.
- [ ] **Sin publicidad** ni promoción de negocios.
- [ ] Un **plan para darla de baja** y borrar los datos cuando ya no se use.
- [ ] Una cuenta gratuita de GitHub, de Vercel y de Supabase.

## Cuando esté lista, los pasos serán

1. Crear la base de datos en Supabase.
2. Desplegar la aplicación en Vercel con el botón "Deploy".
3. Abrir `/setup` y crear la primera cuenta de administración.
4. En **Configuración**: nombre de la unidad, logo, idioma por defecto y responsable de los datos.
5. Crear las organizaciones y los llamamientos, y dar permisos por módulo.

Este manual se completa paso a paso, con capturas, a medida que se cierran esos issues.
