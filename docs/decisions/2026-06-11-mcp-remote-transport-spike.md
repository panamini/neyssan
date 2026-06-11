# PR22 - Remote Transport Spike

Date: 2026-06-11
Statut: implemented
Scope: TypeScript pur pour modeliser un futur transport MCP remote, sans runtime.

## Objectif PR22

Certain: PR22 ajoute un modele local pour raisonner sur un futur transport MCP remote.

Certain: PR22 ne livre pas de serveur remote exploitable.

## Ce Qui Est Livre

Certain:
- une config remote transport disabled-by-default;
- une config `non_production_spike_only`;
- des allowlists origin/host exactes;
- un modele auth futur obligatoire avant remote;
- des limites timeout, taille request/response et rate-limit;
- un preflight pur qui retourne `blocked` ou `allowed_for_non_production_spike`;
- des tests cibles et des guards de scope.

## Hors Scope

Certain:
- pas de serveur MCP;
- pas de route HTTP;
- pas de JSON-RPC runtime;
- pas de SSE, WebSocket ou Streamable HTTP actif;
- pas d'OAuth reel;
- pas de ChatGPT App;
- pas de deploiement;
- pas de Convex;
- pas de UI;
- pas de vrais handlers produit;
- pas d'appel reseau;
- pas de persistance d'audit;
- pas de UI d'approbation.

## Pourquoi Non-Production Spike Only

Certain: le statut `allowed_for_non_production_spike` signifie seulement que les champs de preflight respectent le modele local.

Certain: ce statut ne veut pas dire production ready.

Probable: un transport remote reel devra encore prouver auth, audit persistant, privacy filter, idempotency, rollback, observability et review UX avant exposition.

## Transport Config Model

Certain:
- le mode par defaut est `disabled`;
- le transport par defaut est `none`;
- les allowlists sont vides en mode disabled;
- les flags origin/auth/approval/audit/handler restent obligatoires;
- la config non-production utilise seulement une forme de design, pas un listener.

## Origin / Host / Auth Policy

Certain:
- les origins et hosts sont allowlistes par match exact apres normalisation sure;
- `*` est refuse;
- les origins avec credentials sont refusees;
- les origins non-HTTPS sont refusees sauf localhost explicitement allowliste;
- localhost ne passe que s'il est explicitement present;
- `authMode` reste `future_required` pour tout remote.

## Rate-Limit / Timeout / Size-Limit Policy

Certain:
- `timeoutMs` doit etre un entier positif;
- `maxRequestBytes` et `maxResponseBytes` doivent etre des entiers positifs;
- les limites rate-limit par user, session et global doivent etre positives;
- le preflight bloque les tailles au-dessus des limites configurees.

## Preflight Model

Certain: le preflight ne fait aucun appel tool, aucun reseau, aucune lecture produit et aucune persistence.

Certain: il bloque si le transport est disabled, si origin/host/user/session manquent, si les allowlists refusent, si les tailles depassent les limites, ou si approval/audit/handler ne sont pas obligatoires.

Certain: les summaries restent courts et ne contiennent pas les payloads bruts.

## Risques

Probable:
- confondre ce spike avec un transport remote utilisable;
- oublier que l'auth est seulement modelisee;
- ajouter un vrai handler trop tot.

Mitigation:
- module isole;
- config disabled-by-default;
- source guards contre reseau, routes, listeners et SDK externes;
- rollback par suppression.

## Tests

Ajout:
- `my-app/src/modules/local-mcp/__tests__/mcpRemoteTransportSpike.test.ts`

Les tests couvrent:
- config disabled deterministe;
- config non-production deterministe;
- rejet wildcard/empty origin et host;
- origin/host exact match uniquement;
- localhost explicitement allowliste;
- preflight bloque les cas dangereux;
- statut `allowed_for_non_production_spike` seulement quand tout est present;
- absence de mutation;
- absence de runtime reseau/route/handler dans la source.

## Rollback

Supprimer:
- `my-app/src/modules/local-mcp/mcpRemoteTransportSpike.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpRemoteTransportSpike.test.ts`
- `docs/decisions/2026-06-11-mcp-remote-transport-spike.md`

Relancer:
- `rtk npx vitest --run src/modules/local-mcp/__tests__/*.test.ts`
- `rtk npx tsc --noEmit`
