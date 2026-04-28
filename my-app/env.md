# .env.production
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2FzdWFsLWdvcmlsbGEtNjguY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_FRONTEND_API=https://casual-gorilla-68.clerk.accounts.dev
PLASMO_PUBLIC_CLERK_SYNC_HOST=https://my-app.com

# Convex Configuration for production
NEXT_PUBLIC_CONVEX_URL=https://giddy-basilisk-88.convex.cloud
CONVEX_DEPLOYMENT=prod:giddy-basilisk-88
EXTENSION_ORIGIN=chrome-extension://nhfjocafgfkcmennccoomihpnhdecabl
CLERK_JWT_ISSUER_DOMAIN=https://casual-gorilla-68.clerk.accounts.dev
OPENAI_API_KEY=<OPENAI_API_KEY>

MISTRAL_API_KEY=<MISTRAL_API_KEY>

 
VITE_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2FzdWFsLWdvcmlsbGEtNjguY2xlcmsuYWNjb3VudHMuZGV2JA


# Option C (spaCy + spacy-layout) — Convex environment flags

Add these to Convex environment (convex env set ... or dashboard), not to client .env:
- ENABLE_NER=1
- NER_SERVICE_URL=https://your-spacy-layout-service
- NER_SERVICE_KEY=your-shared-bearer-key

Notes:
- ENABLE_NER gates all NER calls in actions; when disabled or missing, the code path is skipped and behavior is unchanged.
- NER_SERVICE_URL must point to the HTTP service exposing POST /ner (see [docs/spacy-layout-service.md](docs/spacy-layout-service.md)).
- NER_SERVICE_KEY must match the service’s SERVICE_KEY. Requests include Authorization: Bearer <NER_SERVICE_KEY>.
