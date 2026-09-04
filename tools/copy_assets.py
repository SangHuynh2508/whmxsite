import json
import shutil
from pathlib import Path

# Paths
calc_dir = Path(__file__).resolve().parent.parent
data_path = calc_dir / "public" / "data.json"
neo_assets = calc_dir.parent / "NeoArtifacts" / "Assets"
assets_dir = calc_dir / "public" / "assets"
out_avatars = assets_dir / "avatars"
out_items = assets_dir / "items"
out_talents = assets_dir / "talents"
out_jobs = assets_dir / "jobs"
out_cards = assets_dir / "cards"

out_avatars.mkdir(parents=True, exist_ok=True)
out_items.mkdir(parents=True, exist_ok=True)
out_talents.mkdir(parents=True, exist_ok=True)
out_jobs.mkdir(parents=True, exist_ok=True)
out_cards.mkdir(parents=True, exist_ok=True)

def copy_assets():
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    chars = data.get("characters", {})
    items = data.get("items", {})
    
    avatar_dir = neo_assets / "CharacterAvatar_runtime"
    item_dir = neo_assets / "ItemIcons"
    
    c_count = 0
    i_count = 0
    missing_chars = []
    
    # 1. Characters
    for cid in chars.keys():
        # Try {cid}001.png or {cid}101.png
        src = avatar_dir / f"{cid}001.png"
        if not src.exists():
            src = avatar_dir / f"{cid}101.png"
            if not src.exists():
                if cid == "W0021" and (avatar_dir / "CS21001.png").exists():
                    src = avatar_dir / "CS21001.png"
                else:
                    # Glob anything starting with cid
                    matches = list(avatar_dir.glob(f"{cid}*.png"))
                    if matches:
                        src = matches[0]
                    else:
                        missing_chars.append(cid)
                        continue
                    
        dst = out_avatars / f"{cid}.png"
        shutil.copy2(src, dst)
        c_count += 1
        
    # 2. Items
    for iid in items.keys():
        src = item_dir / f"itemicon_{iid}.png"
        if src.exists():
            dst = out_items / f"itemicon_{iid}.png"
            shutil.copy2(src, dst)
            i_count += 1
            
    # 3. Talents
    talent_dir = neo_assets / "TalentIcons_runtime"
    t_count = 0
    if talent_dir.exists():
        for src in talent_dir.glob("*.png"):
            dst = out_talents / src.name
            shutil.copy2(src, dst)
            t_count += 1
            
    # 4. Jobs & Class Badges
    job_src = neo_assets / "HeroRes_All"
    j_count = 0
    if job_src.exists():
        for src in job_src.glob("ui_yc_*.png"):
            dst = out_jobs / src.name
            shutil.copy2(src, dst)
            j_count += 1

    # 5. Cards
    card_dir = neo_assets / "CharacterCards_runtime"
    card_count = 0
    if card_dir.exists():
        for src in card_dir.glob("*.png"):
            dst = out_cards / src.name
            shutil.copy2(src, dst)
            card_count += 1
        if (card_dir / "A0121001.png").exists() and not (out_cards / "W0021001.png").exists():
            shutil.copy2(card_dir / "A0121001.png", out_cards / "W0021001.png")
            card_count += 1

    # 6. Card Frames (TicketCandidates / Packet61)
    out_frames = assets_dir / "frames"
    out_frames.mkdir(parents=True, exist_ok=True)
    frame_src = neo_assets / "Packet61_AllSprites" / "1fe207caf6be73ffd5af2d16c5c1b675"
    frame_count = 0
    if frame_src.exists():
        for fname in ["ui_ty_kp_di1.png", "ui_ty_kp_di2.png", "ui_ty_kp_bian.png"]:
            src = frame_src / fname
            if src.exists():
                shutil.copy2(src, out_frames / fname)
                frame_count += 1
            
    print(f"Copied {c_count} avatars, {i_count} item icons, {t_count} talent icons, {j_count} job icons, {card_count} card images, and {frame_count} frame layers.")
    if missing_chars:
        print(f"Missing avatars for: {', '.join(missing_chars)}")

if __name__ == "__main__":
    copy_assets()
