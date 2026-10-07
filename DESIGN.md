---
name: CallingSupportApp
description: Interfaz cálida y colaborativa para líderes y secretarios voluntarios. Un solo color de acción, neutros piedra, tablas densas para trabajar y contraste WCAG AA en todo texto.
colors:
  primary: "#7C3AED"
  primary-strong: "#6D28D9"
  on-primary: "#FFFFFF"
  secondary: "#F43F5E"
  secondary-strong: "#BE123C"
  tertiary: "#84CC16"
  tertiary-strong: "#4D7C0F"
  bg: "#FAFAF9"
  surface: "#FFFFFF"
  surface-muted: "#F5F5F4"
  border: "#E7E5E4"
  border-strong: "#D6D3D1"
  text: "#1C1917"
  text-muted: "#57534E"
  success: "#22C55E"
  success-strong: "#15803D"
  warning: "#F59E0B"
  warning-strong: "#B45309"
  danger: "#EF4444"
  danger-strong: "#B91C1C"
  info: "#7C3AED"
typography:
  family: Inter
rounded:
  sm: 6px
  md: 10px
  full: 9999px
---

# CallingSupportApp — sistema de diseño

> Cálida, colaborativa y tranquila para trabajar. La usan voluntarios de todas las edades, en computadoras viejas y en teléfonos.

Los valores viven en [`src/app/globals.css`](src/app/globals.css) (`@theme` de Tailwind v4). Este documento explica **cuándo** usar cada uno. Un color nuevo entra primero a `globals.css` y a este archivo; nunca se escribe un color suelto en un componente (una prueba lo impide).

## Principios

1. **No parece una herramienta oficial.** La app no es de la Iglesia y no debe confundirse con una (Manual General 38.8.24.2). No usamos la tipografía, los colores, los íconos, el logotipo ni el nombre de ningún sitio o aplicación de la Iglesia.
2. **Familiar para quien ya trabaja con registros.** Tablas densas, edición en la misma fila, avisos discretos: patrones de trabajo administrativo comunes, para que un secretario se sienta en casa desde el primer día.
3. **Legible para todos.** Todo texto cumple WCAG AA (4.5:1). El color nunca es la única señal: siempre va con texto o un ícono.
4. **Las personas al centro.** Nombres y avatares cerca de lo que cada uno hace.

## Colores

| Token | Valor | Uso |
|---|---|---|
| `primary` | `#7C3AED` | **El único color de acción:** botones principales, enlaces, navegación activa, el ícono de editar, el dato del período actual |
| `primary-strong` | `#6D28D9` | Hover y estado presionado de lo `primary` |
| `on-primary` | `#FFFFFF` | Texto sobre `primary` y `primary-strong` |
| `secondary` | `#F43F5E` | Solo **relleno**: avisos nuevos, menciones, puntos de presencia |
| `secondary-strong` | `#BE123C` | Texto de esa familia |
| `tertiary` | `#84CC16` | Solo **relleno**: completado, barras de progreso |
| `tertiary-strong` | `#4D7C0F` | Texto de esa familia |
| `bg` | `#FAFAF9` | Fondo de la aplicación (piedra cálida, nunca gris frío) |
| `surface` | `#FFFFFF` | Tarjetas, modales, paneles |
| `surface-muted` | `#F5F5F4` | Filas alternas de las tablas, botones deshabilitados |
| `border` / `border-strong` | `#E7E5E4` / `#D6D3D1` | Separadores / bordes de campos |
| `text` / `text-muted` | `#1C1917` / `#57534E` | Texto principal / secundario (etiquetas, fechas) |
| `success`, `warning`, `danger` | `#22C55E`, `#F59E0B`, `#EF4444` | Solo **íconos y rellenos** de estado |
| `success-strong`, `warning-strong`, `danger-strong` | `#15803D`, `#B45309`, `#B91C1C` | **Texto** de estado (mensajes de error, confirmaciones) |
| `info` | `#7C3AED` | Igual que `primary` |

**¿Por qué hay dos versiones de algunos colores?** El rosa, el lima y los de estado son vivos y se ven bien como relleno, pero sobre blanco no llegan al contraste mínimo para leer (entre 2:1 y 3.8:1). Para texto se usa siempre su versión `-strong` (entre 5:1 y 7:1).

Contraste de cada token de texto, medido contra `surface`: `text` 17.5 · `text-muted` 7.6 · `primary` 5.7 · `primary-strong` 7.1 · `secondary-strong` 6.3 · `tertiary-strong` 5.0 · `success-strong` 5.0 · `warning-strong` 5.0 · `danger-strong` 6.5. La prueba `src/app/design-tokens.test.ts` lo verifica también sobre `bg` y `surface-muted`.

## Tipografía

**Inter** para todo, incluidos números y tablas, cargada con `next/font` desde el propio sitio.

| Uso | Tamaño | Peso |
|---|---|---|
| Título de página | 30px (`text-3xl`) | 600 |
| Título de sección | 20px (`text-xl`) | 600 |
| Título de tarjeta | 18px (`text-lg`) | 600 |
| Texto | 16px (`text-base`) | 400 |
| Etiquetas, tablas, metadatos | 14px (`text-sm`) | 400–500 |
| Cifra principal de un panel | 40px (`text-4xl`) | 300 |
| Texto de los campos | 16px | 400 — en el teléfono, un campo con menos de 16px provoca zoom |

## Formas y profundidad

- **Radios:** `rounded-sm` (6px) en campos y botones, `rounded-md` (10px) en tarjetas y modales, `rounded-full` en avatares e insignias.
- **Sombras:** `shadow-sm` para menús y campos, `shadow-md` para tarjetas y modales. Siempre neutras; nunca de color.
- **Espaciado:** múltiplos de 4px. Holgado entre bloques (24–32px), compacto dentro de una tabla (8–12px).

## Patrones de interfaz

- **Un solo color de acción.** Lo secundario va con contorno (`border-primary` + `text-primary`) o como texto; nunca con otro color de marca.
- **Botones:** como máximo **tres acciones por tarjeta**, con la principal clara. El botón principal queda gris (`surface-muted` + `text-muted`, cursor no permitido) mientras el formulario no es válido; no basta con bajarle la opacidad.
- **Tablas densas para trabajar:** filas alternadas con `surface-muted` en lugar de líneas entre filas; encabezados de 14px en `text-muted`; un ícono de lápiz en `primary` al final de cada fila para editar ahí mismo; los valores vacíos en cursiva con texto ("Llamamiento vacante"), no con un guion. Debajo de cada grupo, el recuento ("Total: 4") y la acción "+ Agregar" como enlace. Búsqueda, orden y paginación con el componente de #7.
- **Formularios:** etiqueta arriba del campo en `text-muted`; campo blanco con borde `border-strong` y foco visible en `primary`; el error es un texto `danger-strong` de 14px debajo del campo, acompañado de un ícono, sin cambiar el campo de color.
- **Avisos:** tarjeta blanca con un ícono de color a la izquierda (`primary` informativo, `warning` aviso, `danger` error) y texto en `text`. Sin fondo teñido.
- **Cifras del panel:** un número grande y liviano para el dato principal, con su etiqueta encima en `text-muted`.
- **Gráficos:** los períodos anteriores en neutros piedra y solo el período actual en color.
- **Personas:** avatar redondo junto al nombre, en tareas, llamamientos y comentarios. Sin foto, las iniciales sobre `surface-muted`.
- **Navegación:** barra superior blanca con el nombre de la unidad, el menú y el selector de idioma. En el teléfono, el menú se pliega en un botón y las tarjetas se apilan en una columna. Sin desplazamiento horizontal a 360px.
- **Modales:** título y botones fijos; solo el contenido se desplaza.
- **Cursor:** todo lo que se puede clickear muestra la **mano** (botones, enlaces, selectores, casillas, radios y las etiquetas que los envuelven); lo deshabilitado, **no permitido**; los campos de texto, el cursor de texto. Lo resuelve una regla global en `globals.css`: no hace falta poner `cursor-pointer` en cada componente.

## Sí y no

**Sí**
- Usa los tokens con sus clases de Tailwind (`bg-surface`, `text-text-muted`, `border-border`).
- Para texto de color, usa la variante `-strong`.
- Muestra quién hizo o tiene a cargo cada cosa.
- Prueba cada pantalla en un ancho de teléfono y en los tres idiomas: el portugués y el inglés suelen ser más largos.

**No**
- No escribas colores (`#…`, `rgb(…)`) fuera de `globals.css`. Tampoco funcionan las clases de la paleta por defecto de Tailwind (`text-red-500`): `globals.css` las desactiva.
- No uses `secondary`, `tertiary`, `success`, `warning` ni `danger` como color de texto.
- No pongas un segundo color de marca para competir con `primary`.
- No tiñas el fondo de un aviso; el ícono lleva el color.
- No uses la tipografía, los colores ni la marca de la Iglesia.

## Créditos

La paleta y parte de las reglas de este sistema vienen de [**TeamSync**](https://designmd.ai/chef/teamsync), de [chef](https://designmd.ai/chef), publicado con licencia MIT:

> Copyright (c) chef
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Las variantes `-strong`, los neutros de texto, los patrones de interfaz y todo lo demás son de este proyecto.
