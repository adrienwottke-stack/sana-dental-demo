import { randomUUID } from 'node:crypto';

export const SERVICES = {
  cleaning: { label: 'Professionelle Zahnreinigung', short: 'Zahnreinigung', duration: 60, clinician: 'Prophylaxe-Team', color: 'mint' },
  checkup: { label: 'Kontrolle & Vorsorge', short: 'Kontrolle', duration: 30, clinician: 'Dr. Lena Berg', color: 'blue' },
  consultation: { label: 'Erstgespräch', short: 'Erstgespräch', duration: 45, clinician: 'Dr. Lena Berg', color: 'lavender' },
  pain: { label: 'Beschwerden abklären', short: 'Beschwerden', duration: 30, clinician: 'Dr. Lena Berg', color: 'peach' },
};

export function berlinNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
export function addDays(date, count) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + count); return d.toISOString().slice(0, 10); }
export function weekday(date) { return new Date(`${date}T12:00:00Z`).getUTCDay(); }
export function weekStart(date) { return addDays(date, -(weekday(date) || 7) + 1); }
export function niceDate(date, long = true) { return new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short' }).format(new Date(`${date}T12:00:00Z`)); }
export function minutes(time) { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
export function clock(n) { return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; }
export function validDate(date) { return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().startsWith(date); }
export function validTime(time) { return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time); }
export function hours(date) { const day = weekday(date); return day === 0 || day === 6 ? null : { start: 8 * 60, end: day === 5 ? 14 * 60 : 18 * 60 }; }

// Identical synthetic occupancy for every visitor; personal bookings remain session-scoped.
export function seedAppointments(from, days = 49) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i); if (!hours(date)) continue;
    const variant = new Date(`${date}T12:00:00Z`).getUTCDate() % 3;
    const blocks = variant === 0 ? [[9, 'checkup'], [10.5, 'cleaning'], [13, 'consultation'], [15, 'checkup']] : variant === 1 ? [[8.5, 'cleaning'], [11, 'checkup'], [14, 'cleaning'], [16, 'consultation']] : [[9, 'consultation'], [11, 'cleaning'], [14.5, 'checkup'], [16.5, 'checkup']];
    for (const [hour, service] of blocks) {
      const start = hour * 60; if (start + SERVICES[service].duration > hours(date).end) continue;
      out.push({ id: `seed-${date}-${start}`, date, time: clock(start), duration: SERVICES[service].duration, service, name: 'Demo-Patient:in', seeded: true, status: 'confirmed' });
    }
    out.push({ id: `pause-${date}`, date, time: '12:00', duration: 60, service: 'pause', name: 'Mittagspause', seeded: true, status: 'confirmed' });
  }
  return out;
}
export function isFree(slot, appointments, now = new Date(), ignoreId = null) {
  if (!slot || !SERVICES[slot.service] || !validDate(slot.date) || !validTime(slot.time)) return false;
  const today = berlinNow(now); const open = hours(slot.date), start = minutes(slot.time), duration = SERVICES[slot.service].duration;
  if (!open || slot.date < today.date || slot.date > addDays(today.date, 42) || (slot.date === today.date && start < minutes(today.time) + 30) || start < open.start || start + duration > open.end || start % 15 !== 0) return false;
  return !appointments.some(a => a.id !== ignoreId && a.status === 'confirmed' && a.date === slot.date && start < minutes(a.time) + a.duration && start + duration > minutes(a.time));
}
export function findSlots(draft, appointments, now = new Date(), ignoreId = null) {
  const today = berlinNow(now).date; const earliest = draft.date && draft.date >= today ? draft.date : addDays(today, 1);
  const candidates = [];
  for (let i = 0; i < 18; i++) {
    const date = addDays(earliest, i); const open = hours(date); if (!open || date > addDays(today, 42)) continue;
    if (draft.dateEnd && date > draft.dateEnd) continue;
    if (draft.onlyWeekdays?.length && !draft.onlyWeekdays.includes(weekday(date))) continue;
    if (draft.excludedWeekdays?.includes(weekday(date))) continue;
    for (let start = open.start; start + SERVICES[draft.service].duration <= open.end; start += 30) {
      const slot = { id: `${date}_${clock(start)}_${draft.service}`, date, time: clock(start), service: draft.service };
      if (!isFree(slot, appointments, now, ignoreId)) continue;
      const target = draft.time ? minutes(draft.time) : draft.period === 'afternoon' ? 15 * 60 : draft.period === 'morning' ? 10 * 60 : 10 * 60;
      if (draft.after && start < minutes(draft.after)) continue;
      if (draft.before && start + SERVICES[draft.service].duration > minutes(draft.before)) continue;
      const periodPenalty = (draft.period === 'afternoon' && start < 13 * 60) || (draft.period === 'morning' && start >= 12 * 60) ? 10000 : 0;
      candidates.push({ ...slot, score: i * 400 + Math.abs(start - target) + periodPenalty });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  const chosen = [];
  for (const slot of candidates) { if (chosen.length === 3) break; if (!chosen.some(s => s.date === slot.date && Math.abs(minutes(s.time) - minutes(slot.time)) < 90)) chosen.push(slot); }
  return chosen.map(({ score, ...slot }) => slot);
}
const send = (label, value = label) => ({ type: 'send', label, value });
const msg = (text, kind = 'text', extra = {}) => ({ id: randomUUID(), role: 'assistant', text, kind, at: new Date().toISOString(), ...extra });
export function initialState() {
  return { phase: 'start', draft: {}, offers: [], selected: null, booking: null, mode: 'book', messages: [msg('Hallo und herzlich willkommen in der Praxis am Park! Schön, dass Sie uns schreiben. Wie kann ich Ihnen helfen?', 'welcome', { choices: [send('Zahnreinigung', 'Ich hätte gern eine Zahnreinigung nächste Woche nachmittags.'), send('Kontrolle', 'Ich möchte nächste Woche einen Termin zur Kontrolle.'), send('Erster Besuch', 'Ich bin neu in der Praxis und möchte ein Erstgespräch vereinbaren.')] })] };
}
export function publicBooking(a) { return a ? { ...a, serviceLabel: SERVICES[a.service].label, clinician: SERVICES[a.service].clinician } : null; }
function review(state) {
  state.phase = 'review';
  return msg(`Vielen Dank! Dann hätten wir ${niceDate(state.selected.date)} um ${state.selected.time} Uhr für ${SERVICES[state.draft.service].short === 'Kontrolle' ? 'die Kontrolle' : SERVICES[state.draft.service].short === 'Zahnreinigung' ? 'die Zahnreinigung' : 'Ihren Termin'}. Soll ich den Termin so für Sie ${state.mode === 'reschedule' ? 'verschieben' : 'eintragen'}?`, 'review', { details: { ...state.draft, ...state.selected, ...SERVICES[state.draft.service] }, choices: [{ type: 'confirm', label: state.mode === 'reschedule' ? 'Verschiebung bestätigen' : 'Termin bestätigen' }, send('Andere Uhrzeit', 'Ich möchte eine andere Uhrzeit wählen.')] });
}

function changedDetails(parsed, draft) {
  return ['service','date','time','period','after','before','name','patientType'].some(k => parsed[k] && parsed[k] !== draft[k]) || ['onlyWeekdays','excludedWeekdays'].some(k => parsed[k]?.length && JSON.stringify(parsed[k]) !== JSON.stringify(draft[k] || [])) || !!parsed.clearPreferences || (parsed.changePreference && parsed.changePreference !== 'none');
}
function matchesPreferences(slot, draft) {
  if (!slot) return false;
  if (draft.dateEnd && slot.date > draft.dateEnd) return false;
  if (draft.onlyWeekdays?.length && !draft.onlyWeekdays.includes(weekday(slot.date))) return false;
  if (draft.excludedWeekdays?.includes(weekday(slot.date))) return false;
  if (draft.after && slot.time < draft.after) return false;
  if (draft.before && minutes(slot.time) + SERVICES[slot.service].duration > minutes(draft.before)) return false;
  return true;
}
function advance(state, parsed, text, action, appointments, now = new Date()) {
  const replies = [];
  const booked = state.booking?.status === 'confirmed' ? state.booking : null;
  const lower = text.toLocaleLowerCase('de-DE');
  const confirming = state.phase === 'review' && !['cancel','reminder'].includes(parsed.intent) && !changedDetails(parsed, state.draft) && !parsed.decline && !/\b(?:aber|falls|wenn|nicht|nein|stattdessen)\b/i.test(text) && (action?.type === 'confirm' || parsed.confirm === true || /^(ja|ja gerne|ja bitte|passt|passt so|bestätigen|buchen|okay|ok|gerne|das passt|(?:demo-)?termin bestätigen|verschiebung bestätigen)[.!\s]*$/i.test(text));
  if (/atemnot|schluckbeschwerden|bewusstlos|starke\s+blutung|nicht\s+atmen/.test(lower)) return { state, replies: [msg('Diese Beschwerden sollten sofort persönlich abgeklärt werden. Bei akuter Atemnot oder einer lebensbedrohlichen Situation rufen Sie bitte 112. Hier kann keine medizinische Hilfe vermittelt werden.', 'safety', { lockedCopy: true })] };
  if (action?.type === 'reminder' && booked) {
    const reminderAt = addDays(booked.date, -1);
    return { state, replies: [msg(`Guten Tag! Wir möchten Sie an Ihren Termin für ${SERVICES[booked.service].short} am ${niceDate(booked.date)} um ${booked.time} Uhr erinnern. Wir freuen uns auf Ihren Besuch!\n\nFalls Sie nicht kommen können, geben Sie uns bitte kurz Bescheid.`, 'reminder', { preview: true, previewAt: { date: reminderAt, time: booked.time }, lockedCopy: true })] };
  }
  if ((parsed.intent === 'cancel' || action?.type === 'cancel') && booked && state.phase !== 'cancel_review' && !confirming) {
    state.phase = 'cancel_review';
    return { state, replies: [msg(`Das ist kein Problem. Geht es um Ihren Termin am ${niceDate(booked.date)} um ${booked.time} Uhr? Soll ich ihn für Sie absagen?`, 'text', { choices: [{ type: 'cancel_confirm', label: 'Termin absagen' }, { type: 'keep', label: 'Termin behalten' }] })] };
  }
  if (state.phase === 'cancel_review') {
    if (action?.type === 'keep' || parsed.decline || /^(nein|behalten|doch nicht)/i.test(text)) { state.phase = 'booked'; return { state, replies: [msg('Alles klar, dann bleibt Ihr Termin bestehen. Wir freuen uns auf Sie!')] }; }
    const cancelConfirmed = (parsed.confirm === true || /^(ja|bitte absagen|absagen|bestätigen)[.!\s]*$/i.test(text)) && !/\b(?:aber|falls|wenn|stattdessen)\b|nicht\s+(?:absagen|stornieren)/i.test(text);
    if (action?.type === 'cancel_confirm' || cancelConfirmed) {
      state.booking.status = 'cancelled'; state.booking.reminderStatus = 'cancelled'; state.phase = 'start'; state.mode = 'book'; state.draft = {}; state.selected = null; state.offers = [];
      return { state, mutation: { type: 'cancel', booking: state.booking }, replies: [msg('Ich habe den Termin für Sie abgesagt. Danke, dass Sie uns Bescheid gegeben haben! Wenn Sie möchten, suchen wir direkt einen neuen.', 'cancelled', { choices: [send('Neuen Termin finden', 'Ich möchte einen neuen Termin buchen.')] })] };
    }
    return { state, replies: [msg('Möchten Sie den Termin absagen, oder soll er bestehen bleiben?', 'text', { choices: [{ type: 'cancel_confirm', label: 'Termin absagen' }, { type: 'keep', label: 'Termin behalten' }] })] };
  }
  if (parsed.intent === 'cancel' && !booked) return { state, replies: [msg('Ich sehe hier noch keinen bestätigten Termin. Möchten Sie einen neuen vereinbaren?', 'text', { choices: [send('Zahnreinigung'), send('Kontrolle'), send('Erstgespräch')] })] };
  if (booked && parsed.intent === 'reschedule' && !confirming) {
    state.mode = 'reschedule'; state.phase = 'reschedule'; state.draft = { service: booked.service, name: booked.name, patientType: booked.patientType }; state.selected = null; state.offers = [];
    if (!parsed.date && !parsed.time && !parsed.period) return { state, replies: [msg('Gern. An welchem Tag oder zu welcher Uhrzeit möchten Sie stattdessen kommen? Ihr bisheriger Termin bleibt bis zur Bestätigung bestehen.')] };
  } else if (booked && state.phase === 'booked') {
    return { state, replies: [msg('Ihr Termin steht. Kann ich sonst noch etwas für Sie tun?', 'text', { choices: [send('Termin verschieben', 'Ich möchte meinen Termin verschieben.'), { type: 'reminder', label: 'Erinnerung ansehen' }, { type: 'cancel', label: 'Termin absagen' }] })] };
  }
  if (confirming) {
    if (!isFree(state.selected, appointments, now, state.mode === 'reschedule' ? booked?.id : null) || !matchesPreferences(state.selected, state.draft)) { state.selected = null; state.phase = 'slots'; replies.push(msg('Diese Zeit ist inzwischen nicht mehr passend. Ich suche Ihnen neue freie Termine.')); }
    else {
      const slot = state.selected;
      const booking = { ...slot, id: state.mode === 'reschedule' ? booked.id : randomUUID(), name: state.draft.name, patientType: state.draft.patientType, duration: SERVICES[slot.service].duration, status: 'confirmed', reminderStatus: 'planned', reminderAt: `${addDays(slot.date, -1)}T${slot.time}:00[Europe/Berlin]`, createdAt: booked?.createdAt || now.toISOString() };
      const mutation = { type: state.mode === 'reschedule' ? 'reschedule' : 'book', booking };
      state.booking = booking; state.phase = 'booked'; state.offers = [];
      return { state, mutation, replies: [msg(state.mode === 'reschedule' ? `Erledigt, ich habe Ihren Termin auf ${niceDate(booking.date)} um ${booking.time} Uhr verschoben. Der bisherige Termin entfällt. Bis dahin!` : `Sehr gern, Ihr Termin am ${niceDate(booking.date)} um ${booking.time} Uhr ist bestätigt. Eine Erinnerung am Vortag ist vorgemerkt. Wir freuen uns auf Sie!`, 'booking', { booking: publicBooking(booking), choices: [{ type: 'reminder', label: 'Erinnerung ansehen' }, send('Termin verschieben', 'Ich möchte meinen Termin verschieben.')] })] };
    }
  }
  const updates = ['service', 'date', 'dateEnd', 'time', 'period', 'after', 'before', 'name', 'patientType', 'onlyWeekdays', 'excludedWeekdays'];
  const previousOffers = [...state.offers];
  if (state.phase === 'review' && (parsed.decline || /andere|anderen|stattdessen|lieber|doch|ändern/i.test(text))) { state.selected = null; state.offers = []; state.phase = 'slots'; if (!parsed.time) delete state.draft.time; }
  if (parsed.date && (!validDate(parsed.date) || parsed.date < berlinNow(now).date || parsed.date > addDays(berlinNow(now).date, 42))) return { state, replies: [msg('Ich kann Ihnen Termine für die kommenden sechs Wochen anbieten. Welcher zukünftige Tag würde Ihnen passen?')] };
  if (updates.some(k => parsed[k] && !Array.isArray(parsed[k]) && ['service','date','dateEnd','time','period','after','before'].includes(k) && state.draft[k] !== parsed[k]) || ['onlyWeekdays','excludedWeekdays'].some(k => parsed[k]?.length && JSON.stringify(parsed[k]) !== JSON.stringify(state.draft[k] || []))) { state.selected = null; if (!action?.type || action.type === 'send') state.offers = []; }
  if (parsed.period && parsed.period !== state.draft.period && !parsed.after && !parsed.before) { delete state.draft.after; delete state.draft.before; }
  if (parsed.after) { delete state.draft.time; delete state.draft.before; }
  if (parsed.before) { delete state.draft.time; delete state.draft.after; }
  for (const k of updates) if (parsed[k] && (!Array.isArray(parsed[k]) || parsed[k].length)) state.draft[k] = parsed[k];
  if (parsed.time && !parsed.after) delete state.draft.after;
  if (parsed.time && !parsed.before) delete state.draft.before;
  if (parsed.period && !parsed.time) delete state.draft.time;
  if (action?.type === 'choose') {
    const slot = state.offers.find(s => s.id === action.slotId);
    if (!slot) return { state, replies: [msg('Diese Auswahl ist nicht mehr aktuell. Bitte wählen Sie eine der zuletzt angebotenen Zeiten.')] };
    state.selected = slot;
  } else if (parsed.slotIndex !== null && parsed.slotIndex !== undefined && previousOffers[parsed.slotIndex]) {
    const offered = previousOffers[parsed.slotIndex];
    if ((!parsed.date || parsed.date === offered.date) && (!parsed.time || parsed.time === offered.time) && matchesPreferences(offered, state.draft)) state.selected = offered;
  }
  if (!state.draft.service) { state.phase = 'service'; return { state, replies: [msg('Gern! Worum geht es bei Ihrem Termin?', 'text', { choices: [send('Zahnreinigung'), send('Kontrolle'), send('Erstgespräch'), send('Beschwerden')] })] }; }
  if (!state.selected && state.draft.date && state.draft.time && !state.draft.after && !state.draft.before) {
    const exact = { id: `${state.draft.date}_${state.draft.time}_${state.draft.service}`, date: state.draft.date, time: state.draft.time, service: state.draft.service };
    if (isFree(exact, appointments, now, state.mode === 'reschedule' ? booked?.id : null) && matchesPreferences(exact, state.draft)) state.selected = exact;
  }
  if (!state.selected) {
    state.offers = findSlots(state.draft, appointments, now, state.mode === 'reschedule' ? booked?.id : null); state.phase = 'slots';
    if (!state.offers.length) return { state, replies: [...replies, msg('Zu diesen Zeiten habe ich leider keinen passenden Termin frei. Wäre auch ein anderer Tag oder eine andere Uhrzeit für Sie möglich?')] };
    const requested = state.draft.date && state.draft.time ? { date: state.draft.date, time: state.draft.time, service: state.draft.service } : null;
    // Time-window requests can still offer the exact time; selection alone is not an availability check.
    const exactMiss = requested && !state.offers.some(s => s.date === requested.date && s.time === requested.time) && (!isFree(requested, appointments, now, state.mode === 'reschedule' ? booked?.id : null) || !matchesPreferences(requested, state.draft));
    const dayMiss = state.draft.date && state.offers[0].date !== state.draft.date;
    const options = state.offers.map(s => `${niceDate(s.date, false)} um ${s.time} Uhr`).join(', oder ');
    return { state, replies: [...replies, msg(`${exactMiss ? 'Zu Ihrer Wunschzeit habe ich leider keinen passenden Termin frei. ' : dayMiss ? 'An dem Tag habe ich leider nichts Passendes frei. ' : 'Gern! '}Ich könnte Ihnen ${options} anbieten. Welcher Termin passt Ihnen am besten?`, 'slots', { slots: state.offers, choices: state.offers.map(s => ({ type: 'choose', label: `${niceDate(s.date, false)} · ${s.time}`, slotId: s.id })) })] };
  }
  if (!state.draft.patientType) { state.phase = 'patient'; return { state, replies: [...replies, msg(`${niceDate(state.selected.date)} um ${state.selected.time} Uhr passt. Waren Sie schon einmal bei uns?`, 'text', { choices: [send('Ich bin neu', 'Ich bin neu in der Praxis.'), send('Ich war schon da', 'Ich bin bereits Patient in der Praxis.')] })] }; }
  if (!state.draft.name) { state.phase = 'name'; return { state, replies: [...replies, msg(state.draft.patientType === 'new' ? 'Dann schon einmal herzlich willkommen bei uns! Wie ist Ihr Vor- und Nachname?' : 'Danke! Auf welchen Vor- und Nachnamen darf ich den Termin eintragen?')] }; }
  return { state, replies: [...replies, review(state)] };
}

function faqAnswer(topic, state, parsed) {
  const service = SERVICES[parsed.service || state.draft.service || state.booking?.service];
  const answers = {
    hours: 'Wir sind montags bis donnerstags von 8 bis 18 Uhr und freitags von 8 bis 14 Uhr für Sie da. Zwischen 12 und 13 Uhr machen wir Mittagspause.',
    address: 'Die Praxis am Park ist hier eine fiktive Praxis. Deshalb gibt es keine echte Praxisadresse. Ihren vereinbarten Termin können Sie rechts im Kalender ansehen.',
    services: 'Sie können bei uns eine Kontrolle, eine professionelle Zahnreinigung oder ein Erstgespräch vereinbaren. Auch bei Beschwerden können wir einen Termin zur Abklärung suchen.',
    privacy: 'Bitte verwenden Sie hier nur erfundene Angaben. Der Verlauf und Ihre Termine bleiben höchstens 24 Stunden gespeichert. Zum Verstehen Ihrer Nachrichten wird OpenAI genutzt. Mit „Neu starten“ löschen Sie Ihre Sitzung. Es werden keine echten WhatsApp-Nachrichten verschickt.',
    duration: service ? `Für ${service.short === 'Kontrolle' ? 'die Kontrolle' : service.short === 'Zahnreinigung' ? 'die Zahnreinigung' : 'diesen Termin'} planen wir ${service.duration} Minuten ein.` : 'Eine Kontrolle dauert 30 Minuten, eine Zahnreinigung 60 Minuten und ein Erstgespräch 45 Minuten. Um welchen Termin geht es Ihnen?',
    cost: 'Den genauen Preis müsste ich erst mit der Praxis klären. Ich möchte Ihnen da nichts Falsches sagen. Einen passenden Termin können wir aber schon suchen.',
    clinician: service ? `Für ${service.short === 'Zahnreinigung' ? 'die Zahnreinigung' : 'diesen Termin'} ist ${service.clinician} vorgesehen.` : 'Die zahnärztlichen Termine sind bei Dr. Lena Berg vorgesehen. Die Zahnreinigung übernimmt unser Prophylaxe-Team.',
  };
  return answers[topic];
}
export function progress(state, parsed, text, action, appointments, now = new Date()) {
  parsed = { ...parsed };
  if (/atemnot|schluckbeschwerden|bewusstlos|starke\s+blutung|nicht\s+atmen/i.test(text)) return advance(state, parsed, text, action, appointments, now);
  const incoming = ['service','date','time','period','after','before','name','patientType'].some(k => parsed[k]) || ['onlyWeekdays','excludedWeekdays'].some(k => parsed[k]?.length);
  if (state.phase === 'booked' && state.booking?.status === 'confirmed' && (['date','time','period','after','before'].some(k => parsed[k]) || (parsed.changePreference && parsed.changePreference !== 'none')) && parsed.intent !== 'cancel' && parsed.intent !== 'reminder') parsed.intent = 'reschedule';
  if (state.phase === 'cancel_review' && ((incoming && changedDetails(parsed, state.draft)) || parsed.intent === 'reschedule')) state.phase = 'booked';
  if (parsed.faq && parsed.faq !== 'none') {
    const answer = faqAnswer(parsed.faq, state, parsed);
    if (answer) {
      if (incoming && changedDetails(parsed, state.draft)) {
        const next = advance(state, { ...parsed, faq: 'none', confirm: false }, text, null, appointments, now);
        next.replies.at(-1).text = `${answer}\n\n${next.replies.at(-1).text}`;
        return next;
      }
      return { state, replies: [msg(answer, 'faq', { lockedCopy: ['address','privacy'].includes(parsed.faq) })] };
    }
  }
  if (parsed.intent === 'reminder') {
    if (state.booking?.status === 'confirmed') action = { type: 'reminder' };
    else return { state, replies: [msg('Nach der Terminbestätigung ist eine Erinnerung am Vortag vorgemerkt. Worum soll es bei Ihrem Termin gehen?')] };
  }
  if (!action && !incoming && ['thanks','farewell'].includes(parsed.salutation)) {
    if (!/\bja\b|passt|bitte.*(?:eintragen|absagen|buchen|bestätigen|ändern)|machen wir|nehme ich/i.test(text)) parsed.confirm = false;
    if (state.booking?.status === 'confirmed' && state.phase === 'booked') return { state, replies: [msg(parsed.salutation === 'farewell' ? 'Ihnen auch einen schönen Tag! Wir freuen uns auf Ihren Besuch.' : 'Sehr gern! Wir freuen uns auf Ihren Besuch.')] };
    if (parsed.salutation === 'farewell') return { state, replies: [msg('Sehr gern. Schreiben Sie einfach wieder, wenn es Ihnen passt. Es ist noch kein neuer Termin bestätigt.')] };
    const next = advance(state, { ...parsed, salutation: 'none' }, text, null, appointments, now);
    if (!next.mutation && !/^(?:Gern|Sehr gern|Vielen Dank|Danke)/i.test(next.replies.at(-1).text)) next.replies.at(-1).text = `Gern. ${next.replies.at(-1).text}`;
    return next;
  }
  if (parsed.intent === 'other') return { state, replies: [msg('Dabei kann ich Ihnen leider nicht weiterhelfen. Ich kümmere mich hier um Ihre Termine und Fragen zur Praxis. Wobei kann ich Ihnen helfen?')] };
  if (parsed.clearPreferences) { for (const key of ['date','dateEnd','time','period','after','before','onlyWeekdays','excludedWeekdays']) delete state.draft[key]; state.selected = null; state.offers = []; }
  if (parsed.changePreference && parsed.changePreference !== 'none' && !parsed.time && !parsed.after && !parsed.before) {
    const anchor = state.selected || state.offers[0] || (state.mode === 'reschedule' ? state.booking : null);
    if (anchor) {
      parsed.date ||= anchor.date;
      if (parsed.changePreference === 'later') { parsed.after = clock(Math.min(23 * 60 + 30, minutes(anchor.time) + 30)); delete state.draft.before; }
      else if (parsed.changePreference === 'earlier') { parsed.before = anchor.time; delete state.draft.after; }
      delete state.draft.time;
      state.selected = null;
    }
  }
  const next = advance(state, parsed, text, action, appointments, now);
  if (!action && parsed.salutation === 'greeting' && !incoming && !state.draft.service) next.replies.at(-1).text = 'Hallo! Schön, dass Sie uns schreiben. Geht es um eine Kontrolle, eine Zahnreinigung oder etwas anderes?';
  return next;
}
