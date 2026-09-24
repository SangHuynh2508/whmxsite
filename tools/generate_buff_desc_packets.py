#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_buff_desc_packets.py

Generates 5 focused XLSX translation review packets and an INDEX.xlsx manifest
for the 74 public-character-reachable untranslated buff descriptions identified
in the global audit (2026-09-17).

Rules:
- Strictly read-only on localization_master.xlsx (NO MUTATION).
- All 74 rows are DESCRIPTION_ONLY gaps.
- buff_name_vi already exists and is strictly preserved.
- buff_desc_vi is left blank for translator input.
- Characters and mechanics are kept intact without splitting across packets.
"""

import json
import re
import sys
from pathlib import Path
from collections import defaultdict
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Ensure UTF-8 output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Repository Paths
REPO_ROOT = Path(__file__).resolve().parent.parent
AUDIT_PATH = REPO_ROOT / "localization" / "reviews" / "global_untranslated_buff_coverage_audit_20260917.xlsx"
MASTER_PATH = REPO_ROOT / "localization" / "localization_master.xlsx"
OUTPUT_DIR = REPO_ROOT / "localization" / "reviews" / "buff_desc_packets"
NEO_JSON_DIR = Path(r"D:\BaiTapCode\WHMX\NeoArtifacts\MasterData\json")

# Tag regex
PARAM_RE = re.compile(r"\[[A-Za-z0-9_,]+\]")
CLEAN_TAG_RE = re.compile(r"<[^>]+>")

def clean_tag(s: str) -> str:
    if not s:
        return ""
    return CLEAN_TAG_RE.sub("", s)

# Packet Partition Assignment
# Grouping keeps characters, buff families, and mechanics together.
PACKET_ASSIGNMENTS = {
    # Packet 01: All A-series characters (17 buffs)
    "A0001": 1,
    "A0024": 1,
    "A0033": 1,
    "A0061": 1,
    "A0063": 1,
    "A0069": 1,
    "A0070": 1,
    "A0084": 1,
    "A0093": 1,
    "A0120": 1,
    "A0139": 1,
    "A0162": 1,

    # Packet 02: All D-series characters (17 buffs, keeps D0092 7 buffs together)
    "D0032": 2,
    "D0035": 2,
    "D0089": 2,
    "D0092": 2,
    "D0154": 2,
    "D0179": 2,
    "D0183": 2,

    # Packet 03: All S-series characters (15 buffs, keeps S0155 6 buffs together)
    "S0028": 3,
    "S0062": 3,
    "S0077": 3,
    "S0083": 3,
    "S0103": 3,
    "S0130": 3,
    "S0132": 3,
    "S0155": 3,

    # Packet 04: All V-series characters (8 buffs) + W-series Batch 1 (6 buffs) -> 14 buffs
    "V0018": 4,
    "V0037": 4,
    "V0052": 4,
    "V0065": 4,
    "V0076": 4,
    "V0171": 4,
    "V0177": 4,
    "W0074": 4,
    "W0079": 4,
    "W0081": 4,
    "W0085": 4,
    "W0118": 4,

    # Packet 05: W-series Batch 2 (12 buffs, keeps W0134 8 buffs and W0182 together)
    "W0134": 5,
    "W0151": 5,
    "W0168": 5,
    "W0182": 5,
}

PACKET_FILENAMES = {
    1: "buff_desc_review_packet_01_20260917.xlsx",
    2: "buff_desc_review_packet_02_20260917.xlsx",
    3: "buff_desc_review_packet_03_20260917.xlsx",
    4: "buff_desc_review_packet_04_20260917.xlsx",
    5: "buff_desc_review_packet_05_20260917.xlsx",
}

# Explicit Mechanic / Family Grouping definitions for each Buff ID
MECHANIC_GROUPINGS = {
    # Packet 01 (A-series)
    "Buff_A0001_2_1": "Xuân Kế / Xuân Thụ (Cộng dồn nội tại Xuân Thụ)",
    "Buff_A0024_6": "Thiên Sứ Thân Vẫn (Cộng dồn chúc phúc Thiên Sứ Thân Vẫn)",
    "Buff_A0024_6ex": "Thiên Sứ Thân Vẫn · Nâng Cấp (Cộng dồn chúc phúc EX)",
    "Buff_A0033_8": "Bình Tức (Áp chế hành động / Kỹ năng bị động EX)",
    "Buff_A0061_7": "Sương Linh Bất Nhiễm (Tăng hiệu quả hồi phục)",
    "Buff_A0061_hz_2_1": "Thành Trưởng Khoái Lạc (Thẻ điểm tích lũy trưởng thành)",
    "Buff_MissRate_Down": "Kim Qua Chinh Chiến - Phong Tỏa (Giảm tỷ lệ né tránh của mục tiêu)",
    "Buff_Speed_Down": "Nhiếp Ký Lược Ảnh - Bán Túc (Giảm tốc độ di chuyển của mục tiêu)",
    "Buff_A0069_7": "Lạc Diệp Quy Căn (Cộng dồn thu thập lá vàng)",
    "Buff_A0070_1": "Thôi Tiêu Kỹ Xảo (Kỹ năng bán hàng / Nội tại EX)",
    "Buff_A0084_12": "Thu Binh (Điểm đếm triệu hồi thu binh)",
    "Buff_A0093_A_1": "Thất Lưu Văn Động - Gia Xan Phạn 1 (Tăng tấn công bậc 1)",
    "Buff_A0093_A_2": "Thất Lưu Văn Động - Gia Xan Phạn 2 (Tăng tấn công bậc 2)",
    "Buff_A0120_15": "Thụy Hạc Chi Khí (Hào quang chim hạc cát tường)",
    "Buff_A0139_9": "Hành Khiếp Du Hàng (Hành lý du ngoạn / Tăng tốc độ)",
    "Buff_A0139_hz_1_1": "Tịch Minh Thí Dụng Trang (Bộ dùng thử Tịch Minh)",
    "Buff_A0162_11ex": "Luận Công Hành Thưởng (Tăng sát thương / Nội tại EX)",

    # Packet 02 (D-series)
    "Buff_D0032_1": "Công Thủ Dị Chuyển - Thế Công (Chuyển đổi trạng thái tấn công)",
    "Buff_D0032_10": "Công Thủ Dị Chuyển - Thế Thủ (Chuyển đổi trạng thái phòng thủ)",
    "Buff_D0035_hz_5_3": "Cấm Tửu Điền Tự Du Hí (Trò chơi ô chữ cấm rượu)",
    "Buff_Shield_D0035_hz": "Hộ Thuẫn (Khiên chắn hấp thụ sát thương cấu tố)",
    "Buff_D0089_2": "Sách Mệnh Chi Thư (Sách định mệnh / Nội tại EX)",
    "Buff_D0092_29": "Toàn Luật - Thanh Nhạc (Thế nhạc Thanh Nhạc / Nhã Âm)",
    "Buff_D0092_29_1": "Toàn Luật - Thanh Nhạc Cường Hóa (Thế nhạc Thanh Nhạc bậc 2)",
    "Buff_D0092_30": "Toàn Luật - Yến Nhạc (Thế nhạc Yến Nhạc / Nhã Âm)",
    "Buff_D0092_30_1": "Toàn Luật - Yến Nhạc Cường Hóa (Thế nhạc Yến Nhạc bậc 2)",
    "Buff_D0092_33": "Toàn Luật - Nhã Nhạc (Thế nhạc Nhã Nhạc / Nhã Âm)",
    "Buff_D0092_34": "Toàn Luật - Nhã Nhạc Cường Hóa (Thế nhạc Nhã Nhạc bậc 2)",
    "Buff_D0092_Hz_C_4_3": "Búp Bê Nghênh Tân Học Xã (Linh vật hỗ trợ học xã)",
    "Buff_D0154_4_3_1": "Xuân Thủy Thu Sơn (Tăng sát thương cảnh giới)",
    "Buff_D0154_Hz_4_2_1": "Mũ Bảo Hiểm Mô Tô (Tăng xuyên phòng ngự)",
    "Buff_D0179_16_ex": "Lập Phượng Đạp Ngưu (Thế đứng phượng ngưu / Nội tại EX)",
    "Buff_Intervene_D0179": "Thần Tướng Hộ Trì - Hộ Vệ (Gánh chịu sát thương thay đồng đội)",
    "Buff_Intervene": "Khô Lâu Tương Hộ - Hộ Vệ (Gánh chịu sát thương thay đồng đội)",

    # Packet 03 (S-series)
    "Buff_S0028_4": "Lưu Kim Chi Kỹ (Điểm đếm tấn công cảnh giới)",
    "Buff_S0062_8": "Dung Hàn Tầm Phương (Tăng lượng trị liệu bản thân)",
    "Buff_S0077_14": "Thời Trệ (Trì hoãn thời gian / Bỏ qua lượt hành động)",
    "Buff_S0083_8": "Lâm Trung Tiểu Ốc (Giảm tỷ lệ bạo kích của mục tiêu)",
    "Buff_S0103_1_2": "Dấu Phản Kích Cảnh Giới (Đánh dấu phản kích cảnh giới)",
    "Buff_S0103_1_6": "Dấu Phản Kích Cảnh Giới Cường Hóa (Đánh dấu phản kích cảnh giới EX)",
    "Buff_S0130_1": "Viên Hoàn Đồng Tâm (Dấu ấn đồng tâm vòng tròn)",
    "Buff_S0132_5_1": "Kinh Nhị (Tăng sát thương tấn công cảnh giới)",
    "Buff_PhysicalDmgIncrease": "Vật Tướng (Trạng thái tăng sát thương vật lý)",
    "Buff_S0155_9_1_2_hz": "Phân Miểu Bất Sai - Nhánh Túc Vệ (Tăng sát thương và nhận trị liệu)",
    "Buff_S0155_9_2_2_hz": "Phân Miểu Bất Sai - Nhánh Khinh Nhuệ (Tăng quán xuyên và sát thương thêm)",
    "Buff_S0155_9_3_2_hz": "Phân Miểu Bất Sai - Nhánh Viễn Kích (Tăng xuyên thấu phòng ngự)",
    "Buff_S0155_9_4_2_hz": "Phân Miểu Bất Sai - Nhánh Cấu Thuật (Tăng xuyên giáp và trị liệu)",
    "Buff_S0155_9_5_2_hz": "Phân Miểu Bất Sai - Nhánh Chiến Lược (Tăng sát thương cảnh giới và trị liệu)",

    # Packet 04 (V-series & W-series Batch 1)
    "Buff_V0018_14": "Bàn Ly Đằng Khiếu (Tăng điểm di chuyển)",
    "Buff_V0037_1": "Hoàng Thiên Chi Tứ (Tăng hiệu quả hồi phục nhận vào)",
    "Buff_V0037_5": "Tự Vu Thiên Thất (Thời gian hồi kỹ năng)",
    "Buff_V0052_8": "Pháp Bất Dung Tình (Đòn thường kế gây sát thương theo % máu tối đa)",
    "Buff_V0065_3": "Thủ Khiêu Tam Hoàn (Tăng tỷ lệ hút máu)",
    "Buff_V0076_18": "Minh Song Khai Bút (Đòn tấn công kế tiếp gắn hiệu ứng)",
    "Buff_V0171_7_1": "Thương Xuất Như Long (Cộng dồn tăng sát thương bản thân)",
    "Buff_V0177_1_1": "Lũ Kim Quyển Vân (Cộng dồn mây vàng / Tăng sát thương kỹ năng)",
    "Buff_W0074_6_1_1": "Thần Tự (Tăng xuyên thấu phòng ngự bản thân)",
    "Buff_W0079_11": "Bài Luyện (Cộng dồn tăng tốc độ)",
    "Buff_W0079_13": "Tùy Tính Diễn Xuất - Hậu Tràng (Cường hóa kỹ năng nghề kế tiếp)",
    "Buff_W0081_15_1": "Quần Phương Nguyện (Miễn nhiễm trạng thái khống chế tiêu cực)",
    "Buff_W0085_hz_7_3": "Vé Chợ Đen (Giảm thuộc tính máu, tấn công, phòng thủ)",
    "Buff_CritDmg_Up": "Hoa Biên Nguyễn (Tăng sát thương bạo kích)",

    # Packet 05 (W-series Batch 2)
    "Buff_W0134_3": "Sơn Hà Tứ Cảnh - Lũy Nham (Thế núi Lũy Nham - Đất)",
    "Buff_W0134_5": "Sơn Hà Tứ Cảnh - Quyên Lưu (Thế suối Quyên Lưu - Nước)",
    "Buff_W0134_7": "Sơn Hà Tứ Cảnh - Hác Xuyên (Thế khe Hác Xuyên - Khe)",
    "Buff_W0134_9": "Sơn Hà Tứ Cảnh - Thao Thao (Thế sông Thao Thao - Sông)",
    "Buff_W0134_HZ_11_1": "Lũy Nham · Hoán Chương (Cường hóa tuyệt kỹ thế Lũy Nham)",
    "Buff_W0134_HZ_12_1": "Quyên Lưu · Hoán Chương (Cường hóa tuyệt kỹ thế Quyên Lưu)",
    "Buff_W0134_HZ_13_1": "Hác Xuyên · Hoán Chương (Cường hóa tuyệt kỹ thế Hác Xuyên)",
    "Buff_W0134_HZ_14_1": "Thao Thao · Hoán Chương (Cường hóa tuyệt kỹ thế Thao Thao)",
    "Buff_W0151_8": "Hoàng Kim Tỷ Lệ (Cộng dồn tỷ lệ vàng kích hoạt Vẻ Đẹp Hài Hòa)",
    "Buff_Sleep": "Miên Vu Tinh Tiêu - Ngủ Say (Khống chế ngủ say, không thể hành động)",
    "Buff_W0182_Passive_Aex_Buff_1_4": "Tích Lũy Kích Hoạt Âm Thân (Đếm số lần kích hoạt Âm Thân)",
    "Buff_W0182_Passive_Aex_Buff_2": "Tích Lũy Nhận Âm Thân (Đếm số tầng Âm Thân nhận được)",
}

REQUIRED_TO_TRANSLATE_COLUMNS = [
    "packet_no",
    "character_id",
    "character_name_cn",
    "character_name_vi",
    "skill_id",
    "skill_name_cn",
    "skill_name_vi",
    "buff_id",
    "buff_name_cn",
    "buff_name_vi",
    "buff_desc_cn",
    "buff_desc_vi",
    "translation_field",
    "parent_buff_id",
    "parent_buff_name_cn",
    "source_table",
    "source_record",
    "source_field_path",
    "relation_path",
    "sibling_context",
    "placeholder_or_tag_notes",
    "translator_notes",
]

INDEX_COLUMNS = [
    "packet_no",
    "packet_filename",
    "character_id",
    "character_name_cn",
    "character_name_vi",
    "skill_id",
    "skill_name_cn",
    "buff_id",
    "buff_name_cn",
    "buff_name_vi",
    "mechanic/family grouping",
]

def load_authoritative_data():
    """Loads authoritative character, skill, and buff metadata without mutating anything."""
    print("Loading authoritative master workbook (read-only)...")
    wb_m = openpyxl.load_workbook(MASTER_PATH, data_only=True)

    char_m = {}
    for r in wb_m["CHARACTER"].iter_rows(min_row=2, values_only=True):
        if r[0]:
            char_m[str(r[0]).strip()] = (
                str(r[1] or "").strip(),
                str(r[2] or "").strip(),
            )

    skill_by_id = {}
    skill_by_group = {}
    for r in wb_m["SKILL"].iter_rows(min_row=2, values_only=True):
        if not r[0]:
            continue
        sid = str(r[0]).strip()
        gid = str(r[2]).strip() if r[2] else ""
        sname_cn = str(r[5] or "").strip()
        sname_vi = str(r[6] or "").strip()
        skill_by_id[sid] = (sname_cn, sname_vi)
        if gid and gid not in skill_by_group and (sname_cn or sname_vi):
            skill_by_group[gid] = (sname_cn, sname_vi)

    buff_m = {}
    for r in wb_m["BUFF_STATUS"].iter_rows(min_row=2, values_only=True):
        if r[0]:
            bid = str(r[0]).strip()
            buff_m[bid] = {
                "name_cn": str(r[2] or "").strip(),
                "name_vi": str(r[3] or "").strip(),
                "desc_cn": str(r[4] or "").strip(),
                "desc_vi": str(r[5] or "").strip(),
            }

    # Load raw JSON maps as fallback
    buffmap = {}
    skillmap = {}
    if (NEO_JSON_DIR / "buffMap.json").exists():
        buffmap = json.loads((NEO_JSON_DIR / "buffMap.json").read_text(encoding="utf-8"))
    if (NEO_JSON_DIR / "skillMap.json").exists():
        skillmap = json.loads((NEO_JSON_DIR / "skillMap.json").read_text(encoding="utf-8"))

    return char_m, skill_by_id, skill_by_group, buff_m, buffmap, skillmap

def load_audit_source():
    """Loads exactly the 74 PUBLIC_CHARACTER_REACHABLE rows from the source audit workbook."""
    print(f"Loading source audit workbook: {AUDIT_PATH}")
    wb_a = openpyxl.load_workbook(AUDIT_PATH, data_only=True)
    ws_a = wb_a["PUBLIC_CHARACTER_REACHABLE"]
    header = [c for c in next(ws_a.iter_rows(values_only=True))]
    h_map = {c: i for i, c in enumerate(header)}
    rows = list(ws_a.iter_rows(min_row=2, values_only=True))
    print(f"Loaded {len(rows)} source rows from PUBLIC_CHARACTER_REACHABLE")
    assert len(rows) == 74, f"Expected 74 rows, got {len(rows)}"
    return rows, h_map

def resolve_skill_names(skill_key, skill_by_id, skill_by_group, skillmap):
    """Resolves CN and VI skill names authoritatively."""
    if skill_key in skill_by_id:
        return skill_by_id[skill_key]
    if skill_key in skill_by_group:
        return skill_by_group[skill_key]
    
    # Prefix match in master
    matches = [v for k, v in skill_by_id.items() if k.startswith(skill_key) and (v[0] or v[1])]
    if matches:
        return matches[0]

    # Prefix match in raw skillMap
    matches_sm = [v for k, v in skillmap.items() if k.startswith(skill_key)]
    if matches_sm:
        return (clean_tag(matches_sm[0].get("NameLanText") or ""), "")

    return ("", "")

def enrich_rows(audit_rows, h_map, char_m, skill_by_id, skill_by_group, buff_m, buffmap, skillmap):
    """Enriches all 74 audit rows with full character, skill, parent, sibling, and tag context."""
    enriched = []

    for r in audit_rows:
        bid = str(r[h_map["buff_id"]]).strip()
        cid = str(r[h_map["owner_id"]]).strip()
        bname_cn = str(r[h_map["buff_name_cn"]] or "").strip()
        bname_vi = str(r[h_map["buff_name_vi"]] or "").strip()
        bdesc_cn = str(r[h_map["buff_desc_cn"]] or "").strip()
        ev = str(r[h_map["evidence_notes"]] or "").strip()
        src_table = str(r[h_map["source_table"]] or "").strip()
        src_record = str(r[h_map["source_record"]] or "").strip()
        src_path = str(r[h_map["source_field_path"]] or "").strip()

        # Character resolution
        c_rec = char_m.get(cid, ("", ""))
        cname_cn = c_rec[0] or cid
        cname_vi = c_rec[1] or cid

        # Relation path and skill ID parsing from evidence_notes
        rel_path = ""
        skill_id = ""
        parent_bid = ""

        if "Path: " in ev:
            path_part = ev.split("Path: ")[1].split(" (")[0].strip()
            rel_path = path_part
            nodes = [n.strip() for n in path_part.split(" -> ")]
            if len(nodes) >= 2:
                skill_id = nodes[1]
            if len(nodes) >= 3:
                for i, n in enumerate(nodes):
                    if n == bid and i > 0:
                        parent_bid = nodes[i - 1]
                        break
                if not parent_bid and len(nodes) >= 2:
                    parent_bid = nodes[-2]
        else:
            rel_path = ev
            skill_id = src_record

        # Skill names resolution
        sname_cn, sname_vi = resolve_skill_names(skill_id, skill_by_id, skill_by_group, skillmap)

        # Parent buff resolution
        parent_bname_cn = ""
        parent_bname_vi = ""
        parent_bdesc_vi = ""
        if parent_bid and parent_bid.startswith("Buff_"):
            if parent_bid in buff_m:
                parent_bname_cn = buff_m[parent_bid]["name_cn"]
                parent_bname_vi = buff_m[parent_bid]["name_vi"]
                parent_bdesc_vi = buff_m[parent_bid]["desc_vi"]
            elif parent_bid in buffmap:
                parent_bname_cn = clean_tag(buffmap[parent_bid].get("NameLanText") or "")

        # Parameter and tag analysis
        params = sorted(set(PARAM_RE.findall(bdesc_cn)))
        has_color = "<color=" in bdesc_cn
        notes = []
        if params:
            notes.append(f"Giữ nguyên tham số hiệu ứng: {', '.join(params)}")
        if has_color:
            notes.append("Giữ nguyên các thẻ màu rich-text <color=...>...</color>")
        placeholder_notes = "; ".join(notes) if notes else "Văn bản thuần, không chứa tham số"

        # Sibling / Family Context Generation
        sibling_ctx_parts = []
        if parent_bid and parent_bid.startswith("Buff_"):
            p_label = f"Buff gốc (Parent): {parent_bid}"
            if parent_bname_vi:
                p_label += f" ({parent_bname_vi})"
            elif parent_bname_cn:
                p_label += f" ({parent_bname_cn})"
            sibling_ctx_parts.append(p_label)
            if parent_bdesc_vi:
                desc_prev = parent_bdesc_vi.replace("\n", " ")[:100]
                sibling_ctx_parts.append(f"Mô tả buff gốc đã dịch: \"{desc_prev}...\"")

        # Specific mechanic family context
        if cid == "D0092" and ("29" in bid or "30" in bid or "33" in bid or "34" in bid):
            sibling_ctx_parts.append("Thuộc chuỗi trạng thái Toàn Luật của Thúy Ngọc Bạch Thái (Thanh Nhạc / Yến Nhạc / Nhã Nhạc)")
        elif cid == "S0155" and "9_" in bid:
            sibling_ctx_parts.append("Thuộc bộ 5 nhánh chức nghiệp 'Phân Miểu Bất Sai': Túc Vệ (1), Khinh Nhuệ (2), Viễn Kích (3), Cấu Thuật (4), Chiến Lược (5)")
        elif cid == "W0134" and ("_3" in bid or "_5" in bid or "_7" in bid or "_9" in bid):
            sibling_ctx_parts.append("Thuộc bộ Sơn Hà Tứ Cảnh của Thiên Lý Giang Sơn Đồ: Lũy Nham (3), Quyên Lưu (5), Hác Xuyên (7), Thao Thao (9)")
        elif cid == "W0134" and "HZ_1" in bid:
            sibling_ctx_parts.append("Thuộc bộ Hoán Chương cường hóa tuyệt kỹ tương ứng với Sơn Hà Tứ Cảnh")
        elif cid == "D0032":
            sibling_ctx_parts.append("Thuộc cặp trạng thái chuyển đổi Công Thủ Dị Chuyển (Buff_D0032_1 Thế Công, Buff_D0032_10 Thế Thủ)")
        elif "Intervene" in bid:
            sibling_ctx_parts.append("Cơ chế Hộ Vệ (Intervene): Gánh chịu sát thương thay cho đồng minh trong phạm vi")
        elif cid == "W0182":
            sibling_ctx_parts.append("Cơ chế đếm cộng dồn trạng thái Âm Thân của Lý Tiểu Hài Hạng Liên")

        sibling_context = " | ".join(sibling_ctx_parts) if sibling_ctx_parts else "Kỹ năng đơn lẻ hoặc nội tại độc lập"

        translator_notes = (
            "Dịch nghĩa tự nhiên, chuẩn phong cách WHMX. "
            "BẮT BUỘC giữ nguyên chính xác các mã tham số [EffectParam,...]. "
            "BẮT BUỘC giữ nguyên cú pháp các thẻ rich-text <color=#...>...</color>. "
            "Không dịch tên riêng hoặc từ khóa hệ thống."
        )

        packet_no = PACKET_ASSIGNMENTS[cid]

        # Verify buff_name_vi exactly matches localization_master.xlsx
        master_entry = buff_m.get(bid, {})
        master_bname_vi = master_entry.get("name_vi", "")
        assert bname_vi == master_bname_vi, f"Buff {bid} name mismatch: audit '{bname_vi}' != master '{master_bname_vi}'"

        row_dict = {
            "packet_no": packet_no,
            "character_id": cid,
            "character_name_cn": cname_cn,
            "character_name_vi": cname_vi,
            "skill_id": skill_id,
            "skill_name_cn": sname_cn,
            "skill_name_vi": sname_vi,
            "buff_id": bid,
            "buff_name_cn": bname_cn,
            "buff_name_vi": bname_vi,
            "buff_desc_cn": bdesc_cn,
            "buff_desc_vi": "", # MUST BE BLANK
            "translation_field": "DESCRIPTION_ONLY",
            "parent_buff_id": parent_bid if parent_bid.startswith("Buff_") else "",
            "parent_buff_name_cn": parent_bname_cn,
            "source_table": src_table,
            "source_record": src_record,
            "source_field_path": src_path,
            "relation_path": rel_path,
            "sibling_context": sibling_context,
            "placeholder_or_tag_notes": placeholder_notes,
            "translator_notes": translator_notes,
            "mechanic_grouping": MECHANIC_GROUPINGS.get(bid, f"Nội tại / Kỹ năng {cname_vi}"),
        }
        enriched.append(row_dict)

    print(f"Successfully enriched {len(enriched)} rows")
    return enriched

def create_styled_packet_workbook(packet_num, rows, filename):
    """Creates a beautifully styled XLSX review packet workbook with sheet TO_TRANSLATE."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "TO_TRANSLATE"

    # Header styling
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Cell styling
    data_font = Font(name="Calibri", size=10)
    data_align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
    data_align_center = Alignment(horizontal="center", vertical="center")
    
    # Border styling
    thin_border = Border(
        left=Side(style="thin", color="D9D9D9"),
        right=Side(style="thin", color="D9D9D9"),
        top=Side(style="thin", color="D9D9D9"),
        bottom=Side(style="thin", color="D9D9D9")
    )
    header_border = Border(
        left=Side(style="thin", color="8EA9DB"),
        right=Side(style="thin", color="8EA9DB"),
        top=Side(style="thin", color="8EA9DB"),
        bottom=Side(style="medium", color="1B365D")
    )

    # Write Header
    ws.append(REQUIRED_TO_TRANSLATE_COLUMNS)
    ws.row_dimensions[1].height = 28

    for col_idx in range(1, len(REQUIRED_TO_TRANSLATE_COLUMNS) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = header_border

    # Center-aligned columns
    center_cols = {
        "packet_no", "character_id", "skill_id", "buff_id",
        "translation_field", "parent_buff_id", "source_table", "source_record"
    }

    # Write Data Rows
    for row_idx, r_data in enumerate(rows, start=2):
        row_vals = [r_data[col] for col in REQUIRED_TO_TRANSLATE_COLUMNS]
        ws.append(row_vals)
        ws.row_dimensions[row_idx].height = 24

        for col_idx, col_name in enumerate(REQUIRED_TO_TRANSLATE_COLUMNS, start=1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.font = data_font
            cell.border = thin_border
            if col_name in center_cols:
                cell.alignment = data_align_center
            else:
                cell.alignment = data_align_left
            
            # Highlight target translation cell softly
            if col_name == "buff_desc_vi":
                cell.fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")

    # Column Widths
    col_widths = {
        "packet_no": 12,
        "character_id": 14,
        "character_name_cn": 16,
        "character_name_vi": 20,
        "skill_id": 16,
        "skill_name_cn": 18,
        "skill_name_vi": 22,
        "buff_id": 26,
        "buff_name_cn": 20,
        "buff_name_vi": 22,
        "buff_desc_cn": 45,
        "buff_desc_vi": 45,
        "translation_field": 18,
        "parent_buff_id": 24,
        "parent_buff_name_cn": 20,
        "source_table": 16,
        "source_record": 18,
        "source_field_path": 25,
        "relation_path": 40,
        "sibling_context": 45,
        "placeholder_or_tag_notes": 35,
        "translator_notes": 40,
    }

    for col_idx, col_name in enumerate(REQUIRED_TO_TRANSLATE_COLUMNS, start=1):
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = col_widths.get(col_name, 20)

    # Freeze panes at A2
    ws.freeze_panes = "A2"
    ws.views.sheetView[0].showGridLines = True

    out_file = OUTPUT_DIR / filename
    wb.save(out_file)
    print(f"Saved packet {packet_num:02d}: {out_file} ({len(rows)} rows)")

def create_index_workbook(all_enriched_rows):
    """Creates the INDEX.xlsx manifest workbook listing all 74 Buff IDs with metadata and groupings."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "INDEX"

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    data_font = Font(name="Calibri", size=10)
    data_align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
    data_align_center = Alignment(horizontal="center", vertical="center")
    
    thin_border = Border(
        left=Side(style="thin", color="D9D9D9"),
        right=Side(style="thin", color="D9D9D9"),
        top=Side(style="thin", color="D9D9D9"),
        bottom=Side(style="thin", color="D9D9D9")
    )
    header_border = Border(
        left=Side(style="thin", color="8EA9DB"),
        right=Side(style="thin", color="8EA9DB"),
        top=Side(style="thin", color="8EA9DB"),
        bottom=Side(style="medium", color="1B365D")
    )

    # Write Header
    ws.append(INDEX_COLUMNS)
    ws.row_dimensions[1].height = 28

    for col_idx in range(1, len(INDEX_COLUMNS) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = header_border

    center_cols = {"packet_no", "character_id", "skill_id", "buff_id"}

    # Sort rows by packet_no, character_id, buff_id
    sorted_rows = sorted(all_enriched_rows, key=lambda x: (x["packet_no"], x["character_id"], x["buff_id"]))

    for row_idx, r in enumerate(sorted_rows, start=2):
        pkt_num = r["packet_no"]
        pkt_fn = PACKET_FILENAMES[pkt_num]
        vals = [
            pkt_num,
            pkt_fn,
            r["character_id"],
            r["character_name_cn"],
            r["character_name_vi"],
            r["skill_id"],
            r["skill_name_cn"],
            r["buff_id"],
            r["buff_name_cn"],
            r["buff_name_vi"],
            r["mechanic_grouping"],
        ]
        ws.append(vals)
        ws.row_dimensions[row_idx].height = 22

        for col_idx, col_name in enumerate(INDEX_COLUMNS, start=1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.font = data_font
            cell.border = thin_border
            if col_name in center_cols:
                cell.alignment = data_align_center
            else:
                cell.alignment = data_align_left

    col_widths = {
        "packet_no": 12,
        "packet_filename": 40,
        "character_id": 14,
        "character_name_cn": 16,
        "character_name_vi": 20,
        "skill_id": 16,
        "skill_name_cn": 18,
        "buff_id": 26,
        "buff_name_cn": 20,
        "buff_name_vi": 22,
        "mechanic/family grouping": 45,
    }

    for col_idx, col_name in enumerate(INDEX_COLUMNS, start=1):
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = col_widths.get(col_name, 20)

    ws.freeze_panes = "A2"
    ws.views.sheetView[0].showGridLines = True

    out_file = OUTPUT_DIR / "INDEX.xlsx"
    wb.save(out_file)
    print(f"Saved manifest: {out_file} ({len(sorted_rows)} rows)")

def main():
    print("=== PACKET-SPLITTING TASK FOR 74 UNTRANSLATED BUFF DESCRIPTIONS ===")
    
    # 0. Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Ensured output directory: {OUTPUT_DIR}")

    # 1. Load data
    char_m, skill_by_id, skill_by_group, buff_m, buffmap, skillmap = load_authoritative_data()
    audit_rows, h_map = load_audit_source()

    # 2. Enrich rows
    enriched = enrich_rows(audit_rows, h_map, char_m, skill_by_id, skill_by_group, buff_m, buffmap, skillmap)

    # 3. Partition into packets
    packets = defaultdict(list)
    for row in enriched:
        p_no = row["packet_no"]
        packets[p_no].append(row)

    print("\n--- Packet Partition Summary ---")
    for p_no in sorted(packets.keys()):
        p_rows = packets[p_no]
        p_chars = sorted(set(r["character_id"] for r in p_rows))
        print(f"Packet {p_no:02d} ({PACKET_FILENAMES[p_no]}): {len(p_rows)} rows, Characters: {', '.join(p_chars)}")

    # 4. Generate packet workbooks
    for p_no in sorted(packets.keys()):
        create_styled_packet_workbook(p_no, packets[p_no], PACKET_FILENAMES[p_no])

    # 5. Generate INDEX manifest
    create_index_workbook(enriched)

    print("\nAll workbooks generated successfully!")

if __name__ == "__main__":
    main()
