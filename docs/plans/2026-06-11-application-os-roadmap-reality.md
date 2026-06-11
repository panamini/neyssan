# Application OS — roadmap réelle après PR1 à PR17

Date: 2026-06-11
Statut: clarification roadmap, docs-only
Scope: aider un développeur junior à comprendre la branche `application-os-foundation` sans renommer ni refactorer les modules.

## Objectif

Le plan original reste la référence architecturale. Cette note clarifie seulement ce qui a été réellement livré et comment lire les noms de modules actuels.

## État réel

Certain:
- Les PR1 à PR17 ont livré une architecture incrémentale, surtout pure TypeScript.
- Les persistences ajoutées sont internes/shadow: Application Harness, Candidate Evidence et ApplicationPackageV1.
- Aucun transport MCP distant, ChatGPT App, OAuth, UI Application OS active, export final, envoi, soumission ou action de candidature n’est livré par PR1 à PR17.

Probable:
- Les modules sont prêts pour des tests et futurs appels internes contrôlés.
- Ils ne constituent pas encore un workflow produit complet de bout en bout.

À vérifier:
- Confirmer avec un checkout local et les commandes `rtk` avant tout nouveau PR produit.

## Mapping plan original ↔ code réel

| Plan original | Code réel | Statut | Note pour junior |
|---|---|---|---|
| `application-harness/` | `my-app/src/modules/application-harness/` + `my-app/convex/applicationHarness.ts` | actif + shadow persistence | Spine uniquement. Pas un workflow engine. |
| `candidate-evidence/` | `my-app/src/modules/candidate-evidence/` + `my-app/convex/candidateEvidence.ts` | actif + shadow persistence | Source truth. Ne pas transformer en texte marketing. |
| `career-knowledge/` | `my-app/src/modules/career-knowledge/` | actif | Règles statiques. Pas de génération. |
| `evidence-graph/` | `my-app/src/modules/evidence-graph/` | actif | Matching déterministe + risk flags. À renforcer par tests avant génération. |
| `resume-variants/` | `resume-variant-plan/` et `resume-variant-artifact/` | actif | Le nom réel est plus précis que le plan. Ne pas renommer. |
| `application-review/` | `review-cockpit/` | actif modèle-only | Pas de UI. Modèle de review seulement. |
| `application-packages/` | `application-package/` + `my-app/convex/applicationPackages.ts` | actif + shadow persistence | Package de références/provenance, pas export. |
| `agent-tools/` | `internal-tool-contracts/` | actif | Contrats read-only/pure-compute. Pas de vrais handlers. |
| `mcp/` | `local-mcp/` + `docs/plans/2026-06-11-mcp-readiness.md` | local dry-run + docs | Ne pas brancher de transport ou réseau. |

## Numérotation PR réelle

Certain:
- La numérotation contient une ambiguïté: deux PRs utilisent `PR14`.

| Numéro affiché | PR GitHub | Sens réel |
|---|---:|---|
| PR14 | #122 | ApplicationPackageV1 Convex shadow persistence |
| PR14 | #124 | Controlled ATS Scout adapters |

Règle de lecture:
- Traiter #122 comme un ajout de stockage après PR12.
- Traiter #124 comme le début Distribution `controlled-ats-scout`.
- Ne pas renommer les modules ni réécrire l’historique pour corriger cela.

## Gates à garder visibles

Certain:
- `ready_for_review` ne veut pas dire `approved`.
- `ready_for_generation` ne veut pas dire export ou publication autorisés.
- Local MCP reste dry-run et ne doit pas appeler de vrais handlers.
- Les facts `private` et `never_use` ne doivent jamais alimenter un output public.
- Les generated artifacts peuvent contenir du texte poli; les CandidateFacts ne le doivent pas.

## Prochain travail sûr

Ordre recommandé:
1. Renforcer tests CandidateEvidence sur source paths, valeurs type artefact généré, sparse arrays et hash normalization.
2. Renforcer tests EvidenceGraph sur private/never_use/non-approved facts et allowed claims.
3. Ensuite seulement, préparer PR18 MCP Schema Projection si les gates restent locales/pures.

## Hors scope explicite

Ne pas faire dans cette clarification:
- refactor module names
- Convex schema changes
- UI/routes/pages
- export/download/PDF/DOCX
- send/submit/apply
- Remote MCP / ChatGPT App / OAuth
- changements de dépendances
- generation prompt changes

## Vérification recommandée

```bash
rtk git diff --name-only
rtk git diff --check
rtk git status --short --branch
cd my-app
rtk npx vitest --run src/modules/candidate-evidence/__tests__/*.test.ts
rtk npx vitest --run src/modules/evidence-graph/__tests__/*.test.ts
rtk npx tsc --noEmit
```

## Rollback

Supprimer ce fichier.
