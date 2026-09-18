import json
import shutil
from pathlib import Path

# Paths
calc_dir = Path(__file__).resolve().parent.parent
neo_assets = calc_dir.parent / "NeoArtifacts" / "Assets"
assets_dir = calc_dir / "public" / "assets"

# New current NeoArtifacts outputs
characters_root = neo_assets / "characters"
huanzhang_root = neo_assets / "huanzhang"

# Public web destinations
out_avatars = assets_dir / "characters" / "avatars"
out_skills = assets_dir / "skills"
out_huanzhang = assets_dir / "huanzhang"
out_items = assets_dir / "items"
out_talents = assets_dir / "talents"
out_jobs = assets_dir / "jobs"
out_frames = assets_dir / "frames"
out_skillrange = assets_dir / "skill-range"

for directory in (
    out_avatars,
    out_skills,
    out_huanzhang,
    out_items,
    out_talents,
    out_jobs,
    out_frames,
    out_skillrange,
):
    directory.mkdir(parents=True, exist_ok=True)


def read_manifest_status(root: Path) -> str:
    """Return current materialization status, or MISSING if no usable manifest exists."""
    path = root / "manifest.json"
    if not path.exists():
        return "MISSING"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return "INVALID"

    return str(
        data.get("character_status")
        or data.get("status")
        or "UNKNOWN"
    ).upper()


def copy_all_pngs(src_dir: Path, dst_dir: Path) -> int:
    count = 0
    if not src_dir.exists():
        return count
    for src in sorted(src_dir.glob("*.png")):
        shutil.copy2(src, dst_dir / src.name)
        count += 1
    return count


def choose_avatar(cid: str, avatar_dir: Path) -> Path | None:
    """Prefer the base 001 avatar; otherwise use the first deterministic PNG."""
    if not avatar_dir.exists():
        return None

    preferred_names = (
        f"{cid}001.png",
        f"{cid.lower()}001.png",
        f"{cid}101.png",
        f"{cid.lower()}101.png",
    )
    for name in preferred_names:
        candidate = avatar_dir / name
        if candidate.exists():
            return candidate

    matches = sorted(avatar_dir.glob("*.png"), key=lambda p: p.name.lower())
    return matches[0] if matches else None


def copy_character_assets() -> dict[str, object]:
    summary: dict[str, object] = {
        "characters_complete_seen": 0,
        "characters_skipped_noncomplete": [],
        "avatars": 0,
        "skill_icons": 0,
        "missing_avatar": [],
    }

    if not characters_root.exists():
        return summary

    for char_dir in sorted((p for p in characters_root.iterdir() if p.is_dir()), key=lambda p: p.name):
        cid = char_dir.name
        status = read_manifest_status(char_dir)
        if status != "COMPLETE":
            summary["characters_skipped_noncomplete"].append({"character_id": cid, "status": status})
            continue

        summary["characters_complete_seen"] += 1

        avatar = choose_avatar(cid, char_dir / "avatar")
        if avatar is not None:
            shutil.copy2(avatar, out_avatars / f"{cid}.png")
            summary["avatars"] += 1
        else:
            summary["missing_avatar"].append(cid)

        # Copy all individual and skin avatar variants in canonical lowercase
        avatar_dir = char_dir / "avatar"
        if avatar_dir.exists():
            for src in avatar_dir.glob("*.png"):
                shutil.copy2(src, out_avatars / src.name.lower())

        summary["skill_icons"] += copy_all_pngs(char_dir / "skill_icon", out_skills)

    return summary


def copy_huanzhang_assets() -> dict[str, object]:
    status = read_manifest_status(huanzhang_root)
    copied = 0
    if status == "COMPLETE":
        copied = copy_all_pngs(huanzhang_root, out_huanzhang)
    return {"status": status, "icons": copied}


def copy_legacy_global_assets() -> dict[str, int]:
    """Keep global categories on their existing sources until dedicated NeoArtifacts pipelines exist."""
    result = {
        "item_icons": 0,
        "talent_icons": 0,
        "job_icons": 0,
        "frame_layers": 0,
        "skill_range_images": 0,
    }

    item_dir = neo_assets / "ItemIcons"
    result["item_icons"] = copy_all_pngs(item_dir, out_items)

    talent_dir = neo_assets / "TalentIcons_runtime"
    result["talent_icons"] = copy_all_pngs(talent_dir, out_talents)

    job_src = neo_assets / "HeroRes_All"
    if job_src.exists():
        for src in sorted(job_src.glob("ui_yc_*.png")):
            shutil.copy2(src, out_jobs / src.name)
            result["job_icons"] += 1

    frame_src = neo_assets / "Packet61_AllSprites" / "1fe207caf6be73ffd5af2d16c5c1b675"
    if frame_src.exists():
        for fname in ("ui_ty_kp_di1.png", "ui_ty_kp_di2.png", "ui_ty_kp_bian.png"):
            src = frame_src / fname
            if src.exists():
                shutil.copy2(src, out_frames / fname)
                result["frame_layers"] += 1

    range_dir = neo_assets / "SkillRange"
    result["skill_range_images"] = copy_all_pngs(range_dir, out_skillrange)

    return result


def copy_assets() -> None:
    character = copy_character_assets()
    huanzhang = copy_huanzhang_assets()
    global_assets = copy_legacy_global_assets()

    report = {
        "character_assets": character,
        "huanzhang_assets": huanzhang,
        "legacy_global_assets": global_assets,
        "notes": [
            "Character avatars and skill icons come from NeoArtifacts/Assets/characters/<ID>/...",
            "Character cards and drawings are published by tools/publish_assets.py and are never copied into public/.",
            "Hoan Chuong icons now come from NeoArtifacts/Assets/huanzhang/.",
            "Item/talent/job/frame/skill-range still use legacy global sources until dedicated pipelines exist.",
            "This migration is non-destructive: it overwrites matching public files but does not delete stale public assets.",
        ],
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    copy_assets()
