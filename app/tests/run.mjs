// Unit tests for the pure logic in app/src/app.template.html, plus a syntax check of the built page.
// Run: node app/tests/run.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const tpl = read('app/src/app.template.html');

// The app script runs from "use strict" to the shell section; everything before the shell is DOM-free.
const start = tpl.indexOf('"use strict";');
const end = tpl.indexOf('/* ---------- shell ---------- */');
assert.ok(start > 0 && end > start, 'could not find the core region of the app script');
const data = (f) => read('app/build/data/' + f);
const pre = `const AIRPORTS=${data('airports.json')};const TZS=${data('tzs.json')};const ISO=${data('iso.json')};const LOGOS={};const WORLD=null;const SEED="";`;
const exportNames = 'parseCSV,csvToFlights,tzDuration,airNames,airKey,acFamily,dist,fx,apOf,flightsToICS,merge,estMin,normDate,mapClass,mapSeatType,mapWhy,timeOf,keyOf,uid,AP,ACC,loungeCode,mapAccess,flightsToCSV';
const store = {};
const ctx = {
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { querySelector: () => null, querySelectorAll: () => [], documentElement: { dataset: {} } },
  window: {}, console, Intl, Date, JSON, Math, Map, Set, Promise, setTimeout, clearTimeout,
};
vm.createContext(ctx);
const namesA = tpl.indexOf('/* @core-names */'), namesB = tpl.indexOf('/* @end-core-names */');
assert.ok(namesA > 0 && namesB > namesA, 'could not find the names block');
vm.runInContext(`${pre}\n${tpl.slice(start, end)}\n${tpl.slice(namesA, namesB)}\nthis.__t={${exportNames},getFlights:()=>flights,setFlights:(v)=>{flights=v}};`, ctx);
const T = ctx.__t;

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { console.error('FAIL ' + name + '\n     ' + (e.message || e)); process.exitCode = 1; }
};

test('parseCSV handles quotes, multi-line cells, BOM and blank lines', () => {
  const rows = T.parseCSV('﻿\nA,B,C\n1,"two, 2","line1\nline2"\n\n4,5,6\n');
  assert.equal(rows.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(rows[1])), ['1', 'two, 2', 'line1\nline2']); // JSON round trip: arrays from the vm have another prototype
});

test('normDate accepts ISO and day-first dates', () => {
  assert.equal(T.normDate('2024-05-01T08:00:00'), '2024-05-01');
  assert.equal(T.normDate('25/12/2024'), '2024-12-25');
  assert.equal(T.normDate('12/25/2024'), '2024-12-25');
  assert.equal(T.normDate('05/04/2024'), '2024-04-05');
  assert.equal(T.normDate('nonsense'), '');
});

test('FlightDiary format imports with codes, airline, aircraft and seat', () => {
  const csv = 'Date,"Flight number",From,To,"Dep time","Arr time",Duration,Airline,Aircraft,Registration,"Seat number","Seat type","Flight class","Flight reason",Note\n' +
    '2020-01-02,XX100,"City A / Test Field (LHR/EGLL)","City B / Other (JFK/KJFK)",10:00:00,12:30:00,07:30:00,"Example Air (EX/EXA)","Airbus A320-200 (A320)",G-TEST,14A,1,4,2,"two\nlines"\n';
  const { list, bad } = T.csvToFlights(csv);
  assert.equal(bad, 0);
  const f = list[0];
  assert.equal(f.from, 'LHR'); assert.equal(f.to, 'JFK');
  assert.equal(f.airline, 'Example Air'); assert.equal(f.airlineCode, 'EX');
  assert.equal(f.aircraft, 'Airbus A320-200'); assert.equal(f.aircraftCode, 'A320');
  assert.equal(f.duration, 450); assert.equal(f.cls, 4); assert.equal(f.why, 2); assert.equal(f.note, 'two\nlines');
});

test('registration that equals the seat is dropped (export quirk)', () => {
  const csv = 'Date,From,To,Registration,"Seat number"\n2020-01-02,LHR,JFK,16C,16C\n';
  assert.equal(T.csvToFlights(csv).list[0].reg, '');
});

test('Flighty-style headers and class names import', () => {
  const csv = 'Date,Airline,Flight,From,To,Take off (Actual),Landing (Actual),Aircraft Type Name,Tail Number,Seat,Seat Type,Cabin Class,Flight Reason\n' +
    '2024-03-10,DL,DL123,JFK,LHR,2024-03-10T21:00:00,2024-03-11T09:00:00,Boeing 767-300,N12345,21G,Window,Premium Economy,Business\n';
  const f = T.csvToFlights(csv).list[0];
  assert.equal(f.airlineCode, 'DL'); assert.equal(f.airline, 'Delta Air Lines');
  assert.equal(f.depTime, '21:00'); assert.equal(f.arrTime, '09:00');
  assert.equal(f.seatType, 1); assert.equal(f.cls, 4); assert.equal(f.why, 2); assert.equal(f.reg, 'N12345');
});

test('rows with unknown airports or bad dates are skipped', () => {
  const csv = 'Date,From,To\nnot-a-date,LHR,JFK\n2020-01-01,???,JFK\n2020-01-01,LHR,JFK\n';
  const r = T.csvToFlights(csv);
  assert.equal(r.list.length, 1); assert.equal(r.bad, 2);
});

test('great-circle distance LHR to JFK is about 5,540 km', () => {
  const d = T.dist(T.apOf('LHR'), T.apOf('JFK'));
  assert.ok(Math.abs(d - 5540) < 40, 'got ' + d);
});

test('duration from local times respects time zones (LHR to JFK in summer)', () => {
  assert.equal(T.tzDuration({ date: '2024-06-01', from: 'LHR', to: 'JFK', depTime: '10:00', arrTime: '12:30' }), 450);
});

test('duration from local times respects time zones (TLV to LHR in winter)', () => {
  assert.equal(T.tzDuration({ date: '2024-12-24', from: 'TLV', to: 'LHR', depTime: '08:00', arrTime: '11:45' }), 345);
});

test('overnight arrival is counted into the next day', () => {
  assert.equal(T.tzDuration({ date: '2024-06-01', from: 'JFK', to: 'LHR', depTime: '19:00', arrTime: '07:00' }), 420);
});

test('stored duration wins over computed and estimated duration', () => {
  const x = T.fx({ date: '2024-06-01', from: 'LHR', to: 'JFK', depTime: '10:00', arrTime: '12:30', duration: 500 });
  assert.equal(x.min, 500); assert.equal(x.est, false);
  const e = T.fx({ date: '2024-06-01', from: 'LHR', to: 'JFK' });
  assert.equal(e.est, true); assert.ok(e.min > 300);
});

test('airlines merge by IATA code and use the most common name', () => {
  const list = [{ airline: 'Swiss', airlineCode: 'LX' }, { airline: 'Swiss International Air Lines', airlineCode: 'LX' }, { airline: 'Swiss International Air Lines', airlineCode: 'lx' }, { airline: 'Local Air' }];
  assert.equal(T.airKey(list[0]), 'LX');
  assert.equal(T.airNames(list).get('LX'), 'Swiss International Air Lines');
  assert.notEqual(T.airKey(list[3]), '');
});

test('aircraft families', () => {
  const fam = (aircraft, aircraftCode = '') => T.acFamily({ aircraft, aircraftCode });
  assert.equal(fam('Boeing 737-800', 'B738'), 'Boeing 737');
  assert.equal(fam('Boeing 737', 'B73X'), 'Boeing 737');
  assert.equal(fam('Airbus A321LR', 'A21N'), 'Airbus A320 family');
  assert.equal(fam('Boeing 787-9'), 'Boeing 787');
  assert.equal(fam('Airbus A350-900'), 'Airbus A350');
  assert.equal(fam('Embraer E195'), 'Embraer E-Jet');
  assert.equal(fam('ATR 72-500', 'AT75'), 'ATR 42/72');
  assert.equal(fam('Something New'), 'Something New');
});

test('merge skips flights that are already in the log', () => {
  T.setFlights([]);
  const mk = () => T.csvToFlights('Date,From,To,Flight number\n2020-01-01,LHR,JFK,EX1\n2020-02-01,JFK,LHR,EX2\n').list;
  assert.equal(T.merge(mk(), null).add, 2);
  const again = T.merge(mk(), null);
  assert.equal(again.add, 0); assert.equal(again.dup, 2);
});

test('calendar export builds a UTC time for an upcoming flight', () => {
  const ics = T.flightsToICS([{ id: 'x1', date: '2026-12-24', from: 'TLV', to: 'LHR', depTime: '08:00', arrTime: '11:45', duration: 0, flightNo: 'EX315', airline: 'Example Air', cls: 1 }]);
  assert.ok(ics.includes('BEGIN:VCALENDAR') && ics.includes('END:VCALENDAR'));
  assert.ok(ics.includes('DTSTART:20261224T060000Z'), ics);
  assert.ok(ics.includes('SUMMARY:Flight EX 315 TLV to LHR'));
});

test('lounge visits survive a CSV round trip', () => {
  T.setFlights([{ id: 'a', date: '2024-05-01', from: 'LHR', to: 'JFK', flightNo: 'EX1', loungeName: 'Test Lounge, Terminal 3', loungeAccess: 1, loungeAt: 'from', cls: 1, why: 1, photos: [] },
                { id: 'b', date: '2024-05-09', from: 'JFK', to: 'LHR', flightNo: 'EX2', loungeName: 'Arrival Spa', loungeAccess: 3, loungeAt: 'to', cls: 1, why: 1, photos: [] },
                { id: 'c', date: '2024-06-01', from: 'LHR', to: 'JFK', flightNo: 'EX3', cls: 1, why: 1, photos: [] }]);
  const list = T.csvToFlights(T.flightsToCSV()).list;
  assert.equal(list.length, 3);
  assert.equal(list[0].loungeName, 'Test Lounge, Terminal 3'); assert.equal(list[0].loungeAccess, 1); assert.equal(list[0].loungeAt, 'from');
  assert.equal(list[1].loungeName, 'Arrival Spa'); assert.equal(list[1].loungeAccess, 3); assert.equal(list[1].loungeAt, 'to');
  assert.equal(T.loungeCode(list[1]), 'LHR');
  assert.equal(list[2].loungeName, ''); assert.equal(list[2].loungeAccess, 0);
});

test('lounge access text maps to the right method', () => {
  assert.equal(T.mapAccess('Priority Pass / LoungeKey'), 1); assert.equal(T.mapAccess('Airline status'), 2);
  assert.equal(T.mapAccess('Credit card'), 3); assert.equal(T.mapAccess('Paid entry'), 4);
  assert.equal(T.mapAccess('Business class ticket'), 5); assert.equal(T.mapAccess('something else'), 6); assert.equal(T.mapAccess(''), 0);
});

test('the built page has valid JavaScript', () => {
  const html = read('docs/index.html');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 2);
  scripts.forEach((s) => new vm.Script(s));
});

test('the public site contains no private build inputs', () => {
  const html = read('docs/index.html');
  assert.ok(html.includes('const SEED=""'), 'SEED must be empty in docs/index.html');
});

console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`);
