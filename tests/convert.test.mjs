import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, convertMany } from '../src/index.mjs';

// Expected results below were checked against the official merge descriptions
// published on sapnhap.bando.com.vn (Nhà xuất bản Tài nguyên – Môi trường và Bản đồ Việt Nam)
// and the Standing Committee resolutions of June 2025.
const VERIFIED = [
  ['Số 12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM', 'Số 12 Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh'],
  ['Phường Phúc Xá, Quận Ba Đình, Hà Nội', 'Phường Hồng Hà, Thành phố Hà Nội'],
  ['P.5, Q.Gò Vấp, TP HCM', 'Phường An Nhơn, Thành phố Hồ Chí Minh'],
  ['Phường 12, Quận Gò Vấp, Thành phố Hồ Chí Minh', 'Phường An Hội Tây, Thành phố Hồ Chí Minh'],
  ['Phường 5, Quận 3, TP. Hồ Chí Minh', 'Phường Bàn Cờ, Thành phố Hồ Chí Minh'],
  ['Phường 7, Thành phố Vũng Tàu, Bà Rịa - Vũng Tàu', 'Phường Tam Thắng, Thành phố Hồ Chí Minh'],
  ['Phường Phú Cường, Thành phố Thủ Dầu Một, Bình Dương', 'Phường Thủ Dầu Một, Thành phố Hồ Chí Minh'],
  ['25 Lê Lợi, Phường Thạch Thang, Quận Hải Châu, Đà Nẵng', '25 Lê Lợi, Phường Hải Châu, Thành phố Đà Nẵng'],
  ['123 Trần Hưng Đạo, P. Nguyễn Cư Trinh, Q.1, TP. Hồ Chí Minh', '123 Trần Hưng Đạo, Phường Cầu Ông Lãnh, Thành phố Hồ Chí Minh'],
  ['P. Hòa Cường Bắc, Q. Hải Châu, TP. Đà Nẵng', 'Phường Hoà Cường, Thành phố Đà Nẵng'],
  ['Phường Linh Trung, TP Thủ Đức, TP.HCM', 'Phường Linh Xuân, Thành phố Hồ Chí Minh'],
  ['Huyện Côn Đảo, Tỉnh Bà Rịa - Vũng Tàu', 'Đặc khu Côn Đảo, Thành phố Hồ Chí Minh'],
  ['Thị trấn Yên Viên, Huyện Gia Lâm, Hà Nội', 'Xã Phù Đổng, Thành phố Hà Nội'],
  ['Xã Yên Viên, Huyện Gia Lâm, Hà Nội', 'Xã Phù Đổng, Thành phố Hà Nội'],
  ['Thôn 3, Xã Ea Kao, TP Buôn Ma Thuột, Đắk Lắk', 'Thôn 3, Phường Ea Kao, Tỉnh Đắk Lắk'],
];

for (const [input, expected] of VERIFIED) {
  test(`verified conversion: ${input}`, () => {
    const r = convert(input);
    assert.equal(r.status, 'ok', JSON.stringify(r.warnings));
    assert.equal(r.format, 'old');
    assert.equal(r.address, expected);
    assert.ok(r.confidence >= 0.9, `confidence ${r.confidence}`);
  });
}

test('no diacritics and abbreviations give the same result', () => {
  for (const s of ['12 nguyen hue, p ben nghe, q1, tphcm', '12 Nguyen Hue, Phuong Ben Nghe, Quan 1, Ho Chi Minh', '12 Nguyen Hue Ben Nghe Q1 HCM']) {
    const r = convert(s);
    assert.equal(r.status, 'ok', s);
    assert.equal(r.ward.name, 'Sài Gòn', s);
    assert.equal(r.province.name, 'Hồ Chí Minh', s);
  }
});

test('English style address', () => {
  const r = convert('Ward 5, District 3, Ho Chi Minh City');
  assert.equal(r.status, 'ok');
  assert.equal(r.ward.fullName, 'Phường Bàn Cờ');
});

test('old units are reported', () => {
  const r = convert('Phường Bến Nghé, Quận 1, TP.HCM');
  assert.equal(r.old.ward.fullName, 'Phường Bến Nghé');
  assert.equal(r.old.district.fullName, 'Quận 1');
  assert.equal(r.old.province.fullName, 'Thành phố Hồ Chí Minh');
  assert.equal(r.ward.code, '26740');
  assert.equal(r.ward.postalCode, '71016');
});

test('split ward: candidates, suggestion and warning — never a silent guess', () => {
  const r = convert('144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội');
  assert.equal(r.status, 'ambiguous');
  const names = r.candidates.map((c) => c.ward.fullName).sort();
  assert.deepEqual(names, ['Phường Cầu Giấy', 'Phường Nghĩa Đô']);
  assert.ok(r.confidence < 0.9);
  assert.ok(r.warnings.some((w) => w.code === 'SPLIT_WARD'));
  assert.equal(r.street, '144 Xuân Thủy');
});

test('duplicate names without district/province are ambiguous with no main result', () => {
  const r = convert('Phường 1');
  assert.equal(r.status, 'ambiguous');
  assert.equal(r.address, null);
  assert.equal(r.ward, null);
  assert.ok(r.candidates.length > 5);
  assert.ok(r.warnings.some((w) => w.code === 'AMBIGUOUS_INPUT'));
});

test('duplicate names resolved by district', () => {
  const r = convert('Phường 1, Quận 3, TP.HCM');
  assert.equal(r.status, 'ok');
  assert.equal(r.ward.fullName, 'Phường Bàn Cờ');
});

test('Xã vs Thị trấn with the same name are told apart by the prefix', () => {
  assert.equal(convert('Xã Mường Tè, Huyện Mường Tè, Lai Châu').old.ward.type, 'Xã');
  assert.equal(convert('Thị trấn Mường Tè, Huyện Mường Tè, Lai Châu').old.ward.type, 'Thị trấn');
});

test('diacritics break ties between names that only differ by tone', () => {
  const a = convert('Xã Hoằng Phú, Huyện Hoằng Hóa, Thanh Hóa');
  const b = convert('Xã Hoằng Phụ, Huyện Hoằng Hóa, Thanh Hóa');
  assert.equal(a.old.ward.name, 'Hoằng Phú');
  assert.equal(b.old.ward.name, 'Hoằng Phụ');
  // Without diacritics both are possible.
  const c = convert('Xa Hoang Phu, Huyen Hoang Hoa, Thanh Hoa');
  assert.ok(c.status === 'ambiguous' || c.warnings.some((w) => w.code === 'SAME_RESULT'));
});

test('already-new addresses are recognised', () => {
  const r = convert('Phường Sài Gòn, TP. Hồ Chí Minh');
  assert.equal(r.status, 'ok');
  assert.equal(r.format, 'new');
  assert.equal(r.address, 'Phường Sài Gòn, Thành phố Hồ Chí Minh');
  assert.ok(r.warnings.some((w) => w.code === 'ALREADY_NEW'));
});

test('2026 updates are applied (Quảng Ninh, Bắc Ninh, Đồng Nai became cities)', () => {
  assert.equal(convert('Phường Hồng Gai, TP Hạ Long, Quảng Ninh').province.fullName, 'Thành phố Quảng Ninh');
  assert.equal(convert('Phường Tân Phong, TP Biên Hòa, Đồng Nai').province.fullName, 'Thành phố Đồng Nai');
  const r = convert('Xã Bố Hạ, Bắc Ninh');
  assert.equal(r.ward.fullName, 'Phường Bố Hạ');
  assert.equal(r.province.fullName, 'Thành phố Bắc Ninh');
});

test('partial: only district/province known', () => {
  const r = convert('Quận 9, TP.HCM');
  assert.equal(r.status, 'partial');
  assert.equal(r.province.fullName, 'Thành phố Hồ Chí Minh');
  assert.equal(r.old.district.fullName, 'Thành phố Thủ Đức');
  assert.ok(r.possibleWards.length > 5);
  assert.ok(r.warnings.some((w) => w.code === 'HISTORICAL_NAME'));
});

test('province only', () => {
  const r = convert('Tỉnh Bình Dương');
  assert.equal(r.status, 'partial');
  assert.equal(r.province.fullName, 'Thành phố Hồ Chí Minh');
});

test('trailing province name beats a commune with the same name', () => {
  const r = convert('KCN Tân Bình, Bình Dương');
  assert.equal(r.status, 'partial');
  assert.equal(r.province.name, 'Hồ Chí Minh');
});

test('typo tolerance is reported', () => {
  const r = convert('Phuong Ben Ngeh, Quan 1, TP HCM');
  assert.equal(r.ward.fullName, 'Phường Sài Gòn');
  assert.ok(r.warnings.some((w) => w.code === 'FUZZY_MATCH'));
  assert.ok(r.confidence < 0.9);
});

test('not found', () => {
  const r = convert('lorem ipsum dolor');
  assert.equal(r.status, 'not_found');
  assert.equal(r.address, null);
  assert.equal(convert('').status, 'not_found');
});

test('object input and convertMany', () => {
  const r = convert({ street: '12 Nguyễn Huệ', ward: 'Bến Nghé', district: 'Quận 1', province: 'Hồ Chí Minh' });
  assert.equal(r.address, '12 Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh');
  const many = convertMany(['Phường Phúc Xá, Ba Đình, Hà Nội', 'P.5, Q.Gò Vấp, HCM']);
  assert.deepEqual(many.map((x) => x.ward.name), ['Hồng Hà', 'An Nhơn']);
});

test('parenthesised notes and "Việt Nam" are ignored', () => {
  const r = convert('Số 1 (gần chợ), P. Bến Thành, Q.1, TP.HCM, Việt Nam');
  assert.equal(r.status, 'ok');
  assert.equal(r.ward.fullName, 'Phường Bến Thành');
});
