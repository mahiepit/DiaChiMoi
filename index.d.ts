// Type definitions for dia-chi-moi

export interface Unit {
  code: string;
  name: string;
  type: string;
  fullName: string;
  /** Only on new (current) wards. */
  postalCode?: string;
}

export interface Warning {
  code:
    | 'NOT_FOUND'
    | 'AMBIGUOUS_INPUT'
    | 'OLD_OR_NEW'
    | 'SPLIT_WARD'
    | 'SAME_RESULT'
    | 'ALREADY_NEW'
    | 'MISSING_WARD'
    | 'UNKNOWN_DISTRICT'
    | 'FUZZY_MATCH'
    | 'HISTORICAL_NAME';
  message: string;
}

export interface Candidate {
  address: string;
  ward: Unit | null;
  province: Unit | null;
  confidence: number;
  /** Old (or new) units this candidate comes from, as full text. */
  from: string[];
  /** merged | split | split_suggested | already_new | special_zone | province_only (comma-separated). */
  note: string;
}

export interface ConvertResult {
  input: string;
  status: 'ok' | 'ambiguous' | 'partial' | 'not_found';
  /** Detected format of the input. */
  format: 'old' | 'new' | 'unknown';
  /** Heuristic 0–1. */
  confidence: number;
  /** New full address (best candidate) or null when it cannot be decided. */
  address: string | null;
  street: string;
  ward: Unit | null;
  province: Unit | null;
  old: { ward: Unit | null; district: Unit | null; province: Unit | null } | null;
  candidates: Candidate[];
  warnings: Warning[];
  /** Only for status "partial" when an old district was recognised. */
  possibleWards?: Unit[];
}

export interface ParseResult {
  input: string;
  format: 'old' | 'new' | 'unknown';
  street: string;
  province: Unit | null;
  district: Unit | null;
  ward: Unit | null;
  confidence: number;
  ambiguous: boolean;
  candidates: Array<{
    format: 'old' | 'new' | 'unknown';
    province: Unit | null;
    district: Unit | null;
    ward: Unit | null;
    description: string;
    confidence: number;
  }>;
  warnings: Warning[];
}

export interface AddressParts {
  street?: string;
  ward?: string;
  district?: string;
  province?: string;
}

export interface UnitInfo {
  era: 'new' | 'old';
  level: 'province' | 'district' | 'ward';
  code: string;
  name: string;
  type: string;
  fullName: string;
  path: string;
  province?: { code: string; fullName: string };
  district?: { code: string; fullName: string };
  postalCode?: string;
  /** Old units: the new ward(s) they became. */
  newWards?: string[];
  /** Old ward split between several new wards. */
  split?: boolean;
  /** Old provinces: the new province. */
  newProvince?: string;
  score?: number;
}

export interface SearchOptions {
  level?: 'any' | 'province' | 'district' | 'ward';
  era?: 'all' | 'new' | 'old';
  province?: string;
  limit?: number;
}

export function convert(input: string | AddressParts): ConvertResult;
export function convertMany(inputs: Array<string | AddressParts>): ConvertResult[];
export function parse(address: string): ParseResult;
export function search(query: string, options?: SearchOptions): UnitInfo[];
export function listProvinces(options?: { era?: 'new' | 'old' }): Array<Record<string, unknown>>;
export function listWards(province: string): UnitInfo[] | null;
export function wardOrigins(
  ward: string,
  options?: { province?: string },
): Array<{ ward: UnitInfo; origins: Array<{ code: string; fullName: string; partial: boolean }> }>;
export function dataInfo(): Record<string, unknown>;
export function fold(text: string): string;
export function stripDiacritics(text: string): string;
export function normalizeKey(text: string): string;
