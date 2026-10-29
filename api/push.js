// Avisos: la app manda los avisos que quiere para los próximos días y aquí se programan en Upstash.
import { readBody, checkToken, baseUrl, qstash, forwardToken, sendPush, pushReady } from '../lib/shared.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || '', ready: pushReady() });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!checkToken(req, res)) return;
  if (!pushReady()) return res.status(503).json({ error: 'push_not_configured' });
  const b = readBody(req);
  const sub = b.sub;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'missing_subscription' });

  try {
    if (b.action === 'test') {
      await sendPush(sub, { title: 'Agenda Vital', body: 'Los avisos funcionan. Te avisaré de lo importante.', url: '/', tag: 'test' });
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'sync') {
      const cancelled = [];
      for (const id of (b.cancel || []).slice(0, 80)) {
        try { await qstash('DELETE', '/v2/messages/' + encodeURIComponent(id)); cancelled.push(id); }
        catch (e) { if (e.code === 404) cancelled.push(id); }
      }
      const added = {}, now = Date.now();
      for (const a of (b.add || []).slice(0, 60)) {
        const at = +a.at;
        if (!a.key || !a.title || !(at > now + 30000)) continue;
        const r = await qstash('POST', '/v2/publish/' + baseUrl(req) + '/api/notify', {
          headers: { 'Upstash-Not-Before': String(Math.floor(at / 1000)), 'Upstash-Retries': '2', ...forwardToken() },
          body: { sub, title: String(a.title).slice(0, 80), body: String(a.body || '').slice(0, 200), url: String(a.url || '/'), tag: String(a.key).slice(0, 60) }
        });
        if (r.messageId) added[a.key] = r.messageId;
      }
      return res.status(200).json({ added, cancelled });
    }

    if (b.action === 'watch') {
      const it = b.item || {};
      if (!it.name || !(+it.max > 0)) return res.status(400).json({ error: 'need_name_and_max' });
      // Una vez al día a las 08:00 UTC (09:00 o 10:00 en España).
      const r = await qstash('POST', '/v2/schedules/' + baseUrl(req) + '/api/watch', {
        headers: { 'Upstash-Cron': '0 8 * * *', 'Upstash-Retries': '1', ...forwardToken() },
        body: { sub, item: { id: String(it.id || ''), name: String(it.name).slice(0, 200), max: +it.max, pref: String(it.pref || '').slice(0, 300) } }
      });
      return res.status(200).json({ scheduleId: r.scheduleId || '' });
    }

    if (b.action === 'unwatch') {
      if (b.scheduleId) { try { await qstash('DELETE', '/v2/schedules/' + encodeURIComponent(b.scheduleId)); } catch (e) { if (e.code !== 404) throw e; } }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'unknown_action' });
  } catch (e) {
    const st = e.statusCode || e.code;
    if (st === 404 || st === 410) return res.status(410).json({ error: 'subscription_expired' });
    return res.status(502).json({ error: String(e.message || e).slice(0, 200) });
  }
}
