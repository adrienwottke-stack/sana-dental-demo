import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, progress, seedAppointments, minutes } from '../lib/booking.mjs';
import { parseLocal, understand } from '../lib/understand.mjs';
import { naturalizeReplies, acceptableReply, presentMessage } from '../lib/dialogue.mjs';
const NOW = new Date('2026-10-17T12:00:00Z');
const seed = seedAppointments('2026-10-12',56);
const turn = (s,t,action=null) => progress(s,action ? {} : parseLocal(t,s,NOW),t,action,seed,NOW);

test('availability: a free requested time offered within a time window is never called occupied',()=>{
  const s=initialState(), pauses=seed.filter(a=>a.service==='pause');
  progress(s,{service:'cleaning',date:'2026-10-19',dateEnd:'2026-10-25',after:'15:00'},'Zahnreinigung nächste Woche nach 15 Uhr',null,pauses,NOW);
  const r=progress(s,{date:'2026-10-20',time:'16:00',after:'16:00'},'Der Dienstag wäre mir lieber, so gegen 16 Uhr. Geht das auch?',null,pauses,NOW);
  assert.equal(s.phase,'slots');assert.ok(s.offers.some(o=>o.date==='2026-10-20'&&o.time==='16:00'));
  assert.doesNotMatch(r.replies.at(-1).text,/leider|belegt|eingetragen|nichts Passendes/i);
});

test('availability: a request outside opening hours is unavailable without inventing an occupied booking',()=>{
  const s=initialState(), pauses=seed.filter(a=>a.service==='pause');
  const r=progress(s,{service:'cleaning',date:'2026-10-23',time:'16:00'},'Zahnreinigung Freitag um 16 Uhr',null,pauses,NOW);
  assert.equal(s.phase,'slots');assert.ok(s.offers.length>0);assert.ok(s.offers.every(o=>o.date!=='2026-10-23'||o.time!=='16:00'));
  assert.match(r.replies[0].text,/leider keinen passenden Termin frei/);assert.doesNotMatch(r.replies[0].text,/belegt|eingetragen/i);
});

test('availability: AI wording cannot add an unverified rejection to free suggestions',()=>{
  const s=initialState(), result=turn(s,'Zahnreinigung nächste Woche nachmittags'), original=result.replies[0];
  assert.equal(acceptableReply(original.text,original,s),true);
  for(const prefix of ['Leider ist Ihre Wunschzeit belegt. ','An dem Tag ist nichts mehr frei. ']) assert.equal(acceptableReply(prefix+original.text,original,s),false);
});
function review() {
  const s=initialState(); turn(s,'Zahnreinigung nächste Woche nachmittags'); turn(s,'Auswahl',{type:'choose',slotId:s.offers[0].id}); turn(s,'Ich bin neu'); turn(s,'Alex Sommer'); assert.equal(s.phase,'review'); return s;
}
test('free-text booking needs no choice buttons and collects only missing details',()=>{
  const s=initialState(); turn(s,'Mein Name ist Alex Sommer, ich bin neu. Kontrolle nächste Woche nachmittags.');
  assert.equal(s.draft.name,'Alex Sommer'); assert.equal(s.draft.patientType,'new'); assert.equal(s.phase,'slots');
  const offer=s.offers[0]; turn(s,'Der erste passt mir'); assert.equal(s.phase,'review');
  const r=turn(s,'Ja, super, bitte eintragen'); assert.equal(r.mutation?.type,'book'); assert.equal(s.booking.date,offer.date); assert.equal(s.booking.name,'Alex Sommer');
});
test('a changed or conditional request never counts as final confirmation',()=>{
  const s=review(); const r=progress(s,{confirm:true,date:'2026-10-22',time:'17:00'},'Ja, aber lieber am Donnerstag um 17 Uhr',null,seed,NOW);
  assert.equal(r.mutation,undefined); assert.equal(s.booking,null); assert.equal(s.phase,'review'); assert.equal(s.selected.date,'2026-10-22');
  const s2=review(); assert.equal(progress(s2,{confirm:true},'Ja, aber ich muss noch nachsehen',null,seed,NOW).mutation,undefined);
});
test('relative later and earlier wishes respect the previously offered time',()=>{
  const s=initialState(); turn(s,'Kontrolle nächste Woche'); const earlier=s.offers[0].time; turn(s,'Etwas später wäre mir lieber');
  assert.equal(s.phase,'slots'); assert.ok(s.offers.every(o=>o.time>=s.draft.after)); assert.ok(minutes(s.draft.after)>minutes(earlier));
  const anchor=s.offers[0].time; turn(s,'Geht es früher?'); assert.ok(s.offers.every(o=>minutes(o.time)+30<=minutes(anchor)));
});
test('a real FAQ can be answered in the middle of the booking without forgetting supplied details',()=>{
  const s=initialState(); const r=turn(s,'Mein Name ist Alex Sommer, ich bin neu. Zahnreinigung nächste Woche. Wie lange dauert das?');
  assert.match(r.replies.at(-1).text,/60 Minuten/); assert.equal(s.draft.name,'Alex Sommer'); assert.equal(s.draft.patientType,'new'); assert.equal(s.phase,'slots');
  turn(s,'Den ersten bitte'); assert.equal(s.phase,'review');
});
test('an unrelated duration question preserves a pending name question and selected slot',()=>{
  const s=initialState(); turn(s,'Kontrolle nächste Woche'); turn(s,'Den ersten bitte'); turn(s,'Ich war schon da'); const id=s.selected.id;
  const r=turn(s,'Wie lange dauert das?'); assert.match(r.replies[0].text,/30 Minuten/); assert.equal(s.phase,'name'); assert.equal(s.selected.id,id);
  turn(s,'Alex Sommer'); assert.equal(s.phase,'review');
});
test('gratitude after booking gets a short response with no repeated booking menu',()=>{
  const s=review(); turn(s,'Ja, das passt'); const id=s.booking.id; const r=turn(s,'Super, vielen Dank!'); assert.equal(s.booking.id,id); assert.equal(r.mutation,undefined); assert.ok(r.replies[0].text.length<120); assert.equal(r.replies[0].choices,undefined);
});
test('gratitude alone never confirms a pending booking even if extraction says confirm',()=>{
  const s=review(); const r=progress(s,{intent:'booking',confirm:true,salutation:'thanks'},'Danke!',null,seed,NOW); assert.equal(r.mutation,undefined); assert.equal(s.booking,null); assert.equal(s.phase,'review');
});

test('free-text cancellation accepts a natural confirmation and rejects a conditional yes',()=>{
  const s=review(); turn(s,'Ja, bitte eintragen.'); const id=s.booking.id;
  turn(s,'Den Termin muss ich leider absagen.'); assert.equal(s.phase,'cancel_review');
  const pending=progress(s,{intent:'cancel',confirm:true},'Ja, aber ich muss erst noch nachsehen',null,seed,NOW);
  assert.equal(pending.mutation,undefined); assert.equal(s.booking.status,'confirmed');
  const cancelled=turn(s,'Ja, bitte absagen. Danke!'); assert.equal(cancelled.mutation?.type,'cancel'); assert.equal(s.booking.id,id); assert.equal(s.booking.status,'cancelled');
});
test('colloquial times, work hours and day exclusions are understood',()=>{
  assert.equal(parseLocal('halb vier wäre gut',initialState(),NOW).time,'15:30');
  const s=initialState(); turn(s,'Kontrolle nächste Woche nach der Arbeit, außer Montag'); assert.ok(s.offers.length>0); assert.ok(s.offers.every(o=>o.time>='16:00'&&o.date!=='2026-10-19'&&o.date<='2026-10-25'));
});

test('explicit reminder and ordinal references survive contradictory model extraction',async()=>{
  const s=initialState(); turn(s,'Zahnreinigung nächste Woche nachmittags'); const first=s.offers[0]; const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({...parseLocal('Den ersten bitte',s,NOW),slotIndex:1,date:s.offers[1].date,time:s.offers[1].time})}}]})});
    const selection=await understand('Den ersten bitte',s,{apiKey:'synthetic',now:NOW});
    assert.equal(selection.parsed.slotIndex,0); assert.equal(selection.parsed.time,first.time); assert.equal(selection.parsed.date,first.date);
    globalThis.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({...parseLocal('Kann ich die Erinnerung vorher einmal sehen?',s,NOW),intent:'other'})}}]})});
    const reminder=await understand('Kann ich die Erinnerung vorher einmal sehen?',s,{apiKey:'synthetic',now:NOW}); assert.equal(reminder.parsed.intent,'reminder');
  } finally { globalThis.fetch=original; }
});
test('normal conversation, cards and buttons contain no Demo-Termin wording',()=>{
  const s=review(); const r=turn(s,'Ja, gerne'); for(const m of [...s.messages,...r.replies]){ assert.doesNotMatch(m.text,/Demo[- ]?Termin/i); for(const c of m.choices||[])assert.doesNotMatch(c.label,/Demo[- ]?Termin/i); }
  const legacy=presentMessage({role:'assistant',text:'Ihr Demo-Termin ist bestätigt.',choices:[{label:'Demo-Termin absagen'}]}); assert.equal(legacy.text,'Ihr Termin ist bestätigt.'); assert.equal(legacy.choices[0].label,'Termin absagen');
});

test('plain confirmations ignore contradictory details copied by the provider from history',async()=>{
  const s=review(),original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({...parseLocal('Ja, bitte eintragen.',s,NOW),date:'2026-10-22',time:'17:00',decline:true,confirm:false})}}]})});
  try {
    const accepted=await understand('Ja, bitte eintragen.',s,{apiKey:'synthetic',now:NOW});assert.equal(accepted.parsed.date,null);assert.equal(accepted.parsed.decline,false);
    assert.equal(progress(s,accepted.parsed,'Ja, bitte eintragen.',null,seed,NOW).mutation?.type,'book');
    turn(s,'Den Termin muss ich leider absagen.');assert.equal(s.phase,'cancel_review');
    const cancellation=await understand('Ja, bitte absagen.',s,{apiKey:'synthetic',now:NOW});assert.equal(cancellation.parsed.intent,'cancel');assert.equal(cancellation.parsed.date,null);
    assert.equal(progress(s,cancellation.parsed,'Ja, bitte absagen.',null,seed,NOW).mutation?.type,'cancel');assert.equal(s.booking.status,'cancelled');
  } finally { globalThis.fetch=original; }
});

test('asking to cancel during a reschedule review never confirms the replacement time',()=>{
  const s=review();turn(s,'Ja, bitte eintragen.');turn(s,'Ich möchte den Termin auf Donnerstag um 17 Uhr verschieben.');assert.equal(s.phase,'review');
  const result=progress(s,{intent:'cancel',confirm:true},'Ja, bitte absagen.',null,seed,NOW);assert.equal(result.mutation,undefined);assert.equal(s.phase,'cancel_review');assert.equal(s.booking.status,'confirmed');
});
test('unverified times, completion claims and extra personal questions are rejected',()=>{
  const s=review(), original={id:'a',text:'Wie ist Ihr Vor- und Nachname?',kind:'text'}; s.phase='name';
  for(const text of ['Ihr Termin ist schon gebucht.','Sie können um 23:47 Uhr kommen.','Wie ist Ihr Geburtsdatum?','Die Zahnreinigung ist kostenlos.']) assert.equal(acceptableReply(text,original,s),false,text);
});

test('spoken appointment options keep the same order as the available choice fields',()=>{
  const s=initialState(),r=turn(s,'Zahnreinigung nächste Woche nachmittags'),original=r.replies[0];
  assert.equal(acceptableReply(original.text,original,s),true);
  const reordered=`Gern! Ich könnte Ihnen ${[...original.slots].reverse().map(o=>`${o.time} Uhr`).join(', oder ')} anbieten. Welcher Termin passt Ihnen?`;
  assert.equal(acceptableReply(reordered,original,s),false);
  const partial=`Gern! ${original.slots.at(-1).time} Uhr wäre frei. Welcher Termin passt Ihnen?`;
  assert.equal(acceptableReply(partial,original,s),false);
});
test('natural rewriting changes wording while protecting IDs, choices and booking state',async()=>{
  const s=initialState();const result=turn(s,'Kontrolle nächste Woche');const original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({replies:[{id:result.replies[0].id,text:'Gern, ich habe Ihnen ein paar freie Zeiten herausgesucht. Welcher Termin würde Ihnen passen?'}]})}}],usage:{total_tokens:55}})});
  try{const out=await naturalizeReplies(result,'Kontrolle nächste Woche',{apiKey:'synthetic'});assert.equal(out.replyEngine,'ai');assert.deepEqual(out.replies[0].choices,result.replies[0].choices);assert.equal(out.state.booking,null);assert.equal(out.tokens,55);}finally{globalThis.fetch=original;}
});
test('provider failure or invented booking falls back to truthful reception copy',async()=>{
  const s=review();s.phase='name';const result={state:s,replies:[{id:'ask-name',text:'Wie ist Ihr Vor- und Nachname?',kind:'text'}]};const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({replies:[{id:'ask-name',text:'Ihr Termin ist gebucht und die Erinnerung ist verschickt.'}]})}}]})});
    const rejected=await naturalizeReplies(result,'Hallo',{apiKey:'synthetic'});assert.equal(rejected.replyEngine,'curated');assert.equal(rejected.replies[0].text,result.replies[0].text);assert.equal(rejected.state.booking,null);
    globalThis.fetch=async()=>{throw new Error('offline');};const fallback=await naturalizeReplies(result,'Hallo',{apiKey:'synthetic'});assert.equal(fallback.replyEngine,'curated');
  }finally{globalThis.fetch=original;}
});
