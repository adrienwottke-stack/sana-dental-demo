import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, progress, isFree, findSlots, seedAppointments, validDate, berlinNow, addDays, SERVICES } from '../lib/booking.mjs';
import { parseLocal, understand } from '../lib/understand.mjs';

const NOW = new Date('2026-10-16T10:00:00Z');
const seed = seedAppointments('2026-10-12', 56);
const turn = (s, text, action = null, appointments = seed) => progress(s, parseLocal(text, s, NOW), text, action, appointments, NOW);
function prepare() {
  const s = initialState();
  turn(s, 'Ich brauche eine Zahnreinigung nächste Woche nachmittags.');
  turn(s, s.offers[0].time, { type: 'choose', slotId: s.offers[0].id });
  turn(s, 'Ich bin neu in der Praxis.');
  turn(s, 'Mein Name ist Alex Sommer.');
  return s;
}
test('Berlin clock and real calendar dates across DST', () => {
  assert.equal(berlinNow(new Date('2026-10-24T22:30:00Z')).date, '2026-10-25');
  assert.equal(berlinNow(new Date('2026-10-25T02:30:00Z')).time, '03:30');
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2028-02-29'), true);
});
test('all ordinary German appointment details are extracted', () => {
  const p = parseLocal('Ich heiße Alex Sommer und bin neu. Bitte Kontrolle nächsten Dienstag um 14:30 Uhr.', initialState(), NOW);
  assert.equal(p.name, 'Alex Sommer'); assert.equal(p.service, 'checkup'); assert.equal(p.patientType, 'new'); assert.equal(p.date, '2026-10-20'); assert.equal(p.time, '14:30');
  assert.equal(parseLocal('Zahnreinigung nächste Woche nach 15 Uhr', initialState(), NOW).after, '15:00');
  assert.equal(parseLocal('morgen', initialState(), NOW).date, '2026-10-17');
  assert.equal(parseLocal('übermorgen', initialState(), NOW).date, '2026-10-18');
  assert.equal(parseLocal('am 21.10.2026 um 9 Uhr', initialState(), NOW).date, '2026-10-21');
});
test('no appointment outside opening hours, during lunch, in the past or beyond six weeks', () => {
  for (const [date, time, service] of [['2026-10-15','10:00','checkup'],['2026-10-18','10:00','checkup'],['2026-10-19','07:00','checkup'],['2026-10-19','12:00','checkup'],['2026-10-23','13:30','cleaning'],['2026-12-20','10:00','checkup'],['2026-10-19','09:12','checkup']]) assert.equal(isFree({ date,time,service }, seed, NOW), false, `${date} ${time}`);
});
test('duration and overlaps are checked rather than start time alone', () => {
  const busy = [{ id: 'a', date: '2026-10-19', time: '10:00', duration: 60, status: 'confirmed' }];
  assert.equal(isFree({ date: '2026-10-19', time: '09:30', service: 'cleaning' }, busy, NOW), false);
  assert.equal(isFree({ date: '2026-10-19', time: '11:00', service: 'checkup' }, busy, NOW), true);
});
test('after and before preferences constrain all suggestions', () => {
  const late = findSlots({ service: 'cleaning', date: '2026-10-19', after: '15:00' }, seed, NOW);
  assert.equal(late.length, 3); assert.ok(late.every(s => s.time >= '15:00'));
  const early = findSlots({ service: 'checkup', date: '2026-10-19', before: '10:00' }, seed, NOW);
  assert.ok(early.every(s => Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3)) + 30 <= 600));
});
test('a past date receives a clarification, never a silent replacement', () => {
  const s = initialState(); const r = turn(s, 'Kontrolle am 10.10.2026 um 14 Uhr'); assert.match(r.replies[0].text, /kommenden sechs Wochen/); assert.equal(r.mutation, undefined);
});
test('the complete booking requires the user confirmation and retains its duration', () => {
  const s = prepare(); assert.equal(s.phase, 'review'); assert.equal(s.booking, null);
  const r = turn(s, 'Demo-Termin bestätigen', { type: 'confirm' });
  assert.equal(r.mutation.type, 'book'); assert.equal(s.phase, 'booked'); assert.equal(s.booking.duration, 60); assert.equal(s.booking.name, 'Alex Sommer'); assert.equal(s.booking.reminderStatus, 'planned');
});
test('selecting an offer in natural language preserves the offered day', () => {
  const s = initialState(); turn(s, 'Kontrolle am 18.10.2026'); const offer = s.offers[1]; turn(s, 'Den zweiten bitte'); assert.equal(s.selected.id, offer.id);
  const s2 = initialState(); turn(s2, 'Kontrolle am 18.10.2026'); const offer2 = s2.offers[0]; turn(s2, `Um ${offer2.time} Uhr bitte`); assert.equal(s2.selected.id, offer2.id);
});
test('a forged or stale slot ID cannot be selected', () => {
  const s = initialState(); turn(s, 'Kontrolle'); const r = turn(s, 'Auswahl', { type: 'choose', slotId: 'forged' }); assert.equal(s.selected, null); assert.match(r.replies[0].text, /nicht mehr aktuell/);
});
test('the confirm action cannot book missing details or invent patient information', () => {
  const s = initialState(); const r = turn(s, 'Bestätigen', { type: 'confirm' }); assert.equal(r.mutation, undefined); assert.equal(s.booking, null);
});
test('conflicts appearing before confirmation lead to fresh alternatives', () => {
  const s = prepare(); const occupied = { id: 'race', ...s.selected, duration: 60, status: 'confirmed' };
  const r = turn(s, 'Bestätigen', { type: 'confirm' }, [...seed, occupied]); assert.equal(r.mutation, undefined); assert.equal(s.phase, 'slots'); assert.equal(s.selected, null);
});
test('select another time from review actually opens alternatives', () => {
  const s = prepare(); turn(s, 'Andere Uhrzeit'); assert.equal(s.phase, 'slots'); assert.equal(s.selected, null);
});
test('a repeated confirmation cannot create a second booking', () => {
  const s = prepare(); const first = turn(s, 'Bestätigen', { type: 'confirm' }); const second = turn(s, 'Bestätigen', { type: 'confirm' }, [...seed, first.mutation.booking]); assert.equal(second.mutation, undefined); assert.equal(s.booking.id, first.mutation.booking.id);
});
test('rescheduling preserves the existing appointment until confirmed and keeps its ID', () => {
  const s = prepare(); const first = turn(s, 'Bestätigen', { type: 'confirm' }); const old = { ...s.booking }, all = [...seed, old];
  turn(s, 'Ich möchte meinen Termin verschieben.', null, all); assert.equal(s.booking.date, old.date); assert.equal(s.booking.id, old.id);
  turn(s, 'Am Donnerstag nachmittags', null, all); turn(s, 'Auswahl', { type: 'choose', slotId: s.offers[0].id }, all); assert.equal(s.phase, 'review');
  const r = turn(s, 'Verschiebung bestätigen', { type: 'confirm' }, all); assert.equal(r.mutation.type, 'reschedule'); assert.equal(r.mutation.booking.id, old.id); assert.notEqual(s.booking.date, old.date);
});
test('cancellation is explicit, cancels the reminder and frees the slot', () => {
  const s = prepare(); turn(s, 'Bestätigen', { type: 'confirm' }); const all = [...seed, { ...s.booking }];
  const ask = turn(s, 'Termin absagen', { type: 'cancel' }, all); assert.equal(ask.mutation, undefined); assert.equal(s.booking.status, 'confirmed');
  const r = turn(s, 'Absagen', { type: 'cancel_confirm' }, all); assert.equal(r.mutation.type, 'cancel'); assert.equal(s.booking.reminderStatus, 'cancelled');
  assert.equal(isFree(s.booking, [...seed, s.booking], NOW), true);
});
test('reminders are labeled as preview and do not change stored appointments', () => {
  const s = prepare(); turn(s, 'Bestätigen', { type: 'confirm' }); const r = turn(s, 'Erinnerung ansehen', { type: 'reminder' }); assert.equal(r.replies[0].preview, true); assert.equal(r.replies[0].kind, 'reminder'); assert.ok(r.replies[0].previewAt.date); assert.equal(r.mutation, undefined);
});
test('after a reschedule and cancellation, a fresh booking starts a new appointment', () => {
  const s = prepare(); turn(s, 'Bestätigen', { type: 'confirm' }); const oldId = s.booking.id;
  turn(s, 'Ich möchte meinen Termin verschieben'); turn(s, 'Donnerstag nachmittags'); turn(s, 'Auswahl', { type: 'choose', slotId: s.offers[0].id }); turn(s, 'Bestätigen', { type: 'confirm' });
  turn(s, 'Termin absagen', { type: 'cancel' }); turn(s, 'Absagen', { type: 'cancel_confirm' });
  assert.equal(s.mode, 'book');
  turn(s, 'Kontrolle nächsten Montag'); turn(s, 'Auswahl', { type: 'choose', slotId: s.offers[0].id }); turn(s, 'Ich bin bereits Patient in der Praxis'); turn(s, 'Alex Sommer');
  const r = turn(s, 'Bestätigen', { type: 'confirm' }); assert.equal(r.mutation.type, 'book'); assert.notEqual(s.booking.id, oldId); assert.equal(s.booking.status, 'confirmed');
});
test('urgent self-reported symptoms do not trigger an automatic appointment', () => {
  const s = prepare(); const r = turn(s, 'Ich habe Atemnot'); assert.match(r.replies[0].text, /112/); assert.equal(r.mutation, undefined);
});
test('language provider failure preserves a usable and labeled fallback', async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline'); };
  try { const r = await understand('Kontrolle morgen', initialState(), { apiKey: 'synthetic-test', now: NOW }); assert.equal(r.engine, 'fallback'); assert.equal(r.parsed.service, 'checkup'); }
  finally { globalThis.fetch = original; }
});
test('invalid provider fields never become authoritative booking input', async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ intent: 'hack', service: 'surgery', time: '99:00', slotIndex: 12, name: '<script>alert(1)</script>' }) } }] }) });
  try { const r = await understand('Kontrolle', initialState(), { apiKey: 'synthetic-test', now: NOW }); assert.equal(r.parsed.intent, 'booking'); assert.equal(r.parsed.service, null); assert.equal(r.parsed.time, null); assert.equal(r.parsed.name, null); assert.equal(r.parsed.slotIndex, null); }
  finally { globalThis.fetch = original; }
});
