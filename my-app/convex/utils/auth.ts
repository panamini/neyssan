export interface AuthResult {
  isAuthorized: boolean;
  error?: string;
}

export function validateMetricsToken(token: string | null): AuthResult {
  if (!token) {
    return {
      isAuthorized: false,
      error: "Missing authorization token"
    };
  }

  const validToken = process.env["METRICS_SCRAPE_TOKEN"];
  if (!validToken) {
    return {
      isAuthorized: false,
      error: "Metrics scrape token not configured"
    };
  }

  return {
    isAuthorized: token === validToken
  };
}
