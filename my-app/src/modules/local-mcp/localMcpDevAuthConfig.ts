import {
  buildFutureTwoweeksApplicationsReadSecuritySchemes,
  buildProtectedResourceMetadata,
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpFutureApplicationsReadSecuritySchemeV1,
  type McpProtectedResourceMetadataV1,
  type TwoweeksApplicationsReadScopeV1,
} from "./mcpAuthPolicyBoundary";

export type LocalMcpDevAuthConfigInputV1 = Readonly<{
  enabled?: boolean;
  resourceUrl?: string;
  authorizationServerIssuerUrl?: string;
  providerEnvironment?: string;
  allowedClientIds?: readonly string[];
}>;

export type LocalMcpDevAuthConfigV1 = Readonly<{
  kind: "local_mcp_dev_auth_config";
  enabled: true;
  resourceUrl: string;
  authorizationServerIssuerUrl: string;
  protectedResourceMetadataUrl: string;
  providerEnvironment: string;
  allowedClientIds: readonly string[];
  requiredScope: TwoweeksApplicationsReadScopeV1;
  localDevOnly: true;
  fixtureOnly: true;
  version: 1;
}>;

type ToolDescriptorWithAuthSecuritySchemesV1 = Readonly<Record<string, unknown>> & {
  securitySchemes: readonly [McpFutureApplicationsReadSecuritySchemeV1];
  _meta: Readonly<{
    securitySchemes: readonly [McpFutureApplicationsReadSecuritySchemeV1];
  }>;
};

const WELL_KNOWN_PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";
const SAFE_ENV_VALUE_PATTERN = /^[A-Za-z0-9._:-]+$/u;

export function buildLocalMcpDevAuthConfig(
  input: LocalMcpDevAuthConfigInputV1 = {},
): LocalMcpDevAuthConfigV1 | undefined {
  if (input.enabled !== true) return undefined;

  try {
    const resourceUrl = parseCanonicalHttpsUrl(input.resourceUrl, "resource URL");
    const authorizationServerIssuerUrl = parseCanonicalHttpsUrl(
      input.authorizationServerIssuerUrl,
      "authorization server issuer URL",
    );
    const protectedResourceMetadataUrl = buildProtectedResourceMetadataUrl(resourceUrl);
    const providerEnvironment = parseSafeTokenLikeValue(input.providerEnvironment, "provider environment");
    const allowedClientIds = Object.freeze(
      (input.allowedClientIds ?? [])
        .map((clientId) => parseSafeTokenLikeValue(clientId, "allowed client ID"))
        .filter((clientId, index, values) => values.indexOf(clientId) === index),
    );

    const config: LocalMcpDevAuthConfigV1 = Object.freeze({
      kind: "local_mcp_dev_auth_config",
      enabled: true,
      resourceUrl,
      authorizationServerIssuerUrl,
      protectedResourceMetadataUrl,
      providerEnvironment,
      allowedClientIds,
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      localDevOnly: true,
      fixtureOnly: true,
      version: 1,
    });

    buildLocalMcpDevProtectedResourceMetadata(config);
    return config;
  } catch {
    return undefined;
  }
}

export function buildLocalMcpDevProtectedResourceMetadata(
  config: LocalMcpDevAuthConfigV1,
): McpProtectedResourceMetadataV1 {
  return buildProtectedResourceMetadata({
    resourceUrl: config.resourceUrl,
    protectedResourceMetadataUrl: config.protectedResourceMetadataUrl,
    authorizationServerIssuerUrl: config.authorizationServerIssuerUrl,
    supportedScopes: [config.requiredScope],
  });
}

export function isLocalMcpDevProtectedResourceMetadataPath(path: string): boolean {
  return path === WELL_KNOWN_PROTECTED_RESOURCE_PATH || path === `${WELL_KNOWN_PROTECTED_RESOURCE_PATH}/mcp`;
}

export function applyLocalMcpDevAuthSecuritySchemesToToolsListFixture<T extends Readonly<Record<string, unknown>>>(
  toolsListFixture: T,
): T & Readonly<{ tools: readonly ToolDescriptorWithAuthSecuritySchemesV1[] }> {
  const tools = toolsListFixture.tools;
  if (!Array.isArray(tools)) {
    throw new TypeError("Local MCP tools/list fixture must include tools.");
  }

  const securedTools = Object.freeze(
    tools.map((tool) => {
      if (!isPlainRecord(tool)) throw new TypeError("Local MCP tool descriptor must be an object.");
      const securitySchemes = buildFutureTwoweeksApplicationsReadSecuritySchemes();
      const existingMeta = isPlainRecord(tool._meta) ? tool._meta : undefined;
      return Object.freeze({
        ...tool,
        securitySchemes,
        _meta: Object.freeze({
          ...(existingMeta ?? {}),
          securitySchemes,
        }),
      });
    }),
  );

  return Object.freeze({
    ...toolsListFixture,
    tools: securedTools,
  });
}

function buildProtectedResourceMetadataUrl(resourceUrl: string): string {
  const resource = new URL(resourceUrl);
  const resourcePath = canonicalResourcePath(resource.pathname);
  return `${resource.origin}${WELL_KNOWN_PROTECTED_RESOURCE_PATH}${resourcePath === "/" ? "" : resourcePath}`;
}

function parseCanonicalHttpsUrl(value: unknown, label: string): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new TypeError(`${label} must not be empty.`);

  const parsed = new URL(trimmed);
  if (parsed.protocol !== "https:") throw new TypeError(`${label} must use HTTPS.`);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError(`${label} must not contain credentials, query, or fragment.`);
  }
  if (!parsed.hostname || parsed.hostname.includes("*")) {
    throw new TypeError(`${label} must not use wildcard hosts.`);
  }

  parsed.pathname = canonicalResourcePath(parsed.pathname);
  return parsed.toString();
}

function canonicalResourcePath(path: string): string {
  const normalized = path.replace(/\/+$/u, "");
  return normalized.length === 0 ? "/" : normalized;
}

function parseSafeTokenLikeValue(value: unknown, label: string): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 256) throw new TypeError(`${label} length is invalid.`);
  if (trimmed.includes("*") || !SAFE_ENV_VALUE_PATTERN.test(trimmed)) {
    throw new TypeError(`${label} contains unsafe characters.`);
  }
  return trimmed;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
