import type {
  VerbatiFontPairId,
  VerbatiTypographyPreset,
} from "./fontCatalog";
import type { CvDocument } from "../../types/cvDocument";

export type VerbatiLayoutPreset =
  | "swiss"
  | "volk-register"
  | "two-column"
  | "editorial"
  | "modernist"
  | "playful-photo"
  | "soft-ribbon"
  | "slate-column"
  | "quire";
export type VerbatiPalettePreset =
  | "sauge"
  | "ocre"
  | "pierre"
  | "bordeaux"
  | "encre"
  | "custom";
export type VerbatiPreviewSource = "active" | "sample";

export interface VerbatiStylePreset {
  layout: VerbatiLayoutPreset;
  typography: VerbatiTypographyPreset;
  palette: VerbatiPalettePreset;
  accentHex?: string;
}

export type { VerbatiFontPairId, VerbatiTypographyPreset };

export type CvDocumentWithVerbatiStyle = CvDocument & {
  metadata: CvDocument["metadata"] & {
    verbatiStyle?: Partial<VerbatiStylePreset>;
  };
};
