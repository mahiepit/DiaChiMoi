// Free-text Vietnamese address parser.
//
// Strategy: tokenise (keeping comma segments and character offsets), then match
// administrative units from the right end of the address: province → district
// (old addresses only) → ward. Every level is optional and every plausible match
// becomes a hypothesis; hypotheses are scored and exact ties are reported as
// ambiguity instead of being silently resolved.

import { loadData } from './data.mjs';
import { fold, normNumber, hasDiacritics, signature, editDistance } from './normalize.mjs';

// ------------------------------------------------------------------ prefixes

const P = (s) => s.split(' ');
const PREFIX = {
  province: [P('thanh pho'), P('tp'), P('t p'), P('tinh'), P('t'), P('thu do')],
  district: [P('quan'), P('q'), P('huyen'), P('h'), P('thi xa'), P('tx'), P('t x'), P('thanh pho'), P('tp'), P('t p'), P('district'), P('dist')],
  ward: [P('phuong'), P('p'), P('f'), P('xa'), P('x'), P('thi tran'), P('tt'), P('t t'), P('dac khu'), P('ward'), P('commune')],
};
const SUFFIX = {
  province: [P('province'), P('city')],
  district: [P('district')],
  ward: [P('ward'), P('commune')],
};
const PREFIX_TYPE = {
  'thanh pho': 'Thành phố', tp: 'Thành phố', 't p': 'Thành phố', tinh: 'Tỉnh', t: 'Tỉnh', 'thu do': 'Thành phố',
  quan: 'Quận', q: 'Quận', huyen: 'Huyện', h: 'Huyện', 'thi xa': 'Thị xã', tx: 'Thị xã', 't x': 'Thị xã',
  phuong: 'Phường', p: 'Phường', f: 'Phường', ward: 'Phường', xa: 'Xã', x: 'Xã', commune: 'Xã',
  'thi tran': 'Thị trấn', tt: 'Thị trấn', 't t': 'Thị trấn', 'dac khu': 'Đặc khu',
};
const ALL_PREFIXES = [...PREFIX.province, ...PREFIX.district, ...PREFIX.ward]
  .filter((p, i, a) => a.findIndex((x) => x.join(' ') === p.join(' ')) === i)
  .sort((a, b) => b.length - a.length);
// Letter+digit words that should be split: "Q1" → q 1, "P.5" is already split by the dot.
const SPLITTABLE = new Set(['p', 'f', 'q', 'h', 'x', 'tt', 'tx', 'phuong', 'quan', 'ward', 'district']);
// Words that introduce street-level parts; a name right after them is a street, not a unit.
const STREET_WORDS = new Set(['so', 'duong', 'pho', 'ngo', 'hem', 'kiet', 'ngach', 'to', 'ap', 'thon', 'xom', 'khu', 'kp', 'toa', 'nha', 'lo', 'can', 'tang', 'street', 'st', 'road', 'lane', 'alley']);

// Hypothesis scoring weights. A trailing province name beats a bare commune of the
// same name ("…, Bình Dương"), and a ward found inside a named district beats the
// same ward found through a province alias ("Phường 7, TP Vũng Tàu").
const LEVEL_WEIGHT = { province: 2, district: 2, ward: 3 };
const IN_DISTRICT_BONUS = 0.5;
const UNPREFIXED_WARD_WEIGHT = 1.9; // below a district, so "Đông Anh, Hà Nội" stays a district
const PROVINCE_SHADOW = 0.8;
const NEW_WARD_BONUS = 0.05;
/** Score gap within which a reading of the other format (old vs new) is reported as an alternative. */
export const ALT_FORMAT_GAP = 0.35;

// ------------------------------------------------------------------ tokenizer

export function tokenize(input) {
  const text = String(input ?? '').normalize('NFC');
  const clean = text.replace(/\([^)]*\)/g, (m) => ' '.repeat(m.length));
  const tokens = [];
  let seg = 0;
  let segs = 0;
  for (const m of clean.matchAll(/[\p{L}\p{N}]+|[,;|\n\r]+/gu)) {
    const word = m[0];
    if (/^[,;|\n\r]+$/.test(word)) {
      seg++;
      continue;
    }
    const f = fold(word);
    const start = m.index;
    const end = start + word.length;
    const split = f.match(/^([a-z]+)(\d+)$/);
    if (split && SPLITTABLE.has(split[1])) {
      const cut = start + split[1].length;
      tokens.push({ t: split[1], raw: text.slice(start, cut), start, end: cut, seg, diac: hasDiacritics(text.slice(start, cut)) });
      tokens.push({ t: normNumber(split[2]), raw: split[2], start: cut, end, seg, diac: false });
    } else {
      tokens.push({ t: normNumber(f), raw: word, start, end, seg, diac: hasDiacritics(word) });
    }
  }
  // Renumber segments so that only non-empty ones count.
  const segMap = new Map();
  for (const tok of tokens) {
    if (!segMap.has(tok.seg)) segMap.set(tok.seg, segs++);
    tok.seg = segMap.get(tok.seg);
  }
  return { text, tokens, segments: segs };
}

// ------------------------------------------------------------------ helpers

function startsWithSeq(tokens, i, seq, limit) {
  if (i + seq.length > limit) return false;
  for (let k = 0; k < seq.length; k++) if (tokens[i + k].t !== seq[k]) return false;
  return true;
}

/** Does a prefix sequence (any level) end exactly at index `i` within the same segment? */
function prefixEndsAt(tokens, i) {
  if (i === 0) return false;
  const seg = tokens[i].seg;
  for (const seq of ALL_PREFIXES) {
    const s = i - seq.length;
    if (s < 0 || tokens[s].seg !== seg) continue;
    if (startsWithSeq(tokens, s, seq, i)) return true;
  }
  return false;
}

function findPrefix(ng, level) {
  for (const seq of [...PREFIX[level]].sort((a, b) => b.length - a.length)) {
    if (seq.length < ng.length && startsWithSeq(ng, 0, seq, ng.length)) return seq;
  }
  return null;
}

function findSuffix(ng, level) {
  for (const seq of SUFFIX[level]) {
    if (seq.length < ng.length && startsWithSeq(ng, ng.length - seq.length, seq, ng.length)) return seq;
  }
  return null;
}

function typeQ(prefixType, unit) {
  if (!prefixType || prefixType === unit.type) return 1;
  if (unit.level === 'province') return 0.95; // Tỉnh ↔ Thành phố changes are common and harmless
  return 0.85;
}

function diacQ(core, unit) {
  if (!core.some((t) => t.diac)) return 1;
  const seen = new Set();
  const raw = core
    .filter((t) => (seen.has(t.start) ? false : seen.add(t.start)))
    .map((t) => t.raw)
    .join(' ');
  return signature(raw) === unit.sig ? 1 : 0.85;
}

function isSegStart(tokens, i) {
  return i === 0 || tokens[i - 1].seg !== tokens[i].seg;
}

function fuzzyLimit(len) {
  if (len >= 10) return 2;
  if (len >= 5) return 1;
  return 0;
}

// ------------------------------------------------------------------ scopes

function makeScope(maps, aliasMaps = [], weights = []) {
  // maps: array of Map(key → units). weights: parallel array of q multipliers (default 1).
  return {
    lookup(k) {
      const out = [];
      maps.forEach((m, i) => {
        for (const u of m?.get(k) || []) out.push({ unit: u, w: weights[i] ?? 1 });
      });
      return out;
    },
    alias(k) {
      const out = [];
      for (const m of aliasMaps) for (const u of m?.get(k) || []) out.push({ unit: u, w: 1 });
      return out;
    },
    *entries() {
      for (let i = 0; i < maps.length; i++) {
        if (!maps[i]) continue;
        for (const [k, units] of maps[i]) for (const u of units) yield { k, unit: u, w: weights[i] ?? 1 };
      }
    },
  };
}

// ------------------------------------------------------------------ level matcher

/**
 * Find every unit of `level` whose name ends exactly at token index `end`.
 * Returns [{ unit, start, q, prefixed, how }] — best q per (unit,start).
 */
function matchLevel(ctx, level, end, scope, { fuzzy = true } = {}) {
  const { tokens, singleSegment } = ctx;
  if (end <= 0) return [];
  const found = new Map();
  const add = (unit, start, q, prefixed, how) => {
    const k = unit.era + unit.level + unit.code + ':' + start;
    const prev = found.get(k);
    if (!prev || prev.q < q) found.set(k, { unit, start, q, prefixed, how });
  };
  const fuzzyCands = [];
  const seg = tokens[end - 1].seg;
  for (let len = 1; len <= 9; len++) {
    const start = end - len;
    if (start < 0 || tokens[start].seg !== seg) break;
    const ng = tokens.slice(start, end);
    const pre = findPrefix(ng, level);
    const suf = pre ? null : findSuffix(ng, level);
    // Try the prefixed reading first, then the whole n-gram as a bare name
    // ("Phương Mai" is a name, not "Phường Mai").
    const variants = pre || suf ? [{ pre, suf }, { pre: null, suf: null }] : [{ pre: null, suf: null }];
    for (const v of variants) {
      const core = ng.slice(v.pre ? v.pre.length : 0, ng.length - (v.suf ? v.suf.length : 0));
      const prefixed = Boolean(v.pre || v.suf);
      const prefixType = v.pre ? PREFIX_TYPE[v.pre.join(' ')] ?? null : null;
      let posQ = 1;
      if (!prefixed) {
        if (prefixEndsAt(tokens, start)) continue;
        if (core.length === 1 && /^\d+$/.test(core[0].t)) continue;
        if (!isSegStart(tokens, start)) {
          const prev = tokens[start - 1];
          const houseNumber = /^\d/.test(prev.t) && !prefixEndsAt(tokens, start - 1);
          if (houseNumber || STREET_WORDS.has(prev.t)) continue;
          const followed = end < tokens.length && tokens[end].seg === seg;
          if (!(singleSegment || followed || level === 'province')) continue;
          posQ = 0.9;
        }
      } else if (core.length === 1 && /^\d+$/.test(core[0].t) && level === 'province') {
        continue;
      }
      const coreKey = core.map((t) => t.t).join('');
      const fullKey = ng.map((t) => t.t).join('');
      let hit = false;
      for (const { unit, w } of scope.lookup(coreKey)) {
        add(unit, start, posQ * w * typeQ(prefixType, unit) * diacQ(core, unit), prefixed, 'exact');
        hit = true;
      }
      for (const k of new Set([fullKey, coreKey])) {
        for (const { unit, w } of scope.alias(k)) {
          add(unit, start, (unit.level === 'province' ? 1 : 0.9) * posQ * w, prefixed, 'alias');
          hit = true;
        }
      }
      if (!hit && fuzzy && !/^\d+$/.test(coreKey)) {
        // Never fuzz house numbers or street words into a unit name ("12 Nguyễn Thái Bình").
        const looksLikeStreet = !prefixed && (/^\d/.test(core[0].t) || STREET_WORDS.has(core[0].t));
        if ((prefixed || isSegStart(tokens, start)) && !looksLikeStreet) fuzzyCands.push({ start, coreKey, prefixType, posQ });
      }
    }
  }
  if (found.size === 0 && fuzzyCands.length) {
    let bestDist = Infinity;
    const hits = [];
    for (const c of fuzzyCands) {
      const lim = fuzzyLimit(c.coreKey.length);
      if (!lim) continue;
      for (const { k, unit, w } of scope.entries()) {
        if (Math.abs(k.length - c.coreKey.length) > lim) continue;
        const d = editDistance(c.coreKey, k, lim);
        if (d <= lim && d > 0) {
          hits.push({ unit, start: c.start, d, q: (d === 1 ? 0.7 : 0.6) * w * c.posQ * typeQ(c.prefixType, unit) });
          if (d < bestDist) bestDist = d;
        }
      }
    }
    for (const h of hits) if (h.d === bestDist) add(h.unit, h.start, h.q, true, 'fuzzy');
  }
  return [...found.values()];
}

// ------------------------------------------------------------------ main parser

function stripTrailingNoise(tokens) {
  let end = tokens.length;
  for (;;) {
    if (end >= 2 && tokens[end - 2].t === 'viet' && tokens[end - 1].t === 'nam') end -= 2;
    else if (end >= 1 && ['vietnam', 'vn'].includes(tokens[end - 1].t)) end -= 1;
    else if (end >= 1 && /^\d{5,6}$/.test(tokens[end - 1].raw)) end -= 1;
    else break;
  }
  return end;
}

function provinceScope(db) {
  return makeScope([db.provinceIndex], [db.provinceAlias]);
}

/** Group province matches by start into "mentions" carrying old/new interpretations. */
function provinceMentions(matches) {
  const byStart = new Map();
  for (const m of matches) {
    if (!byStart.has(m.start)) byStart.set(m.start, []);
    byStart.get(m.start).push(m);
  }
  const mentions = [];
  for (const [start, list] of byStart) {
    const olds = list.filter((m) => m.unit.era === 'old');
    const news = list.filter((m) => m.unit.era === 'new');
    // A single mention can only point at one region; different regions (rare) become separate mentions.
    const groups = new Map();
    for (const m of olds) {
      const np = m.unit.newProvince;
      if (!groups.has(np.code)) groups.set(np.code, { start, old: null, newp: np, newNameMatched: false, q: 0, how: m.how });
      const g = groups.get(np.code);
      if (!g.old || m.q > g.q) g.old = m.unit;
      g.q = Math.max(g.q, m.q);
      if (m.how === 'exact') g.how = 'exact';
    }
    for (const m of news) {
      if (!groups.has(m.unit.code)) groups.set(m.unit.code, { start, old: null, newp: m.unit, newNameMatched: true, q: 0, how: m.how });
      const g = groups.get(m.unit.code);
      g.newNameMatched = true;
      g.q = Math.max(g.q, m.q);
      if (m.how === 'exact') g.how = 'exact';
    }
    for (const g of groups.values()) {
      // An alias of a province that kept its name (e.g. "HCM") also names the new province.
      if (g.old && g.old.key === g.newp.key) g.newNameMatched = true;
    }
    mentions.push(...groups.values());
  }
  return mentions;
}

function oldProvincesOf(db, mention) {
  // Primary: the old province literally named; secondary: all old provinces merged into the new one.
  const list = [];
  if (mention.old) list.push({ p: mention.old, w: 1 });
  if (mention.newNameMatched) {
    for (const p of db.oldProvinces.values()) {
      if (p.newProvince === mention.newp && p !== mention.old) list.push({ p, w: 0.9 });
    }
  }
  return list;
}

function districtScope(db, mention) {
  if (!mention) {
    return makeScope([db.districtIndex], [...db.districtAlias.values()]);
  }
  const olds = oldProvincesOf(db, mention);
  return makeScope(
    olds.map(({ p }) => db.districtByProvince.get(p.code)),
    olds.map(({ p }) => db.districtAlias.get(p.code)),
    olds.map(({ w }) => w),
  );
}

function wardScope(db, mention, district) {
  if (district) {
    return makeScope([db.oldWardByDistrict.get(district.code)], [db.wardAliasByDistrict.get(district.code)]);
  }
  if (!mention) {
    return makeScope([db.oldWardIndex, db.newWardIndex], [...db.wardAliasByProvince.values()]);
  }
  const olds = oldProvincesOf(db, mention);
  const maps = olds.map(({ p }) => db.oldWardByProvince.get(p.code));
  const weights = olds.map(({ w }) => w);
  if (mention.newNameMatched) {
    maps.push(db.newWardByProvince.get(mention.newp.code));
    weights.push(1);
  }
  return makeScope(maps, olds.map(({ p }) => db.wardAliasByProvince.get(p.code)), weights);
}

const MAX_OPTIONS = 60;

/**
 * Parse into scored hypotheses (internal). Returns { text, tokens, hyps } sorted best-first.
 */
export function analyze(input) {
  const db = loadData();
  const { text, tokens, segments } = tokenize(input);
  const ctx = { tokens, singleSegment: segments <= 1 };
  const hyps = [];
  if (!tokens.length) return { text, tokens, hyps };

  const endP = stripTrailingNoise(tokens);
  const provOpts = provinceMentions(matchLevel(ctx, 'province', endP, provinceScope(db)));
  const provFound = provOpts.length > 0;
  // The address ends with an official province name: readings that ignore it and
  // treat that text as a district/commune of the same name are penalised.
  const exactProv = provOpts.some((m) => m.how === 'exact');
  provOpts.push(null);

  for (const prov of provOpts) {
    const p1 = prov ? prov.start : endP;
    // Fuzzy matching over the whole country is costly and rarely right when a province was found.
    const fuzzy = Boolean(prov) || !provFound;
    const dScope = districtScope(db, prov);
    const distMatches = matchLevel(ctx, 'district', p1, dScope, { fuzzy }).slice(0, MAX_OPTIONS);
    const distOpts = distMatches.map((m) => ({ ...m }));
    // An unrecognised but clearly marked district ("Quận XYZ") is skipped with a warning.
    if (!distOpts.length && p1 > 0) {
      const seg = tokens[p1 - 1].seg;
      let s = p1 - 1;
      while (s > 0 && tokens[s - 1].seg === seg) s--;
      const ng = tokens.slice(s, p1);
      if (findPrefix(ng, 'district') && !findPrefix(ng, 'ward') && s > 0) {
        distOpts.push({ skip: true, start: s, text: text.slice(tokens[s].start, tokens[p1 - 1].end) });
      }
    }
    distOpts.push(null);

    for (const dist of distOpts) {
      const district = dist && !dist.skip ? dist.unit : null;
      const p2 = dist ? dist.start : p1;
      const wScope = wardScope(db, prov, district);
      const wardOpts = matchLevel(ctx, 'ward', p2, wScope, { fuzzy });
      wardOpts.sort((a, b) => b.q - a.q);
      const limited = wardOpts.slice(0, MAX_OPTIONS);
      limited.push(null);
      for (const ward of limited) {
        let score = 0;
        const qs = [];
        const shadow = !prov && exactProv ? PROVINCE_SHADOW : 1;
        if (prov) { score += LEVEL_WEIGHT.province * prov.q; qs.push(prov.q); }
        if (district) {
          const q = dist.q * shadow;
          score += LEVEL_WEIGHT.district * q;
          qs.push(q);
        }
        if (ward) {
          const w = district ? LEVEL_WEIGHT.ward + IN_DISTRICT_BONUS : ward.prefixed ? LEVEL_WEIGHT.ward : UNPREFIXED_WARD_WEIGHT;
          const q = ward.q * (district ? 1 : shadow);
          score += w * q;
          qs.push(q);
          // No district written: slightly prefer reading the commune as a current (new) unit.
          if (ward.unit.era === 'new') score += NEW_WARD_BONUS;
        }
        if (!score) continue;
        hyps.push({
          prov,
          district,
          ward: ward ? ward.unit : null,
          wardMatch: ward,
          distMatch: district ? dist : null,
          skippedDistrict: dist && dist.skip ? dist.text : null,
          streetEnd: ward ? ward.start : dist ? dist.start : p1,
          score,
          q: qs.reduce((a, b) => a * b, 1),
          truncated: wardOpts.length > MAX_OPTIONS,
        });
      }
    }
  }

  hyps.sort((a, b) => b.score - a.score || b.q - a.q);
  return { text, tokens, hyps };
}

// ------------------------------------------------------------------ public helpers

export function summarize(u) {
  if (!u) return null;
  const s = { code: u.code, name: u.name, type: u.type, fullName: u.fullName };
  if (u.era === 'new' && u.level === 'ward') s.postalCode = u.postalCode || undefined;
  return s;
}

/** Resolved interpretation of one hypothesis. */
export function interpret(h) {
  const ward = h.ward;
  let format = 'unknown';
  let province = null;
  let district = h.district;
  if (ward && ward.era === 'new') {
    format = 'new';
    province = ward.province;
  } else if (ward) {
    format = 'old';
    district = ward.district;
    province = ward.province;
  } else if (district) {
    format = 'old';
    province = district.province;
  } else if (h.prov) {
    province = h.prov.old || h.prov.newp;
    format = h.prov.old ? (h.prov.newNameMatched ? 'unknown' : 'old') : 'new';
  }
  let confidence = h.q;
  if (format === 'old' && ward) {
    if (!h.district) confidence *= 0.95;
    if (!h.prov) confidence *= 0.95;
  } else if (format === 'new' && ward && !h.prov) {
    confidence *= 0.9;
  }
  return { format, province, district, ward, confidence };
}

export function hypothesisKey(h) {
  const i = interpret(h);
  return [i.format, i.province?.era, i.province?.code, i.district?.code, i.ward?.era, i.ward?.code].join('|');
}

/** Hypotheses tied for the best score, de-duplicated by interpretation. */
export function topHypotheses(hyps) {
  if (!hyps.length) return [];
  const best = hyps[0].score;
  const seen = new Set();
  const out = [];
  for (const h of hyps) {
    if (h.score < best - 1e-9) break;
    const k = hypothesisKey(h);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  return out;
}

export function extractStreet(text, tokens, h) {
  if (!h || h.streetEnd <= 0) return '';
  const cut = tokens[h.streetEnd].start;
  return text
    .slice(0, cut)
    .replace(/\([^)]*\)\s*$/, '')
    .replace(/[\s,;|\-–—.:]+$/u, '')
    .replace(/^[\s,;|\-–—.:]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function full(u) {
  if (!u) return null;
  if (u.era === 'old' && u.level === 'ward') return `${u.fullName}, ${u.district.fullName}, ${u.province.fullName}`;
  if (u.era === 'old' && u.level === 'district') return `${u.fullName}, ${u.province.fullName}`;
  if (u.era === 'new' && u.level === 'ward') return `${u.fullName}, ${u.province.fullName}`;
  return u.fullName;
}
export { full as describeUnit };

/**
 * Parse a free-text Vietnamese address (old or new format).
 * @param {string} address
 */
export function parse(address) {
  const { text, tokens, hyps } = analyze(address);
  const top = topHypotheses(hyps);
  const result = {
    input: String(address ?? ''),
    format: 'unknown',
    street: '',
    province: null,
    district: null,
    ward: null,
    confidence: 0,
    ambiguous: false,
    candidates: [],
    warnings: [],
  };
  if (!top.length) {
    result.street = text.trim();
    result.warnings.push({ code: 'NOT_FOUND', message: 'Không nhận ra đơn vị hành chính nào trong địa chỉ.' });
    return result;
  }
  const best = top[0];
  const bi = interpret(best);
  result.format = bi.format;
  result.street = extractStreet(text, tokens, best);
  result.province = summarize(bi.province);
  result.district = summarize(bi.district);
  result.ward = summarize(bi.ward);
  result.confidence = round(bi.confidence / (top.length > 1 ? top.length : 1));
  if (top.length > 1) {
    result.ambiguous = true;
    result.candidates = top.slice(0, 20).map((h) => {
      const i = interpret(h);
      return {
        format: i.format,
        province: summarize(i.province),
        district: summarize(i.district),
        ward: summarize(i.ward),
        description: full(i.ward || i.district || i.province),
        confidence: round(i.confidence / top.length),
      };
    });
    result.warnings.push({
      code: 'AMBIGUOUS_INPUT',
      message: `Địa chỉ khớp với ${top.length}${best.truncated ? '+' : ''} đơn vị khác nhau; hãy thêm quận/huyện hoặc tỉnh/thành để xác định.`,
    });
  }
  addMatchWarnings(result.warnings, best);
  return result;
}

export function addMatchWarnings(warnings, h) {
  if (h.skippedDistrict) {
    warnings.push({ code: 'UNKNOWN_DISTRICT', message: `Không nhận ra quận/huyện "${h.skippedDistrict}", đã bỏ qua.` });
  }
  for (const m of [h.wardMatch, h.distMatch]) {
    if (!m) continue;
    if (m.how === 'fuzzy') {
      warnings.push({ code: 'FUZZY_MATCH', message: `Khớp gần đúng (có thể sai chính tả) với ${m.unit.fullName}.` });
    } else if (m.how === 'alias') {
      warnings.push({ code: 'HISTORICAL_NAME', message: `Tên đơn vị cũ (trước 2025) được hiểu là ${m.unit.fullName}.` });
    }
  }
}

export function round(x) {
  return Math.round(x * 100) / 100;
}
