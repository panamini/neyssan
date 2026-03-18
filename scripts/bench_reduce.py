#!/usr/bin/env python3
import json
import sys
import csv
from pathlib import Path


def unwrap(maybe):
    if isinstance(maybe, dict) and "result" in maybe and isinstance(maybe["result"], dict):
        return maybe["result"]
    return maybe


def get_value(data, *keys, **kwargs):
    default = kwargs.get("default")
    cur = data
    for key in keys:
        if isinstance(cur, dict):
            cur = cur.get(key)
        elif isinstance(cur, list) and isinstance(key, int) and 0 <= key < len(cur):
            cur = cur[key]
        else:
            return default
    return cur if cur is not None else default


def summarize(payload):
    payload = unwrap(payload)
    norm = payload.get("normalized") if isinstance(payload, dict) else {}
    summary_text = get_value(norm, "summary", "text") or payload.get("summary") or ""
    experience = norm.get("experience") if isinstance(norm, dict) else []
    education = norm.get("education") if isinstance(norm, dict) else []
    languages = []
    if isinstance(norm, dict):
        languages = norm.get("languages") or norm.get("languagesRaw") or []
    diagnostics = payload.get("diagnostics") if isinstance(payload, dict) else None

    summary_ok = bool(summary_text and str(summary_text).strip())
    experience_ok = isinstance(experience, list) and len(experience) > 0
    education_ok = isinstance(education, list) and len(education) > 0
    languages_ok = isinstance(languages, list) and len(languages) > 0
    diagnostics_ok = isinstance(diagnostics, dict) or diagnostics is not None

    preview_source = payload.get("summaryFirstSentence") or summary_text or payload.get("rawText") or ""
    if isinstance(preview_source, str):
        preview = preview_source.replace("\n", " ").strip()
        if len(preview) > 120:
            preview = preview[:117] + "..."
    else:
        preview = ""

    return summary_ok, experience_ok, education_ok, languages_ok, diagnostics_ok, preview


def main():
    if len(sys.argv) < 3:
        print("usage: bench_reduce.py <json_dir> <out_dir> [variant]", file=sys.stderr)
        sys.exit(2)

    json_dir = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    variant = sys.argv[3] if len(sys.argv) > 3 else "rules"

    out_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    if json_dir.exists():
        for json_path in sorted(json_dir.glob("*.json")):
            try:
                content = json.loads(json_path.read_text(encoding="utf-8", errors="ignore"))
            except Exception as exc:  # pragma: no cover
                content = {"__read_error__": str(exc)}
            summary_ok, experience_ok, education_ok, languages_ok, diagnostics_ok, preview = summarize(content)
            stem = json_path.stem
            parts = stem.split("_", 1)
            case_id = parts[0]
            fname = parts[1] if len(parts) > 1 else stem

            rows.append(
                {
                    "id": case_id,
                    "file": fname,
                    "variant": variant,
                    "summary_ok": "✅" if summary_ok else "❌",
                    "experience_ok": "✅" if experience_ok else "❌",
                    "education_ok": "✅" if education_ok else "❌",
                    "languages_ok": "✅" if languages_ok else "❌",
                    "diagnostics_ok": "✅" if diagnostics_ok else "❌",
                    "preview": preview,
                }
            )

    headers = [
        "id",
        "file",
        "variant",
        "summary_ok",
        "experience_ok",
        "education_ok",
        "languages_ok",
        "diagnostics_ok",
        "preview",
    ]

    csv_path = out_dir / "report.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    md_path = out_dir / "report.md"
    with md_path.open("w", encoding="utf-8") as md_file:
        md_file.write(
            "CV | Variant | Summary OK | Experience OK | Education OK | Languages OK | Diagnostics OK | Preview\n"
        )
        md_file.write(
            "-- | ------- | ---------- | ------------- | ------------ | -------------| ---------------| -------\n"
        )
        for row in rows:
            md_file.write(
                "{file} | {variant} | {summary_ok} | {experience_ok} | {education_ok} | {languages_ok} | {diagnostics_ok} | {preview}\n".format(
                    **row
                )
            )

    print("[reduce] wrote {0}".format(csv_path))
    print("[reduce] wrote {0}".format(md_path))


if __name__ == "__main__":
    main()
