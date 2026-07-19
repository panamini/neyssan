/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions__probeMistral from "../actions/_probeMistral.js";
import type * as actions_extractProfileStrict from "../actions/extractProfileStrict.js";
import type * as actions_extractProfileStrictWithSpans from "../actions/extractProfileStrictWithSpans.js";
import type * as actions_formatCompleteCV from "../actions/formatCompleteCV.js";
import type * as actions_nerSmokeTest from "../actions/nerSmokeTest.js";
import type * as actions_persistProfile from "../actions/persistProfile.js";
import type * as actions_structuredUpload from "../actions/structuredUpload.js";
import type * as actions_uploads from "../actions/uploads.js";
import type * as activeCvSnapshots from "../activeCvSnapshots.js";
import type * as alerts from "../alerts.js";
import type * as analytics from "../analytics.js";
import type * as applicationContextBuilder from "../applicationContextBuilder.js";
import type * as applicationHarness from "../applicationHarness.js";
import type * as applicationPackages from "../applicationPackages.js";
import type * as auth from "../auth.js";
import type * as candidateEvidence from "../candidateEvidence.js";
import type * as checkratelimit from "../checkratelimit.js";
import type * as clerk_webhook from "../clerk_webhook.js";
import type * as config_env from "../config/env.js";
import type * as config_monitoring from "../config/monitoring.js";
import type * as config_sentry from "../config/sentry.js";
import type * as createProposalPublic from "../createProposalPublic.js";
import type * as createUserFromClient from "../createUserFromClient.js";
import type * as deleteProposalPublic from "../deleteProposalPublic.js";
import type * as documentAssets from "../documentAssets.js";
import type * as functions from "../functions.js";
import type * as generateProposalMutation from "../generateProposalMutation.js";
import type * as http from "../http.js";
import type * as http_actions from "../http_actions.js";
import type * as ingestProfile from "../ingestProfile.js";
import type * as jobs from "../jobs.js";
import type * as jobsPublic from "../jobsPublic.js";
import type * as langchain_chains_base_chain from "../langchain/chains/base_chain.js";
import type * as langchain_chains_chain_factory from "../langchain/chains/chain_factory.js";
import type * as langchain_chains_creative_chain from "../langchain/chains/creative_chain.js";
import type * as langchain_chains_index from "../langchain/chains/index.js";
import type * as langchain_chains_technical_chain from "../langchain/chains/technical_chain.js";
import type * as langchain_index from "../langchain/index.js";
import type * as langchain_models_gpt4_adapter from "../langchain/models/gpt4_adapter.js";
import type * as langchain_models_index from "../langchain/models/index.js";
import type * as langchain_models_mistral_adapter from "../langchain/models/mistral_adapter.js";
import type * as langchain_models_model_adapter from "../langchain/models/model_adapter.js";
import type * as langchain_models_openai_compatible_chat_adapter from "../langchain/models/openai_compatible_chat_adapter.js";
import type * as langchain_models_openai_responses_adapter from "../langchain/models/openai_responses_adapter.js";
import type * as langchain_prompts_index from "../langchain/prompts/index.js";
import type * as langchain_prompts_manager from "../langchain/prompts/manager.js";
import type * as langchain_prompts_templates_index from "../langchain/prompts/templates/index.js";
import type * as langchain_prompts_templates_technical from "../langchain/prompts/templates/technical.js";
import type * as langchain_prompts_templates_version from "../langchain/prompts/templates/version.js";
import type * as langchain_prompts_templates from "../langchain/prompts/templates.js";
import type * as langchain_types from "../langchain/types.js";
import type * as langchain_utils_cache from "../langchain/utils/cache.js";
import type * as langchain_utils_index from "../langchain/utils/index.js";
import type * as langchain_utils_metrics from "../langchain/utils/metrics.js";
import type * as lib_applicationContextBuilder from "../lib/applicationContextBuilder.js";
import type * as lib_applicationHarness from "../lib/applicationHarness.js";
import type * as lib_applicationHarnessHashes from "../lib/applicationHarnessHashes.js";
import type * as lib_applicationPackages from "../lib/applicationPackages.js";
import type * as lib_candidateEvidence from "../lib/candidateEvidence.js";
import type * as lib_cvAiSuggestions from "../lib/cvAiSuggestions.js";
import type * as lib_documentAssets from "../lib/documentAssets.js";
import type * as lib_editorAi from "../lib/editorAi.js";
import type * as lib_editorAiJobContext from "../lib/editorAiJobContext.js";
import type * as lib_editorAiRulebook from "../lib/editorAiRulebook.js";
import type * as lib_embeddings_embedClient from "../lib/embeddings/embedClient.js";
import type * as lib_jobs_canonicalJobs from "../lib/jobs/canonicalJobs.js";
import type * as lib_jobs_jobExtractionSchema from "../lib/jobs/jobExtractionSchema.js";
import type * as lib_jobs_liveMatchReviewExport from "../lib/jobs/liveMatchReviewExport.js";
import type * as lib_jobs_llmExtractJob from "../lib/jobs/llmExtractJob.js";
import type * as lib_jobs_matchRead from "../lib/jobs/matchRead.js";
import type * as lib_jobs_matchReadSynthesis from "../lib/jobs/matchReadSynthesis.js";
import type * as lib_jobs_normalizeJobExtraction from "../lib/jobs/normalizeJobExtraction.js";
import type * as lib_jobs_structuredMatchRead from "../lib/jobs/structuredMatchRead.js";
import type * as lib_jobs_structuredMatchReview from "../lib/jobs/structuredMatchReview.js";
import type * as lib_jobs_telemetry from "../lib/jobs/telemetry.js";
import type * as lib_jobs_visibleJobExtraction from "../lib/jobs/visibleJobExtraction.js";
import type * as lib_liveExternalActionSafety from "../lib/liveExternalActionSafety.js";
import type * as lib_manualApplicationHandoff from "../lib/manualApplicationHandoff.js";
import type * as lib_parsing_adapters_CanonicalMapper from "../lib/parsing/adapters/CanonicalMapper.js";
import type * as lib_parsing_canonical from "../lib/parsing/canonical.js";
import type * as lib_parsing_canonicalize from "../lib/parsing/canonicalize.js";
import type * as lib_parsing_constants_nameStopwords from "../lib/parsing/constants/nameStopwords.js";
import type * as lib_parsing_contactExtractor from "../lib/parsing/contactExtractor.js";
import type * as lib_parsing_cvMapper from "../lib/parsing/cvMapper.js";
import type * as lib_parsing_enhancedParser from "../lib/parsing/enhancedParser.js";
import type * as lib_parsing_headingResolver from "../lib/parsing/headingResolver.js";
import type * as lib_parsing_hybridParser from "../lib/parsing/hybridParser.js";
import type * as lib_parsing_importRecovery from "../lib/parsing/importRecovery.js";
import type * as lib_parsing_languageNormalizer from "../lib/parsing/languageNormalizer.js";
import type * as lib_parsing_llmPostProcessor from "../lib/parsing/llmPostProcessor.js";
import type * as lib_parsing_llmPrompts from "../lib/parsing/llmPrompts.js";
import type * as lib_parsing_llmValidator from "../lib/parsing/llmValidator.js";
import type * as lib_parsing_mapping_utils from "../lib/parsing/mapping_utils.js";
import type * as lib_parsing_metadataExtractor from "../lib/parsing/metadataExtractor.js";
import type * as lib_parsing_normalize_cv from "../lib/parsing/normalize_cv.js";
import type * as lib_parsing_recoverySourceFilter from "../lib/parsing/recoverySourceFilter.js";
import type * as lib_parsing_skillUtils from "../lib/parsing/skillUtils.js";
import type * as lib_parsing_skillsCanonical from "../lib/parsing/skillsCanonical.js";
import type * as lib_parsing_strictProfileAdapter from "../lib/parsing/strictProfileAdapter.js";
import type * as lib_parsing_shared_api from "../lib/parsing_shared/api.js";
import type * as lib_parsing_shared_contactHeuristics from "../lib/parsing_shared/contactHeuristics.js";
import type * as lib_parsing_shared_engine from "../lib/parsing_shared/engine.js";
import type * as lib_parsing_shared_index from "../lib/parsing_shared/index.js";
import type * as lib_parsing_shared_nerClient from "../lib/parsing_shared/nerClient.js";
import type * as lib_parsing_shared_providers from "../lib/parsing_shared/providers.js";
import type * as lib_parsing_shared_repair from "../lib/parsing_shared/repair.js";
import type * as lib_parsing_shared_sectionSplitter from "../lib/parsing_shared/sectionSplitter.js";
import type * as lib_parsing_shared_utils from "../lib/parsing_shared/utils.js";
import type * as lib_proposals_autoToneSelector from "../lib/proposals/autoToneSelector.js";
import type * as lib_proposals_companyValues from "../lib/proposals/companyValues.js";
import type * as lib_proposals_coverLetterEvaluation from "../lib/proposals/coverLetterEvaluation.js";
import type * as lib_proposals_coverLetterPolicyCandidate from "../lib/proposals/coverLetterPolicyCandidate.js";
import type * as lib_proposals_effectiveTone from "../lib/proposals/effectiveTone.js";
import type * as lib_proposals_generationControls from "../lib/proposals/generationControls.js";
import type * as lib_proposals_premiumCoverLetter from "../lib/proposals/premiumCoverLetter.js";
import type * as lib_proposals_proposalBodyComposer from "../lib/proposals/proposalBodyComposer.js";
import type * as lib_proposals_proposalContentPlan from "../lib/proposals/proposalContentPlan.js";
import type * as lib_proposals_proposalCriteriaAudit from "../lib/proposals/proposalCriteriaAudit.js";
import type * as lib_proposals_proposalEnforcement from "../lib/proposals/proposalEnforcement.js";
import type * as lib_proposals_proposalOutput from "../lib/proposals/proposalOutput.js";
import type * as lib_proposals_proposalPlanner from "../lib/proposals/proposalPlanner.js";
import type * as lib_proposals_proposalQualityHarness from "../lib/proposals/proposalQualityHarness.js";
import type * as lib_proposals_proposalQualityMode from "../lib/proposals/proposalQualityMode.js";
import type * as lib_proposals_proposalRenderer from "../lib/proposals/proposalRenderer.js";
import type * as lib_proposals_renderTemplates from "../lib/proposals/renderTemplates.js";
import type * as lib_proposals_styleSuggestions from "../lib/proposals/styleSuggestions.js";
import type * as lib_proposals_voicePresets from "../lib/proposals/voicePresets.js";
import type * as lib_userProfileMetadata from "../lib/userProfileMetadata.js";
import type * as lib_userProfiles from "../lib/userProfiles.js";
import type * as lib_utils from "../lib/utils.js";
import type * as liveExternalActionSafety from "../liveExternalActionSafety.js";
import type * as llm from "../llm.js";
import type * as manualApplicationHandoff from "../manualApplicationHandoff.js";
import type * as mcpAccountLinks from "../mcpAccountLinks.js";
import type * as mcpApplicationPackageSummary from "../mcpApplicationPackageSummary.js";
import type * as mcpControlledSyntheticProof from "../mcpControlledSyntheticProof.js";
import type * as mcpEvidenceGraphSummary from "../mcpEvidenceGraphSummary.js";
import type * as mcpOAuthAuthorizationCodes from "../mcpOAuthAuthorizationCodes.js";
import type * as mcpOAuthAuthorizationIntents from "../mcpOAuthAuthorizationIntents.js";
import type * as mcpOAuthPreAuthIntents from "../mcpOAuthPreAuthIntents.js";
import type * as mcpOAuthPreAuthOwnerBinding from "../mcpOAuthPreAuthOwnerBinding.js";
import type * as mcpReadOnlyTwoweeksDataRefs from "../mcpReadOnlyTwoweeksDataRefs.js";
import type * as mcpReadSideMaterialization from "../mcpReadSideMaterialization.js";
import type * as mcpResumeVariantPlanSummary from "../mcpResumeVariantPlanSummary.js";
import type * as mcpReviewCockpitSummary from "../mcpReviewCockpitSummary.js";
import type * as metrics from "../metrics.js";
import type * as migrations from "../migrations.js";
import type * as model_metrics from "../model/metrics.js";
import type * as model_monitoring from "../model/monitoring.js";
import type * as monitoring from "../monitoring.js";
import type * as mutations_refineField from "../mutations/refineField.js";
import type * as mutations_updateUserProfile from "../mutations/updateUserProfile.js";
import type * as mutations_upsertProfile from "../mutations/upsertProfile.js";
import type * as parsePdf from "../parsePdf.js";
import type * as populateDisplayName from "../populateDisplayName.js";
import type * as profiles from "../profiles.js";
import type * as profilesPublic from "../profilesPublic.js";
import type * as proposalHandoffs from "../proposalHandoffs.js";
import type * as proposalSettings from "../proposalSettings.js";
import type * as proposals from "../proposals.js";
import type * as proposalsCountPublic from "../proposalsCountPublic.js";
import type * as proposalsPublic from "../proposalsPublic.js";
import type * as queries_getLatestCV from "../queries/getLatestCV.js";
import type * as queries_getProfileCount from "../queries/getProfileCount.js";
import type * as saveJobAndProposal from "../saveJobAndProposal.js";
import type * as scheduler from "../scheduler.js";
import type * as sync from "../sync.js";
import type * as test_generate_http from "../test_generate_http.js";
import type * as types_index from "../types/index.js";
import type * as types_metrics from "../types/metrics.js";
import type * as types_monitoring from "../types/monitoring.js";
import type * as types_validators from "../types/validators.js";
import type * as updateProposalPublic from "../updateProposalPublic.js";
import type * as users from "../users.js";
import type * as utils_auth from "../utils/auth.js";
import type * as utils_cv_parser from "../utils/cv_parser.js";
import type * as utils_error from "../utils/error.js";
import type * as utils_parseHelpers from "../utils/parseHelpers.js";
import type * as utils_types from "../utils/types.js";
import type * as utils_validation from "../utils/validation.js";
import type * as utils_validators from "../utils/validators.js";
import type * as workerGateway from "../workerGateway.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "actions/_probeMistral": typeof actions__probeMistral;
  "actions/extractProfileStrict": typeof actions_extractProfileStrict;
  "actions/extractProfileStrictWithSpans": typeof actions_extractProfileStrictWithSpans;
  "actions/formatCompleteCV": typeof actions_formatCompleteCV;
  "actions/nerSmokeTest": typeof actions_nerSmokeTest;
  "actions/persistProfile": typeof actions_persistProfile;
  "actions/structuredUpload": typeof actions_structuredUpload;
  "actions/uploads": typeof actions_uploads;
  activeCvSnapshots: typeof activeCvSnapshots;
  alerts: typeof alerts;
  analytics: typeof analytics;
  applicationContextBuilder: typeof applicationContextBuilder;
  applicationHarness: typeof applicationHarness;
  applicationPackages: typeof applicationPackages;
  auth: typeof auth;
  candidateEvidence: typeof candidateEvidence;
  checkratelimit: typeof checkratelimit;
  clerk_webhook: typeof clerk_webhook;
  "config/env": typeof config_env;
  "config/monitoring": typeof config_monitoring;
  "config/sentry": typeof config_sentry;
  createProposalPublic: typeof createProposalPublic;
  createUserFromClient: typeof createUserFromClient;
  deleteProposalPublic: typeof deleteProposalPublic;
  documentAssets: typeof documentAssets;
  functions: typeof functions;
  generateProposalMutation: typeof generateProposalMutation;
  http: typeof http;
  http_actions: typeof http_actions;
  ingestProfile: typeof ingestProfile;
  jobs: typeof jobs;
  jobsPublic: typeof jobsPublic;
  "langchain/chains/base_chain": typeof langchain_chains_base_chain;
  "langchain/chains/chain_factory": typeof langchain_chains_chain_factory;
  "langchain/chains/creative_chain": typeof langchain_chains_creative_chain;
  "langchain/chains/index": typeof langchain_chains_index;
  "langchain/chains/technical_chain": typeof langchain_chains_technical_chain;
  "langchain/index": typeof langchain_index;
  "langchain/models/gpt4_adapter": typeof langchain_models_gpt4_adapter;
  "langchain/models/index": typeof langchain_models_index;
  "langchain/models/mistral_adapter": typeof langchain_models_mistral_adapter;
  "langchain/models/model_adapter": typeof langchain_models_model_adapter;
  "langchain/models/openai_compatible_chat_adapter": typeof langchain_models_openai_compatible_chat_adapter;
  "langchain/models/openai_responses_adapter": typeof langchain_models_openai_responses_adapter;
  "langchain/prompts/index": typeof langchain_prompts_index;
  "langchain/prompts/manager": typeof langchain_prompts_manager;
  "langchain/prompts/templates/index": typeof langchain_prompts_templates_index;
  "langchain/prompts/templates/technical": typeof langchain_prompts_templates_technical;
  "langchain/prompts/templates/version": typeof langchain_prompts_templates_version;
  "langchain/prompts/templates": typeof langchain_prompts_templates;
  "langchain/types": typeof langchain_types;
  "langchain/utils/cache": typeof langchain_utils_cache;
  "langchain/utils/index": typeof langchain_utils_index;
  "langchain/utils/metrics": typeof langchain_utils_metrics;
  "lib/applicationContextBuilder": typeof lib_applicationContextBuilder;
  "lib/applicationHarness": typeof lib_applicationHarness;
  "lib/applicationHarnessHashes": typeof lib_applicationHarnessHashes;
  "lib/applicationPackages": typeof lib_applicationPackages;
  "lib/candidateEvidence": typeof lib_candidateEvidence;
  "lib/cvAiSuggestions": typeof lib_cvAiSuggestions;
  "lib/documentAssets": typeof lib_documentAssets;
  "lib/editorAi": typeof lib_editorAi;
  "lib/editorAiJobContext": typeof lib_editorAiJobContext;
  "lib/editorAiRulebook": typeof lib_editorAiRulebook;
  "lib/embeddings/embedClient": typeof lib_embeddings_embedClient;
  "lib/jobs/canonicalJobs": typeof lib_jobs_canonicalJobs;
  "lib/jobs/jobExtractionSchema": typeof lib_jobs_jobExtractionSchema;
  "lib/jobs/liveMatchReviewExport": typeof lib_jobs_liveMatchReviewExport;
  "lib/jobs/llmExtractJob": typeof lib_jobs_llmExtractJob;
  "lib/jobs/matchRead": typeof lib_jobs_matchRead;
  "lib/jobs/matchReadSynthesis": typeof lib_jobs_matchReadSynthesis;
  "lib/jobs/normalizeJobExtraction": typeof lib_jobs_normalizeJobExtraction;
  "lib/jobs/structuredMatchRead": typeof lib_jobs_structuredMatchRead;
  "lib/jobs/structuredMatchReview": typeof lib_jobs_structuredMatchReview;
  "lib/jobs/telemetry": typeof lib_jobs_telemetry;
  "lib/jobs/visibleJobExtraction": typeof lib_jobs_visibleJobExtraction;
  "lib/liveExternalActionSafety": typeof lib_liveExternalActionSafety;
  "lib/manualApplicationHandoff": typeof lib_manualApplicationHandoff;
  "lib/parsing/adapters/CanonicalMapper": typeof lib_parsing_adapters_CanonicalMapper;
  "lib/parsing/canonical": typeof lib_parsing_canonical;
  "lib/parsing/canonicalize": typeof lib_parsing_canonicalize;
  "lib/parsing/constants/nameStopwords": typeof lib_parsing_constants_nameStopwords;
  "lib/parsing/contactExtractor": typeof lib_parsing_contactExtractor;
  "lib/parsing/cvMapper": typeof lib_parsing_cvMapper;
  "lib/parsing/enhancedParser": typeof lib_parsing_enhancedParser;
  "lib/parsing/headingResolver": typeof lib_parsing_headingResolver;
  "lib/parsing/hybridParser": typeof lib_parsing_hybridParser;
  "lib/parsing/importRecovery": typeof lib_parsing_importRecovery;
  "lib/parsing/languageNormalizer": typeof lib_parsing_languageNormalizer;
  "lib/parsing/llmPostProcessor": typeof lib_parsing_llmPostProcessor;
  "lib/parsing/llmPrompts": typeof lib_parsing_llmPrompts;
  "lib/parsing/llmValidator": typeof lib_parsing_llmValidator;
  "lib/parsing/mapping_utils": typeof lib_parsing_mapping_utils;
  "lib/parsing/metadataExtractor": typeof lib_parsing_metadataExtractor;
  "lib/parsing/normalize_cv": typeof lib_parsing_normalize_cv;
  "lib/parsing/recoverySourceFilter": typeof lib_parsing_recoverySourceFilter;
  "lib/parsing/skillUtils": typeof lib_parsing_skillUtils;
  "lib/parsing/skillsCanonical": typeof lib_parsing_skillsCanonical;
  "lib/parsing/strictProfileAdapter": typeof lib_parsing_strictProfileAdapter;
  "lib/parsing_shared/api": typeof lib_parsing_shared_api;
  "lib/parsing_shared/contactHeuristics": typeof lib_parsing_shared_contactHeuristics;
  "lib/parsing_shared/engine": typeof lib_parsing_shared_engine;
  "lib/parsing_shared/index": typeof lib_parsing_shared_index;
  "lib/parsing_shared/nerClient": typeof lib_parsing_shared_nerClient;
  "lib/parsing_shared/providers": typeof lib_parsing_shared_providers;
  "lib/parsing_shared/repair": typeof lib_parsing_shared_repair;
  "lib/parsing_shared/sectionSplitter": typeof lib_parsing_shared_sectionSplitter;
  "lib/parsing_shared/utils": typeof lib_parsing_shared_utils;
  "lib/proposals/autoToneSelector": typeof lib_proposals_autoToneSelector;
  "lib/proposals/companyValues": typeof lib_proposals_companyValues;
  "lib/proposals/coverLetterEvaluation": typeof lib_proposals_coverLetterEvaluation;
  "lib/proposals/coverLetterPolicyCandidate": typeof lib_proposals_coverLetterPolicyCandidate;
  "lib/proposals/effectiveTone": typeof lib_proposals_effectiveTone;
  "lib/proposals/generationControls": typeof lib_proposals_generationControls;
  "lib/proposals/premiumCoverLetter": typeof lib_proposals_premiumCoverLetter;
  "lib/proposals/proposalBodyComposer": typeof lib_proposals_proposalBodyComposer;
  "lib/proposals/proposalContentPlan": typeof lib_proposals_proposalContentPlan;
  "lib/proposals/proposalCriteriaAudit": typeof lib_proposals_proposalCriteriaAudit;
  "lib/proposals/proposalEnforcement": typeof lib_proposals_proposalEnforcement;
  "lib/proposals/proposalOutput": typeof lib_proposals_proposalOutput;
  "lib/proposals/proposalPlanner": typeof lib_proposals_proposalPlanner;
  "lib/proposals/proposalQualityHarness": typeof lib_proposals_proposalQualityHarness;
  "lib/proposals/proposalQualityMode": typeof lib_proposals_proposalQualityMode;
  "lib/proposals/proposalRenderer": typeof lib_proposals_proposalRenderer;
  "lib/proposals/renderTemplates": typeof lib_proposals_renderTemplates;
  "lib/proposals/styleSuggestions": typeof lib_proposals_styleSuggestions;
  "lib/proposals/voicePresets": typeof lib_proposals_voicePresets;
  "lib/userProfileMetadata": typeof lib_userProfileMetadata;
  "lib/userProfiles": typeof lib_userProfiles;
  "lib/utils": typeof lib_utils;
  liveExternalActionSafety: typeof liveExternalActionSafety;
  llm: typeof llm;
  manualApplicationHandoff: typeof manualApplicationHandoff;
  mcpAccountLinks: typeof mcpAccountLinks;
  mcpApplicationPackageSummary: typeof mcpApplicationPackageSummary;
  mcpControlledSyntheticProof: typeof mcpControlledSyntheticProof;
  mcpEvidenceGraphSummary: typeof mcpEvidenceGraphSummary;
  mcpOAuthAuthorizationCodes: typeof mcpOAuthAuthorizationCodes;
  mcpOAuthAuthorizationIntents: typeof mcpOAuthAuthorizationIntents;
  mcpOAuthPreAuthIntents: typeof mcpOAuthPreAuthIntents;
  mcpOAuthPreAuthOwnerBinding: typeof mcpOAuthPreAuthOwnerBinding;
  mcpReadOnlyTwoweeksDataRefs: typeof mcpReadOnlyTwoweeksDataRefs;
  mcpReadSideMaterialization: typeof mcpReadSideMaterialization;
  mcpResumeVariantPlanSummary: typeof mcpResumeVariantPlanSummary;
  mcpReviewCockpitSummary: typeof mcpReviewCockpitSummary;
  metrics: typeof metrics;
  migrations: typeof migrations;
  "model/metrics": typeof model_metrics;
  "model/monitoring": typeof model_monitoring;
  monitoring: typeof monitoring;
  "mutations/refineField": typeof mutations_refineField;
  "mutations/updateUserProfile": typeof mutations_updateUserProfile;
  "mutations/upsertProfile": typeof mutations_upsertProfile;
  parsePdf: typeof parsePdf;
  populateDisplayName: typeof populateDisplayName;
  profiles: typeof profiles;
  profilesPublic: typeof profilesPublic;
  proposalHandoffs: typeof proposalHandoffs;
  proposalSettings: typeof proposalSettings;
  proposals: typeof proposals;
  proposalsCountPublic: typeof proposalsCountPublic;
  proposalsPublic: typeof proposalsPublic;
  "queries/getLatestCV": typeof queries_getLatestCV;
  "queries/getProfileCount": typeof queries_getProfileCount;
  saveJobAndProposal: typeof saveJobAndProposal;
  scheduler: typeof scheduler;
  sync: typeof sync;
  test_generate_http: typeof test_generate_http;
  "types/index": typeof types_index;
  "types/metrics": typeof types_metrics;
  "types/monitoring": typeof types_monitoring;
  "types/validators": typeof types_validators;
  updateProposalPublic: typeof updateProposalPublic;
  users: typeof users;
  "utils/auth": typeof utils_auth;
  "utils/cv_parser": typeof utils_cv_parser;
  "utils/error": typeof utils_error;
  "utils/parseHelpers": typeof utils_parseHelpers;
  "utils/types": typeof utils_types;
  "utils/validation": typeof utils_validation;
  "utils/validators": typeof utils_validators;
  workerGateway: typeof workerGateway;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: {
    lib: {
      checkRateLimit: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
      getValue: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          key?: string;
          name: string;
          sampleShards?: number;
        },
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          shard: number;
          ts: number;
          value: number;
        }
      >;
      rateLimit: FunctionReference<
        "mutation",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      resetRateLimit: FunctionReference<
        "mutation",
        "internal",
        { key?: string; name: string },
        null
      >;
    };
    time: {
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
    };
  };
  migrations: {
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { name: string },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
      cancelAll: FunctionReference<
        "mutation",
        "internal",
        { sinceTs?: number },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { limit?: number; names?: Array<string> },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      migrate: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun: boolean;
          fnHandle: string;
          name: string;
          next?: Array<{ fnHandle: string; name: string }>;
        },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
    };
  };
};
