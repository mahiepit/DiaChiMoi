# NOTICE — Third-party data

DiaChiMoi's code is MIT-licensed (see [LICENSE](LICENSE)). The bundled file `data/diachimoi.json`
is derived from the following open datasets. Both are published under the MIT License, which
permits redistribution with attribution; their copyright notices are reproduced below.

## 1. Vietnamese Provinces Database — current units (34 provinces, 3,321 communes)

- Project: https://github.com/thanglequoc/vietnamese-provinces-database
- Version used: dataset v5.2.0 (latest decree reflected: 388/NQ-UBTVQH16, generated 2026-09-20),
  commit `8b78ba5118715e1fa81769286724db79346abf52`
- Used for: names, types, codes and postal codes of the current provinces and communes,
  including the 2026 changes (Đồng Nai, Quảng Ninh and Bắc Ninh becoming centrally-run cities;
  12 communes of Bắc Ninh becoming wards).
- Upstream source: General Statistics Office of Vietnam / National Statistics Office
  (danhmuchanhchinh.gso.gov.vn, danhmuchanhchinh.nso.gov.vn).

```
MIT License

Copyright (c) 2021 Thang Le Quoc

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 2. vietnamadminunits — old → new mapping (10,035 old communes) and historical aliases

- Project: https://github.com/tranngocminhhieu/vietnamadminunits
- Commit used: `7fac8c45805aad9916b17237c54baf4502303b93` (2025-10-08)
- Files used: `data/processed/convert_legacy_2025_with_location_and_default_ward.csv`
  (old commune → new commune(s), default suggestion for split communes) and
  `data/alias_keywords/legacy/*.csv` (names from earlier mergers, e.g. Quận 2/Quận 9 → TP Thủ Đức).
- Upstream sources: danhmuchanhchinh.gso.gov.vn (General Statistics Office) and
  sapnhap.bando.com.vn (Vietnam Publishing House of Natural Resources, Environment and Cartography),
  which publish the 2025 reorganisation decided by the National Assembly Standing Committee.

```
MIT License

Copyright (c) 2025 Tran Ngoc Minh Hieu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Official sources (for verification)

Administrative unit lists and decisions are public documents of the Vietnamese State:

- Nghị quyết 202/2025/QH15 về sắp xếp đơn vị hành chính cấp tỉnh (63 → 34 provinces, effective 2025-07-01).
- Nghị quyết của Ủy ban Thường vụ Quốc hội về sắp xếp đơn vị hành chính cấp xã của từng tỉnh, thành phố năm 2025.
- Later resolutions reflected in the data: 30/2026/QH16, 237/NQ-UBTVQH16, 36/2026/QH16, 39/2026/QH16, 388/NQ-UBTVQH16.
- https://danhmuchanhchinh.nso.gov.vn — official code list.
- https://sapnhap.bando.com.vn — official merge lookup.

DiaChiMoi is an independent project and is not affiliated with any government agency or with the
authors of the datasets above.
