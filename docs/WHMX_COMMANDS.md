# WHMX — Lệnh hữu dụng (theo quy trình)

> Cập nhật 2026-09-29. Thay cho phần lệnh trong `../WHMX_COMMAND_CHEATSHEET.md` (bản 2026-09-15 của owner, vẫn giữ
> để tra chi tiết: `adb` thủ công, đọc manifest, grep…). Nguồn: `NeoArtifacts.py --help`, runbook N2
> (`plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md` §4), `NeoArtifacts/RUNTIME_UPDATE_CAPTURE_RUNBOOK.md`, file trạng thái.
>
> - Lệnh viết cho **Git Bash**. Khối nào ghi *PowerShell* thì chạy trong PowerShell.
> - ⚠️ = ghi dữ liệu thật (DB production, R2, workbook, deploy) → chạy bản xem trước (`--plan` / `--dry-run` / `--check`) trước.
> - Không nhớ option: `python NeoArtifacts.py <lệnh> --help`, `python tools/<tool>.py --help`.

---

## 0. Biến dùng chung (dán một lần mỗi cửa sổ Git Bash)

```bash
WHMX="/d/BaiTapCode/WHMX"
NEO="$WHMX/NeoArtifacts"
CALC="$WHMX/WhmxCalc"
ADB="/d/Program Files/Netease/MuMuPlayer/nx_device/15.0/shell/adb.exe"
DEVICE="127.0.0.1:16384"          # lấy serial thật từ "$ADB" devices -l; KHÔNG dùng emulator-5554 cũ
PACKAGE="com.cipaishe.wuhua.bilibili"
SNAPSHOT="r3057-20260929T130948564397Z"   # snapshot hiện hành: xem Assets/runtime_snapshots/current_authoritative_snapshot.json
```

---

## 1. Lệnh đơn lẻ (không cần quy trình)

| Việc | Lệnh | Ghi chú |
|---|---|---|
| **Có bản cập nhật game chưa? (nhanh, không cần MuMu)** | `cd "$NEO" && python NeoArtifacts.py status` | Đọc APK/launch/packet_config từ server, chỉ đọc |
| Xem snapshot hiện hành | `cat "$NEO/Assets/runtime_snapshots/current_authoritative_snapshot.json"` | `snapshot_id` + `build_ab_version` (vd. r3026) |
| Danh sách lệnh NeoArtifacts | `python NeoArtifacts.py --help` | 16 lệnh: status, download, masterdata, split-cfc, decrypt-assets, deserialize, verify-legacy, painting, painting-plan, adb-pull-drawing, snapshot-create, runtime-snapshot, character-assets, character-sync, huanzhang-sync, runtime-update |
| MuMu có kết nối không | `"$ADB" devices -l` | Phải thấy `127.0.0.1:16384  device` |
| Web chạy local (chỉ trang public) | `cd "$CALC" && npm run dev` | http://localhost:5173 — **không** có lore/build overlay |
| Web + API local (có Admin, lore, build) | `cd "$CALC" && npx vercel dev --listen 3003` | DB **development** (`.env.local`) |
| Test | `npm test` · `npm run test:tools` · `npx tsc --noEmit -p tsconfig.json` · `npm run build` | |
| Kiểm dữ liệu | `python tools/validate_data.py` · `validate_public_output.py` · `validate_skin_roster.py` · `validate_skin_assets.py` | chạy trong `$CALC` |
| Log Vercel production | `npx vercel logs https://whmxsite.vercel.app --json` | |
| Deployment đang là Production | `npx vercel inspect https://whmxsite.vercel.app` | |
| Refresh fixtures MasterData (cho test Build) | `node scripts/export-masterdata-fixtures.mjs` | đọc `../NeoArtifacts` |
| Kiểm cú pháp Python NeoArtifacts | `python -m py_compile NeoArtifacts.py character_assets.py huanzhang_assets.py` | im lặng = OK |

---

## 2. Quy trình: kết nối + root MuMu (bước đầu của mọi quy trình dùng ADB)

Mở MuMu (đúng instance có game), rồi:

```bash
"$ADB" connect "$DEVICE"
"$ADB" -s "$DEVICE" root
"$ADB" connect "$DEVICE"            # root làm adbd khởi động lại → connect lại
"$ADB" devices -l                   # thấy: 127.0.0.1:16384  device
"$ADB" -s "$DEVICE" shell id        # thấy: uid=0(root)
```

`devices` trống dù MuMu đang mở:

```bash
"$ADB" kill-server && "$ADB" start-server && "$ADB" connect "$DEVICE" && "$ADB" devices -l
```

Tắt/mở lại MuMu là phải làm lại cả khối này.

---

## 3. Quy trình: kiểm tra có cập nhật (chỉ đọc, không ghi gì)

1. Không cần MuMu: `cd "$NEO" && python NeoArtifacts.py status` — so version server với bản đang có.
2. Mở game trong MuMu cho nó **tự cập nhật xong** tới màn hình chính.
3. MuMu preflight (§2).
4. So baseline local ↔ MuMu ↔ server:

```bash
cd "$NEO"
python NeoArtifacts.py runtime-update check --snapshot "$SNAPSHOT"
python NeoArtifacts.py runtime-update plan  --snapshot "$SNAPSHOT"   # liệt kê bundle mới/đổi, chưa pull gì
```

`check` báo build AB của baseline (vd. r3026), của MuMu và của server. Nếu MuMu mới hơn baseline → có cập nhật → §4.

---

## 4. Quy trình: ngày ra nhân vật mới (runbook N2 → N3)

Làm theo đúng thứ tự. `NEW_ID` = mã nhân vật mới (vd. `D0190`), lấy từ MasterData, **không đoán từ tên**.

**A. Dữ liệu thô (NeoArtifacts)**

```bash
cd "$NEO"
python refresh_masterdata.py        # backup MasterData → MasterData_Backups/, tải CFC/lang mới, in status trước/sau
```

Kiểm `MasterData/provenance/launch_*.json` mới nhất khớp bản game đang chạy.

MuMu: game đã tự cập nhật xong → §2 preflight → rồi:

```bash
python NeoArtifacts.py runtime-update check --snapshot "$SNAPSHOT"
python NeoArtifacts.py runtime-update plan  --snapshot "$SNAPSHOT"
python NeoArtifacts.py runtime-update apply --snapshot "$SNAPSHOT" --dry-run     # thử, không ghi
python NeoArtifacts.py runtime-update apply --snapshot "$SNAPSHOT" --notes "release NEW_ID"   # ⚠️ pull bundle + MasterData, tạo snapshot mới
```

`apply` in ra **snapshot mới** → cập nhật biến: `SNAPSHOT="<id mới>"`.

```bash
python NeoArtifacts.py character-sync NEW_ID --snapshot "$SNAPSHOT" --plan
python NeoArtifacts.py character-sync NEW_ID --snapshot "$SNAPSHOT" --adb "$ADB" --device "$DEVICE" --package "$PACKAGE"   # ⚠️ xuất ảnh vào Assets/characters/NEW_ID/
# nếu nhân vật có Hoán Chương:
python NeoArtifacts.py huanzhang-sync --snapshot "$SNAPSHOT" --plan
python NeoArtifacts.py huanzhang-sync --snapshot "$SNAPSHOT" --adb "$ADB" --device "$DEVICE" --package "$PACKAGE"
```

Kết quả phải là `COMPLETE` (xem `Assets/characters/NEW_ID/manifest.json`).

**B. Bản dịch (workbook)**

```bash
cd "$CALC"
python tools/sync_masterdata_incremental.py --character NEW_ID --dry-run --cleanup-internal    # xem các dòng sẽ thêm (bỏ controller nội bộ như D0183)
python tools/sync_masterdata_incremental.py --character NEW_ID --apply --cleanup-internal      # ⚠️ ghi workbook (có backup) — CHỈ nhân vật mới
# trang phục mới (skinType 3) của nhân vật ĐÃ CÓ: chỉ sheet SKIN (không chạy các sheet khác cho nhân vật cũ)
python tools/sync_masterdata_incremental.py --character OLD_ID --sheets SKIN --dry-run
python tools/sync_masterdata_incremental.py --character OLD_ID --sheets SKIN --apply           # ⚠️
```

Dịch các dòng mới theo batch (skill `whmx-localization` §6 + `game-translator`). Series mới: tên VI chỉ khi owner duyệt.

**C. Ảnh + dữ liệu web**

```bash
python tools/copy_assets.py                     # NeoArtifacts → public/assets (avatar, skill icon, Hoán Chương…)
python tools/publish_assets.py --dry-run
python tools/publish_assets.py                  # ⚠️ upload card/drawing/archive lên R2
python tools/build_web_data.py                  # workbook → generated_localization.json → public/data.json
```

Icon mới chưa có pipeline (vd. `Speciality_*` của Thâm tạo, item icon): tra `D:\BaiTapCode\WHMX\allsprites_manual_scan\INDEX.csv`, chép file từ `Packet61_AllSprites` vào `public/assets/styles/` hoặc `public/assets/items/`.

**D. DB production** (⚠️ mỗi lệnh ghi cần owner đồng ý; thiếu `--env-file=.env.production.local` là chạy vào DB development)

```bash
node --env-file=.env.production.local scripts/import-character-skin.mjs --check
node --env-file=.env --env-file=.env.production.local scripts/import-character-skin.mjs          # ⚠️
node --env-file=.env.production.local scripts/import-character-profile.mjs                       # plan
node --env-file=.env.production.local scripts/import-character-profile.mjs --apply               # ⚠️
node --env-file=.env.production.local scripts/import-game-references.mjs                         # plan (vũ khí, dòng thuộc tính, Thâm tạo…)
node --env-file=.env.production.local scripts/import-game-references.mjs --apply                 # ⚠️
```

Phải chạy **trước** bước E, nếu không nhân vật mới giữ profile cũ (mã K/T/S/P thô) và thiếu trong lore R2.

**E. Ghép lore, kiểm, build**

```bash
node --env-file=.env.production.local scripts/export-profile-overlay.mjs --shape v2 | python tools/apply_profile_overlay.py
python tools/validate_data.py && python tools/validate_skin_roster.py && python tools/validate_skin_assets.py && python tools/validate_public_output.py
npm test && npm run build
git diff --stat public/data.json                # xem toàn bộ thay đổi data.json trước khi commit
```

**F. Lên site** (owner xem trước)

```bash
git fetch origin && git merge-base --is-ancestor origin/main HEAD && git push origin HEAD:main && git push origin HEAD   # ⚠️ deploy
LORE_PUBLISH_PREFIX=lore/production/ node --env-file=.env --env-file=.env.production.local scripts/publish-lore.mjs   # ⚠️ (hoặc nút "Xuất bản ngay" trong Admin)
```

Rồi prune Vercel (§8). Sau đó kiểm trang nhân vật mới trên https://whmxsite.vercel.app (Tổng quan, Thông Tin, Build, Hồ Sơ).

**G. Sau khi lên (N3)**: nếu có Preview trùng mã nhân vật mới → Admin → Preview → retire; metadata/ảnh đã chọn thành override trên nhân vật chính thức.

---

## 5. Quy trình: đồng bộ ảnh nhân vật (khi thiếu/hỏng ảnh, không có bản game mới)

```bash
cd "$NEO"
# §2 MuMu preflight trước
python NeoArtifacts.py character-sync D0183 --snapshot "$SNAPSHOT" --plan                   # một nhân vật
python NeoArtifacts.py character-sync D0183 --snapshot "$SNAPSHOT" --adb "$ADB" --device "$DEVICE" --package "$PACKAGE"
python NeoArtifacts.py character-sync --all --snapshot "$SNAPSHOT" --plan                  # tất cả (134)
python NeoArtifacts.py character-sync --all --snapshot "$SNAPSHOT" --adb "$ADB" --device "$DEVICE" --package "$PACKAGE"
cd "$CALC" && python tools/copy_assets.py
```

Bỏ `--snapshot` = tạo snapshot mới từ MuMu (cần `--adb/--device/--package`). Kết quả mong đợi: `characters_failed: 0`, `remote_missing: 0`, `md5_mismatch: 0`.

---

## 6. Quy trình: Hoán Chương

```bash
cd "$NEO"
python NeoArtifacts.py huanzhang-sync --snapshot "$SNAPSHOT" --plan
# §2 MuMu preflight
python NeoArtifacts.py huanzhang-sync --snapshot "$SNAPSHOT" --adb "$ADB" --device "$DEVICE" --package "$PACKAGE"
cd "$CALC" && python tools/copy_assets.py
```

Đọc kết quả: `Assets/huanzhang/manifest.json` → `status` phải `COMPLETE`.

---

## 7. Quy trình: sau khi dịch trong workbook → lên site

```bash
cd "$CALC"
python tools/build_web_data.py
git diff --stat public/data.json               # workbook có sửa của owner: nếu đổi ngoài phần định sửa → dừng, hỏi
python tools/validate_data.py && python tools/validate_public_output.py
npm test && npm run build
# commit data.json → push như §4-F
```

Bản dịch lore / từ điển / build sửa trong **Admin** thì không cần bước này: tự xuất bản ~30 giây sau khi lưu.

---

## 8. Quy trình: prune Vercel (giữ 5 bản mới nhất)

```bash
cd "$CALC"
npx vercel inspect https://whmxsite.vercel.app        # nhớ url Production — bản này luôn giữ
npx vercel ls whmxsite --format=json                  # > 20 bản thì thêm --next <pagination.next>
npx vercel remove <url-cũ> --yes                      # ⚠️ lặp cho từng bản ngoài 5 bản mới nhất
```

---

## 9. Quy trình: migration DB

```bash
npm run db:migrate -- --target=development
node --env-file=.env.production.local scripts/db-migrate.mjs --target=production    # ⚠️ owner đồng ý
```

---

## 10. Quy trình nghiên cứu: ghi lại một lần game tự cập nhật (tcpdump) — hiếm dùng

Chi tiết + cảnh báo: `NeoArtifacts/RUNTIME_UPDATE_CAPTURE_RUNBOOK.md`. Chạy trong **PowerShell** (tránh Git Bash đổi đường dẫn Android). Chỉ khi có bản cập nhật thật mà game **chưa mở**.

```powershell
cd D:\BaiTapCode\WHMX\NeoArtifacts
$adb = 'D:\Program Files\Netease\MuMuPlayer\nx_device\15.0\shell\adb.exe'
$device = '127.0.0.1:16384'      # runbook ghi emulator-5554 (cũ) — dùng serial thật từ adb devices
$package = 'com.cipaishe.wuhua.bilibili'
$outputRoot = 'emulator_capture\runtime_updates'
python tools\capture_runtime_update.py doctor  --adb $adb --device $device --package $package --output-root $outputRoot
python tools\capture_runtime_update.py prepare --adb $adb --device $device --package $package --output-root $outputRoot   # game phải đang đóng
$capture = '<đường dẫn prepare in ra>'
python tools\capture_runtime_update.py start  --adb $adb --device $device --package $package --output-root $outputRoot --timeout-seconds 7200 $capture
#   → thấy CAPTURE_ARMED → mở game một lần, chờ cập nhật xong tới màn hình chính
python tools\capture_runtime_update.py status --adb $adb --device $device --package $package --output-root $outputRoot $capture
python tools\capture_runtime_update.py finish --adb $adb --device $device --package $package --output-root $outputRoot --confirm-main-screen $capture
python tools\capture_runtime_update.py analyze --write-reports $capture
```

Chỉ chia sẻ `reports/analysis.json` và `reports/summary.md` (PCAP/PlayerPrefs có thể chứa định danh).

---

## Nguyên tắc

- NeoArtifacts = dữ liệu thô + ảnh (không dịch). Workbook = bản dịch VI. `public/data.json` = sinh ra, không sửa tay.
- Không suy ý nghĩa từ hình dạng ID (`docs/WHMX_MASTERDATA_ID_CONVENTIONS(5).md`).
- Ghi workbook: dry-run → backup → apply → audit. Ghi DB production / R2 / deploy: xem trước → owner đồng ý → chạy.
- Không bao giờ: `pm clear`, xoá cache/data game, thay `data.dat`, `git reset --hard`/`clean`, push khi `origin/main` không phải tổ tiên của HEAD.
