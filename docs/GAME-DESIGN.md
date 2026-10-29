# Sky Roadster v2 — thiết kế đã chốt (2026-10-22)

> Tài liệu này **thay thế** `docs/ECONOMY.md` (v1). Mọi thay đổi gameplay / meta từ đây phải theo file này.
> Owner chốt qua chat ngày 2026-10-21/22. Nếu cần đổi → cập nhật file này trước rồi mới code.

## 0. Một câu
**EXP là trình độ của bạn (để khoe hạng), Coin là tiền duy nhất (để đổi vật phẩm special).**
Không có gì khác để tích luỹ.

---

## 1. EXP & hạng

- **EXP của 1 lượt** = quãng đường đi được × hệ số độ khó (Easy / Normal / Hard), tính liên tục trên HUD.
- **EXP của người chơi** = lượt tốt nhất từ trước tới nay (KHÔNG cộng dồn). Đây là số hiện ở profile, bảng xếp hạng.
- Hạng = mốc EXP: **D → C → B → A → AA → AAA**. Đường đua mở khoá ở AAA có thêm hạng **S → SS → SSS**.
- Logo hạng: khiên có chữ hạng ở giữa, mỗi hạng một màu (không dùng icon ngôi sao nữa).
- Tiền thật **không** mua được EXP (không gói nào, không vật phẩm nào cộng EXP).

### Nhịp lên hạng (thời gian chạy liên tục trong 1 lượt)

| Hạng | Hard | Normal | Easy |
|---|---|---|---|
| D | bắt đầu | | |
| C | 3 phút | 6 phút | 9 phút |
| B | 7 phút | 14 phút | 21 phút |
| A | 12 phút | 24 phút | 36 phút |
| AA | 20 phút | 40 phút | 60 phút |
| AAA | 30 phút | 60 phút | 90 phút |

- Giữ đúng tỉ lệ **thời gian**: Normal chậm ×2, Easy chậm ×3 so với Hard. Vì Easy/Normal chạy chậm hơn, hệ số EXP thực tế ≈ Easy ×1 · Normal ×1.2 · Hard ×2 (hiệu chỉnh bằng mô phỏng cho khớp số phút).
- Ngưỡng EXP (`EXP.rank` trong `config.ts`, đã tính bằng mô phỏng): C 3.000 · B 8.000 · A 15.000 · AA 26.000 · AAA 40.000.
- Tốc độ đường tăng theo giai đoạn: B +3 %, A +6 %, AA +10 %, AAA +14 % (đã tính vào ngưỡng EXP).
- Thử nhanh: thêm `?rank=B` (C/B/A/AA/AAA) vào link để vào Endless ngay trước Cổng hạng đó (lượt này không lưu EXP).

### Chiến thuật tăng độ khó (rõ nét theo từng giai đoạn)

Độ khó tăng theo **quãng đường**, mỗi giai đoạn có "chữ ký" riêng để người chơi cảm nhận được mình đã lên level:

| Giai đoạn | Chướng ngại đặc trưng | Nhịp |
|---|---|---|
| D → C | 1 vật cản / hàng, khoảng trống rộng, học trái/phải/lên/xuống | thưa |
| C → B | khối chặn 2 làn, vật cản trên cao / dưới thấp đầu tiên | vừa |
| B → A | combo 3 hàng liên tiếp, tường đổi làn, đường hầm | dày |
| A → AA | chỉ còn 1 làn an toàn, cổng trượt, tốc độ tăng rõ | rất dày |
| AA → AAA | chuỗi nhịp (rhythm) nhanh, cửa phản xạ sát giới hạn công bằng | tối đa |

- **Cổng hạng**: ~30 giây ngay trước mỗi mốc là đoạn khó nhất của giai đoạn đó, có thông báo trước ("CỔNG HẠNG B"). Máy sắp xếp, nhưng luôn có đường thoát (luật Fairness trong `ObstacleRules.ts` / spawner vẫn áp dụng).
- Trên đường EXP **không có chướng ngại nào bắt buộc phải dùng vật phẩm** mới qua được — tất cả qua được bằng tay nghề.

---

## 2. Đường đua

| Đường | Mở khoá | Ghi chú |
|---|---|---|
| **Endless** | mở sẵn | đường EXP chính, D → AAA |
| **Đường 2 · Mega Rush** | đạt **AAA** | bắt đầu khó hơn 2 giai đoạn, EXP ×1,25, hạng S 65.000 / SS 85.000 / SSS 110.000. Trước khi mở: hiện mờ + "Đạt AAA để mở" |
| Đường 3, 4, 5 | — | chỉ hiện tên + ảnh mờ + "Sắp mở" để gây tò mò |
| **Bonus** (sự kiện) | mở theo giờ | xem mục 5 |

Bỏ toàn bộ 20 đường cũ, sao ★ của đường, mở đường bằng điểm.

---

## 3. Xe

- Mở **chỉ bằng hạng** (không mua bằng coin): D Zenith · B Volt · A Phantom · AA Inferno · AAA Nexus.
- Mỗi xe ngoại hình khác hẳn (owner gửi ảnh sau lưng từng xe). Xe là để khoe, **không cộng sức mạnh** (EXP phải công bằng).
- Xe chưa mở: xe kế tiếp hiện màu + khoá, các xe sau là bóng đen.

---

## 4. Coin

### Kiếm
| Nguồn | Mức |
|---|---|
| Nhặt coin trên Endless | ~40 coin / phút |
| Bonus (5 phút, 1 lần/đợt) | ~800 coin |
| Nhiệm vụ ngày (Daily + Mission gộp chung) | ~600 coin / ngày |
| Điểm danh 7 ngày | tăng dần, ngày 7 lớn nhất |

### Tiêu — chỉ một việc: đổi vật phẩm special
| Special | Tác dụng | Giá |
|---|---|---|
| SOS | thoát hiểm tức thì khi sắp đâm | 2.000 |
| Roadster | nhảy qua cả cụm chướng ngại | 3.000 |
| HYPER | bay xa qua một đoạn dài | 6.000 |

- Special **không nhặt được** trên đường EXP; phải đổi bằng coin và trang bị trước khi đua.
- **Mỗi lượt chỉ mang 1 special.** Khi bấm vào đường đua → popup chọn special (hoặc "Không dùng").
- Người chơi mới được tặng **1 Roadster**.
- **Hết special trong túi Magic** → ô special đó (trong túi và trong popup chọn trước khi đua) hiện chỉ dẫn rõ: "Hết — đổi bằng coin" + giá + nút **Mua**. Ghi rõ luật ngay tại đó:
  - **Mua bao nhiêu cũng được, cất vào túi Magic** (để dành dùng dần).
  - **Mỗi lượt đua chỉ dùng được 1 cái.**
  - Không đủ coin → nút dẫn sang Shop mua coin.
- **Special chưa mở** (hiện tên + ảnh, làm mờ, "Mở ở hạng AAA") để gây hấp dẫn, ví dụ:
  - **Tunnel Rider** — vào đường hầm thì xe chạy trên nóc hầm
  - **Wall Run** — chạy dọc thành đường vượt cả hàng chướng ngại
  - **Phase Ghost** — xuyên qua vật cản vài giây
  - **Sky Rail** — bám ray trên cao lướt qua cả đoạn
- Coin **không** dùng để hồi sinh.

### Shop tiền thật — chỉ bán coin (+ Xoá quảng cáo)
| Gói | Giá |
|---|---|
| 1.000 coin | 0,99 USD |
| 6.000 coin | 4,99 USD |
| 13.000 coin | 9,99 USD |
| 30.000 coin | 19,99 USD |
| Xoá quảng cáo cuối lượt | 2,99 USD |

Bỏ: XWAVE Pass, Starter Pack, mọi bundle.

---

## 5. Bonus (thay CUP)

- Mở **mỗi 2 tiếng**, mỗi lần mở 60 phút. Không có cup 1/2/3, không thứ hạng, không EXP — **chỉ để lấy coin**.
- Mỗi lần là một **đường mới hoàn toàn**, bối cảnh gần đời sống, xoay vòng: sa mạc → rừng → đồng quê → biển.
- Giới hạn **5 phút**, chơi **1 lần** mỗi đợt, có vạch **Finish** (về đích thưởng lớn). Có đoạn đường hầm.
- Item thường xuất hiện như bình thường; special chỉ **thỉnh thoảng** rơi ra. Ăn special → ngay sau đó mới sinh ra tình huống riêng của nó (dàn xe, đoàn xe, hàng rào laser, đường hầm…) và special **tự kích hoạt** vượt qua, kể cả các special chưa mở (Tunnel Rider chỉ ở bàn có hầm).
- Special nhặt trong Bonus **không** vào túi, chỉ dùng trong đường đó.

---

## 6. Chết, hồi sinh, quảng cáo

- Mỗi lượt **tối đa 2 lần hồi sinh**, chỉ bằng **xem quảng cáo (rewarded)**.
- Popup hồi sinh ghi rõ: "Còn N lần hồi sinh. Lần chết thứ 3 sẽ về điểm Start."
- Chết lần 3 (hoặc không hồi sinh) → lượt kết thúc, EXP của lượt được ghi nhận (nếu cao hơn kỷ lục thì cập nhật hạng), hiện **quảng cáo cuối lượt (interstitial)**, rồi về Start.
- Gói **Xoá quảng cáo** bỏ quảng cáo cuối lượt; quảng cáo hồi sinh vẫn là lựa chọn tự nguyện.

---

## 7. Các phần khác

- **Training**: lần đầu bấm Play tự vào ~60 giây hướng dẫn ngay trên Endless: vuốt trái/phải → lên → xuống → nhặt coin → dùng Roadster được tặng → giải thích thanh EXP & hạng. Bỏ training theo đường đua cũ.
- **Bảng xếp hạng**: chỉ xếp theo EXP. Tab Thế giới / Quốc gia.
- **Profile**: avatar + logo hạng + EXP cao nhất + thanh tiến độ tới hạng kế + túi special.
- **Nhiệm vụ ngày**: Daily + Mission gộp thành một danh sách, chủ yếu thưởng coin.

### Tài khoản & lưu đám mây (v2.3)
- Mỗi máy là tài khoản khách từ lần mở đầu. Đăng nhập Google / Apple / mã email → tiến trình theo tài khoản, cài lại hoặc đổi máy đăng nhập lại là có đủ.
- Máy mới đăng nhập: tự lấy bản đám mây. Máy đã có tiến trình riêng: hỏi giữ bản nào.
- EXP / hạng do server xác minh (tính lại từ quãng đường từng lượt); sửa save không tăng được hạng.

### Bỏ khỏi game
rank stars / bolts / X-points · sao ★ đường đua · 20 đường cũ · cup, trophy, division · mission rank · nâng cấp xe (Engine/Shield/Magnet) · mua xe bằng coin · item thường trong kho (Turbo, Magnet, ×2, Shield, Life) · hồi sinh bằng coin · XWAVE Pass / bundle / Starter Pack.

(Turbo / Magnet / Shield / ×2 coin **vẫn có thể là pickup nhặt trên đường** — dùng ngay, không cất kho.)

### Chuyển save cũ
- Coin: giữ nguyên.
- Roadster / HYPER / SOS trong kho: giữ nguyên.
- Item thường: quy ra coin theo giá cũ.
- Hạng: về D (EXP đo lại từ lượt đầu tiên v2).
- Xe đã mua: giữ nguyên.

---

## 8. Kế hoạch code (mỗi bước đều chơi được trên `main`) — ĐÃ XONG v2.0.1 → v2.0.8

1. **EXP & hạng**: `RANK_EXP`, EXP trên HUD, logo hạng, profile, bảng xếp hạng EXP, chuyển save.
2. **Độ khó theo giai đoạn + Cổng hạng**: spawner theo quãng đường, test công bằng cho từng giai đoạn, mô phỏng số phút.
3. **Đường đua & xe**: màn chọn đường (Endless + Đường 2 khoá AAA + 3 đường "Sắp mở"), xe mở theo hạng.
4. **Special & coin**: popup chọn 1 special, special khoá AAA (mờ), shop chỉ coin, bỏ các hệ cũ.
5. **Hồi sinh & quảng cáo**: tối đa 2 lần qua ads, quảng cáo cuối lượt, Xoá quảng cáo.
6. **Training mới**.
7. **Bonus**: đường sa mạc đầu tiên, finish 30 phút, special tự dùng (Tunnel Rider, Wall Run…), lịch 2 tiếng.
8. **Nhiệm vụ ngày gộp**, cân lại coin.
