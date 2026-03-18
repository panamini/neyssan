#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

ART = Path("artifacts/bench/latest/json")
if not ART.exists():
    print(f"[err] missing {ART} (run ./scripts/bench_fixtures.sh first)")
    sys.exit(2)

PHONE_EMAIL_URL = re.compile(r"(?:\+?\d[\d\s\-().]{6,}|@|https?://|www\.)", re.I)
ADDRESSISH = re.compile(
    r"""
\b(
    \d{1,6}\s+[A-Za-z0-9'.\- ]{1,40}\s+(Ave|Avenue|St|Street|Rd|Road|Blvd|Boulevard|Dr|Drive|Way|Lane|Ln|Ct|Court|Pl|Place|Hwy|Highway)\b
  | [A-Z]{2}\s*\d{5}(?:-\d{4})?
  | [A-Z][a-z]+,\s*[A-Z]{2}\b
  | [A-Z][a-z]+,\s*[A-Z][a-z]+
)\b
""",
    re.I | re.X,
)

VERB_START = re.compile(
    r"^(?:completing|assessing|exploring|maintaining|logging|managing|apprehending|utilizing|ensuring|introducing|communicate|assess|explored|manage|built|building|using|developing|developed|analyzing)\b",
    re.I,
)

VERB_RE = re.compile(r"\b(is|are|was|were|has|have|led|managed|built|develop\w+|protect\w+|research\w+)\b", re.I)

ROLE_KEYWORDS = {
    "guard",
    "engineer",
    "developer",
    "manager",
    "analyst",
    "scientist",
    "consultant",
    "assistant",
    "officer",
    "supervisor",
    "technician",
    "architect",
    "designer",
    "specialist",
    "director",
    "administrator",
    "coordinator",
    "teacher",
    "intern",
    "lead",
    "president",
}
COMPANY_KEYWORDS = {
    "limited",
    "ltd",
    "company",
    "corporation",
    "corp",
    "llc",
    "solutions",
    "consultants",
    "communications",
    "technologies",
    "systems",
    "services",
    "group",
    "labs",
    "laboratories",
    "university",
    "college",
    "institute",
    "school",
    "hospital",
    "bank",
}
LEVEL_KEYWORDS = {"senior", "junior", "lead", "chief", "principal", "assistant", "associate", "security"}


def get_summary_text(sections):
    out = []
    for sec in sections or []:
        if sec.get("type") == "summary":
            for blk in sec.get("structuredContent", []):
                doc = blk.get("summary", {})
                for para in doc.get("content") or []:
                    for node in para.get("content") or []:
                        if node.get("type") == "text":
                            out.append(node.get("text", ""))
    return " ".join(" ".join(out).split()).strip()


def get_profile_location(sections):
    for sec in sections or []:
        if sec.get("type") == "profile":
            for blk in sec.get("structuredContent", []):
                loc = (blk.get("location") or "").strip()
                if loc:
                    return loc
    return ""


def looks_ok_summary(text: str) -> bool:
    if not text:
        return False
    if PHONE_EMAIL_URL.search(text) or ADDRESSISH.search(text):
        return False
    compact = " ".join(text.split())
    if len(compact) >= 30:
        return True
    tokens = re.findall(r"\w+", compact)
    return len(tokens) >= 8 and VERB_RE.search(compact) is not None


def bad_company(line):
    s = (line or "").strip()
    if not s:
        return False
    if VERB_START.match(s):
        return True
    if re.match(r"^[a-z]+ing\b", s):
        return True
    return False


def is_role_phrase(text: str) -> bool:
    tokens = [re.sub(r"[^a-z]", "", part.lower()) for part in text.split()]
    tokens = [tok for tok in tokens if tok]
    if not tokens:
        return False
    if any(tok in COMPANY_KEYWORDS for tok in tokens):
        return False
    role_hits = [tok for tok in tokens if tok in ROLE_KEYWORDS or tok in LEVEL_KEYWORDS]
    return bool(role_hits) and len(role_hits) == len(tokens)


issues = 0
for jf in sorted(ART.glob("*.json")):
    try:
        data = json.loads(jf.read_text())
    except Exception as e:
        print(f"[bad] json_error {jf}: {e}")
        issues += 1
        continue

    normalized = data.get("normalized", {})
    sections = data.get("sections") or normalized.get("sections") or []
    summary_obj = normalized.get("summary") if isinstance(normalized.get("summary"), dict) else None
    summ = ""
    if summary_obj is not None:
        summ = (summary_obj.get("text") or "").strip()
    if not summ:
        summ = (normalized.get("summaryFirstSentence") or "").strip()
    if sections:
        loc = get_profile_location(sections)
    else:
        loc = (normalized.get("contact", {}) or {}).get("addressNormalized", "") or ""
    if not summ and sections:
        summ = get_summary_text(sections)

    probs = []
    if summary_obj is not None and summary_obj.get("text") == "":
        probs.append("summary_empty")

    if not looks_ok_summary(summ):
        probs.append("summary_weak_or_addressish")

    if loc and (
        re.search(r"\b(with|years|experience|security|guard|attentive|presently|qualified)\b", loc, re.I)
        and not ADDRESSISH.search(loc)
    ):
        probs.append("profile_location_polluted")

    experience_entries: list[dict] = []
    if sections:
        for sec in sections:
            if sec.get("type") != "experience":
                continue
            experience_entries.extend(sec.get("structuredContent", []))
    else:
        experience_entries.extend(normalized.get("experience") or [])

    for entry in experience_entries:
        comp = (entry.get("company") or "").strip()
        pos = (entry.get("position") or "").strip()
        if comp and bad_company(comp):
            probs.append("company_looks_verbish")
        if comp and is_role_phrase(comp):
            probs.append("role_company_misaligned")
        if comp and pos and comp.lower() == pos.lower():
            probs.append("role_company_misaligned")
        for fld in ("startDate", "endDate"):
            v = entry.get(fld)
            if v and not re.fullmatch(r"\d{4}-\d{2}-01", v):
                if re.search(r"[A-Za-z]", v or ""):
                    probs.append("date_has_letters")

    status = "ok" if not probs else "bad"
    reason = "" if not probs else " " + ",".join(sorted(set(probs)))
    print(f"[{status}] {jf}{reason}")
    issues += (1 if probs else 0)

if issues:
    print(f"[summary] FAIL: {issues} files flagged.")
    sys.exit(1)
print("[summary] PASS: all files look good.")
