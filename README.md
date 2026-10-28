# Agenda Vital

App personal para el iPhone: el día de hoy, agenda y tareas, clases particulares, gimnasio y running, comidas y sueño, dinero y deudas, tests del carnet, hábitos y un asistente con IA (Gemini).

Es una web app instalable: se abre a pantalla completa como una app normal y funciona sin conexión. **Tus datos se guardan solo en tu iPhone**; este repositorio contiene únicamente el código.

## Puesta en marcha (una vez)

1. **Vercel**: entra en vercel.com → *Add New → Project* → importa este repositorio → *Deploy*. No hace falta tocar ninguna opción.
2. **Clave de Gemini (gratis)**: en [Google AI Studio](https://aistudio.google.com) → *Get API key* → crea una clave.
3. En Vercel → tu proyecto → *Settings → Environment Variables* añade:
   - `GEMINI_API_KEY` = la clave de Google
   - `APP_TOKEN` = una contraseña que te inventes (evita que otra persona gaste tu cupo si encuentra la dirección)
   - (opcional) `GEMINI_MODEL` si quieres otro modelo; por defecto `gemini-flash-latest`

   Después, en *Deployments*, vuelve a desplegar el último (*Redeploy*) para que coja las variables.
4. **En el iPhone**: abre la dirección de Vercel en **Safari** → botón *Compartir* → *Añadir a pantalla de inicio*.
5. En la app → *Ajustes* → *Asistente (Gemini)* → escribe la misma contraseña de `APP_TOKEN`.

## Copias de seguridad

*Ajustes → Copia en archivo → Crear copia* y elige *Guardar en Archivos → iCloud Drive*. Para recuperar los datos en otro móvil: *Restaurar desde un archivo*. La app te recuerda hacer copia si pasa más de una semana.

## Archivos

- `index.html` – toda la app
- `api/ai.js` – función de Vercel que habla con Gemini (la clave nunca sale del servidor)
- `sw.js` – permite usarla sin conexión
- `manifest.webmanifest` e iconos – para instalarla en la pantalla de inicio

## Pendiente

- Avisos (notificaciones) con Upstash QStash.
- Leer capturas de sueño (Huawei Health), carreras y tiempo de uso con Gemini (fotos de comida y tickets ya funcionan).
- Bloqueo con Face ID.
