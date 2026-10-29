// Vigilancia de precio (Upstash lo ejecuta una vez al día): busca el producto y avisa si hay algo por debajo del máximo.
import { readBody, checkToken, gemini, parseJSON, shopPrompt, sendPush } from '../lib/shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkToken(req, res)) return;
  const { sub, item } = readBody(req);
  if (!sub || !item || !item.name || !(+item.max > 0)) return res.status(400).json({ error: 'bad_request' });
  try {
    const r = await gemini([{ text: shopPrompt(item.name, +item.max, item.pref) }], { search: true });
    const d = parseJSON(r.text) || {};
    const ok = (Array.isArray(d.options) ? d.options : []).filter(o => +o.price > 0 && +o.price <= +item.max).sort((a, b) => a.price - b.price);
    if (ok.length) {
      const o = ok[0];
      await sendPush(sub, {
        title: `${item.name}: ${o.price} €`,
        body: `${o.name}${o.store ? ' en ' + o.store : ''}. Por debajo de tu máximo de ${item.max} €.`,
        url: '/?go=compras', tag: 'watch-' + (item.id || item.name)
      });
    }
    return res.status(200).json({ found: ok.length });
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) return res.status(200).json({ gone: true });
    return res.status(200).json({ error: String(e.message || e).slice(0, 120) });
  }
}
