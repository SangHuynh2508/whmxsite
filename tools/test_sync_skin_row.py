# tools/test_sync_skin_row.py
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from sync_masterdata_incremental import skin_row  # noqa: E402

SKIN = {"skinID": "W0099004", "skinType": 3, "skinNamelanText": "曲中拾遗", "skinFileLanText": "desc",
        "getdescriptionLanText": "通过衣装店限时销售", "bIsBaseSkin": False, "UnlockDate": 1790733540,
        "highskin": 0, "skinRare": 3, "CvName": "", "skinLOGO": 207, "mapItemsID": "9099004",
        "goodsID": "530490005", "discountGoodsID": "520490005"}
CHARGE = {"530490005": {"Cost": {"id": "8", "count": 160}},
          "520490005": {"Cost": {"id": "8", "count": 144}, "StartTime": 1, "EndTime": 2}}


def test_skin_row_matches_the_existing_sheet_columns():
    row = skin_row(SKIN, "W0099", {}, CHARGE, {})
    assert row["is_base_skin"] == "FALSE" and row["skin_type"] == 3 and row["cv_name"] is None
    assert (row["price"], row["currency"]) == (160, "Vé Trang Phục")
    assert (row["discount_price"], row["discount_start"], row["discount_end"]) == (144, 1, 2)
    assert row["drawing_path"] == "characters/w0099/drawings/w0099004.webp"
    assert row["avatar_path"] == "characters/w0099/avatars/w0099004.png"
    assert (row["series_id"], row["item_id"]) == (207, "9099004")


def test_zero_or_missing_price_stays_empty():
    row = skin_row({**SKIN, "goodsID": "", "discountGoodsID": ""}, "W0099", {}, {"x": {}}, {})
    assert (row["price"], row["currency"], row["goods_id"], row["discount_price"]) == (None, None, None, None)
    row = skin_row(SKIN, "W0099", {}, {"530490005": {"Cost": {"id": "8", "count": 0}}}, {})
    assert (row["price"], row["currency"]) == (None, None)
