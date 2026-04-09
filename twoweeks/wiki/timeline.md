---
title: "Timeline — twoweeks"
category: overview
tags: [timeline, chronologie, projet]
created: 2026-04-09
updated: 2026-04-09
---

# Timeline du projet twoweeks

Chronologie des événements-clés du projet : décisions prises, pivots, sorties de versions, changements d'orientation. Ce n'est pas un log d'opérations wiki (voir `log.md`) — c'est l'histoire du **projet lui-même**.

Utilisé par le LLM pour répondre à des questions temporelles : "qu'avions-nous décidé avant X ?" ou "quel était l'état en v1 ?".

---

## Format d'une entrée

```
## [YYYY-MM-DD] type | Titre de l'événement
**Type** : decision | pivot | release | discovery | deprecation | milestone
**Version** : v1 | v2 | ...
**Impact** : pages wiki affectées
Description courte de l'événement et de son contexte.
```

---

## Événements

## [2026-04-09] milestone | Initialisation du wiki twoweeks
**Type** : milestone
**Version** : v0
**Impact** : Création de l'ensemble de la structure wiki (CLAUDE.md, index, log, overview, rawinput, archive)

Création de l'espace Obsidian LLM Wiki pour le projet twoweeks. Architecture v2 adoptée d'emblée : staging `rawinput/`, gestion temporelle avec statuts et archive.

---

*Les entrées suivantes seront ajoutées au fil du projet par le LLM lors des ingests, des décisions documentées, et des pivots.*
