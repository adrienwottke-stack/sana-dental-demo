import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { initialState, progress, seedAppointments, berlinNow, addDays, weekStart, publicBooking, SERVICES, niceDate } from './lib/booking.mjs';
import { understand } from './lib/understand.mjs';
import { naturalizeReplies, presentMessage } from './lib/dialogue.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data'); mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(join(DATA_DIR, 'sana.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, state TEXT NOT NULL, created_at INTEGER NOT NULL, touched_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS appointments (id TEXT NOT NULL, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, data TEXT NOT NULL, PRIMARY KEY (id,session_id));
CREATE TABLE IF NOT EXISTS receipts (session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, client_id TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(session_id,client_id));
CREATE TABLE IF NOT EXISTS ai_calls (day TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
`);
const PORT = Number(process.env.PORT || 4187), HOST = process.env.HOST || '127.0.0.1';
const API_KEY = process.env.OPENAI_API_KEY || '', MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const VERSION = process.env.RELEASE || '1.5.0';
// Expire after 23 h; hourly cleanup keeps physical retention below 24 h.
const TTL = 23 * 3600000, queued = new Map();
const seed = state => seedAppointments(weekStart(berlinNow().date), 56).filter(a => !state?.freshDemo || a.service === 'pause');
const getAppointments = id => db.prepare('SELECT data FROM appointments WHERE session_id=?').all(id).map(r => JSON.parse(r.data));
const security = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
function json(res, status, value, headers = {}) { res.writeHead(status, { ...security, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)); }
function session(req, res, create = true) {
  const demoToken = req.headers['x-demo-session'];
  const id = demoToken !== undefined ? (typeof demoToken === 'string' && /^[a-f0-9]{48}$/.test(demoToken) ? demoToken : null) : (req.headers.cookie || '').match(/(?:^|;\s*)sana_session=([a-f0-9]{48})(?:;|$)/)?.[1];
  const found = id && db.prepare('SELECT * FROM sessions WHERE id=? AND created_at>?').get(id, Date.now() - TTL);
  if (found) return { id, state: JSON.parse(found.state) };
  if (demoToken !== undefined) throw Object.assign(new Error('Dieser Test ist abgelaufen. Bitte öffnen Sie den Weitergabe-Link erneut.'), { status: 401 });
  if (!create) return null;
  return createSession(req, res);
}
function createSession(req, res, freshDemo = false) {
  const sid = randomBytes(24).toString('hex'), state = initialState();
  state.engine = API_KEY ? 'ready' : 'guided';
  if (freshDemo) state.freshDemo = true;
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(sid, JSON.stringify(state), Date.now(), Date.now());
  if (!freshDemo) {
    const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `sana_session=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure ? '; Secure' : ''}`);
  }
  return { id: sid, state };
}
function snapshot(s) {
  return { state: { ...s.state, messages: s.state.messages.map(presentMessage), booking: publicBooking(s.state.booking) }, appointments: [...seed(s.state), ...getAppointments(s.id)].map(a => a.service === 'pause' ? a : { ...a, serviceLabel: SERVICES[a.service].short }), today: berlinNow().date, week: weekStart(berlinNow().date), serverTime: new Date().toISOString(), aiConfigured: !!API_KEY, version: VERSION };
}
function reserveAiCall() {
  const day = berlinNow().date;
  const count = db.prepare('SELECT count FROM ai_calls WHERE day=?').get(day)?.count || 0;
  if (!API_KEY || count >= Number(process.env.AI_DAILY_LIMIT || 400)) return false;
  db.prepare('INSERT INTO ai_calls(day,count) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET count=count+1').run(day);
  return true;
}
function rate(bucket, limit, window) {
  const now = Date.now(), record = db.prepare('SELECT * FROM rate_limits WHERE bucket=?').get(bucket);
  if (record && record.expires > now) { if (record.count >= limit) return false; db.prepare('UPDATE rate_limits SET count=count+1 WHERE bucket=?').run(bucket); }
  else db.prepare('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=1,expires=excluded.expires').run(bucket, now + window);
  return true;
}
async function readBody(req) { let raw = ''; for await (const part of req) { raw += part; if (Buffer.byteLength(raw) > 6000) throw Object.assign(new Error('Ihre Nachricht ist zu lang.'), { status: 413 }); } try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Die Nachricht konnte nicht gelesen werden.'), { status: 400 }); } }
function cleanOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}
async function locked(id, fn) {
  const previous = queued.get(id) || Promise.resolve();
  const task = previous.catch(() => {}).then(fn); queued.set(id, task);
  try { return await task; } finally { if (queued.get(id) === task) queued.delete(id); }
}
function save(s, mutation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (mutation) db.prepare('INSERT INTO appointments(id,session_id,data) VALUES(?,?,?) ON CONFLICT(id,session_id) DO UPDATE SET data=excluded.data').run(mutation.booking.id, s.id, JSON.stringify(mutation.booking));
    db.prepare('UPDATE sessions SET state=?,touched_at=? WHERE id=?').run(JSON.stringify(s.state), Date.now(), s.id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
const staticFiles = new Map();
for (const path of ['/index.html', '/styles.css', '/whatsapp.css', '/calendar.css', '/app.js', '/favicon.svg', '/practice-avatar.svg', '/whatsapp-wallpaper.svg']) staticFiles.set(path, readFileSync(join(ROOT, 'public', path)));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://sana.local');
    if (url.pathname === '/healthz') return json(res, 200, { status: 'ok', app: 'sana', version: VERSION, aiConfigured: !!API_KEY });
    if (url.pathname === '/robots.txt') { res.writeHead(200, { ...security, 'Content-Type': 'text/plain' }); return res.end('User-agent: *\nDisallow: /\n'); }
    if (req.method === 'GET' && url.pathname === '/api/session') return json(res, 200, snapshot(session(req, res)));
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      if (!cleanOrigin(req)) return json(res, 403, { error: 'Bitte öffnen Sie die Demo direkt in Ihrem Browser.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Bitte senden Sie eine Chat-Nachricht.' });
      const ip = req.headers['x-forwarded-for']?.split(',').at(-1)?.trim() || req.socket.remoteAddress;
      const ipHash = createHash('sha256').update(String(ip)).digest('hex').slice(0, 24);
      if (!rate(`ip:${ipHash}`, 160, 3600000)) return json(res, 429, { error: 'Die Demo wurde gerade sehr häufig genutzt. Bitte versuchen Sie es in einer Stunde wieder.' });
      if (url.pathname === '/api/demo-session') {
        await readBody(req);
        const fresh = createSession(req, res, true);
        return json(res, 200, { ...snapshot(fresh), demoSession: fresh.id });
      }
      if (url.pathname === '/api/reset') {
        const old = session(req, res, false);
        if (old) await locked(old.id, () => db.prepare('DELETE FROM sessions WHERE id=?').run(old.id));
        if (req.headers['x-demo-session'] !== undefined) {
          const fresh = createSession(req, res, true);
          return json(res, 200, { ...snapshot(fresh), demoSession: fresh.id });
        }
        req.headers.cookie = ''; return json(res, 200, snapshot(session(req, res)));
      }
      if (url.pathname !== '/api/message') return json(res, 404, { error: 'Diese Funktion gibt es hier nicht.' });
      const body = await readBody(req);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text || text.length > 1200 || typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{12,64}$/.test(body.id)) return json(res, 400, { error: 'Bitte schreiben Sie eine Nachricht mit höchstens 1.200 Zeichen.' });
      const action = body.action || null;
      if (action && (typeof action !== 'object' || !['choose', 'confirm', 'reminder', 'cancel', 'cancel_confirm', 'keep'].includes(action.type))) return json(res, 400, { error: 'Diese Auswahl ist nicht mehr verfügbar.' });
      const s = session(req, res);
      return await locked(s.id, async () => {
        const receipt = db.prepare('SELECT result FROM receipts WHERE session_id=? AND client_id=?').get(s.id, body.id);
        if (receipt) return json(res, 200, JSON.parse(receipt.result));
        const record = db.prepare('SELECT state FROM sessions WHERE id=?').get(s.id);
        if (!record) return json(res, 409, { error: 'Diese Demo wurde neu gestartet. Bitte laden Sie die Seite neu.' });
        s.state = JSON.parse(record.state);
        if (!rate(`session:${s.id}`, 18, 60000) || !rate(`day:${s.id}`, 90, TTL)) return json(res, 429, { error: 'Kurze Pause: Bitte warten Sie einen Moment oder starten Sie die Demo neu.' });
        let parsed = {}, engine = s.state.engine;
        if (!action) {
          const day = berlinNow().date, allowed = reserveAiCall();
          const result = await understand(text, s.state, { apiKey: API_KEY, model: MODEL, enabled: allowed });
          parsed = result.parsed; engine = result.engine;
          if (result.tokens) db.prepare('UPDATE ai_calls SET tokens=tokens+? WHERE day=?').run(result.tokens, day);
        }
        const appointments = [...seed(s.state), ...getAppointments(s.id)];
        s.state.messages.push({ id: randomUUID(), role: 'user', text, at: new Date().toISOString() });
        let result = progress(s.state, parsed, text, action, appointments);
        if (!action && engine === 'ai') {
          result = await naturalizeReplies(result, text, { apiKey: API_KEY, model: MODEL, reserve: reserveAiCall });
          if (result.tokens) db.prepare('UPDATE ai_calls SET tokens=tokens+? WHERE day=?').run(result.tokens, berlinNow().date);
        }
        s.state = result.state; s.state.engine = engine; s.state.replyEngine = result.replyEngine || 'curated'; s.state.messages.push(...result.replies.map(presentMessage));
        if (s.state.messages.length > 90) s.state.messages = s.state.messages.slice(-90);
        save(s, result.mutation);
        const out = snapshot(s);
        db.prepare('INSERT INTO receipts VALUES(?,?,?)').run(s.id, body.id, JSON.stringify(out));
        return json(res, 200, out);
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/appointment.ics') {
      const s = session(req, res, false), a = s?.state.booking;
      if (!a || a.status !== 'confirmed') return json(res, 404, { error: 'Vereinbaren Sie zuerst einen Termin.' });
      const escape = t => String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
      const start = `${a.date.replaceAll('-', '')}T${a.time.replace(':', '')}00`;
      const endMins = Number(a.time.slice(0, 2)) * 60 + Number(a.time.slice(3)) + a.duration;
      const end = `${a.date.replaceAll('-', '')}T${String(Math.floor(endMins / 60)).padStart(2, '0')}${String(endMins % 60).padStart(2, '0')}00`;
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, 'Z');
      res.writeHead(200, { ...security, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="sana-demo-termin.ics"', 'Cache-Control': 'no-store' });
      return res.end(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nexara//Sana Demo//DE', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${a.id}@sana-demo`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/Berlin:${start}`, `DTEND;TZID=Europe/Berlin:${end}`, `SUMMARY:${escape(`DEMO – ${SERVICES[a.service].short}`)}`, 'DESCRIPTION:Fiktiver Demonstrationstermin. Kein Termin in einer echten Praxis.', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n'));
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const path = ['/', '/demo', '/demo/'].includes(url.pathname) ? '/index.html' : url.pathname;
      const file = staticFiles.get(path);
      if (file) { res.writeHead(200, { ...security, 'Content-Type': mime[extname(path)], 'Cache-Control': 'no-cache' }); return res.end(req.method === 'HEAD' ? undefined : file); }
    }
    return json(res, 404, { error: 'Diese Seite wurde nicht gefunden.' });
  } catch (error) {
    if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Die Nachricht konnte gerade nicht verarbeitet werden. Bitte versuchen Sie es erneut.' });
    else res.end();
    if (!error.status) console.error('request_failed', error.code || error.name);
  }
});
server.requestTimeout = 25000; server.headersTimeout = 10000;
function cleanup() { db.prepare('DELETE FROM sessions WHERE created_at<?').run(Date.now() - TTL); db.prepare('DELETE FROM rate_limits WHERE expires<?').run(Date.now()); db.prepare('DELETE FROM ai_calls WHERE day<?').run(addDays(berlinNow().date, -7)); }
cleanup(); setInterval(cleanup, 3600000).unref();
server.listen(PORT, HOST, () => console.log(`Sana ${VERSION} listening on ${HOST}:${PORT}; language=${API_KEY ? 'ai' : 'guided'}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
