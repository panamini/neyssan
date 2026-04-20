# Audit C1 Secrets + Runbook Opérationnel (Débutant)

Date: 2026-04-22  
Périmètre: `/Users/aurelienprivileggio/Workspace/Neyssan` + pratiques équipe (local, préprod, prod)  
Source auditée: `Kanban_CardNotes/Audit Workspace — ... — C1 — Secrets en clair commités ... .md`

## 1) Compte-rendu d’audit (C1)

## 1.1 Résumé exécutif

Le constat C1 est valide: des secrets applicatifs ont été committés en clair (`OPENAI_API_KEY`, `MISTRAL_API_KEY`).
Le risque est **critique** car une clé exposée peut permettre:
- abus de consommation API,
- accès indirect à des données personnelles traitées,
- non-conformité sécurité (RGPD art. 32).

## 1.2 Preuves

- `my-app/env.md:11` contient `OPENAI_API_KEY=...`
- `my-app/env.md:14` contient `MISTRAL_API_KEY=...`

## 1.3 Écart principal

La note C1 couvre bien la remédiation technique immédiate, mais ne formalise pas assez:
- la coordination inter-rôles,
- le séquencement équipe (gel, rotation, reprise),
- la stratégie cible de stockage des secrets par environnement.

## 1.4 Glossaire (acronymes)

- `CI`: *Continuous Integration* (intégration continue). Exécute automatiquement des vérifications (tests, scans) à chaque changement.
- `CI/CD`: *Continuous Integration / Continuous Delivery* (intégration et déploiement continus).
- `PR`: *Pull Request* (demande de fusion de code).
- `DPO`: *Data Protection Officer* (Délégué à la protection des données).
- `IAM`: *Identity and Access Management* (gestion des identités et des droits d’accès).

## 1.5 Outils de détection de secrets

- `gitleaks`: outil open-source qui détecte des secrets dans les fichiers, commits et historique git via règles/patterns.
- `trufflehog`: outil de détection de secrets (open-source) qui combine recherche de patterns et vérifications d’indices de validité selon les sources.

Pourquoi les utiliser:
- éviter qu’un secret arrive en `PR`,
- détecter tôt (poste dev) et tard (pipeline CI),
- réduire le risque de fuite silencieuse.

## 1.6 Actions préalables par contributeur (avec raisons)

### A. Tech Lead / Responsable incident
- Déclarer un incident sécurité horodaté.
- Geler les merges/push sur la branche principale jusqu’à rotation des clés.
- Nommer un responsable par lot: `Git`, `Rotation`, `CI`, `Communication`.
Pourquoi:
- évite d’aggraver l’incident pendant la correction,
- clarifie les responsabilités et réduit le temps de réaction.

### B. Maintainer Git
- Appliquer la correction du dépôt (désindexation + template non sensible).
- Vérifier si fuite d’historique (branches/tags).
- Préparer procédure de resynchronisation des clones si réécriture historique.
Pourquoi:
- retirer le secret du commit courant ne suffit pas si l’historique reste exposé.

### C. DevOps / Platform
- Révoquer puis régénérer immédiatement les clés exposées.
- Créer des clés distinctes par environnement: `dev`, `preprod`, `prod`.
- Mettre les nouveaux secrets dans un secret manager (pas dans git).
Pourquoi:
- une clé potentiellement compromise est considérée perdue,
- la séparation par environnement limite le blast radius (portée d’impact).

### D. Développeurs
- Stopper tout push pendant l’opération.
- Supprimer les copies locales non nécessaires de fichiers sensibles.
- Repartir du commit de remédiation (ou de la nouvelle histoire git si réécriture).
Pourquoi (important):
- un push pendant l’incident peut réintroduire les secrets supprimés,
- garder des copies locales non contrôlées augmente le risque de fuite ultérieure,
- repartir d’une base propre évite les conflits et erreurs de resynchronisation.

### E. Security / DPO
- Qualifier l’impact potentiel (données potentiellement concernées).
- Documenter mesures techniques et organisationnelles prises.
- Évaluer obligations de notification selon politique interne.
Pourquoi:
- la traçabilité est requise en cas d’audit ou d’incident RGPD.

### F. Owner CI/CD
- Activer détection automatique de secrets (pre-commit + CI).
- Bloquer les PR qui introduisent un secret.
- Vérifier que les pipelines injectent les secrets uniquement via variables sécurisées.
Pourquoi:
- transforme une règle humaine fragile en contrôle automatique systématique.

## 1.7 Stratégies de stockage des secrets (classées)

## Niveau 1 (recommandé) — Risque faible, partage équipe fort

- Solution: secret manager cloud managé (`AWS Secrets Manager`, `GCP Secret Manager`, `Azure Key Vault`, `HashiCorp Vault`).
- Usage: **préprod + prod** (et idéalement dev partagé).
- Avantages: IAM, audit logs, rotation, versioning.
- Risque résiduel: faible (dépend de la qualité IAM).

## Niveau 2 — Risque faible à moyen, partage contrôlé

- Solution: secrets CI/CD (`GitHub Actions Secrets`, `GitLab CI variables`) + injection runtime.
- Usage: pipelines de build/déploiement.
- Limite: gouvernance parfois moins complète qu’un vault central.

## Niveau 3 — Risque moyen, partage restreint (local dev)

- Solution: `.env.local` non commité + transmission via gestionnaire de mots de passe équipe (`1Password`, `Bitwarden`, etc.).
- Usage: **local dev uniquement**.
- Conditions: clés dédiées dev, quotas faibles, expiration courte.

## Niveau 4 — Risque élevé (tolérance exceptionnelle et temporaire)

- Solution: partage manuel hors canal sécurisé formel.
- Usage: urgence courte uniquement.
- Obligation: rotation immédiate après usage.

## Niveau 5 — Risque critique (interdit)

- Secrets en git/wiki/tickets/logs/captures d’écran.

## 1.8 Stratégie recommandée pour votre équipe (2 développeurs, niveaux sécurité différents)

Objectif: simple à adopter, gratuite/open-source au maximum, et sûre.

Stack recommandée:
- `Bitwarden` (clients open-source) ou `Vaultwarden` (serveur open-source auto-hébergé) pour partager les secrets d’équipe.
- `.env.local` pour le runtime local (non versionné).
- `gitleaks` en pre-commit + en CI pour bloquer les fuites.

Pourquoi cette stratégie:
- facile à prendre en main pour un profil novice (interface coffre-fort claire),
- compatible avec un profil avancé (politiques d’accès, rotation, audit),
- coûts faibles voire nuls selon l’hébergement choisi.

Règles d’équipe minimales:
- jamais de secret dans git,
- secret `dev` seulement en local,
- secrets `preprod/prod` accessibles uniquement via coffre partagé et rôles définis,
- rotation obligatoire après incident.

## 1.9 Politique par environnement

- `Local`: secrets dev seulement, jamais préprod/prod.
- `Préprod`: secrets dédiés préprod, stockés en secret manager, permissions minimales.
- `Prod`: secrets dédiés prod, secret manager obligatoire, accès humains exceptionnels et tracés.

---

## 2) Runbook opérationnel (pas à pas, novice)

Objectif: corriger l’exposition, restaurer un état sûr, puis durcir le projet.

## 2.1 Pré-requis

- Être sur le repo local racine: `/Users/aurelienprivileggio/Workspace/Neyssan`
- Avoir les droits dashboards fournisseurs (OpenAI, Mistral, CI/CD, cloud secret manager)
- Disposer d’un canal équipe (pour annoncer gel/reprise)
- Avoir `rg` ou `grep` disponible sur la machine.

Note `sudo`:
- Toutes les commandes de ce runbook sont prévues **sans `sudo`**.
- Utiliser `sudo` uniquement pour installer un outil système si nécessaire (`brew`, paquets OS), jamais pour les commandes `git`/scan du projet.

## 2.2 Phase J0 (immédiat)

### Étape 1 — Geler les changements

1. Annoncer: "incident secrets, stop push/merge".
2. Suspendre temporairement les merges.

### Étape 2 — Corriger le dépôt

Exécuter depuis la racine du repo:

```bash
# retirer le fichier sensible de l'index git (garde le fichier local)
git rm --cached my-app/env.md

# créer un fichier local de secrets (non versionné) puis y stocker les clés
touch my-app/.env.local.private
# éditer my-app/.env.local.private et y placer les nouvelles clés (hors git)

# vérifier que le fichier local de secrets est bien ignoré
git check-ignore -v my-app/.env.local.private || true

# désensibiliser la documentation (env.md) en retirant toute valeur réelle
# et en ne gardant que des placeholders/documentation

# scanner une première fois (option rg)
rg -n "(OPENAI_API_KEY=|MISTRAL_API_KEY=|sk-[A-Za-z0-9_-]{20,})" .

# scanner une première fois (option grep)
grep -RInE "(OPENAI_API_KEY=|MISTRAL_API_KEY=|sk-[A-Za-z0-9_-]{20,})" .

# commit de remédiation
git add my-app/env.md
git commit -m "security: sanitize env documentation and keep local secrets out of git"
```

### Étape 3 — Rotation des secrets (obligatoire)

1. Ouvrir les dashboards fournisseurs.
2. Révoquer les anciennes clés.
3. Générer de nouvelles clés distinctes `dev/preprod/prod`.
4. Stocker immédiatement les nouvelles clés dans le secret manager cible.

### Étape 4 — Vérifications minimales

```bash
# scan local élargi (option rg)
rg -n "(OPENAI_API_KEY=|MISTRAL_API_KEY=|sk-[A-Za-z0-9_-]{20,})" .

# scan local élargi (option grep)
grep -RInE "(OPENAI_API_KEY=|MISTRAL_API_KEY=|sk-[A-Za-z0-9_-]{20,})" .

# vérifier que le fichier local de secrets est bien ignoré
git check-ignore -v my-app/.env.local.private || true

# audit dépendances (optionnel mais conseillé)
npm --prefix my-app audit --omit=dev || true
```

Critère de sortie J0:
- plus aucun secret en clair dans le repo courant,
- anciennes clés révoquées,
- nouvelles clés injectées hors git.

## 2.3 Phase J1 (24h)

### Étape 5 — Vérifier l’historique git

```bash
# exemple de recherche d'empreintes dans l'historique
git log --all -- my-app/env.md
```

Si le dépôt a été partagé avec secrets dans l’historique, préparer réécriture.

### Étape 6 — Réécriture d’historique (si nécessaire)

```bash
# ATTENTION: opération sensible coordonnée équipe
git filter-repo --path my-app/env.md --invert-paths
```

Après réécriture:
- forcer push des branches concernées,
- demander à tous les contributeurs de resynchroniser leur clone.

### Étape 7 — Installer les garde-fous

- Ajouter `gitleaks` ou `trufflehog` en CI.
- Ajouter hook pre-commit pour scan secrets local (même outil qu’en CI si possible).
- Bloquer merge si scan échoue.

## 2.4 Phase J7 (durcissement)

- Vérifier que tous les environnements utilisent un secret manager.
- Documenter la procédure standard d’onboarding secrets.
- Tester un exercice de rotation sur une clé non critique.

## 2.5 Commandes utiles de contrôle

```bash
# vérifier fichiers suivis liés aux env (option rg)
git ls-files | rg -n "env|\.env|secret|key"

# vérifier fichiers suivis liés aux env (option grep)
git ls-files | grep -nE "env|\\.env|secret|key"

# vérifier ce que git ignorerait (pratique pour fichiers de secrets locaux)
git check-ignore -v my-app/.env.local || true
git check-ignore -v my-app/.env.local.private || true
```

Exemples d’exécution sans `sudo`:

```bash
# scan de secrets avec gitleaks sur le repo courant
gitleaks detect --source . --no-git

# scan de l'historique git (peut être plus long)
gitleaks git --source .
```

## 2.6 Checklist finale (DoD)

- [ ] Secrets exposés révoqués.
- [ ] Nouvelles clés créées et séparées par environnement.
- [ ] Aucun secret en clair dans le repo courant.
- [ ] Historique traité si nécessaire.
- [ ] CI bloque toute future fuite.
- [ ] Runbook communiqué à tous les contributeurs.

## 3) Décision de fusion des livrables

Oui, la fusion audit + runbook dans un document unique est possible et adaptée ici.
Ce fichier sert à la fois de:
- compte-rendu d’audit,
- guide d’exécution opérationnel pour profils débutants.
