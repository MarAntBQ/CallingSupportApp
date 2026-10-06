---
name: trabajar-un-issue
description: Flujo completo para tomar un issue de CallingSupportApp y entregarlo — elegir uno disponible, confirmar que se autocontiene, crear la rama, implementar solo el alcance, verificar ejecutando, revisar con la skill revisar-codigo, abrir el PR con la plantilla y responder la revisión hasta el squash. Úsala cuando digan "toma el issue #N", "trabaja el issue", "quiero colaborar, ¿por dónde empiezo?", o al empezar cualquier cambio en el repo.
---

# Trabajar un issue

## 1. Elegir

```sh
gh issue list --state open --search "no:assignee -label:bloqueado"
gh issue view <n>
```

Un issue está disponible si **no tiene a nadie asignado**, **no tiene la etiqueta `bloqueado`**
y todos los issues de su sección *Dependencias* están cerrados. Si es tu primera vez,
busca `good first issue`. Un issue a la vez.

## 2. Confirmar que se autocontiene

Lee el issue completo y los archivos que enlaza (si es un port, ver skill `portar-desde-legacy`).
Antes de escribir código, responde:

- ¿Sé qué tengo que entregar y cómo se comprueba?
- ¿Sé qué **no** entra?
- ¿Hay alguna decisión que tendría que adivinar?

Si algo falta, **pregunta en el issue**, no por chat, y espera a que el issue se corrija. Así
la respuesta queda para el siguiente.

## 3. Tomarlo

Comenta en el issue `Lo tomo` y asígnatelo (`gh issue edit <n> --add-assignee @me`).

## 4. Rama

Siempre desde `main` actualizado, con el tipo y el número del issue. Si no eres colaborador
del repositorio, trabaja desde tu fork y usa `upstream` en lugar de `origin` (ver la sección
3 de [CONTRIBUTING](../../../CONTRIBUTING.md)).

```sh
git switch main && git pull
git switch -c feat/<n>-titulo-corto     # o fix/, docs/, chore/, refactor/, test/
```

## 5. Implementar

- **Solo el alcance del issue.** Si encuentras otro problema, abre un issue nuevo (skill
  `escribir-un-issue`) y sigue con el tuyo.
- Respeta las reglas de [AGENTS.md](../../../AGENTS.md): stack, idiomas, glosario, interfaz.
- Todo texto visible va en `messages/es.json`, `pt.json` y `en.json`, nunca escrito en el
  componente. El issue trae los textos en español; tú agregas el portugués y el inglés
  usando el glosario de AGENTS.md.
- Si tocas datos de personas, aplica la skill `datos-de-miembros` mientras diseñas, no al final.
- Commits pequeños con tipo y en español: `feat: inscripción pública con cupos`.
  Sin líneas de co-autoría de herramientas de IA.

## 6. Verificar ejecutando

Corre typecheck, lint, build y las pruebas, y recorre el flujo real en el navegador
(escritorio y móvil si toca la interfaz). Guarda el output: va pegado en el PR.

## 7. Revisar antes del PR

Corre la skill `revisar-codigo` sobre tu diff y resuelve lo que encuentre. Es obligatorio.

## 8. Abrir el PR

```sh
git push -u origin <rama>
gh pr create --base main
```

Llena la plantilla completa:
- `Closes #<n>` (en inglés, para que GitHub cierre el issue).
- **Cómo probar**, paso a paso.
- Verificación con el output pegado. Marca solo lo que corriste; lo que no aplica, N/A con
  el motivo.
- Si hiciste algo más o distinto de lo que pedía el issue, dilo en el resumen.

## 9. Responder la revisión

Cada hallazgo se contesta con `CORREGIDO` (y el commit) o con la evidencia `archivo:línea`
de por qué no aplica. Resuelve las conversaciones: `main` no acepta el merge con
conversaciones abiertas.

## 10. Cierre

El merge lo hace el responsable del repositorio, siempre por **squash**. La rama se borra
sola. Después:

```sh
git switch main && git pull
git branch -d <rama>
```
