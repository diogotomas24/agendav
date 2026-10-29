// Upstash llama aquí a la hora programada y se envía el aviso al iPhone.
import { readBody, checkToken, sendPush } from '../lib/shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkToken(req, res)) return;
  const b = readBody(req);
  if (!b.sub || !b.title) return res.status(400).json({ error: 'bad_request' });
  try {
    await sendPush(b.sub, { title: b.title, body: b.body || '', url: b.url || '/', tag: b.tag || '' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    // Suscripción caducada: respondemos 200 para que Upstash no reintente.
    if (e.statusCode === 404 || e.statusCode === 410) return res.status(200).json({ gone: true });
    return res.status(500).json({ error: 'push_failed' });
  }
}
