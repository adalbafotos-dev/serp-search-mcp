import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

async function main() {
  const [domain, subject, clientId, tokenMethod = "none"] = process.argv.slice(2);
  if (!domain || !subject || !clientId) throw new Error("Uso: npm run oauth:prepare -- tenant.us.auth0.com SUBJECT CLIENT_ID [none|client_secret_basic|client_secret_post]. Não informe Client Secret.");
  if (!["none", "client_secret_basic", "client_secret_post"].includes(tokenMethod)) throw new Error("Informe o método real de autenticação do cliente Auth0.");
  if (!/^[a-z0-9.-]+\.auth0\.com$/i.test(domain) || !/^[a-zA-Z0-9_-]{8,128}$/.test(clientId) || !/^[^\s,\r\n]{1,256}$/.test(subject)) {
    throw new Error("Confira domínio do tenant Auth0, User ID (subject) e Client ID público.");
  }
  const target = fileURLToPath(new URL("../.env.vercel.oauth", import.meta.url));
  const manifest = fileURLToPath(new URL("../.env.auth0-connection.json", import.meta.url));
  if (existsSync(target) || existsSync(manifest)) throw new Error("Arquivos OAuth já existem e foram preservados.");
  const issuer = `https://${domain.toLowerCase()}/`;
  const response = await fetch(new URL(".well-known/openid-configuration", issuer), { redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Discovery Auth0 indisponível. Confira seu tenant.");
  const discovery = await response.json();
  if (discovery.issuer !== issuer || !Array.isArray(discovery.code_challenge_methods_supported) || !discovery.code_challenge_methods_supported.includes("S256")) {
    throw new Error("Discovery Auth0 não confirmou issuer/PKCE S256. Não foi gerado arquivo.");
  }
  for (const field of ["jwks_uri", "authorization_endpoint", "token_endpoint"]) {
    if (typeof discovery[field] !== "string" || new URL(discovery[field]).origin !== new URL(issuer).origin) throw new Error("Discovery Auth0 contém endpoint inesperado.");
  }
  const audience = "https://serp-search-mcp.vercel.app/api/mcp";
  const values = { MCP_PUBLIC_URL: "https://serp-search-mcp.vercel.app", MCP_AUTH_MODE: "both", MCP_OAUTH_ISSUER: issuer,
    MCP_OAUTH_AUDIENCE: audience, MCP_OAUTH_JWKS_URL: discovery.jwks_uri, MCP_OAUTH_SCOPES: "research:read", MCP_OAUTH_ALLOWED_SUBJECTS: subject };
  const config = { type: "oauth", client: { mode: "provided", clientId, tokenEndpointAuthMethod: tokenMethod },
    authorizationUrl: discovery.authorization_endpoint, tokenUrl: discovery.token_endpoint, authorizationServerBase: issuer,
    resource: audience, baseScopes: ["research:read"], defaultScopes: ["research:read", "offline_access"] };
  writeFileSync(target, "# Importar somente na Vercel Production. Mantém o Bearer já configurado.\n" + Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n", { flag: "wx", mode: 0o600 });
  writeFileSync(manifest, JSON.stringify(config, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ ok: true, issuer, files: [".env.vercel.oauth", ".env.auth0-connection.json"], keys: Object.keys(values), next: "Importe env, configure API/cliente/callback Auth0, redeploy e atualize o mesmo plugin para OAuth. Discovery não comprova que API, subject e cliente foram cadastrados." }));
}
main().catch(() => { console.error("Preparação OAuth não concluída. Verifique argumentos, arquivos existentes e discovery do tenant. Nenhuma credencial foi exibida."); process.exitCode = 1; });
