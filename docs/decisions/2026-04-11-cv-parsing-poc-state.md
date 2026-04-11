# CV Parsing POC State

Source of truth for this POC is the real browser/live path: `./run.sh up --ui`, frontend local, Convex `cloud/default`, parser base `https://parser.dasti.ai`, Mistral OCR button, route `/mistral-ocr/parse`.

Identity/contact accepted fixes preserved in this POC: Jessica address/location recovery acceptance fixture, Anne title-as-location guard, Linda normalized location pass-through/materialization, Helen name fix, and Helen desired-position fix. Do not reopen those slices without new live contradiction.

Experience POC result: the Jessica `WORK HISTORY` path no longer yields empty experience or malformed merged fallback rows; experience now recovers 3 entries; no fake `Spring Education Group` / `Education Group` row remains; no giant merged responsibilities blob remains; and `desiredPosition` / `contact.desiredPosition` are no longer backfilled from the first recovered experience row. Experience POC is complete.

Education POC result: Jessica education no longer fragments into institution-only / degree-only garbage rows on the live Mistral OCR path. Live now returns 2 coherent education entries. Education POC is complete, though not fully enriched yet.

Languages POC result: coherent `languages` are preserved and noisy duplicated `languagesRaw` now collapses back to `["English","Spanish","Italian"]` on the live Robert Mistral OCR path. Languages POC is complete.

Skills POC result: Anne markdown-table skills cleanup is accepted and no longer materializes junk values like `| Machine Learning | |`; Jake grouped technical-skills recovery is accepted and now recovers grouped-line skills such as `C/C++`, `HTML/CSS`, `Node.js`, `Material-UI`, `Google Cloud Platform`, `VS Code`, `Visual Studio`, `PyCharm`, and `IntelliJ` without the flattened grouped-heading junk rows. Skills POC is complete.

Important remaining note: the same-run UI/profile can still show Jessica location while normalized contact fields may not carry `contact.location` / `contact.addressNormalized`. Treat that as a profile/materialization contract inconsistency, not a parsing failure in the completed experience, education, languages, or skills slices.

Explicitly deferred: Jessica contact-location normalized-contract consistency cleanup, Helen `New York` location recovery, website/linkedin identity work, Robert experience oddities, broader Jake non-skills regressions, and non-POC families outside these closed slices. Jake non-skills regressions remain out of scope for this POC note.

Files touched in this POC: `cv_parser_service/mistral_ocr.py`, `cv_parser_service/tests/test_mistral_layout_sections.py`, `my-app/convex/lib/parsing/canonicalize.ts`, `my-app/convex/lib/parsing/__tests__/canonicalize.test.ts`.

Temporary diagnostics used: temporary scanner debug logging in `cv_parser_service/mistral_ocr.py` was used to prove the nested heading failure and was removed before this checkpoint. Live validation then used the real Convex `structuredUpload` path plus pushed cloud/default code.

Do not reopen accepted slices without new live contradiction: Jessica experience recovery, Jessica education recovery, Jessica desired-position pollution fix, Helen name fix, Helen desired-position fix, Robert languages cleanup, Anne markdown-table skills cleanup, Jake grouped technical-skills recovery, Anne title-as-location guard, Linda normalized location pass-through/materialization, and Jessica address/location recovery.
