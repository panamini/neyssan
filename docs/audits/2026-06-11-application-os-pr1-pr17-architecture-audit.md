# Audit architecture Application OS — PR1 à PR17

Date: 2026-06-11  
Branche inspectée: `application-os-foundation`  
Document créé: `docs/audits/2026-06-11-application-os-pr1-pr17-architecture-audit.md`

## Portée et méthode

Certain:
- Cet audit compare l’état observé après les PR1 à PR17 avec le plan `docs/decisions/2026-06-08-application-os-master-plan.md`.
- L’audit a été fait en lecture seule sur les fichiers GitHub de `application-os-foundation`.
- Le worktree local n’était pas disponible dans l’environnement actif. Les commandes `rtk git ...` demandées n’ont donc pas été exécutées localement.
- Le seul fichier à créer/modifier pour cette tâche est ce document.

Probable:
- La branche contient les PRs Application OS fusionnées jusqu’à PR17.
- Les changements de code Application OS sont concentrés dans `my-app/src/modules/*` et quelques fichiers Convex shadow.

À vérifier:
- Exécuter ces commandes dans un vrai checkout local avant de considérer l’audit comme vérifié par Git local:

```bash
rtk git status --short --branch
rtk git log --oneline -n 25
rtk git diff --name-only origin/application-os-foundation...HEAD
```

Si le checkout est directement sur `application-os-foundation`, la dernière commande peut être vide. Dans ce cas, comparer contre la base pré-Application OS connue ou contre le commit de base de PR1:

```bash
rtk git diff --name-only 2aee6ffd7d37cba2b454c0a42e6bf49adb16b0ad...HEAD
```

## Sources inspectées

Certain:
- `AGENTS.md`
- `docs/decisions/2026-06-08-application-os-master-plan.md`
- décisions liées à application harness, candidate evidence, career knowledge, evidence graph, resume variant, review cockpit, cover letter artifact, application package, internal tool contracts, controlled ATS scout, local MCP
- `docs/plans/2026-06-11-mcp-readiness.md`
- modules source Application OS dans `my-app/src/modules/`
- Convex shadow files: `my-app/convex/schema.ts`, `applicationHarness.ts`, `candidateEvidence.ts`, `applicationPackages.ts`, et leurs libs
- PRs GitHub #101 à #127 liées à la roadmap
- `my-app/package.json`

À vérifier:
- Exécution locale complète des tests.
- Diff local final après création du document.

# 1. Roadmap réelle reconstruite

## Synthèse

Certain:
- Les PRs ont livré une architecture incrémentale, majoritairement pure TypeScript, avec quelques persistences Convex internes dites shadow.
- Les PRs n’ont pas livré de Remote MCP, ChatGPT App, auto-apply, export public, envoi, soumission, tracking, scraping LinkedIn/Upwork/Indeed, ni UI Application OS active.

Probable:
- Les modules sont utilisables par tests et par futurs appels internes, mais ne sont pas encore branchés comme expérience produit complète.

À vérifier:
- Confirmer par `rtk git diff --name-only` local que seule cette documentation est modifiée par l’audit.

## Progression réelle observée

| Roadmap prévue | PR GitHub observée | Livraison réelle | Statut |
|---|---:|---|---|
| PR0.5 — Master plan | #102 | Document de décision master plan | Certain |
| PR1 — Application Harness | #101 | Kernel TypeScript pur: types, stable hash, idempotency | Certain |
| PR1.1 — Harness hardening | #103 | Ancrage candidat obligatoire, namespace hash, raw job text hash | Certain |
| PR2 — Convex shadow persistence | #104 | Tables internes `applicationContexts`, `applicationRuns`, `applicationArtifacts` | Certain |
| PR3 — ApplicationContext builder | #105 | Builder/projection Convex shadow | Certain par PR; code détaillé à relire localement |
| PR3.1 — Builder fixes | #106 | Fix contact identity hash + `cvSnapshotHash` | Certain par PR; code détaillé à relire localement |
| Fix forward harness schema | #109/#110 | Nettoyage intégration Convex schema avant PR4 | Certain |
| PR4 — Candidate source/fact kernel | #111 | Kernel `candidate-evidence` TypeScript pur | Certain |
| PR5 — CareerKnowledge | #112 | Règles statiques + resolver | Certain |
| PR6 — Candidate evidence persistence | #113 | Tables internes source docs, facts, import batches | Certain |
| PR6.1 — Source doc canonical IDs | #114 | Durcissement IDs source docs | Certain par PR; code détaillé à relire localement |
| PR7 — EvidenceGraph | #115 | Graph preuve/demandes/matches/risques/claims | Certain |
| PR8 — ResumeVariantPlan | #116 | Plan de variante CV/resume, pas génération | Certain |
| PR9 — ReviewCockpit | #117 | Modèle review-only, pas UI | Certain |
| PR10 — Resume Variant Artifact | #118 | Artefact planning/provenance, pas final resume | Certain |
| PR11 — Cover Letter Artifact | #119 | Adaptateur de texte fourni, pas génération | Certain |
| PR12 — ApplicationPackageV1 | #120 | Package pur qui référence les artefacts | Certain |
| PR13 — Internal Tool Contracts | #121 | Catalogue de contrats read-only/pure-compute | Certain |
| PR14 — ApplicationPackage Convex shadow persistence | #122 | Persistance interne package | Certain, mais numérotation confuse |
| Baseline test fix | #123 | Fix de test App page baseline | Certain; hors roadmap principale |
| PR14 — Controlled ATS Scout adapters | #124 | Adapters ATS purs + normalisation payloads | Certain, mais double PR14 |
| PR15 — Controlled ATS public endpoint resolver | #125 | Résolution/fetcher public no-auth avec `fetchImpl` injecté | Certain |
| PR16 — Local MCP Beta | #126 | Adapter local MCP-shaped, dry-run uniquement | Certain |
| PR17 — MCP / ChatGPT App readiness spec | #127 | Documentation readiness, pas de code | Certain |

## Numérotation

Certain:
- La roadmap a une duplication de numéro: `PR14` désigne à la fois `ApplicationPackageV1 Convex shadow persistence` et `Controlled ATS Scout adapters`.

Probable:
- La roadmap fonctionnelle attendue reste lisible si on traite `ApplicationPackageV1 Convex shadow persistence` comme un ajout de stockage entre PR12 et PR13/PR14 Distribution.

À vérifier:
- Corriger ou annoter les docs de roadmap pour éviter qu’un junior confonde les deux PR14.

# 2. Comparaison avec le plan original

| Phase | Plan original | Implémentation réelle | Conforme ? | Écart | Action recommandée |
|---|---|---|---|---|---|
| Spine | Stable ApplicationContext, ApplicationRun, Artifact shell; shadow persistence; pas de UI/génération/export/MCP. | `application-harness` + Convex internal `applicationContexts`, `applicationRuns`, `applicationArtifacts`; builder ApplicationContext livré. | Oui | Les enums contiennent des opérations futures comme `export_artifact` et `track_application`, mais elles restent des valeurs de modèle/persistence, pas des workflows actifs. | Ne pas brancher export/tracking sans approval/audit. Ajouter une note docs si besoin. |
| Proof Layer | CandidateEvidence, CareerKnowledge, EvidenceGraph; claims source-backed; private/never_use exclus. | `candidate-evidence`, `career-knowledge`, `evidence-graph`; Convex shadow persistence pour evidence; règles et risk flags. | Oui | Matching EvidenceGraph déterministe/simple; pas semantic matching, pas review UI de facts. | Renforcer tests et fixtures avant toute génération réelle. |
| Product Value Layer | ResumeVariantPlan, ReviewCockpit, Resume/CoverLetter/ApplicationPackage; pas de mutation CV canonique, pas export. | Plan, cockpit, resume artifact, cover-letter artifact, package, package shadow persistence. | Oui | `ready_for_generation` / `ready_for_review` peuvent être mal lus comme approval. | Garder wording strict: ready != approved/exported/sent. |
| Distribution Layer | Scout/MCP plus tard, outils sans logique métier, pas scraping/auto-apply. | Internal tool contracts, controlled ATS adapters/fetcher, Local MCP dry-run, readiness doc. | Oui avec prudence | Distribution a commencé, mais bornée. Remote MCP/ChatGPT App explicitement non prêt. | Prochaine PR seulement pure MCP schema projection, sans transport. |

# 3. Modules audités

## Module: application-harness

### Type de fichier/module
Pure TypeScript + Convex shadow persistence interne.

### Rôle dans l’architecture
Spine. Fournit l’identité stable: `SourceRefV1`, `ApplicationContextV1`, `ApplicationRunV1`, `ApplicationArtifactV1`, hashes, idempotency.

### Statut
Certain:
- Actif comme module source et comme tables Convex internes.
- Shadow-only côté persistence.
- Pas un workflow produit complet.

Probable:
- Sert de base aux modules suivants via `buildStableHash`.

À vérifier:
- Tous les appels Convex restent internes dans les routes existantes.

### Fichiers importants à lire
- `my-app/src/modules/application-harness/schema.ts`
- `my-app/src/modules/application-harness/fingerprints.ts`
- `my-app/src/modules/application-harness/idempotency.ts`
- `my-app/convex/lib/applicationHarness.ts`
- `my-app/convex/applicationHarness.ts`
- `my-app/convex/schema.ts`
- `my-app/src/modules/application-harness/__tests__/fingerprints.test.ts`

### Fichiers à ne pas toucher sans demande explicite
- `my-app/convex/schema.ts`
- `my-app/convex/applicationHarness.ts`
- `my-app/src/app/`, `my-app/src/pages/`, `my-app/src/components/`
- export/send/apply/tracking flows

### Ce qui semble conforme au plan
Certain:
- Hashing stable et déterministe.
- Candidate hash exige un ancrage explicite.
- Convex create/reuse protège contre collisions stables.
- Run lifecycle interne est borné par statuts.

### Écarts ou risques
Probable:
- Les opérations `export_artifact` et `track_application` existent comme enum. Ce n’est pas un comportement actif, mais un junior peut le lire comme autorisation produit.

À vérifier:
- Aucun appel produit ne crée de run export/tracking sans approval gate.

### Cas limites à vérifier
Certain couvert par tests:
- ordre objet stable
- ordre array significatif
- Dates sérialisées
- types non supportés rejetés
- références circulaires rejetées
- candidate hash sans ancrage rejeté
- input mutation évitée

À vérifier:
- transitions `ApplicationRun` en conflit concurrent
- contenu `ApplicationArtifact.content` trop large ou privé
- absence d’usage public des fonctions Convex internes

### Tests existants
Certain:
- `my-app/src/modules/application-harness/__tests__/fingerprints.test.ts`
- `my-app/convex/__tests__/applicationHarness.test.ts`

### Vérifications recommandées
```bash
cd my-app
rtk npx vitest --run src/modules/application-harness/__tests__/*.test.ts
rtk npx vitest --run convex/__tests__/applicationHarness.test.ts
```

### Améliorations proposées
- Ajouter une courte doc “enum future != workflow autorisé”.
- Ne pas modifier l’architecture du harness.

## Module: candidate-evidence

### Type de fichier/module
Pure TypeScript + Convex shadow persistence interne.

### Rôle dans l’architecture
Proof Layer source-truth. Représente les documents source, facts candidats, source paths et import batches.

### Statut
Certain:
- Actif comme module source.
- Shadow-only en Convex pour source docs/facts/import batches.

Probable:
- Pas encore intégré à un import/parser produit complet.

À vérifier:
- Aucun flux existant ne promeut du texte généré en `CandidateFactV1`.

### Fichiers importants à lire
- `my-app/src/modules/candidate-evidence/schema.ts`
- `my-app/src/modules/candidate-evidence/fingerprints.ts`
- `my-app/src/modules/candidate-evidence/sourcePaths.ts`
- `my-app/convex/lib/candidateEvidence.ts`
- `my-app/convex/candidateEvidence.ts`
- `my-app/src/modules/candidate-evidence/__tests__/candidateEvidence.test.ts`

### Fichiers à ne pas toucher sans demande explicite
- Convex schema/functions
- parser/import pipeline
- scraping/import LinkedIn/Upwork/Indeed
- canonical CV/profile update flows

### Ce qui semble conforme au plan
Certain:
- Source docs stockent metadata/hash, pas texte brut complet.
- Facts conservent `sourceDocumentId`, `sourcePath`, `sourceQuote`, `reviewState`, `visibility`.
- `private` et `never_use` sont first-class.
- Guards rejettent source paths et values qui ressemblent à artefacts générés.

### Écarts ou risques
Probable:
- `value: v.any()` est nécessaire pour Convex, mais la sûreté dépend des helpers de sanitize.

À vérifier:
- Tous les writes passent par les helpers internes, pas par une autre mutation.

### Cas limites à vérifier
Certain couvert par tests ou code:
- sourcePath invalide
- texte généré comme fact
- values non JSON Convex-compatible
- sparse arrays, circular refs, functions, promises
- empty import batch
- `never_use` et `private`

À vérifier:
- doublons inter-documents avec même source quote
- changement de visibilité après persistence
- migration future si facts deviennent publics

### Tests existants
Certain:
- `my-app/src/modules/candidate-evidence/__tests__/candidateEvidence.test.ts`
- `my-app/convex/__tests__/candidateEvidence.test.ts`

### Vérifications recommandées
```bash
cd my-app
rtk npx vitest --run src/modules/candidate-evidence/__tests__/*.test.ts
rtk npx vitest --run convex/__tests__/candidateEvidence.test.ts
```

### Améliorations proposées
- Ajouter un test cross-module: fact `private` ou `never_use` ne sort jamais dans EvidenceGraph allowed claims.
- Garder parsing/import hors scope.

## Module: career-knowledge

### Type de fichier/module
Pure TypeScript, règles statiques et resolver.

### Rôle dans l’architecture
Proof Layer policy-lite. Donne des règles déterministes de source truth, claim safety, review gates, localisation.

### Statut
Certain:
- Actif comme module source.
- Pas de persistence.
- Pas de génération.

### Fichiers importants à lire
- `my-app/src/modules/career-knowledge/schema.ts`
- `my-app/src/modules/career-knowledge/rules.ts`
- `my-app/src/modules/career-knowledge/resolver.ts`
- `my-app/src/modules/career-knowledge/__tests__/careerKnowledge.test.ts`

### Fichiers à ne pas toucher sans demande explicite
- Prompt/generation code
- legal/compliance claims
- ATS certification claims

### Ce qui semble conforme au plan
Certain:
- Règles pour approved facts only, never_use exclusion, private exclusion, generated text artifact-only, no invented metrics, canonical CV non-mutation, approval before distribution.

### Écarts ou risques
Probable:
- Les règles sont heuristiques. Elles ne doivent pas devenir des garanties légales/ATS.

À vérifier:
- Aucun texte UI/doc ne les présente comme certification.

### Cas limites à vérifier
Certain:
- marché inconnu normalisé vers `other`
- rule IDs uniques
- filtres document/artifact/type

À vérifier:
- drift entre rule IDs et `EvidenceGraph.riskRules`

### Tests existants
Certain par décision PR5:
- `my-app/src/modules/career-knowledge/__tests__/careerKnowledge.test.ts`

### Vérifications recommandées
```bash
cd my-app
rtk npx vitest --run src/modules/career-knowledge/__tests__/*.test.ts
```

### Améliorations proposées
- Ajouter un petit test de cohérence: chaque `careerKnowledgeRuleId` référencé par EvidenceGraph existe.

## Module: evidence-graph

### Type de fichier/module
Pure TypeScript Proof Layer.

### Rôle dans l’architecture
Mappe demandes job ↔ facts candidats approuvés. Produit matches, missing evidence, risk flags, allowed claims et blocked claim IDs.

### Statut
Certain:
- Actif comme module source testable.
- Shadow-only au sens produit: pas branché UI/génération/persistence dédiée.

### Fichiers importants à lire
- `my-app/src/modules/evidence-graph/schema.ts`
- `my-app/src/modules/evidence-graph/buildEvidenceGraph.ts`
- `my-app/src/modules/evidence-graph/riskRules.ts`
- `my-app/src/modules/evidence-graph/__tests__/evidenceGraph.test.ts`

### Fichiers à ne pas toucher sans demande explicite
- generation/prompt code
- CV Forge / Proposal Forge
- candidate fact persistence

### Ce qui semble conforme au plan
Certain:
- Allowed claims viennent de facts `approved` + `use_in_applications`.
- Private/never_use/generation-like facts sont exclus ou risk-flagged.
- Missing evidence devient warning/blocker, pas texte inventé.

### Écarts ou risques
Probable:
- Matching texte déterministe simple: risques faux positifs/faux négatifs.

À vérifier:
- Comportement avec demandes très longues, abréviations, multilingue, labels vides.

### Cas limites à vérifier
Certain:
- demands/facts triés pour ordre stable
- private/never_use non allowed
- unsupported metrics/certifications/languages risk flags

À vérifier:
- ids dupliqués
- poids/required unknown
- source refs manquantes
- hallucination indirecte via `normalizedText`

### Tests existants
Certain:
- `my-app/src/modules/evidence-graph/__tests__/evidenceGraph.test.ts`

### Vérifications recommandées
```bash
cd my-app
rtk npx vitest --run src/modules/evidence-graph/__tests__/*.test.ts
```

### Améliorations proposées
- Ajouter fixtures de non-régression sur false-positive matching.
- Ne pas ajouter semantic matching/LLM ici sans PR dédiée.

## Module: resume-variants

### Type de fichier/module
Nom demandé: `resume-variants`.  
Nom réel observé: `resume-variant-plan` + `resume-variant-artifact`.

### Rôle dans l’architecture
Product Value Layer. Transforme EvidenceGraph en plan de variante, puis en artefact de variante reviewable, sans générer le CV final.

### Statut
Certain:
- `resume-variant-plan` est actif comme module pur.
- `resume-variant-artifact` est actif comme module pur.
- Pas de mutation CV canonique.
- Pas d’export/PDF/DOCX.

À vérifier:
- Corriger les docs ou commandes qui parlent de `resume-variants` si ce chemin n’existe pas.

### Fichiers importants à lire
- `my-app/src/modules/resume-variant-plan/schema.ts`
- `my-app/src/modules/resume-variant-plan/buildResumeVariantPlan.ts`
- `my-app/src/modules/resume-variant-plan/planRules.ts`
- `my-app/src/modules/resume-variant-artifact/schema.ts`
- `my-app/src/modules/resume-variant-artifact/buildResumeVariantArtifact.ts`
- tests dans les deux dossiers `__tests__`

### Fichiers à ne pas toucher sans demande explicite
- canonical CV data
- active CV snapshots
- export/PDF/DOCX
- prompt/generation code

### Ce qui semble conforme au plan
Certain:
- Plan items claim-backed doivent référencer allowed claims, candidate facts et accepted matches.
- Artefact conserve provenance IDs.
- `ready_for_generation` ne signifie pas approval.

### Écarts ou risques
Probable:
- Le nom de statut `ready_for_generation` peut pousser un junior à brancher génération trop tôt.

À vérifier:
- Aucun caller actif ne traite ce statut comme permission de générer/exporter.

### Cas limites à vérifier
Certain:
- upstream blocked → status blocked
- no source-backed item → draft
- generated-like metadata rejected
- unknown IDs rejetés

À vérifier:
- plan avec warnings non bloquants mais nombreuses missing evidences
- section ordering déterministe sur gros inputs

### Tests existants
Certain:
- `my-app/src/modules/resume-variant-plan/__tests__/resumeVariantPlan.test.ts`
- `my-app/src/modules/resume-variant-artifact/__tests__/resumeVariantArtifact.test.ts`

### Vérifications recommandées
```bash
cd my-app
rtk npx vitest --run src/modules/resume-variant-plan/__tests__/*.test.ts
rtk npx vitest --run src/modules/resume-variant-artifact/__tests__/*.test.ts
```

### Améliorations proposées
- Ajouter une note docs: `ready_for_generation` = structure prête, pas autorisation.
- Ne pas renommer les modules dans cette PR d’audit.

## Module: review-cockpit

### Type de fichier/module
Pure TypeScript Product Value Layer.

### Rôle dans l’architecture
Vue modèle de review. Agrège graph + plan en status, counts, warnings, missing evidence, blocked claims, source support.

### Statut
Certain:
- Actif comme modèle pur.
- Pas de page, pas de persistance review decisions.

### Fichiers importants à lire
- `my-app/src/modules/review-cockpit/schema.ts`
- `my-app/src/modules/review-cockpit/buildReviewCockpit.ts`
- `my-app/src/modules/review-cockpit/__tests__/reviewCockpit.test.ts`

### Fichiers à ne pas toucher sans demande explicite
- UI/routes/pages
- approval workflow
- persistence des décisions review

### Ce qui semble conforme au plan
Certain:
- Status deterministic: blocked, needs_review, ready.
- Read-only, pas d’invention de claims.

### Écarts ou risques
Probable:
- Les items de review sont des signaux. Ils ne remplacent pas un vrai workflow approval.

À vérifier:
- Aucun code ne transforme `ready` en approval/export.

### Cas limites à vérifier
Certain:
- blockers priorisés
- missing evidence intégré
- allowed claims/source support représentés

À vérifier:
- très gros nombre d’items
- tri stable inter-buckets
- risque de duplication warning/missing

### Tests existants
Certain:
- `my-app/src/modules/review-cockpit/__tests__/reviewCockpit.test.ts`

### Vérifications recommandées
```bash
cd my-app
rtk npx vitest --run src/modules/review-cockpit/__tests__/*.test.ts
```

### Améliorations proposées
- Garder un futur UI strictement read-only si ajouté.

## Module: cover-letter-artifact

### Type de fichier/module
Pure TypeScript adapter.

### Rôle dans l’architecture
PR11. Représente un texte de cover letter fourni par un caller, en héritant la provenance de `ResumeVariantArtifactV1`.

### Statut
Certain:
- Actif comme module pur.
- Adapter only, pas génération.

### Fichiers importants à lire
- `my-app/src/modules/cover-letter-artifact/schema.ts`
- `my-app/src/modules/cover-letter-artifact/buildCoverLetterArtifact.ts`
- `my-app/src/modules/cover-letter-artifact/artifactRules.ts`
- tests dans `__tests__`

### Fichiers à ne pas toucher sans demande explicite
- Proposal Forge
- `premiumCoverLetter.ts`
- LLM/prompt generation
- export/send/submit/apply

### Ce qui semble conforme au plan
Certain:
- `sourceText` est préservé exactement.
- Le module n’ajoute pas de prose.
- Provenance héritée du resume artifact.

### Écarts ou risques
Probable:
- `existing_generated_output` permet de préserver un texte déjà généré ailleurs. C’est acceptable si traité comme artefact, pas comme fact.

À vérifier:
- Le caller ne doit pas prétendre que ce texte est source truth.

### Cas limites à vérifier
Certain:
- texte vide → draft/warning
- upstream blocked → blocked
- metadata générée hors texte source rejetée
- input mutation évitée

À vérifier:
- sourceText très long
- markdown dangereux ou privé si exposé plus tard

### Tests existants
Certain par décision PR11:
- `my-app/src/modules/cover-letter-artifact/__tests__/coverLetterArtifact.test.ts`

### Vérifications recommandées
```bash
cd my-app
rtk npx vitest --run src/modules/cover-letter-artifact/__tests__/*.test.ts
```

### Améliorations proposées
- Ajouter une limite future de taille avant exposition publique/MCP.

## Module: application-package

### Type de fichier/module
Pure TypeScript + Convex shadow persistence interne.

### Rôle dans l’architecture
Assemble resume artifact + cover-letter artifact + provenance rollups dans `ApplicationPackageV1`.

### Statut
Certain:
- Module pur actif.
- Table `applicationPackages` shadow interne.
- Pas approval/export/send/apply/track.

### Fichiers importants à lire
- `my-app/src/modules/application-package/schema.ts`
- `my-app/src/modules/application-package/buildApplicationPackage.ts`
- `my-app/src/modules/application-package/packageRules.ts`
- `my-app/convex/lib/applicationPackages.ts`
- `my-app/convex/applicationPackages.ts`
- tests module et Convex

### Fichiers à ne pas toucher sans demande explicite
- export/PDF/DOCX
- approval workflow
- send/apply/track
- Convex schema sauf PR explicitement scoped

### Ce qui semble conforme au plan
Certain:
- Package référence les artefacts et content hashes.
- Package items ne dupliquent pas le texte complet CV/cover letter.
- Shadow persistence refuse des champs top-level interdits.
- Create-or-reuse protège collisions package/content/payload.

### Écarts ou risques
Certain:
- La persistence stocke le payload complet `ApplicationPackageV1`; c’est prévu, mais sensible.

Probable:
- Risque futur si le payload inclut un cover-letter text trop privé ou trop gros via les artefacts amont.

À vérifier:
- Politique de redaction avant MCP/export.

### Cas limites à vérifier
Certain:
- upstream status, provenance union, content hash, top-level forbidden fields.

À vérifier:
- gros payload
- conflict concurrent create/reuse
- migration si approval decisions sont ajoutées plus tard

### Tests existants
Certain:
- `my-app/src/modules/application-package/__tests__/applicationPackage.test.ts`
- `my-app/convex/__tests__/applicationPackages.test.ts`

### Vérifications recommandées
```bash
cd my-app
rtk npx vitest --run src/modules/application-package/__tests__/*.test.ts
rtk npx vitest --run convex/__tests__/applicationPackages.test.ts
```

### Améliorations proposées
- Ajouter une doc courte “ApplicationPackage is not export”.

## Module: internal-tool-contracts

### Type de fichier/module
Pure TypeScript descriptor registry.

### Rôle dans l’architecture
Distribution Layer contractuelle. Définit les outils internes autorisés pour futurs adapters sans exécution runtime.

### Statut
Certain:
- Actif comme module source.
- Descriptor-only.
- Pas d’exécution outil.

### Fichiers importants à lire
- `my-app/src/modules/internal-tool-contracts/schema.ts`
- `my-app/src/modules/internal-tool-contracts/contracts.ts`
- `my-app/src/modules/internal-tool-contracts/contractRules.ts`
- tests dans `__tests__`

### Fichiers à ne pas toucher sans demande explicite
- runtime handlers
- MCP transport
- export/send/apply/track/generation
- network code

### Ce qui semble conforme au plan
Certain:
- Effets autorisés limités à `read_only` et `pure_compute`.
- IDs interdits pour export/send/submit/apply/track/generation/MCP/Scout/scrape/crawl.
- Active metadata ne doit pas impliquer network, remote, HTTP, LLM, persist, write.

### Écarts ou risques
Probable:
- Les contrats ne font que décrire. Un futur module peut violer la frontière s’il ajoute des handlers directement.

À vérifier:
- Maintenir les contrats sans logique métier.

### Cas limites à vérifier
Certain:
- duplicate IDs
- unknown effects/kinds/status
- active blocked/requiresApproval interdit
- unsafe metadata rejetée

À vérifier:
- mapping avec Local MCP après ajout de nouveaux contrats

### Tests existants
Certain par décision PR13:
- `my-app/src/modules/internal-tool-contracts/__tests__/internalToolContracts.test.ts`

### Vérifications recommandées
```bash
cd my-app
rtk npx vitest --run src/modules/internal-tool-contracts/__tests__/*.test.ts
```

### Améliorations proposées
- Ajouter une checklist avant tout nouveau contrat: effet, approval, output privacy, absence de handler.

## Module: controlled-ats-scout

### Type de fichier/module
Pure TypeScript adapters + resolver/fetcher public no-auth avec `fetchImpl` injecté.

### Rôle dans l’architecture
Distribution Layer contrôlée pour sources ATS connues. Normalise payloads ou récupère JSON public officiel via endpoint borné.

### Statut
Certain:
- Actif comme module source.
- Pas un crawler générique.
- Pas LinkedIn/Upwork/Indeed.
- Pas persistence.

Probable:
- Le fetcher peut faire du réseau seulement si un caller lui injecte `fetchImpl`.

À vérifier:
- Aucun caller produit ne l’invoque automatiquement.

### Fichiers importants à lire
- `my-app/src/modules/controlled-ats-scout/schema.ts`
- `my-app/src/modules/controlled-ats-scout/scoutRules.ts`
- `my-app/src/modules/controlled-ats-scout/adapters.ts`
- `my-app/src/modules/controlled-ats-scout/sourceResolver.ts`
- `my-app/src/modules/controlled-ats-scout/publicEndpointFetcher.ts`
- tests dans `__tests__`

### Fichiers à ne pas toucher sans demande explicite
- browser automation
- generic crawler
- LinkedIn/Upwork/Indeed support
- job persistence
- ApplicationContext creation from leads

### Ce qui semble conforme au plan
Certain:
- Forbidden vendors list inclut LinkedIn, Upwork, Indeed, generic web, unknown scraper.
- Resolver accepte seulement des hosts ATS connus et HTTPS.
- Fetcher rejette auth/cookies, redirects, non-JSON, non-200, trop gros, invalid JSON.

### Écarts ou risques
Certain:
- PR14 decision doc mentionne Greenhouse/Lever/Ashby, mais le code final inclut aussi SmartRecruiters/Recruitee via PR15. Ce n’est pas forcément incorrect, mais la lecture isolée de PR14 est obsolète.

Probable:
- Toute extension ATS doit rester très contrôlée.

À vérifier:
- Tests de pagination et timeout couvrent bien les cas réseau simulés.

### Cas limites à vérifier
Certain:
- unsupported/forbidden host
- invalid URL
- redirect rejected
- non-json rejected
- oversized response rejected
- malformed records rejected
- dedupe stable

À vérifier:
- timeout réel selon environnement
- pagination Lever/SmartRecruiters avec pages vides, maxPages, totalFound incohérent

### Tests existants
Certain:
- `my-app/src/modules/controlled-ats-scout/__tests__/controlledAtsScout.test.ts`

### Vérifications recommandées
```bash
cd my-app
rtk npx vitest --run src/modules/controlled-ats-scout/__tests__/*.test.ts
```

### Améliorations proposées
- Ajouter ou vérifier une fixture de timeout et une fixture maxPages.
- Ne pas ajouter de crawler/browser automation.

## Module: local-mcp

### Type de fichier/module
Pure TypeScript local MCP-shaped adapter.

### Rôle dans l’architecture
Distribution Layer local. Teste un flux `LocalMcpRequestV1 -> authz -> dry-run response` sans vrai serveur MCP.

### Statut
Certain:
- Actif comme module source.
- Dry-run only.
- Pas Remote MCP, pas ChatGPT App, pas transport, pas OAuth, pas network, pas persistence.

### Fichiers importants à lire
- `my-app/src/modules/local-mcp/schema.ts`
- `my-app/src/modules/local-mcp/toolRegistry.ts`
- `my-app/src/modules/local-mcp/authz.ts`
- `my-app/src/modules/local-mcp/localMcpAdapter.ts`
- `my-app/src/modules/local-mcp/__tests__/localMcp.test.ts`

### Fichiers à ne pas toucher sans demande explicite
- MCP transport
- HTTP/WebSocket/SSE/Streamable HTTP
- ChatGPT App
- OAuth
- real product handlers

### Ce qui semble conforme au plan
Certain:
- Quatre outils exposés seulement: application package, evidence graph, resume variant plan, review cockpit summaries.
- Approval requis pour medium risk.
- Unknown/malformed/missing user/non-allowlisted refusés.
- Exécution retourne `local_mcp_dry_run` et clone les arguments.

### Écarts ou risques
Probable:
- Le nom MCP peut faire croire à un vrai server. Ce n’est pas le cas.

À vérifier:
- Aucun endpoint ou route ne l’expose.

### Cas limites à vérifier
Certain:
- unknown tool
- missing user
- approval missing
- invalid request
- argument cloning

À vérifier:
- output size quand de vrais handlers existeront
- user/session auth avant remote
- audit log avant real actions

### Tests existants
Certain:
- `my-app/src/modules/local-mcp/__tests__/localMcp.test.ts`

### Vérifications recommandées
```bash
cd my-app
rtk npx vitest --run src/modules/local-mcp/__tests__/*.test.ts
```

### Améliorations proposées
- Prochaine PR possible: projection pure vers descriptors MCP. Pas de transport.

## Module: mcp-readiness docs

### Type de fichier/module
Documentation-only.

### Rôle dans l’architecture
PR17. Définit les gaps avant Remote MCP ou ChatGPT App.

### Statut
Certain:
- Docs-only.
- Dit explicitement que Remote MCP / ChatGPT App ne sont pas prêts.

### Fichiers importants à lire
- `docs/plans/2026-06-11-mcp-readiness.md`
- `docs/decisions/2026-06-11-local-mcp-beta.md`
- `my-app/src/modules/local-mcp/*`
- `my-app/src/modules/internal-tool-contracts/*`

### Fichiers à ne pas toucher sans demande explicite
- MCP server code
- transport
- deployment
- OAuth
- ChatGPT App

### Ce qui semble conforme au plan
Certain:
- La doc recommande PR18 pure MCP schema projection, puis PR19 envelope, PR20 approval/audit, PR21 handler design, PR22 transport spike, PR23 ChatGPT App UX/privacy.

### Écarts ou risques
Certain:
- La doc référence plusieurs versions/spécifications MCP dans une même section. Cela peut créer de la confusion.
- La checklist sécurité n’a pas encore de milestone/gate explicite.

### Cas limites à vérifier
À vérifier:
- Compatibilité de futures projections avec la version MCP choisie.
- Sortie MCP trop grosse ou privée.
- Auth/user/session/approval durable.

### Tests existants
Certain:
- Aucun test requis pour PR17 car docs-only.

### Vérifications recommandées
```bash
rtk git diff --name-only
rtk git diff --check
rtk git status --short --branch
```

### Améliorations proposées
- Ajouter une note de version MCP cible.
- Ajouter un gate explicite: “aucun transport avant checklist PR18–PR21 validée”.

# 4. Risques transversaux

| Risque | Statut actuel | Preuve/source | Sévérité | Action |
|---|---|---|---|---|
| Mutation involontaire des CV canoniques | Mitigé | Master plan interdit; modules product sont purs; docs PR8/PR10/PR12 excluent mutations | P2 | Garder CV Forge hors scope. Ajouter test cross-module si génération future. |
| Mutation des candidate facts | Mitigé partiellement | Candidate facts ont guards; Convex patch permet reviewState/visibility seulement | P2 | Vérifier que writes passent par helpers. Ne jamais stocker generated text comme fact. |
| Generated text sans provenance | Mitigé partiellement | Artifacts conservent provenance; cover letter peut préserver texte fourni | P2 | Avant export/MCP, imposer provenance + approval + privacy filter. |
| Export avant approval | Non implémenté | ApplicationPackage dit ready_for_review seulement; no export behavior | P1 conditionnel | Ne pas ajouter export sans PR approval/audit. |
| Tracking avant approval | Non implémenté | Type enum seulement dans harness | P1 conditionnel | Ne pas brancher tracking avant approval/audit. |
| Send / submit / apply non autorisé | Non implémenté | Master plan et contracts interdisent ces termes/comportements | P1 conditionnel | Tout ajout doit être refusé hors PR dédiée. |
| Scraping LinkedIn / Upwork / Indeed | Mitigé | Controlled ATS forbidden vendors + host guards | P1 conditionnel | Ne pas ajouter support ni browser automation. |
| Réseau ou remote MCP trop tôt | Risque ouvert pour futur | Local MCP dry-run; PR17 dit not ready; controlled ATS fetcher peut faire réseau avec fetchImpl | P1 conditionnel | Prochaine PR MCP pure schema seulement. Vérifier absence de callers réseau automatiques. |
| Outil MCP qui possède de la logique métier | Mitigé | Local MCP retourne dry-run; internal contracts descriptor-only | P1 conditionnel | Interdire handlers réels avant PR21 design + approval/audit. |
| Persistence non auditée | Partiellement auditée | Convex shadow tables existent pour harness/evidence/package | P2 | Lancer tests Convex localement. Ajouter doc de propriété des tables. |
| Output privé exposé publiquement | Mitigé mais pas résolu pour futur | EvidenceGraph exclut private/never_use; MCP n’a pas de vrai output | P1 conditionnel | Ajouter privacy filter avant tout MCP/ChatGPT/export. |
| `never_use` fact exposée | Mitigé mais à surveiller | EvidenceGraph/rules excluent `never_use` | P1 conditionnel | Test end-to-end source fact never_use → aucun public output. |
| Dépendances inutilisées héritées | Ouvert | `package.json` contient plusieurs deps existantes; pas changées par Application OS | P3 | Ne pas nettoyer dans cette PR. Audit dépendances séparé si demandé. |
| Tests insuffisants ou trop étroits | Ouvert | Suites ciblées nombreuses, mais pas exécutées ici et peu d’intégration end-to-end | P2 | Lancer commandes. Ajouter tests cross-module sans UI. |
| Docs divergentes du code réel | Ouvert | Double PR14; PR14 ATS doc ne liste pas SmartRecruiters/Recruitee; `resume-variants` vs chemins réels | P2/P3 | Docs cleanup petite PR. |
| Output privé exposé via ApplicationPackage payload | À vérifier | Package shadow stocke payload complet, mais interdit top-level raw fields | P2 | Ajouter taille/redaction/privacy review avant exposition. |

# 5. Cas limites à vérifier

## application-harness
- Certain: stable hash, Date, circular refs, unsupported types, candidate anchors.
- À vérifier: transitions concurrentes `ApplicationRun`, content trop gros, artifact private payload.

## candidate-evidence
- Certain: sourcePath invalides, generated path/value, non-JSON values, empty import batch.
- À vérifier: duplicate facts, changement visibility/reviewState, raw source accidentally passed outside helper.

## career-knowledge
- Certain: unknown market, unique IDs, filtres simples.
- À vérifier: drift rule IDs avec EvidenceGraph, coverage nouveaux artifact types.

## evidence-graph
- Certain: private/never_use/pending/rejected non allowed, missing evidence, unsupported cert/language/metric flags.
- À vérifier: false positives token matching, ids dupliqués, labels vides, multilingue.

## resume-variant-plan / resume-variant-artifact
- Certain: blocked upstream, unknown refs, generated-text metadata guards, deterministic order.
- À vérifier: très gros graph, section ordering complexe, ready_for_generation mal utilisé.

## review-cockpit
- Certain: status blocked/needs_review/ready, buckets principaux.
- À vérifier: output size, duplicates, UI future read-only.

## cover-letter-artifact
- Certain: texte exact préservé, vide, upstream status, metadata guard.
- À vérifier: texte trop long, markdown privé, sourceKind `unknown` en distribution future.

## application-package
- Certain: upstream status, provenance union, content hash, top-level forbidden fields.
- À vérifier: payload complet exposé via MCP/export, conflit concurrent, package trop gros.

## internal-tool-contracts
- Certain: forbidden IDs/metadata, duplicate IDs, active contract safety.
- À vérifier: nouveaux contrats futurs, output schemas, privacy labels.

## controlled-ats-scout
- Certain: forbidden hosts, invalid URL, redirect/non-json/oversized/invalid JSON, dedupe.
- À vérifier: timeout réseau, pagination extrême, ATS non supporté, backoff/rate limits.

## local-mcp
- Certain: unknown tool, missing user, approval missing, invalid request, clone args, dry-run.
- À vérifier: real handler boundary, output too large, user/session auth, audit, remote transport.

# 6. Couverture de tests

Les tests n’ont pas été exécutés dans cet environnement. Cette table indique les suites observées ou attendues par les PRs.

| Suite | Existe ? | Ce qu’elle couvre | Manques probables | Commande recommandée |
|---|---|---|---|---|
| application-harness | Oui | hashing, idempotency, anchors, source refs, artifact/event shells | transitions Convex concurrentes | `rtk npx vitest --run src/modules/application-harness/__tests__/*.test.ts` |
| candidate-evidence | Oui | source paths, generated guards, JSON compatibility, hashes | intégration future parser/import | `rtk npx vitest --run src/modules/candidate-evidence/__tests__/*.test.ts` |
| career-knowledge | Oui | rules, resolver, uniqueness, filters | drift avec EvidenceGraph | `rtk npx vitest --run src/modules/career-knowledge/__tests__/*.test.ts` |
| evidence-graph | Oui | matches, missing, risk flags, allowed claims | faux positifs/faux négatifs matching | `rtk npx vitest --run src/modules/evidence-graph/__tests__/*.test.ts` |
| resume-variants | Oui, chemins réels split | plan + artifact | nom de chemin demandé `resume-variants` non confirmé | `rtk npx vitest --run src/modules/resume-variant-plan/__tests__/*.test.ts && rtk npx vitest --run src/modules/resume-variant-artifact/__tests__/*.test.ts` |
| review-cockpit | Oui | status, buckets, review items | gros output, UI future | `rtk npx vitest --run src/modules/review-cockpit/__tests__/*.test.ts` |
| cover-letter-artifact | Oui | exact text preservation, provenance, status | text size/privacy | `rtk npx vitest --run src/modules/cover-letter-artifact/__tests__/*.test.ts` |
| application-package | Oui | package status, refs, provenance, content hash | privacy/export gates | `rtk npx vitest --run src/modules/application-package/__tests__/*.test.ts` |
| internal-tool-contracts | Oui | safe descriptors, forbidden terms, registry | output schemas | `rtk npx vitest --run src/modules/internal-tool-contracts/__tests__/*.test.ts` |
| controlled-ats-scout | Oui | adapters, resolver/fetch guards, dedupe | timeout/pagination edge | `rtk npx vitest --run src/modules/controlled-ats-scout/__tests__/*.test.ts` |
| local-mcp | Oui | registry, authz, dry-run, approval | protocol projection, real auth/audit | `rtk npx vitest --run src/modules/local-mcp/__tests__/*.test.ts` |
| Convex shadow | Oui | harness/evidence/package persistence | migrations, access boundaries | `rtk npx vitest --run convex/__tests__/*.test.ts convex/lib/tests/*.test.ts` |

Commandes complètes recommandées:

```bash
cd my-app
rtk npx vitest --run src/modules/application-harness/__tests__/*.test.ts
rtk npx vitest --run src/modules/candidate-evidence/__tests__/*.test.ts
rtk npx vitest --run src/modules/career-knowledge/__tests__/*.test.ts
rtk npx vitest --run src/modules/evidence-graph/__tests__/*.test.ts
rtk npx vitest --run src/modules/resume-variant-plan/__tests__/*.test.ts
rtk npx vitest --run src/modules/resume-variant-artifact/__tests__/*.test.ts
rtk npx vitest --run src/modules/review-cockpit/__tests__/*.test.ts
rtk npx vitest --run src/modules/cover-letter-artifact/__tests__/*.test.ts
rtk npx vitest --run src/modules/application-package/__tests__/*.test.ts
rtk npx vitest --run src/modules/internal-tool-contracts/__tests__/*.test.ts
rtk npx vitest --run src/modules/controlled-ats-scout/__tests__/*.test.ts
rtk npx vitest --run src/modules/local-mcp/__tests__/*.test.ts
rtk npx vitest --run convex/__tests__/applicationHarness.test.ts
rtk npx vitest --run convex/__tests__/candidateEvidence.test.ts
rtk npx vitest --run convex/__tests__/applicationPackages.test.ts
rtk npx tsc --noEmit
```

# 7. Cohérence documentation ↔ code

Certain:
- Le master plan reste cohérent avec la direction: spine → proof → product value → distribution contrôlée.
- Les décisions PR1 à PR13 décrivent correctement des modules purs ou shadow-only.
- PR16 et PR17 disent clairement qu’il n’y a pas de Remote MCP / ChatGPT App.

Probable:
- Les docs de PR14 sont à clarifier parce que deux PRs portent ce numéro.
- Le document PR14 Controlled ATS peut sembler incomplet si lu seul: PR15 ajoute SmartRecruiters/Recruitee et fetcher public.
- La commande demandée `src/modules/resume-variants` ne correspond pas aux chemins réels inspectés.

À vérifier:
- Liste complète `docs/audits/` existante pour éviter conflit avec un audit antérieur.
- Version MCP cible unique avant PR18.
- Checklist sécurité PR17 avec milestone explicite.

# 8. Améliorations proposées

## Amélioration 1 — Corriger la confusion de roadmap PR14

### Priorité
P2

### Pourquoi
Deux PRs utilisent le label PR14. Cela peut faire modifier le mauvais module.

### Fichiers à lire
- `docs/decisions/2026-06-10-application-package-shadow-persistence.md`
- `docs/decisions/2026-06-10-controlled-ats-scout-adapters.md`
- `docs/plans/2026-06-11-mcp-readiness.md`

### Fichiers à modifier
- Une doc de roadmap seulement, si demandée.

### Étapes exactes pour un junior
1. Ajouter une note “numérotation réelle” dans une doc de plan.
2. Ne pas renommer les modules.
3. Ne pas toucher au code.
4. Lancer `rtk git diff --check`.

### Risques
Créer une nouvelle divergence si la note est trop longue.

### Cas limites
PR14 package persistence et PR14 controlled ATS doivent rester distingués.

### Vérifications
```bash
rtk git diff --name-only
rtk git diff --check
```

### Hors scope explicite
Refactor, renommage PR, code changes.

## Amélioration 2 — Ajouter une matrice de commandes tests corrigée

### Priorité
P2

### Pourquoi
La commande `resume-variants` ne correspond pas au split réel `resume-variant-plan` + `resume-variant-artifact`.

### Fichiers à lire
- ce document
- `my-app/src/modules/resume-variant-plan/`
- `my-app/src/modules/resume-variant-artifact/`

### Fichiers à modifier
- Doc seulement.

### Étapes exactes pour un junior
1. Copier les commandes de la section Couverture de tests.
2. Les lancer localement.
3. Coller les résultats dans une note d’audit si demandé.

### Risques
Confondre test command docs avec code changes.

### Cas limites
Ne pas supprimer l’ancien chemin sans vérifier s’il existe dans un autre branch.

### Vérifications
```bash
cd my-app
rtk npx vitest --run src/modules/resume-variant-plan/__tests__/*.test.ts
rtk npx vitest --run src/modules/resume-variant-artifact/__tests__/*.test.ts
```

### Hors scope explicite
Renommer les dossiers.

## Amélioration 3 — Ajouter un test cross-module proof → package

### Priorité
P2

### Pourquoi
Les tests ciblés sont nombreux, mais un junior a besoin d’un exemple complet sans UI: CandidateFact approved → EvidenceGraph → Plan → Cockpit → ResumeArtifact → CoverLetterArtifact → ApplicationPackage.

### Fichiers à lire
- `candidate-evidence`
- `evidence-graph`
- `resume-variant-plan`
- `review-cockpit`
- `resume-variant-artifact`
- `cover-letter-artifact`
- `application-package`

### Fichiers à modifier
- Un test pur TypeScript seulement, si demandé.

### Étapes exactes pour un junior
1. Construire une fixture minimale approved/use_in_applications.
2. Ajouter une fixture private/never_use qui ne doit pas sortir.
3. Vérifier `sourceFactIds`, `allowedClaimIds`, `riskFlagIds`.
4. Ne pas ajouter de Convex, UI, LLM, export.

### Risques
Créer un test trop large ou fragile.

### Cas limites
Empty cover letter, missing evidence required, private matching fact.

### Vérifications
Suites Vitest module-only.

### Hors scope explicite
Génération, UI, export, persistence.

## Amélioration 4 — Clarifier la gate PR17 avant transport MCP

### Priorité
P1 conditionnel

### Pourquoi
Remote MCP ou ChatGPT App introduiraient auth, transport, output privacy, approval et audit. PR17 dit que ce n’est pas prêt.

### Fichiers à lire
- `docs/plans/2026-06-11-mcp-readiness.md`
- `docs/decisions/2026-06-11-local-mcp-beta.md`
- `my-app/src/modules/local-mcp/*`

### Fichiers à modifier
- Doc MCP readiness seulement, si demandé.

### Étapes exactes pour un junior
1. Ajouter un milestone explicite: aucun transport avant PR18–PR21.
2. Choisir une version MCP cible unique.
3. Ne pas ajouter server, route, OAuth, deploy.

### Risques
Laisser croire que PR18 peut exposer un endpoint.

### Cas limites
tools/list, tools/call, output too large, private facts, never_use facts.

### Vérifications
```bash
rtk git diff --check
```

### Hors scope explicite
Remote MCP, ChatGPT App, OAuth, deployment, real handlers.

## Amélioration 5 — Vérifier les limites Controlled ATS fetcher

### Priorité
P2

### Pourquoi
Le fetcher est borné, mais les edge cases réseau doivent rester prouvés avant tout caller produit.

### Fichiers à lire
- `sourceResolver.ts`
- `publicEndpointFetcher.ts`
- tests controlled ATS

### Fichiers à modifier
- Tests seulement, si manque confirmé.

### Étapes exactes pour un junior
1. Vérifier tests redirect, non-json, oversized, invalid JSON.
2. Vérifier pagination Lever/SmartRecruiters jusqu’à maxPages.
3. Vérifier timeout via `fetchImpl` simulé.
4. Ne pas utiliser réseau réel dans test.

### Risques
Transformer le test en crawler réel.

### Cas limites
pagination vide, totalFound incohérent, 429, 500, redirect.

### Vérifications
```bash
cd my-app
rtk npx vitest --run src/modules/controlled-ats-scout/__tests__/*.test.ts
```

### Hors scope explicite
LinkedIn/Upwork/Indeed, browser automation, persistence job leads.

# 9. Plan d’action recommandé

1. Corrections P0/P1 si présentes:
   - Aucun P0 trouvé dans l’audit statique.
   - Aucun P1 actif trouvé dans le code livré.
   - P1 conditionnel: ne pas ajouter Remote MCP, export, send/apply/submit, tracking, ou real handlers avant les gates PR18–PR21/PR23.

2. Corrections documentation si divergences:
   - Clarifier double PR14.
   - Clarifier chemins `resume-variant-plan` / `resume-variant-artifact` au lieu de `resume-variants`.
   - Ajouter une gate/milestone à la checklist PR17.

3. Renforcement tests:
   - Exécuter les suites listées.
   - Ajouter un test cross-module proof → package si demandé.
   - Vérifier edge cases Controlled ATS fetcher.

4. Prochaine PR minimale:
   - PR18 — MCP Schema Projection.
   - Pure TypeScript seulement.
   - Mapper `LocalMcpToolDefinitionV1` vers descriptors MCP compatibles.
   - Pas de transport, pas de route, pas de OAuth, pas de ChatGPT App, pas de real handlers.

5. Ce qu’il faut explicitement ne pas faire:
   - Ne pas brancher export/PDF/DOCX.
   - Ne pas ajouter send/apply/submit/track.
   - Ne pas scraper LinkedIn/Upwork/Indeed.
   - Ne pas exposer Local MCP sur un réseau.
   - Ne pas transformer ApplicationPackage ready_for_review en approval.
   - Ne pas modifier Convex schema/functions sans PR dédiée.

# 10. Résumé pour développeur junior

Tu dois lire d’abord:
1. `AGENTS.md`
2. `docs/decisions/2026-06-08-application-os-master-plan.md`
3. `docs/plans/2026-06-11-mcp-readiness.md`
4. `my-app/src/modules/application-harness/fingerprints.ts`
5. `my-app/src/modules/candidate-evidence/sourcePaths.ts`
6. `my-app/src/modules/evidence-graph/buildEvidenceGraph.ts`
7. `my-app/src/modules/local-mcp/localMcpAdapter.ts`

Tu peux modifier:
- Docs d’audit ou docs de clarification, si la tâche le demande.
- Tests purs TypeScript, si la tâche le demande explicitement.
- Un module pur isolé, seulement dans une PR scoped.

Tu ne dois pas toucher:
- Convex schema/functions sans demande explicite.
- UI/routes/pages.
- génération/prompt/LLM.
- export/PDF/DOCX.
- send/apply/submit/track.
- MCP transport, OAuth, ChatGPT App.
- ATS crawler/scraper, LinkedIn, Upwork, Indeed.
- canonical CV ou candidate facts source-truth.

Le prochain travail sûr est:
- Clarifier la doc de roadmap et/ou faire PR18 pure MCP schema projection sans transport.

Les pièges principaux sont:
- Double PR14.
- `ready_for_generation` et `ready_for_review` ne veulent pas dire approved.
- Local MCP n’est pas un vrai serveur MCP.
- ApplicationPackage n’est pas un export.
- Controlled ATS Scout n’est pas un crawler.
- Private et `never_use` facts ne doivent jamais sortir dans des outputs publics.

# 11. Vérification finale docs-only

À exécuter localement après création de ce fichier:

```bash
rtk git diff --name-only
rtk git diff --check
rtk git status --short --branch
```

Résultat attendu:

```txt
docs/audits/2026-06-11-application-os-pr1-pr17-architecture-audit.md
```

Certain:
- Aucun test n’est obligatoire pour une PR docs-only.

À vérifier:
- Si un test est lancé par prudence, exécuter au minimum `rtk npx tsc --noEmit` et les suites ciblées listées plus haut.
