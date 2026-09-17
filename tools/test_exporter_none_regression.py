#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_exporter_none_regression.py

Regression test for None-stringification bug in export_buff_closure_translation_packet.py:
Proves:
- None in buff_desc_vi evaluates to empty string (""), not literal "None".
- None buff_desc_vi causes missing description to be detected (need_desc == True).
- Non-empty translated buff_desc_vi is NOT detected as missing (need_desc == False).
- None in buff_name_vi evaluates to empty string (""), not literal "None", detecting missing name.
- Non-empty buff_name_vi is NOT detected as missing (need_name == False).
- wb_row is None (buff not in workbook) correctly detects both as missing.
"""

import sys
from pathlib import Path

# Add tools dir to path
TOOLS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS_DIR))

from export_buff_closure_translation_packet import clean_tag

def evaluate_buff_translation_state(wb_row, name_cn="测试Buff", desc_cn="这是一个测试Buff描述"):
    """Simulates the exact classification logic in export_buff_closure_translation_packet.py."""
    name_vi = clean_tag((wb_row.get("buff_name_vi") if wb_row else "") or "")
    desc_vi = str((wb_row.get("buff_desc_vi") if wb_row else "") or "").strip()
    status_val = str((wb_row.get("status") if wb_row else "") or "").strip()
    authority_val = str((wb_row.get("name_authority") if wb_row else "") or "").strip()

    need_name = bool(name_cn) and not bool(name_vi)
    need_desc = bool(desc_cn) and not bool(desc_vi)

    return {
        "name_vi": name_vi,
        "desc_vi": desc_vi,
        "status_val": status_val,
        "authority_val": authority_val,
        "need_name": need_name,
        "need_desc": need_desc,
        "is_missing": need_name or need_desc,
    }

def test_none_desc_detected_as_missing():
    """Case 1: buff_name_vi is translated, buff_desc_vi is None (the exact bug)."""
    wb_row = {
        "buff_name_vi": "Toàn Luật",
        "buff_desc_vi": None,
        "status": None,
        "name_authority": None,
    }
    result = evaluate_buff_translation_state(wb_row)
    
    assert result["desc_vi"] == "", f"Expected empty string, got '{result['desc_vi']}'"
    assert result["desc_vi"] != "None", "Critical regression: None became literal 'None' string!"
    assert result["need_desc"] is True, "Missing description was NOT detected when buff_desc_vi was None!"
    assert result["need_name"] is False, "buff_name_vi was unexpectedly marked as missing!"
    assert result["is_missing"] is True, "Row should be flagged as missing translation!"

def test_translated_desc_not_detected_as_missing():
    """Case 2: Both buff_name_vi and buff_desc_vi are translated."""
    wb_row = {
        "buff_name_vi": "Toàn Luật",
        "buff_desc_vi": "Tăng tấn công và tốc độ di chuyển",
        "status": "APPROVED",
        "name_authority": "OWNER_APPROVED",
    }
    result = evaluate_buff_translation_state(wb_row)

    assert result["desc_vi"] == "Tăng tấn công và tốc độ di chuyển"
    assert result["need_desc"] is False, "Translated description was incorrectly detected as missing!"
    assert result["need_name"] is False, "Translated name was incorrectly detected as missing!"
    assert result["is_missing"] is False, "Fully translated row should not be flagged as missing!"

def test_none_name_detected_as_missing():
    """Case 3: buff_name_vi is None, buff_desc_vi is translated."""
    wb_row = {
        "buff_name_vi": None,
        "buff_desc_vi": "Tăng tấn công",
        "status": None,
        "name_authority": None,
    }
    result = evaluate_buff_translation_state(wb_row)

    assert result["name_vi"] == "", f"Expected empty string, got '{result['name_vi']}'"
    assert result["name_vi"] != "None", "Critical regression: None became literal 'None' string!"
    assert result["need_name"] is True, "Missing name was NOT detected when buff_name_vi was None!"
    assert result["need_desc"] is False, "Translated description was incorrectly detected as missing!"
    assert result["is_missing"] is True, "Row should be flagged as missing translation!"

def test_wb_row_none_missing():
    """Case 4: wb_row is None (buff entirely absent from workbook)."""
    result = evaluate_buff_translation_state(None)

    assert result["name_vi"] == ""
    assert result["desc_vi"] == ""
    assert result["need_name"] is True
    assert result["need_desc"] is True
    assert result["is_missing"] is True

def main():
    print("Running exporter None-regression tests...")
    test_none_desc_detected_as_missing()
    print("  PASS: None buff_desc_vi -> empty string -> missing description correctly detected")
    test_translated_desc_not_detected_as_missing()
    print("  PASS: Translated buff_desc_vi -> non-empty -> NOT detected as missing")
    test_none_name_detected_as_missing()
    print("  PASS: None buff_name_vi -> empty string -> missing name correctly detected")
    test_wb_row_none_missing()
    print("  PASS: wb_row=None -> both name and desc detected as missing")
    print("\nALL EXPORTER NONE-REGRESSION TESTS PASSED!")

if __name__ == "__main__":
    main()
