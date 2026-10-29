# Agenda Vital

App personal para el iPhone: el día de hoy, agenda y tareas, clases particulares, gimnasio y running, comidas y sueño, dinero y deudas, tests del carnet, hábitos y un asistente con IA (Gemini).

Es una web app instalable: se abre a pantalla completa como una app normal y funciona sin conexión. **Tus datos se guardan solo en tu iPhone**; este repositorio contiene únicamente el código.

## Puesta en marcha

1. **Vercel**: importa este repositorio (*Add New → Project*) y despliega.
2. **Gemini (gratis)**: crea una clave en [Google AI Studio](https://aistudio.google.com) → *Get API key*.
3. **Upstash (gratis, para los avisos)**: en Vercel → tu proyecto → *Storage* (o *Marketplace*) → **Upstash → QStash** → conéctalo al proyecto. Añade solo `QSTASH_TOKEN` (y `QSTASH_URL` si te la da).
4. **Claves de los avisos**: abre `https://TU-APP.vercel.app/api/setup`. Te dice qué variables faltan y te genera `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` para copiarlas.
5. En Vercel → *Settings → Environment Variables* deben quedar:

   | Variable | Para qué |
   |---|---|
   | `GEMINI_API_KEY` | Asistente, fotos de comida y tickets, compras y resumen semanal |
   | `APP_TOKEN` | Una contraseña tuya: evita que otra persona use tu cupo |
   | `QSTASH_TOKEN` | Programar los avisos y la vigilancia de precios |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Enviar avisos al iPhone (desde `/api/setup`) |
   | `GEMINI_MODEL` (opcional) | Otro modelo; por defecto `gemini-flash-latest` |

   Después: *Deployments* → último → *Redeploy*. Vuelve a abrir `/api/setup`: todo debe salir en verde.
6. **En el iPhone**: abre la app en **Safari** → *Compartir* → *Añadir a pantalla de inicio*, y ábrela siempre desde ese icono.
7. En la app → *Ajustes*: escribe la contraseña de `APP_TOKEN` en *Asistente* y pulsa **Activar avisos**.

## Copias de seguridad

*Ajustes → Copia en archivo → Crear copia* y elige *Guardar en Archivos → iCloud Drive*. Para recuperar los datos en otro móvil: *Restaurar desde un archivo*. La app te recuerda hacer copia si pasa más de una semana.

## Archivos

- `index.html` – toda la app
- `api/ai.js` – función de Vercel que habla con Gemini (la clave nunca sale del servidor)
- `sw.js` – permite usarla sin conexión
- `manifest.webmanifest` e iconos – para instalarla en la pantalla de inicio

## Qué hace cada función

- `api/ai.js` – Gemini: asistente, fotos de comida y tickets, resumen semanal y búsqueda de compras (con Google)
- `api/push.js` – programa y cancela avisos en Upstash; activa la vigilancia de precios
- `api/notify.js` – Upstash lo llama a la hora de cada aviso y lo envía al iPhone
- `api/watch.js` – vigilancia diaria de precio de la lista de compras
- `api/setup.js` – página para comprobar la configuración

## Pendiente

- Leer capturas de sueño (Huawei Health), carreras y tiempo de uso con Gemini.
