# UI — Layout 3 cột (filter trái / kết quả giữa / filter phải)

Tài liệu ghi lại quyết định thiết kế để implement sau (SPA gọi Nest API hiện tại).

## Mục tiêu

- Kiểu **công cụ / data-dense** (admin-style), không phải gallery thẻ làm trọng tâm.
- **Hai cột hai bên** = hai nhóm điều kiện **độc lập**; **giữa** = kết quả thỏa **cả hai** (AND).
- **Trái:** thông số “cứng” của monster — ít chữ, chủ yếu chọn nhanh / khoảng số.
- **Phải:** tìm kiếm liên quan **active skill / leader skill** — nội dung dài, đặt đúng chỗ để ô search / debounce thoải mái.

## Bố cục

```
+------------------+------------------------+------------------+
| Filter monster   |  Danh sách + detail    | Filter skill     |
| (stats, attr,    |  (cards hoặc table)    | (text search trên|
|  rarity, …)      |                        |  mô tả skill)    |
+------------------+------------------------+------------------+
```

### Cột trái — monster “cơ bản”

- **Rarity** — multi-select hoặc checkbox theo tier.
- **Attribute** — `attribute_1_id` / `attribute_2_id` / `attribute_3_id` (chọn thuộc tính; tuỳ UX: “ít nhất một khớp” hoặc “khớp slot 1”).
- **Stats** — khoảng **HP / ATK / RCV** min–max (slider hoặc ô số), map tới `hp_max`, `atk_max`, `rcv_max` trong payload `source-records`.
- (Tuỳ chọn) ô tìm nhanh **`monster_id`** hoặc **`monster_no_na`** (số hiển thị NA).

### Cột phải — active / leader skill (nhiều chữ)

- **Tìm kiếm text** trên **`active_skill_desc_en`** (substring hoặc full-text sau này).
- **Tìm kiếm text** trên **`leader_skill_desc_en`**.
- UX gợi ý: hai ô riêng, hoặc một ô + toggle “chỉ active / chỉ leader / cả hai”.
- **Debounce** gõ (vd 300–500 ms) để tránh gọi API/filter lặp.

### Cột giữa — kết quả & chi tiết

- **Danh sách** monster thỏa **filter trái AND filter phải**.
- Click một dòng → **detail card** / panel: toàn bộ field đang có trong row (sau whitelist) + có thể gọi thêm **`GET /pad-categorized`** theo `sourceTable` + `sourceRowId` (= `monster_id` trong cấu hình hiện tại) để hiển thị category / `summary_json`.

## Gắn với API backend (hiện trạng)

| API | Vai trò trong UI |
|-----|------------------|
| `GET /source-records?limit=&offset=` | Nguồn row đã join + whitelist; client có thể lọc thêm theo filter hai bên (hoặc fetch theo chunk). |
| `GET /pad-categorized?sourceTable=&…` | Bổ sung lớp categorize sau khi chọn monster (hoặc để filter category nếu đưa filter category lên phải/trái sau). |
| `GET /health` | Kiểm tra backend sống. |
| `GET /awoken-skills` | **Không** nằm trong luồng chính layout A này; có thể tab / route riêng sau. |

**Lưu ý triển khai:** hiện backend chưa có query params lọc SQL cho mọi field; bản MVP có thể **tải trang + lọc client** hoặc sau này thêm endpoint search/filter server-side để giảm payload.

## Stack UI (gợi ý, chưa bắt buộc)

- Vite + React + TanStack Query; UI kit kiểu **shadcn/ui** + Tailwind.
- Responsive: trên mặt hình nhỏ có thể **collapse** hai panel filter thành drawer / accordion; giữ cột giữa ưu tiên.

## Phiên bản

- **2026-05-09:** Ghi nhận layout A, tách trái = stats/attr/rarity, phải = skill text search.
