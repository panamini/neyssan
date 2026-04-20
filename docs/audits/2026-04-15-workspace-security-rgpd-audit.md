# Audit Workspace — Bonnes Pratiques, Sécurité, Protection des Données (RGPD)

Date: 2026-04-15  
Périmètre: `/Users/aurelienprivileggio/Workspace/Neyssan`  
Baseline produit prioritaire: `v1` (AGENTS)

## 1) Méthodologie

Audit statique du workspace actuel mis à jour depuis le rapport du 2026-04-03, avec focus sur:
- bonnes pratiques de développement et d’exploitation,
- sécurité applicative (secrets, authn/authz, exposition d’API),
- protection des données personnelles (minimisation, conservation, effacement RGPD).

Commandes de collecte principales:

```bash
# inventaire
find . -maxdepth 2 -type d | sed 's#^./##' | sort

# recherche d'exposition de secrets / config sensible
nl -ba my-app/env.md | sed -n '1,80p'
rg -n "(OPENAI_API_KEY|MISTRAL_API_KEY|SENTRY_DSN|CLERK_JWT_ISSUER_DOMAIN)" my-app

# endpoints potentiellement exposés
rg -n "export const .* = (mutation|action|query)\\(" my-app/convex my-app/convex/actions
rg -n "getUserIdentity\\(" my-app/convex/llm.ts my-app/convex/actions/uploads.ts my-app/convex/actions/structuredUpload.ts my-app/convex/functions.ts my-app/convex/alerts.ts my-app/convex/model/monitoring.ts my-app/convex/users.ts

# stockage de données potentiellement sensibles
nl -ba my-app/convex/schema.ts | sed -n '360,470p'
nl -ba my-app/convex/jobs.ts | sed -n '380,470p'
nl -ba my-app/src/adapters/StorageAdapter.ts | sed -n '1,240p'

# suppression utilisateur / conformité
nl -ba my-app/convex/users.ts | sed -n '90,190p'

# logs sensibles
nl -ba my-app/convex/lib/parsing/hybridParser.ts | sed -n '1,170p'
nl -ba my-app/convex/auth.config.ts | sed -n '1,80p'

# gouvernance gitignore
nl -ba .gitignore | sed -n '1,190p'
```

## 2) Classification des zones (incertitude explicitée)

### Code actif (forte confiance)
- `my-app/src/`
- `my-app/convex/`
- `my-app/worker/`
- `my-app/.env.local.example`
- `docs/` (gouvernance projet)

### Legacy mais informatif (confiance moyenne)
- `cv_parser_service/`
- `cv_parser/`
- `clerk-chrome-extension-final/`

### Obsolète / non autoritaire (selon AGENTS + structure)
- `pdf-ingest/`
- `training/`
- tout code `*.bak`, arbres d’archive/backups

Note: ces zones obsolètes restent un risque opérationnel si encore déployées hors du flux principal.

## 3) Constat détaillé

## Critique

### C1 — Secrets en clair commités (compromission potentielle immédiate)

Preuves:
- `my-app/env.md:11` contient `OPENAI_API_KEY=...`
- `my-app/env.md:14` contient `MISTRAL_API_KEY=...`

Risque:
- accès non autorisé aux fournisseurs IA, coûts et abus API,
- risque de fuite de données si les clés ont été utilisées en production,
- non-conformité sécurité (RGPD art. 32: confidentialité/intégrité).

Actions immédiates (ordre strict):

```bash
# 1) retirer le fichier de l’index git (sans le supprimer localement)
git rm --cached my-app/env.md

# 2) remplacer par un template non secret
cp my-app/.env.local.example my-app/env.md

# 3) vérifier l’absence de clés en clair
rg -n "(OPENAI_API_KEY=|MISTRAL_API_KEY=|sk-[A-Za-z0-9_-]{20,})" my-app

# 4) commit de remédiation
git add my-app/env.md
git commit -m "security: remove committed secrets and replace with template"
```

Rotation obligatoire hors dépôt:
- OpenAI key,
- Mistral key,
- toute clé dérivée associée au même projet.

Si fuite historique publique/synchronisée:

```bash
# réécriture d’historique (coordination équipe obligatoire)
git filter-repo --path my-app/env.md --invert-paths
```

---

### C2 — Endpoints Convex sensibles sans contrôle d’identité explicite

Preuves (code actif):
- `my-app/convex/llm.ts:278` `startRefine`
- `my-app/convex/llm.ts:307` `startRefineByString`
- `my-app/convex/llm.ts:401` `enqueueRefine`
- `my-app/convex/actions/uploads.ts:5` `getUploadUrl`
- `my-app/convex/actions/structuredUpload.ts:329` `structuredUpload`
- `my-app/convex/functions.ts:215` `transformEditorSelection`
- `my-app/convex/functions.ts:256` `runCvSectionAiAction`
- `my-app/convex/alerts.ts:5` `createAlert`
- `my-app/convex/alerts.ts:26` `resolveAlert`
- `my-app/convex/alerts.ts:43` `getActiveAlerts`
- `my-app/convex/model/monitoring.ts:20` `recordMetric`
- `my-app/convex/model/monitoring.ts:41` `createAlert`
- `my-app/convex/model/monitoring.ts:63` `getActiveAlerts`

Observation associée:
- Dans ces fichiers, `getUserIdentity()` n’est pas détecté.

Risque:
- abus de ressources IA et upload,
- pollution des tables métier,
- exposition indirecte de données et surface DoS.

Actions:

```bash
# 1) inventaire endpoints publics
rg -n "export const .* = (mutation|action|query)\\(" my-app/convex my-app/convex/actions

# 2) ajout garde d’auth minimum (chaque endpoint sensible)
# pattern:
# const identity = await ctx.auth.getUserIdentity();
# if (!identity) throw new Error("Not authenticated");

# 3) contrôle post-correction
rg -n "getUserIdentity\\(" my-app/convex my-app/convex/actions
```

Complément recommandé:
- ajouter autorisation par ownership (`profileId` lié à `identity.subject`) et pas seulement authentification.

## Élevé

### H1 — Stockage étendu de données CV/PII (backend + navigateur)

Preuves:
- `my-app/convex/schema.ts:405` `llmJobs.rawText`
- `my-app/convex/schema.ts:430` `llmHistory.full_response`
- `my-app/convex/schema.ts:431` `llmHistory.patch`
- `my-app/convex/jobs.ts:398` + `:429` insertion `full_response`
- `my-app/src/adapters/StorageAdapter.ts:44` + `:173-177` cache CV complet en `localStorage`

Risque RGPD:
- minimisation insuffisante,
- conservation locale de données CV sur poste utilisateur,
- difficulté de purge complète.

Actions:

```bash
# 1) supprimer la persistance du payload brut LLM (full_response)
# conserver uniquement les champs strictement nécessaires

# 2) mettre en place TTL/purge automatique (llmJobs, llmHistory, données temporaires)

# 3) retirer le fallback localStorage pour CV complet,
# ou chiffrer côté client + expiration stricte et effacement à logout
```

---

### H2 — Droit à l’effacement incomplet (suppression non transverse)

Preuve:
- `my-app/convex/users.ts:115-120` `deleteUser` supprime uniquement des enregistrements `userProfiles`.

Risque RGPD:
- effacement partiel des données personnelles (non conformité art. 17).

Actions:

```bash
# 1) implémenter une mutation interne orchestrée deleteUserData(clerkId)
# 2) supprimer toutes les données liées (par profil + par clerkId)
# 3) journaliser l’opération (preuve d’exécution sans contenu sensible)
```

Tables à couvrir (minimum):
- `userProfiles`
- `proposals`
- `llmJobs`
- `llmHistory`
- `activeCvSnapshots`
- `proposalHandoffs`

---

### H3 — Journalisation potentielle de données sensibles

Preuves:
- `my-app/convex/lib/parsing/hybridParser.ts:33` log de preview prompt
- `my-app/convex/lib/parsing/hybridParser.ts:78` log présence clé API
- `my-app/convex/lib/parsing/hybridParser.ts:158` log shape sortante
- `my-app/convex/auth.config.ts:1` log de variable d’environnement auth

Risque:
- fuite de données personnelles/techniques via logs applicatifs et observabilité.

Actions:

```bash
# 1) bannir les logs de prompt/raw CV/identifiants
rg -n "console\\.(log|warn|error)\\(" my-app/convex my-app/src --glob '!**/*.test.*'

# 2) implémenter un logger structuré avec redaction systématique
# 3) limiter les logs debug aux environnements dev contrôlés
```

## Moyen

### M1 — Configuration sensible hardcodée

Preuve:
- `my-app/convex/config/sentry.ts:5` DSN codé en dur.

Risque:
- mauvaise séparation des environnements,
- gouvernance sécurité plus difficile.

Action:

```bash
# remplacer DSN hardcodé par variable d’environnement obligatoire
# ex: process.env.SENTRY_DSN, avec échec explicite en production si absent
```

---

### M2 — Gouvernance Git: règles pouvant masquer des audits

Preuves:
- `.gitignore:91` ignore `/docs/`
- `.gitignore:148-155` ignore largement `my-app/docs/*` avec exceptions ciblées.

Risque:
- nouveaux rapports/plans non suivis en git,
- traçabilité affaiblie (auditabilité projet).

Actions:

```bash
# vérifier l’état réel de suivi
git check-ignore -v docs/audits/2026-04-15-workspace-security-rgpd-audit.md || true

# ajuster .gitignore pour autoriser docs/audits
# exemple:
# /docs/*
# !/docs/audits/
# !/docs/audits/*.md
```

## 4) Plan d’actions priorisé

### Phase 0 — Immédiat (aujourd’hui)

```bash
# Secrets
git rm --cached my-app/env.md
cp my-app/.env.local.example my-app/env.md
rg -n "(OPENAI_API_KEY=|MISTRAL_API_KEY=|sk-[A-Za-z0-9_-]{20,})" my-app

# Commit remédiation
git add my-app/env.md
git commit -m "security: remove committed secrets"
```

### Phase 1 — 24/48h

```bash
# Auth guards Convex
rg -n "export const .* = (mutation|action|query)\\(" my-app/convex my-app/convex/actions
rg -n "getUserIdentity\\(" my-app/convex my-app/convex/actions

# Implémentation + vérification
npm --prefix my-app test || true
```

### Phase 2 — Semaine

```bash
# RGPD effacement transverse
# implémenter deleteUserData(clerkId)

# Rétention
# ajouter purge scheduler des tables historiques / temporaires
```

### Phase 3 — Industrialisation

```bash
# scans sécurité récurrents
npm --prefix my-app audit --omit=dev || true

# secret scanning dans CI (gitleaks/trufflehog)
```

## 5) Synthèse conformité RGPD

Évaluation (workspace actuel):
- Minimisation des données: **insuffisante** (payloads bruts et cache local étendu).
- Limitation de conservation: **insuffisante** (purge effective non démontrée).
- Intégrité/confidentialité: **insuffisante** (secrets en clair, logs sensibles).
- Droit à l’effacement: **partiellement implémenté** (suppression non transverse).
- Accountability/documentation: **moyenne** (reporting présent mais traçabilité git à sécuriser).

## 6) Évolution depuis l’audit du 2026-04-03

- Les risques critiques liés aux secrets commités sont toujours présents (`my-app/env.md`).
- Les endpoints Convex sensibles sans garde d’identité explicite restent une dette majeure.
- Le risque RGPD sur conservation/effacement demeure élevé.
- Point additionnel de gouvernance: `.gitignore` peut bloquer le versioning normal des nouveaux audits/plans.

## 7) Limites de l’audit

- Audit statique uniquement (pas de test d’intrusion dynamique).
- Pas de vérification des dashboards externes (Convex/Clerk/OpenAI/Mistral/Sentry).
- Les zones legacy/obsolètes sont évaluées en risque potentiel, sans validation de leur exposition réseau réelle.
