#!/usr/bin/env python3
"""
Quick smoke checks for canonicalize heuristics.

Intentionally minimal – run via `python scripts/local_checks/local_check_canonicalize.py`.
"""
from __future__ import annotations

from pprint import pprint

from cv_parser.canonicalize import canonicalize_cv


GUARD_SAMPLE = """
John Doe
Protection Guard at ADT Security, Los Angeles, CA
Sep. 2018 — Present
Completing reports by recording observations and events.
Pacific.
Skills
Emergency response • Safety protocols
"""

RESEARCH_SAMPLE = """
Jane Smith
Undergraduate Research Assistant at Southwestern University, Georgetown, TX
Sep. 2018 — Present
Explored data sets and authored lab reports.

Education
Blinn College, TX
Course Curriculum: Biology and Chemistry
"""


def inspect_sample(label: str, text: str) -> None:
    result = canonicalize_cv(text.strip(), mode="text", diagnostics={"sample": label})
    normalized = result["normalized"]
    print(f"\n=== {label} ===")
    print("Summary:", normalized["summaryFirstSentence"])
    print("Contact location:", normalized["contact"].get("addressNormalized"))
    print("Experience entries:")
    for exp in normalized["experience"]:
        pprint(
            {
                "company": exp["company"],
                "position": exp["position"],
                "location": exp["location"],
                "startDate": exp["startDate"],
                "endDate": exp.get("endDate"),
                "isCurrent": exp["isCurrent"],
                "firstBullet": exp["responsibilityBullets"][0] if exp["responsibilityBullets"] else None,
            },
            sort_dicts=False,
        )
    print("Education institutions:", [edu["institution"] for edu in normalized["education"]])


def main() -> None:
    inspect_sample("Protection Guard", GUARD_SAMPLE)
    inspect_sample("Research Assistant", RESEARCH_SAMPLE)


if __name__ == "__main__":
    main()
