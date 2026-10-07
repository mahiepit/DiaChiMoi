---
name: dia-chi-moi
description: Chuyển địa chỉ Việt Nam cũ (63 tỉnh, tỉnh/huyện/xã) sang địa chỉ mới sau sáp nhập 2025 (34 tỉnh, tỉnh/xã); hiểu địa chỉ có/không dấu, viết tắt (P., Q., TP., HCM); tra phường/xã mới gồm đơn vị cũ nào. Dùng khi người dùng nhờ đổi địa chỉ theo đơn vị hành chính mới, hỏi "phường X giờ thuộc phường nào", làm sạch cột địa chỉ CSV/Excel, hoặc hỏi về sáp nhập 2025. Convert old Vietnamese addresses to the 2025 units.
license: MIT
metadata:
  version: "1.0.0"
  author: Thảo Gia
  homepage: https://github.com/mahiepit/DiaChiMoi
---

# Địa Chỉ Mới

Từ 01/07/2025 Việt Nam còn 34 tỉnh/thành, bỏ cấp quận/huyện, nhiều phường/xã được nhập hoặc chia lại. Skill này dùng công cụ **DiaChiMoi** (dữ liệu offline, kèm sẵn) để chuyển địa chỉ cũ sang mới. **Đừng tự đoán từ trí nhớ** — tên đơn vị mới rất dễ nhầm; luôn chạy công cụ.

## Chọn cách chạy

1. Nếu có công cụ MCP `convert_address`, `parse_address`, `search_units`, `list_provinces`, `list_wards`, `ward_origins` (server `dia-chi-moi`) thì dùng chúng.
2. Nếu không, chạy CLI (cần Node.js 18+). Trong thư mục repo/plugin:
   ```bash
   node <thư-mục-skill>/../../bin/dia-chi-moi.mjs "<địa chỉ>" --json
   ```
   Hoặc ở bất kỳ đâu (cần mạng lần đầu):
   ```bash
   npx -y github:mahiepit/DiaChiMoi "<địa chỉ>" --json
   ```

## Lệnh CLI

| Việc | Lệnh |
|---|---|
| Chuyển 1 hoặc vài địa chỉ | `dia-chi-moi "12 Nguyễn Huệ, P. Bến Nghé, Q.1, TP.HCM" --json` |
| Tách địa chỉ | `dia-chi-moi parse "<địa chỉ>" --json` |
| Chuyển cả tệp CSV (giữ cột cũ, thêm cột kết quả) | `dia-chi-moi batch khach-hang.csv --column "Địa chỉ" --out ket-qua.csv --bom` |
| Tệp văn bản, mỗi dòng 1 địa chỉ | `dia-chi-moi batch ds.txt --json` (JSON Lines) hoặc bỏ `--json` để ra CSV |
| Tìm đơn vị | `dia-chi-moi search "ben nghe" --era old --json` |
| Phường/xã mới gồm những đơn vị cũ nào | `dia-chi-moi origins "Phường Sài Gòn" --json` |
| Danh sách tỉnh mới / cũ | `dia-chi-moi provinces --json` · `dia-chi-moi provinces --old --json` |
| Phường/xã mới của 1 tỉnh | `dia-chi-moi wards "Đà Nẵng" --json` |

Với nhiều địa chỉ, ghi ra tệp rồi dùng `batch` — đừng gọi từng địa chỉ một.

## Đọc kết quả `convert`

Luôn xem trường `status` trước:

- `ok` — kết quả duy nhất. Dùng `address` (địa chỉ mới đầy đủ), `ward`, `province` (kèm mã đơn vị, mã bưu chính).
- `ambiguous` — có nhiều khả năng. Lý do nằm trong `warnings`:
  - `SPLIT_WARD`: phường/xã cũ bị chia cho nhiều đơn vị mới; kết quả phụ thuộc số nhà/tên đường. Đưa **tất cả** `candidates` cho người dùng, nói rõ kết quả đầu chỉ là gợi ý, đề nghị họ kiểm tra theo số nhà trên sapnhap.bando.com.vn hoặc với chính quyền địa phương.
  - `AMBIGUOUS_INPUT`: tên trùng ở nhiều nơi (vd "Phường 1" không kèm quận/tỉnh). Hỏi thêm quận/huyện hoặc tỉnh. Khi đó `address` là `null`.
  - `OLD_OR_NEW`: tên vừa khớp đơn vị cũ vừa khớp đơn vị mới. Hỏi người dùng địa chỉ đang theo cách cũ hay mới.
- `partial` — chỉ xác định được tỉnh/thành (thiếu phường/xã). `possibleWards` liệt kê các phường/xã mới mà quận/huyện cũ đã chia vào.
- `not_found` — không nhận ra đơn vị nào; kiểm tra chính tả hoặc dùng `search`.

Các cảnh báo khác: `FUZZY_MATCH` (đoán theo chính tả gần đúng — nói lại cho người dùng xác nhận), `HISTORICAL_NAME` (tên trước các đợt sáp nhập cũ, vd Quận 2/Quận 9 → TP Thủ Đức), `ALREADY_NEW` (địa chỉ đã ở dạng mới).

`confidence` là điểm ước lượng 0–1, không phải xác suất pháp lý.

## Cách trả lời

- Trình bày: địa chỉ mới, (dòng nhỏ) đơn vị cũ đã nhận ra, và mọi cảnh báo quan trọng. Giữ nguyên phần số nhà/tên đường như người dùng viết.
- Không bao giờ chọn hộ một khả năng khi `status` là `ambiguous` mà không nói rõ.
- Với hồ sơ pháp lý (sổ đỏ, hợp đồng, giấy tờ tuỳ thân), nhắc người dùng đối chiếu với nguồn chính thức: nghị quyết của Uỷ ban Thường vụ Quốc hội về sắp xếp đơn vị hành chính cấp xã năm 2025, sapnhap.bando.com.vn, danhmuchanhchinh.gso.gov.vn.

## Ví dụ

```text
$ dia-chi-moi "Số 12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM"
✔ Số 12 Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh
  Cũ: Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh
```

```text
$ dia-chi-moi "144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội"
⚠ 144 Xuân Thủy, Phường Cầu Giấy, Thành phố Hà Nội
  Các khả năng:
   1. 144 Xuân Thủy, Phường Cầu Giấy, Thành phố Hà Nội (60%)
   2. 144 Xuân Thủy, Phường Nghĩa Đô, Thành phố Hà Nội (40%)
  ! Phường Dịch Vọng Hậu … được chia cho 2 đơn vị mới …
```
Ở ví dụ thứ hai, trả lời: "Phường Dịch Vọng Hậu cũ được chia cho Phường Cầu Giấy và Phường Nghĩa Đô. Công cụ gợi ý mặc định Phường Cầu Giấy (dựa trên vị trí trung tâm của phường cũ, không dựa trên số nhà), nên bạn cần kiểm tra lại số 144 Xuân Thủy thuộc phường nào."

Gợi ý mặc định khi phường bị chia lấy từ bộ dữ liệu (phường mới chứa hoặc gần tâm phường cũ nhất) — không phải tra theo số nhà.
