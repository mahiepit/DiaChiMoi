// DiaChiMoi — convert Vietnamese addresses from the old (63 provinces, 3 levels)
// administrative units to the new ones (34 provinces, 2 levels, from 2025-07-01).

export { convert, convertMany } from './convert.mjs';
export { parse } from './parse.mjs';
export { search, listProvinces, listWards, wardOrigins, dataInfo } from './search.mjs';
export { fold, stripDiacritics, key as normalizeKey } from './normalize.mjs';
