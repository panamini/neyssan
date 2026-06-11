# PR20 - Local MCP approval and audit boundary

Date: 2026-06-11
Statut: implemented
Scope: types et helpers TypeScript purs pour préparer l'approbation et l'audit Local MCP.

## Objectif

PR20 ajoute une frontière de modèle avant tout transport MCP.

Certain:
- une demande d'approbation peut être construite depuis une envelope PR19 valide;
- la demande réutilise le `requestId` PR19 fourni par l'appelant;
- aucun helper ne génère de `requestId` ou de timestamp;
- les événements d'audit ont un `eventId` déterministe.

## Livré

- `LocalMcpApprovalRequestV1`
- `LocalMcpApprovalDecisionV1`
- `LocalMcpAuditEventV1`
- `LocalMcpSafeArgumentSummaryV1`
- builders et assertions pures
- tests de sécurité sur les summaries, IDs, timestamps et imports

## Hors scope

- UI d'approbation
- persistance d'audit
- Convex
- serveur ou transport MCP
- OAuth, ChatGPT App ou Remote MCP
- handler produit réel
- export, send, submit, apply

## Pourquoi TypeScript pur

Cette PR prépare le contrat sans l'exécuter.

Le module ne dépend que des types Local MCP, de l'envelope PR19, du registre Local MCP et du hash stable existant.

Il n'importe ni Convex, ni UI, ni réseau, ni SDK MCP.

## Modèle d'approbation

La demande d'approbation contient:
- `requestId`
- `toolName`
- `localToolId`
- `userId`
- `sessionId` optionnel
- `requestedAt`
- `riskLevel`
- `argumentSummary`

Le `requestId` est obligatoire et doit venir de PR19. Si absent, le helper throw.

La décision accepte seulement:
- `approved`
- `denied`

Elle peut être convertie vers `LocalMcpApprovalV1`, le format déjà accepté par l'envelope PR19.

## Modèle d'audit

L'événement d'audit est un shell seulement.

L'`eventId` utilise le hash stable existant sur des champs stables:
- `eventType`
- `requestId`
- `toolName`
- `localToolId`
- `userId`
- `sessionId`
- `occurredAt`
- `outcome`
- `reasonCode`

Format:
- `local-mcp-audit-event:<sha256>`

## Safe argument summary

Le résumé expose seulement les refs attendues:
- `applicationPackageRef`
- `evidenceGraphRef`
- `resumeVariantPlanRef`
- `reviewCockpitRef`

Il extrait seulement les `id` string non-empty de ces refs.

Les champs inconnus ou sensibles sont comptés dans `omittedRawValueCount`, sans exposer leur nom.

## Risques

Probable:
- si PR18 ajoute de nouveaux refs, la whitelist du summary devra évoluer avec le schema projeté.

À vérifier:
- PR21 devra brancher un vrai boundary handler sans transformer ces types en protocole runtime.

## Tests

Ajout:
- `my-app/src/modules/local-mcp/__tests__/mcpApprovalAuditBoundary.test.ts`

Les tests couvrent:
- absence de génération de `requestId`;
- absence de temps implicite;
- IDs d'audit déterministes;
- changement d'ID si `outcome` ou `reasonCode` change;
- exclusion des noms sensibles inconnus;
- extraction limitée aux refs attendues;
- absence d'import Convex, UI, réseau, transport ou persistance.

## Rollback

Supprimer:
- `my-app/src/modules/local-mcp/mcpApprovalAuditBoundary.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpApprovalAuditBoundary.test.ts`
- `docs/decisions/2026-06-11-mcp-approval-audit-boundary.md`
