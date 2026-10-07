import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/dia-chi-moi.mjs', import.meta.url));
const run = (args, input) =>
  spawnSync(process.execPath, [BIN, ...args], { input: input ?? '', encoding: 'utf8' });

test('cli: convert one address (text)', () => {
  const r = run(['Phường Bến Nghé, Quận 1, TP.HCM']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Phường Sài Gòn, Thành phố Hồ Chí Minh/);
  assert.match(r.stdout, /Cũ: Phường Bến Nghé, Quận 1/);
});

test('cli: --json', () => {
  const r = run(['P.5, Q.Gò Vấp, TP HCM', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.status, 'ok');
  assert.equal(j.ward.fullName, 'Phường An Nhơn');
});

test('cli: exit code 1 when nothing is found', () => {
  assert.equal(run(['xyz abc']).status, 1);
});

test('cli: batch from stdin (lines → CSV)', () => {
  const r = run(['batch'], 'Phường Phúc Xá, Ba Đình, Hà Nội\nP.5, Q.Gò Vấp, HCM\n\n');
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.equal(lines[0], 'input,new_address,new_ward,new_province,new_ward_code,status,confidence,note');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /Phường Hồng Hà/);
  assert.match(r.stderr, /Đã xử lý 2 địa chỉ/);
});

test('cli: piped stdin without command runs batch, --json gives JSON Lines', () => {
  const r = run(['--json'], 'Phường Phúc Xá, Ba Đình, Hà Nội\n');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout.trim()).ward.fullName, 'Phường Hồng Hà');
});

test('cli: batch CSV file keeps columns and appends results', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dcm-'));
  try {
    const inFile = join(dir, 'kh.csv');
    const outFile = join(dir, 'out.csv');
    writeFileSync(inFile, '﻿Mã KH,Địa chỉ,Ghi chú\n1,"12 Nguyễn Huệ, P. Bến Nghé, Q.1, TP.HCM",VIP\n2,"Phường 1",\n');
    const r = run(['batch', inFile, '--column', 'Địa chỉ', '--out', outFile, '--bom']);
    assert.equal(r.status, 0, r.stderr);
    const out = readFileSync(outFile, 'utf8');
    assert.ok(out.startsWith('﻿'));
    const lines = out.replace(/^﻿/, '').trim().split('\n');
    assert.equal(lines[0], 'Mã KH,Địa chỉ,Ghi chú,new_address,new_ward,new_province,new_ward_code,status,confidence,note');
    assert.match(lines[1], /^1,"12 Nguyễn Huệ, P\. Bến Nghé, Q\.1, TP\.HCM",VIP,"12 Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh",Phường Sài Gòn,Thành phố Hồ Chí Minh,26740,ok,1,/);
    assert.match(lines[2], /,ambiguous,/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cli: batch CSV auto-detects the address column', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dcm-'));
  try {
    const inFile = join(dir, 'a.csv');
    writeFileSync(inFile, 'id;address\n7;Phường Phúc Xá, Ba Đình, Hà Nội\n');
    const r = run(['batch', inFile]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^id;address;new_address/);
    assert.match(r.stdout, /Phường Hồng Hà, Thành phố Hà Nội/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cli: parse, search, provinces, wards, origins, info, help, version', () => {
  assert.match(run(['parse', 'P.Bến Nghé, Q.1, TP.HCM']).stdout, /Quận 1 \(760\)/);
  assert.match(run(['search', 'ben nghe']).stdout, /Phường Sài Gòn/);
  assert.equal(JSON.parse(run(['provinces', '--json']).stdout).length, 34);
  assert.equal(JSON.parse(run(['provinces', '--old', '--json']).stdout).length, 63);
  assert.match(run(['wards', 'Huế']).stdout, /Tổng: 40/);
  assert.match(run(['origins', 'Phường Sài Gòn']).stdout, /Phường Bến Nghé/);
  assert.match(run(['info']).stdout, /vietnamese-provinces-database/);
  assert.match(run(['--help']).stdout, /Cách dùng/);
  assert.match(run(['--version']).stdout, /^\d+\.\d+\.\d+/);
});
