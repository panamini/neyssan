# PR18 MCP Schema Projection

## Objectif PR18

Certain: PR18 ajoute une projection TypeScript pure depuis le registre Local MCP existant vers des descripteurs locaux compatibles avec une future forme `tools/list`.

Certain: cette PR ne livre pas le protocole MCP.

## Ce Qui Est Livre

Certain:

- `mcpSchemaProjection.ts` projette chaque `LocalMcpToolDefinitionV1` vers un descriptor stable.
- Les noms publics utilisent le prefixe `twoweeks.*`.
- Les schemas d'entree sont des objets JSON Schema fermes.
- Les schemas de sortie representent le dry-run actuel: `kind`, `internalToolId`, `input`, `outputKind`, `version`.
- Les annotations declarent les outils comme read-only, non destructifs, et closed-world.
- Les tests couvrent l'ordre, les mappings, les schemas, les garde-fous et la non-mutation.

## Hors Scope

Certain:

- pas de `tools/list` runtime;
- pas de `tools/call`;
- pas de JSON-RPC;
- pas de route handler;
- pas de serveur MCP;
- pas de transport HTTP, SSE, WebSocket ou Streamable HTTP;
- pas de connexion ChatGPT;
- pas d'OAuth;
- pas de Convex;
- pas de UI;
- pas d'export, download, send, submit ou apply;
- pas de handler produit reel.

## Pourquoi TypeScript Pur

Certain: la projection consomme uniquement `LocalMcpToolDefinitionV1` et `LocalMcpToolRegistryV1`.

Certain: elle ne lit ni n'ecrit aucune donnee produit.

Certain: elle ne depend pas du reseau, d'un SDK externe, d'un serveur ou de Convex.

## Mapping Local MCP Vers Descriptors

Certain:

- `local_mcp.application_package.summarize` devient `twoweeks.application_package.summarize`.
- `local_mcp.evidence_graph.summarize` devient `twoweeks.evidence_graph.summarize`.
- `local_mcp.resume_variant_plan.summarize` devient `twoweeks.resume_variant_plan.summarize`.
- `local_mcp.review_cockpit.summarize` devient `twoweeks.review_cockpit.summarize`.

Certain: chaque descriptor conserve `localToolId` et `internalToolId` pour garder le lien avec le registre local.

## Risques

Probable: le plus gros risque est de faire croire que cette forme locale est deja un runtime MCP.

Mitigation: le code expose seulement des fonctions de projection et un validateur local.

## Tests

Certain: le test `mcpSchemaProjection.test.ts` verifie:

- quatre tools exposes;
- noms et ordre deterministes;
- schemas d'entree fermes;
- schema de sortie dry-run;
- annotations read-only / non destructives / closed-world;
- absence de termes d'action externe dans les metadata;
- absence d'import runtime interdit;
- projection sans mutation;
- rejet des descriptors malformes.

## Rollback

Certain: le rollback est deletion-only:

- supprimer `my-app/src/modules/local-mcp/mcpSchemaProjection.ts`;
- supprimer `my-app/src/modules/local-mcp/__tests__/mcpSchemaProjection.test.ts`;
- supprimer `docs/decisions/2026-06-11-mcp-schema-projection.md`;
- relancer les tests Local MCP et `tsc --noEmit`.
