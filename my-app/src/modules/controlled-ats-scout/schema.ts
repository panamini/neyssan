export type ControlledAtsVendorV1 = "greenhouse" | "lever" | "ashby";

export type ControlledAtsForbiddenVendorV1 =
  | "linkedin"
  | "upwork"
  | "indeed"
  | "generic_web"
  | "unknown_scraper";

export type ControlledAtsSourceKindV1 =
  | "public_job_board_payload"
  | "public_job_detail_payload"
  | "manual_fixture";

export type ControlledAtsJobStatusV1 = "open" | "closed" | "unknown";

export type ControlledAtsWorkplaceTypeV1 = "remote" | "hybrid" | "onsite" | "unknown";

export type ControlledAtsCompensationIntervalV1 =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year"
  | "unknown";

export type ControlledAtsCompensationV1 = Readonly<{
  currency?: string;
  minAmount?: number;
  maxAmount?: number;
  interval?: ControlledAtsCompensationIntervalV1;
  rawText?: string;
  version: 1;
}>;

export type ControlledAtsJobLeadV1 = Readonly<{
  id: string;
  vendor: ControlledAtsVendorV1;
  sourceKind: ControlledAtsSourceKindV1;
  sourceUrl?: string;
  canonicalUrl?: string;
  externalJobId?: string;
  companyName?: string;
  title: string;
  department?: string;
  team?: string;
  location?: string;
  workplaceType: ControlledAtsWorkplaceTypeV1;
  status: ControlledAtsJobStatusV1;
  descriptionText?: string;
  descriptionHash?: string;
  applyUrl?: string;
  postedAt?: string;
  compensation?: ControlledAtsCompensationV1;
  rawPayloadHash: string;
  leadHash: string;
  createdAt: number;
  updatedAt: number;
  version: 1;
}>;

export type BuildControlledAtsJobLeadInputV1 = Readonly<{
  vendor: ControlledAtsVendorV1;
  sourceKind: ControlledAtsSourceKindV1;
  sourceUrl?: string;
  canonicalUrl?: string;
  externalJobId?: string;
  companyName?: string;
  title: string;
  department?: string;
  team?: string;
  location?: string;
  workplaceType: ControlledAtsWorkplaceTypeV1;
  status: ControlledAtsJobStatusV1;
  descriptionText?: string;
  descriptionHash?: string;
  applyUrl?: string;
  postedAt?: string;
  compensation?: ControlledAtsCompensationV1;
  rawPayloadHash: string;
  createdAt: number;
  updatedAt: number;
}>;

export type ControlledAtsPayloadEnvelopeV1 = Readonly<{
  vendor: ControlledAtsVendorV1;
  sourceKind: ControlledAtsSourceKindV1;
  sourceUrl?: string;
  payload: unknown;
  createdAt: number;
  updatedAt: number;
  version: 1;
}>;

export type ControlledAtsAdapterV1 = Readonly<{
  vendor: ControlledAtsVendorV1;
  title: string;
  description: string;
  supportedSourceKinds: readonly ControlledAtsSourceKindV1[];
  version: 1;
}>;

export type ControlledAtsAdapterRegistryV1 = Readonly<{
  adapters: readonly ControlledAtsAdapterV1[];
  vendors: readonly ControlledAtsVendorV1[];
  version: 1;
}>;

export type ControlledAtsRejectedRecordV1 = Readonly<{
  reason: string;
  vendor?: string;
  sourceUrl?: string;
  rawPayloadHash?: string;
  version: 1;
}>;

export type ControlledAtsNormalizationResultV1 = Readonly<{
  vendor: ControlledAtsVendorV1;
  sourceKind: ControlledAtsSourceKindV1;
  leads: readonly ControlledAtsJobLeadV1[];
  rejected: readonly ControlledAtsRejectedRecordV1[];
  warnings: readonly string[];
  version: 1;
}>;

export type ControlledAtsScoutContentV1 = Readonly<{
  kind: "controlled_ats_scout_adapters";
  registry: ControlledAtsAdapterRegistryV1;
  version: 1;
}>;
