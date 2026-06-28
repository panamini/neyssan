export const DEFAULT_SIGN_IN_RETURN_PATH = "/cv";
export const MCP_OAUTH_SIGN_IN_RETURN_PARAMETER = "mcp_oauth_return";
export const MCP_OAUTH_CONTINUATION_PATH = "/mcp/oauth/authorize/continue";
export const MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER = "mcp_oauth_intent";
export const MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER = "mcp_oauth_browser_nonce";

const MAX_RETURN_PATH_LENGTH = 2048;
const MAX_INTENT_HANDLE_LENGTH = 256;
const INTENT_HANDLE_PATTERN = /^[A-Za-z0-9_-]+$/u;
const BROWSER_NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const LOCAL_ORIGIN = "https://twoweeks.local";

type SignInReturnSource = "default" | "mcp_oauth_continuation";

export type SignInReturnResolution = Readonly<{
  path: string;
  source: SignInReturnSource;
}>;

export function resolveSignInReturnPath(search: string): SignInReturnResolution {
  const params = new URLSearchParams(search);
  const returnValues = params.getAll(MCP_OAUTH_SIGN_IN_RETURN_PARAMETER);

  if (returnValues.length !== 1) {
    return defaultSignInReturn();
  }

  const candidate = returnValues[0];
  if (!isAllowedMcpOAuthContinuationPath(candidate)) {
    return defaultSignInReturn();
  }

  return {
    path: canonicalizeMcpOAuthContinuationPath(candidate),
    source: "mcp_oauth_continuation",
  };
}

function defaultSignInReturn(): SignInReturnResolution {
  return {
    path: DEFAULT_SIGN_IN_RETURN_PATH,
    source: "default",
  };
}

function isAllowedMcpOAuthContinuationPath(candidate: string): boolean {
  if (
    candidate.length === 0 ||
    candidate.length > MAX_RETURN_PATH_LENGTH ||
    candidate.includes("\0") ||
    candidate.includes("\\") ||
    candidate.includes("#") ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//")
  ) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(candidate, LOCAL_ORIGIN);
  } catch {
    return false;
  }

  const queryStart = candidate.indexOf("?");
  const rawPath = queryStart === -1 ? candidate : candidate.slice(0, queryStart);

  if (
    url.origin !== LOCAL_ORIGIN ||
    url.pathname !== MCP_OAUTH_CONTINUATION_PATH ||
    rawPath !== MCP_OAUTH_CONTINUATION_PATH
  ) {
    return false;
  }

  const searchParams = [...url.searchParams.keys()];
  if (
    (searchParams.length !== 1 && searchParams.length !== 2) ||
    searchParams[0] !== MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER ||
    (searchParams.length === 2 && searchParams[1] !== MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER) ||
    url.searchParams.getAll(MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER).length !== 1 ||
    url.searchParams.getAll(MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER).length > 1
  ) {
    return false;
  }

  const intentHandle = url.searchParams.get(MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER);
  const browserNonce = url.searchParams.get(MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER);
  return (
    intentHandle !== null &&
    intentHandle.length > 0 &&
    intentHandle.length <= MAX_INTENT_HANDLE_LENGTH &&
    INTENT_HANDLE_PATTERN.test(intentHandle) &&
    (browserNonce === null || BROWSER_NONCE_PATTERN.test(browserNonce))
  );
}

function canonicalizeMcpOAuthContinuationPath(candidate: string): string {
  const url = new URL(candidate, LOCAL_ORIGIN);
  const intentHandle = url.searchParams.get(MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER) ?? "";
  const browserNonce = url.searchParams.get(MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER);
  const params = new URLSearchParams({
    [MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER]: intentHandle,
  });
  if (browserNonce !== null) {
    params.set(MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER, browserNonce);
  }

  return `${MCP_OAUTH_CONTINUATION_PATH}?${params.toString()}`;
}
