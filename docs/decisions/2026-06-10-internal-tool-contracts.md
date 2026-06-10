# Internal tool contracts

Date: 2026-06-10

## Purpose

PR13 adds the first Distribution-layer boundary for the Application OS chain. It defines a pure TypeScript `internal-tool-contracts` module that describes safe internal tool shapes over existing artifacts and package boundaries.

The module is descriptor-only. It gives future adapters a stable catalog to read later, without making any adapter available now.

## Why this PR is contracts-only

The current Application OS chain already has typed pure boundaries:

```txt
ApplicationContext
→ EvidenceGraph
→ ResumeVariantPlan
→ ReviewCockpit
→ ResumeVariantArtifact
→ CoverLetterArtifact
→ ApplicationPackageV1
```

PR13 adds only:

```txt
Application OS artifacts
→ typed internal tool contract descriptors
→ future adapters later
```

It does not add runtime execution because execution needs separate persistence, approval, audit, adapter, and safety boundaries.

## Safe registry contracts

PR13 registers only safe descriptor contracts:

```txt
application_context.describe
evidence_graph.summarize
resume_variant_plan.summarize
review_cockpit.summarize
resume_variant_artifact.summarize
cover_letter_artifact.summarize
application_package.summarize
application_package.validate
internal_tool_contracts.list
internal_tool_contracts.describe
```

The `*.describe` and `*.summarize` contracts are read-only descriptor shapes for future safe summaries. `application_package.validate` is a pure-compute descriptor for checking supplied `ApplicationPackageContentV1` metadata shape.

## Allowed effects

PR13 allows only:

- `read_only`
- `pure_compute`

`read_only` means a future runtime may read existing references without mutation. `pure_compute` means a future runtime may compute from supplied input only.

## Forbidden effects and scope

PR13 does not execute tools.

PR13 does not add or expose:

- public APIs
- MCP
- Scout
- export/send/apply/track behavior
- generation or prompt behavior
- persistence
- Convex schema or functions
- UI or routes
- PDF/DOCX output
- network calls
- runtime handlers
- ApplicationPackage behavior changes

Forbidden behavior is represented as validation rules and test coverage, not as blocked runtime tools in the registry.

## Hash semantics

`buildInternalToolContractRegistryHash(registry)` uses the existing stable SHA-256 helper from `application-harness/fingerprints.ts`.

The registry hash covers:

- namespace: `internal-tool-contracts`
- type: `internal-tool-contract-registry`
- version: `1`
- full registry content

It is a content identity for the contract catalog. It is not a persistence key and does not imply tool availability.

## Validation rules

Validation asserts that:

- IDs are stable V1 IDs.
- IDs are lowercase dot notation.
- contracts are sorted by ID.
- `contractIds` are sorted by ID.
- `contractIds` exactly match registered contracts.
- duplicate IDs are rejected.
- effects, risk levels, statuses, input kinds, and output kinds are known.
- active contracts cannot use blocked risk.
- active contracts cannot require approval.
- active contracts cannot define `forbiddenUntil`.
- active metadata cannot imply generation, export, send, submit, apply, track, network, scraping, MCP, or Scout behavior.
- descriptor metadata cannot contain resume prose or cover-letter prose.

Invalid consistency throws a clear `TypeError`.

## Tests

PR13 adds focused Vitest coverage for:

- deterministic registry build
- stable registry hash
- content helper shape
- expected safe contracts
- sorted contracts and IDs
- duplicate and unknown value rejection
- active-contract safety rejection
- forbidden ID terms
- unsafe metadata rejection
- generated-looking resume and cover-letter text rejection
- contract lookup and listing helpers
- absence of execution helpers
- absence of MCP, Scout, export, send, apply, or track contracts
- absence of forbidden imports or calls
- input immutability
- deterministic output arrays

## French technical note for junior developers

But du changement : ajouter une frontière de contrats internes, pas une exécution d’outils.

Fichiers à regarder :

- `schema.ts` pour comprendre les types V1.
- `contracts.ts` pour lire le catalogue déterministe.
- `contractRules.ts` pour comprendre les garde-fous.
- `internalToolContracts.test.ts` pour voir les cas limites attendus.

Fichiers à ne pas modifier dans cette PR : UI, routes, Convex, export, PDF/DOCX, génération, prompts, MCP, Scout, `premiumCoverLetter.ts`, Proposal Forge, CV Forge.

Risque principal : faire croire qu’un outil peut déjà s’exécuter. Pour éviter ça, les noms de fonctions d’exécution sont interdits et le registre ne contient que des descripteurs.

Vérification : lancer le test ciblé, les régressions Application OS, TypeScript et `git diff --check`. Le résultat doit rester limité aux cinq fichiers de PR13.

## Rollback notes

Rollback is deletion-only:

```txt
delete my-app/src/modules/internal-tool-contracts/
delete docs/decisions/2026-06-10-internal-tool-contracts.md
rerun tests/typecheck
```

No database, migration, UI, route, generation, export, parser, CV Forge, Proposal Forge, ApplicationPackage, MCP, Scout, or runtime rollback should be required.

## Deferred roadmap note

ApplicationPackageV1 is still pure TypeScript after PR12.
Before real MCP/Scout/export/send/apply flows, Twoweeks likely still needs:

- ApplicationPackageV1 Convex shadow persistence
- review/approval decision persistence
- audit/tool-call event shell

These must be separate future PRs and are not part of PR13.
