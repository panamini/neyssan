# CVForge Preview Linking Surface Audit

## Summary
- Scope: active code under `my-app/src/*` only.
- Goal: identify the actual current edit surface per active preview family and define the canonical target surface to use before wiring preview linking.
- Result: `profile`, `summary`, `experience`, `education`, `projects`, `skills`, `certifications`, and `affiliations` already have stable modal-oriented targets; `languages`, `achievements`, `hobbies`, `additional_information`, and custom text sections still need explicit canonical handling.

## Matrix
| Preview family | Current repo surface | Canonical target surface for this project | Open mode |
| --- | --- | --- | --- |
| `profile` | `ProfileModal` | `profile` section modal | section |
| `contact` | alias to `profile` | `profile` section modal | section |
| `notes` | alias to `profile` metadata rows | `profile` section modal | section |
| `summary` | `SummaryModal` | `summary` section modal | section |
| `experience` | `ExperienceModal` | `experience` section modal | item |
| `education` | `EducationModal` | `education` section modal | item |
| `skills` | `SkillsModal` | `skills` section modal | item |
| `languages` | mixed inline flow in `SectionEditor` with `LanguagesModal` support | `languages` section modal | item |
| `projects` | `ProjectsModal` | `projects` section modal | item |
| `selected_projects` | alias to `projects` | `projects` section modal | item |
| `achievements` | mixed `AchievementsBlock` + `AchievementsModal` flow | `achievements` section modal owned by `SectionEditor` | item |
| `certifications` | `CertificationModal` | `certifications` section modal | item |
| `affiliations` | `AffiliationModal` via titled `text` section | `affiliations` section modal | item |
| `hobbies` | shared `SkillsModal` flow via titled `text` section | `hobbies` section modal | item |
| `additional_information` | generic inline text editor | generic inline text editor | section |
| `custom` | generic inline text editor | generic inline text editor | section |

## Mixed Surfaces To Canonicalize First
- `languages`: current editing is inline-first in `SectionEditor`; preview linking needs one modal-owned target instead of hybrid inline logic.
- `achievements`: current editing is routed through `AchievementsBlock`; linking should still be driven from `SectionEditor` as the section authority.
- `hobbies`: currently piggybacks on the `skills` flow; acceptable only if kept explicit as the canonical hobby surface.
- `additional_information`: stays inline by design; do not invent a modal.
- custom `text` sections: stay inline by design; resolve by exact `sectionId` or `sectionTitle`.

## Explicit Gaps
- `awards`, `publications`, `volunteering`, and `other` are not active canonical editor families in `CvDocument` + site UI, so they remain out of scope.
- Legacy guidance from `pdf-ingest/`, `.bak`, archive folders, root `src/types/cvDocument.ts`, and parser-side schemas is informative only and not authoritative for UI linking.
