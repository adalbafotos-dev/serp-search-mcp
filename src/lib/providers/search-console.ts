import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "../errors";
import { providerJson, record, records, requiredEnv, string, type JsonRecord } from "./http";

const publicUrl = z.string().trim().max(2048).url().refine(value => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.hash;
}, "Informe uma URL HTTP(S) sem credenciais ou fragmento.");
const domain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const property = z.string().trim().max(2048).refine(value => {
  if (value.startsWith("sc-domain:")) return domain.test(value.slice(10));
  return publicUrl.safeParse(value).success && !new URL(value).search && value.endsWith("/");
}, "Use a propriedade exata: sc-domain:example.com ou https://example.com/.");
const siteShape = { siteUrl: property.optional().describe("Propriedade exata do Search Console; omitir usa GOOGLE_SEARCH_CONSOLE_SITE_URL.") };
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const dimension = z.enum(["query", "page", "country", "device", "date", "searchAppearance"]);
export const searchConsoleSitesSchema = z.object({});
export const searchConsolePerformanceSchema = z.object({
  ...siteShape,
  startDate: isoDate,
  endDate: isoDate,
  dimensions: z.array(dimension).max(6).default(["query", "page"]).refine(values => new Set(values).size === values.length, "Não repita dimensões."),
  searchType: z.enum(["web", "image", "video", "news", "discover", "googleNews"]).default("web"),
  filters: z.array(z.object({
    dimension: z.enum(["query", "page", "country", "device", "searchAppearance"]),
    operator: z.enum(["equals", "notEquals", "contains", "notContains", "includingRegex", "excludingRegex"]).default("equals"),
    expression: z.string().min(1).max(4096),
  })).max(10).default([]),
  dataState: z.enum(["final", "all"]).default("final"),
  rowLimit: z.number().int().min(1).max(1000).default(100),
  startRow: z.number().int().min(0).max(100_000).default(0),
}).refine(input => input.startDate <= input.endDate, "Data inicial deve preceder a final.");
export const searchConsoleInspectionSchema = z.object({
  ...siteShape,
  inspectionUrl: publicUrl,
  languageCode: z.string().regex(/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/).default("pt-BR"),
});
export const searchConsoleSitemapsSchema = z.object({ ...siteShape });

function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError("Parâmetros do Search Console inválidos. Confira propriedade, datas, dimensões e limites.", "INVALID_INPUT");
  return parsed.data;
}

function siteUrl(value?: string) {
  const site = value || requiredEnv("GOOGLE_SEARCH_CONSOLE_SITE_URL");
  if (!property.safeParse(site).success) throw new AppError("Propriedade Search Console inválida.", "INVALID_CONFIGURATION", 503);
  const allowed = (process.env.GOOGLE_SEARCH_CONSOLE_ALLOWED_SITES || "").split(",").map(value => value.trim()).filter(Boolean);
  if (allowed.length && !allowed.every(value => property.safeParse(value).success)) {
    throw new AppError("GOOGLE_SEARCH_CONSOLE_ALLOWED_SITES contém uma propriedade inválida.", "INVALID_CONFIGURATION", 503);
  }
  if (allowed.length && !allowed.includes(site)) throw new AppError("Propriedade fora da lista permitida para este MCP.", "PROPERTY_NOT_ALLOWED", 403);
  return site;
}

function number(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
function list(data: JsonRecord, key: string) {
  if (data[key] !== undefined && !Array.isArray(data[key])) throw new AppError("Search Console: resposta inesperada do serviço.", "UPSTREAM_INVALID_RESPONSE", 502);
  return records(data[key]);
}

let tokenCache: { key: string; value: string; expiresAt: number } | undefined;
let tokenRequest: { key: string; promise: Promise<string> } | undefined;
async function accessToken() {
  // These credentials require webmasters.readonly; Ads credentials are not reused.
  const clientId = requiredEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET");
  const refreshToken = requiredEnv("GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN");
  const key = createHash("sha256").update(JSON.stringify([clientId, clientSecret, refreshToken])).digest("hex");
  if (tokenCache?.key === key && tokenCache.expiresAt > Date.now()) return tokenCache.value;
  if (tokenRequest?.key === key) return tokenRequest.promise;
  const promise = (async () => {
    const data = await providerJson("Google OAuth Search Console", "https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }).toString(),
    });
    const value = string(data.access_token);
    if (!value || /[\r\n]/.test(value)) throw new AppError("Google OAuth Search Console: resposta sem token válido.", "UPSTREAM_INVALID_RESPONSE", 502);
    tokenCache = { key, value, expiresAt: Date.now() + Math.max(0, Math.min(number(data.expires_in) ?? 60, 3600) - 60) * 1000 };
    return value;
  })();
  tokenRequest = { key, promise };
  try { return await promise; } finally { if (tokenRequest?.promise === promise) tokenRequest = undefined; }
}

async function request(url: string, body?: JsonRecord) {
  const token = await accessToken();
  return providerJson("Google Search Console", url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function metadata(site?: string) {
  return { provider: "google-search-console", ...(site ? { siteUrl: site } : {}), fetchedAt: new Date().toISOString(), sourceUrl: "https://search.google.com/search-console" };
}

export async function listSearchConsoleSites(input: z.input<typeof searchConsoleSitesSchema> = {}) {
  validate(searchConsoleSitesSchema, input);
  const allowed = (process.env.GOOGLE_SEARCH_CONSOLE_ALLOWED_SITES || "").split(",").map(value => value.trim()).filter(Boolean);
  if (allowed.some(value => !property.safeParse(value).success)) throw new AppError("Lista de propriedades Search Console inválida.", "INVALID_CONFIGURATION", 503);
  const data = await request("https://www.googleapis.com/webmasters/v3/sites");
  const sites = list(data, "siteEntry").map(item => ({ siteUrl: string(item.siteUrl), permissionLevel: string(item.permissionLevel) || null }))
    .filter(item => !allowed.length || allowed.includes(item.siteUrl));
  return { ...metadata(), sites, restrictedToAllowedSites: allowed.length > 0, notes: ["Propriedades acessíveis à conta Google autorizada. Lista vazia não significa que o domínio não exista."] };
}

export async function getSearchConsolePerformance(input: z.input<typeof searchConsolePerformanceSchema>) {
  const options = validate(searchConsolePerformanceSchema, input);
  const site = siteUrl(options.siteUrl);
  const data = await request(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    startDate: options.startDate, endDate: options.endDate, dimensions: options.dimensions, type: options.searchType,
    dataState: options.dataState, aggregationType: "auto", rowLimit: options.rowLimit, startRow: options.startRow,
    ...(options.filters.length ? { dimensionFilterGroups: [{ groupType: "and", filters: options.filters }] } : {}),
  });
  const rows = list(data, "rows").map(row => {
    const keys = strings(row.keys);
    return { dimensions: Object.fromEntries(options.dimensions.map((dimension, index) => [dimension, keys[index] ?? null])),
      clicks: number(row.clicks), impressions: number(row.impressions), ctr: number(row.ctr), averagePosition: number(row.position) };
  });
  const limitReached = rows.length >= options.rowLimit;
  return { ...metadata(site), period: { startDate: options.startDate, endDate: options.endDate, timezone: "America/Los_Angeles" },
    dimensions: options.dimensions, searchType: options.searchType, filters: options.filters, dataState: options.dataState,
    aggregationType: string(data.responseAggregationType) || null, rows, rowLimit: options.rowLimit, startRow: options.startRow,
    limitReached, nextStartRow: limitReached && options.startRow + rows.length <= 100_000 ? options.startRow + rows.length : null,
    includesFreshData: options.dataState === "all",
    notes: ["Posição média é uma métrica agregada do Search Console no período e filtros; não é uma posição fixa nem uma SERP atual.",
      "CTR é uma fração (0.1 = 10%). Dados ausentes são null; uma consulta vazia não comprova zero tráfego.",
      "A API devolve principalmente linhas com mais cliques; filtros, agrupamentos, privacidade e limites podem omitir dados. Não some estas linhas como total garantido do site.",
      "limitReached indica somente o limite desta página; não garante que exista outra. dataState=all pode incluir dados parciais."] };
}

export async function inspectSearchConsoleUrl(input: z.input<typeof searchConsoleInspectionSchema>) {
  const options = validate(searchConsoleInspectionSchema, input);
  const site = siteUrl(options.siteUrl);
  const url = new URL(options.inspectionUrl);
  const belongs = site.startsWith("sc-domain:")
    ? url.hostname.toLowerCase() === site.slice(10).toLowerCase() || url.hostname.toLowerCase().endsWith(`.${site.slice(10).toLowerCase()}`)
    : url.origin === new URL(site).origin && url.pathname.startsWith(new URL(site).pathname);
  if (!belongs) throw new AppError("A URL de inspeção deve pertencer à propriedade informada.", "INVALID_INPUT");
  const data = await request("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { inspectionUrl: options.inspectionUrl, siteUrl: site, languageCode: options.languageCode });
  const result = record(data.inspectionResult);
  if (!Object.keys(result).length) throw new AppError("Search Console: resposta sem resultado de inspeção.", "UPSTREAM_INVALID_RESPONSE", 502);
  const status = record(result.indexStatusResult);
  return { ...metadata(site), inspectionUrl: options.inspectionUrl, inspectionResultLink: string(result.inspectionResultLink) || null,
    indexStatus: Object.fromEntries(["verdict", "coverageState", "robotsTxtState", "indexingState", "lastCrawlTime", "pageFetchState", "googleCanonical", "userCanonical", "crawledAs"].map(key => [key, string(status[key]) || null])),
    sitemaps: strings(status.sitemap), referringUrls: strings(status.referringUrls),
    richResultsVerdict: string(record(result.richResultsResult).verdict) || null,
    notes: ["Inspeção da versão conhecida pelo índice Google; não é um teste ao vivo e não solicita indexação.", "Ausência de um campo não confirma que o problema inexista."] };
}

export async function listSearchConsoleSitemaps(input: z.input<typeof searchConsoleSitemapsSchema>) {
  const options = validate(searchConsoleSitemapsSchema, input);
  const site = siteUrl(options.siteUrl);
  const data = await request(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps`);
  return { ...metadata(site), sitemaps: list(data, "sitemap").map(item => ({
    path: string(item.path), type: string(item.type) || null, lastSubmitted: string(item.lastSubmitted) || null,
    lastDownloaded: string(item.lastDownloaded) || null, isPending: typeof item.isPending === "boolean" ? item.isPending : null,
    isSitemapsIndex: typeof item.isSitemapsIndex === "boolean" ? item.isSitemapsIndex : null,
    warnings: number(item.warnings), errors: number(item.errors),
    contents: records(item.contents).map(content => ({ type: string(content.type), submitted: number(content.submitted), indexed: number(content.indexed) })),
  })), notes: ["Sitemaps conhecidos pelo Search Console. Esta ferramenta não envia nem altera sitemaps; campos indisponíveis são null."] };
}
