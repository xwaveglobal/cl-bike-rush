# Bộ ảnh turnaround — người lái + mũ (Bike Rush hero 3D)

Mục đích: có ảnh mẫu **cùng tỉ lệ, cùng tư thế, không phối cảnh** cho từng hướng, để chỉnh dáng
người (vai, lưng, đùi) và mũ bảo hiểm bằng số đo thật, thay vì đoán từ ảnh mẫu gốc (mỗi góc lệch
phối cảnh một kiểu).

## Có gì trong thư mục này

| File | Nội dung |
|---|---|
| `TURNAROUND_full.jpg` | 6 góc người lái + xe từ bản 3D hiện tại (ngang trái, ngang phải, trước, sau, trên, 3/4), lưới 10 cm / 50 cm, 1 m = 454 px |
| `TURNAROUND_helmet.jpg` | 4 góc mũ (trước, ngang, sau, trên), lưới 1 cm / 5 cm, 1 cm = 32 px |
| `renders/*_clean.jpg` | từng góc, không lưới — dùng làm **ảnh khung** (img2img / pose guide) |
| `renders/*_grid.jpg` | từng góc, có lưới — để đo |
| `renders/turn.cjs`, `renders/sheet.py` | script render lại (Playwright + viewer) và ghép tấm |

Camera gần trực giao (fov 9°, cách 14 m; mũ: fov 6°, cách 3 m), tư thế `StraightRide`.

## Ảnh cần làm (thứ tự ưu tiên)

1. **Người lái ngang trái** (`full_left`) — quan trọng nhất: dáng lưng, vai, tay, đùi, gối.
2. **Người lái sau** (`full_rear`) — tấm V lưng, độ rộng vai, dải xanh sườn.
3. **Mũ ngang** (`helmet_left`) — đường dải bạc, cằm, đuôi gió.
4. **Mũ trước** (`helmet_front`) và **mũ sau** (`helmet_rear`).
5. Người lái trước, trên xuống (nếu có thời gian).

## Quy tắc để ảnh dùng được

- Giữ **đúng khung và tỉ lệ** của ảnh `_clean` tương ứng: cùng kích thước 1384×1000, người/xe nằm
  đúng chỗ (dùng ảnh `_clean` làm ảnh đầu vào img2img hoặc ControlNet depth/lineart, strength
  khoảng 0.45–0.6).
- **Không phối cảnh**: nhìn thẳng góc, không nghiêng camera, không ống kính góc rộng.
- Nền xám nhạt trơn, ánh sáng studio đều, không bóng đổ gắt, không hiệu ứng tốc độ.
- Cùng một bộ đồ / một mũ ở mọi góc (màu đen – bạc – xanh cobalt, đèn cyan), theo
  `../../hero-3d/master` và ảnh mẫu gốc.
- Xuất PNG ≥ 1384 px chiều ngang. Đặt tên giữ nguyên tên góc, ví dụ `ref_full_left.png`.

## Prompt gợi ý (công cụ tạo ảnh AI, dùng kèm ảnh `_clean` + ảnh mẫu gốc làm style reference)

Người lái (đổi `left side view` theo góc):

```
orthographic left side view, technical turnaround reference sheet, motorcycle racer in full
riding tuck on a silver-black-blue supersport bike, black leather race suit with silver armour
plates and cobalt blue panels, silver V-shaped back protector, silver shoulder caps, silver
forearm guards, black elbow pads, silver knee sliders, blue race boots, black full-face helmet
with silver crown stripe, wide silver side swoosh, cyan LED brow light, smoked visor,
neutral light grey studio background, even soft lighting, no perspective distortion,
no motion blur, high detail, product render
```

Mũ (đổi `front view` theo góc):

```
orthographic front view, helmet design turnaround, black full-face motorcycle race helmet,
wide silver crown panel with thin blue edge lines, blue V lines on the forehead, wide silver
side swoosh from chin to rear with blue underline, smoked black visor with blue rim and silver
top trim, cyan LED bar at the top of the visor and angled cyan marks at the visor corners,
two cyan LED bars on the back, small rear spoiler, neutral light grey background,
studio lighting, no perspective, high detail
```

Negative: `perspective, fisheye, motion blur, background scenery, extra limbs, text, watermark`

## Sau khi có ảnh

Bỏ ảnh vào `docs/hero-3d/turnaround/ref/` (hoặc gửi trong chat). Mình sẽ đặt từng ảnh chồng lên
render cùng góc (cùng khung nên khớp pixel), đo chênh lệch rồi chỉnh tỉ lệ thân, tư thế và mũ.
