import { buildStableHash } from "../application-harness/fingerprints";
import {
  assertInternalToolContractRegistry,
  compareInternalToolIds,
} from "./contractRules";
import type {
  InternalToolContractContentV1,
  InternalToolContractRegistryV1,
  InternalToolContractV1,
} from "./schema";

const HASH_NAMESPACE = "internal-tool-contracts";

const INTERNAL_TOOL_CONTRACTS: readonly InternalToolContractV1[] = [
  {
    id: "application_context.describe",
    title: "Describe application context",
    description: "Describe an existing ApplicationContext boundary and its safe summary metadata.",
    effect: "read_only",
    riskLevel: "low",
    status: "active",
    input: [
      {
        name: "applicationContextRef",
        kind: "application_context_ref",
        required: true,
        description: "Reference to an existing ApplicationContext boundary.",
        version: 1,
      },
    ],
    output: {
      kind: "application_context_summary",
      description: "Safe summary metadata for the ApplicationContext boundary.",
      version: 1,
    },
    requiresApproval: false,
    version: 1,
  },
  {
    id: "evidence_graph.summarize",
    title: "Summarize evidence graph",
    description: "Summarize an existing EvidenceGraph boundary by reference and provenance shape.",
    effect: "read_only",
    riskLevel: "medium",
    status: "active",
    input: [
      {
        name: "evidenceGraphRef",
        kind: "evidence_graph_ref",
        required: true,
        description: "Reference to an existing EvidenceGraph boundary.",
        version: 1,
      },
    ],
    output: {
      kind: "evidence_graph_summary",
      description: "Safe summary metadata for the EvidenceGraph boundary.",
      version: 1,
    },
    requiresApproval: false,
    version: 1,
  },
  {
    id: "resume_variant_plan.summarize",
    title: "Summarize resume variant plan",
    description: "Summarize an existing ResumeVariantPlan boundary by reference and planning metadata.",
    effect: "read_only",
    riskLevel: "medium",
    status: "active",
    input: [
      {
        name: "resumeVariantPlanRef",
        kind: "resume_variant_plan_ref",
        required: true,
        description: "Reference to an existing ResumeVariantPlan boundary.",
        version: 1,
      },
    ],
    output: {
      kind: "resume_variant_plan_summary",
      description: "Safe summary metadata for the ResumeVariantPlan boundary.",
      version: 1,
    },
    requiresApproval: false,
    version: 1,
  },
  {
    id: "review_cockpit.summarize",
    title: "Summarize review cockpit",
    description: "Summarize an existing ReviewCockpit boundary by reference and review-state metadata.",
    effect: "read_only",
    riskLevel: "medium",
    status: "active",
    input: [
      {
        name: "reviewCockpitRef",
        kind: "review_cockpit_ref",
        required: true,
        description: "Reference to an existing ReviewCockpit boundary.",
        version: 1,
      },
    ],
    output: {
      kind: "review_cockpit_summary",
      description: "Safe summary metadata for the ReviewCockpit boundary.",
      version: 1,
    },
    requiresApproval: false,
    version: 1,
  },
  {
    id: "resume_variant_artifact.summarize",
    title: "Summarize resume variant artifact",
    description: "Summarize an existing ResumeVariantArtifact boundary by reference and artifact metadata.",
    effect: "read_only",
    riskLevel: "medium",
    status: "active",
    input: [
      {
        name: "resumeVariantArtifactRef",
        kind: "resume_variant_artifact_ref",
        required: true,
        description: "Reference to an existing ResumeVariantArtifact boundary.",
        version: 1,
      },
    ],
    output: {
      kind: "resume_variant_artifact_summary",
      description: "Safe summary metadata for the ResumeVariantArtifact boundary.",
      version: 1,
    },
    requiresApproval: false,
    version: 1,
  },
  {
    id: "cover_letter_artifact.summarize",
    title: "Summarize cover-letter artifact",
    description: "Summarize an existing CoverLetterArtifact boundary by reference and artifact metadata.",
    effect: "read_only",
    riskLevel: "medium",
    status: "active",
    input: [
      {
        name: "coverLetterArtifactRef",
        kind: "cover_letter_artifact_ref",
        required: true,
        description: "Reference to an existing CoverLetterArtifact boundary.",
        version: 1,
      },
    ],
    output: {
      kind: "cover_letter_artifact_summary",
      description: "Safe summary metadata for the CoverLetterArtifact boundary.",
      version: 1,
    },
    requiresApproval: false,
    version: 1,
  },
  {
    id: "application_package.summarize",
    title: "Summarize application package",
    description: "Summarize an existing ApplicationPackageV1 boundary by reference and package metadata.",
    effect: "read_only",
    riskLevel: "medium",
    status: "active",
    input: [
      {
        name: "applicationPackageRef",
        kind: "application_package_ref",
        required: true,
        description: "Reference to an existing ApplicationPackageV1 boundary.",
        version: 1,
      },
    ],
    output: {
      kind: "application_package_summary",
      description: "Safe summary metadata for the ApplicationPackageV1 boundary.",
      version: 1,
    },
    requiresApproval: false,
    version: 1,
  },
  {
    id: "application_package.validate",
    title: "Validate application package content",
    description: "Describe a pure consistency check for ApplicationPackageContentV1 contract metadata.",
    effect: "pure_compute",
    riskLevel: "medium",
    status: "active",
    input: [
      {
        name: "applicationPackageContent",
        kind: "application_package_content",
        required: true,
        description: "ApplicationPackageContentV1 boundary to check for contract consistency.",
        version: 1,
      },
    ],
    output: {
      kind: "application_package_validation",
      description: "Contract consistency result shape for ApplicationPackageContentV1 metadata.",
      version: 1,
    },
    requiresApproval: false,
    version: 1,
  },
  {
    id: "internal_tool_contracts.list",
    title: "List internal tool contracts",
    description: "List the deterministic internal contract catalog descriptors.",
    effect: "pure_compute",
    riskLevel: "low",
    status: "active",
    input: [],
    output: {
      kind: "tool_contract_summary",
      description: "Safe summary metadata for the internal contract catalog.",
      version: 1,
    },
    requiresApproval: false,
    version: 1,
  },
  {
    id: "internal_tool_contracts.describe",
    title: "Describe internal tool contract",
    description: "Describe one internal contract descriptor from the deterministic catalog.",
    effect: "pure_compute",
    riskLevel: "low",
    status: "active",
    input: [
      {
        name: "toolContractRef",
        kind: "tool_contract_ref",
        required: true,
        description: "Reference to one internal contract descriptor ID.",
        version: 1,
      },
    ],
    output: {
      kind: "tool_contract_summary",
      description: "Safe summary metadata for one internal contract descriptor.",
      version: 1,
    },
    requiresApproval: false,
    version: 1,
  },
] as const;

export function buildInternalToolContractRegistry(): InternalToolContractRegistryV1 {
  const contracts = INTERNAL_TOOL_CONTRACTS.map(cloneInternalToolContract).sort((a, b) =>
    compareInternalToolIds(a.id, b.id),
  );
  const registry: InternalToolContractRegistryV1 = {
    contracts,
    contractIds: contracts.map((contract) => contract.id),
    version: 1,
  };

  assertInternalToolContractRegistry(registry);
  return registry;
}

export function buildInternalToolContractRegistryHash(
  registry: InternalToolContractRegistryV1,
): Promise<string> {
  assertInternalToolContractRegistry(registry);
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "internal-tool-contract-registry",
    version: 1,
    registry,
  });
}

export function buildInternalToolContractContent(
  registry: InternalToolContractRegistryV1,
): InternalToolContractContentV1 {
  assertInternalToolContractRegistry(registry);
  return {
    kind: "internal_tool_contracts",
    registry: cloneInternalToolContractRegistry(registry),
    version: 1,
  };
}

export function getInternalToolContract(id: string): InternalToolContractV1 | undefined {
  const contract = buildInternalToolContractRegistry().contracts.find((candidate) => candidate.id === id);
  return contract ? cloneInternalToolContract(contract) : undefined;
}

export function listInternalToolContracts(): readonly InternalToolContractV1[] {
  return buildInternalToolContractRegistry().contracts.map(cloneInternalToolContract);
}

export function collectInternalToolContractIds(
  registry: InternalToolContractRegistryV1,
): readonly InternalToolContractV1["id"][] {
  assertInternalToolContractRegistry(registry);
  return [...registry.contractIds].sort(compareInternalToolIds);
}

function cloneInternalToolContractRegistry(
  registry: InternalToolContractRegistryV1,
): InternalToolContractRegistryV1 {
  return {
    contracts: registry.contracts.map(cloneInternalToolContract),
    contractIds: [...registry.contractIds].sort(compareInternalToolIds),
    version: 1,
  };
}

function cloneInternalToolContract(contract: InternalToolContractV1): InternalToolContractV1 {
  return {
    ...contract,
    input: contract.input.map((parameter) => ({ ...parameter })),
    output: { ...contract.output },
  };
}
