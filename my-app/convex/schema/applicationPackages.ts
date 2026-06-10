import { defineTable } from "convex/server";

import { applicationPackageFields } from "../lib/applicationPackages";

// PR14 — Table Convex interne pour les packages d'application.
// But du changement : isoler la définition de table ApplicationPackageV1 pour que
// `convex/schema.ts` reste lisible et que les prochains développeurs sachent où regarder.
// Fichiers à lire ensemble :
// - `convex/applicationPackages.ts` pour les mutations/queries internes create/reuse/read/list ;
// - `convex/lib/applicationPackages.ts` pour la validation, les champs indexables et les conflits ;
// - `src/modules/application-package/*` pour la forme source de vérité ApplicationPackageV1.
// Fichiers à modifier seulement si PR14 casse : ce fichier, `convex/schema.ts`,
// `convex/applicationPackages.ts`, `convex/lib/applicationPackages.ts` et le test PR14.
// Risques/cas limites : ne pas ajouter de workflow d'approbation, d'export, de Scout/MCP,
// de route UI ou de génération ici ; cette table ne doit persister qu'une ombre interne.
// Vérification attendue : `rtk npx convex codegen`, test PR14, régressions ApplicationPackage
// et `rtk npx tsc --noEmit` doivent rester verts.
export const applicationPackageTable = defineTable(applicationPackageFields)
  .index("by_application_package_id", ["applicationPackageId"])
  .index("by_user_id", ["userId"])
  .index("by_application_context_id", ["applicationContextId"])
  .index("by_user_and_application_context", ["userId", "applicationContextId"])
  .index("by_status", ["status"])
  .index("by_resume_variant_artifact_id", ["resumeVariantArtifactId"])
  .index("by_cover_letter_artifact_id", ["coverLetterArtifactId"])
  .index("by_created_at", ["createdAt"]);
