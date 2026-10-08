# Instalar CallingSupportApp en tu barrio

Esta guía pone en línea **una instalación propia para tu barrio o rama**, con los planes gratuitos
de [Vercel](https://vercel.com) (la aplicación) y [Supabase](https://supabase.com) (la base de
datos), sin servidor propio. Si sabes copiar y pegar entre pestañas del navegador, te alcanza:
calcula **menos de una hora**.

Cada barrio tiene su propia instalación: su propio proyecto de Vercel y su propio proyecto de
Supabase. Los datos de tu barrio no se mezclan con los de nadie más.

> **No es un producto oficial** de La Iglesia de Jesucristo de los Santos de los Últimos Días.
> Es una herramienta comunitaria, y su uso se rige por las
> [pautas para recursos en línea en los llamamientos](https://www.churchofjesuschrist.org/tools/help/use-of-online-resources-in-church-callings?lang=spa)
> ([Manual General 38.8.21.2](https://www.churchofjesuschrist.org/study/manual/general-handbook/38-church-policies-and-guidelines?lang=spa#title_number158)).

## Contenido

0. [Antes de empezar](#0-antes-de-empezar)
1. [Requisitos](#1-requisitos)
2. [Crear la base de datos en Supabase](#2-crear-la-base-de-datos-en-supabase)
3. [Generar las dos claves secretas](#3-generar-las-dos-claves-secretas)
4. [Desplegar en Vercel](#4-desplegar-en-vercel)
5. [Crear la primera cuenta de administración](#5-crear-la-primera-cuenta-de-administración)
6. [Configuración inicial](#6-configuración-inicial)
7. [Primer viaje y una inscripción de prueba](#7-primer-viaje-y-una-inscripción-de-prueba)
8. [Actualizar y respaldar](#8-actualizar-y-respaldar)
9. [Problemas frecuentes](#9-problemas-frecuentes)
10. [Dar de baja la instalación](#10-dar-de-baja-la-instalación)

## 0. Antes de empezar

Antes de instalar, revisa esta lista. Sale de las pautas oficiales para recursos en línea:

- [ ] **La aprobación de tu obispo** (o del presidente de rama) para usar la aplicación en la unidad.
- [ ] **Al menos dos administradores**, para que la aplicación siga funcionando cuando cambie un llamamiento.
- [ ] Quién será el **responsable de los datos** de tu instalación, y un **contacto visible** de la unidad (no uno personal).
- [ ] El **aviso de que no es un producto oficial**: la aplicación ya lo muestra. El nombre de tu instalación **no lleva el logotipo ni el nombre oficial de la Iglesia**.
- [ ] **Sin publicidad** ni promoción de negocios.
- [ ] Un **plan para darla de baja** y borrar los datos cuando ya no se use (sección 10).

> ⚠️ **Nunca cargues datos reales para "probar".** Si quieres ensayar la instalación, usa nombres
> inventados y correos `@example.com`, y borra esa instalación de prueba al terminar.

## 1. Requisitos

- Una cuenta de [GitHub](https://github.com/signup), una de [Vercel](https://vercel.com/signup) (plan **Hobby**, gratuito) y una de [Supabase](https://supabase.com/dashboard/sign-up) (plan **Free**). Te conviene crear las de Vercel y Supabase **con la cuenta de GitHub**.
- Una cuenta de correo para enviar los avisos (ver [SMTP](#correo-smtp)).
- Un gestor de contraseñas o un lugar seguro donde guardar las claves de los pasos 2 y 3.

## 2. Crear la base de datos en Supabase

1. En el [panel de Supabase](https://supabase.com/dashboard), pulsa **New project**.
2. Nombre: por ejemplo `csa-mi-barrio`. **Region:** la más cercana a tu barrio.
3. **Database password:** pulsa *Generate a password* y guárdala en tu gestor de contraseñas.
4. Espera a que el proyecto termine de crearse (1–2 minutos).
5. Pulsa **Connect** (arriba) y abre la pestaña **Connection string** → **URI**. Copia **dos** cadenas:

| Cadena en Supabase | Puerto | Va en la variable |
|---|---|---|
| **Transaction pooler** | `6543` | `DATABASE_URL` |
| **Session pooler** | `5432` | `DIRECT_DATABASE_URL` |

En las dos, reemplaza `[YOUR-PASSWORD]` por la contraseña del punto 3.

> Usa el **Session pooler** y no la *Direct connection*: la conexión directa solo funciona por
> IPv6, y Vercel compila por IPv4. Si la contraseña tiene símbolos como `@`, `#` o `%`, escríbelos
> codificados (`%40`, `%23`, `%25`), o genera una contraseña solo con letras y números.

## 3. Generar las dos claves secretas

Necesitas dos claves de 64 caracteres hexadecimales:

- **`ENC_KEY`**: cifra los secretos que guardas en la aplicación (la contraseña del correo y el token de Telegram).
- **`CRON_SECRET`**: protege la tarea diaria que borra los datos vencidos.

Con una terminal (macOS, Linux o Git Bash en Windows), corre esto **dos veces**, una por clave:

```sh
openssl rand -hex 32
```

**Sin terminal:** abre cualquier página en el navegador, presiona `F12` → pestaña **Consola**, pega
esto y presiona Enter (dos veces, una por clave):

```js
Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')
```

> 🔑 **Guarda `ENC_KEY` en un lugar seguro y no la cambies.** Si se pierde o cambia, la aplicación
> ya no puede leer la contraseña SMTP ni el token de Telegram guardados, y hay que volver a
> escribirlos en **Configuración**. No hace falta guardar `CRON_SECRET` fuera de Vercel.

## 4. Desplegar en Vercel

1. Pulsa el botón:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMarAntBQ%2FCallingSupportApp&env=DATABASE_URL,DIRECT_DATABASE_URL,ENC_KEY,CRON_SECRET,APP_URL&envDescription=Las%20cinco%20variables%20se%20explican%20en%20la%20gu%C3%ADa%20de%20instalaci%C3%B3n.&envLink=https%3A%2F%2Fgithub.com%2FMarAntBQ%2FCallingSupportApp%2Fblob%2Fmain%2Fdocs%2Fdeploy.md%23variables&project-name=callingsupportapp&repository-name=callingsupportapp)

2. Vercel te pide un nombre para el repositorio y crea **una copia** en tu cuenta de GitHub. Puede
   ser privada.
3. Escribe las variables. El nombre del proyecto define tu dirección: si lo llamas
   `csa-mi-barrio`, la aplicación queda en `https://csa-mi-barrio.vercel.app`.
4. Pulsa **Deploy**. El primer despliegue **crea las tablas** en Supabase y compila la aplicación
   (3–5 minutos).
5. Revisa la dirección que te asignó Vercel (en **Domains**). Si es distinta de la que pusiste en
   `APP_URL` (pasa cuando el nombre ya estaba ocupado), corrígela en **Settings → Environment
   Variables** y redespliega.

### Variables

| Variable | ¿Obligatoria? | Qué poner |
|---|---|---|
| `DATABASE_URL` | Sí | La cadena del **Transaction pooler** (puerto 6543), del paso 2. |
| `DIRECT_DATABASE_URL` | Sí | La cadena del **Session pooler** (puerto 5432), del paso 2. Se usa para crear y actualizar las tablas. |
| `ENC_KEY` | Sí | La primera clave del paso 3. |
| `CRON_SECRET` | Sí | La segunda clave del paso 3. |
| `APP_URL` | Sí | La dirección pública de tu instalación, sin `/` al final; por ejemplo, `https://csa-mi-barrio.vercel.app`. La aplicación la usa para registrar el aviso por Telegram (webhook). |
| `APP_ENV` | Recomendada | `production`. Si no la pones, la aplicación funciona igual. |
| `RECAPTCHA_SECRET_KEY` y `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Opcionales | Las dos claves de [Google reCAPTCHA](https://www.google.com/recaptcha/admin) v3, para frenar robots en el formulario público. Si las pones, la política de datos nombra a Google entre las transferencias internacionales. |

Las variables opcionales se agregan después, en Vercel → tu proyecto → **Settings → Environment
Variables**. Como `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` se fija al compilar, después de agregarla hay
que **redesplegar** (Deployments → ⋯ → **Redeploy**).

La tarea diaria (`/api/cron/daily`, una vez al día, alrededor de las 08:00 UTC) ya viene programada en `vercel.json`: borra las
inscripciones cuyo plazo de conservación venció y las sesiones viejas. No tienes que configurar nada.

## 5. Crear la primera cuenta de administración

1. Abre `https://<tu-proyecto>.vercel.app/setup`.
2. Completa:
   - el tipo de unidad (barrio o rama) y su nombre, **sin** el nombre oficial de la Iglesia;
   - tu nombre, tu correo y una contraseña;
   - la **aprobación del obispo** (o del presidente de rama): quién aprobó y cuándo;
   - el **contacto de la instalación**: un correo o teléfono de la unidad, que se muestra en el pie de todas las páginas.
3. Pulsa **Crear cuenta y entrar**. `/setup` se puede usar **una sola vez**: después queda cerrado.

Esa cuenta es el **SuperAdmin**: quien instala y administra. Puede ser, por ejemplo, el secretario
del barrio, y tener también sus propios llamamientos.

## 6. Configuración inicial

En el panel, abre **Configuración**:

1. **General:** nombre de la unidad, zona horaria, idioma por defecto (español, portugués o
   inglés), contacto de la instalación y si las personas pueden registrarse solas.
2. **Logo:** opcional. No uses el logotipo de la Iglesia.
3. **Responsable de los datos:** nombre, correo, teléfono y domicilio de la unidad, ciudad y país, y
   los **meses de retención** de las inscripciones. Todo esto aparece en la política de datos
   (`/privacy`).
4. **Correo (SMTP)**, ver abajo.
5. **Bot de Telegram**, opcional, ver abajo.

Después, en **Organizaciones**: crea las organizaciones de tu unidad, sus llamamientos y los
permisos por módulo. Agrega al **segundo administrador** desde **Usuarios**.

### Correo (SMTP)

La aplicación envía correos (códigos de verificación, recuperación de contraseña y avisos) con la
cuenta que configures aquí. La contraseña se guarda cifrada con `ENC_KEY` y nunca se vuelve a
mostrar. Usa **una cuenta de la unidad**, no la personal.

- **Gmail:** activa la verificación en dos pasos en la cuenta y crea una
  [contraseña de aplicación](https://myaccount.google.com/apppasswords). Servidor `smtp.gmail.com`,
  puerto `465` con *Usar TLS desde el inicio* marcado, usuario = el correo completo y contraseña =
  la contraseña de aplicación (16 letras, sin espacios).
- **Un proveedor transaccional** (Brevo, Mailjet, Amazon SES u otro): copia del panel del proveedor el
  servidor, el puerto (normalmente `587`, sin marcar TLS desde el inicio) y el usuario y la clave SMTP.
  Úsalo solo para correos de la aplicación: estos proveedores suspenden las cuentas que mandan
  publicidad.

Pulsa **Guardar** y después **Enviar correo de prueba** a tu propio correo.

### Bot de Telegram (opcional)

1. En Telegram, habla con [@BotFather](https://t.me/BotFather), envía `/newbot` y sigue los pasos.
   Te entrega un **token**.
2. En **Configuración → Bot de Telegram**, escribe el usuario del bot (sin `@`) y el token, pulsa
   **Guardar** y después **Probar conexión**.
3. Cada persona vincula su cuenta desde **Mi perfil**.

## 7. Primer viaje y una inscripción de prueba

1. En el panel, abre **Viaje al Templo → Nuevo viaje**, completa los datos y marca **Viaje activo**.
2. Abre `https://<tu-proyecto>.vercel.app/temple-trip` en otra ventana (o en el teléfono): es el
   formulario público.
3. Inscribe a una persona **inventada**, con un correo `@example.com`.
4. Vuelve al panel: la inscripción aparece en los participantes del viaje.

Como son datos inventados, puedes dejarla: la tarea diaria la borra sola cuando vence el plazo de
conservación, junto con las demás inscripciones de ese viaje.

Si llegaste hasta aquí, la instalación funciona.

## 8. Actualizar y respaldar

### Actualizar a una versión nueva

El botón creó una **copia** del repositorio, no un *fork*, así que GitHub no ofrece el botón
*Sync fork*. Para traer la versión nueva, con una terminal:

```sh
git clone https://github.com/<tu-usuario>/<tu-repositorio>.git
cd <tu-repositorio>
git remote add upstream https://github.com/MarAntBQ/CallingSupportApp.git
git pull upstream main --no-rebase
git push origin main
```

Cada vez que subes cambios a `main`, Vercel vuelve a desplegar solo. Si la versión nueva trae tablas
nuevas, ese despliegue las crea antes de compilar.

Lee las [Novedades](https://callingsupportapp.org/updates/) antes de actualizar: avisan si alguna
versión pide un paso extra.

> ¿Prefieres no usar terminal? Puedes partir de un **fork**: en GitHub pulsa **Fork** en el
> repositorio y después, en Vercel, **Add New → Project** e **Import** del fork, con las mismas
> variables de la tabla. Así, para actualizar, basta con el botón **Sync fork** de GitHub.

### Respaldos

Los respaldos son los del plan de Supabase de tu proyecto. El plan gratuito **no** incluye copias
que puedas restaurar desde el panel; el plan Pro sí. Decide con tu obispo si la unidad los necesita.
Las copias que hagas por tu cuenta contienen datos de miembros: guárdalas solo donde el
responsable de los datos lo autorice y bórralas cuando venza el plazo de conservación.

## 9. Problemas frecuentes

**`/api/health` responde 503.** La aplicación no llega a la base de datos. Revisa:
- que `DATABASE_URL` sea la cadena del **Transaction pooler** (puerto 6543) y tenga la contraseña correcta, con los símbolos codificados;
- que el proyecto de Supabase no esté **pausado** (ver abajo).

Después de corregir una variable, **redespliega**.

**El primer despliegue falla al crear las tablas.** Casi siempre es `DIRECT_DATABASE_URL`: tiene que
ser la del **Session pooler** (puerto 5432), no la *Direct connection*.

**Los correos no llegan.**
- Usa **Enviar correo de prueba** en Configuración: el mensaje de error dice si falló la conexión o el usuario y la contraseña.
- Con Gmail, la contraseña es la **de aplicación**, no la de la cuenta.
- Revisa la carpeta de spam del destinatario.
- Si cambiaste `ENC_KEY`, vuelve a escribir la contraseña SMTP.

**El proyecto de Supabase está pausado.** Supabase pausa los proyectos gratuitos que pasan tiempo sin
actividad. La tarea diaria consulta la base todos los días, pero si igual se pausa, entra al panel de
Supabase y pulsa **Restore project**.

**`/setup` te lleva a `/login`.** Es lo esperado: `/setup` se usa una sola vez, y después la cuenta se crea o se recupera desde `/login`.

## 10. Dar de baja la instalación

Las pautas piden eliminar los recursos en línea cuando ya no se necesitan. Cuando tu unidad deje de
usar la aplicación:

1. Avisa a los usuarios y acuerda con el obispo y el responsable de los datos la fecha de baja.
2. **No** descargues ni conserves copias de los datos de los miembros, salvo lo que el responsable de
   los datos autorice expresamente.
3. En Supabase: tu proyecto → **Project Settings → General → Delete project**. Esto borra la base y
   todos sus datos de forma definitiva.
4. En Vercel: tu proyecto → **Settings → General → Delete Project**.
5. En GitHub: tu repositorio → **Settings → Delete this repository**.
6. Si configuraste un bot de Telegram, elimínalo con @BotFather (`/deletebot`). Si creaste una cuenta
   de correo solo para la aplicación, ciérrala.
