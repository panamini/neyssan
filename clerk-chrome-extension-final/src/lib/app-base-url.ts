const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const CANONICAL_LOCAL_APP_ORIGIN = "http://localhost:5173";
const CANONICAL_LOCAL_SYNC_HOST = "http://localhost";
const ALLOWED_APP_PROTOCOLS = new Set(["http:", "https:"]);

function normalizeLoopbackOrigin(url: URL, localOrigin: string): string {
  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    return url.origin;
  }

  return localOrigin;
}

export function resolveAppBaseUrl(rawValue?: string | null): string {
  const candidate = (rawValue || "").trim();

  if (candidate) {
    try {
      const url = new URL(candidate);
      if (!ALLOWED_APP_PROTOCOLS.has(url.protocol)) {
        return CANONICAL_LOCAL_APP_ORIGIN;
      }
      const origin = normalizeLoopbackOrigin(url, CANONICAL_LOCAL_APP_ORIGIN);
      const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
      return `${origin}${pathname}`.replace(/\/+$/, "");
    } catch {
      // Fall through to canonical local default.
    }
  }

  return CANONICAL_LOCAL_APP_ORIGIN;
}

export function resolveSyncHost(rawValue?: string | null): string {
  const candidate = (rawValue || "").trim();

  if (candidate) {
    try {
      const url = new URL(candidate);
      if (!ALLOWED_APP_PROTOCOLS.has(url.protocol)) {
        return CANONICAL_LOCAL_SYNC_HOST;
      }
      return normalizeLoopbackOrigin(url, CANONICAL_LOCAL_SYNC_HOST);
    } catch {
      // Fall through to canonical local default.
    }
  }

  return CANONICAL_LOCAL_SYNC_HOST;
}

export function buildAppUrl(pathname: string, rawValue?: string | null): string {
  const baseUrl = resolveAppBaseUrl(rawValue);
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${baseUrl}${normalizedPath}`;
}
