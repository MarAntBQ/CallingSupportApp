---
name: escribir-un-issue
description: Cómo escribir un issue AUTOCONTENIDO para CallingSupportApp — que alguien que no estuvo en ninguna conversación pueda tomarlo y entregarlo sin preguntar. Incluye la regla, la lista de comprobación, los antipatrones, el tamaño correcto, etiquetas, milestones y dependencias. Úsala al crear un issue nuevo, al dividir una propuesta de módulo en tareas, o cuando alguien pregunta algo en un issue que el issue debió responder (entonces se corrige el issue).
---

# Escribir un issue

## La regla

> **El issue se autocontiene.** Quien lo tome tiene que poder terminarlo leyendo solo el
> issue y los archivos que enlaza, sin preguntar nada a nadie.

El colaborador no estuvo en la llamada, no ve el tablero del autor y no leyó el chat. Lo que
no está escrito en el issue, para él no existe.

## Qué tiene que llevar

Usa la plantilla **Tarea** (`gh issue create --template work-item.yml` o desde "New issue").
Cada sección responde una pregunta:

| Sección | Pregunta que responde |
|---|---|
| Resultado | ¿Qué cambia cuando esté terminado, y para quién? |
| Contexto y decisiones | ¿Por qué se hace? ¿Qué ya está decidido y no se discute? |
| Referencia en la v1 | Si es un port: ¿qué archivos y funciones de la rama `legacy` mirar? |
| Alcance | ¿Qué entra? |
| Exclusiones | ¿Qué parece que entra pero no? |
| Especificación | ¿Qué datos, campos, reglas, pantallas, rutas y permisos? |
| Criterios de aceptación | ¿Qué se puede observar para decir "listo"? |
| Verificación | ¿Con qué comandos o pasos se demuestra? |
| Dependencias | ¿Qué tiene que estar cerrado antes? ¿Qué desbloquea? |

**Textos de la interfaz:** escríbelos en español dentro del issue (es el idioma de origen).
Quien lo implemente agrega el portugués y el inglés; no hace falta escribirlos en el issue.

## Comprobación final

Antes de publicarlo, léelo como si no supieras nada del proyecto:

- [ ] ¿Podría empezar a programar ahora mismo, sin preguntar?
- [ ] ¿Cada regla de negocio está escrita con sus números y casos borde?
- [ ] ¿Las rutas de la v1 son exactas (`backend/src/...`), no "como en la v1"?
- [ ] ¿Cada criterio de aceptación se puede comprobar mirando algo?
- [ ] ¿No hay enlaces a cosas privadas como única fuente (Trello privado, chats, repos privados)?
- [ ] ¿No hay datos de personas reales ni secretos?
- [ ] ¿Cabe en un solo PR que alguien pueda revisar en una sentada?

## Antipatrones

| Así no | Así sí |
|---|---|
| "Como lo hablamos" | La decisión escrita en *Contexto y decisiones* |
| "Igual que en la v1" | `backend/src/templo/templo.service.ts` → `aprobarParticipante()`, y la regla copiada |
| "Mejorar la pantalla de viajes" | Qué cambia exactamente y cómo se ve terminado |
| "Arreglar los cupos" | El caso que falla, el esperado y el real |
| Un issue con el módulo completo | Un issue por resultado: modelo de datos, formulario público, aprobación... |
| Criterio "funciona bien" | "Al aprobar el participante 21 con 20 cupos, la API responde 409 y el cupo no cambia" |

## Tamaño

Un issue = **un resultado** que se entrega y se revisa solo. Señales de que hay que dividirlo:
la especificación pasa de una pantalla, tiene más de un "y además", o mezcla modelo de datos,
API e interfaz de dos funcionalidades distintas.

## Ideas que todavía no se pueden especificar

Si faltan decisiones (por ejemplo, un módulo nuevo como el campamento), **no** es una Tarea:
usa la plantilla **Propuesta de módulo**. Cuando sus preguntas abiertas se responden, se
divide en Tareas autocontenidas y la propuesta las enlaza.

## Etiquetas

| Etiqueta | Cuándo |
|---|---|
| `bug` | Defecto reproducible (lo pone la plantilla Bug) |
| `enhancement` | Tarea nueva o mejora (lo pone la plantilla Tarea) |
| `documentation` | Solo documentación |
| `port-v1` | Lleva a la versión nueva algo que ya existe en la rama `legacy` |
| `módulo-nuevo` | Funcionalidad que no existe en la v1 |
| `infraestructura` | Esqueleto, CI, despliegue, configuración del proyecto |
| `datos-sensibles` | Recoge, guarda, muestra o exporta datos de personas |
| `bloqueado` | Tiene dependencias abiertas. Se quita cuando se cierran |
| `necesita-diseño` | Faltan decisiones; todavía no se puede tomar |
| `good first issue` | Acotado y con poco contexto previo, ideal para empezar |
| `help wanted` | Disponible para cualquier colaborador |

## Milestones

| Milestone | Contenido |
|---|---|
| 1 · Base | Esqueleto, autenticación, usuarios, permisos, configuración, correo |
| 2 · Viaje al Templo | Port completo del módulo de la v1 |
| 3 · Listo para otros barrios | Guía de despliegue, política de datos configurable, purga |
| 4 · Módulos nuevos | Campamento, EnglishConnect |

## Cuando alguien pregunta en un issue

Responde **y corrige el cuerpo del issue** con la respuesta. Si solo contestas en un
comentario, el siguiente que lo lea vuelve a tener la misma duda.
