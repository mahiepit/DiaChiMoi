// Old (63 provinces, 3 levels) → new (34 provinces, 2 levels) address conversion.

import {
  analyze,
  topHypotheses,
  hypothesisKey,
  interpret,
  extractStreet,
  summarize,
  describeUnit,
  addMatchWarnings,
  round,
  ALT_FORMAT_GAP,
} from './parse.mjs';

const SPLIT_DEFAULT_SHARE = 0.6;

function joinAddress(...parts) {
  return parts.filter((p) => p && String(p).trim()).join(', ');
}

function inputToText(input) {
  if (input && typeof input === 'object') {
    const { street, ward, district, province } = input;
    return joinAddress(street, ward, district, province);
  }
  return String(input ?? '');
}

/** Possible new outcomes for one hypothesis: [{ ward, share, from, note }] */
function outcomes(h) {
  const i = interpret(h);
  if (i.ward && i.ward.era === 'new') {
    return { i, list: [{ ward: i.ward, share: 1, from: i.ward, note: 'already_new' }] };
  }
  if (i.ward) {
    const t = i.ward.targets;
    if (t.length === 1) return { i, list: [{ ward: t[0], share: 1, from: i.ward, note: 'merged' }] };
    const rest = (1 - SPLIT_DEFAULT_SHARE) / (t.length - 1);
    return {
      i,
      list: t.map((w, idx) => ({ ward: w, share: idx === 0 ? SPLIT_DEFAULT_SHARE : rest, from: i.ward, note: idx === 0 ? 'split_suggested' : 'split' })),
    };
  }
  if (i.district && i.district.target) {
    return { i, list: [{ ward: i.district.target, share: 1, from: i.district, note: 'special_zone' }] };
  }
  return { i, list: [] };
}

function newProvinceOf(i) {
  if (i.ward) return i.ward.era === 'new' ? i.ward.province : i.ward.province.newProvince;
  if (i.district) return i.district.province.newProvince;
  if (i.province) return i.province.era === 'new' ? i.province : i.province.newProvince;
  return null;
}

/**
 * Convert an old-format Vietnamese address to the new administrative units
 * (after 2025-07-01). Accepts free text or { street, ward, district, province }.
 */
export function convert(input) {
  const text = inputToText(input);
  const { text: norm, tokens, hyps } = analyze(text);
  const top = topHypotheses(hyps);
  const res = {
    input: typeof input === 'string' ? input : text,
    status: 'not_found',
    format: 'unknown',
    confidence: 0,
    address: null,
    street: '',
    ward: null,
    province: null,
    old: null,
    candidates: [],
    warnings: [],
  };
  if (!top.length) {
    res.street = norm.trim();
    res.warnings.push({ code: 'NOT_FOUND', message: 'Không nhận ra đơn vị hành chính nào trong địa chỉ.' });
    return res;
  }

  const best = top[0];
  const bi = interpret(best);
  const street = extractStreet(norm, tokens, best);
  res.street = street;
  res.format = bi.format;
  // With several equally good readings the old units are listed per candidate instead.
  if (top.length === 1 && (bi.format === 'old' || (bi.format === 'unknown' && bi.province?.era === 'old'))) {
    res.old = {
      ward: summarize(bi.ward),
      district: summarize(bi.district),
      province: summarize(bi.province?.era === 'old' ? bi.province : null),
    };
  }
  addMatchWarnings(res.warnings, best);

  // Readings of the other format (old ↔ new) that score almost as well are kept as alternatives.
  const seen = new Set(top.map(hypothesisKey));
  const alts = [];
  for (const h of best.ward ? hyps : []) {
    if (h.score < best.score - ALT_FORMAT_GAP) break;
    const k = hypothesisKey(h);
    if (seen.has(k)) continue;
    seen.add(k);
    const f = interpret(h).format;
    if (h.ward && f !== bi.format && (f === 'old' || f === 'new')) alts.push(h);
  }
  const pool = [...top.map((h) => ({ h, w: 1 })), ...alts.map((h) => ({ h, w: 0.5 }))];
  const totalW = pool.reduce((a, p) => a + p.w, 0);

  // Collect candidate new wards across all plausible interpretations.
  const merged = new Map();
  let anyOutcome = false;
  const splitSources = new Set();
  for (const { h, w } of pool) {
    const { i, list } = outcomes(h);
    const conf = (i.confidence * w) / totalW;
    for (const o of list) {
      anyOutcome = true;
      if (o.note.startsWith('split')) splitSources.add(o.from);
      const k = o.ward.code;
      const c = merged.get(k) || { ward: o.ward, confidence: 0, from: [], notes: new Set() };
      c.confidence += conf * o.share;
      if (!c.from.includes(o.from)) c.from.push(o.from);
      c.notes.add(o.note);
      merged.set(k, c);
    }
  }

  if (anyOutcome) {
    const cands = [...merged.values()].sort((a, b) => b.confidence - a.confidence);
    res.candidates = cands.slice(0, 20).map((c) => ({
      address: joinAddress(street, c.ward.fullName, c.ward.province.fullName),
      ward: summarize(c.ward),
      province: summarize(c.ward.province),
      confidence: round(c.confidence),
      from: c.from.map(describeUnit),
      note: [...c.notes].join(','),
    }));
    const top1 = cands[0];
    res.ward = summarize(top1.ward);
    res.province = summarize(top1.ward.province);
    res.address = joinAddress(street, top1.ward.fullName, top1.ward.province.fullName);
    if (cands.length === 1) {
      res.status = 'ok';
      const maxConf = Math.max(...pool.map(({ h }) => interpret(h).confidence));
      res.confidence = round(pool.length > 1 ? maxConf * 0.95 : maxConf);
      res.candidates[0].confidence = res.confidence;
      if (pool.length > 1) {
        res.warnings.push({
          code: 'SAME_RESULT',
          message: `Địa chỉ khớp ${pool.length} đơn vị cũ/mới nhưng tất cả đều thuộc ${top1.ward.fullName}.`,
        });
      }
      if (top1.notes.has('already_new') && top1.notes.size === 1) {
        res.warnings.push({ code: 'ALREADY_NEW', message: 'Địa chỉ đã theo đơn vị hành chính mới (sau 01/07/2025).' });
      }
    } else {
      res.status = 'ambiguous';
      res.confidence = round(top1.confidence);
      if (top1.confidence < 0.5) {
        // Too many equally plausible readings: do not put a guess in the main fields.
        const provs = new Set(cands.map((c) => c.ward.province));
        res.ward = null;
        res.address = null;
        res.province = provs.size === 1 ? summarize(top1.ward.province) : null;
      }
      for (const s of splitSources) {
        res.warnings.push({
          code: 'SPLIT_WARD',
          message: `${describeUnit(s)} được chia cho ${s.targets.length} đơn vị mới (${s.targets.map((w) => w.fullName).join(', ')}); cần số nhà/tên đường để xác định chính xác. Kết quả đầu tiên chỉ là gợi ý.`,
        });
      }
      if (pool.length > 1) {
        const mixed = new Set(pool.map(({ h }) => interpret(h).format)).size > 1;
        res.warnings.push({
          code: mixed ? 'OLD_OR_NEW' : 'AMBIGUOUS_INPUT',
          message: mixed
            ? 'Tên này vừa khớp đơn vị cũ vừa khớp đơn vị mới; hãy kiểm tra địa chỉ đang theo cách cũ hay mới.'
            : `Địa chỉ khớp ${top.length}${best.truncated ? '+' : ''} đơn vị trùng tên; thêm quận/huyện hoặc tỉnh/thành để xác định.`,
        });
      }
    }
    return res;
  }

  // Only province (and maybe district) known.
  const np = newProvinceOf(bi);
  const provinces = [...new Set(top.map((h) => newProvinceOf(interpret(h))).filter(Boolean))];
  if (np) {
    res.status = 'partial';
    res.province = summarize(np);
    res.confidence = round(bi.confidence / top.length);
    res.address = joinAddress(street, np.fullName);
    if (provinces.length > 1) {
      res.candidates = provinces.map((p) => ({
        address: joinAddress(street, p.fullName),
        ward: null,
        province: summarize(p),
        confidence: round(1 / provinces.length),
        from: [],
        note: 'province_only',
      }));
    }
    let possible = [];
    if (bi.district) possible = [...new Set(bi.district.wards.flatMap((w) => w.targets))];
    res.warnings.push({
      code: 'MISSING_WARD',
      message:
        'Không xác định được phường/xã nên chỉ chuyển được tỉnh/thành.' +
        (possible.length ? ` ${bi.district.fullName} cũ nay thuộc các phường/xã: ${possible.map((w) => w.fullName).join(', ')}.` : ''),
    });
    if (possible.length) res.possibleWards = possible.map(summarize);
  }
  return res;
}

/** Convert many addresses (array of strings or objects). */
export function convertMany(inputs) {
  return inputs.map((x) => convert(x));
}
