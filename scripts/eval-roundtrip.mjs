#!/usr/bin/env node
// Self-check: build an address for every old commune in several writing styles,
// convert it, and measure how often the parser recognises exactly that commune.
// Usage: node scripts/eval-roundtrip.mjs [sampleEvery=1]

import { loadData } from '../src/data.mjs';
import { analyze, topHypotheses, interpret } from '../src/parse.mjs';
import { stripDiacritics } from '../src/normalize.mjs';

const every = Number(process.argv[2]) || 1;
const db = loadData();
const ABBR = { 'Phường': 'P.', 'Xã': 'X.', 'Thị trấn': 'TT.', 'Quận': 'Q.', 'Huyện': 'H.', 'Thị xã': 'TX.', 'Thành phố': 'TP.', 'Tỉnh': 'T.' };
const styles = {
  full: (w) => `${w.fullName}, ${w.district.fullName}, ${w.province.fullName}`,
  noDiacritics: (w) => stripDiacritics(`${w.fullName}, ${w.district.fullName}, ${w.province.fullName}`),
  abbreviated: (w) => `${ABBR[w.type]} ${w.name}, ${ABBR[w.district.type]} ${w.district.name}, ${w.province.name}`,
  withStreet: (w) => `Số 15 đường Lê Lợi, ${w.fullName}, ${w.district.fullName}, ${w.province.fullName}`,
  bareNames: (w) => (/^\d+$/.test(w.name) ? null : `${w.name}, ${w.district.name}, ${w.province.name}`),
};

const stats = {};
const failures = {};
let i = 0;
for (const w of db.oldWards.values()) {
  if (i++ % every) continue;
  for (const [style, fn] of Object.entries(styles)) {
    const text = fn(w);
    if (!text) continue;
    const s = (stats[style] ||= { total: 0, exact: 0, ambiguousIncl: 0, wrong: 0 });
    s.total++;
    const top = topHypotheses(analyze(text).hyps);
    const wards = top.map((h) => interpret(h).ward).filter(Boolean);
    if (wards.length === 1 && wards[0] === w) s.exact++;
    else if (wards.includes(w)) s.ambiguousIncl++;
    else {
      s.wrong++;
      (failures[style] ||= []).push(`${text}  =>  ${wards.map((x) => x.fullName + ' / ' + (x.district?.fullName || x.province.fullName)).join(' ; ') || '(none)'}`);
    }
  }
}
// New-format addresses must come back unchanged.
const { convert } = await import('../src/convert.mjs');
for (const w of db.newWards.values()) {
  for (const [style, text] of [
    ['new:full', `${w.fullName}, ${w.province.fullName}`],
    ['new:noDiacritics', stripDiacritics(`${w.fullName}, ${w.province.fullName}`)],
  ]) {
    const s = (stats[style] ||= { total: 0, exact: 0, ambiguousIncl: 0, wrong: 0 });
    s.total++;
    const r = convert(text);
    if (r.status === 'ok' && r.ward.code === w.code) s.exact++;
    else if (r.candidates.some((c) => c.ward?.code === w.code)) s.ambiguousIncl++;
    else {
      s.wrong++;
      (failures[style] ||= []).push(`${text}  =>  ${r.status} ${r.address}`);
    }
  }
}

for (const [style, s] of Object.entries(stats)) {
  console.log(`${style.padEnd(13)} total ${s.total}  exact ${(100 * s.exact / s.total).toFixed(2)}%  ambiguous(incl.) ${(100 * s.ambiguousIncl / s.total).toFixed(2)}%  wrong ${(100 * s.wrong / s.total).toFixed(2)}%`);
}
for (const [style, list] of Object.entries(failures)) {
  console.log(`\n--- ${style}: first failures`);
  for (const f of list.slice(0, 12)) console.log('  ' + f);
}
