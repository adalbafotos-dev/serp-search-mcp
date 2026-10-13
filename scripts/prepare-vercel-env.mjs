import nextEnv from "@next/env";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const suppliedUrl = process.argv[2];
if (!suppliedUrl) { console.error("Informe a origem HTTPS de produção como argumento."); process.exit(1); }
const url = new URL(suppliedUrl);
if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
  console.error("Use uma origem HTTPS sem caminho, query ou credenciais."); process.exit(1);
}

const { parsedEnv = {} } = nextEnv.loadEnvConfig(root, false, { info() {}, error() {} });
const provider = parsedEnv.SERP_PROVIDER?.trim().toLowerCase() || "dataforseo";
const providerKeys = provider === "dataforseo" ? ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"]
  : provider === "serpapi" ? ["SERPAPI_API_KEY"] : provider === "serper" ? ["SERPER_API_KEY"] : null;
if (!providerKeys) { console.error("SERP_PROVIDER inválido."); process.exit(1); }
const customerKey = parsedEnv.GOOGLE_ADS_CUSTOMER_ID?.trim() ? "GOOGLE_ADS_CUSTOMER_ID" : "GOOGLE_ADS_RESEARCH_CUSTOMER_ID";
const required = [...providerKeys, "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", customerKey, "MCP_AUTH_TOKEN"];
const missing = required.filter(key => !parsedEnv[key]?.trim());
if (missing.length) { console.error(`Campos ausentes no ambiente local: ${missing.join(", ")}`); process.exit(1); }

const values = {
  SERP_PROVIDER: provider,
  ...Object.fromEntries(required.map(key => [key, parsedEnv[key].trim()])),
  ...(parsedEnv.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim() ? { GOOGLE_ADS_LOGIN_CUSTOMER_ID: parsedEnv.GOOGLE_ADS_LOGIN_CUSTOMER_ID.trim() } : {}),
  GOOGLE_ADS_API_VERSION: parsedEnv.GOOGLE_ADS_API_VERSION?.trim() || "v24",
  MCP_AUTH_MODE: "bearer",
  MCP_PUBLIC_URL: url.origin,
};
const target = fileURLToPath(new URL("../.env.vercel.production", import.meta.url));
if (existsSync(target)) { console.error(".env.vercel.production já existe; arquivo preservado. Revise-o antes de importar."); process.exit(1); }
const lines = Object.entries(values).map(([key, value]) => {
  if (/[\r\n]/.test(value)) throw new Error(`Valor inválido para ${key}.`);
  return `${key}=${JSON.stringify(value)}`;
});
writeFileSync(target, ["# Importar somente em Production do projeto indicado.", "# Arquivo privado: não publicar no GitHub.", ...lines, ""].join("\n"), { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ file: ".env.vercel.production", origin: url.origin, mode: "bearer", count: lines.length, keys: Object.keys(values), oauthConfigured: false }, null, 2));
