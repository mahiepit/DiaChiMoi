// Command-line interface for DiaChiMoi.

import { readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { convert } from './convert.mjs';
import { parse } from './parse.mjs';
import { search, listProvinces, listWards, wardOrigins, dataInfo } from './search.mjs';
import { parseCSV, csvLine, detectDelimiter } from './csv.mjs';
import { VERSION } from './version.mjs';
import { key } from './normalize.mjs';

const HELP = `DiaChiMoi ${VERSION} — chuyển địa chỉ cũ (63 tỉnh, 3 cấp) sang địa chỉ mới (34 tỉnh, 2 cấp, từ 01/07/2025)

Cách dùng:
  dia-chi-moi "<địa chỉ cũ>" ["<địa chỉ 2>" ...]   Chuyển sang địa chỉ mới
  dia-chi-moi parse "<địa chỉ>"                    Tách số nhà/đường, phường/xã, quận/huyện, tỉnh/thành
  dia-chi-moi search "<tên>" [--level ward|district|province] [--era new|old|all] [--province <tỉnh>] [--limit N]
  dia-chi-moi provinces [--old]                    Danh sách 34 tỉnh/thành mới (hoặc 63 tỉnh cũ)
  dia-chi-moi wards "<tỉnh/thành>"                 Danh sách phường/xã mới của một tỉnh/thành
  dia-chi-moi origins "<phường/xã mới>" [--province <tỉnh>]   Phường/xã mới gồm những đơn vị cũ nào
  dia-chi-moi batch [tệp|-] [--column <cột>] [--out <tệp>] [--json] [--bom]
                                                   Chuyển hàng loạt: CSV (giữ nguyên các cột, thêm cột kết quả)
                                                   hoặc tệp văn bản mỗi dòng một địa chỉ; "-" hoặc bỏ trống = stdin
  dia-chi-moi mcp                                  Chạy MCP server (stdio) cho Claude Code, Cursor...
  dia-chi-moi info                                 Nguồn dữ liệu và phiên bản

Tuỳ chọn chung:
  --json        In kết quả dạng JSON (batch: JSON Lines)
  -h, --help    Trợ giúp        -v, --version   Phiên bản

Ví dụ:
  npx github:mahiepit/DiaChiMoi "12 Nguyễn Huệ, P. Bến Nghé, Q.1, TP.HCM"
  npx github:mahiepit/DiaChiMoi batch khach-hang.csv --column "Địa chỉ" --out khach-hang-moi.csv --bom
`;

const COMMANDS = new Set(['convert', 'parse', 'search', 'provinces', 'wards', 'origins', 'batch', 'mcp', 'info', 'help']);
const VALUE_FLAGS = new Set(['level', 'era', 'province', 'limit', 'column', 'out', 'o']);

export function parseArgs(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { pos.push(...argv.slice(i + 1)); break; }
    if (a === '-h') { flags.help = true; continue; }
    if (a === '-v') { flags.version = true; continue; }
    if (a === '-o') { flags.out = argv[++i]; continue; }
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (m) {
      const name = m[1];
      if (m[2] !== undefined) flags[name] = m[2];
      else if (VALUE_FLAGS.has(name)) flags[name] = argv[++i];
      else flags[name] = true;
      continue;
    }
    pos.push(a);
  }
  return { flags, pos };
}

const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const STATUS_ICON = { ok: '✔', ambiguous: '⚠', partial: '◐', not_found: '✘' };
const STATUS_TEXT = { ok: 'OK', ambiguous: 'Cần kiểm tra', partial: 'Chỉ xác định được tỉnh/thành', not_found: 'Không tìm thấy' };

export function formatConvert(r) {
  const lines = [];
  lines.push(`${STATUS_ICON[r.status]} ${r.address ?? '(không xác định được)'}`);
  if (r.old) {
    const old = [r.old.ward?.fullName, r.old.district?.fullName, r.old.province?.fullName].filter(Boolean).join(', ');
    if (old) lines.push(`  Cũ: ${old}`);
  }
  if (r.ward?.code) lines.push(`  Mã phường/xã mới: ${r.ward.code}${r.ward.postalCode ? ` · Mã bưu chính: ${r.ward.postalCode}` : ''}`);
  lines.push(`  Trạng thái: ${STATUS_TEXT[r.status]} · Độ tin cậy: ${pct(r.confidence)}`);
  if (r.candidates.length > 1) {
    lines.push('  Các khả năng:');
    r.candidates.slice(0, 10).forEach((c, i) => lines.push(`   ${i + 1}. ${c.address} (${pct(c.confidence)})${c.from?.length ? ` ← ${c.from.join('; ')}` : ''}`));
    if (r.candidates.length > 10) lines.push(`   … và ${r.candidates.length - 10} khả năng khác`);
  }
  for (const w of r.warnings) if (w.code !== 'NOT_FOUND') lines.push(`  ! ${w.message}`);
  return lines.join('\n');
}

function formatParse(r) {
  const lines = [];
  const row = (label, u) => u && lines.push(`  ${label.padEnd(10)} ${u.fullName} (${u.code})`);
  lines.push(`Định dạng: ${r.format === 'old' ? 'cũ (trước 01/07/2025)' : r.format === 'new' ? 'mới (từ 01/07/2025)' : 'chưa rõ'} · Độ tin cậy: ${pct(r.confidence)}`);
  if (r.street) lines.push(`  ${'Số/đường'.padEnd(10)} ${r.street}`);
  row('Phường/xã', r.ward);
  row('Quận/huyện', r.district);
  row('Tỉnh/thành', r.province);
  if (r.ambiguous) {
    lines.push('  Các khả năng:');
    r.candidates.slice(0, 10).forEach((c, i) => lines.push(`   ${i + 1}. ${c.description}`));
  }
  for (const w of r.warnings) lines.push(`  ! ${w.message}`);
  return lines.join('\n');
}

function readInput(file) {
  const buf = !file || file === '-' ? readFileSync(0) : readFileSync(file);
  return buf.toString('utf8').replace(/^﻿/, '');
}

const ADDRESS_HEADERS = ['address', 'diachi', 'fulladdress', 'addr', 'diachicu', 'oldaddress', 'diachiday du', 'diachidaydu'];

function findColumn(header, wanted) {
  if (wanted !== undefined && wanted !== true) {
    if (/^\d+$/.test(wanted)) return parseInt(wanted, 10) - 1;
    const k = key(wanted);
    return header.findIndex((h) => key(h) === k);
  }
  return header.findIndex((h) => ADDRESS_HEADERS.includes(key(h)));
}

const RESULT_COLUMNS = ['new_address', 'new_ward', 'new_province', 'new_ward_code', 'status', 'confidence', 'note'];
function resultCells(r) {
  return [
    r.address ?? '',
    r.ward?.fullName ?? '',
    r.province?.fullName ?? '',
    r.ward?.code ?? '',
    r.status,
    r.confidence,
    r.warnings.map((w) => w.message).join(' | '),
  ];
}

export function runBatch(flags, file, io) {
  const text = readInput(file);
  const isCsv = flags.csv || flags.column !== undefined || (file && extname(file).toLowerCase() === '.csv');
  const cache = new Map();
  const conv = (a) => {
    if (!cache.has(a)) cache.set(a, convert(a));
    return cache.get(a);
  };
  const out = [];
  const stats = { ok: 0, ambiguous: 0, partial: 0, not_found: 0 };
  if (isCsv) {
    const delim = detectDelimiter(text);
    const rows = parseCSV(text, delim);
    if (!rows.length) throw new Error('Tệp CSV trống.');
    const header = rows[0];
    const col = findColumn(header, flags.column);
    if (col < 0 || col >= header.length) {
      throw new Error(`Không tìm thấy cột địa chỉ. Hãy dùng --column "<tên cột>". Các cột: ${header.join(', ')}`);
    }
    if (flags.json) {
      for (const row of rows.slice(1)) {
        const r = conv(row[col] ?? '');
        stats[r.status]++;
        out.push(JSON.stringify({ row: Object.fromEntries(header.map((h, i) => [h, row[i] ?? ''])), result: r }));
      }
    } else {
      out.push(csvLine([...header, ...RESULT_COLUMNS], delim));
      for (const row of rows.slice(1)) {
        const r = conv(row[col] ?? '');
        stats[r.status]++;
        const padded = header.map((_, i) => row[i] ?? '');
        out.push(csvLine([...padded, ...resultCells(r)], delim));
      }
    }
  } else {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!flags.json) out.push(csvLine(['input', ...RESULT_COLUMNS]));
    for (const line of lines) {
      const r = conv(line.trim());
      stats[r.status]++;
      out.push(flags.json ? JSON.stringify(r) : csvLine([line.trim(), ...resultCells(r)]));
    }
  }
  const body = (flags.bom && !flags.json ? '﻿' : '') + out.join('\n') + '\n';
  if (flags.out) writeFileSync(flags.out, body, 'utf8');
  else io.stdout(body);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  io.stderr(
    `Đã xử lý ${total} địa chỉ: ${stats.ok} OK, ${stats.ambiguous} cần kiểm tra, ${stats.partial} chỉ có tỉnh/thành, ${stats.not_found} không tìm thấy.` +
      (flags.out ? ` Đã ghi ${flags.out}.` : '') +
      '\n',
  );
  return 0;
}

/**
 * Run the CLI. Returns an exit code (or null when a long-running server was started).
 */
export async function main(argv, io = { stdout: (s) => process.stdout.write(s), stderr: (s) => process.stderr.write(s), stdinIsTTY: process.stdin.isTTY }) {
  const { flags, pos } = parseArgs(argv);
  if (flags.version) { io.stdout(VERSION + '\n'); return 0; }
  let cmd = pos[0] && COMMANDS.has(pos[0]) ? pos.shift() : null;
  if (flags.help || cmd === 'help') { io.stdout(HELP); return 0; }
  if (!cmd) {
    if (pos.length) cmd = 'convert';
    else if (!io.stdinIsTTY) cmd = 'batch';
    else { io.stdout(HELP); return 0; }
  }
  const json = (obj) => io.stdout(JSON.stringify(obj, null, 2) + '\n');

  try {
    switch (cmd) {
      case 'convert': {
        if (!pos.length) { io.stderr('Thiếu địa chỉ. Xem: dia-chi-moi --help\n'); return 2; }
        const results = pos.map((a) => convert(a));
        if (flags.json) json(results.length === 1 ? results[0] : results);
        else io.stdout(results.map(formatConvert).join('\n\n') + '\n');
        return results.some((r) => r.status === 'not_found') ? 1 : 0;
      }
      case 'parse': {
        if (!pos.length) { io.stderr('Thiếu địa chỉ.\n'); return 2; }
        const results = pos.map((a) => parse(a));
        if (flags.json) json(results.length === 1 ? results[0] : results);
        else io.stdout(results.map(formatParse).join('\n\n') + '\n');
        return 0;
      }
      case 'search': {
        const q = pos.join(' ');
        if (!q) { io.stderr('Thiếu từ khoá.\n'); return 2; }
        const res = search(q, { level: flags.level, era: flags.era, province: flags.province, limit: Number(flags.limit) || 10 });
        if (flags.json) json(res);
        else if (!res.length) io.stdout('Không tìm thấy.\n');
        else {
          io.stdout(
            res
              .map((u) => {
                const tag = u.era === 'new' ? '[mới]' : '[cũ] ';
                const extra = u.newWards ? `  →  ${u.newWards.join(' | ')}${u.split ? ' (bị chia)' : ''}` : u.newProvince ? `  →  ${u.newProvince}` : '';
                return `${tag} ${u.path} (${u.code})${extra}`;
              })
              .join('\n') + '\n',
          );
        }
        return 0;
      }
      case 'provinces': {
        const era = flags.old ? 'old' : 'new';
        const list = listProvinces({ era });
        if (flags.json) json(list);
        else if (era === 'new') io.stdout(list.map((p) => `${p.code}  ${p.fullName} — ${p.wards} phường/xã${p.mergedFrom.length > 1 ? ` (gộp: ${p.mergedFrom.join(', ')})` : ''}`).join('\n') + '\n');
        else io.stdout(list.map((p) => `${p.code}  ${p.fullName}  →  ${p.newProvince}`).join('\n') + '\n');
        return 0;
      }
      case 'wards': {
        const list = listWards(pos.join(' '));
        if (!list) { io.stderr('Không tìm thấy tỉnh/thành.\n'); return 1; }
        if (flags.json) json(list);
        else io.stdout(list.map((w) => `${w.code}  ${w.fullName}${w.postalCode ? `  (${w.postalCode})` : ''}`).join('\n') + `\nTổng: ${list.length}\n`);
        return 0;
      }
      case 'origins': {
        const res = wardOrigins(pos.join(' '), { province: flags.province });
        if (flags.json) json(res);
        else if (!res.length) io.stdout('Không tìm thấy phường/xã mới này.\n');
        else {
          io.stdout(
            res
              .map((r) => `${r.ward.path} (${r.ward.code}) được hình thành từ:\n` + r.origins.map((o) => `  - ${o.fullName}${o.partial ? ' (một phần)' : ''}`).join('\n'))
              .join('\n\n') + '\n',
          );
        }
        return 0;
      }
      case 'batch':
        return runBatch(flags, pos[0], io);
      case 'info':
        json(dataInfo());
        return 0;
      case 'mcp': {
        const { startMcpServer } = await import('./mcp.mjs');
        startMcpServer();
        return null;
      }
      default:
        io.stdout(HELP);
        return 0;
    }
  } catch (e) {
    io.stderr(`Lỗi: ${e.message}\n`);
    return 1;
  }
}
