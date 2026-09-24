"""Identity-aware protection for owner-approved BUFF/STATE terminology.

The workbook is the only terminology authority.  This module deliberately does
not carry a hand-maintained CN -> VI dictionary: callers load the registry from
``BUFF_STATUS`` immediately before preparing a translation batch.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import re
from typing import Iterable, Mapping, Sequence

import openpyxl


TOKEN_PREFIX = "[[WHMX_TERM:"
TOKEN_RE = re.compile(r"\[\[WHMX_TERM:([A-Za-z0-9_]+)\]\]")
TAG_RE = re.compile(r"<[^>]+>")
BUFF_MARKER_RE = re.compile(r"\{(Buff_[A-Za-z0-9_]+)\}")
APPROVED_STATUSES = frozenset({"APPROVED", "OWNER_APPROVED", "OWNER_CORRECTED"})
OWNER_NAME_AUTHORITY = "OWNER_APPROVED"
CHATGPT_REVIEWED_NAME_AUTHORITY = "CHATGPT_REVIEWED"
LEGACY_ALIASES_RE = re.compile(r"(?:^|[|;\n])\s*legacy_aliases?\s*=\s*([^;\n]+)", re.I)


def visible_text(value: object) -> str:
    return TAG_RE.sub("", str(value or "")).strip()


def _is_locked_authority(name_authority: str, legacy_status: str) -> bool:
    """Use field-specific name authority when it exists; otherwise legacy status."""
    return (
        name_authority in {OWNER_NAME_AUTHORITY, CHATGPT_REVIEWED_NAME_AUTHORITY}
        if name_authority
        else legacy_status in APPROVED_STATUSES
    )


def token_for(buff_id: str) -> str:
    return f"{TOKEN_PREFIX}{buff_id}]]"


def _malformed_tokens(text: str) -> list[str]:
    """Find TERM-looking fragments after all well-formed tokens are removed."""
    residue = TOKEN_RE.sub("", text)
    return re.findall(r"\[\[WHMX_TERM[^\s]*", residue)


@dataclass(frozen=True)
class LockedTerm:
    buff_id: str
    source_cn: str
    canonical_vi: str
    status: str
    legacy_aliases: tuple[str, ...] = ()


@dataclass(frozen=True)
class SourceBinding:
    """A verified non-marker relation, optionally pinned to one occurrence."""

    buff_id: str
    start: int | None = None
    end: int | None = None


@dataclass
class ProtectionResult:
    text: str
    locked_ids: tuple[str, ...]
    skipped_unresolved_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class TermLockIssue:
    code: str
    buff_id: str
    message: str


class TermLockRegistry:
    """Exact Buff-ID registry derived from an authoritative workbook snapshot."""

    def __init__(self, terms: Mapping[str, LockedTerm], unresolved_ids: Iterable[str] = ()):
        self._terms = dict(terms)
        self._unresolved_ids = frozenset(unresolved_ids)

    @property
    def terms(self) -> Mapping[str, LockedTerm]:
        return self._terms

    @property
    def unresolved_ids(self) -> frozenset[str]:
        return self._unresolved_ids

    def get(self, buff_id: str) -> LockedTerm | None:
        return self._terms.get(buff_id)

    @classmethod
    def from_workbook(cls, workbook_path: str | Path) -> "TermLockRegistry":
        """Load only owner/approved rows; pending rows are intentionally inert."""
        workbook_path = Path(workbook_path)
        wb = openpyxl.load_workbook(workbook_path, read_only=True, data_only=False)
        try:
            ws = wb["BUFF_STATUS"]
            headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
            required = {"buff_id", "buff_name_cn", "buff_name_vi", "status", "notes"}
            missing = required - set(headers)
            if missing:
                raise ValueError(f"BUFF_STATUS missing TERM LOCK columns: {sorted(missing)}")
            terms: dict[str, LockedTerm] = {}
            unresolved: set[str] = set()
            for row in ws.iter_rows(min_row=2, values_only=True):
                item = dict(zip(headers, row))
                buff_id = str(item.get("buff_id") or "").strip()
                source_cn = visible_text(item.get("buff_name_cn"))
                canonical_vi = visible_text(item.get("buff_name_vi"))
                legacy_status = str(item.get("status") or "").strip()
                name_authority = str(item.get("name_authority") or "").strip()
                if not buff_id or not source_cn:
                    continue
                # ``name_authority`` is field-specific and therefore takes
                # precedence whenever it is populated.  Older workbooks have
                # no such field (or leave it blank), so their established
                # row-level approval state remains fully supported.
                authority = name_authority or legacy_status
                is_locked = _is_locked_authority(name_authority, legacy_status)
                if not is_locked or not canonical_vi:
                    unresolved.add(buff_id)
                    continue
                aliases_match = LEGACY_ALIASES_RE.search(str(item.get("notes") or ""))
                aliases = ()
                if aliases_match:
                    aliases = tuple(alias.strip() for alias in aliases_match.group(1).split("|") if alias.strip())
                candidate = LockedTerm(buff_id, source_cn, canonical_vi, authority, aliases)
                existing = terms.get(buff_id)
                if existing and existing != candidate:
                    raise ValueError(f"Conflicting approved TERM LOCK rows for {buff_id}")
                terms[buff_id] = candidate
                unresolved.discard(buff_id)
            return cls(terms, unresolved)
        finally:
            wb.close()


def _marker_ids(source_text: str) -> set[str]:
    return set(BUFF_MARKER_RE.findall(source_text))


def _resolve_bindings(
    source_text: str,
    registry: TermLockRegistry,
    relationship_bindings: Sequence[SourceBinding] = (),
) -> tuple[list[SourceBinding], list[str]]:
    marker_ids = _marker_ids(source_text)
    bindings = list(relationship_bindings)
    bound_ids = {binding.buff_id for binding in bindings}
    skipped = sorted(marker_ids & registry.unresolved_ids)
    for buff_id in sorted(marker_ids):
        if buff_id in bound_ids or not registry.get(buff_id):
            continue
        # A marker is sufficient only when its exact source label occurs and
        # no other marked identity owns that same label in this source string.
        term = registry.get(buff_id)
        assert term is not None
        contenders = [
            candidate for candidate in marker_ids
            if registry.get(candidate) and registry.get(candidate).source_cn == term.source_cn
        ]
        if len(contenders) == 1 and term.source_cn in source_text:
            bindings.append(SourceBinding(buff_id))
            bound_ids.add(buff_id)
    return bindings, skipped


def protect_terms(
    source_text: str,
    registry: TermLockRegistry,
    relationship_bindings: Sequence[SourceBinding] = (),
) -> ProtectionResult:
    """Replace only source-anchored, approved terms with opaque exact-ID tokens."""
    bindings, skipped = _resolve_bindings(source_text, registry, relationship_bindings)
    replacements: list[tuple[int, int, str, str]] = []
    for binding in bindings:
        term = registry.get(binding.buff_id)
        if not term:
            continue
        if binding.start is not None or binding.end is not None:
            if binding.start is None or binding.end is None or source_text[binding.start:binding.end] != term.source_cn:
                raise ValueError(f"Invalid verified binding span for {binding.buff_id}")
            replacements.append((binding.start, binding.end, token_for(binding.buff_id), binding.buff_id))
            continue
        positions = [match.span() for match in re.finditer(re.escape(term.source_cn), source_text)]
        if len(positions) == 1:
            replacements.append((*positions[0], token_for(binding.buff_id), binding.buff_id))
    replacements.sort(key=lambda item: (item[0], item[1]))
    if any(right[0] < left[1] for left, right in zip(replacements, replacements[1:])):
        raise ValueError("Overlapping TERM LOCK bindings")
    text = source_text
    for start, end, replacement, _ in reversed(replacements):
        text = text[:start] + replacement + text[end:]
    return ProtectionResult(text, tuple(item[3] for item in replacements), tuple(skipped))


def restore_terms(translated_text: str, registry: TermLockRegistry) -> str:
    """Resolve intact tokens from the registry; corrupted tokens are never guessed."""
    malformed = _malformed_tokens(translated_text)
    if malformed:
        raise ValueError(f"LOCK_TOKEN_CORRUPTED: malformed token(s): {malformed}")

    def replace(match: re.Match[str]) -> str:
        buff_id = match.group(1)
        term = registry.get(buff_id)
        if not term:
            raise ValueError(f"UNRESOLVED_IDENTITY_NOT_LOCKED: {buff_id}")
        return term.canonical_vi

    return TOKEN_RE.sub(replace, translated_text)


def validate_locked_terms(
    source_text: str,
    target_text: str,
    registry: TermLockRegistry,
    relationship_bindings: Sequence[SourceBinding] = (),
    *,
    protected_phase: bool,
) -> list[TermLockIssue]:
    """Return actionable drift errors without changing translated content."""
    expected = protect_terms(source_text, registry, relationship_bindings)
    issues: list[TermLockIssue] = []
    if protected_phase:
        expected_tokens = [token_for(buff_id) for buff_id in expected.locked_ids]
        for malformed in _malformed_tokens(target_text):
            issues.append(TermLockIssue("LOCK_TOKEN_CORRUPTED", "", f"Malformed protected token: {malformed}"))
        for token, buff_id in zip(expected_tokens, expected.locked_ids):
            if target_text.count(token) != 1:
                issues.append(TermLockIssue("LOCK_TOKEN_CORRUPTED", buff_id, f"Expected exactly one {token}"))
        for match in TOKEN_RE.finditer(target_text):
            token_id = match.group(1)
            if not registry.get(token_id):
                issues.append(TermLockIssue("UNRESOLVED_IDENTITY_NOT_LOCKED", match.group(1), "Pending identity was protected"))
            elif token_id not in expected.locked_ids:
                issues.append(TermLockIssue("LOCK_TOKEN_CORRUPTED", token_id, "Unexpected protected identity in translation"))
        return issues

    for buff_id in expected.locked_ids:
        term = registry.get(buff_id)
        assert term is not None
        if term.source_cn in target_text:
            issues.append(TermLockIssue("CN_LEAK_FOR_LOCKED_TERM", buff_id, f"Raw CN remains: {term.source_cn}"))
        for alias in term.legacy_aliases:
            if alias and alias in target_text:
                issues.append(TermLockIssue("LEGACY_ALIAS_FOR_LOCKED_TERM", buff_id, f"Legacy alias remains: {alias}"))
        if term.canonical_vi not in target_text:
            issues.append(TermLockIssue("CANONICAL_TERM_MISMATCH", buff_id, f"Expected canonical VI: {term.canonical_vi}"))
    return issues
