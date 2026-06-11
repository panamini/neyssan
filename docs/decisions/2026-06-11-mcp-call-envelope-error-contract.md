# PR19 - Local MCP call envelope and error contract

Date: 2026-06-11
Statut: implemented
Scope: couche TypeScript pure pour préparer un appel local compatible MCP sans protocole runtime.

## Objectif

PR19 ajoute une envelope locale qui représente une future invocation de tool.

Certain:
- l'envelope utilise `kind: "local_mcp_call_envelope"`;
- elle ne contient pas de JSON-RPC, pas de `method`, pas de `params`;
- elle ne lance aucun tool.

## Livré

- Types d'envelope locale.
- Mapping `twoweeks.*` vers `local_mcp.*`.
- Validation pure de l'envelope et des refs d'arguments.
- Taxonomie d'erreurs stable et safe-for-model.
- Résultat d'erreur MCP-like mais non protocolaire.
- Tests ciblés.

## Hors scope

- Serveur MCP distant.
- Transport HTTP, SSE, WebSocket ou Streamable HTTP.
- OAuth ou ChatGPT App.
- Handler produit réel.
- Convex, UI, export, send, submit, apply.
- Mutation de CV, profils ou CandidateEvidence.

## Mapping

| Projected tool name | Local tool id |
|---|---|
| `twoweeks.application_package.summarize` | `local_mcp.application_package.summarize` |
| `twoweeks.evidence_graph.summarize` | `local_mcp.evidence_graph.summarize` |
| `twoweeks.resume_variant_plan.summarize` | `local_mcp.resume_variant_plan.summarize` |
| `twoweeks.review_cockpit.summarize` | `local_mcp.review_cockpit.summarize` |

## Error taxonomy

Certain:
- chaque erreur a un message court, sans raw args, sans stack trace, sans source text;
- `timeout` et `rate_limited` sont retryable par défaut;
- les autres erreurs ne sont pas retryable par défaut.

Codes:
- `invalid_request`
- `unknown_tool`
- `invalid_tool_name`
- `invalid_arguments`
- `missing_user`
- `approval_required`
- `tool_not_allowlisted`
- `output_too_large`
- `privacy_filter_required`
- `handler_unavailable`
- `timeout`
- `rate_limited`
- `internal_error`

## Pourquoi TypeScript pur

Cette PR prépare le contrat d'appel sans introduire de boundary runtime.

Le module ne dépend que des types locaux, du registre Local MCP et des contrats internes existants. Il n'importe ni Convex, ni UI, ni réseau, ni SDK MCP.

## Risques

Probable:
- le mapping devra rester synchronisé avec PR18 si des tools sont ajoutés.
- la validation des arguments devra évoluer si les JSON Schemas deviennent plus riches.

À vérifier:
- PR21 devra brancher un vrai handler boundary sans réutiliser cette envelope comme protocole JSON-RPC.

## Tests

Ajout:
- `my-app/src/modules/local-mcp/__tests__/mcpCallEnvelope.test.ts`

Les tests couvrent:
- mapping dans les deux sens;
- parsing et clone défensif;
- validation des names, user, approval et refs;
- taxonomie d'erreurs;
- résultat d'erreur MCP-like non protocolaire;
- guards de scope contre transport, serveur, handler, protocol fields et réseau.

## Rollback

Supprimer:
- `my-app/src/modules/local-mcp/mcpCallEnvelope.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpCallEnvelope.test.ts`
- `docs/decisions/2026-06-11-mcp-call-envelope-error-contract.md`
