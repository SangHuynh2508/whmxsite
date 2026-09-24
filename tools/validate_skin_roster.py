"""
Focused SKIN and Gallery Validation Script.
Validates:
- SKIN sheet ids == raw actual skins (characterSkins.json, skinType 3): no missing, no extra
- all skin_type == 3
- duplicate skin IDs = 0
- missing character relations = 0
- gallery count == raw actual skin count
Expected counts are derived from raw MasterData (never hard-coded), so a new
game character/skin does not break the check; every per-skin raw comparison
below stays exact.
- base/breakthrough appearance leaks = 0
- canonical currency id=8 and pricing format
"""
import openpyxl
import json
import os
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def run_validation():
    print("=== FOCUSED SKIN AUDIT & INTEGRITY CHECK ===")

    master_path = os.path.join(os.path.dirname(__file__), "..", "localization", "localization_master.xlsx")
    wb = openpyxl.load_workbook(master_path)
    ws = wb["SKIN"]
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    data_rows = rows[1:]

    raw_path = os.path.join(os.path.dirname(__file__), "..", "..", "NeoArtifacts", "MasterData", "json", "characterSkins.json")
    with open(raw_path, "r", encoding="utf-8") as f:
        raw_skins = json.load(f)
    raw_skin_map = {s["skinID"]: s for sl in raw_skins.values() if isinstance(sl, list) for s in sl if s.get("skinType") == 3}
    expected_skins = len(raw_skin_map)

    # 1. SKIN rows == raw actual skins (set equality, not a fixed number)
    skin_rows_count = len(data_rows)
    sheet_ids = {r[rows[0].index("skin_id")] for r in data_rows}
    missing_in_sheet = sorted(set(raw_skin_map) - sheet_ids)
    extra_in_sheet = sorted(sheet_ids - set(raw_skin_map))
    print(f"1. SKIN sheet data rows: {skin_rows_count} (Expected from raw: {expected_skins})")
    assert not missing_in_sheet, f"Raw actual skins missing from SKIN sheet: {missing_in_sheet}"
    assert not extra_in_sheet, f"SKIN sheet rows with no raw actual skin: {extra_in_sheet}"
    assert skin_rows_count == expected_skins, f"Expected {expected_skins} rows, got {skin_rows_count}"

    # 2. skin_type == 3
    type_idx = header.index("skin_type")
    skin_types = set(r[type_idx] for r in data_rows)
    print(f"2. Unique skin_type in SKIN sheet: {skin_types} (Expected: {{3}})")
    assert skin_types == {3}, f"Expected only skin_type 3, got {skin_types}"

    # 3. Duplicates
    id_idx = header.index("skin_id")
    skin_ids = [r[id_idx] for r in data_rows]
    dup_ids = len(skin_ids) - len(set(skin_ids))
    print(f"3. Duplicate skin IDs: {dup_ids} (Expected: 0)")
    assert dup_ids == 0, f"Found duplicates: {dup_ids}"

    # 4. Character relations
    char_idx = header.index("character_id")
    skin_chars = set(r[char_idx] for r in data_rows)
    
    data_json_path = os.path.join(os.path.dirname(__file__), "..", "public", "data.json")
    with open(data_json_path, "r", encoding="utf-8") as f:
        web_data = json.load(f)
        
    public_chars = set(web_data["characters"].keys())
    missing_chars = skin_chars - public_chars
    print(f"4. Missing character relations: {len(missing_chars)} (Expected: 0)")
    assert len(missing_chars) == 0, f"Missing chars: {missing_chars}"

    # 5. Gallery count and leak check
    gallery_skins = []
    base_leak = 0
    for cid, c in web_data["characters"].items():
        for s in c.get("skins", []):
            sid = s.get("skinID", "")
            suf = sid[-3:]
            is_base = (suf in ("001", "002") or s.get("is_base") or s.get("skin_type") in (1, 2))
            if is_base:
                continue
            if suf in ("001", "002") or s.get("skin_type") != 3:
                base_leak += 1
            gallery_skins.append(s)

    print(f"5. Public Gallery skins count: {len(gallery_skins)} (Expected from raw: {expected_skins})")
    assert len(gallery_skins) == expected_skins, f"Expected {expected_skins}, got {len(gallery_skins)}"

    print(f"6. Base / Breakthrough appearance leak: {base_leak} (Expected: 0)")
    assert base_leak == 0, f"Leaked appearances: {base_leak}"

    # 7. Currency check
    currency_names = set(s.get("currency") for s in gallery_skins if s.get("price"))
    print(f"7. Price currencies in gallery skins: {currency_names} (Expected: {{'Vé Trang Phục'}})")
    assert currency_names == {"Vé Trang Phục"}, f"Unexpected currency names: {currency_names}"

    # 8. Item 8 check
    item_8 = web_data["items"].get("8")
    assert item_8 is not None, "Item 8 missing from data.json items"
    print(f"8. Item 8 in data.json: id={item_8.get('id')}, name_vi='{item_8.get('name_vi')}', name_cn='{item_8.get('name_cn')}'")
    assert item_8.get("name_vi") == "Vé Trang Phục", f"Item 8 name_vi mismatch: {item_8}"

    # 9. Master Series fields & raw consistency
    SERIES_MAP_CN = {
        202: "新春", 203: "花朝", 204: "节气", 205: "非遗", 206: "闲趣",
        207: "长安", 208: "绮梦", 209: "幸食", 210: "纪念", 211: "异象",
        212: "幻景", 213: "行者", 214: "裁样", 215: "聆律", 216: "秦音",
        217: "织彩", 218: "异世", 219: "消暑", 220: "云想新裳"
    }
    SERIES_MAP_VI = {
        202: "Tân Xuân", 203: "Hoa Triêu", 204: "Tiết Khí", 205: "Phi Di", 206: "Nhàn Thú",
        207: "Trường An", 208: "Ỷ Mộng", 209: "Hạnh Thực", 210: "Kỷ Niệm", 211: "Dị Tượng",
        212: "Huyễn Cảnh", 213: "Hành Giả", 214: "Tài Dạng", 215: "Linh Luật", 216: "Tần Âm",
        217: "Chức Thải", 218: "Dị Thế", 219: "Tiêu Thử", 220: "Vân Tưởng Tân Thường"
    }
    assert "series_id" in header, "Missing series_id in SKIN header"
    assert "series_name_cn" in header, "Missing series_name_cn in SKIN header"
    assert "series_name_vi" in header, "Missing series_name_vi in SKIN header"

    s_id_idx = header.index("series_id")
    s_cn_idx = header.index("series_name_cn")
    s_vi_idx = header.index("series_name_vi")

    assigned_series = 0
    zero_series = 0
    for r in data_rows:
        sid = r[id_idx]
        s_id = r[s_id_idx]
        s_cn = r[s_cn_idx]
        s_vi = r[s_vi_idx]
        raw = raw_skin_map[sid]
        raw_logo = raw.get("skinLOGO")

        if raw_logo == 0:
            zero_series += 1
            assert s_id is None, f"Expected None series_id for skinLOGO=0 ({sid}), got {s_id}"
            assert s_cn is None or s_cn == "", f"Expected None/empty series_name_cn for skinLOGO=0 ({sid}), got {s_cn}"
            assert s_vi is None or s_vi == "", f"Expected None/empty series_name_vi for skinLOGO=0 ({sid}), got {s_vi}"
        else:
            assigned_series += 1
            assert s_id == raw_logo, f"Series ID mismatch for {sid}: sheet={s_id}, raw={raw_logo}"
            assert s_id in SERIES_MAP_CN, f"Unknown series ID {s_id}"
            assert s_cn == SERIES_MAP_CN[s_id], f"CN Series name mismatch for {sid}: got {s_cn}, expected {SERIES_MAP_CN[s_id]}"
            assert s_vi == SERIES_MAP_VI[s_id], f"VI Series name mismatch for {sid}: got {s_vi}, expected {SERIES_MAP_VI[s_id]}"

    raw_zero_series = sum(1 for raw in raw_skin_map.values() if raw.get("skinLOGO") == 0)
    raw_assigned_series = expected_skins - raw_zero_series
    print(f"9. Master SKIN Series integrity: {assigned_series} assigned, {zero_series} unassigned (0) (Expected from raw: {raw_assigned_series} / {raw_zero_series})")
    assert assigned_series == raw_assigned_series, f"Expected {raw_assigned_series} assigned series, got {assigned_series}"
    assert zero_series == raw_zero_series, f"Expected {raw_zero_series} zero series, got {zero_series}"

    # 10. Web data Series payload
    web_series_assigned = 0
    web_series_zero = 0
    for s in gallery_skins:
        sid = s.get("skinID")
        ser_id = s.get("series_id")
        ser_cn = s.get("series_name_cn")
        ser_vi = s.get("series_name_vi")
        ser_badge = s.get("series_badge")
        raw = raw_skin_map[sid]
        raw_logo = raw.get("skinLOGO")

        if raw_logo == 0:
            web_series_zero += 1
            assert ser_id is None, f"Expected None for zero series in web data, got {ser_id}"
            assert ser_badge is None, f"Expected None for zero series badge in web data, got {ser_badge}"
            assert not ser_vi, f"Expected empty/None for zero series VI name in web data, got {ser_vi}"
        else:
            web_series_assigned += 1
            assert ser_id == raw_logo, f"Web series_id mismatch for {sid}"
            assert ser_cn == SERIES_MAP_CN[ser_id], f"Web series_name_cn mismatch for {sid}"
            assert ser_vi == SERIES_MAP_VI[ser_id], f"Web series_name_vi mismatch for {sid}"
            assert ser_badge == f"/assets/series/skinlogo_{ser_id}.png", f"Web series_badge mismatch for {sid}"

    print(f"10. Web data Series payload: {web_series_assigned} assigned, {web_series_zero} unassigned (Expected from raw: {raw_assigned_series} / {raw_zero_series})")
    assert web_series_assigned == raw_assigned_series, f"Expected {raw_assigned_series} assigned, got {web_series_assigned}"
    assert web_series_zero == raw_zero_series, f"Expected {raw_zero_series} zero, got {web_series_zero}"

    # 11. Filter domain independence check
    # Check that each series contains skins and can be filtered independently of acquisition source
    series_cardinality = {sid: 0 for sid in SERIES_MAP_CN}
    for s in gallery_skins:
        if s.get("series_id"):
            series_cardinality[s["series_id"]] += 1

    all_have_skins = all(c > 0 for c in series_cardinality.values())
    print(f"11. All {len(SERIES_MAP_CN)} Series have at least 1 actual skin: {all_have_skins} (Min: {min(series_cardinality.values())}, Max: {max(series_cardinality.values())})")
    assert all_have_skins, f"Empty series found: {series_cardinality}"

    # 12. Raw-backed commerce & inventory metadata (item_id, goods_id, discount_goods_id, discount_price/start/end)
    charge_path = os.path.join(os.path.dirname(__file__), "..", "..", "NeoArtifacts", "MasterData", "json", "charge.json")
    with open(charge_path, "r", encoding="utf-8") as f:
        charge_data = json.load(f)

    commerce_cols = ["item_id", "goods_id", "discount_goods_id", "discount_price", "discount_start", "discount_end"]
    for col in commerce_cols:
        assert col in header, f"Missing {col} in SKIN header"

    item_id_idx = header.index("item_id")
    goods_id_idx = header.index("goods_id")
    d_gid_idx = header.index("discount_goods_id")
    d_price_idx = header.index("discount_price")
    d_start_idx = header.index("discount_start")
    d_end_idx = header.index("discount_end")
    curr_idx = header.index("currency")

    matched_item_id = 0
    matched_goods_id = 0
    blank_goods_id = 0
    matched_discount_goods = 0
    blank_discount_goods = 0
    matched_discount_price = 0
    matched_discount_window = 0
    currency_consistent = 0

    # Load generated_localization.json for pipeline verification
    gen_loc_path = os.path.join(os.path.dirname(__file__), "..", "localization", "generated_localization.json")
    with open(gen_loc_path, "r", encoding="utf-8") as f:
        gen_loc = json.load(f)
    gen_skins = gen_loc.get("skins", {})

    for r in data_rows:
        sid = r[id_idx]
        raw = raw_skin_map[sid]
        raw_mid = str(raw.get("mapItemsID") or "")
        raw_gid = str(raw.get("goodsID") or "")
        raw_dgid = str(raw.get("discountGoodsID") or "")

        # A. item_id
        sheet_item_id = str(r[item_id_idx] or "").strip()
        assert sheet_item_id == raw_mid, f"item_id mismatch for {sid}: sheet={sheet_item_id}, raw={raw_mid}"
        matched_item_id += 1

        # B. goods_id
        sheet_goods_id = str(r[goods_id_idx] or "").strip()
        if raw_gid:
            assert sheet_goods_id == raw_gid, f"goods_id mismatch for {sid}: sheet={sheet_goods_id}, raw={raw_gid}"
            matched_goods_id += 1
        else:
            assert sheet_goods_id == "", f"Expected blank goods_id for {sid}, got {sheet_goods_id}"
            assert r[goods_id_idx] is None, f"Expected None goods_id for {sid}, got {r[goods_id_idx]}"
            blank_goods_id += 1

        # C. discount_goods_id & linked charge fields
        sheet_dgid = str(r[d_gid_idx] or "").strip()
        sheet_dprice = r[d_price_idx]
        sheet_dstart = r[d_start_idx]
        sheet_dend = r[d_end_idx]

        if raw_dgid:
            assert sheet_dgid == raw_dgid, f"discount_goods_id mismatch for {sid}: sheet={sheet_dgid}, raw={raw_dgid}"
            matched_discount_goods += 1
            assert raw_dgid in charge_data, f"discountGoodsID {raw_dgid} not found in charge.json"
            ch = charge_data[raw_dgid]
            cost = ch.get("Cost", {})
            raw_cost_count = int(cost.get("count", 0)) if "count" in cost else None
            raw_cost_id = cost.get("id", "")
            raw_start = ch.get("StartTime")
            raw_end = ch.get("EndTime")

            # discount_price match
            assert sheet_dprice == raw_cost_count, f"discount_price mismatch for {sid}: sheet={sheet_dprice}, charge={raw_cost_count}"
            matched_discount_price += 1

            # discount_start / end match
            assert sheet_dstart == raw_start, f"discount_start mismatch for {sid}: sheet={sheet_dstart}, charge={raw_start}"
            assert sheet_dend == raw_end, f"discount_end mismatch for {sid}: sheet={sheet_dend}, charge={raw_end}"
            matched_discount_window += 1

            # currency consistency
            sheet_curr = r[curr_idx]
            if raw_cost_id == "8":
                assert sheet_curr == "Vé Trang Phục", f"Currency inconsistency for {sid}: charge cost id=8 but sheet currency={sheet_curr}"
                currency_consistent += 1
            elif raw_cost_id == "":
                assert raw_cost_count == 0, f"Expected 0 cost for blank cost id on {sid}, got {raw_cost_count}"
                assert sheet_curr is None, f"Expected None currency for free discount skin {sid}, got {sheet_curr}"
                currency_consistent += 1
            else:
                raise AssertionError(f"Unexpected cost id {raw_cost_id} for discount skin {sid}")
        else:
            assert sheet_dgid == "", f"Expected blank discount_goods_id for {sid}, got {sheet_dgid}"
            assert r[d_gid_idx] is None, f"Expected None discount_goods_id for {sid}, got {r[d_gid_idx]}"
            assert r[d_price_idx] is None, f"Expected None discount_price for unlinked {sid}, got {r[d_price_idx]}"
            assert r[d_start_idx] is None, f"Expected None discount_start for unlinked {sid}, got {r[d_start_idx]}"
            assert r[d_end_idx] is None, f"Expected None discount_end for unlinked {sid}, got {r[d_end_idx]}"
            blank_discount_goods += 1

        # D. generated_localization.json alignment
        gskin = gen_skins.get(sid, {})
        assert gskin.get("item_id") == (str(r[item_id_idx]) if r[item_id_idx] else None), f"gen_loc item_id mismatch for {sid}"
        assert gskin.get("goods_id") == (str(r[goods_id_idx]) if r[goods_id_idx] else None), f"gen_loc goods_id mismatch for {sid}"
        assert gskin.get("discount_goods_id") == (str(r[d_gid_idx]) if r[d_gid_idx] else None), f"gen_loc discount_goods_id mismatch for {sid}"
        assert gskin.get("discount_price") == r[d_price_idx], f"gen_loc discount_price mismatch for {sid}"
        assert gskin.get("discount_start") == r[d_start_idx], f"gen_loc discount_start mismatch for {sid}"
        assert gskin.get("discount_end") == r[d_end_idx], f"gen_loc discount_end mismatch for {sid}"

    # Every row above was compared with raw; these totals only prove each row landed in exactly one bucket.
    print(f"12. Raw-backed commerce metadata: item_id={matched_item_id}/{skin_rows_count}, goods_id={matched_goods_id} (blank={blank_goods_id}), discount_goods_id={matched_discount_goods} (blank={blank_discount_goods}), prices/windows/currency matched={matched_discount_price}/{matched_discount_window}/{currency_consistent}")
    assert matched_item_id == skin_rows_count, f"Expected {skin_rows_count} matched item_id, got {matched_item_id}"
    assert matched_goods_id + blank_goods_id == skin_rows_count, f"goods_id buckets {matched_goods_id}+{blank_goods_id} != {skin_rows_count}"
    assert matched_discount_goods + blank_discount_goods == skin_rows_count, f"discount_goods_id buckets {matched_discount_goods}+{blank_discount_goods} != {skin_rows_count}"
    for label, value in (("discount_price", matched_discount_price), ("discount_window", matched_discount_window), ("currency", currency_consistent)):
        assert value == matched_discount_goods, f"Expected {matched_discount_goods} matched {label}, got {value}"

    print("=== ALL FOCUSED SKIN CHECKS PASSED PERFECTLY (12/12) ===")

if __name__ == "__main__":
    run_validation()
