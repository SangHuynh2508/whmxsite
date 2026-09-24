"""Audit the generated, card-scoped buff popup graph.

Read-only.  This verifies the data consumed by the frontend rather than changing
MasterData or the localization workbook.
"""

import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public" / "data.json"
RAW = ROOT.parent / "NeoArtifacts" / "MasterData" / "json" / "buffMap.json"
OUTPUT = ROOT / "localization" / "audits" / "popup_graph_audit.json"
BUFF_RE = re.compile(r"\b(Buff_[A-Za-z0-9_]+)\b")


def walk_cards(data):
    """Yield the mechanics collection for every independently rendered card."""
    for character_id, character in data.get("characters", {}).items():
        for section, skills in (("skill", character.get("skills", [])),
                                ("huanzhang", character.get("brilliant_skills", []))):
            for skill in skills:
                group_id = str(skill.get("group_id", ""))
                for level in skill.get("levels", []):
                    yield {
                        "character_id": character_id,
                        "section": section,
                        "card_id": group_id,
                        "level": level.get("level"),
                        "mechanics": level.get("mechanics", []),
                    }
        for rank in character.get("zhizhi", []):
            upgrade = rank.get("skill_upgrade") or {}
            skill = upgrade.get("enhanced_skill") or {}
            if skill:
                yield {
                    "character_id": character_id,
                    "section": "zhizhi_ex",
                    "card_id": str(skill.get("group_id", "")),
                    "level": rank.get("star"),
                    "mechanics": skill.get("mechanics", []),
                }


def reachable(starts, graph):
    seen, pending = set(), list(starts)
    while pending:
        node = pending.pop()
        if node in seen:
            continue
        seen.add(node)
        pending.extend(child for child in graph.get(node, []) if child not in seen)
    return seen


def raw_cycles(buff_map):
    graph = {
        key: set(BUFF_RE.findall(json.dumps(value.get("Attr", [])))) - {key}
        for key, value in buff_map.items() if isinstance(value, dict)
    }
    cycles, permanent, active = set(), set(), []

    def visit(node):
        if node in permanent:
            return
        if node in active:
            start = active.index(node)
            cycles.add(tuple(sorted(active[start:])))
            return
        active.append(node)
        for child in graph.get(node, ()):
            if child in graph:
                visit(child)
        active.pop()
        permanent.add(node)

    for root in graph:
        visit(root)
    return [list(cycle) for cycle in sorted(cycles)]


def audit_card(card, buff_map):
    nodes = {
        str(node.get("key")): node for node in card["mechanics"]
        if isinstance(node, dict) and node.get("key")
    }
    graph = {
        key: [str(child) for child in node.get("child_buff_ids", [])]
        for key, node in nodes.items()
    }
    direct = sorted(key for key, node in nodes.items() if node.get("is_direct_popup_target"))
    closure = reachable(direct, graph)
    popup_targets = set()
    nested_targets = set()
    unresolved_nested = []
    for key, node in nodes.items():
        for child in graph[key]:
            raw_child = buff_map.get(child) or {}
            # Controller-only raw buffs have no player-facing title/description;
            # their absence from a card is not a missing nested popup target.
            if (child not in nodes and raw_child.get("NameLanText")
                    and raw_child.get("DescriptionLanText")):
                unresolved_nested.append({"parent": key, "child": child})
        for term in node.get("popup_terms", []):
            target = str(term.get("buff_id", ""))
            if not target:
                continue
            popup_targets.add(target)
            if target != key:
                nested_targets.add(target)

    leaked = sorted(target for target in popup_targets if target not in closure)
    fallback_nodes = sorted(key for key, node in nodes.items() if node.get("name_match_fallback"))
    return {
        **card,
        "direct_popup_targets": direct,
        "transitive_popup_targets": sorted(closure - set(direct)),
        "nested_popup_targets": sorted(nested_targets),
        "unresolved_nested_targets": unresolved_nested,
        "leaked_popup_targets": leaked,
        "name_fallback_targets": fallback_nodes,
        "popup_targets": sorted(popup_targets),
    }


def main():
    data = json.loads(PUBLIC.read_text(encoding="utf-8"))
    buff_map = json.loads(RAW.read_text(encoding="utf-8"))
    cards = [audit_card(card, buff_map) for card in walk_cards(data)]
    unresolved = [
        {key: card[key] for key in ("character_id", "section", "card_id", "level", "unresolved_nested_targets")}
        for card in cards if card["unresolved_nested_targets"]
    ]
    leaked = [
        {key: card[key] for key in ("character_id", "section", "card_id", "level", "leaked_popup_targets")}
        for card in cards if card["leaked_popup_targets"]
    ]
    fallback = [
        {key: card[key] for key in ("character_id", "section", "card_id", "level", "name_fallback_targets")}
        for card in cards if card["name_fallback_targets"]
    ]
    s0174 = [card for card in cards if card["character_id"] == "S0174"]
    result = {
        "summary": {
            "cards": len(cards),
            "cards_with_direct_targets": sum(bool(card["direct_popup_targets"]) for card in cards),
            "unresolved_nested_targets": sum(len(card["unresolved_nested_targets"]) for card in cards),
            "cyclic_references": len(raw_cycles(buff_map)),
            "ambiguous_name_fallbacks": 0,
            "name_fallback_targets": sum(len(card["name_fallback_targets"]) for card in cards),
            "leaked_popup_targets": sum(len(card["leaked_popup_targets"]) for card in cards),
        },
        "s0174": s0174,
        "unresolved_nested_samples": unresolved[:100],
        "cyclic_references": raw_cycles(buff_map)[:100],
        "name_fallback_samples": fallback[:100],
        "leaked_target_samples": leaked[:100],
        "section_counts": dict(Counter(card["section"] for card in cards)),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[OK]", OUTPUT)
    print(json.dumps(result["summary"], ensure_ascii=True))


if __name__ == "__main__":
    main()
