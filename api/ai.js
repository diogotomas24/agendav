// Asistente de Agenda Vital: recibe el texto preparado por la app y se lo pasa a Gemini.
// Variables de entorno en Vercel:
//   GEMINI_API_KEY  (obligatoria)  clave gratuita de Google AI Studio
//   APP_TOKEN       (recomendada)  una contraseña tuya; la app la envía para que nadie más use tu cupo
//   GEMINI_MODEL    (opcional)     por defecto "gemini-flash-latest"
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'missing_gemini_key' });

  const token = process.env.APP_TOKEN;
  if (token && req.headers['x-app-token'] !== token) return res.status(401).json({ error: 'bad_app_token' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const prompt = String(body.prompt || '').slice(0, 60000);
  if (!prompt) return res.status(400).json({ error: 'empty_prompt' });

  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });
  } catch {
    return res.status(502).json({ error: 'gemini_unreachable' });
  }
  if (r.status === 429) return res.status(429).json({ error: 'gemini_quota' });
  if (!r.ok) return res.status(502).json({ error: 'gemini_error', status: r.status, detail: (await r.text()).slice(0, 400) });

  const data = await r.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  let out = null;
  try { out = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    try { out = m ? JSON.parse(m[0]) : null; } catch { out = null; }
  }
  if (!out || typeof out !== 'object') return res.status(502).json({ error: 'bad_json' });
  return res.status(200).json({ reply: String(out.reply || ''), actions: Array.isArray(out.actions) ? out.actions : [] });
}
