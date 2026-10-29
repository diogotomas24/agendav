// Asistente de Agenda Vital con Gemini.
// Modos: 'assistant' (apunta cosas), 'food' (calorías y macros), 'ticket' (lee un ticket),
//        'weekly' (resumen de la semana), 'shop' (busca opciones de compra en Google).
import { readBody, checkToken, gemini, parseJSON, shopPrompt } from '../lib/shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!checkToken(req, res)) return;
  const body = readBody(req);
  const mode = ['food', 'ticket', 'weekly', 'shop'].includes(body.mode) ? body.mode : 'assistant';

  let parts;
  if (mode === 'shop') {
    const it = body.item || {};
    if (!it.name) return res.status(400).json({ error: 'empty_item' });
    parts = [{ text: shopPrompt(String(it.name).slice(0, 200), +it.max || 0, String(it.pref || '').slice(0, 300)) }];
  } else {
    const prompt = String(body.prompt || '').slice(0, 60000);
    if (!prompt) return res.status(400).json({ error: 'empty_prompt' });
    parts = [{ text: prompt }];
    const img = body.image;
    if (img && typeof img.data === 'string' && /^image\/(jpeg|png|webp|heic)$/.test(img.mime || '') && img.data.length < 4_000_000) {
      parts.push({ inline_data: { mime_type: img.mime, data: img.data } });
    }
  }

  let out;
  try {
    const r = await gemini(parts, { search: mode === 'shop' });
    const data = parseJSON(r.text);
    if (!data || typeof data !== 'object') return res.status(502).json({ error: 'bad_json' });
    if (mode === 'shop') data.sources = r.sources;
    out = data;
  } catch (e) {
    return res.status(e.code === 429 ? 429 : e.code === 503 ? 503 : 502).json({ error: e.message.slice(0, 200) });
  }
  if (mode !== 'assistant') return res.status(200).json({ data: out });
  return res.status(200).json({ reply: String(out.reply || ''), actions: Array.isArray(out.actions) ? out.actions : [] });
}
