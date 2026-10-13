import { createHash, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { AppError } from "./errors";
import { oauthSettings, publicBaseUrl, vercelDeploymentHosts } from "./config";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const windows = new Map<string, { count: number; expiresAt: number }>();

function equalToken(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export function validateRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const base = new URL(publicBaseUrl());
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const localPort = base.port ? `:${base.port}` : "";
  const allowedHosts = new Set([base.host, ...vercelDeploymentHosts(), ...(localHosts.has(base.hostname) ? [...localHosts].map(host => `${host}${localPort}`) : [])]);
  const host = request.headers.get("host") || requestUrl.host;
  if (!allowedHosts.has(host.toLowerCase()) || !allowedHosts.has(requestUrl.host.toLowerCase())) {
    throw new AppError("Host não autorizado. Verifique MCP_PUBLIC_URL.", "FORBIDDEN_HOST", 403);
  }
  const origin = request.headers.get("origin");
  const localOrigins = localHosts.has(base.hostname) ? [...localHosts].map(host => `${base.protocol}//${host}${localPort}`) : [];
  const allowedOrigins = new Set([base.origin, requestUrl.origin, ...localOrigins, ...(process.env.MCP_ALLOWED_ORIGINS || "").split(",").map(item => item.trim()).filter(Boolean)]);
  if (origin && !allowedOrigins.has(origin)) throw new AppError("Origem não autorizada.", "FORBIDDEN_ORIGIN", 403);
}

export async function authorizeRequest(request: Request) {
  validateRequestOrigin(request);
  const mode = process.env.MCP_AUTH_MODE || "bearer";
  if (!["bearer", "oauth", "both"].includes(mode)) throw new AppError("MCP_AUTH_MODE inválido.", "AUTH_NOT_CONFIGURED", 503);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const fixed = process.env.MCP_AUTH_TOKEN?.trim();
  const oauth = oauthSettings();
  if ((mode === "bearer" && !fixed) || (mode === "oauth" && !oauth) || (mode === "both" && !fixed && !oauth)) {
    throw new AppError("Configure a autenticação MCP no servidor.", "AUTH_NOT_CONFIGURED", 503);
  }
  if (!token || token.length > 8192) throw new AppError("Autenticação necessária.", "UNAUTHORIZED", 401);
  if (mode !== "oauth" && fixed && equalToken(token, fixed)) return "owner";
  if (mode !== "bearer" && oauth) {
    try {
      let keys = jwksCache.get(oauth.jwksUrl);
      if (!keys) {
        keys = createRemoteJWKSet(new URL(oauth.jwksUrl), { timeoutDuration: 10_000 });
        jwksCache.set(oauth.jwksUrl, keys);
      }
      const { payload } = await jwtVerify(token, keys, {
        issuer: oauth.issuer, audience: oauth.audience,
        algorithms: ["RS256", "ES256", "PS256"], requiredClaims: ["exp", "sub"],
      });
      const scopes = typeof payload.scope === "string" ? payload.scope.split(" ") : [];
      if (!oauth.scopes.every(scope => scopes.includes(scope))) throw new AppError("Permissão OAuth insuficiente.", "INSUFFICIENT_SCOPE", 403);
      const allowedSubjects = (process.env.MCP_OAUTH_ALLOWED_SUBJECTS || "").split(",").map(item => item.trim()).filter(Boolean);
      if (allowedSubjects.length && !allowedSubjects.includes(payload.sub!)) throw new AppError("Usuário OAuth não autorizado.", "FORBIDDEN_SUBJECT", 403);
      return payload.sub!;
    } catch (error) {
      if (error instanceof AppError) throw error;
    }
  }
  throw new AppError("Token inválido ou expirado.", "UNAUTHORIZED", 401);
}

export function rateLimit(subject: string) {
  const now = Date.now();
  for (const [key, entry] of windows) if (entry.expiresAt <= now) windows.delete(key);
  const key = createHash("sha256").update(subject).digest("hex");
  const entry = windows.get(key) || { count: 0, expiresAt: now + 60_000 };
  entry.count++;
  windows.set(key, entry);
  if (entry.count > 60) throw new AppError("Limite de 60 chamadas por minuto atingido.", "RATE_LIMITED", 429);
}

export function authHeaders(status: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (status === 429) headers["Retry-After"] = "60";
  if (status === 401 || status === 403) {
    const oauth = oauthSettings();
    headers["WWW-Authenticate"] = oauth
      ? `Bearer resource_metadata="${publicBaseUrl()}/.well-known/oauth-protected-resource/api/mcp", scope="${oauth.scopes.join(" ")}", error="${status === 403 ? "insufficient_scope" : "invalid_token"}"`
      : 'Bearer realm="serp-research-mcp"';
  }
  return headers;
}

export function protectedResourceMetadata() {
  const oauth = oauthSettings();
  if (!oauth) throw new AppError("OAuth ainda não configurado.", "OAUTH_NOT_CONFIGURED", 503);
  return {
    resource: `${publicBaseUrl()}/api/mcp`,
    resource_name: "SERP Research MCP",
    authorization_servers: [oauth.issuer],
    scopes_supported: oauth.scopes,
    bearer_methods_supported: ["header"],
  };
}
