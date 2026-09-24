"""Classify localization pipeline eligibility from raw characterTable talent data."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT.parent / "NeoArtifacts" / "MasterData" / "json" / "characterTable.json"
PUBLIC = ROOT / "public" / "data.json"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    fields = {key for record in raw.values() if isinstance(record, dict) for key in record}
    field = "Talent" if "Talent" in fields else "TalentRecommend" if "TalentRecommend" in fields else ""
    if not field:
        raise RuntimeError("characterTable has no Talent/TalentRecommend field")
    public = json.loads(PUBLIC.read_text(encoding="utf-8")).get("characters", {}) if PUBLIC.exists() else {}
    rows = []
    for cid, record in sorted(raw.items()):
        if field not in record:
            classification = "INCONSISTENT_TALENT_DATA"
        elif record.get(field):
            classification = "PLAYABLE_OR_GAMEPLAY_CHARACTER"
        else:
            classification = "NPC_TALENT_EMPTY"
        rows.append({"character_id": cid, "name_cn": record.get("namelanText", ""), "talent_field": field,
                     "talent": record.get(field), "classification": classification,
                     "in_public_playable_roster": cid in public})
    counts = {key: sum(row["classification"] == key for row in rows) for key in ("PLAYABLE_OR_GAMEPLAY_CHARACTER", "NPC_TALENT_EMPTY", "INCONSISTENT_TALENT_DATA")}
    payload = {"raw_table": str(RAW), "resolved_talent_field": field, "owner_overrides": [], "counts": counts, "rows": rows}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(args.output), **counts}, ensure_ascii=False))


if __name__ == "__main__": main()
