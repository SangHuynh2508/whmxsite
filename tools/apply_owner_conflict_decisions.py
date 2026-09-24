"""Apply explicit owner choices from the old-batch conflict review.

Only ``owner_decision`` controls mutation.  The review's recommended action is
deliberately ignored.  The command has an inspectable dry-run default.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from collections import Counter, defaultdict
from copy import copy
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook, load_workbook

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "localization" / "localization_master.xlsx"
REVIEW = ROOT / "localization" / "batch_reports" / "old_batch_conflicts_20260910.xlsx"
OLD_BATCH = ROOT / "localization" / "batches" / "character_translation_batch_skill_huanzhang_completed.xlsx"
BACKUPS = ROOT / "localization" / "backups"
REPORTS = ROOT / "localization" / "batch_reports"
PRIMARY = {"SKILL": ("skill_id",), "BUFF_STATUS": ("buff_id",)}
CANONICAL = {
    "万籁沉寂": "Vạn Âm Trầm Tịch", "瞄准": "Miêu Chuẩn", "脆弱": "Thúy Nhược",
    "蓄势": "Súc Thế", "滞缓": "Trệ Hoãn", "萧瑟": "Tiêu Sắt", "截招": "Tiệt Chiêu",
    "通用增伤": "Tăng Sát Thương Chung",
}
LEGACY = {
    "万籁沉寂": ("Vạn Lại Trầm Tịch",), "瞄准": ("Nhắm Bắn", "Nhắm"),
    "脆弱": ("Dễ Vỡ", "Tùy Nhược"), "蓄势": ("Tích Thế",),
    "滞缓": ("Trì Trệ",), "萧瑟": (), "截招": (),
    "通用增伤": ("Thông Dụng Tăng Thương",),
}
BUFF_RE = re.compile(r"\{(Buff_[^}\s]+)\}", re.I)


def s(v): return "" if v is None else str(v)
def norm(v): return s(v).strip().upper()
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def header(ws): return {s(c.value): c.column for c in ws[1] if c.value is not None}
def row(ws, r, h): return {name: ws.cell(r, col).value for name, col in h.items()}
def key(sheet, data): return tuple(norm(data.get(c)) for c in PRIMARY[sheet])


def indexed(ws, sheet):
    h=header(ws); out={}; dup=[]
    for r in range(2, ws.max_row+1):
        data=row(ws,r,h); k=key(sheet,data)
        if not all(k) or k in out: dup.append(k)
        else: out[k]=(r,data)
    return h,out,dup


def pairs(data):
    return [(name[:-3]+"_cn", name) for name in data if name.endswith("_vi") and name[:-3]+"_cn" in data]


def report_rows(review):
    ws=review["CONFLICT_REVIEW"]; h=header(ws); out=[]
    for r in range(2,ws.max_row+1):
        data=row(ws,r,h); decision=s(data.get("owner_decision")).strip().lower()
        out.append((r,data,decision))
    return out


def lock_check(master):
    locks=list(master.parent.glob(f"~${master.name}"))
    if locks: raise RuntimeError(f"Excel lock detected: {locks}")


def make_plan(master_path, review_path, old_batch_path):
    master=load_workbook(master_path,data_only=False); review=load_workbook(review_path,data_only=False); batch=load_workbook(old_batch_path,data_only=False)
    mi={sheet:indexed(master[sheet],sheet) for sheet in PRIMARY}; bi={sheet:indexed(batch[sheet],sheet) for sheet in PRIMARY}
    plan=[]; invalid=[]; deferred=[]; duplicate=[]
    for sheet,(_,_,dupes) in mi.items(): duplicate += [{"workbook":"master","sheet":sheet,"key":list(x)} for x in dupes]
    for sheet,(_,_,dupes) in bi.items(): duplicate += [{"workbook":"batch","sheet":sheet,"key":list(x)} for x in dupes]
    seen={}
    for review_row, data, decision in report_rows(review):
        sheet=s(data.get("sheet")); exact=s(data.get("exact_id")); k=tuple(norm(x) for x in exact.split(":"))
        if decision not in {"master","batch",""}:
            invalid.append({"review_row":review_row,"sheet":sheet,"exact_id":exact,"value":data.get("owner_decision")}); continue
        if not decision:
            deferred.append({"review_row":review_row,"sheet":sheet,"exact_id":exact,"reason":"DEFERRED"}); continue
        if sheet not in PRIMARY or k not in mi[sheet][1] or k not in bi[sheet][1]:
            deferred.append({"review_row":review_row,"sheet":sheet,"exact_id":exact,"reason":"MISSING_TARGET"}); continue
        if (sheet,k) in seen and seen[(sheet,k)] != decision:
            invalid.append({"review_row":review_row,"sheet":sheet,"exact_id":exact,"value":f"conflicts with {seen[(sheet,k)]}"}); continue
        seen[(sheet,k)]=decision
        _,mdata=mi[sheet][1][k]; _,bdata=bi[sheet][1][k]
        source_changed=[]
        # The review stores only the fields originally in conflict.  Never copy
        # an unreviewed VI field from the historical batch.
        fields=json.loads(s(data.get("batch_vi")) or "{}")
        for vi in fields:
            cn=vi[:-3]+"_cn" if vi.endswith("_vi") else ""
            if not cn or s(mdata.get(cn)) != s(bdata.get(cn)):
                source_changed.append({"field":vi,"batch_cn":s(bdata.get(cn)),"master_cn":s(mdata.get(cn))})
        if source_changed:
            deferred.append({"review_row":review_row,"sheet":sheet,"exact_id":exact,"reason":"SOURCE_CHANGED","fields":source_changed}); continue
        plan.append({"review_row":review_row,"sheet":sheet,"key":list(k),"decision":decision,"fields":fields,"master":mdata,"batch":bdata})
    return {"plan":plan,"invalid":invalid,"deferred":deferred,"duplicates":duplicate}


def canonicalize_value(value, cn):
    value=s(value); changes=[]
    for term, canonical in CANONICAL.items():
        if term not in s(cn): continue
        for old in LEGACY[term]:
            if old in value:
                value=value.replace(old,canonical); changes.append({"source_term":term,"old":old,"new":canonical})
    return value,changes


def apply_plan(master_path, plan):
    lock_check(master_path); before_hash=sha(master_path); stamp=datetime.now().strftime("%Y%m%d_%H%M%S")
    BACKUPS.mkdir(parents=True,exist_ok=True); backup=BACKUPS/f"localization_master_pre_owner_conflict_{stamp}.xlsx"; shutil.copy2(master_path,backup)
    if sha(backup)!=before_hash: raise RuntimeError("Backup hash mismatch")
    wb=load_workbook(master_path,data_only=False); indexes={sheet:indexed(wb[sheet],sheet) for sheet in PRIMARY}
    changes=[]; canonical=[]
    for item in plan:
        sheet=item["sheet"]; h,lookup,_=indexes[sheet]; r,mdata=lookup[tuple(item["key"])]
        if item["decision"]=="batch":
            for vi in item["fields"]:
                if vi not in h or not vi.endswith("_vi"): continue
                source=vi[:-3]+"_cn"; incoming=s(item["batch"].get(vi)); normalized,migrations=canonicalize_value(incoming,mdata.get(source))
                old=wb[sheet].cell(r,h[vi]).value; wb[sheet].cell(r,h[vi]).value=normalized
                changes.append({"sheet":sheet,"key":item["key"],"field":vi,"old":s(old),"new":normalized,"owner_choice":"batch"})
                canonical.extend({"sheet":sheet,"key":item["key"],"field":vi,**x,"after_owner_batch":True} for x in migrations)
            if "notes" in h:
                cell=wb[sheet].cell(r,h["notes"]); marker="OWNER_SELECTED_BATCH_FROM_CONFLICT_REVIEW_20260910"
                if marker not in s(cell.value): cell.value=(s(cell.value).rstrip("; ")+"; "+marker).strip("; ")
        else:
            # Master choice is intentionally data-noop; still canonicalize only
            # exact source-backed named references below.
            changes.append({"sheet":sheet,"key":item["key"],"field":"","owner_choice":"master","action":"KEEP_MASTER"})
    # Project-wide exact source-to-named-reference migration.  Notes/history are
    # never scanned, and ordinary prose without the exact CN source is untouched.
    for sheet in wb.sheetnames:
        ws=wb[sheet]; h=header(ws)
        for cn,vi in [(x[:-3]+"_cn",x) for x in h if x.endswith("_vi") and x[:-3]+"_cn" in h]:
            for r in range(2,ws.max_row+1):
                old=s(ws.cell(r,h[vi]).value); new,migrations=canonicalize_value(old,ws.cell(r,h[cn]).value)
                if new!=old:
                    ws.cell(r,h[vi]).value=new
                    canonical.extend({"sheet":sheet,"row":r,"field":vi,**x,"after_owner_batch":False} for x in migrations)
    wb.save(master_path)
    return backup,before_hash,changes,canonical


def integrity(before_path, after_path, changes, canonical):
    before=load_workbook(before_path,data_only=False); after=load_workbook(after_path,data_only=False)
    allowed={(x["sheet"],tuple(x["key"]),x["field"]) for x in changes if x.get("field")}
    for x in canonical:
        sheet=x["sheet"]
        if sheet not in PRIMARY: continue
        h=header(after[sheet]); k=key(sheet,row(after[sheet],x["row"],h)) if "row" in x else tuple(x["key"])
        allowed.add((sheet,k,x["field"]))
    unexpected=[]; duplicates=[]
    if before.sheetnames!=after.sheetnames: unexpected.append(["workbook","topology"])
    for sheet in PRIMARY:
        bh,bi,bd=indexed(before[sheet],sheet); ah,ai,ad=indexed(after[sheet],sheet)
        if bd or ad or set(bi)!=set(ai): duplicates.append(sheet); continue
        for k,(br,_) in bi.items():
            ar,_=ai[k]
            for name,col in bh.items():
                if before[sheet].cell(br,col).value!=after[sheet].cell(ar,ah[name]).value and (sheet,k,name) not in allowed and name!="notes": unexpected.append([sheet,list(k),name])
    return {"pass":not unexpected and not duplicates,"unexpected_cells":unexpected,"duplicate_or_key_failure":duplicates,"sheet_topology":before.sheetnames==after.sheetnames}


def remaining_review(plan_result, output):
    rows=[]
    for item in plan_result["deferred"]: rows.append({"sheet":item["sheet"],"exact_id":item["exact_id"],"resolution":item["reason"],"owner_decision":""})
    for item in plan_result["invalid"]: rows.append({"sheet":item["sheet"],"exact_id":item["exact_id"],"resolution":"INVALID_OWNER_DECISION","owner_decision":item["value"]})
    wb=Workbook(); ws=wb.active; ws.title="UNRESOLVED_CONFLICTS"; headers=list(rows[0]) if rows else ["sheet","exact_id","resolution","owner_decision"]; ws.append(headers)
    for item in rows: ws.append([item.get(x,"") for x in headers])
    output.parent.mkdir(parents=True,exist_ok=True); wb.save(output); return len(rows)


def buff_context(master_path, output):
    wb=load_workbook(master_path,data_only=False); ws=wb["BUFF_STATUS"]; h=header(ws); buffs={}
    for r in range(2,ws.max_row+1):
        data=row(ws,r,h); bid=s(data.get("buff_id")); cn=s(data.get("buff_name_cn")); term_class="DESCRIPTIVE_PHRASE"
        if cn in CANONICAL: term_class="SHARED_NAMED"
        elif cn=="通用增伤": term_class="SYSTEM_STAT"
        elif re.search(r"_[AVWDS]\d{4}",bid,re.I): term_class="CHARACTER_NAMED"
        buffs[bid]={"buff_id":bid,"name_cn":cn,"canonical_name_vi":s(data.get("buff_name_vi")),"desc_cn":s(data.get("buff_desc_cn")),"canonical_desc_vi":s(data.get("buff_desc_vi")),"term_class":term_class,"scope":s(data.get("classification_scope")),"translation_status":s(data.get("status")),"owner_approved_aliases":[],"raw_relation_path":[],"player_facing":s(data.get("classification_scope")).upper()=="PLAYER_FACING"}
    skill_ws=wb["SKILL"]; sh=header(skill_ws); skills={}
    for r in range(2,skill_ws.max_row+1):
        data=row(skill_ws,r,sh); markers=BUFF_RE.findall(s(data.get("desc_cn")))
        if not markers: continue
        sid=s(data.get("skill_id")); skills[sid]={"skill_id":sid,"character_id":s(data.get("character_id")),"ordered_markers":markers,"exact_buff_targets":[m for m in markers if m in buffs],"colored_named_terms":[],"composite_or_variant_targets":[],"self_reference":False,"cycle_information":[]}
        for marker in markers:
            if marker in buffs: buffs[marker]["raw_relation_path"].append(f"master.SKILL:{sid}:desc_cn")
    output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps({"buffs":buffs,"skills":skills},ensure_ascii=False,indent=2),encoding="utf-8")
    return {"buffs":len(buffs),"skills_with_markers":len(skills)}


def main():
    p=argparse.ArgumentParser(); p.add_argument("--apply",action="store_true"); p.add_argument("--master",type=Path,default=MASTER); p.add_argument("--review",type=Path,default=REVIEW); p.add_argument("--old-batch",type=Path,default=OLD_BATCH); p.add_argument("--report",type=Path); p.add_argument("--remaining-review",type=Path); p.add_argument("--context",type=Path)
    a=p.parse_args(); result=make_plan(a.master,a.review,a.old_batch); report={"master":str(a.master),"counts":{"master":sum(x["decision"]=="master" for x in result["plan"]),"batch":sum(x["decision"]=="batch" for x in result["plan"]),"deferred":len(result["deferred"]),"invalid":len(result["invalid"]),"duplicates":len(result["duplicates"])},"dry_run":result}
    if a.apply:
        if result["invalid"] or result["duplicates"]: raise RuntimeError("Refusing apply: invalid owner decision or duplicate key")
        backup,backup_hash,changes,canonical=apply_plan(a.master,result["plan"]); report.update({"backup":str(backup),"backup_sha256":backup_hash,"changes":changes,"canonical_migrations":canonical,"integrity":integrity(backup,a.master,changes,canonical)})
        report["remaining_review_count"]=remaining_review(result,a.remaining_review or REPORTS/f"conflicts_remaining_{datetime.now():%Y%m%d_%H%M%S}.xlsx")
        report["buff_context"]=buff_context(a.master,a.context or REPORTS/f"buff_context_map_{datetime.now():%Y%m%d_%H%M%S}.json")
    out=a.report or REPORTS/f"owner_conflict_apply_{datetime.now():%Y%m%d_%H%M%S}_{'apply' if a.apply else 'dry_run'}.json"; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8"); print(json.dumps({"report":str(out),**report["counts"],"integrity":report.get("integrity",{}).get("pass")},ensure_ascii=False))

if __name__=="__main__": main()
