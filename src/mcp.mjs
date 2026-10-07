// Minimal, dependency-free MCP server (JSON-RPC 2.0 over stdio, newline-delimited).
// Implements: initialize, ping, tools/list, tools/call.

import { createInterface } from 'node:readline';
import { convert } from './convert.mjs';
import { parse } from './parse.mjs';
import { search, listProvinces, listWards, wardOrigins, dataInfo } from './search.mjs';
import { VERSION } from './version.mjs';

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_BATCH = 1000;

const INSTRUCTIONS =
  'Vietnamese administrative address tools for the 2025 reform (63 → 34 provinces, district level abolished, communes merged; effective 2025-07-01). ' +
  'Use convert_address to turn an old address (tỉnh/huyện/xã) into the new one (tỉnh/xã). Always check `status`: ' +
  '"ok" = unique result; "ambiguous" = several possible new units (old commune split, or duplicate names) — show the candidates and ask for the street/house number or district; ' +
  '"partial" = only the province could be converted; "not_found" = no unit recognised. Data is offline and may lag behind the newest resolutions; for legal documents verify with official sources.';

const str = (description) => ({ type: 'string', description });

export const TOOLS = [
  {
    name: 'convert_address',
    title: 'Convert old Vietnamese address to new units',
    description:
      'Convert Vietnamese address(es) written with the OLD administrative units (63 provinces, quận/huyện, phường/xã before 2025-07-01) into the NEW units (34 provinces, phường/xã/đặc khu, no district). ' +
      'Accepts free text with or without diacritics and abbreviations (P., Q., TP., TX., H., X., TT., HCM, HN). Returns status (ok | ambiguous | partial | not_found), the new address, ward and province codes, the recognised old units, confidence (0–1 heuristic), candidates and warnings. ' +
      'Pass `address` for one address or `addresses` for up to 1000.',
    inputSchema: {
      type: 'object',
      properties: {
        address: str('One address, e.g. "12 Nguyễn Huệ, P. Bến Nghé, Q.1, TP.HCM"'),
        addresses: { type: 'array', items: { type: 'string' }, maxItems: MAX_BATCH, description: 'Several addresses (batch).' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'parse_address',
    title: 'Parse a Vietnamese address',
    description:
      'Split a free-text Vietnamese address (old or new format) into street, ward (phường/xã), district (quận/huyện, old format only) and province, with unit codes. Reports ambiguity instead of guessing.',
    inputSchema: { type: 'object', properties: { address: str('Address text') }, required: ['address'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'search_units',
    title: 'Search administrative units',
    description:
      'Search Vietnamese administrative units by name (diacritics optional). era "new" = current units after 2025-07-01, "old" = units before (includes quận/huyện), "all" = both. Old wards include the new ward(s) they became.',
    inputSchema: {
      type: 'object',
      properties: {
        query: str('Name to search, e.g. "Bến Nghé", "thu duc", "Phường 5"'),
        level: { type: 'string', enum: ['any', 'province', 'district', 'ward'], description: 'Unit level (district exists only in old era). Default any.' },
        era: { type: 'string', enum: ['all', 'new', 'old'], description: 'Default all.' },
        province: str('Optional province name to restrict the search (old or new name).'),
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 10.' },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_provinces',
    title: 'List provinces',
    description: 'List the 34 current provinces/cities (era "new", default, with the old provinces merged into each) or the 63 provinces before 2025-07-01 (era "old", with the new province each belongs to).',
    inputSchema: { type: 'object', properties: { era: { type: 'string', enum: ['new', 'old'] } } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_wards',
    title: 'List wards of a province',
    description: 'List all current (new) phường/xã/đặc khu of a province or centrally-run city, with codes and postal codes.',
    inputSchema: { type: 'object', properties: { province: str('Province name, e.g. "Hồ Chí Minh", "Đà Nẵng"') }, required: ['province'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'ward_origins',
    title: 'Old units that formed a new ward',
    description: 'Given a NEW phường/xã name, list the old phường/xã (with old district/province) merged into it. partial=true means only part of that old unit went to this ward.',
    inputSchema: {
      type: 'object',
      properties: { ward: str('New ward/commune name, e.g. "Phường Sài Gòn"'), province: str('Optional province name') },
      required: ['ward'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

function requireString(args, name) {
  const v = args?.[name];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Missing required string argument "${name}".`);
  return v;
}

export function callTool(name, args = {}) {
  switch (name) {
    case 'convert_address': {
      if (Array.isArray(args.addresses)) {
        if (args.addresses.length > MAX_BATCH) throw new Error(`At most ${MAX_BATCH} addresses per call.`);
        return { results: args.addresses.map((a) => convert(String(a))) };
      }
      return convert(requireString(args, 'address'));
    }
    case 'parse_address':
      return parse(requireString(args, 'address'));
    case 'search_units':
      return {
        results: search(requireString(args, 'query'), {
          level: args.level,
          era: args.era,
          province: args.province,
          limit: Math.min(100, Math.max(1, Number(args.limit) || 10)),
        }),
      };
    case 'list_provinces':
      return { era: args.era === 'old' ? 'old' : 'new', provinces: listProvinces({ era: args.era === 'old' ? 'old' : 'new' }) };
    case 'list_wards': {
      const wards = listWards(requireString(args, 'province'));
      if (!wards) throw new Error(`Province not found: ${args.province}`);
      return { count: wards.length, wards };
    }
    case 'ward_origins':
      return { results: wardOrigins(requireString(args, 'ward'), { province: args.province }) };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  const ok = (result) => (isRequest ? { jsonrpc: '2.0', id, result } : null);
  const fail = (code, message) => (isRequest ? { jsonrpc: '2.0', id, error: { code, message } } : null);

  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion;
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'dia-chi-moi', title: 'DiaChiMoi', version: VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: TOOLS });
    case 'tools/call': {
      try {
        const data = callTool(params?.name, params?.arguments || {});
        return ok({ content: [{ type: 'text', text: JSON.stringify(data, null, 1) }] });
      } catch (e) {
        if (!TOOLS.some((t) => t.name === params?.name)) return fail(-32602, e.message);
        return ok({ content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true });
      }
    }
    default:
      if (typeof method === 'string' && method.startsWith('notifications/')) return null;
      return fail(-32601, `Method not found: ${method}`);
  }
}

export function startMcpServer({ input = process.stdin, output = process.stdout } = {}) {
  const send = (obj) => output.write(JSON.stringify(obj) + '\n');
  const rl = createInterface({ input, crlfDelay: Infinity });
  rl.on('line', (rawLine) => {
    const line = rawLine.replace(/^﻿/, '');
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }
    const batch = Array.isArray(msg) ? msg : [msg];
    const replies = [];
    for (const m of batch) {
      if (!m || typeof m !== 'object' || m.jsonrpc !== '2.0') {
        replies.push({ jsonrpc: '2.0', id: m?.id ?? null, error: { code: -32600, message: 'Invalid Request' } });
        continue;
      }
      if (m.method === undefined) continue; // a response to us; we never send requests
      const r = handle(m);
      if (r) replies.push(r);
    }
    if (!replies.length) return;
    send(Array.isArray(msg) ? replies : replies[0]);
  });
  // When stdin closes the event loop drains pending writes and the process exits by itself.
  process.stderr.write(`dia-chi-moi MCP server ${VERSION} ready (stdio). Dataset: ${dataInfo().current.datasetVersion}\n`);
}
