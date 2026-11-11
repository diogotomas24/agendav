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

// Clave de Gemini que manda la app desde el iPhone (si no está en Vercel).
export const userKey = req => String(req.headers['x-gemini-key'] || '').trim().slice(0, 200);

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
export async function gemini(parts, { json = true, search = false, key: own = '' } = {}) {
  const key = own || process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('missing_gemini_key'); e.code = 503; throw e; }
  // Si un modelo no tiene cupo gratis (429), prueba el siguiente.
  const models = [...new Set([process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'].filter(Boolean))];
  const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: search ? 0.4 : 0.2 } };
  if (json && !search) body.generationConfig.responseMimeType = 'application/json';
  if (search) body.tools = [{ google_search: {} }];
  let last = null;
  for (const model of [...models, ...models]) {
    if (last && model === models[0]) await new Promise(ok => setTimeout(ok, 1500)); // segunda vuelta
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body)
      });
    } catch { last = Object.assign(new Error('gemini_unreachable'), { code: 502 }); continue; }
    if (r.ok) {
      const d = await r.json();
      const c = d?.candidates?.[0];
      const text = (c?.content?.parts || []).map(p => p.text || '').join('');
      const sources = (c?.groundingMetadata?.groundingChunks || []).map(g => g.web).filter(Boolean)
        .map(w => ({ title: String(w.title || ''), url: String(w.uri || '') })).slice(0, 8);
      return { text, sources, model };
    }
    const t = (await r.text()).slice(0, 600);
    let msg = t; try { msg = JSON.parse(t)?.error?.message || t; } catch {}
    if (r.status === 429 || r.status === 404 || r.status >= 500) { last = Object.assign(new Error(model + ': ' + msg.slice(0, 250)), { code: r.status === 429 ? 429 : 502 }); continue; }
    if ((r.status === 400 || r.status === 401 || r.status === 403) && /API.?key|PERMISSION|unauthori|credential/i.test(msg)) throw Object.assign(new Error('bad_gemini_key: ' + msg.slice(0, 250)), { code: 401 });
    throw Object.assign(new Error('gemini_error ' + r.status + ' ' + msg.slice(0, 250)), { code: 502 });
  }
  throw last || Object.assign(new Error('gemini_error'), { code: 502 });
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
