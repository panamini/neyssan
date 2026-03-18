#!/usr/bin/env python3
"""Generate a consolidated skills taxonomy JSON from ESCO + internal lists.

The resulting payload feeds the convex runtime (via `my-app/convex/lib/taxonomy/skills.json`)
so skill utilities can share a single canonical vocabulary across the stack.

Example:
    python cv_parser/scripts/build_skills_taxonomy.py \
        --esco-csv "my-app/testdata/cv/esco/ESCO dataset - v1.2.0 - classification - en - csv/skills_en.csv" \
        --internal cv_parser/data/internal_skills.txt \
        --aliases cv_parser/data/internal_skill_aliases.json \
        --out my-app/convex/lib/taxonomy/skills.json
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Set

DEFAULT_INTERNAL = Path("cv_parser/data/internal_skills.txt")
DEFAULT_ALIAS = Path("cv_parser/data/internal_skill_aliases.json")
DEFAULT_OUT = Path("my-app/convex/lib/taxonomy/skills.json")
DEFAULT_ESCO = Path(
    "my-app/testdata/cv/esco/ESCO dataset - v1.2.0 - classification - en - csv/skills_en.csv"
)


def load_internal_skills(path: Path) -> Set[str]:
    if not path.exists():
        raise FileNotFoundError(f"Internal skill list missing: {path}")
    skills: Set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        item = line.strip().lower()
        if item:
            skills.add(item)
    return skills


def load_aliases(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {str(k).lower(): str(v).lower() for k, v in data.items()}


def load_esco_skills(path: Path) -> tuple[Set[str], Dict[str, str], Dict[str, int]]:
    if not path.exists():
        raise FileNotFoundError(
            "ESCO CSV not found. Pass --esco-csv pointing to skills_en.csv from the ESCO dump."
        )
    canonical: Set[str] = set()
    aliases: Dict[str, str] = {}
    categories: Dict[str, int] = defaultdict(int)

    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            label = (row.get("preferredLabel") or "").strip()
            if not label:
                continue
            concept_type = (row.get("conceptType") or "").strip()
            if concept_type and concept_type.lower() not in {"knowledgeskillcompetence"}:
                continue
            canonical_label = normalise(label)
            if not canonical_label:
                continue
            canonical.add(canonical_label)
            skill_type = (row.get("skillType") or "").strip().lower() or "unknown"
            categories[skill_type] += 1

            for alt in split_labels(row.get("altLabels")):
                normalised_alt = normalise(alt)
                if not normalised_alt or normalised_alt == canonical_label:
                    continue
                # prefer first occurrence; later collisions are ignored intentionally
                aliases.setdefault(normalised_alt, canonical_label)
    return canonical, aliases, categories


def split_labels(raw: str | None) -> Iterable[str]:
    if not raw:
        return []
    normalized = raw.replace("\n", "|").replace(";", "|")
    for part in normalized.split("|"):
        yield part.strip()


def normalise(token: str) -> str:
    return token.replace("\u200b", "").strip().lower()


def merge_data(
    internal: Set[str],
    esco: Set[str],
    aliases: Dict[str, str],
    esco_aliases: Dict[str, str],
) -> tuple[list[str], Dict[str, str]]:
    alias_keys = set(aliases.keys()) | set(esco_aliases.keys())
    canonical_set = (internal | esco) - alias_keys
    canonical = sorted(canonical_set)
    merged_aliases: Dict[str, str] = {**aliases}
    for key, value in esco_aliases.items():
        if key == value:
            continue
        if key in canonical:
            continue
        merged_aliases.setdefault(key, value)
    # Drop aliases that point to a non-canonical token
    merged_aliases = {
        alias: target
        for alias, target in merged_aliases.items()
        if target in canonical and alias != target
    }
    return canonical, dict(sorted(merged_aliases.items()))


def build_payload(args: argparse.Namespace) -> dict:
    internal = load_internal_skills(args.internal)
    alias_overrides = load_aliases(args.aliases)
    esco, esco_aliases, category_counts = load_esco_skills(args.esco_csv)
    canonical, aliases = merge_data(internal, esco, alias_overrides, esco_aliases)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "version": timestamp,
        "canonical": canonical,
        "aliases": aliases,
        "sources": {
            "internal": {
                "path": str(args.internal),
                "count": len(internal),
            },
            "esco": {
                "path": str(args.esco_csv),
                "count": len(esco),
                "skill_types": category_counts,
            },
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build unified skills taxonomy JSON")
    parser.add_argument(
        "--esco-csv",
        type=Path,
        default=DEFAULT_ESCO,
        help="Path to ESCO skills_en.csv file",
    )
    parser.add_argument(
        "--internal",
        type=Path,
        default=DEFAULT_INTERNAL,
        help="Path to newline-delimited internal skill list",
    )
    parser.add_argument(
        "--aliases",
        type=Path,
        default=DEFAULT_ALIAS,
        help="Path to JSON alias overrides (optional)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Output path for the JSON taxonomy",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = build_payload(args)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote taxonomy with {len(payload['canonical'])} canonical skills to {args.out}")


if __name__ == "__main__":
    main()
