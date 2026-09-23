# Cómo se trabaja en este repositorio

Mismo flujo formal que uso en los repos de la empresa. Nada entra a la rama base sin pasar
por aquí — tampoco los cambios míos.

## El recorrido

```
Tarjeta en Trello  →  Issue en GitHub  →  Rama  →  Pull Request  →  Squash a la rama base
```

**1. Tarjeta en el tablero.** Toda tarea nace ahí. Es donde se decide si algo entra al trabajo
de esta semana o no. Si no hay tarjeta, todavía no es una tarea: es una idea.

**2. Issue en GitHub.** La tarjeta dice *qué queremos*; el issue dice *qué se va a construir y
cómo se comprueba*. Se abre con una de las plantillas y **obliga a declarar el alcance, las
exclusiones, los criterios de aceptación y la verificación antes de escribir código**. Ese es
el punto: pensar la aceptación primero evita el trabajo que después hay que rehacer.

Un issue = **un resultado**. Si dos cosas pueden aceptarse y desplegarse por separado, son dos
issues.

**3. Rama.** Desde la rama base, con nombre corto y con el número del issue:

```
feat/123-titulo-corto
fix/124-titulo-corto
chore/125-titulo-corto
docs/126-titulo-corto
```

**4. Pull Request.** Con la plantilla. Dos reglas que no se saltan:

- **Enlazar el issue** (`Closes #123`).
- **Marcar solo lo que de verdad se probó.** Un checkbox marcado sin haberlo corrido es peor
  que dejarlo vacío, porque convierte el PR en un documento que miente.

**5. Squash.** El PR entra a la rama base con **squash merge**, siempre. Un issue, un PR, un
commit en el historial. La rama se borra al mezclar.

## Por qué squash y no otra cosa

El historial de la rama base debe poder leerse como la lista de lo que se entregó, no como el
diario de cómo se llegó. Los quince commits de "wip", "arreglo", "ahora sí" son útiles mientras
trabajas y ruido después. Squash los deja en uno solo, con el título del PR y el issue enlazado.

## Mensajes de commit

Al hacer squash, el título del commit es el título del PR. Formato:

```
feat(portafolio): agregar TJ Viajes VIP

Closes #123
```

Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`.

**Prohibido** agregar líneas de co-autoría de herramientas de IA. Los commits van a mi cuenta y
son parte de cómo me presento profesionalmente.

## Qué NO hace un merge

Mezclar a la rama base **no despliega nada**. El despliegue a producción es un paso aparte y
deliberado. Que algo esté en la rama base significa que está aceptado, no que esté publicado.

## Excepción

La única: un incidente en producción. Ahí se arregla primero y se documenta el issue después,
el mismo día, con la evidencia de lo que pasó.
