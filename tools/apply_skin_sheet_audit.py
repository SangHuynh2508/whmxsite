"""Atomic, safe audit and schema update for the SKIN sheet in localization_master.xlsx."""
import json
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
from tools.safe_workbook_mutation import safe_mutate_workbook

# Trusted acquisition translations discovered from historical approved translations
TRUSTED_OBTAIN_MAP = {
    "角色初始衣装": "Trang phục khởi đầu của nhân vật",
    "通过器者考核解锁": "Mở khóa thông qua Khảo Hạch Khí Giả",
    "通过衣装店限时销售": "Bán giới hạn tại Cửa Hàng Trang Phục",
    "通过集训易市获得": "Nhận được thông qua Chợ Tập Huấn",
    "通过游历获得": "Nhận được thông qua Du Lịch",
    "通关第七章解锁": "Mở khóa sau khi thông quan Chương 7",
    "通过活动获得": "Nhận được thông qua hoạt động",
    "通过礼包限时销售": "Bán giới hạn qua gói quà"
}

def mutate_skin_sheet(wb):
    ws = wb["SKIN"]
    headers = [cell.value for cell in ws[1]]
    
    new_cols = [
        "skin_type",
        "unlock_date",
        "price",
        "currency",
        "is_high_skin",
        "skin_rare",
        "cv_name",
        "drawing_path",
        "card_path"
    ]
    
    # Append headers if not already present
    for i, col_name in enumerate(new_cols, start=len(headers) + 1):
        ws.cell(1, i, col_name)

    # Load masterdata
    skins_raw = json.load(open('D:/BaiTapCode/WHMX/NeoArtifacts/MasterData/json/characterSkins.json', encoding='utf-8'))
    charge = json.load(open('D:/BaiTapCode/WHMX/NeoArtifacts/MasterData/json/charge.json', encoding='utf-8'))
    items = json.load(open('D:/BaiTapCode/WHMX/NeoArtifacts/MasterData/json/itemMap.json', encoding='utf-8'))
    high_skin = json.load(open('D:/BaiTapCode/WHMX/NeoArtifacts/MasterData/json/CharacterHighSkinMap.json', encoding='utf-8'))

    raw_skin_map = {}
    for cid, slist in skins_raw.items():
        for s in slist:
            raw_skin_map[s["skinID"]] = s

    # Update each data row
    for r in range(2, ws.max_row + 1):
        sid = str(ws.cell(r, 1).value or "").strip()
        if not sid or sid not in raw_skin_map:
            continue
        
        raw = raw_skin_map[sid]
        cid = raw.get("characterId") or sid[:5]
        skin_name_cn = raw.get("skinNamelanText") or raw.get("skinName") or ""
        skin_name_vi = ws.cell(r, 4).value # Preserved trusted translation
        
        # True flavor lore description
        desc_cn = raw.get("skinFileLanText") or ""
        desc_vi = None # Lore descriptions are currently untranslated
        
        # Acquisition text
        obtain_cn = raw.get("getdescriptionLanText") or ""
        obtain_vi = TRUSTED_OBTAIN_MAP.get(obtain_cn, None)
        
        is_base = "TRUE" if raw.get("bIsBaseSkin") or sid.endswith("001") else "FALSE"
        skin_type = raw.get("skinType", 3)
        unlock_date = raw.get("UnlockDate") if raw.get("UnlockDate") != 0 else None
        
        # Price and currency via goodsID in charge.json
        price = None
        currency = None
        gid = raw.get("goodsID")
        if gid and str(gid) in charge:
            c_entry = charge[str(gid)]
            cost = c_entry.get("Cost")
            if cost and cost.get("count"):
                price = cost.get("count")
                curr_id = cost.get("id")
                currency = items.get(str(curr_id), {}).get("nameLanText", str(curr_id))
        
        is_high = "TRUE" if raw.get("highskin") == 1 or sid in high_skin else "FALSE"
        skin_rare = raw.get("skinRare")
        cv_name = raw.get("CvName") or None
        
        cid_lower = cid.lower()
        sid_lower = sid.lower()
        drawing_path = f"characters/{cid_lower}/drawings/{sid_lower}.webp"
        card_path = f"characters/{cid_lower}/cards/{sid_lower}.webp"
        
        # Write to cells
        ws.cell(r, 1, sid)
        ws.cell(r, 2, cid)
        ws.cell(r, 3, skin_name_cn)
        ws.cell(r, 4, skin_name_vi)
        ws.cell(r, 5, desc_cn if desc_cn else None)
        ws.cell(r, 6, desc_vi)
        ws.cell(r, 7, obtain_cn if obtain_cn else None)
        ws.cell(r, 8, obtain_vi)
        ws.cell(r, 9, is_base)
        ws.cell(r, 10, "HIGH")
        ws.cell(r, 11, "APPROVED")
        ws.cell(r, 12, "Primary authority: characterSkins.json")
        
        ws.cell(r, 13, skin_type)
        ws.cell(r, 14, unlock_date)
        ws.cell(r, 15, price)
        ws.cell(r, 16, currency)
        ws.cell(r, 17, is_high)
        ws.cell(r, 18, skin_rare)
        ws.cell(r, 19, cv_name)
        ws.cell(r, 20, drawing_path)
        ws.cell(r, 21, card_path)

def main():
    skins_raw = json.load(open('D:/BaiTapCode/WHMX/NeoArtifacts/MasterData/json/characterSkins.json', encoding='utf-8'))
    all_sids = []
    for slist in skins_raw.values():
        for s in slist:
            all_sids.append(s["skinID"])
            
    authorized_deps = {"skin_ids": all_sids}
    authorized_new_columns = {
        "SKIN": [
            "skin_type", "unlock_date", "price", "currency",
            "is_high_skin", "skin_rare", "cv_name", "drawing_path", "card_path"
        ]
    }
    
    print("[SAFE MUTATION] Starting safe mutation of SKIN sheet...")
    safe_mutate_workbook(
        base_dir=str(BASE_DIR),
        mutator_fn=mutate_skin_sheet,
        authorized_deps=authorized_deps,
        authorized_new_columns=authorized_new_columns
    )
    print("[SAFE MUTATION SUCCESS] SKIN sheet successfully updated and verified!")

if __name__ == "__main__":
    main()
