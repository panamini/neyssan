# Plan détaillé de migration vers un schéma wiki agnostique à l'agent (non destructif)

Date: 2026-04-15  
Objectif: rendre le fonctionnement du vault indépendant d'un agent spécifique (Claude/Codex/etc.) sans casser l'existant.

## Pré-requis

- Se placer à la racine du vault (dossier qui contient `CLAUDE.md`, `rawinput/`, `raw/`, `wiki/`).
- Vérifier l'état Git avant de commencer.

```bash
git status --short
```

Résultat attendu:
- Une liste de fichiers modifiés/non suivis déjà présents.
- Tu gardes cette sortie comme point de référence avant migration.

## Étape 1 — Ajouter une spec neutre sans supprimer l'existant

Créer une copie de travail agnostique.

```bash
cp CLAUDE.md WIKI_SCHEMA.md
```

Résultat attendu:
- `CLAUDE.md` existe toujours.
- `WIKI_SCHEMA.md` est créé.

Vérification:

```bash
ls -1 CLAUDE.md WIKI_SCHEMA.md
```

## Étape 2 — Neutraliser le langage agent-spécifique dans `WIKI_SCHEMA.md`

### 2.1 Intention (important pour lecteur novice)

Objectif de cette étape:
- Ne pas supprimer la notion de LLM.
- Supprimer la dépendance à un agent nommé (ex: Claude uniquement).

Règle simple:
- Garder une formulation neutre qui inclut explicitement LLM entre parenthèses, par exemple:
  - `système opérateur (humain et/ou LLM)`

Pourquoi:
- Tu conserves le contexte réel (un LLM peut opérer le wiki).
- Tu évites le verrouillage sur un seul agent ou fournisseur.

### 2.2 Lister les occurrences à transformer

```bash
rg -n "(LLM|Claude|agent LLM|Règle de priorité LLM|Quand l'utilisateur dit|Nouvelle session|Le LLM est l'unique auteur)" WIKI_SCHEMA.md
```

Résultat attendu:
- Tu obtiens une liste de lignes à réécrire.

### 2.3 Transformations à appliquer (mapping précis FR -> FR, avec mention LLM conservée)

Appliquer les remplacements suivants dans `WIKI_SCHEMA.md`.

1. Occurrence à remplacer:
`# CLAUDE.md — Schema LLM Wiki · twoweeks (v2)`

Texte cible:
`# WIKI_SCHEMA.md — Schéma opérationnel du wiki · twoweeks (v2)`

2. Occurrence à remplacer:
`L'agent LLM le lit en premier à chaque session...`

Texte cible:
`Ce document définit le schéma opérationnel du wiki. Au démarrage d'une session, le système opérateur (humain et/ou LLM) DOIT appliquer ce document en priorité.`

3. Occurrence à remplacer:
`### Règle de priorité LLM pour les réponses`

Texte cible:
`### Règle de priorité des sources pour les réponses`

4. Occurrence à remplacer:
`Quand l'utilisateur dit "ingère les nouvelles sources"...`

Texte cible:
`Déclencheur: demande d'ingestion de nouvelles sources.`

5. Occurrence à remplacer:
`Quand l'utilisateur pose une question sur le wiki:`

Texte cible:
`Déclencheur: question sur le wiki.`

6. Occurrence à remplacer:
`Quand l'utilisateur demande un health check:`

Texte cible:
`Déclencheur: demande de health check/lint.`

7. Occurrence à remplacer:
`### Workflow : Nouvelle session`

Texte cible:
`### Workflow : Démarrage de session`

8. Occurrence à remplacer:
`Le LLM est l'unique auteur du wiki.`

Texte cible:
`Le système opérateur du wiki (humain et/ou LLM) est l'unique auteur du wiki.`

9. Occurrence à remplacer:
`Annoncer à l'utilisateur : ...`

Texte cible:
`Produire un état de session : ...`

### 2.4 Contrôle après transformation

```bash
rg -n "(Claude|Le LLM est l'unique auteur|Règle de priorité LLM pour les réponses)" WIKI_SCHEMA.md
rg -n "humain et/ou LLM|système opérateur" WIKI_SCHEMA.md
```

Résultat attendu:
- 1re commande: 0 occurrence (les anciennes formulations agent-spécifiques ont disparu).
- 2e commande: au moins une occurrence (la mention neutre incluant LLM est bien présente).

## Étape 3 — Ajouter une couche d'adaptation par agent (contenu exact en anglais)

Créer les fichiers:

```bash
mkdir -p adapters
touch adapters/claude.md adapters/codex.md
```

### 3.1 Contenu exact de `adapters/claude.md`

Copier-coller exactement ce texte:

```md
# Claude Adapter — twoweeks wiki

## Purpose

Translate the neutral schema in `WIKI_SCHEMA.md` into execution instructions for Claude.

## Context Loading

1. Read `WIKI_SCHEMA.md` first.
2. Read `wiki/index.md`.
3. Read the last 10 entries of `wiki/log.md`.
4. Read `wiki/overview.md`.
5. Check `rawinput/` for pending sources.

## Workflow Execution

- Ingest: follow the Ingest workflow from `WIKI_SCHEMA.md` exactly.
- Query: apply the temporal source-priority rules from `WIKI_SCHEMA.md`.
- Supersede: enforce `superseded_by` chain and archive moves.
- Lint: produce reports in `wiki/outputs/`.

## Document Safety Rules

- Do not manually edit files in `raw/` (except moving files from `rawinput/` during ingest).
- Keep `wiki/index.md`, `wiki/log.md`, and `wiki/timeline.md` consistent after changes.
- Never delete archived pages.
```

### 3.2 Contenu exact de `adapters/codex.md`

Copier-coller exactement ce texte:

```md
# Codex Adapter — twoweeks wiki

## Purpose

Translate the neutral schema in `WIKI_SCHEMA.md` into execution instructions for Codex.

## Context Loading

1. Read `WIKI_SCHEMA.md` first.
2. Read `wiki/index.md`.
3. Read the last 10 entries of `wiki/log.md`.
4. Read `wiki/overview.md`.
5. Check `rawinput/` for pending sources.

## Workflow Execution

- Ingest: follow the Ingest workflow from `WIKI_SCHEMA.md` exactly.
- Query: apply the temporal source-priority rules from `WIKI_SCHEMA.md`.
- Supersede: enforce `superseded_by` chain and archive moves.
- Lint: produce reports in `wiki/outputs/`.

## Document Safety Rules

- Do not manually edit files in `raw/` (except moving files from `rawinput/` during ingest).
- Keep `wiki/index.md`, `wiki/log.md`, and `wiki/timeline.md` consistent after changes.
- Never delete archived pages.
```

Vérification:

```bash
sed -n '1,220p' adapters/claude.md
sed -n '1,220p' adapters/codex.md
```

Résultat attendu:
- Les deux fichiers existent avec un contenu quasi identique (seul le nom d'agent change).

## Étape 4 — Transformer `CLAUDE.md` en shim de compatibilité (contenu exact en français + emplacement)

### 4.1 Où modifier

- Fichier à modifier: `CLAUDE.md` à la racine du vault.
- Action: remplacer tout le contenu actuel par un shim court.

### 4.2 Contenu exact à mettre dans `CLAUDE.md`

```md
# CLAUDE.md — Shim de compatibilité

Ce fichier est conservé temporairement pour compatibilité.

Source canonique:
- `WIKI_SCHEMA.md`

Adaptation Claude:
- `adapters/claude.md`

Procédure:
1. Lire `WIKI_SCHEMA.md`.
2. Appliquer `adapters/claude.md`.
3. Exécuter les workflows selon `WIKI_SCHEMA.md`.

Notes:
- Ne plus maintenir de règles métier dans ce fichier.
- Toutes les évolutions de règles doivent être faites dans `WIKI_SCHEMA.md`.
```

### 4.3 Commande pratique pour écrire le shim

```bash
cat > CLAUDE.md <<'EOT'
# CLAUDE.md — Shim de compatibilité

Ce fichier est conservé temporairement pour compatibilité.

Source canonique:
- `WIKI_SCHEMA.md`

Adaptation Claude:
- `adapters/claude.md`

Procédure:
1. Lire `WIKI_SCHEMA.md`.
2. Appliquer `adapters/claude.md`.
3. Exécuter les workflows selon `WIKI_SCHEMA.md`.

Notes:
- Ne plus maintenir de règles métier dans ce fichier.
- Toutes les évolutions de règles doivent être faites dans `WIKI_SCHEMA.md`.
EOT
```

Résultat attendu:
- `CLAUDE.md` reste présent, mais ne contient plus de logique métier.
- `WIKI_SCHEMA.md` devient le seul document métier à maintenir.

## Étape 5 — Mettre à jour la skill existante (sans la recréer)

Mettre à jour `skills/twoweeks-wiki-operator` pour pointer vers `WIKI_SCHEMA.md`.

Contrôle:

```bash
rg -n "CLAUDE.md|WIKI_SCHEMA.md" skills/twoweeks-wiki-operator
```

Résultat attendu:
- Références principales vers `WIKI_SCHEMA.md`.
- `CLAUDE.md` mentionné uniquement comme shim transitoire.

## Étape 6 — Vérifier les références internes restantes

```bash
rg -n "CLAUDE.md" .
```

Résultat attendu:
- Liste finie de références.
- Tu corriges chaque référence qui devrait viser `WIKI_SCHEMA.md`.

## Étape 7 — Tester pas à pas (niveau débutant)

Objectif: vérifier que le système marche après migration sans toucher aux pages métier existantes.

### 7.1 Test A — Bootstrap (lecture des bons fichiers)

Action:
- Ouvrir `WIKI_SCHEMA.md`.
- Ouvrir `wiki/index.md`.
- Ouvrir `wiki/log.md` (10 dernières entrées).
- Ouvrir `wiki/overview.md`.
- Lister `rawinput/`.

Commandes:

```bash
sed -n '1,80p' WIKI_SCHEMA.md
sed -n '1,80p' wiki/index.md
tail -n 120 wiki/log.md
sed -n '1,80p' wiki/overview.md
ls -la rawinput/
```

Résultat attendu:
- Tous les fichiers sont lisibles.
- Tu vois clairement le nombre de sources en attente dans `rawinput/`.

### 7.2 Test B — Query simple (sans écriture)

Action:
- Poser une question simple: "Quel est l'état actuel du projet ?"
- Vérifier que la réponse est basée sur des pages `status: current`.

Vérification manuelle:

```bash
rg -n "status:\s*current" wiki/overview.md wiki/concepts/*.md wiki/entities/*.md | head -n 20
```

Résultat attendu:
- Les réponses s'appuient d'abord sur les contenus `current`.

### 7.3 Test C — Lint léger (sans créer de rapport)

Action:
- Contrôler frontmatter et liens cassés de base.

Commandes:

```bash
rg -n "^status:" wiki/**/*.md
rg -n "\[\[[^\]]+\]\]" wiki/**/*.md | head -n 40
```

Résultat attendu:
- Les pages importantes ont un `status`.
- Les liens internes sont présents.

### 7.4 Test D — Ingest de test contrôlé (avec rollback facile)

Action:
1. Créer un mini fichier de test dans `rawinput/`.
2. Simuler l'ingestion (création d'une page source).
3. Vérifier le déplacement vers `raw/`.
4. Supprimer les artefacts de test (rollback manuel).

Commandes:

```bash
cat > rawinput/2099-01-01-test-ingest.md <<'EOT'
# Test ingest
Ceci est un test temporaire.
EOT

ls -la rawinput/2099-01-01-test-ingest.md
```

Résultat attendu:
- Le fichier test est créé.

Ensuite, exécuter l'ingestion via ton agent puis vérifier:

```bash
ls -la raw/2099-01-01-test-ingest.md
rg -n "2099-01-01-test-ingest" wiki/sources/*.md
```

Résultat attendu:
- Le fichier test est dans `raw/`.
- Une page source de test existe dans `wiki/sources/`.

Rollback test:

```bash
rm -f raw/2099-01-01-test-ingest.md
rm -f wiki/sources/2099-01-01-test-ingest.md
```

Résultat attendu:
- Plus de trace des artefacts de test.

### 7.5 Test E — Vérification Git finale

```bash
git status --short
```

Résultat attendu:
- Tu vois uniquement les changements attendus de migration.
- Pas de fichiers de test oubliés.

## Étape 8 — Comparer avant/après

```bash
git diff -- CLAUDE.md WIKI_SCHEMA.md adapters/ skills/twoweeks-wiki-operator/
```

Résultat attendu:
- Diff lisible: séparation nette entre spec neutre et adaptateurs agent.

## Étape 9 — Versionner la migration

```bash
git add CLAUDE.md WIKI_SCHEMA.md adapters/ skills/twoweeks-wiki-operator/
git commit -m "refactor: introduce agent-agnostic wiki schema and adapters"
```

Résultat attendu:
- Migration de transition traçable dans Git.

## Étape 10 — Retrait de `CLAUDE.md` (optionnel, plus tard)

À faire seulement après validation complète des usages qui dépendaient de `CLAUDE.md`.

```bash
git rm CLAUDE.md
git commit -m "chore: remove legacy CLAUDE shim after migration"
```

Résultat attendu:
- Suppression propre de l'ancien point d'entrée.

## Problèmes évidents et solutions

1. Outil qui lit exclusivement `CLAUDE.md`.
- Symptôme: workflow cassé après migration.
- Solution: conserver le shim `CLAUDE.md` le temps de la transition.

2. Divergence entre `CLAUDE.md` et `WIKI_SCHEMA.md`.
- Symptôme: règles contradictoires.
- Solution: interdire toute règle métier dans `CLAUDE.md`.

3. Skill non alignée.
- Symptôme: l'agent applique encore l'ancienne logique.
- Solution: mettre à jour immédiatement `skills/twoweeks-wiki-operator`.

4. Références internes oubliées.
- Symptôme: docs qui pointent encore vers `CLAUDE.md`.
- Solution: exécuter `rg -n "CLAUDE.md" .` puis corriger.

5. Fichiers de test oubliés en fin de validation.
- Symptôme: pollution de `raw/` ou `wiki/sources/`.
- Solution: faire systématiquement le rollback test de l'étape 7.4 puis `git status`.
