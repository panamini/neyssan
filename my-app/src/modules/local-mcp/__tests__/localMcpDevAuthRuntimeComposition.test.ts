import { generateKeyPairSync } from "node:crypto";
import type { JWK, JSONWebKeySet } from "jose";
import { describe, expect, it } from "vitest";
import {
  buildLocalMcpDevAuthRuntimeCompositionDependencies,
  LOCAL_MCP_DEV_STYTCH_JWKS_JSON_MAX_BYTES,
  LOCAL_MCP_DEV_STYTCH_JWKS_MAX_KEYS,
  parseLocalMcpDevPublicJwks,
} from "../localMcpDevAuthRuntimeComposition";

const RESOURCE = "https://mcp.example.test/mcp";
const ISSUER = "https://connected-apps.stytch.example.test/oauth";
const PROVIDER_ENVIRONMENT = "stytch-test-environment";
const CLIENT_ID = "chatgpt-apps-sdk-client";

describe("local MCP dev auth runtime composition", () => {
  it.each([
    ["all flags off", false, false, false, false],
    ["endpoint missing", false, true, true, true],
    ["fixture missing", true, false, true, true],
    ["auth policy missing", true, true, false, true],
    ["composition missing", true, true, true, false],
  ] as const)("does not parse or build when disabled: %s", (_label, endpointEnabled, fixtureDemoEnabled, authPolicyEnabled, compositionEnabled) => {
    const result = buildLocalMcpDevAuthRuntimeCompositionDependencies({
      endpointEnabled,
      fixtureDemoEnabled,
      authPolicyEnabled,
      compositionEnabled,
      authConfigInput: authConfigInput(),
      jwksJson: "not-json-and-should-not-be-read",
    });

    expect(result).toMatchObject({
      enabled: false,
      reason: "disabled",
      parsedJwks: false,
      builtComposition: false,
      dependencies: {},
    });
  });

  it.each([
    ["missing", undefined, "jwks_unavailable"],
    ["blank", "  ", "jwks_unavailable"],
    ["malformed JSON", "{", "jwks_malformed"],
    ["oversized", JSON.stringify({ keys: [{ kty: "RSA", kid: "k", n: "a".repeat(LOCAL_MCP_DEV_STYTCH_JWKS_JSON_MAX_BYTES), e: "AQAB" }] }), "jwks_malformed"],
    ["non-object", "[]", "jwks_malformed"],
    ["empty keys", JSON.stringify({ keys: [] }), "jwks_malformed"],
    ["too many keys", JSON.stringify({ keys: Array.from({ length: LOCAL_MCP_DEV_STYTCH_JWKS_MAX_KEYS + 1 }, (_, index) => rsaJwk(`kid-${index}`)) }), "jwks_malformed"],
    ["private key member", JSON.stringify({ keys: [{ ...rsaJwk("private-kid"), d: "raw-private-key-material" }] }), "jwks_malformed"],
    ["non-RSA key", JSON.stringify({ keys: [{ kty: "EC", kid: "ec-kid", crv: "P-256" }] }), "jwks_malformed"],
    ["missing kid", JSON.stringify({ keys: [{ kty: "RSA", n: "abc", e: "AQAB" }] }), "jwks_malformed"],
    ["duplicate kid", JSON.stringify({ keys: [rsaJwk("dup"), rsaJwk("dup")] }), "jwks_malformed"],
  ] as const)("fails closed for invalid JWKS: %s", (_label, jwksJson, reason) => {
    const result = buildLocalMcpDevAuthRuntimeCompositionDependencies({
      endpointEnabled: true,
      fixtureDemoEnabled: true,
      authPolicyEnabled: true,
      compositionEnabled: true,
      authConfigInput: authConfigInput(),
      jwksJson,
    });

    expect(result).toMatchObject({
      enabled: false,
      reason,
      dependencies: {},
    });
    expect(JSON.stringify(result)).not.toContain("raw-private-key-material");
    expect(JSON.stringify(result)).not.toContain("private-kid");
  });

  it("configures verifier and no-link lookup once for valid public JWKS", async () => {
    const result = buildLocalMcpDevAuthRuntimeCompositionDependencies({
      endpointEnabled: true,
      fixtureDemoEnabled: true,
      authPolicyEnabled: true,
      compositionEnabled: true,
      authConfigInput: authConfigInput(),
      jwksJson: JSON.stringify(buildFixtureJwks()),
    });

    expect(result).toMatchObject({
      enabled: true,
      reason: "configured",
      parsedJwks: true,
      builtComposition: true,
    });
    if (!result.enabled) throw new Error("expected configured runtime composition");
    expect(typeof result.dependencies.tokenVerifier).toBe("function");
    expect(typeof result.dependencies.accountLinkLookup).toBe("function");
    await expect(
      result.dependencies.accountLinkLookup({
        issuer: ISSUER,
        subject: "subject",
        providerEnvironment: PROVIDER_ENVIRONMENT,
        version: 1,
      }),
    ).resolves.toEqual([]);
  });

  it("defensively copies accepted JWKS without returning raw key material in failures", () => {
    const source = buildFixtureJwks();
    const parsed = parseLocalMcpDevPublicJwks(JSON.stringify(source));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("expected parsed JWKS");

    (source.keys[0] as Record<string, unknown>).kid = "mutated";
    expect(parsed.jwks.keys[0]?.kid).toBe("runtime-key");
    expect(Object.isFrozen(parsed.jwks)).toBe(true);
    expect(Object.isFrozen(parsed.jwks.keys)).toBe(true);
    expect(Object.isFrozen(parsed.jwks.keys[0])).toBe(true);
  });
});

function authConfigInput() {
  return {
    resourceUrl: RESOURCE,
    authorizationServerIssuerUrl: ISSUER,
    providerEnvironment: PROVIDER_ENVIRONMENT,
    allowedClientIds: [CLIENT_ID],
  };
}

function buildFixtureJwks(): JSONWebKeySet {
  return { keys: [rsaJwk("runtime-key")] };
}

function rsaJwk(kid: string): JWK {
  const keyPair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  return {
    ...(keyPair.publicKey.export({ format: "jwk" }) as JWK),
    kid,
    alg: "RS256",
    use: "sig",
  };
}
