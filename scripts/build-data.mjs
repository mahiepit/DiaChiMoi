#!/usr/bin/env node
// Rebuilds data/diachimoi.json from the upstream open datasets.
//
// Usage:
//   git clone --depth 1 https://github.com/tranngocminhhieu/vietnamadminunits.git <dir>/vau
//   git clone --depth 1 https://github.com/thanglequoc/vietnamese-provinces-database.git <dir>/vpd
//   node scripts/build-data.mjs <dir>/vau <dir>/vpd
//
// Not shipped in the npm package; only needed by maintainers.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { key } from '../src/normalize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [vauDir, vpdDir] = process.argv.slice(2);
if (!vauDir || !vpdDir) {
  console.error('Usage: node scripts/build-data.mjs <vietnamadminunits dir> <vietnamese-provinces-database dir>');
  process.exit(1);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let f = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...rest] = rows;
  const h = head.map((k) => k.replace(/^﻿/, ''));
  return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}

const read = (p) => fs.readFileSync(p, 'utf8');
const nfc = (s) => String(s ?? '').normalize('NFC').trim();
const pad = (v, n) => String(parseInt(String(v), 10)).padStart(n, '0');
const gitHead = (dir) => {
  try { return execSync('git rev-parse HEAD', { cwd: dir }).toString().trim(); } catch { return null; }
};

// Unit types (index is stored in the data file).
const TYPES = ['Tỉnh', 'Thành phố', 'Quận', 'Huyện', 'Thị xã', 'Phường', 'Xã', 'Thị trấn', 'Đặc khu'];
const typeIdx = (t) => {
  const i = TYPES.indexOf(nfc(t));
  if (i < 0) throw new Error('Unknown unit type: ' + t);
  return i;
};
function splitName(full) {
  const s = nfc(full);
  for (const t of [...TYPES].sort((a, b) => b.length - a.length)) {
    if (s.toLowerCase().startsWith(t.toLowerCase() + ' ')) return { type: t, name: s.slice(t.length + 1).trim() };
  }
  throw new Error('Cannot split unit name: ' + full);
}

// ---------------------------------------------------------------- new (current) units
const vpdJson = JSON.parse(read(path.join(vpdDir, 'json', 'full_json_generated_data_vn_units.json')));
const vpdMeta = JSON.parse(read(path.join(vpdDir, 'json', 'vn_provinces_metadata.json')));
const np = [];
const nw = [];
const newWardByCode = new Map();
for (const p of vpdJson) {
  np.push([p.Code, nfc(p.Name), typeIdx(p.AdministrativeUnitShortName), nfc(p.NameEn)]);
  for (const w of p.Wards) {
    const row = [w.Code, p.Code, nfc(w.Name), typeIdx(w.AdministrativeUnitShortName), w.PostalCode || ''];
    nw.push(row);
    newWardByCode.set(w.Code, row);
  }
}

// ---------------------------------------------------------------- old units + mapping
const mapRows = parseCSV(read(path.join(vauDir, 'data', 'processed', 'convert_legacy_2025_with_location_and_default_ward.csv')));
const op = new Map(); // code -> row
const od = new Map();
const ow = new Map(); // code -> { row, targets: [{code, isDefault}] }
for (const r of mapRows) {
  const pc = pad(r.provinceCode, 2);
  const dc = pad(r.districtCode, 3);
  const newCode = pad(r.newWardCode, 5);
  if (!newWardByCode.has(newCode)) throw new Error('New ward code not found in current dataset: ' + newCode);
  const newProv = newWardByCode.get(newCode)[1];
  const prov = splitName(r.province);
  if (!op.has(pc)) op.set(pc, [pc, prov.name, typeIdx(prov.type), newProv]);
  else if (op.get(pc)[3] !== newProv) throw new Error('Old province split across new provinces: ' + r.province);
  const dist = splitName(r.district);
  if (!od.has(dc)) od.set(dc, [dc, pc, dist.name, typeIdx(dist.type)]);
  if (!r.wardCode) {
    // Island districts without communes → became a special zone (đặc khu).
    od.get(dc)[4] = newCode;
    continue;
  }
  const wc = pad(r.wardCode, 5);
  const ward = splitName(r.ward);
  if (!ow.has(wc)) ow.set(wc, { row: [wc, dc, ward.name, typeIdx(r.wardType || ward.type)], targets: [] });
  const entry = ow.get(wc);
  if (!entry.targets.some((t) => t.code === newCode)) {
    entry.targets.push({ code: newCode, isDefault: r.isDefaultNewWard === 'True' });
  }
}
const owRows = [...ow.values()].map(({ row, targets }) => {
  targets.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const codes = targets.map((t) => t.code);
  return [...row, codes.length === 1 ? codes[0] : codes];
});

// ---------------------------------------------------------------- historical aliases (pre-2025 renames)
const keyIndexWard = new Map();
for (const { row } of ow.values()) {
  const d = od.get(row[1]);
  const p = op.get(d[1]);
  keyIndexWard.set([key(TYPES[p[2]] + ' ' + p[1]), key(TYPES[d[3]] + ' ' + d[2]), key(TYPES[row[3]] + ' ' + row[2])].join('|'), row);
}
const keyIndexDist = new Map();
for (const d of od.values()) {
  const p = op.get(d[1]);
  keyIndexDist.set([key(TYPES[p[2]] + ' ' + p[1]), key(TYPES[d[3]] + ' ' + d[2])].join('|'), d);
}
const aliasDir = path.join(vauDir, 'data', 'alias_keywords', 'legacy');
const wa = new Map();
let waMiss = 0;
for (const r of parseCSV(read(path.join(aliasDir, 'alias_ward.csv')))) {
  const w = keyIndexWard.get([r.province_key, r.district_key, r.ward_key].join('|'));
  if (!w) { waMiss++; continue; }
  const alias = key(r.alias_keyword);
  const k = w[1] + '|' + alias;
  if (!wa.has(k)) wa.set(k, [w[1], alias, []]);
  if (!wa.get(k)[2].includes(w[0])) wa.get(k)[2].push(w[0]);
}
const da = new Map();
let daMiss = 0;
const addDistAlias = (pk, dk, alias) => {
  const d = keyIndexDist.get(pk + '|' + dk);
  if (!d) { daMiss++; return; }
  const a = key(alias);
  const k = d[1] + '|' + a;
  if (!da.has(k)) da.set(k, [d[1], a, []]);
  if (!da.get(k)[2].includes(d[0])) da.get(k)[2].push(d[0]);
};
for (const r of parseCSV(read(path.join(aliasDir, 'alias_district.csv')))) addDistAlias(r.province_key, r.district_key, r.alias_keyword);
for (const r of parseCSV(read(path.join(aliasDir, 'divided_district.csv')))) {
  for (const kw of JSON.parse(r.dividedDistrictKeyWords)) addDistAlias(r.provinceKey, r.districtKey, kw);
}

// ---------------------------------------------------------------- write
const data = {
  meta: {
    name: 'DiaChiMoi dataset',
    builtAt: new Date().toISOString().slice(0, 10),
    current: {
      description: '34 provinces / 3,321 commune-level units after the 2025 reform, including later changes',
      source: 'thanglequoc/vietnamese-provinces-database (MIT), from the General Statistics Office (danhmuchanhchinh.gso.gov.vn / nso.gov.vn)',
      url: 'https://github.com/thanglequoc/vietnamese-provinces-database',
      datasetVersion: vpdMeta.DatasetVersion,
      latestDecree: vpdMeta.LatestDecree,
      commit: gitHead(vpdDir),
    },
    mapping: {
      description: 'Old (63 provinces, before 2025-07-01) commune → new commune mapping',
      source: 'tranngocminhhieu/vietnamadminunits (MIT), from danhmuchanhchinh.gso.gov.vn and sapnhap.bando.com.vn',
      url: 'https://github.com/tranngocminhhieu/vietnamadminunits',
      commit: gitHead(vauDir),
    },
    counts: {
      newProvinces: np.length,
      newWards: nw.length,
      oldProvinces: op.size,
      oldDistricts: od.size,
      oldWards: owRows.length,
      splitOldWards: owRows.filter((r) => Array.isArray(r[4])).length,
      wardAliases: wa.size,
      districtAliases: da.size,
    },
  },
  types: TYPES,
  np,
  nw,
  op: [...op.values()],
  od: [...od.values()],
  ow: owRows,
  wa: [...wa.values()],
  da: [...da.values()],
};
const out = path.join(ROOT, 'data', 'diachimoi.json');
fs.writeFileSync(out, JSON.stringify(data));
console.log('Wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
console.log(data.meta.counts, { wardAliasMisses: waMiss, districtAliasMisses: daMiss });
