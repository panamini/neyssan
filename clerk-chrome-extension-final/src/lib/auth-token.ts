type JwtPayload = {
  exp?: number;
};

export function parseAuthToken(token?: string | null): JwtPayload | null {
  if (!token) return null;

  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

export function isUsableAuthToken(token?: string | null, minValiditySeconds = 30): token is string {
  if (!token) return false;

  const decoded = parseAuthToken(token);
  if (!decoded || typeof decoded.exp !== "number") {
    return false;
  }

  return decoded.exp > Math.floor(Date.now() / 1000) + minValiditySeconds;
}
