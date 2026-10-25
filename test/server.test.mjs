import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

test('real HTTP workflow: persistence, isolation, idempotency, reminders, reschedule, cancel and reset', async () => {
  const runtime = new URL(`../../../work/http-test-${randomUUID()}/`, import.meta.url); await mkdir(runtime, { recursive: true });
  const port = 20000 + Math.floor(Math.random() * 20000);
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.mjs'], { cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env, PORT: String(port), OPENAI_API_KEY: '', DATA_DIR: fileURLToPath(runtime) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = ''; child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${origin}/healthz`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 80)); if (i === 49) throw new Error(output); }
    const clients = new Map();
    async function request(who, path, body, headers = {}) {
      const res = await fetch(`${origin}${path}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(clients.get(who) ? { Cookie: clients.get(who) } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
      if (res.headers.get('set-cookie')) clients.set(who, res.headers.get('set-cookie').split(';')[0]);
      return res;
    }
    const snapshot = who => request(who, '/api/session').then(r => r.json());
    const message = async (text, action = null, id = randomUUID().replaceAll('-', '')) => { const r = await request('a', '/api/message', { text, action, id }); const out = await r.json(); assert.equal(r.status, 200, JSON.stringify(out)); return out; };
    const a = await snapshot('a'), b = await snapshot('b');
    assert.notEqual(clients.get('a'), clients.get('b')); assert.equal(a.state.phase, 'start'); assert.equal(b.state.phase, 'start');
    let s = await message('Zahnreinigung nächste Woche nachmittags'); assert.equal(s.state.phase, 'slots');
    s = await message('Auswahl', { type: 'choose', slotId: s.state.offers[0].id }); assert.equal(s.state.phase, 'patient');
    s = await message('Ich bin neu in der Praxis'); assert.equal(s.state.phase, 'name');
    s = await message('Mein Name ist Alex Sommer'); assert.equal(s.state.phase, 'review'); assert.equal(s.appointments.filter(x => !x.seeded).length, 0);
    const confirmId = randomUUID().replaceAll('-', '');
    const [one, duplicate] = await Promise.all([message('Bestätigen', { type: 'confirm' }, confirmId), message('Bestätigen', { type: 'confirm' }, confirmId)]);
    assert.deepEqual(one, duplicate); s = one; assert.equal(s.state.phase, 'booked');
    const own = s.appointments.filter(x => !x.seeded); assert.equal(own.length, 1); const bookingId = own[0].id;
    assert.equal((await snapshot('a')).state.booking.id, bookingId); assert.equal((await snapshot('b')).appointments.filter(x => !x.seeded).length, 0);
    s = await message('Erinnerung ansehen', { type: 'reminder' }); assert.equal(s.state.messages.at(-1).preview, true); assert.equal(s.state.messages.at(-1).kind, 'reminder');
    const ics = await request('a', '/api/appointment.ics'); assert.equal(ics.status, 200); assert.match(await ics.text(), /TZID=Europe\/Berlin/); assert.equal((await request('b', '/api/appointment.ics')).status, 404);
    s = await message('Ich möchte meinen Termin verschieben'); assert.equal(s.state.booking.id, bookingId);
    s = await message('Donnerstag nachmittags'); assert.equal(s.state.phase, 'slots');
    s = await message('Auswahl', { type: 'choose', slotId: s.state.offers[0].id }); assert.equal(s.state.phase, 'review');
    s = await message('Verschiebung bestätigen', { type: 'confirm' }); assert.equal(s.state.phase, 'booked'); assert.equal(s.state.booking.id, bookingId); assert.equal(s.appointments.filter(x => !x.seeded).length, 1);
    s = await message('Termin absagen', { type: 'cancel' }); assert.equal(s.state.booking.status, 'confirmed');
    s = await message('Absagen', { type: 'cancel_confirm' }); assert.equal(s.state.booking.status, 'cancelled'); assert.equal(s.state.booking.reminderStatus, 'cancelled');
    assert.equal(s.appointments.filter(x => !x.seeded && x.status === 'confirmed').length, 0);
    const foreignOrigin = await request('a', '/api/message', { text: 'Kontrolle', id: randomUUID().replaceAll('-', '') }, { Origin: 'https://different.example' }); assert.equal(foreignOrigin.status, 403);
    const invalid = await request('a', '/api/message', { text: 'Kontrolle', id: randomUUID().replaceAll('-', ''), action: { type: 'shell' } }); assert.equal(invalid.status, 400);
    const reset = await request('a', '/api/reset', {}); assert.equal(reset.status, 200); assert.equal((await snapshot('a')).state.phase, 'start'); assert.equal((await snapshot('a')).appointments.filter(x => !x.seeded).length, 0);
    assert.equal((await request('a', '/server.mjs')).status, 404); assert.equal((await request('a', '/runtime.env')).status, 404);
  } finally { child.kill(); await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); }); }
});

test('share entries are fresh, cookie-independent, isolated across tabs and use their own calendar download', async () => {
  const runtime = new URL(`../../../work/share-test-${randomUUID()}/`, import.meta.url); await mkdir(runtime, { recursive: true });
  const port = 25000 + Math.floor(Math.random() * 15000), origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.mjs'], { cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env, PORT: String(port), OPENAI_API_KEY: '', DATA_DIR: fileURLToPath(runtime) }, stdio: ['ignore','pipe','pipe'], windowsHide: true });
  let output = ''; child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
  try {
    for (let i=0;i<50;i++) { try { if((await fetch(origin+'/healthz')).ok) break; } catch {} await new Promise(r=>setTimeout(r,80)); if(i===49) throw new Error(output); }
    const initial = await fetch(origin+'/api/session'), cookie = initial.headers.get('set-cookie').split(';')[0];
    async function request(path, body, token, extra={}) {
      return fetch(origin+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:origin}:{}),...(token?{'X-Demo-Session':token}:{}),...extra},body:body?JSON.stringify(body):undefined});
    }
    const snapshot = async token => { const r=await request('/api/session',null,token); assert.equal(r.status,200); return r.json(); };
    const message = async (text,token,action) => {const r=await request('/api/message',{id:randomUUID().replaceAll('-',''),text,...(action?{action}:{})},token);assert.equal(r.status,200);return r.json();};
    async function book(name,token) {
      let s=await message(`Kontrolle nächste Woche nachmittags. Ich heiße ${name} und bin neu.`,token);
      s=await message('Auswahl',token,{type:'choose',slotId:s.state.offers[0].id});assert.equal(s.state.phase,'review');
      s=await message('Termin bestätigen',token,{type:'confirm'});assert.equal(s.state.phase,'booked');return s.state.booking;
    }
    const normalBooking=await book('Robin Winter');
    async function openShare(token) {const r=await request('/api/demo-session',{},token);assert.equal(r.status,200);assert.equal(r.headers.get('set-cookie'),null);const s=await r.json();assert.equal(s.state.phase,'start');assert.equal(s.state.booking,null);assert.equal(s.state.messages.length,1);assert.ok(s.appointments.every(a=>a.service==='pause'));assert.ok(/^[a-f0-9]{48}$/.test(s.demoSession));return s;}
    const first=await openShare(), second=await openShare();assert.ok(first.demoSession!==second.demoSession);
    const firstBooking=await book('Alex Sommer',first.demoSession);
    assert.equal((await snapshot(second.demoSession)).state.booking,null);
    assert.ok((await snapshot()).state.booking.id===normalBooking.id);
    const firstIcs=await request('/api/appointment.ics',null,first.demoSession);assert.equal(firstIcs.status,200);assert.ok((await firstIcs.text()).includes(firstBooking.id));
    assert.equal((await request('/api/appointment.ics',null,second.demoSession)).status,404);
    const another=await openShare(first.demoSession);assert.ok(another.demoSession!==first.demoSession);assert.ok((await snapshot(first.demoSession)).state.booking.id===firstBooking.id);
    const reset=await request('/api/reset',{},first.demoSession);assert.equal(reset.status,200);assert.equal(reset.headers.get('set-cookie'),null);const resetState=await reset.json();assert.ok(resetState.demoSession!==first.demoSession);assert.equal(resetState.state.booking,null);
    assert.equal((await request('/api/session',null,first.demoSession)).status,401);
    assert.equal((await request('/api/session',null,'0'.repeat(48))).status,401);
    assert.equal((await request('/api/session',null,'invalid')).status,401);
    assert.ok((await snapshot()).state.booking.id===normalBooking.id);assert.equal((await snapshot(second.demoSession)).state.phase,'start');
    assert.equal((await request('/api/demo-session',{},null,{Origin:'https://different.example'})).status,403);
    const page=await request('/demo');assert.equal(page.status,200);assert.equal(page.headers.get('set-cookie'),null);
    assert.ok((await snapshot()).state.booking.id===normalBooking.id);
  } finally {child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}
});
