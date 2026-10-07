<div align="center">

# 🏠 DiaChiMoi

**Convert Vietnamese addresses from the old administrative units (63 provinces, province/district/commune) to the new ones after the 2025 reform (34 provinces, province/commune) — a library, a CLI, an MCP server and an agent skill in one package.**

**Works offline · Zero dependencies · With or without diacritics · Never guesses silently**

[Tiếng Việt](README.md) · English

[![test](https://github.com/mahiepit/DiaChiMoi/actions/workflows/test.yml/badge.svg)](https://github.com/mahiepit/DiaChiMoi/actions/workflows/test.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

---

```text
$ npx github:mahiepit/DiaChiMoi "Số 12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM"
✔ Số 12 Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh
  Cũ: Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh
  Mã phường/xã mới: 26740 · Mã bưu chính: 71016
  Trạng thái: OK · Độ tin cậy: 100%
```

(The CLI speaks Vietnamese; use `--json` for machine-readable output with English field names.)

## ✨ Why DiaChiMoi

Since **1 July 2025** Vietnam has **34 provinces**, the **district level is gone**, and more than 10,000 communes/wards were reorganised into about 3,300. Millions of addresses in CRMs, accounting software, logistics systems and e-commerce platforms are still written the old way — and many old wards were **split** between 2–3 new wards, so a simple lookup table is not enough.

| | |
|---|---|
| 🔌 **One package, four ways to use it** | Node.js library, CLI (`npx`), MCP server for Claude Code / Cursor / Claude Desktop, and an agent skill installable as a Claude Code plugin. |
| ✈️ **Offline, zero dependencies** | Data is bundled (~660 KB of JSON). No API calls, no network, no npm dependencies. |
| 🔤 **Understands real-world input** | With or without diacritics, old/new tone placement (`Hoà`/`Hòa`), abbreviations `P.`, `Q.`, `TP.`, `TX.`, `H.`, `X.`, `TT.`, `F5`, `Q1`, `HCM`, `HN`, `Sài Gòn`, English `Ward 5, District 3`, historical names such as `Quận 2`, `Quận 9`. |
| ⚠️ **No silent guessing** | Split wards, duplicate names, input that could be old or new format → `ambiguous` with every candidate and the reason. |
| 📄 **Batch conversion** | CSV in (all columns kept, result columns appended) or plain text; ~5,000 addresses/second. |
| 🗓️ **Includes 2026 changes** | Đồng Nai, Quảng Ninh and Bắc Ninh became centrally-run cities; 12 Bắc Ninh communes became wards (up to Resolution 388/NQ-UBTVQH16). |

## 🚀 Features

- **`convert`** — old address → new address, keeping the house number/street; returns ward code, postal code, recognised old units, confidence, candidates and warnings.
- **`parse`** — split a free-text address into street, ward/commune, district (old format) and province; detects whether the input is old or new format.
- **`search`** — find units by name (old, new or both), optionally within a province.
- **`origins`** — which old units formed a new ward (with "partial" flags).
- **`provinces` / `wards`** — the 34 new provinces (with the old provinces merged into each), the 63 old provinces, the new wards of a province.
- **Tested on the real data**: addresses generated for all 10,035 old communes in 4 writing styles are recognised exactly in 99.97% of cases (full, abbreviated, with street) and 99.56% without diacritics (the rest are genuine name collisions reported as `ambiguous`), with no wrong results.

## 📥 Install & use

Requires [Node.js 18+](https://nodejs.org).

### 1. CLI — no install needed

```bash
npx github:mahiepit/DiaChiMoi "12 nguyen hue, p ben nghe, q1, tphcm"
npx github:mahiepit/DiaChiMoi "P.5, Q.Gò Vấp, TP HCM" --json
npx github:mahiepit/DiaChiMoi parse "123 Trần Hưng Đạo, P. Nguyễn Cư Trinh, Q.1, TP. Hồ Chí Minh"
npx github:mahiepit/DiaChiMoi search "thao dien"
npx github:mahiepit/DiaChiMoi origins "Phường Sài Gòn"
npx github:mahiepit/DiaChiMoi provinces            # 34 new provinces (--old: the 63 old ones)
npx github:mahiepit/DiaChiMoi wards "Đà Nẵng"
```

Or install once with `npm install -g github:mahiepit/DiaChiMoi` and run `dia-chi-moi …` (or `diachimoi …`).

**Batch conversion** (CSV keeps every original column and appends `new_address, new_ward, new_province, new_ward_code, status, confidence, note`):

```bash
dia-chi-moi batch customers.csv --column "address" --out customers-new.csv --bom   # --bom so Excel reads Vietnamese correctly
dia-chi-moi batch list.txt --json > result.jsonl                                   # one address per line → JSON Lines
cat list.txt | dia-chi-moi batch -                                                 # read from stdin
```

The address column is detected automatically when it is called `address`, `dia_chi`, `diachi`, `Địa chỉ`…; `,` `;` and tab delimiters are supported.

> On Windows PowerShell 5.1, run `chcp 65001` first if Vietnamese text looks garbled in the console (output files are always UTF-8).

### 2. Node.js library

```bash
npm install github:mahiepit/DiaChiMoi
```

```js
import { convert, parse, search, wardOrigins, listProvinces } from 'dia-chi-moi';

const r = convert('144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội');
if (r.status === 'ok') {
  save(r.address);                       // full new address
} else if (r.status === 'ambiguous') {
  review(r.candidates, r.warnings);      // needs a human
}

convert({ street: '12 Nguyễn Huệ', ward: 'Bến Nghé', district: 'Quận 1', province: 'HCM' });
parse('F5 Q3 HCM');                      // { ward: Phường 5, district: Quận 3, province: TP.HCM, format: 'old', … }
search('ben nghe', { era: 'old' });      // [{ fullName: 'Phường Bến Nghé', newWards: ['Phường Sài Gòn, Thành phố Hồ Chí Minh'], … }]
```

TypeScript types are included (`index.d.ts`). `status` values:

| `status` | Meaning | What to do |
|---|---|---|
| `ok` | One unique result | Use `address` |
| `ambiguous` | Several possibilities: old ward split (`SPLIT_WARD`), duplicate names (`AMBIGUOUS_INPUT`), could be old or new format (`OLD_OR_NEW`) | Look at `candidates`; needs the house number, the district or a human. When it is too vague, `address` is `null` |
| `partial` | Only the province could be determined (no ward) | `possibleWards` lists the new wards of the old district |
| `not_found` | No unit recognised | Check spelling, try `search` |

`confidence` (0–1) is a heuristic score for sorting and filtering, not a probability.

### 3. MCP server (Claude Code, Cursor, Claude Desktop…)

Claude Code:

```bash
claude mcp add dia-chi-moi -- npx -y github:mahiepit/DiaChiMoi mcp
# native Windows (not WSL):
claude mcp add dia-chi-moi -- cmd /c npx -y github:mahiepit/DiaChiMoi mcp
```

Claude Desktop (`claude_desktop_config.json`), Cursor (`.cursor/mcp.json`) and other MCP clients:

```json
{
  "mcpServers": {
    "dia-chi-moi": {
      "command": "npx",
      "args": ["-y", "github:mahiepit/DiaChiMoi", "mcp"]
    }
  }
}
```

From a local clone: `"command": "node", "args": ["/path/to/DiaChiMoi/bin/dia-chi-moi-mcp.mjs"]`.

Tools: `convert_address` (one address or up to 1,000), `parse_address`, `search_units`, `list_provinces`, `list_wards`, `ward_origins`. The server is a small hand-written MCP implementation (JSON-RPC over stdio) — no SDK needed.

### 4. Agent skill / Claude Code plugin

```text
/plugin marketplace add mahiepit/DiaChiMoi
/plugin install dia-chi-moi@dia-chi-moi
```

The plugin contains the skill [`skills/dia-chi-moi`](skills/dia-chi-moi/SKILL.md) (tells the agent how to run the CLI, read `status` and handle ambiguity) and registers the MCP server above. The skill follows the open [Agent Skills](https://agentskills.io) format, so the `skills/dia-chi-moi` folder can be copied to other skill-compatible tools.

## 🧪 Examples (real output)

```text
$ dia-chi-moi "25 Le Loi, P. Thach Thang, Q. Hai Chau, Da Nang"
✔ 25 Le Loi, Phường Hải Châu, Thành phố Đà Nẵng
  Cũ: Phường Thạch Thang, Quận Hải Châu, Thành phố Đà Nẵng
  Mã phường/xã mới: 20242 · Mã bưu chính: 50206
  Trạng thái: OK · Độ tin cậy: 100%

$ dia-chi-moi "Phường Phú Cường, TP Thủ Dầu Một, Bình Dương"
✔ Phường Thủ Dầu Một, Thành phố Hồ Chí Minh
  Cũ: Phường Phú Cường, Thành phố Thủ Dầu Một, Tỉnh Bình Dương
  Mã phường/xã mới: 25747 · Mã bưu chính: 75123
  Trạng thái: OK · Độ tin cậy: 100%
```

An old ward split between several new wards — every candidate is returned, nothing is guessed silently:

```text
$ dia-chi-moi "144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội"
⚠ 144 Xuân Thủy, Phường Cầu Giấy, Thành phố Hà Nội
  Cũ: Phường Dịch Vọng Hậu, Quận Cầu Giấy, Thành phố Hà Nội
  Mã phường/xã mới: 00166 · Mã bưu chính: 11314
  Trạng thái: Cần kiểm tra · Độ tin cậy: 60%
  Các khả năng:
   1. 144 Xuân Thủy, Phường Cầu Giấy, Thành phố Hà Nội (60%) ← Phường Dịch Vọng Hậu, Quận Cầu Giấy, Thành phố Hà Nội
   2. 144 Xuân Thủy, Phường Nghĩa Đô, Thành phố Hà Nội (40%) ← Phường Dịch Vọng Hậu, Quận Cầu Giấy, Thành phố Hà Nội
  ! Phường Dịch Vọng Hậu, Quận Cầu Giấy, Thành phố Hà Nội được chia cho 2 đơn vị mới (Phường Cầu Giấy, Phường Nghĩa Đô); cần số nhà/tên đường để xác định chính xác. Kết quả đầu tiên chỉ là gợi ý.
```

A duplicate name without district/province — no address is produced:

```text
$ dia-chi-moi "Phường 1"
⚠ (không xác định được)
  Trạng thái: Cần kiểm tra · Độ tin cậy: 3%
  Các khả năng:
   1. Phường Đông Hà, Tỉnh Quảng Trị (3%) ← Phường 1, Thành phố Đông Hà, Tỉnh Quảng Trị
   2. Phường Quảng Trị, Tỉnh Quảng Trị (3%) ← Phường 1, Thị xã Quảng Trị, Tỉnh Quảng Trị
   …
  ! Địa chỉ khớp 33 đơn vị trùng tên; thêm quận/huyện hoặc tỉnh/thành để xác định.
```

JSON output (abridged):

```text
$ dia-chi-moi "P.5, Q.Gò Vấp, TP HCM" --json
{
  "input": "P.5, Q.Gò Vấp, TP HCM",
  "status": "ok",
  "format": "old",
  "confidence": 1,
  "address": "Phường An Nhơn, Thành phố Hồ Chí Minh",
  "street": "",
  "ward": { "code": "26876", "name": "An Nhơn", "type": "Phường", "fullName": "Phường An Nhơn", "postalCode": "71424" },
  "province": { "code": "79", "name": "Hồ Chí Minh", "type": "Thành phố", "fullName": "Thành phố Hồ Chí Minh" },
  "old": {
    "ward": { "code": "26887", "name": "5", "type": "Phường", "fullName": "Phường 5" },
    "district": { "code": "764", "name": "Gò Vấp", "type": "Quận", "fullName": "Quận Gò Vấp" },
    "province": { "code": "79", "name": "Hồ Chí Minh", "type": "Thành phố", "fullName": "Thành phố Hồ Chí Minh" }
  },
  "candidates": [ … ],
  "warnings": []
}
```

## 📚 Data sources & accuracy

| Data | Source | License |
|---|---|---|
| 34 provinces, 3,321 current communes/wards/special zones, unit codes, postal codes (dataset v5.2.0, up to Resolution 388/NQ-UBTVQH16, 2026-09-20) | [thanglequoc/vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database), from the General Statistics Office code list | MIT |
| Old → new table for 10,035 old communes, default suggestion for split communes, almost 2,000 names from earlier mergers | [tranngocminhhieu/vietnamadminunits](https://github.com/tranngocminhhieu/vietnamadminunits), compiled from danhmuchanhchinh.gso.gov.vn and sapnhap.bando.com.vn | MIT |

Details and copyright notices: [NOTICE.md](NOTICE.md). The conversions used in the test suite were checked against the official merge descriptions on [sapnhap.bando.com.vn](https://sapnhap.bando.com.vn).

> **⚠️ Disclaimer.** DiaChiMoi is a helper tool, not a legal reference. The data may lag behind the newest resolutions, and for split communes the right answer depends on the exact location of the house — the default suggestion is based on the centre of the old commune, **not** on the house number. For legal documents (land titles, contracts, official records) verify with the National Assembly Standing Committee resolutions, [sapnhap.bando.com.vn](https://sapnhap.bando.com.vn), [danhmuchanhchinh.nso.gov.vn](https://danhmuchanhchinh.nso.gov.vn) or the local authority.

Known limitations:
- Only administrative units are recognised; house numbers and street names are not validated.
- Addresses must follow the usual order (small → large: number, ward, district, province). Reversed order is not supported.
- Pre-2025 names are understood only when present in the historical-name table (almost 2,000 names); very old addresses (before the 2019–2024 mergers) may not be recognised.

## 🧩 How it works

```
"12 nguyen hue, p ben nghe, q1, tphcm"
   │  tokenise (keeping character offsets and comma segments), fold diacritics, split "q1" → q 1
   ▼
 match right-to-left:  province  →  district (old addresses only)  →  ward/commune
   │  every level may have several readings → score them (prefix, diacritics, position, historical name, typo)
   ▼
 best-scoring readings ──► old → new table ──► merge identical outcomes
   │
   ▼
 ok | ambiguous | partial | not_found  + new address, codes, confidence, candidates, warnings
```

```
src/normalize.mjs   diacritic folding, match keys, diacritic signature ("Phú" vs "Phụ"), edit distance
src/data.mjs        loads data/diachimoi.json, builds indexes
src/parse.mjs       tokeniser, hypothesis generation and scoring
src/convert.mjs     conversion to the new units, split wards and duplicate names
src/search.mjs      search, lists, origins of new wards
src/cli.mjs         CLI          src/mcp.mjs   MCP server (stdio)
scripts/build-data.mjs     rebuild the data from the two upstream datasets
scripts/eval-roundtrip.mjs self-check on all 10,035 old communes
```

## 🔁 Alternatives

- [vietnamadminunits](https://github.com/tranngocminhhieu/vietnamadminunits) (Python, MIT) — Python library to parse and convert addresses, with pandas support. DiaChiMoi uses its conversion table.
- [vietnam-address-converter](https://github.com/quangtam/vietnam-address-converter) (JavaScript/TypeScript, MIT) — npm library that converts old addresses to new ones.
- [vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database) (MIT) — SQL/JSON database of the current administrative units.
- [sapnhap.bando.com.vn](https://sapnhap.bando.com.vn) — the official lookup website.

What DiaChiMoi adds: an MCP server and agent skill/plugin so AI agents can use it directly, explicit ambiguity reporting instead of guessing, a CLI for whole CSV files, the 2026 changes, and zero dependencies.

## 🤝 Contributing

Bug reports and pull requests are welcome — especially real addresses that convert incorrectly (with a reference source).

```bash
git clone https://github.com/mahiepit/DiaChiMoi.git
cd DiaChiMoi
npm test                               # node --test, nothing to install
node scripts/eval-roundtrip.mjs        # self-check on every old commune
```

Updating the data after a new resolution: clone the two upstream datasets, run `node scripts/build-data.mjs <vietnamadminunits> <vietnamese-provinces-database>`, re-run the tests and record the source in NOTICE.md.

## 🔗 More projects

- **[ControlPhone](https://github.com/mahiepit/ControlPhone)**: control many Android phones at once from your PC
- **[ChuotVan](https://github.com/mahiepit/ChuotVan)**: turn AI-sounding Vietnamese into natural Vietnamese
- **[SkillLint](https://github.com/mahiepit/SkillLint)**: lint Agent Skills (SKILL.md) for every coding agent
- **[PaperViet](https://github.com/mahiepit/PaperViet)**: read English research papers in Vietnamese

## ❤️ Support the project

DiaChiMoi is free and always will be. If it saves you time, a small donation helps keep it maintained. Thank you!

<table>
<tr>
<td align="center"><b>PayPal</b><br><img src="docs/img/donate-paypal.svg" width="180" alt="PayPal QR"><br><a href="https://paypal.me/thaogia">paypal.me/thaogia</a></td>
<td align="center"><b>BNB (BEP-20) / ETH (ERC-20)</b><br><img src="docs/img/donate-crypto.svg" width="180" alt="BNB / ETH QR"><br><code>0xd09c2E60cbC8526976C436e316630FA64296E824</code></td>
</tr>
</table>

Please double-check the network (BNB Smart Chain or Ethereum) before sending crypto.

## 📄 License

[MIT](LICENSE) © Thảo Gia. The bundled data comes from MIT-licensed open datasets listed in [NOTICE.md](NOTICE.md).
DiaChiMoi is an independent project, not affiliated with any government agency.
