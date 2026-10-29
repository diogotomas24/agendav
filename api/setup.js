// Página de comprobación: abre /api/setup para ver qué falta por configurar en Vercel.
// Si faltan las claves de los avisos (VAPID), genera un par nuevo para copiarlas.
export default async function handler(req, res) {
  const need = ['GEMINI_API_KEY', 'APP_TOKEN', 'QSTASH_TOKEN', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
  const missing = need.filter(k => !process.env[k]);
  let keys = null;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    const { default: webpush } = await import('web-push');
    keys = webpush.generateVAPIDKeys();
  }
  const row = k => `<li>${missing.includes(k) ? '❌' : '✅'} <code>${k}</code></li>`;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(200).send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configuración · Agenda Vital</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#000;color:#f2f3f5;margin:0;padding:24px;max-width:640px}code{background:#1d1f25;padding:2px 6px;border-radius:6px;word-break:break-all}li{margin:6px 0}h1{font-size:24px}.k{background:#121317;border:1px solid #2a2d35;border-radius:12px;padding:12px;margin:10px 0}</style></head><body>
<h1>Configuración de Agenda Vital</h1>
<p>Variables de entorno en Vercel (Settings → Environment Variables):</p><ul>${need.map(row).join('')}</ul>
${keys ? `<p>Para los avisos, añade estas dos variables (se generan nuevas cada vez que abres esta página; usa un par y no lo cambies después):</p>
<div class="k"><b>VAPID_PUBLIC_KEY</b><br><code>${keys.publicKey}</code></div><div class="k"><b>VAPID_PRIVATE_KEY</b><br><code>${keys.privateKey}</code></div>` : ''}
<p>${missing.length ? 'Cuando las añadas, haz <b>Redeploy</b> en Vercel y vuelve a abrir esta página.' : 'Todo listo. Activa los avisos en la app: Ajustes → Avisos.'}</p></body></html>`);
}
