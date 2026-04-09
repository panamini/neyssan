---
title: "Log — twoweeks Wiki"
category: overview
updated: 2026-04-09
---

# Log du Wiki · twoweeks

Journal chronologique append-only de toutes les opérations sur le wiki. Chaque entrée commence par `## [YYYY-MM-DD] type | description` pour permettre le parsing avec des outils unix.

Commandes utiles :
```bash
# Dernières 5 entrées
grep "^## \[" wiki/log.md | tail -5

# Tous les ingests
grep "^## \[" wiki/log.md | grep "ingest"

# Toutes les passes de lint
grep "^## \[" wiki/log.md | grep "lint"
```

---

## [2026-04-09] ingest | Décisions sprint CV Forge — parser, features, bugs

**Agent** : Claude
**Fichiers traités** : `rawinput/to do.md`
**Pages créées** :
- `wiki/sources/2026-04-09-decisions-cvforge-sprint.md`
- `wiki/entities/cv-forge.md`
- `wiki/concepts/cv-parsing-pipeline.md`
- `wiki/concepts/cv-families.md`
**Pages mises à jour** :
- `wiki/overview.md` — projet décrit pour la première fois (CV Forge, parser de CVs)
- `wiki/index.md` — statistiques et nouvelles entrées
**Pages archivées** : aucune
**Nettoyage** : suppression de `wiki/plan en attente.md` (doublon), `raw/to do.md` remplacé par la version de rawinput/

---

## [2026-04-09] init | Création du vault twoweeks

**Agent** : Claude (Cowork)
**Action** : Initialisation de la structure du wiki LLM pour le projet twoweeks.

Fichiers créés :
- `CLAUDE.md` — schema LLM et workflows
- `wiki/index.md` — catalogue initial (vide)
- `wiki/log.md` — ce fichier
- `wiki/overview.md` — vue d'ensemble initiale
- `wiki/concepts/llm-wiki-pattern.md` — concept fondateur
- Structure de dossiers : `raw/`, `raw/assets/`, `wiki/entities/`, `wiki/concepts/`, `wiki/sources/`, `wiki/outputs/`

**Prochaines étapes suggérées** :
1. Décrire twoweeks dans `wiki/overview.md` (à compléter par l'utilisateur ou via conversation)
2. Commencer à déposer des sources dans `rawinput/` et lancer un ingest
3. Configurer Obsidian Web Clipper pour alimenter `rawinput/` facilement

---

## [2026-04-09] architecture | Migration v1 → v2 : rawinput/ + gestion temporelle

**Agent** : Claude (Cowork)
**Action** : Amélioration de l'architecture suite à un commentaire utilisateur sur les limites de la v1.

Deux problèmes identifiés et résolus :
1. **Performance ingest** : `rawinput/` comme staging zone évite le scan de `raw/` (indépendant de la taille)
2. **Cohérence temporelle** : frontmatter temporel, archive, timeline pour éviter les mélanges passé/présent/futur

Fichiers créés/modifiés :
- `CLAUDE.md` → v2 (workflows Supersede, Query temporelle, Lint v2)
- `rawinput/README.md` — instructions du staging
- `wiki/archive/` + sous-dossiers + README
- `wiki/timeline.md` — chronologie des événements projet
- `wiki/concepts/temporal-management.md` — concept documenté
- `wiki/outputs/2026-04-09-architecture-v2.md` — tuto et rationale complet
- `wiki/index.md` → v2
