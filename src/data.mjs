// Loads the bundled dataset (data/diachimoi.json) once and builds lookup indexes.

import { readFileSync } from 'node:fs';
import { key, signature } from './normalize.mjs';

let DB = null;

function push(map, k, v) {
  const list = map.get(k);
  if (list) {
    if (!list.includes(v)) list.push(v);
  } else map.set(k, [v]);
}

// Hand-written province aliases (compact folded keys → old province code).
const PROVINCE_ALIASES = {
  hcm: '79', tphcm: '79', hcmc: '79', saigon: '79', sg: '79', tpsg: '79', hochiminhcity: '79',
  hn: '01', tphn: '01',
  brvt: '77', vungtau: '77',
  thuathienhue: '46', tthue: '46',
  daclac: '66', daklac: '66', daclak: '66',
  dacnong: '67',
};

export function loadData() {
  if (DB) return DB;
  const raw = JSON.parse(readFileSync(new URL('../data/diachimoi.json', import.meta.url), 'utf8'));
  const T = raw.types;

  const mk = (era, level, code, name, typeIdx, extra) => {
    const type = T[typeIdx];
    return {
      era,
      level,
      code,
      name,
      type,
      fullName: `${type} ${name}`,
      key: key(name),
      sig: signature(name),
      ...extra,
    };
  };

  // ---------------- new (current) units
  const newProvinces = new Map();
  for (const [code, name, t, nameEn] of raw.np) {
    newProvinces.set(code, mk('new', 'province', code, name, t, { nameEn, wards: [] }));
  }
  const newWards = new Map();
  for (const [code, pc, name, t, postalCode] of raw.nw) {
    const province = newProvinces.get(pc);
    const w = mk('new', 'ward', code, name, t, { postalCode, province, origins: [] });
    newWards.set(code, w);
    province.wards.push(w);
  }

  // ---------------- old (before 2025-07-01) units
  const oldProvinces = new Map();
  for (const [code, name, t, npc] of raw.op) {
    oldProvinces.set(code, mk('old', 'province', code, name, t, { newProvince: newProvinces.get(npc), districts: [] }));
  }
  const oldDistricts = new Map();
  for (const [code, pc, name, t, target] of raw.od) {
    const province = oldProvinces.get(pc);
    const d = mk('old', 'district', code, name, t, { province, wards: [], target: target ? newWards.get(target) : null });
    oldDistricts.set(code, d);
    province.districts.push(d);
    if (d.target) d.target.origins.push(d);
  }
  const oldWards = new Map();
  for (const [code, dc, name, t, target] of raw.ow) {
    const district = oldDistricts.get(dc);
    const targets = (Array.isArray(target) ? target : [target]).map((c) => newWards.get(c));
    const w = mk('old', 'ward', code, name, t, { district, province: district.province, targets, split: targets.length > 1 });
    oldWards.set(code, w);
    district.wards.push(w);
    for (const nwd of targets) nwd.origins.push(w);
  }

  // ---------------- indexes (folded compact key → units)
  const provinceIndex = new Map(); // key → [province units of both eras]
  for (const p of [...oldProvinces.values(), ...newProvinces.values()]) push(provinceIndex, p.key, p);
  const provinceAlias = new Map();
  for (const [k, code] of Object.entries(PROVINCE_ALIASES)) push(provinceAlias, k, oldProvinces.get(code));

  const districtIndex = new Map(); // key → [old districts]
  const districtByProvince = new Map(); // old province code → Map(key → [districts])
  for (const d of oldDistricts.values()) {
    push(districtIndex, d.key, d);
    if (!districtByProvince.has(d.province.code)) districtByProvince.set(d.province.code, new Map());
    push(districtByProvince.get(d.province.code), d.key, d);
  }
  const districtAlias = new Map(); // old province code → Map(aliasKey → [districts])
  for (const [pc, alias, codes] of raw.da) {
    if (!districtAlias.has(pc)) districtAlias.set(pc, new Map());
    for (const c of codes) push(districtAlias.get(pc), alias, oldDistricts.get(c));
  }

  const oldWardIndex = new Map();
  const oldWardByProvince = new Map();
  const oldWardByDistrict = new Map();
  for (const w of oldWards.values()) {
    push(oldWardIndex, w.key, w);
    if (!oldWardByProvince.has(w.province.code)) oldWardByProvince.set(w.province.code, new Map());
    push(oldWardByProvince.get(w.province.code), w.key, w);
    if (!oldWardByDistrict.has(w.district.code)) oldWardByDistrict.set(w.district.code, new Map());
    push(oldWardByDistrict.get(w.district.code), w.key, w);
  }
  const wardAliasByDistrict = new Map();
  const wardAliasByProvince = new Map();
  for (const [dc, alias, codes] of raw.wa) {
    const pc = oldDistricts.get(dc).province.code;
    if (!wardAliasByDistrict.has(dc)) wardAliasByDistrict.set(dc, new Map());
    if (!wardAliasByProvince.has(pc)) wardAliasByProvince.set(pc, new Map());
    for (const c of codes) {
      push(wardAliasByDistrict.get(dc), alias, oldWards.get(c));
      push(wardAliasByProvince.get(pc), alias, oldWards.get(c));
    }
  }

  const newWardIndex = new Map();
  const newWardByProvince = new Map();
  for (const w of newWards.values()) {
    push(newWardIndex, w.key, w);
    if (!newWardByProvince.has(w.province.code)) newWardByProvince.set(w.province.code, new Map());
    push(newWardByProvince.get(w.province.code), w.key, w);
  }

  DB = {
    meta: raw.meta,
    types: T,
    newProvinces,
    newWards,
    oldProvinces,
    oldDistricts,
    oldWards,
    provinceIndex,
    provinceAlias,
    districtIndex,
    districtByProvince,
    districtAlias,
    oldWardIndex,
    oldWardByProvince,
    oldWardByDistrict,
    wardAliasByDistrict,
    wardAliasByProvince,
    newWardIndex,
    newWardByProvince,
  };
  return DB;
}
