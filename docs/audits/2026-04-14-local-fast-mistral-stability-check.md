# Audit: local-fast Mistral OCR stability

Date: 2026-04-14

Fixture:

- `/Users/pana/Downloads/fixtures/cv_surname-en.pdf`

Endpoint tested:

- `http://127.0.0.1:8001/mistral-ocr/parse`

Mode:

- `./run.sh local-fast`

## Method

Ran the exact same file through the exact same parser endpoint 8 times in a row with:

- `mode=auto`
- same parser container
- same runtime
- no code changes between runs

Captured for each run:

- `languages[]`
- `skills[]`
- `mistral_fallback`
- `mistral_runtime`

## Result

The output is unstable and significant.

- total runs: 8
- correct runs: 4
- failed runs: 4

Correct means:

- `languages = [English, Portuguese]`
- `skills = 46`
- `mistral_fallback = false`
- `mistral_runtime = "mistral"`

Failed means any of:

- empty `skills`
- empty `languages`
- malformed `languages`
- fallback activated

## Run Summary

| Run | Skills | Languages | Fallback | Runtime | Verdict |
| --- | ---: | --- | --- | --- | --- |
| 1 | 46 | `English|Portuguese` | false | `mistral` | correct |
| 2 | 46 | `English|Portuguese` | false | `mistral` | correct |
| 3 | 0 | malformed language spillover from skills/sections | true | `local_fallback` | failed |
| 4 | 0 | empty | false | `mistral` | failed |
| 5 | 46 | `English|Portuguese` | false | `mistral` | correct |
| 6 | 0 | empty | false | `mistral` | failed |
| 7 | 0 | empty | false | `mistral` | failed |
| 8 | 46 | `English|Portuguese` | false | `mistral` | correct |

## Sample Correct Output

- `languages[]`
  - `English`
  - `Portuguese`
- `skills[]`
  - `C#`
  - `Javascript`
  - `Typescript`
  - `C++`
  - `C`
  - `Java`
  - `Python`
  - `HTML`
  - `CSS`
  - `...` through 46 total
- `mistral_fallback=false`
- `mistral_runtime="mistral"`

## Sample Failed Output

Run 3:

- `skills[] = []`
- `mistral_fallback=true`
- `mistral_runtime="local_fallback"`
- `languages[]` incorrectly contained a long merged list including:
  - `English: Good command Portuguese: Native speaker`
  - `Areas of expertise`
  - `Programming Languages: C#`
  - `Javascript`
  - `Frameworks: .Net`
  - `Process: Agile`

Run 4:

- `skills[] = []`
- `languages[] = []`
- `mistral_fallback=false`
- `mistral_runtime="mistral"`

## Conclusion

Mistral OCR annotation behavior is real and significant for this fixture under `local-fast`.

Failure rate in this check:

- `4 / 8 = 50%`

This is too high to treat as noise.

## Minimal Stabilization Recommendation

Do not redesign the parser.

If a fix is pursued later, the minimal stabilization surface should be in the parser pipeline after OCR returns but before the result is accepted:

- detect when raw markdown clearly contains explicit `Languages` / `Areas of expertise` sections
- reject or retry parser outputs that return:
  - empty `skills`
  - empty `languages`
  - malformed language spillover
- prefer a bounded parser-side retry or acceptance gate over changing `run.sh`
