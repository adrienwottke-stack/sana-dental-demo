const $ = s => document.querySelector(s);
const ICONS = {
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2 1.5-5A8.5 8.5 0 1 1 21 11.5Z"/><path d="M7 10h9M7 14h6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18M8 15h1M13 15h1M8 18h1"/>',
  appointment: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18m5 5 2 2 5-5"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4"/>',
  send: '<path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3"/>',
  restart: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4"/>',
  right: '<path d="m9 5 7 7-7 7"/>', left: '<path d="m15 5-7 7 7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>', doublecheck: '<path d="m2 12 4 4L16 6m-5 10 10-10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrowcurve: '<path d="M21 3c-2 2-3 7-1 11 3 7-9 11-16 1m0 0 1 7m-1-7 7 1"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  back: '<path d="M20 12H4m7-7-7 7 7 7"/>',
  more: '<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
  phone: '<path d="m6 3 4 4-2.5 3.5a15 15 0 0 0 6 6L17 14l4 4-2 3C10 22 2 14 3 5l3-2Z" fill="currentColor" stroke-width=".5"/>',
  video: '<rect x="2" y="6" width="13" height="12" rx="2" fill="currentColor" stroke-width=".5"/><path d="m15 10 7-4v12l-7-4Z" fill="currentColor" stroke-width=".5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 15a5 5 0 0 0 8 0"/><circle cx="8.5" cy="9" r=".9" fill="currentColor" stroke="none"/><circle cx="15.5" cy="9" r=".9" fill="currentColor" stroke="none"/>',
  attach: '<path d="M8 12v6a4 4 0 0 0 8 0V6a3 3 0 0 0-6 0v11a1 1 0 0 0 2 0V7"/>',
  camera: '<path d="M3 6h4l2-3h6l2 3h4v15H3Z"/><circle cx="12" cy="13" r="4"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3" fill="currentColor" stroke="none"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v4m-4 0h8"/>',
  signal: '<path d="M3 19h3v-3H3Zm5 0h3v-7H8Zm5 0h3V8h-3Zm5 0h3V4h-3Z" fill="currentColor" stroke="none"/>',
  wifi: '<path d="M2 8a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0m-11 4a5 5 0 0 1 8 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>',
  battery: '<rect x="2" y="6" width="18" height="12" rx="2"/><path d="M22 10v4"/><rect x="4" y="8" width="13" height="8" rx=".5" fill="currentColor" stroke="none"/>',
  business: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-11 0v3h4v-3"/>',
  whatsapp: '<path d="M21 11.5a9 9 0 0 1-13.7 7.7L3 21l1.7-5.1A9 9 0 1 1 21 11.5Z"/><path d="m8 6 2 3-1.1 1.5a9 9 0 0 0 3.6 3.6L14 13l3 2-1.5 2C11 17 7 13 7 8l1-2Z" stroke-width="1.3"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
hydrateIcons();
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const date = (s, opts = {}) => new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', ...opts }).format(new Date(`${s}T12:00:00Z`));
const add = (s, n) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monday = s => add(s, -(new Date(`${s}T12:00:00Z`).getUTCDay() || 7) + 1);
const nice = s => date(s, { weekday: 'long', day: 'numeric', month: 'long' });
const mins = s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const durationLabel = n => `${n} Min.`;
const services = { cleaning: 'Professionelle Zahnreinigung', checkup: 'Kontrolle & Vorsorge', consultation: 'Erstgespräch', pain: 'Beschwerden abklären' };
const freshEntry = /^\/demo\/?$/.test(location.pathname);
let demoSession = null, calendarDay = null;
let data = null, shownWeek = null, busy = false, failed = null, currentTab = 'chat', toastTimer;
let contactPrompted = false, contactPending = false, contactTimer;
const defaultWeek = () => [0,6].includes(new Date(`${data.today}T12:00:00Z`).getUTCDay()) ? add(data.week, 7) : data.week;
const endTime = e => { const n = mins(e.time) + e.duration; return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; };

function bookingCard(details, confirmed = false) {
  const title = details.serviceLabel || details.label || services[details.service];
  return `<div class="booking-card"><div class="booking-card-head">${icon(confirmed ? 'appointment' : 'calendar')}${confirmed ? 'Ihr Termin ist bestätigt' : 'Ihr Termin im Überblick'}</div><div class="booking-card-content"><h3>${escape(title)}</h3><div class="booking-detail">${icon('calendar')}<span>${escape(nice(details.date))}</span></div><div class="booking-detail">${icon('clock')}<span>${escape(details.time)} Uhr · ${escape(durationLabel(details.duration))}</span></div><div class="booking-detail">${icon('person')}<span>${escape(details.name)} · ${details.patientType === 'new' ? 'Erster Besuch' : 'Bereits Patient:in'}</span></div>${confirmed ? `<p class="reminder-note">${icon('bell')} Erinnerung am Vortag vorgemerkt.</p>` : ''}</div></div>`;
}
function messageHTML(m, last = false) {
  const time = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(m.at));
  const card = m.kind === 'review' ? bookingCard(m.details) : m.kind === 'booking' ? bookingCard(m.booking, true) : '';
  let choices = '';
  if (last && m.choices?.length) choices = `<div class="choices">${m.choices.map((c, idx) => `<button class="choice-button ${c.type === 'choose' ? 'slot' : ''} ${c.type === 'confirm' ? 'primary' : ''} ${c.type === 'cancel_confirm' ? 'danger' : ''}" aria-label="${escape(c.label)}" data-choice="${idx}" data-message="${escape(m.id)}" ${busy ? 'disabled' : ''}>${c.type === 'choose' ? icon('calendar') : c.type === 'confirm' ? icon('check') : c.type === 'reminder' ? icon('bell') : ''}<span>${escape(c.label)}</span>${c.type === 'choose' ? '<small aria-hidden="true">Frei</small>' : ''}</button>`).join('')}</div>`;
  const previewLabel = m.kind === 'reminder' ? `<div class="reminder-preview-label">${icon('bell')}Erinnerungsvorschau · keine Nachricht versendet</div>` : '';
  return `<article class="message ${m.role === 'user' ? 'user' : 'assistant'} ${m.kind || ''} ${last ? '' : 'message-old'}" data-message-id="${escape(m.id)}">${m.role === 'assistant' ? '<div class="sender-label">Mila</div>' : ''}${previewLabel}<div class="bubble"><p>${escape(m.text)}</p>${card}<div class="message-time">${time}${m.role === 'user' ? icon('doublecheck') : ''}</div></div>${choices}</article>`;
}
function renderMessages() {
  if (!data) return;
  const list = data.state.messages;
  const wasConversation = document.body.classList.contains('has-conversation');
  document.body.classList.toggle('has-conversation', list.some(m => m.role === 'user'));
  if (!wasConversation && list.some(m => m.role === 'user') && matchMedia('(max-width:820px)').matches) window.scrollTo(0, 0);
  $('#messages').innerHTML = list.map((m, i) => messageHTML(m, i === list.length - 1)).join('');
  $('#messages').querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
    const m = data.state.messages.find(m => m.id === button.dataset.message), choice = m?.choices[Number(button.dataset.choice)];
    if (!choice) return;
    send(choice.value || choice.label, choice.type === 'send' ? null : { type: choice.type, ...(choice.slotId ? { slotId: choice.slotId } : {}) });
  }));
  $('#wa-contact-preview').textContent = list.at(-1)?.text.split('\n')[0] || 'Wann möchten Sie vorbeikommen?';
  scrollChat();
}
function scrollChat() { requestAnimationFrame(() => { const el = $('#chat-scroll'); el.scrollTop = el.scrollHeight; }); }

function renderCalendar() {
  if (!data) return;
  shownWeek ||= defaultWeek();
  const end = add(shownWeek, 4), days = Array.from({ length: 5 }, (_, i) => add(shownWeek, i));
  $('#month-label').textContent = date(shownWeek, { month: 'long', year: 'numeric' });
  $('#week-label').textContent = `${date(shownWeek, { day: '2-digit', month: '2-digit' })} – ${date(end, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  $('#prev-week').disabled = shownWeek <= data.week;
  $('#next-week').disabled = shownWeek >= add(data.week, 42);
  const booking = data.state.booking?.status === 'confirmed' ? data.state.booking : null;
  const selected = data.state.phase !== 'booked' && data.state.phase !== 'start' && data.state.selected;
  if (!days.includes(calendarDay)) calendarDay = [booking?.date, selected?.date, data.today, days[0]].find(d => days.includes(d));
  const eventsForDay = d => {
    let events = data.appointments.filter(a => a.date === d && a.status === 'confirmed');
    if (selected?.date === d && !events.some(e => !e.seeded && e.id === selected.id)) events = [...events, { ...selected, duration: ({ cleaning: 60, checkup: 30, consultation: 45, pain: 30 })[selected.service], serviceLabel: 'Ihr Wunsch', preview: true }];
    return events.sort((a,b) => a.time.localeCompare(b.time));
  };
  let html = '<div class="day-head" aria-hidden="true"></div>';
  for (const d of days) html += `<div class="day-head ${d === data.today ? 'today' : ''} ${booking?.date === d ? 'booked-day' : ''}"><span>${escape(date(d, { weekday: 'short' }).replace('.', '').toUpperCase())}</span><strong>${date(d, { day: 'numeric' })}</strong></div>`;
  html += `<div class="time-column">${Array.from({ length: 11 }, (_, i) => `<span class="hour-label" style="--hour:${i}">${String(i + 8).padStart(2, '0')}:00</span>`).join('')}</div>`;
  for (let idx = 0; idx < days.length; idx++) {
    const d = days[idx], events = eventsForDay(d);
    html += `<div class="day-column" style="grid-column:${idx + 2}" aria-label="${escape(nice(d))}">${events.map(e => `<div class="calendar-event ${escape(e.service)} ${e.duration <= 30 ? 'compact' : ''} ${!e.seeded && !e.preview ? 'own' : ''} ${e.preview ? 'selected-slot' : ''}" style="--start:${mins(e.time) - 480};--duration:${e.duration}" title="${escape(e.serviceLabel || e.name)} · ${escape(e.time)} Uhr · ${escape(durationLabel(e.duration))}" aria-label="${escape(e.serviceLabel || e.name)}, ${escape(e.time)} Uhr, ${escape(durationLabel(e.duration))}">${e.service === 'pause' ? 'PAUSE' : `<span class="event-time">${escape(e.time)}</span><span class="event-name">${escape(e.serviceLabel || services[e.service])}</span>`}</div>`).join('')}${idx === 4 ? '<div class="calendar-event pause" style="--start:360;--duration:240">GESCHLOSSEN</div>' : ''}</div>`;
  }
  $('#calendar-grid').innerHTML = html;
  const daily = eventsForDay(calendarDay), friday = new Date(`${calendarDay}T12:00:00Z`).getUTCDay() === 5;
  $('#calendar-agenda').innerHTML = `<div class="agenda-days" aria-label="Tag auswählen">${days.map(d => `<button type="button" data-calendar-day="${d}" aria-label="${escape(nice(d))}" aria-pressed="${d === calendarDay}"><span>${escape(date(d, { weekday: 'short' }).replace('.', '').toUpperCase())}</span><strong>${date(d, { day: 'numeric' })}</strong>${booking?.date === d ? '<i aria-label="Gebuchter Termin"></i>' : ''}</button>`).join('')}</div><div class="agenda-heading"><h3>${escape(nice(calendarDay))}</h3><span>08:00–${friday ? '14:00' : '18:00'} Uhr</span></div><div class="agenda-list">${daily.some(e => e.service !== 'pause') ? '' : '<div class="agenda-empty">Noch keine Termine an diesem Tag.</div>'}${daily.map(e => e.service === 'pause' ? `<div class="agenda-pause"><span>${escape(e.time)}–${endTime(e)}</span>Mittagspause</div>` : `<article class="agenda-event ${escape(e.service)} ${!e.seeded && !e.preview ? 'own' : ''} ${e.preview ? 'selected-slot' : ''}"><div class="agenda-time"><strong>${escape(e.time)}</strong><span>bis ${endTime(e)}</span></div><div class="agenda-details"><h4>${escape(services[e.service] || e.serviceLabel)}</h4><p>${e.duration} Minuten${!e.seeded && e.name ? ` · ${escape(e.name)}` : ''}</p>${!e.seeded ? `<span class="agenda-badge">${e.preview ? 'Bestätigung noch offen' : 'Ihr Termin · bestätigt'}</span>` : ''}</div></article>`).join('')}${friday ? '<div class="agenda-closed">Ab 14:00 Uhr geschlossen</div>' : ''}</div>`;
  $('#calendar-agenda').querySelectorAll('[data-calendar-day]').forEach(button => button.addEventListener('click', () => { calendarDay = button.dataset.calendarDay; $('#calendar-scroll').scrollTop = 0; renderCalendar(); }));
  $('.legend-seed').parentElement.hidden = !data.appointments.some(a => a.seeded && a.service !== 'pause');
  $('#calendar-subtitle').textContent = booking ? 'Ihr bestätigter Termin ist jetzt eingetragen.' : selected ? 'Ihr Terminwunsch · Bestätigung noch offen' : 'So kommt der Termin in Ihrer Praxis an.';
  $('#tab-count').hidden = !booking;
  const summary = $('#booking-summary');
  summary.classList.toggle('empty', !booking);
  if (booking) {
    summary.innerHTML = `<div class="summary-confirmed"><div class="summary-title"><h3>${icon('appointment')}Ihr Termin ist eingetragen.</h3><span class="summary-status">BESTÄTIGT</span></div><div class="summary-main">${escape(services[booking.service])}</div><div class="summary-meta"><span>${escape(date(booking.date, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${escape(booking.time)} Uhr</span><span>${booking.duration} Min.</span><span>${escape(booking.name)}</span></div><div class="summary-actions"><button id="summary-reminder">${icon('bell')}Erinnerung ansehen</button><button id="summary-reschedule">${icon('restart')}Verschieben</button><button id="summary-download">${icon('download')}Kalenderdatei</button><button id="summary-cancel">${icon('close')}Absagen</button></div></div>`;
    $('#summary-reminder').addEventListener('click', () => { setTab('chat'); send('Erinnerung ansehen', { type: 'reminder' }); });
    $('#summary-reschedule').addEventListener('click', () => { setTab('chat'); send('Ich möchte meinen Termin verschieben.'); });
    $('#summary-cancel').addEventListener('click', () => { setTab('chat'); send('Termin absagen', { type: 'cancel' }); });
    $('#summary-download').addEventListener('click', downloadAppointment);
  } else {
    summary.innerHTML = `<div class="empty-calendar-icon">${icon('appointment')}</div><div><h3>${data.state.booking?.status === 'cancelled' ? 'Termin abgesagt.' : selected ? 'Bestätigung noch offen.' : 'Noch kein Termin gebucht.'}</h3><p>${selected ? 'Schließen Sie Ihre Buchung im Chat ab.' : 'Bestätigte Termine aus dem Chat erscheinen hier.'}</p></div><span class="empty-arrow">${icon('arrowcurve')}</span>`;
  }
  centerCalendar();
}
function centerCalendar() { requestAnimationFrame(() => {
  const mobile = matchMedia('(max-width:600px)').matches;
  const event = mobile ? $('#calendar-agenda .agenda-event.own') || $('#calendar-agenda .agenda-event.selected-slot') : $('#calendar-grid .calendar-event.own') || $('#calendar-grid .calendar-event.selected-slot');
  const scroller = $('#calendar-scroll');
  if (event && scroller.clientHeight) scroller.scrollTop = Math.max(0, mobile ? scroller.scrollTop + event.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 110 : event.offsetTop + 54 - scroller.clientHeight / 2);
}); }
function render() { renderMessages(); renderCalendar(); updateComposer(); resumeContactPrompt(); }
function updateComposer() {
  const hasText = !!$('#message-input').value.trim();
  $('#send').disabled = busy || !!failed || !data || !hasText;
  $('#send').hidden = !hasText && !busy;
  $('#wa-mic').hidden = hasText || busy;
  $('#wa-mic').disabled = busy;
  $('#wa-contact-status').textContent = busy ? 'schreibt …' : 'Unternehmenskonto';
  $('#reset').disabled = busy;
  document.body.classList.toggle('busy', busy);
}
function setTab(name) {
  currentTab = name;
  $('.workspace').classList.toggle('show-calendar', name === 'calendar');
  $('.patient-demo').hidden = name === 'calendar';
  $('#calendar-panel').hidden = name !== 'calendar';
  document.querySelectorAll('.mobile-tabs [data-tab]').forEach(b => { b.classList.toggle('selected', b.dataset.tab === name); b.setAttribute('aria-selected', String(b.dataset.tab === name)); b.tabIndex = b.dataset.tab === name ? 0 : -1; });
  if (name === 'chat') scrollChat();
  else centerCalendar();
}
let resizeFrame;
window.addEventListener('resize', () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => { if (currentTab === 'chat') scrollChat(); else centerCalendar(); }); });
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('.demo-tabs').addEventListener('keydown', e => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
  e.preventDefault(); const next = e.key === 'Home' ? 'chat' : e.key === 'End' ? 'calendar' : currentTab === 'chat' ? 'calendar' : 'chat';
  setTab(next); document.querySelector('.demo-tabs [data-tab="' + next + '"]').focus();
});

async function api(path, body) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(demoSession ? { 'X-Demo-Session': demoSession } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(22000), credentials: 'same-origin', cache: 'no-store' });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Bitte versuchen Sie es erneut.');
  if (result.demoSession) demoSession = result.demoSession;
  return result;
}
async function downloadAppointment() {
  try {
    const response = await fetch('/api/appointment.ics', { headers: demoSession ? { 'X-Demo-Session': demoSession } : {}, credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Die Kalenderdatei ist gerade nicht verfügbar.');
    const url = URL.createObjectURL(await response.blob()), link = document.createElement('a'); link.href = url; link.download = 'termin.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { notify(error.message || 'Die Kalenderdatei konnte nicht geladen werden.'); }
}
function notify(text, calendar = false) {
  clearTimeout(toastTimer); $('#toast-text').textContent = text; $('#toast-calendar').hidden = !calendar; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 6000);
}
$('#toast-calendar').addEventListener('click', () => { setTab('calendar'); $('#toast').hidden = true; $('#calendar-panel').classList.add('focused'); });

async function send(text, action = null, retry = null) {
  if (busy || (!text?.trim() && !retry)) return;
  if (failed && !retry) return;
  const payload = retry || { id: crypto.randomUUID().replaceAll('-', ''), text: text.trim(), ...(action ? { action } : {}) };
  const previousBooking = data?.state.booking;
  busy = true; failed = null; $('#error').hidden = true; updateComposer();
  renderMessages();
  $('#messages').insertAdjacentHTML('beforeend', messageHTML({ id: payload.id, role: 'user', text: payload.text, at: new Date().toISOString() }, true).replace('class="message ', 'class="message optimistic '));
  $('#typing').hidden = false; scrollChat();
  try {
    const next = await api('/api/message', payload);
    data = next;
    const b = data.state.booking;
    if (data.state.selected?.date) { shownWeek = monday(data.state.selected.date); calendarDay = data.state.selected.date; }
    else if (b?.status === 'confirmed') { shownWeek = monday(b.date); calendarDay = b.date; }
    if (b?.status === 'confirmed' && data.state.phase === 'booked' && (previousBooking?.status !== 'confirmed' || previousBooking.id !== b.id)) scheduleContactPrompt();
  } catch (error) {
    failed = payload; $('#error').textContent = error.name === 'TimeoutError' || error instanceof TypeError ? 'Die Verbindung wurde unterbrochen. Ihre Nachricht lässt sich sicher erneut senden.' : error.message;
    const retryButton = document.createElement('button'); retryButton.textContent = 'Erneut senden'; retryButton.className = 'retry-button'; retryButton.addEventListener('click', () => send(null, null, failed)); $('#error').append(' ', retryButton); $('#error').hidden = false;
  } finally { busy = false; $('#typing').hidden = true; render(); }
}

const input = $('#message-input');
function openConversation() { $('#chat-panel').classList.remove('show-chat-list'); $('#wa-chat-list').hidden = true; scrollChat(); }
$('#wa-back').addEventListener('click', () => { $('#chat-panel').classList.add('show-chat-list'); $('#wa-chat-list').hidden = false; $('#wa-emoji-picker').hidden = true; $('#wa-emoji-toggle').setAttribute('aria-expanded', 'false'); });
$('#wa-open-chat').addEventListener('click', openConversation);
$('#wa-emoji-toggle').addEventListener('click', () => { const picker = $('#wa-emoji-picker'); picker.hidden = !picker.hidden; $('#wa-emoji-toggle').setAttribute('aria-expanded', String(!picker.hidden)); });
document.querySelectorAll('[data-emoji]').forEach(button => button.addEventListener('click', () => { const from = input.selectionStart, to = input.selectionEnd; input.value = (input.value.slice(0, from) + button.dataset.emoji + input.value.slice(to)).slice(0, 1200); input.dispatchEvent(new Event('input')); $('#wa-emoji-picker').hidden = true; $('#wa-emoji-toggle').setAttribute('aria-expanded', 'false'); input.focus(); input.setSelectionRange(from + button.dataset.emoji.length, from + button.dataset.emoji.length); }));
document.querySelectorAll('[data-wa-preview]').forEach(button => button.addEventListener('click', () => notify(button.dataset.waPreview === 'Anrufe' ? 'Anrufe sind in dieser Demo nicht verfügbar.' : 'Diese Demo unterstützt Textnachrichten.')));
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 100)}px`; updateComposer(); resumeContactPrompt(); });
$('#chat-form').addEventListener('submit', e => { e.preventDefault(); const text = input.value.trim(); if (!text || busy || failed || !data) return; input.value = ''; input.style.height = 'auto'; send(text); });
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#chat-form').requestSubmit(); } });
$('#prev-week').addEventListener('click', () => { if (shownWeek > data.week) shownWeek = add(shownWeek, -7); calendarDay = null; renderCalendar(); });
$('#next-week').addEventListener('click', () => { if (shownWeek < add(data.week, 42)) shownWeek = add(shownWeek, 7); calendarDay = null; renderCalendar(); });
$('#calendar-today').addEventListener('click', () => { shownWeek = defaultWeek(); calendarDay = data.today; renderCalendar(); });

const dialog = $('#info-dialog');
const contactDialog = $('#contact-dialog');
function openContact() {
  clearTimeout(contactTimer); contactPrompted = true; contactPending = false;
  const booked = data?.state.booking?.status === 'confirmed';
  $('#contact-copy').textContent = booked ? 'Sie haben gerade selbst einen Termin per Chat gebucht. Lassen Sie uns besprechen, wie das bei Ihnen aussehen kann.' : 'Lassen Sie uns besprechen, wie die Terminbuchung per Chat bei Ihnen aussehen kann.';
  $('#contact-calendar').hidden = !booked;
  if (dialog.open) dialog.close();
  if (!contactDialog.open) contactDialog.showModal();
}
function scheduleContactPrompt() {
  if (contactPrompted) return;
  contactPending = true;
  resumeContactPrompt();
}
function resumeContactPrompt() {
  clearTimeout(contactTimer);
  if (!contactPending || contactPrompted) return;
  if (data?.state.booking?.status !== 'confirmed') { contactPending = false; return; }
  if (busy || input.value.trim() || document.hidden || dialog.open || data.state.phase !== 'booked') return;
  contactTimer = setTimeout(() => {
    if (!busy && !input.value.trim() && !document.hidden && !dialog.open && data?.state.phase === 'booked' && data.state.booking?.status === 'confirmed') openContact();
  }, 3500);
}
document.addEventListener('visibilitychange', resumeContactPrompt);
dialog.addEventListener('close', resumeContactPrompt);
$('#open-contact').addEventListener('click', openContact);
$('#contact-close').addEventListener('click', () => contactDialog.close());
$('#contact-continue').addEventListener('click', () => contactDialog.close());
$('#contact-calendar').addEventListener('click', () => { contactDialog.close(); setTab('calendar'); });
contactDialog.addEventListener('click', e => {
  if (e.target !== contactDialog) return;
  const r = contactDialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) contactDialog.close();
});
const closeDialog = () => dialog.close();
$('.dialog-close').addEventListener('click', closeDialog);
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(); } });
function openInfo(privacy = false) {
  $('#dialog-tools').hidden = privacy;
  $('#dialog-content').innerHTML = privacy
    ? '<h2>Hinweise & Datenschutz</h2><p>Diese fiktive Praxis zeigt, wie eine Buchung per WhatsApp aussehen kann. Bitte nur erfundene Angaben verwenden.</p><p>Nachrichten werden mit OpenAI verarbeitet und mit den Terminen höchstens 24 Stunden auf diesem Server gespeichert. „Chat neu starten“ löscht Ihre Sitzung sofort. Es gibt keine Analyse- oder Werbecookies.</p><p>Es werden keine echten Praxisbuchungen oder WhatsApp-Nachrichten verschickt. Erinnerungen sind eine gekennzeichnete Vorschau. Keine medizinische Beratung.</p><button class="dialog-action" id="dialog-start">Schließen</button>'
    : '<h2>Praxis am Park</h2><p>Fiktive Praxis zum Ausprobieren. Buchen, verschieben oder sagen Sie einen Termin im Chat ab. Im Tab „Praxiskalender“ sehen Sie den Eintrag.</p>';
  $('#dialog-start')?.addEventListener('click', closeDialog);
  if (!dialog.open) dialog.showModal();
}

document.querySelectorAll('[data-open-info]').forEach(b => b.addEventListener('click', () => openInfo()));
document.querySelectorAll('[data-open-privacy]').forEach(b => b.addEventListener('click', () => openInfo(true)));
$('#share-link').addEventListener('click', async () => {
  const link = new URL('/demo', location.origin).href;
  try { await navigator.clipboard.writeText(link); closeDialog(); notify('Weitergabe-Link kopiert. Jeder Aufruf startet frisch.'); }
  catch {
    $('#dialog-tools').hidden = true;
    $('#dialog-content').innerHTML = `<h2>Link zum Weitergeben</h2><p>Jeder Aufruf startet mit einem frischen Chat und Kalender.</p><input class="share-url" aria-label="Weitergabe-Link" readonly value="${escape(link)}"><button class="dialog-action" id="close-share">Schließen</button>`;
    $('#close-share').addEventListener('click', closeDialog); $('.share-url').select();
  }
});
$('#reset').addEventListener('click', () => {
  if (busy) return;
  $('#dialog-tools').hidden = true;
  $('#dialog-content').innerHTML = `<h2>Noch einmal von vorn?</h2><p>Ihr Chatverlauf und die gebuchten Termine werden gelöscht.</p><button class="dialog-action" id="confirm-reset">Chat neu starten</button>`;
  $('#confirm-reset').addEventListener('click', async () => {
    closeDialog(); busy = true; updateComposer();
    try { data = await api('/api/reset', {}); clearTimeout(contactTimer); contactPrompted = false; contactPending = false; if (contactDialog.open) contactDialog.close(); shownWeek = defaultWeek(); calendarDay = null; failed = null; $('#error').hidden = true; input.value = ''; setTab('chat'); openConversation(); notify('Bereit für einen neuen Termin.'); }
    catch { notify('Neustart fehlgeschlagen. Bitte versuchen Sie es erneut.'); }
    finally { busy = false; render(); }
  }); if (!dialog.open) dialog.showModal();
});

async function initialize() {
  try { data = freshEntry ? await api('/api/demo-session', {}) : await api('/api/session'); calendarDay = data.state.booking?.status === 'confirmed' ? data.state.booking.date : data.state.selected?.date || null; shownWeek = calendarDay ? monday(calendarDay) : defaultWeek(); render(); }
  catch { $('#messages').innerHTML = `<div class="loading-state"><p>Die Demo ist gerade nicht erreichbar.</p><button class="choice-button" id="reload">Neu verbinden</button></div>`; $('#reload').addEventListener('click', initialize);  }
}
initialize();
window.addEventListener('pageshow', event => { if (freshEntry && event.persisted) location.reload(); });
