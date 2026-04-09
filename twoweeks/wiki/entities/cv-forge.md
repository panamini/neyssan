---
title: "CV Forge"
category: entity
tags: [cvforge, app, product, parser, cv]
created: 2026-04-09
updated: 2026-04-09
status: current
valid_from: 2026-04-09
valid_until:
superseded_by:
horizon: present
version: v0
sources: [2026-04-09-decisions-cvforge-sprint]
related: [[cv-parsing-pipeline]], [[cv-families]], [[overview]]
---

# CV Forge

CV Forge est l'application principale du projet twoweeks — un outil de parsing, normalisation et édition de CVs.

## Description

CV Forge ingère des CVs (via OCR/upload), les parse en sections structurées ([[cv-families]]), et permet à l'utilisateur de les éditer, reformater et exporter. Le cœur technique est un pipeline de parsing qui transforme du texte brut OCR en données structurées JSON par famille de section.

## Architecture actuelle (v0)

- **Pipeline** : OCR → heuristiques de parsing → sections normalisées → UI d'édition
- **Export** : prévu — Download Raw OCR Markdown + Download Normalized JSON
- **Editing** : Output shell + compose shell + card header line

## Composants UI principaux

| Composant | Rôle |
|-----------|------|
| Output shell | Affichage du CV parsé, mode preview et edit |
| Compose shell | Zone de saisie/édition de sections |
| Card header line | Toolbar de navigation/action sur les sections |
| Recovery drawer | Gestion des sections non parsées / fallback |

## État du développement

Sprint actuel : stabilisation du pipeline save, bugs d'alignement UI, décision architecture parser (heuristiques vs JSON structuré).

Features en attente : AI rewrite suggestions (2–3 par section), Destination Summary Pane.

## Décisions techniques ouvertes

- Architecture parser : continuer heuristiques vs hybride (POC JSON sur une famille) vs pivot complet — **reco actuelle : POC hybride**
- Timing CVs synthétiques pour tests : après patch actuel + isolation prochaine contamination family

## Voir aussi

- [[cv-parsing-pipeline]] — la stratégie d'évolution du parser
- [[cv-families]] — les familles de sections CV
