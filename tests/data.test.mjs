import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { loadData } from '../src/data.mjs';
import { search, listProvinces, listWards, wardOrigins, dataInfo } from '../src/index.mjs';
import { fold, key, signature, editDistance, stripDiacritics } from '../src/normalize.mjs';

test('normalisation helpers', () => {
  assert.equal(fold('Đắk Lắk'), 'dak lak');
  assert.equal(stripDiacritics('Thừa Thiên Huế'), 'Thua Thien Hue');
  assert.equal(key('Phường 05'), 'phuong5');
  assert.equal(key('Bà Rịa - Vũng Tàu'), 'bariavungtau');
  assert.equal(signature('Thanh Hoá'), signature('Thanh Hóa'));
  assert.notEqual(signature('Hoằng Phú'), signature('Hoằng Phụ'));
  assert.equal(editDistance('bennghe', 'benngeh'), 1);
  assert.equal(editDistance('abc', 'xyz', 1), 2);
});

test('dataset counts and integrity', () => {
  const db = loadData();
  assert.equal(db.newProvinces.size, 34);
  assert.equal(db.newWards.size, 3321);
  assert.equal(db.oldProvinces.size, 63);
  assert.equal(db.oldDistricts.size, 696);
  assert.equal(db.oldWards.size, 10035);
  for (const w of db.oldWards.values()) assert.ok(w.targets.length >= 1 && w.targets.every(Boolean), w.fullName);
  for (const w of db.newWards.values()) assert.ok(w.origins.length >= 1, w.fullName);
  // Every old province maps into exactly one new province.
  for (const p of db.oldProvinces.values()) {
    for (const d of p.districts) for (const w of d.wards) for (const t of w.targets) assert.equal(t.province, p.newProvince);
  }
  assert.ok(statSync(new URL('../data/diachimoi.json', import.meta.url)).size < 900 * 1024, 'bundled data stays small');
});

test('province merges of Resolution 202/2025/QH15', () => {
  const db = loadData();
  const to = (name) => [...db.oldProvinces.values()].find((p) => p.name === name).newProvince.name;
  assert.equal(to('Bình Dương'), 'Hồ Chí Minh');
  assert.equal(to('Bà Rịa - Vũng Tàu'), 'Hồ Chí Minh');
  assert.equal(to('Hà Giang'), 'Tuyên Quang');
  assert.equal(to('Quảng Bình'), 'Quảng Trị');
  assert.equal(to('Kon Tum'), 'Quảng Ngãi');
  assert.equal(to('Bình Định'), 'Gia Lai');
  assert.equal(to('Phú Yên'), 'Đắk Lắk');
  assert.equal(to('Bình Phước'), 'Đồng Nai');
  assert.equal(to('Long An'), 'Tây Ninh');
  assert.equal(to('Kiên Giang'), 'An Giang');
  assert.equal(to('Bạc Liêu'), 'Cà Mau');
  assert.equal(to('Hải Dương'), 'Hải Phòng');
  assert.equal(to('Quảng Nam'), 'Đà Nẵng');
  assert.equal(to('Hà Nội'), 'Hà Nội');
});

test('listProvinces', () => {
  const now = listProvinces();
  assert.equal(now.length, 34);
  const hcm = now.find((p) => p.code === '79');
  assert.deepEqual(hcm.mergedFrom.sort(), ['Thành phố Hồ Chí Minh', 'Tỉnh Bà Rịa - Vũng Tàu', 'Tỉnh Bình Dương'].sort());
  assert.equal(listProvinces({ era: 'old' }).length, 63);
});

test('listWards', () => {
  assert.equal(listWards('Hồ Chí Minh').length, 168);
  assert.equal(listWards('tp hcm').length, 168);
  assert.equal(listWards('Không có'), null);
});

test('search', () => {
  const r = search('ben nghe');
  assert.equal(r[0].fullName, 'Phường Bến Nghé');
  assert.equal(r[0].era, 'old');
  assert.deepEqual(r[0].newWards, ['Phường Sài Gòn, Thành phố Hồ Chí Minh']);
  const n = search('Sài Gòn', { era: 'new', level: 'ward' });
  assert.equal(n[0].fullName, 'Phường Sài Gòn');
  const p = search('phuong 5', { province: 'Hồ Chí Minh', era: 'old', limit: 50 });
  assert.ok(p.length > 5 && p.every((u) => u.province.code === '79' || u.province.code === '74' || u.province.code === '77'));
});

test('wardOrigins', () => {
  const r = wardOrigins('Phường Sài Gòn');
  assert.equal(r.length, 1);
  const names = r[0].origins.map((o) => o.fullName);
  assert.ok(names.includes('Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh'));
  assert.ok(r[0].origins.some((o) => o.partial));
});

test('dataInfo exposes sources', () => {
  const m = dataInfo();
  assert.match(m.current.url, /vietnamese-provinces-database/);
  assert.match(m.mapping.url, /vietnamadminunits/);
});
