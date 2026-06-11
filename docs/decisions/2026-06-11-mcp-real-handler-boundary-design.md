# PR21 - Local MCP real handler boundary design

Date: 2026-06-11
Statut: implemented
Scope: types et validation TypeScript purs pour decrire une future frontiere de handler reel Local MCP.

## Objectif

PR21 definit la forme minimale qu'un futur branchement vers un vrai handler devra satisfaire.

Certain:
- la frontiere est `future_real_handler_design_only`;
- elle consomme les contrats PR19 et PR20: envelope valide, approval request, approval decision et audit checkpoints;
- elle ne cree aucun handler executable.

## Livre

- `LocalMcpHandlerBoundaryV1`
- `LocalMcpFutureHandlerBoundaryV1`
- listes fermees d'effets autorises et interdits
- gates obligatoires approval, audit, idempotency, rollback et privacy
- builder pur pour construire le contrat standard
- validateur pur avec erreurs safe-for-model
- tests cibles

## Regles d'effets

Effets autorises uniquement dans le contrat futur:
- lecture de references locales deja validees;
- calcul deterministe;
- filtre privacy;
- construction de reponse safe;
- construction de shell d'audit.

Effets interdits:
- write Convex;
- audit persistant;
- reseau, transport, serveur, Remote MCP;
- ChatGPT App, OAuth;
- UI d'approbation;
- browser automation;
- export, send, submit, apply;
- mutation de CandidateFacts;
- sortie de facts `private` ou `never_use`.

## Gates obligatoires

La frontiere valide seulement si:
- l'envelope PR19 est validee et porte un `requestId`;
- l'approbation PR20 existe et la decision est `approved`;
- les checkpoints d'audit attendus sont declares, sans persistence PR21;
- l'idempotency utilise `request_id`;
- un `rollbackPlanRef` explicite est present;
- les sorties publiques excluent `private`, `never_use`, raw source text, full generated text et stack traces.

## Hors scope

- vrais handlers;
- registry de handlers executables;
- execution produit;
- Convex write;
- persistence audit log;
- UI d'approbation;
- serveur ou transport MCP;
- Remote MCP;
- ChatGPT App;
- OAuth;
- export, send, submit, apply.

## Pourquoi TypeScript pur

Cette PR reduit le prochain risque architectural: un futur handler ne pourra pas etre branche sans passer par une forme qui rend visibles approval, audit, idempotency, rollback et privacy.

Le module importe seulement les contrats Local MCP existants et ne depend pas de Convex, de l'UI, du reseau, d'un SDK externe ou d'un transport.

## Tests

Ajout:
- `my-app/src/modules/local-mcp/__tests__/mcpHandlerBoundary.test.ts`

Les tests couvrent:
- construction de la frontiere design-only depuis PR19 et PR20;
- refus des approvals absentes ou refusees;
- gates audit/idempotency/rollback/privacy obligatoires;
- effets interdits non autorisables;
- coherence toolName/localToolId/approval/requestId;
- rejet de slots executables ou registry-shaped;
- clones defensifs et non-mutation;
- garde-fous source contre runtime, persistence, transport, UI et SDK externes.

## Rollback

Supprimer:
- `my-app/src/modules/local-mcp/mcpHandlerBoundary.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpHandlerBoundary.test.ts`
- `docs/decisions/2026-06-11-mcp-real-handler-boundary-design.md`
