---
title: "Architecture v2 — rawinput/ + gestion temporelle"
category: output
tags: [architecture, meta, temporal, workflow, tutorial]
created: 2026-04-09
updated: 2026-04-09
sources: [commentaire-utilisateur]
related: [[llm-wiki-pattern]], [[temporal-management]], [[overview]]
---

# Architecture v2 — rawinput/ + gestion temporelle

> **Document de référence** : Ce fichier documente l'évolution de l'architecture du wiki twoweeks de la v1 vers la v2. Il sert de tutoriel pour comprendre pourquoi ces choix ont été faits. Il a été produit suite à un commentaire critique sur les limites de l'architecture v1.

---

## Contexte : les deux problèmes de la v1

L'architecture v1 avait une structure simple : `raw/` pour les sources brutes, `wiki/` pour le wiki compilé. Fonctionnelle pour démarrer, mais elle présente deux murs prévisibles sur le long terme.

### Problème 1 — Performance des ingests (résolu facilement)

Dans la v1, le dossier `raw/` joue deux rôles : il contient les nouvelles sources *et* les sources déjà ingérées. À chaque session, si l'utilisateur dépose une nouvelle source et dit "ingère les nouvelles sources", le LLM doit scanner tout `raw/` pour identifier ce qui est nouveau — un scan dont le coût croît linéairement avec la taille de la collection.

À 10 sources, ce n'est pas un problème. À 300 sources avec des images, c'est lent, coûteux en tokens, et source d'erreurs.

**La solution : un dossier de staging `rawinput/`.**

Le workflow devient :
1. L'utilisateur dépose ses nouvelles sources dans `rawinput/` (toujours petit, toujours court à scanner)
2. Le LLM ingère tout ce qu'il trouve dans `rawinput/`
3. Après ingest réussi, le LLM déplace chaque fichier de `rawinput/` vers `raw/`
4. `raw/` redevient la bibliothèque permanente et immuable — jamais scannée pour chercher des nouveautés

**Avantage clé** : la performance de l'ingest est désormais indépendante de la taille totale de la collection. Qu'on ait 10 ou 3000 sources dans `raw/`, ingérer 3 nouvelles sources prend le même temps.

---

### Problème 2 — Cohérence temporelle (le vrai défi)

C'est le problème le plus sérieux et le moins évident au départ. La v1 traite toutes les informations comme également valides et actuelles. Or sur un projet long terme, les informations ont une durée de vie.

**Le scénario problématique** :

Imaginons le wiki de twoweeks en janvier 2027, après 9 mois de développement :

- En avril 2026 : on a décidé que l'app utiliserait une architecture monolithique → page concept `architecture-technique.md`
- En juillet 2026 : on a pivoté vers une architecture microservices → la même page est mise à jour
- En octobre 2026 : on anticipe une migration vers serverless pour la v3 → une note de spec est ajoutée

Si un LLM lit ce wiki sans notion temporelle et qu'on lui demande "quelle est notre architecture technique ?", il peut :
- Répondre sur l'architecture monolithique (ancienne data)
- Mélanger les trois époques en une réponse incohérente
- Confondre une spec future (v3) avec l'état actuel (v2)

Ce n'est pas un bug du LLM — c'est une **absence d'information temporelle dans les données**. Le LLM ne peut pas distinguer "décision actuelle" de "décision passée" si le wiki ne le spécifie pas.

---

## La solution v2 : chronologie et statut explicites

### 1. Frontmatter temporel enrichi

Chaque page wiki ajoute quatre nouveaux champs YAML :

```yaml
status: current          # current | archived | planned | deprecated
valid_from: 2026-04-09   # date à partir de laquelle cette info est valide
valid_until:             # vide si toujours valide ; sinon date de péremption
superseded_by:           # [[nouvelle-page]] si cette page a été remplacée
horizon: present         # past | present | future
version: v1              # version du projet à laquelle cette info s'applique
```

**Valeurs de `status`** :
- `current` — information valide et active aujourd'hui
- `archived` — information historique valide en son temps mais plus applicable
- `planned` — décision ou spec pour une version ou date future
- `deprecated` — information abandonnée (ni valide, ni archivée proprement, ni planifiée)

**Valeurs de `horizon`** :
- `past` — concerne une version ou période révolue
- `present` — concerne l'état actuel du projet
- `future` — concerne ce qui est planifié

### 2. Le dossier `wiki/archive/`

Quand une page est supersédée par une information plus récente, elle ne disparaît pas — elle migre dans `wiki/archive/` avec son sous-dossier d'origine (`archive/concepts/`, `archive/entities/`, etc.). Sa structure est conservée intacte, seul son `status` passe à `archived` et son champ `superseded_by` pointe vers la nouvelle page.

**Règle fondamentale** : le LLM, par défaut, répond en prioritisant les pages `status: current`. Il peut être invité à consulter `archive/` explicitement pour des questions historiques.

### 3. Le fichier `wiki/timeline.md`

Un fichier chronologique des événements-clés du projet : décisions prises, pivots, sorties de versions, changements d'orientation. Ce n'est pas un log d'opérations wiki (c'est le rôle de `log.md`) — c'est un log des événements *du projet lui-même*.

```markdown
## [2026-04-09] Décision : architecture technique initiale choisie
## [2026-07-15] Pivot : migration vers microservices
## [2026-10-01] Spec v3 : exploration serverless
```

Ce fichier permet au LLM de répondre à des questions temporelles précises : "qu'avons-nous décidé avant juillet 2026 ?" ou "quel était l'état du projet à la sortie de la v1 ?".

### 4. Notion de version de projet

Le champ `version` dans le frontmatter lie chaque page à une version spécifique du projet. Lors d'une query, l'utilisateur peut préciser : "réponds uniquement avec les informations valides pour la v2." Le LLM filtre alors les pages planifiées pour la v3 ou les pages archivées de la v1.

---

## Structure complète v2

```
twoweeks/
├── CLAUDE.md                      ← schema LLM (v2)
├── PLUGINS.md
│
├── rawinput/                      ← NOUVEAU : staging zone
│   └── README.md                  ← instructions pour l'utilisateur
│
├── raw/                           ← bibliothèque permanente (après ingest)
│   └── assets/
│
└── wiki/
    ├── index.md                   ← catalogue (inclut statuts et horizons)
    ├── log.md                     ← journal des opérations wiki
    ├── timeline.md                ← NOUVEAU : chronologie du projet
    ├── overview.md
    │
    ├── entities/                  ← pages actives (status: current ou planned)
    ├── concepts/
    ├── sources/
    ├── outputs/
    │
    └── archive/                   ← NOUVEAU : pages supersédées
        ├── entities/
        ├── concepts/
        └── sources/
```

---

## Les nouveaux workflows

### Workflow : Ingest v2 (avec staging)

1. Scanner `rawinput/` (pas `raw/`)
2. Pour chaque fichier trouvé :
   a. Lire et traiter le fichier
   b. Créer/mettre à jour les pages wiki
   c. Déplacer le fichier vers `raw/` (ou `raw/assets/` si image)
3. Mettre à jour `index.md`, `log.md`
4. Signaler les pages touchées

**Déclencheur** : "Ingère les nouvelles sources" ou "Traite `rawinput/`"

### Workflow : Supersede

Quand une nouvelle source contredit ou met à jour une page existante :

1. Identifier la page à superseder
2. Créer la nouvelle page avec `status: current` et `valid_from: aujourd'hui`
3. Mettre à jour l'ancienne page : `status: archived`, `valid_until: aujourd'hui`, `superseded_by: [[nouvelle-page]]`
4. Déplacer l'ancienne page vers `wiki/archive/[catégorie]/`
5. Mettre à jour `wiki/timeline.md` avec l'événement
6. Mettre à jour `index.md` et `log.md`

### Workflow : Query temporelle

Quand l'utilisateur pose une question avec une dimension temporelle :

- "Quel est l'état actuel ?" → lire uniquement les pages `status: current`
- "Qu'avions-nous décidé en [date] ?" → consulter `timeline.md` + pages `archive/` de la période
- "Qu'est-ce qui est planifié pour la v3 ?" → lire pages `status: planned` + `horizon: future`
- "Montre-moi l'évolution de [concept]" → lire la page actuelle + ses versions archivées via `superseded_by`

### Workflow : Lint v2 (étendu)

En plus des vérifications v1 (orphelins, contradictions, liens cassés) :
- Pages `status: current` qui mentionnent des informations marquées `archived` ailleurs
- Pages sans champ `status` (frontmatter incomplet)
- Pages `planned` dont la `valid_from` est dépassée (auraient dû être activées)
- Pages `current` sans `valid_from` (date de validité inconnue)
- Concepts évolutifs sans historique d'archive (pivot non tracé)

---

## Règles de priorité pour les réponses LLM

Par défaut, quand le LLM répond à une query :

1. **Priorité 1** : pages `status: current` + `horizon: present`
2. **Priorité 2** : pages `status: current` + `horizon: future` (spec planifiée)
3. **Priorité 3** : pages `status: planned`
4. **Ignorer** : pages `status: archived` ou `deprecated` — sauf si la query est explicitement historique

Cette règle de priorité doit être rappelée dans `CLAUDE.md` et appliquée par défaut.

---

## Pourquoi ce design plutôt que d'autres approches

**Alternative considérée : versioning git des pages**
Git aurait pu gérer l'historique automatiquement. Problème : le LLM ne peut pas facilement "checkout une version passée" pour répondre à une query historique. La solution choisie (archive + frontmatter temporel) rend l'historique visible dans le wiki lui-même, directement queryable.

**Alternative considérée : timestamps dans les noms de fichiers**
`wiki/concepts/2026-04-09-architecture-technique.md` + `wiki/concepts/2026-07-15-architecture-technique.md`. Simple, mais perd les liens Obsidian `[[architecture-technique]]` et complique la navigation. La solution choisie (un nom stable + archive) préserve la navigabilité.

**Alternative considérée : un seul fichier avec sections versionnées**
Garder toutes les versions d'un concept dans un seul fichier avec des sections `## v1 (archivé)` / `## v2 (actuel)`. Problème : les fichiers grossissent indéfiniment et le LLM lit du bruit à chaque requête. L'archive physique garde les fichiers actifs lisibles.

---

## Limites connues de la v2

- **Granularité temporelle** : on archive des pages entières, pas des paragraphes. Si un concept change partiellement, il faut réécrire la page entière et archiver l'ancienne. Acceptable mais à surveiller.
- **Charge de maintenance** : le workflow Supersede est plus lourd qu'une simple mise à jour. En contrepartie, il rend les pivots explicites et tracés.
- **Requêtes "as of date" complexes** : pour vraiment requêter "l'état exact du wiki au 15 juillet 2026", il faudrait git. La v2 permet des approximations temporelles (par `valid_from`/`valid_until`) mais pas une reconstruction exacte. Si ce besoin devient fort, git est la bonne réponse complémentaire.

---

*Ce document a été produit le 2026-04-09 suite à un commentaire critique sur la v1. Il a été filé dans `wiki/outputs/` car il constitue une décision architecturale de référence.*
