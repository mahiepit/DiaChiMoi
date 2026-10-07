<div align="center">

# 🏠 DiaChiMoi

**Chuyển địa chỉ Việt Nam cũ (63 tỉnh, tỉnh/huyện/xã) sang địa chỉ mới sau sáp nhập 2025 (34 tỉnh, tỉnh/xã) — thư viện, CLI, MCP server và agent skill trong một gói.**

**Chạy offline · Không phụ thuộc thư viện nào · Có hoặc không dấu đều hiểu · Không bao giờ đoán thầm**

Tiếng Việt · [English](README.en.md)

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

## ✨ Vì sao cần DiaChiMoi

Từ **01/07/2025**, Việt Nam còn **34 tỉnh/thành**, **bỏ cấp quận/huyện**, hơn 10.000 phường/xã được sắp xếp lại còn khoảng 3.300. Hàng triệu địa chỉ trong CRM, phần mềm kế toán, hệ thống giao hàng, sàn thương mại điện tử vẫn đang ghi theo kiểu cũ — và nhiều phường cũ bị **chia** cho 2–3 phường mới, nên không thể đổi bằng một bảng tra đơn giản.

| | |
|---|---|
| 🔌 **Một bộ, bốn cách dùng** | Thư viện Node.js, CLI (`npx`), MCP server cho Claude Code / Cursor / Claude Desktop, và agent skill cài như plugin Claude Code. |
| ✈️ **Offline, không phụ thuộc** | Dữ liệu đóng gói sẵn (~660 KB JSON). Không gọi API, không cần mạng, không có dependency nào. |
| 🔤 **Hiểu địa chỉ người Việt gõ** | Có dấu / không dấu, dấu kiểu cũ (`Hoà`) hay mới (`Hòa`), viết tắt `P.`, `Q.`, `TP.`, `TX.`, `H.`, `X.`, `TT.`, `F5`, `Q1`, `HCM`, `HN`, `Sài Gòn`, tiếng Anh `Ward 5, District 3`, tên cũ như `Quận 2`, `Quận 9`. |
| ⚠️ **Không đoán thầm** | Phường bị chia, tên trùng ở nhiều nơi, địa chỉ vừa giống cũ vừa giống mới → trả về `ambiguous` kèm mọi khả năng và lý do. |
| 📄 **Chuyển hàng loạt** | Đưa vào tệp CSV (giữ nguyên các cột, thêm cột kết quả) hoặc tệp văn bản; ~5.000 địa chỉ/giây. |
| 🗓️ **Cập nhật cả 2026** | Đồng Nai, Quảng Ninh, Bắc Ninh lên thành phố trực thuộc trung ương; 12 xã của Bắc Ninh lên phường (tới Nghị quyết 388/NQ-UBTVQH16). |

## 🚀 Tính năng

- **`convert`** — địa chỉ cũ → địa chỉ mới, giữ nguyên số nhà/tên đường; trả về mã phường/xã, mã bưu chính, đơn vị cũ đã nhận ra, độ tin cậy, các khả năng và cảnh báo.
- **`parse`** — tách địa chỉ tự do thành số nhà/đường, phường/xã, quận/huyện (địa chỉ cũ), tỉnh/thành; tự nhận địa chỉ đang theo kiểu cũ hay mới.
- **`search`** — tìm đơn vị theo tên (cũ, mới hoặc cả hai), lọc theo tỉnh.
- **`origins`** — phường/xã mới được hình thành từ những đơn vị cũ nào (có đánh dấu "một phần").
- **`provinces` / `wards`** — danh sách 34 tỉnh mới (kèm các tỉnh cũ đã gộp), 63 tỉnh cũ, phường/xã mới của một tỉnh.
- **Kiểm tra bằng dữ liệu thật**: tự sinh địa chỉ cho cả 10.035 phường/xã cũ theo 4 kiểu viết — nhận đúng 99,97% (kiểu đầy đủ, viết tắt, có số nhà) và 99,56% (không dấu, phần còn lại là tên trùng thật sự được báo `ambiguous`), không có kết quả sai.

## 📥 Cài đặt & sử dụng

Yêu cầu: [Node.js 18+](https://nodejs.org).

### 1. CLI — không cần cài

```bash
npx github:mahiepit/DiaChiMoi "12 nguyen hue, p ben nghe, q1, tphcm"
npx github:mahiepit/DiaChiMoi "P.5, Q.Gò Vấp, TP HCM" --json
npx github:mahiepit/DiaChiMoi parse "123 Trần Hưng Đạo, P. Nguyễn Cư Trinh, Q.1, TP. Hồ Chí Minh"
npx github:mahiepit/DiaChiMoi search "thao dien"
npx github:mahiepit/DiaChiMoi origins "Phường Sài Gòn"
npx github:mahiepit/DiaChiMoi provinces            # 34 tỉnh mới  (--old: 63 tỉnh cũ)
npx github:mahiepit/DiaChiMoi wards "Đà Nẵng"
```

Hoặc cài một lần: `npm install -g github:mahiepit/DiaChiMoi` rồi gõ `dia-chi-moi …` (hoặc `diachimoi …`).

**Chuyển hàng loạt** (CSV giữ nguyên các cột cũ, thêm `new_address, new_ward, new_province, new_ward_code, status, confidence, note`):

```bash
dia-chi-moi batch khach-hang.csv --column "dia_chi" --out khach-hang-moi.csv --bom   # --bom để Excel đọc đúng tiếng Việt
dia-chi-moi batch danh-sach.txt --json > ket-qua.jsonl                               # mỗi dòng một địa chỉ → JSON Lines
cat danh-sach.txt | dia-chi-moi batch -                                              # đọc từ stdin
```

Cột địa chỉ tự nhận nếu tên là `address`, `dia_chi`, `diachi`, `Địa chỉ`…; dấu phân cách `,` `;` hoặc tab đều được.

> Trên Windows PowerShell 5.1, nếu chữ tiếng Việt hiện sai trong cửa sổ dòng lệnh, chạy `chcp 65001` trước (tệp xuất ra luôn là UTF-8).

### 2. Thư viện Node.js

```bash
npm install github:mahiepit/DiaChiMoi
```

```js
import { convert, parse, search, wardOrigins, listProvinces } from 'dia-chi-moi';

const r = convert('144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội');
if (r.status === 'ok') {
  save(r.address);                       // địa chỉ mới đầy đủ
} else if (r.status === 'ambiguous') {
  review(r.candidates, r.warnings);      // cần người kiểm tra
}

convert({ street: '12 Nguyễn Huệ', ward: 'Bến Nghé', district: 'Quận 1', province: 'HCM' });
parse('F5 Q3 HCM');                      // { ward: Phường 5, district: Quận 3, province: TP.HCM, format: 'old', … }
search('ben nghe', { era: 'old' });      // [{ fullName: 'Phường Bến Nghé', newWards: ['Phường Sài Gòn, Thành phố Hồ Chí Minh'], … }]
```

Có sẵn kiểu TypeScript (`index.d.ts`). Ý nghĩa `status`:

| `status` | Nghĩa | Nên làm |
|---|---|---|
| `ok` | Một kết quả duy nhất | Dùng `address` |
| `ambiguous` | Nhiều khả năng: phường cũ bị chia (`SPLIT_WARD`), tên trùng (`AMBIGUOUS_INPUT`), vừa giống cũ vừa giống mới (`OLD_OR_NEW`) | Xem `candidates`, cần số nhà / quận huyện / người kiểm tra. Khi quá mơ hồ, `address` là `null` |
| `partial` | Chỉ xác định được tỉnh/thành (thiếu phường/xã) | `possibleWards` gợi ý các phường/xã mới của quận/huyện cũ |
| `not_found` | Không nhận ra đơn vị nào | Kiểm tra chính tả, thử `search` |

`confidence` (0–1) là điểm ước lượng để sắp xếp và lọc, không phải xác suất.

### 3. MCP server (Claude Code, Cursor, Claude Desktop…)

Claude Code:

```bash
claude mcp add dia-chi-moi -- npx -y github:mahiepit/DiaChiMoi mcp
# Windows (không dùng WSL):
claude mcp add dia-chi-moi -- cmd /c npx -y github:mahiepit/DiaChiMoi mcp
```

Claude Desktop (`claude_desktop_config.json`), Cursor (`.cursor/mcp.json`) và các ứng dụng MCP khác:

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

Nếu đã clone repo: `"command": "node", "args": ["/đường/dẫn/DiaChiMoi/bin/dia-chi-moi-mcp.mjs"]`.

Các công cụ: `convert_address` (1 địa chỉ hoặc tối đa 1.000), `parse_address`, `search_units`, `list_provinces`, `list_wards`, `ward_origins`. Server viết tay theo chuẩn MCP (JSON-RPC qua stdio), không cần SDK.

### 4. Agent skill / plugin Claude Code

```text
/plugin marketplace add mahiepit/DiaChiMoi
/plugin install dia-chi-moi@dia-chi-moi
```

Plugin gồm skill [`skills/dia-chi-moi`](skills/dia-chi-moi/SKILL.md) (hướng dẫn agent dùng CLI, đọc `status`, xử lý trường hợp mơ hồ) và tự đăng ký MCP server ở trên. Skill theo chuẩn mở [Agent Skills](https://agentskills.io), có thể chép thư mục `skills/dia-chi-moi` sang công cụ khác hỗ trợ skill.

## 🧪 Ví dụ (kết quả chạy thật)

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

Phường cũ bị chia cho nhiều phường mới — trả về mọi khả năng, không đoán thầm:

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

Tên trùng mà thiếu quận/tỉnh — không đưa ra địa chỉ nào:

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

Chuyển cả tệp CSV:

```text
$ dia-chi-moi batch khach-hang.csv --column dia_chi
ma_kh,ho_ten,dia_chi,new_address,new_ward,new_province,new_ward_code,status,confidence,note
1,Nguyễn Văn A,"12 Nguyễn Huệ, P. Bến Nghé, Q.1, TP.HCM","12 Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh",Phường Sài Gòn,Thành phố Hồ Chí Minh,26740,ok,1,
2,Trần Thị B,"Số 5 ngõ 10, Phường Phúc Xá, Quận Ba Đình, Hà Nội","Số 5 ngõ 10, Phường Hồng Hà, Thành phố Hà Nội",Phường Hồng Hà,Thành phố Hà Nội,00097,ok,1,
3,Lê Văn C,"144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội","144 Xuân Thủy, Phường Cầu Giấy, Thành phố Hà Nội",Phường Cầu Giấy,Thành phố Hà Nội,00166,ambiguous,0.6,"Phường Dịch Vọng Hậu, … được chia cho 2 đơn vị mới …"
Đã xử lý 3 địa chỉ: 2 OK, 1 cần kiểm tra, 0 chỉ có tỉnh/thành, 0 không tìm thấy.
```

Phường/xã mới gồm những đơn vị cũ nào:

```text
$ dia-chi-moi origins "Phường Sài Gòn"
Phường Sài Gòn, Thành phố Hồ Chí Minh (26740) được hình thành từ:
  - Phường Đa Kao, Quận 1, Thành phố Hồ Chí Minh (một phần)
  - Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh
  - Phường Nguyễn Thái Bình, Quận 1, Thành phố Hồ Chí Minh (một phần)
```

## 📚 Nguồn dữ liệu & độ chính xác

| Dữ liệu | Nguồn | Giấy phép |
|---|---|---|
| 34 tỉnh, 3.321 phường/xã/đặc khu hiện hành, mã đơn vị, mã bưu chính (bản v5.2.0, tới Nghị quyết 388/NQ-UBTVQH16, 20/09/2026) | [thanglequoc/vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database), lấy từ danh mục hành chính của Tổng cục Thống kê | MIT |
| Bảng chuyển 10.035 phường/xã cũ → mới, gợi ý mặc định cho phường bị chia, gần 2.000 tên phường/xã cũ trước các đợt sáp nhập | [tranngocminhhieu/vietnamadminunits](https://github.com/tranngocminhhieu/vietnamadminunits), tổng hợp từ danhmuchanhchinh.gso.gov.vn và sapnhap.bando.com.vn | MIT |

Chi tiết và bản quyền: [NOTICE.md](NOTICE.md). Các ví dụ trong bộ test đã được đối chiếu với mô tả sáp nhập chính thức trên [sapnhap.bando.com.vn](https://sapnhap.bando.com.vn).

> **⚠️ Lưu ý.** DiaChiMoi là công cụ hỗ trợ, không phải văn bản pháp lý. Dữ liệu có thể chậm hơn các nghị quyết mới nhất, và với phường/xã bị chia, kết quả phụ thuộc vào vị trí cụ thể của số nhà — gợi ý mặc định dựa trên vị trí trung tâm của phường cũ, **không** dựa trên số nhà. Với giấy tờ pháp lý (sổ đỏ, hợp đồng, hồ sơ hành chính), hãy đối chiếu với nghị quyết của Ủy ban Thường vụ Quốc hội, [sapnhap.bando.com.vn](https://sapnhap.bando.com.vn), [danhmuchanhchinh.nso.gov.vn](https://danhmuchanhchinh.nso.gov.vn) hoặc chính quyền địa phương.

Giới hạn đã biết:
- Chỉ nhận đơn vị hành chính; không kiểm tra số nhà, tên đường có tồn tại hay không.
- Địa chỉ phải theo thứ tự thông thường (nhỏ → lớn: số nhà, phường, quận, tỉnh). Thứ tự đảo ngược chưa được hỗ trợ.
- Tên đơn vị cũ trước năm 2025 chỉ được hiểu nếu có trong bảng tên cũ (gần 2.000 tên); địa chỉ rất cũ (trước các đợt sáp nhập 2019–2024) có thể không nhận ra.

## 🧩 Cách hoạt động

```
"12 nguyen hue, p ben nghe, q1, tphcm"
   │  tách từ (giữ vị trí ký tự, phân đoạn theo dấu phẩy), bỏ dấu, tách "q1" → q 1
   ▼
 khớp từ phải sang trái:  tỉnh/thành  →  quận/huyện (chỉ địa chỉ cũ)  →  phường/xã
   │  mỗi cấp có thể có nhiều cách hiểu → chấm điểm (tiền tố, dấu, vị trí, tên cũ, sai chính tả)
   ▼
 các cách hiểu điểm cao nhất ──► bảng chuyển cũ → mới ──► gộp kết quả trùng
   │
   ▼
 ok | ambiguous | partial | not_found  + địa chỉ mới, mã, độ tin cậy, các khả năng, cảnh báo
```

```
src/normalize.mjs   bỏ dấu, khoá so khớp, chữ ký dấu (phân biệt "Phú"/"Phụ"), khoảng cách sửa chuỗi
src/data.mjs        nạp data/diachimoi.json, dựng chỉ mục
src/parse.mjs       tách địa chỉ, sinh và chấm điểm các cách hiểu
src/convert.mjs     chuyển sang đơn vị mới, xử lý phường bị chia / tên trùng
src/search.mjs      tìm kiếm, danh sách, nguồn gốc phường mới
src/cli.mjs         CLI          src/mcp.mjs   MCP server (stdio)
scripts/build-data.mjs     dựng lại dữ liệu từ 2 bộ dữ liệu gốc
scripts/eval-roundtrip.mjs tự kiểm tra trên toàn bộ 10.035 phường/xã cũ
```

## 🔁 Dự án tương tự

- [vietnamadminunits](https://github.com/tranngocminhhieu/vietnamadminunits) (Python, MIT) — thư viện Python tách và chuyển địa chỉ, hỗ trợ pandas. DiaChiMoi dùng bảng chuyển của dự án này.
- [vietnam-address-converter](https://github.com/quangtam/vietnam-address-converter) (JavaScript/TypeScript, MIT) — thư viện npm chuyển địa chỉ cũ sang mới.
- [vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database) (MIT) — cơ sở dữ liệu SQL/JSON đơn vị hành chính hiện hành.
- [sapnhap.bando.com.vn](https://sapnhap.bando.com.vn) — trang tra cứu chính thức.

Điểm khác của DiaChiMoi: MCP server + agent skill/plugin để AI agent dùng trực tiếp, báo rõ trường hợp mơ hồ thay vì đoán, CLI chuyển cả tệp CSV, cập nhật tới các thay đổi năm 2026, không phụ thuộc thư viện nào.

## 🤝 Đóng góp

Rất hoan nghênh báo lỗi và pull request, nhất là các địa chỉ thật bị chuyển sai (kèm nguồn đối chiếu).

```bash
git clone https://github.com/mahiepit/DiaChiMoi.git
cd DiaChiMoi
npm test                               # node --test, không cần cài gì
node scripts/eval-roundtrip.mjs        # tự kiểm tra trên toàn bộ phường/xã cũ
```

Cập nhật dữ liệu khi có nghị quyết mới: clone hai bộ dữ liệu gốc rồi chạy `node scripts/build-data.mjs <vietnamadminunits> <vietnamese-provinces-database>`, chạy lại test và ghi nguồn vào NOTICE.md.

## ❤️ Ủng hộ dự án

DiaChiMoi miễn phí và sẽ luôn miễn phí. Nếu nó giúp bạn tiết kiệm thời gian, một khoản ủng hộ nhỏ giúp dự án được duy trì. Cảm ơn bạn!

<table>
<tr>
<td align="center"><b>PayPal</b><br><img src="docs/img/donate-paypal.svg" width="180" alt="PayPal QR"><br><a href="https://paypal.me/thaogia">paypal.me/thaogia</a></td>
<td align="center"><b>BNB (BEP-20) / ETH (ERC-20)</b><br><img src="docs/img/donate-crypto.svg" width="180" alt="BNB / ETH QR"><br><code>0xd09c2E60cbC8526976C436e316630FA64296E824</code></td>
</tr>
</table>

Hãy kiểm tra đúng mạng (BNB Smart Chain hoặc Ethereum) trước khi gửi tiền mã hoá.

## 📄 Giấy phép

[MIT](LICENSE) © Thảo Gia. Dữ liệu đóng gói lấy từ các bộ dữ liệu mở giấy phép MIT, liệt kê trong [NOTICE.md](NOTICE.md).
DiaChiMoi là dự án độc lập, không liên quan tới cơ quan nhà nước nào.
