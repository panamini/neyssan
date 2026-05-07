import type {
  VerbatiFontPairId,
  VerbatiTypographyPreset,
} from "./fontCatalog";
import type { CvDocument } from "../../types/cvDocument";
import type { ResumeTemplateId } from "../../lib/layout/resumeTemplates";

export type StyleFamilyId =
  | "swiss"
  | "volk-register"
  | "two-column"
  | "editorial"
  | "modernist"
  | "quire"
  | "workshop";
export type LegacyVerbatiLayoutAlias =
  | "playful-photo"
  | "soft-ribbon"
  | "slate-column";
export type VerbatiLayoutPreset = StyleFamilyId | LegacyVerbatiLayoutAlias;
export type VerbatiPalettePreset =
  | "terre"
  | "cobalt"
  | "ink"
  | "sauge"
  | "plum"
  | "ochre"
  | "ocre"
  | "pierre"
  | "bordeaux"
  | "encre"
  | "custom";
export type VerbatiPreviewSource = "active" | "sample";

export interface VerbatiStylePreset {
  layout: VerbatiLayoutPreset;
  familyId?: StyleFamilyId;
  typography: VerbatiTypographyPreset;
  palette: VerbatiPalettePreset;
  accentHex?: string;
  resumeTemplateId?: ResumeTemplateId;
}

export type { VerbatiFontPairId, VerbatiTypographyPreset };

export type CvDocumentWithVerbatiStyle = CvDocument & {
  metadata: CvDocument["metadata"] & {
    verbatiStyle?: Partial<VerbatiStylePreset>;
  };
};
