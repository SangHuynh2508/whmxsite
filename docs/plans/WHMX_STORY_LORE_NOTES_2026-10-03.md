# WHMX — Story lore: what exists and what it needs (notes, not a spec)

> Survey of 2026-10-02/03 (read-only, runtime r3075). The owner parked story lore to build the tea room (phòng trà)
> first. Pick this up when lore restarts; the design questions are not asked yet. Entry point:
> [`../WHMX_CURRENT_STATE_FINAL_2026-10-02.md`](../WHMX_CURRENT_STATE_FINAL_2026-10-02.md).

## 1. Text (already gathered)

- `D:\BaiTapCode\WHMX\WHMX_Lore_By_Chapter\` (r3057, regenerated 2026-09-30; README + `INDEX.tsv`): one TXT per script,
  speakers resolved, **Chinese only — nothing is translated**. Regenerate: `python ../_claude_scratch/r3057_explore/build_lore_by_chapter.py`
  from `NeoArtifacts` (needs `odin.py`, `inspect_ab.py`, `lang*.json` beside it).
- Scripts: Main_Story 158, Events 425, Side_Stories_B 49, Side_Stories_C 51 (one per character), Other_Stories 60,
  LAN_Only 10 (text with no stage nodes). ~68 000 spoken lines: playable characters ~38 700, narrator ~12 800,
  player ~6 700, NPC ~12 000. Chapter/event/branch names come from explicit MasterData relations (README); 10 event
  groups have no name in any table.

## 2. Images tied to the text (yes — scene by scene)

Each stage node of `novel.ab` (`NovelNodeAsset.NodesList`) carries `BackgroundData.AssetName`; the TXT files already
mark every change as `〔背景 <name>〕`.

| Fact | Value |
|---|---|
| Scripts with background marks | 743 / 753 (all except LAN_Only) |
| Background changes | 5 348 (~7 per script) |
| Distinct images | 1 184: ~635 backgrounds `bg_*`, **549 CG** `cg_*`/`CG_*`; 338 scripts show at least one CG |
| Name → game bundle | 1 152 / 1 184 match `images_novel_background_<name>.ab` exactly (`ABList.PathList` of the r3075 `data.dat`). The 32 misses all end in `_sex` — meaning unverified (guess: player-gender variant) |
| Size / format | 1680 × 720 (21:9) PNG ~1.7 MB; WebP q80 ~138 KB (≈160 MB for all), at 1120 px wide ~66 KB (≈75 MB) — R2, not `public/assets` |
| On disk | 74 extracted (`_claude_scratch/r3057_explore/img/images_novel_background_*`, contact sheet `sheet_2_story_backgrounds.jpg`); 132 / 1 151 bundles in `NeoArtifacts/Assets/runtime_bundle_cache` |
| Missing | ~1 019 bundles → **ADB pull from MuMu (owner yes first)**, then decrypt (`N.decrypt_unityfs_ab`) → PNG → WebP → R2 |

## 3. Speaker icons (chat-log layout like the owner's Arknights screenshot is possible)

- **Speaker table** `NovelNameText` (in `novel.ab`, 1 207 rows: id, CN name, traditional name, **visual id**): 445 rows
  name a visual — a character id (`N1 → W0051`) or an NPC sprite id (`N6 → npc_1_tongcanju`). Decoder: `read_names()` in
  `build_lore_by_chapter.py`. Rows without a visual (`N8 ？？？`, `N224 工作人员`…) get a default icon — never guessed.
- **Playable characters:** the site's avatars cover 36 537 of ~38 700 lines; missing are characters not on the site
  (W0185, A0082, V0098, W0158, D0067, D0152, A0142, S0066, D0135, W0133, V0044, S0022).
- **NPCs:** `images_novel_npchead.ab` = **193 head icons 128 × 128** (in the local cache; sample
  `_claude_scratch/npchead_sample.png`); ~75 `images_novel_npc_*` full-body bundles. ~4 100 of ~12 000 NPC lines resolve
  to an NPC image through the speaker table; the rest have no visual in the game data.
- Player (玩家) has no icon; narrator lines need none.

## 4. Other per-node data (not needed for a first version)

- `Character1/2/3Data`: who stands on stage, with layered `CharacterBody/Hair/Face` + `FaceId`; `NovelFaceAsset` maps
  expressions (`W0051_happy`, `_sadness`, `_anger`…) to textures/Spine. Showing these means assembling layers (done once
  by hand for W0185: `_claude_scratch/skipped_preview/W0185_novel_assembled.png`) — expensive.
- `StoryboradList` (game's spelling; `images_novel_storyboard*`, ~316 panels, rare), `Item1Data` (`images_novel_item`,
  37 close-ups), `EffectInfo`, `CameraData`, `AudioData`/BGM bundles `audio_bgm_novel_*` — not examined further.

## 5. What a lore reader needs (to decide later)

1. Translation of ~68 000 lines (game-translator skill; where VI lives: DB + Admin like profile lore, or another path).
2. Asset step: ADB pull, extraction, WebP, R2 upload, name → URL manifest; a release-day step for new scripts.
3. Reader UI: chapter list (Main / Events / Side / Character stories), scene background behind the text, CG inline,
   speaker icon per line, choices (`▸ 选项`) shown as options.
4. Recommendation given 2026-10-02: text + scene background/CG + one fixed icon per speaker; expressions/stage sprites later.

## 6. Scratch files (not in git)

`D:\BaiTapCode\WHMX\_claude_scratch\`: `lore_bg_names.txt` (1 184 names), `lore_bg_map.json` (name → bundle),
`novel_survey.py` (mapping script), `npchead_sample.png`; raw nodes of e051/e052/t001 in
`r3057_explore/scripts/_raw_new_scripts.json` (+ `_raw_novel_misc.json`: character sprite tables, `NovelFace`).
