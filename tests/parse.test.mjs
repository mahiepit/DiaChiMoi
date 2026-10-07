import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/index.mjs';
import { tokenize } from '../src/parse.mjs';

test('tokenizer splits Q1/P5 and keeps offsets', () => {
  const { tokens, segments } = tokenize('12 Lê Lợi, P5, Q1, TP.HCM');
  assert.deepEqual(tokens.map((t) => t.t), ['12', 'le', 'loi', 'p', '5', 'q', '1', 'tp', 'hcm']);
  assert.equal(segments, 4);
  assert.equal(tokens[1].raw, 'Lê');
});

test('parse a full old address', () => {
  const r = parse('Số 12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh');
  assert.equal(r.format, 'old');
  assert.equal(r.street, 'Số 12 Nguyễn Huệ');
  assert.equal(r.ward.fullName, 'Phường Bến Nghé');
  assert.equal(r.district.fullName, 'Quận 1');
  assert.equal(r.province.fullName, 'Thành phố Hồ Chí Minh');
  assert.equal(r.ambiguous, false);
  assert.equal(r.confidence, 1);
});

test('abbreviations', () => {
  const cases = [
    ['P.Bến Nghé, Q.1, TP.HCM', 'Bến Nghé', '1'],
    ['F5 Q3 HCM', '5', '3'],
    ['TT. Trâu Quỳ, H. Gia Lâm, HN', 'Trâu Quỳ', 'Gia Lâm'],
    ['X. Tân Lập, H. Đan Phượng, Hà Nội', 'Tân Lập', 'Đan Phượng'],
    ['P. Trung Hưng, TX. Sơn Tây, Hà Nội', 'Trung Hưng', 'Sơn Tây'],
    ['Phường 05, Quận 03, Hồ Chí Minh', '5', '3'],
  ];
  for (const [input, ward, district] of cases) {
    const r = parse(input);
    assert.equal(r.ward?.name, ward, input);
    assert.equal(r.district?.name, district, input);
  }
});

test('no diacritics', () => {
  const r = parse('xa tan lap, huyen dan phuong, ha noi');
  assert.equal(r.ward.fullName, 'Xã Tân Lập');
  assert.equal(r.district.fullName, 'Huyện Đan Phượng');
});

test('names that start like a prefix ("Phương Mai")', () => {
  const r = parse('Phương Mai, Đống Đa, Hà Nội');
  assert.equal(r.ward.fullName, 'Phường Phương Mai');
});

test('names containing "Mới" are kept', () => {
  assert.equal(parse('Thị trấn Chợ Mới, Huyện Chợ Mới, An Giang').ward.fullName, 'Thị trấn Chợ Mới');
});

test('new-format address', () => {
  const r = parse('Phường Sài Gòn, TP. Hồ Chí Minh');
  assert.equal(r.format, 'new');
  assert.equal(r.ward.fullName, 'Phường Sài Gòn');
  assert.equal(r.district, null);
});

test('district without province is enough', () => {
  const r = parse('Phường Tân Định, Quận 1');
  assert.equal(r.province.fullName, 'Thành phố Hồ Chí Minh');
});

test('house number before a name that is also a ward does not become the ward', () => {
  const r = parse('12 Nguyễn Thái Bình, Quận 1, TP.HCM');
  assert.equal(r.ward, null);
  assert.equal(r.district.fullName, 'Quận 1');
  assert.equal(r.street, '12 Nguyễn Thái Bình');
});

test('ambiguous commune name across provinces', () => {
  const r = parse('Xã Tân Hòa');
  assert.equal(r.ambiguous, true);
  assert.ok(r.candidates.length > 3);
});

test('historical district names (Quận 2/9 → Thủ Đức)', () => {
  const r = parse('Phường Thảo Điền, Quận 2, TP.HCM');
  assert.equal(r.ward.fullName, 'Phường Thảo Điền');
  assert.equal(r.district.fullName, 'Thành phố Thủ Đức');
});

test('unknown but marked district is skipped with a warning', () => {
  const r = parse('Phường Bến Nghé, Quận Không Tồn Tại, TP.HCM');
  assert.equal(r.ward.fullName, 'Phường Bến Nghé');
  assert.ok(r.warnings.some((w) => w.code === 'UNKNOWN_DISTRICT'));
});
