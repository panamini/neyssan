---
title: "Vue d'ensemble — twoweeks / CV Forge"
category: overview
tags: [project, overview, cvforge]
created: 2026-04-09
updated: 2026-04-09
sources: [2026-04-09-decisions-cvforge-sprint]
---

# twoweeks — Vue d'ensemble

## Qu'est-ce que twoweeks / CV Forge ?

**CV Forge** (projet twoweeks) est une application de parsing, normalisation et édition de CVs. Elle ingère des CVs bruts (via OCR/upload), les découpe en sections structurées par famille (identity, education, experience…), et permet à l'utilisateur de les éditer, reformater et exporter.

## Architecture technique (v0)

Le pipeline central : **OCR → heuristiques de parsing → sections normalisées par famille → UI d'édition**.

La grande décision technique ouverte : faire évoluer le parser vers de l'extraction JSON structurée (schema-first), d'abord via un POC sur une famille stable (identity/contact ou education), avant un éventuel pivot plus large.

## État du projet

| Dimension | Statut |
|-----------|--------|
| Stade | 🟡 En développement actif |
| Sprint actuel | Stabilisation pipeline save, bugs UI, décision architecture parser |
| Sources ingérées | 3 |
| Pages wiki | 10 |
| Dernière activité | 2026-04-09 |

## Décisions actives

- **Architecture parser** : POC hybride (heuristiques + JSON structuré sur une famille) avant tout pivot
- **CVs synthétiques** : après le patch actuel, pas avant
- **Features immédiates** : Download Raw OCR Markdown + Download Normalized JSON
- **Features déférées** : AI rewrite suggestions, Destination Summary Pane

## Thèmes majeurs du wiki

- [[cv-parsing-pipeline]] — stratégie d'évolution du parser
- [[cv-families]] — les familles de sections CV et leur stabilité
- [[cv-forge]] — l'application et ses composants UI

## Questions ouvertes

- [ ] Résultats du POC JSON structuré sur IDENTITY/CONTACT — meilleur que les heuristiques ?
- [ ] Quelles contaminations restent à isoler après le sprint actuel ?
- [ ] Timeline pour les features déférées (AI rewrites, Destination Summary Pane) ?

---

*Mise à jour automatique par le LLM · 2026-04-09*
