// Unit lookup helpers: search, list provinces / wards, origins of a new ward.

import { loadData } from './data.mjs';
import { words, key, signature, editDistance, hasDiacritics } from './normalize.mjs';
import { describeUnit } from './parse.mjs';

const PREFIX_WORDS = [
  ['thanh', 'pho'], ['thi', 'xa'], ['thi', 'tran'], ['dac', 'khu'], ['thu', 'do'],
  ['tinh'], ['tp'], ['quan'], ['huyen'], ['tx'], ['phuong'], ['xa'], ['tt'], ['p'], ['q'], ['h'], ['x'], ['f'],
];

function stripPrefix(ws) {
  for (const seq of PREFIX_WORDS) {
    if (ws.length > seq.length && seq.every((w, i) => ws[i] === w)) return ws.slice(seq.length);
  }
  return ws;
}

function provinceFilter(db, name) {
  if (!name) return null;
  const k = key(stripPrefix(words(name)).join(' '));
  const units = [...(db.provinceIndex.get(k) || []), ...(db.provinceAlias.get(k) || [])];
  if (!units.length) return { oldCodes: new Set(), newCodes: new Set() };
  const newCodes = new Set();
  const oldCodes = new Set();
  for (const u of units) {
    if (u.era === 'new') newCodes.add(u.code);
    else {
      oldCodes.add(u.code);
      if (u.key === u.newProvince.key) newCodes.add(u.newProvince.code);
    }
  }
  // Old provinces merged into a matched new province are part of it too.
  for (const p of db.oldProvinces.values()) if (newCodes.has(p.newProvince.code)) oldCodes.add(p.code);
  return { oldCodes, newCodes };
}

function newProvinceOfUnit(u) {
  if (u.era === 'new') return u.level === 'province' ? u : u.province;
  return u.level === 'province' ? u.newProvince : u.province.newProvince;
}

export function unitInfo(u) {
  const out = {
    era: u.era,
    level: u.level,
    code: u.code,
    name: u.name,
    type: u.type,
    fullName: u.fullName,
    path: describeUnit(u),
  };
  if (u.era === 'new' && u.level === 'ward') {
    out.province = { code: u.province.code, fullName: u.province.fullName };
    if (u.postalCode) out.postalCode = u.postalCode;
  }
  if (u.era === 'old') {
    if (u.level !== 'province') out.province = { code: u.province.code, fullName: u.province.fullName };
    if (u.level === 'ward') {
      out.district = { code: u.district.code, fullName: u.district.fullName };
      out.newWards = u.targets.map((w) => `${w.fullName}, ${w.province.fullName}`);
      if (u.split) out.split = true;
    }
    if (u.level === 'district' && u.target) out.newWards = [`${u.target.fullName}, ${u.target.province.fullName}`];
    if (u.level === 'province') out.newProvince = u.newProvince.fullName;
  }
  return out;
}

/**
 * Search administrative units by name (diacritics optional, prefixes optional).
 * @param {string} query
 * @param {{ level?: 'province'|'district'|'ward'|'any', era?: 'new'|'old'|'all', province?: string, limit?: number }} [opts]
 */
export function search(query, opts = {}) {
  const db = loadData();
  const { level = 'any', era = 'all', province, limit = 10 } = opts;
  const qWords = stripPrefix(words(query));
  const q = qWords.join('');
  if (!q) return [];
  const qSig = signature(String(query));
  const qHasMarks = hasDiacritics(query);
  const filter = provinceFilter(db, province);
  const pools = [];
  const want = (e, l) => (era === 'all' || era === e) && (level === 'any' || level === l);
  if (want('new', 'province')) pools.push(db.newProvinces.values());
  if (want('new', 'ward')) pools.push(db.newWards.values());
  if (want('old', 'province')) pools.push(db.oldProvinces.values());
  if (want('old', 'district')) pools.push(db.oldDistricts.values());
  if (want('old', 'ward')) pools.push(db.oldWards.values());

  const lim = q.length >= 10 ? 2 : q.length >= 5 ? 1 : 0;
  const scored = [];
  for (const pool of pools) {
    for (const u of pool) {
      if (filter) {
        const np = newProvinceOfUnit(u);
        const op = u.era === 'old' ? (u.level === 'province' ? u : u.province) : null;
        if (u.era === 'new' && !filter.newCodes.has(np.code)) continue;
        if (u.era === 'old' && !filter.oldCodes.has(op.code)) continue;
      }
      let s = 0;
      if (u.key === q) s = 100;
      else if (u.key.startsWith(q)) s = 80 - Math.min(20, u.key.length - q.length);
      else if (qWords.length > 1 && qWords.every((w) => words(u.name).includes(w))) s = 65;
      else if (q.length >= 3 && u.key.includes(q)) s = 50;
      else if (lim) {
        const d = editDistance(q, u.key, lim);
        if (d <= lim) s = 40 - 10 * d;
      }
      if (!s) continue;
      if (s >= 80 && qHasMarks && (qSig === u.sig || qSig.endsWith(' ' + u.sig))) s += 5;
      if (u.era === 'new') s += 1; // prefer current units on ties
      scored.push({ u, s });
    }
  }
  scored.sort((a, b) => b.s - a.s || a.u.fullName.localeCompare(b.u.fullName, 'vi'));
  return scored.slice(0, limit).map(({ u, s }) => ({ ...unitInfo(u), score: s }));
}

/** List provinces. era 'new' (34, default) or 'old' (63). */
export function listProvinces({ era = 'new' } = {}) {
  const db = loadData();
  if (era === 'old') {
    return [...db.oldProvinces.values()].map((p) => ({
      code: p.code,
      name: p.name,
      type: p.type,
      fullName: p.fullName,
      districts: p.districts.length,
      wards: p.districts.reduce((a, d) => a + d.wards.length, 0),
      newProvince: p.newProvince.fullName,
    }));
  }
  return [...db.newProvinces.values()].map((p) => ({
    code: p.code,
    name: p.name,
    type: p.type,
    fullName: p.fullName,
    nameEn: p.nameEn,
    wards: p.wards.length,
    mergedFrom: [...db.oldProvinces.values()].filter((o) => o.newProvince === p).map((o) => o.fullName),
  }));
}

/** List the current (new) wards/communes of a province. */
export function listWards(province) {
  const db = loadData();
  const filter = provinceFilter(db, province);
  if (!filter || !filter.newCodes.size) return null;
  const out = [];
  for (const code of filter.newCodes) {
    const p = db.newProvinces.get(code);
    for (const w of p.wards) out.push(unitInfo(w));
  }
  return out;
}

/** Which old units formed a given new ward? */
export function wardOrigins(name, { province } = {}) {
  const db = loadData();
  const q = key(stripPrefix(words(name)).join(' '));
  const filter = provinceFilter(db, province);
  const out = [];
  for (const w of db.newWardIndex.get(q) || []) {
    if (filter && !filter.newCodes.has(w.province.code)) continue;
    out.push({
      ward: unitInfo(w),
      origins: w.origins.map((o) => ({
        code: o.code,
        fullName: describeUnit(o),
        partial: Boolean(o.split),
      })),
    });
  }
  return out;
}

/** Dataset information (sources, versions, counts). */
export function dataInfo() {
  return loadData().meta;
}
