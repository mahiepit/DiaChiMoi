// Text normalisation helpers for Vietnamese administrative names.
// Everything here is pure and dependency-free.

const COMBINING = /[̀-ͯ]/g;

/** Lower-case, remove all diacritics (including đ → d). Keeps spaces/punctuation. */
export function stripDiacritics(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(COMBINING, '')
    .replace(/[đĐðÐ]/g, 'd')
    .normalize('NFC');
}

/** Lower-case + strip diacritics. */
export function fold(text) {
  return stripDiacritics(text).toLowerCase();
}

/** Normalise a single folded word: drop leading zeros of pure numbers ("05" → "5"). */
export function normNumber(word) {
  return /^\d+$/.test(word) ? String(parseInt(word, 10)) : word;
}

/** Split a name into folded alphanumeric words. "Bà Rịa - Vũng Tàu" → ["ba","ria","vung","tau"]. */
export function words(text) {
  const out = [];
  for (const m of fold(text).matchAll(/[a-z0-9]+/g)) out.push(normNumber(m[0]));
  return out;
}

/** Compact matching key: folded words joined without spaces. "Phường 05" → "phuong5". */
export function key(text) {
  return words(text).join('');
}

/**
 * Diacritic "signature" of a name: for each syllable, its base letters plus the
 * sorted set of marks. Independent of old/new tone placement ("hoà" == "hòa"),
 * but distinguishes "Tân" from "Tần". Used only to break ties between units whose
 * folded keys collide.
 */
export function signature(text) {
  return String(text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((syl) => {
      const d = syl.normalize('NFD');
      const marks = [...d.matchAll(COMBINING)].map((m) => m[0]);
      if (/[đð]/.test(syl)) marks.push('đ');
      return d.replace(COMBINING, '').replace(/[đð]/g, 'd') + marks.sort().join('');
    })
    .join(' ');
}

/** True if the text contains any Vietnamese diacritic. */
export function hasDiacritics(text) {
  const s = String(text ?? '');
  return s.normalize('NFD') !== s.normalize('NFD').replace(COMBINING, '') || /[đĐ]/.test(s);
}

/** Damerau–Levenshtein (optimal string alignment) distance with an early-exit bound. */
export function editDistance(a, b, max = Infinity) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[lb];
}
