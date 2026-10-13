export function publicBaseUrl() {
  const deploymentHost = process.env.VERCEL === "1" ? process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim() : undefined;
  const url = new URL(process.env.MCP_PUBLIC_URL?.trim() || (deploymentHost ? `https://${deploymentHost}` : "http://localhost:3000"));
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("MCP_PUBLIC_URL deve ser uma origem HTTP(S), sem caminho ou credenciais.");
  }
  return url.origin;
}

export function vercelDeploymentHosts() {
  if (process.env.VERCEL !== "1") return [];
  return [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].flatMap(value => {
    if (!value?.trim()) return [];
    try {
      const hostname = value.trim().toLowerCase();
      const url = new URL(`https://${hostname}`);
      return !url.username && !url.password && url.host === hostname && url.pathname === "/" && !url.search && !url.hash ? [url.host] : [];
    } catch { return []; }
  });
}

export function oauthSettings() {
  const issuer = process.env.MCP_OAUTH_ISSUER?.trim();
  const jwksUrl = process.env.MCP_OAUTH_JWKS_URL?.trim();
  const scopes = (process.env.MCP_OAUTH_SCOPES || "research:read").split(/[ ,]+/).filter(Boolean);
  const audience = process.env.MCP_OAUTH_AUDIENCE?.trim() || `${publicBaseUrl()}/api/mcp`;
  if (!issuer || !jwksUrl) return null;
  try {
    if (new URL(issuer).protocol !== "https:" || new URL(jwksUrl).protocol !== "https:") return null;
  } catch { return null; }
  return { issuer, jwksUrl, scopes, audience };
}

export function getPublicStatus() {
  const provider = process.env.SERP_PROVIDER?.trim().toLowerCase() || "dataforseo";
  const serpFields = provider === "dataforseo" ? ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"] : provider === "serper" ? ["SERPER_API_KEY"] : ["SERPAPI_API_KEY"];
  const adsFields = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", process.env.GOOGLE_ADS_CUSTOMER_ID?.trim() ? "GOOGLE_ADS_CUSTOMER_ID" : "GOOGLE_ADS_RESEARCH_CUSTOMER_ID"];
  const mode = process.env.MCP_AUTH_MODE || "bearer";
  return {
    name: "SERP Research MCP",
    version: "1.0.0",
    transport: ["Streamable HTTP", "stdio"],
    endpoint: `${publicBaseUrl()}/api/mcp`,
    auth: { mode, bearerConfigured: Boolean(process.env.MCP_AUTH_TOKEN?.trim()), oauthConfigured: Boolean(oauthSettings()) },
    integrations: [
      { id: "serp", name: provider === "dataforseo" ? "DataForSEO" : provider === "serper" ? "Serper.dev" : "SerpApi", configured: ["dataforseo", "serpapi", "serper"].includes(provider) && serpFields.every(key => Boolean(process.env[key]?.trim())), fields: serpFields },
      { id: "google_ads", name: "Google Ads", configured: adsFields.every(key => Boolean(process.env[key]?.trim())), fields: adsFields },
      { id: "website", name: "Análise de sites", configured: true, fields: [] as string[] },
    ],
  };
}
