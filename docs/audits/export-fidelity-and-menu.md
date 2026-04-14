# Export Fidelity And Menu Audit

## Trusted hobbies loss

- Active upstream loss point: `cv_parser_service/mistral_resume_v3/normalized_schema.py`
- `NormalizedResume` does not define a `hobbies` field.
- Result: trusted `authoritativeResume.normalized` does not carry hobbies today.
- This branch does not recover hobbies from `raw`, `rawText`, `rawSections`, `sections`, or `appDocument`.

## Trusted achievements rule

- If a trusted sample still misses achievements, inspect `authoritativeResume.normalized.achievements` first.
- If that field is empty, the loss is upstream of the trusted export renderer.
- Do not recover achievements from raw or compatibility fields in the trusted path.
