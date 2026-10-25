# Hero 3D — bike + rider (tiến trình)

Vật thể chính của Bike Rush: xe supersport + người lái, dựng hoàn toàn bằng code Three.js
(không cần file .glb). Ảnh mẫu: `docs/hero-3d/reference-sheet.jpg`.

## File

| File | Vai trò |
|---|---|
| `src/render/BikeRiderAsset.ts` | Lắp ráp rig (pivot nghiêng/chúi, khung xương 18 xương), vật liệu, tư thế + IK tay/chân |
| `src/render/BikeBody.ts` | Thân xe mới theo ảnh mẫu: ốp có cạnh gấp, livery texture, bánh, phuộc, đĩa, ống xả… |
| `src/render/RiderHuman.ts` | Người lái liền khối, da uốn mềm qua khớp, phối màu theo ảnh mẫu |
| `src/render/Vehicle.ts` | Điều khiển xe trong game (giữ nguyên, chỉ dời điểm phát hiệu ứng) |
| `tools/hero-viewer/` | Trang xem 3D: tư thế, góc camera, wireframe, số tam giác (`npm run build:hero-viewer` → `builds/hero-viewer.html`) |

Pivot giữ nguyên so với bản trước: SteeringPivot (0, 0.74, −0.52), trục trước (0, 0.31, −0.71),
trục sau (0, 0.33, 0.71), tay lái ≈ (±0.265, 0.80, −0.435), gác chân (±0.215, 0.445, 0.16).
Không gian chassis: mặt đất y = 0, phía trước = −Z, bên phải = +X.

## Các vòng chỉnh (2026-10-25)

1. **Bản gốc (zip 24/10)** — xe "tương lai" ghép từ khối, người lái kiểu robot
   (`01-original-previews.jpg`, `02-robot-rider-closeups.jpg`). Đổi màu xe trong garage chỉ đổi đèn gầm.
2. **Người lái liền khối** — thân/tay/chân là bề mặt loft liên tục, trọng số da nhiều xương,
   mũ bo tròn (`03-organic-rider.jpg`). Khung xương + IK giữ nguyên.
3. **Thân xe theo ảnh mẫu** — dựng lại toàn bộ xe supersport; livery vẽ lên canvas atlas và
   chiếu ngang để cạnh vạch sắc (`04-reference-vs-smooth-body.jpg`).
4. **Cạnh gấp + sửa cúi thấp** — tiết diện đa giác + normal gãy góc cho đầu xe, ốp sườn,
   bình xăng, đuôi; mũ thêm cằm + đèn cyan; cổ/đầu tự cân theo độ gập thân nên LowTuck
   không còn chìm đầu vào bình xăng (`05-reference-vs-faceted-body.jpg`, `06-lowtuck-fixed.jpg`).

Số tam giác hiện tại ≈ 47k (xe + người lái).

## Còn lại / bước tiếp

- 7 màu xe trong garage đổi màu thật (livery atlas + vertex color người lái), hiện chỉ đổi đèn gầm.
- Thêm tầng gấp cho ốp xe, lộ động cơ/xích/nhông rõ hơn, mũ thon có khe gió, giáp tay chân nhiều mảnh.
- Giảm tam giác nếu cần cho máy yếu.
- Muốn chất lượng như ảnh mẫu 100%: dựng mô hình Blender (.glb) và nối vào `Vehicle.useModel`.
