// Utilidades comunes de las funciones de Vercel de Agenda Vital.
export function readBody(req) {
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  return b;
}

// Si APP_TOKEN está configurado, solo responde a la app (o a Upstash, que reenvía la misma clave).
export function checkToken(req, res) {
  const t = process.env.APP_TOKEN;
  if (t && req.headers['x-app-token'] !== t) { res.status(401).json({ error: 'bad_app_token' }); return false; }
  return true;
}

export const baseUrl = req => `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

export function parseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const fence = String(text).match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// Llama a Gemini. search=true activa la búsqueda en Google (para la lista de compras).
export async function gemini(parts, { json = true, search = false } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('missing_gemini_key'); e.code = 503; throw e; }
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: search ? 0.4 : 0.2 } };
  if (json && !search) body.generationConfig.responseMimeType = 'application/json';
  if (search) body.tools = [{ google_search: {} }];
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body)
    });
  } catch { const e = new Error('gemini_unreachable'); e.code = 502; throw e; }
  if (r.status === 429) { const e = new Error('gemini_quota'); e.code = 429; throw e; }
  if (!r.ok) { const e = new Error('gemini_error ' + r.status + ' ' + (await r.text()).slice(0, 300)); e.code = 502; throw e; }
  const d = await r.json();
  const c = d?.candidates?.[0];
  const text = (c?.content?.parts || []).map(p => p.text || '').join('');
  const sources = (c?.groundingMetadata?.groundingChunks || []).map(g => g.web).filter(Boolean)
    .map(w => ({ title: String(w.title || ''), url: String(w.uri || '') })).slice(0, 8);
  return { text, sources };
}

// Upstash QStash (programar avisos). QSTASH_URL es opcional (por defecto la región de Europa).
export async function qstash(method, path, { body, headers } = {}) {
  const token = process.env.QSTASH_TOKEN;
  if (!token) { const e = new Error('missing_qstash_token'); e.code = 503; throw e; }
  const base = (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/$/, '');
  const r = await fetch(base + path, {
    method,
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  if (!r.ok) { const e = new Error('qstash ' + r.status + ' ' + t.slice(0, 200)); e.code = r.status; throw e; }
  return j || {};
}

// Cabecera para que Upstash reenvíe la clave de la app a nuestras funciones.
export const forwardToken = () => (process.env.APP_TOKEN ? { 'Upstash-Forward-X-App-Token': process.env.APP_TOKEN } : {});

export async function sendPush(sub, payload) {
  const { default: webpush } = await import('web-push');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:agenda-vital@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'normal' });
}

export const pushReady = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.QSTASH_TOKEN);

export const shopPrompt = (item, max, pref) => `Eres un asesor de compras en España. Busca en internet opciones que se vendan ahora para: ${JSON.stringify(item)}.${max ? ' Presupuesto máximo: ' + max + ' €.' : ''}${pref ? ' Preferencias: ' + JSON.stringify(pref) + '.' : ''}
Devuelve de 3 a 4 opciones concretas (marca y modelo exactos) disponibles en tiendas online que envíen a España, con su precio actual aproximado en euros. Prioriza las que mejor encajen con las preferencias y el presupuesto; si no hay ninguna dentro del presupuesto, dilo en "tip".
Responde SOLO con JSON, sin texto antes ni después: {"options":[{"name":"","price":0,"store":"","why":"por qué encaja, en una frase","url":"enlace a la ficha del producto si lo conoces, si no vacío"}],"tip":"consejo breve"}`;
