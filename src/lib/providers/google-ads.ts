import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "../errors";
import { providerJson, record, records, requiredEnv, string, type JsonRecord } from "./http";

const targeting = {
  languageId: z.string().regex(/^\d{1,12}$/).default("1014"),
  geoTargetIds: z.array(z.string().regex(/^\d{1,12}$/)).max(10).default(["2076"]),
};
const keyword = z.string().trim().min(1).max(200);
const httpUrl = z.string().max(2048).url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
});

export const keywordIdeasInputSchema = z.object({
  keywords: z.array(keyword).min(1).max(20).optional(),
  url: httpUrl.optional(),
  ...targeting,
  limit: z.number().int().min(1).max(100).default(30),
}).refine((input) => Boolean(input.keywords?.length || input.url), "Informe palavras-chave ou uma URL.");

export const keywordMetricsInputSchema = z.object({
  keywords: z.array(keyword).min(1).max(1000),
  ...targeting,
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
export const campaignPerformanceInputSchema = z.object({
  startDate: isoDate,
  endDate: isoDate,
  limit: z.number().int().min(1).max(100).default(30),
}).refine((input) => input.startDate <= input.endDate, "Data inicial deve preceder a final.");

export type KeywordIdeasInput = z.input<typeof keywordIdeasInputSchema>;
export type KeywordMetricsInput = z.input<typeof keywordMetricsInputSchema>;
export type CampaignPerformanceInput = z.input<typeof campaignPerformanceInputSchema>;

interface AdsConfiguration {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
  version: string;
}

interface Token {
  value: string;
  expiresAt: number;
}
let tokenCache: { key: string; token: Token } | undefined;
let tokenRequest: { key: string; promise: Promise<Token> } | undefined;

function customerId(value: string, name: string): string {
  const normalized = value.replaceAll("-", "");
  if (!/^\d{10}$/.test(normalized)) {
    throw new AppError(`${name} deve conter os 10 dígitos da conta Google Ads.`, "INVALID_CONFIGURATION", 503);
  }
  return normalized;
}

function configuration(): AdsConfiguration {
  const version = process.env.GOOGLE_ADS_API_VERSION?.trim() || "v24";
  if (!/^v\d{1,3}$/.test(version)) {
    throw new AppError("GOOGLE_ADS_API_VERSION deve ter o formato v24.", "INVALID_CONFIGURATION", 503);
  }
  const loginId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim();
  return {
    clientId: requiredEnv("GOOGLE_ADS_CLIENT_ID"),
    clientSecret: requiredEnv("GOOGLE_ADS_CLIENT_SECRET"),
    refreshToken: requiredEnv("GOOGLE_ADS_REFRESH_TOKEN"),
    developerToken: requiredEnv("GOOGLE_ADS_DEVELOPER_TOKEN"),
    customerId: customerId(process.env.GOOGLE_ADS_CUSTOMER_ID?.trim() || requiredEnv("GOOGLE_ADS_RESEARCH_CUSTOMER_ID"), "GOOGLE_ADS_CUSTOMER_ID ou GOOGLE_ADS_RESEARCH_CUSTOMER_ID"),
    ...(loginId ? { loginCustomerId: customerId(loginId, "GOOGLE_ADS_LOGIN_CUSTOMER_ID") } : {}),
    version,
  };
}

async function accessToken(config: AdsConfiguration): Promise<string> {
  const key = createHash("sha256").update(JSON.stringify([config.clientId, config.clientSecret, config.refreshToken])).digest("hex");
  if (tokenCache?.key === key && tokenCache.token.expiresAt > Date.now()) return tokenCache.token.value;
  if (tokenRequest?.key === key) return (await tokenRequest.promise).value;
  const promise = (async () => {
    const data = await providerJson("Google OAuth", "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
      }).toString(),
    });
    const value = string(data.access_token);
    if (!value || /[\r\n]/.test(value)) {
      throw new AppError("Google OAuth: resposta sem token de acesso válido.", "UPSTREAM_INVALID_RESPONSE", 502);
    }
    const ttl = number(data.expires_in) ?? 60;
    const token = { value, expiresAt: Date.now() + Math.max(0, Math.min(ttl, 3600) - 60) * 1000 };
    tokenCache = { key, token };
    return token;
  })();
  tokenRequest = { key, promise };
  try {
    return (await promise).value;
  } finally {
    if (tokenRequest?.promise === promise) tokenRequest = undefined;
  }
}

async function adsRequest(config: AdsConfiguration, action: string, body: JsonRecord): Promise<JsonRecord> {
  const token = await accessToken(config);
  return providerJson("Google Ads", `https://googleads.googleapis.com/${config.version}/customers/${config.customerId}${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "developer-token": config.developerToken,
      ...(config.loginCustomerId ? { "login-customer-id": config.loginCustomerId } : {}),
    },
    body: JSON.stringify(body),
  });
}

function number(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function micros(value: unknown): string | null {
  const text = typeof value === "number" ? String(value) : string(value);
  return /^-?\d+$/.test(text) ? text : null;
}

function keywordMetrics(item: JsonRecord, metricField: string) {
  const metrics = record(item[metricField]);
  return {
    keyword: string(item.text),
    closeVariants: Array.isArray(item.closeVariants) ? item.closeVariants.filter((value): value is string => typeof value === "string") : [],
    averageMonthlySearches: number(metrics.avgMonthlySearches),
    competition: string(metrics.competition) || null,
    competitionIndex: number(metrics.competitionIndex),
    lowTopOfPageBidMicros: micros(metrics.lowTopOfPageBidMicros),
    highTopOfPageBidMicros: micros(metrics.highTopOfPageBidMicros),
    monthlySearchVolumes: records(metrics.monthlySearchVolumes).map((month) => ({
      year: number(month.year),
      month: string(month.month),
      searches: number(month.monthlySearches),
    })),
  };
}

function targetBody(input: { languageId: string; geoTargetIds: string[] }): JsonRecord {
  return {
    language: `languageConstants/${input.languageId}`,
    geoTargetConstants: input.geoTargetIds.map((id) => `geoTargetConstants/${id}`),
    keywordPlanNetwork: "GOOGLE_SEARCH",
  };
}

function targetMetadata(input: { languageId: string; geoTargetIds: string[] }) {
  return { languageId: input.languageId, geoTargetIds: input.geoTargetIds, network: "GOOGLE_SEARCH" as const };
}

function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError("Parâmetros Google Ads inválidos. Verifique palavras-chave, IDs, limites e datas.", "INVALID_INPUT");
  return parsed.data;
}

export async function generateKeywordIdeas(input: KeywordIdeasInput) {
  const options = validate(keywordIdeasInputSchema, input);
  const config = configuration();
  const seed = options.keywords && options.url
    ? { keywordAndUrlSeed: { keywords: options.keywords, url: options.url } }
    : options.keywords ? { keywordSeed: { keywords: options.keywords } } : { urlSeed: { url: options.url } };
  const baseBody = { ...targetBody(options), ...seed, includeAdultKeywords: false, pageSize: options.limit };
  const ideas: ReturnType<typeof keywordMetrics>[] = [];
  const seenTokens = new Set<string>();
  let nextPageToken = "";
  let totalAvailable: number | null = null;
  let requestsUsed = 0;
  // Planning calls have stricter quotas. Never follow an unbounded token chain.
  do {
    const data = await adsRequest(config, ":generateKeywordIdeas", { ...baseBody, ...(nextPageToken ? { pageToken: nextPageToken } : {}) });
    requestsUsed += 1;
    ideas.push(...records(data.results).map((item) => keywordMetrics(item, "keywordIdeaMetrics")));
    totalAvailable = number(data.totalSize) ?? totalAvailable;
    nextPageToken = string(data.nextPageToken);
    if (nextPageToken && seenTokens.has(nextPageToken)) {
      throw new AppError("Google Ads: paginação inconsistente na resposta do serviço.", "UPSTREAM_INVALID_RESPONSE", 502);
    }
    if (nextPageToken) seenTokens.add(nextPageToken);
  } while (nextPageToken && ideas.length < options.limit && requestsUsed < 5);

  return {
    provider: "google-ads",
    apiVersion: config.version,
    customerId: config.customerId,
    targeting: targetMetadata(options),
    ideas: ideas.slice(0, options.limit),
    totalAvailable,
    truncated: Boolean(nextPageToken) || ideas.length > options.limit || (totalAvailable !== null && totalAvailable > Math.min(ideas.length, options.limit)),
    requestsUsed,
    fetchedAt: new Date().toISOString(),
    notes: ["Volumes são estimativas históricas. Competição mede anunciantes no Google Ads e não dificuldade de SEO.", "Valores de lance em micros usam a moeda da conta Google Ads; dados ausentes são null."],
  };
}

export async function getKeywordMetrics(input: KeywordMetricsInput) {
  const options = validate(keywordMetricsInputSchema, input);
  const config = configuration();
  const data = await adsRequest(config, ":generateKeywordHistoricalMetrics", {
    ...targetBody(options),
    keywords: [...new Set(options.keywords)],
    includeAdultKeywords: false,
  });
  return {
    provider: "google-ads",
    apiVersion: config.version,
    customerId: config.customerId,
    targeting: targetMetadata(options),
    metrics: records(data.results).map((item) => keywordMetrics(item, "keywordMetrics")),
    requestedKeywords: options.keywords,
    fetchedAt: new Date().toISOString(),
    notes: ["Google pode agrupar variantes próximas e omitir métricas indisponíveis. Ausência de dados não significa zero buscas.", "Competição representa anunciantes; valores de lance são micros na moeda da conta."],
  };
}

export async function getCampaignPerformance(input: CampaignPerformanceInput) {
  const options = validate(campaignPerformanceInputSchema, input);
  const config = configuration();
  // Dates and LIMIT are validated before interpolation, preventing GAQL injection.
  const query = `SELECT campaign.id, campaign.name, campaign.status, customer.currency_code, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${options.startDate}' AND '${options.endDate}' ORDER BY metrics.cost_micros DESC LIMIT ${options.limit}`;
  const rows: JsonRecord[] = [];
  const seenTokens = new Set<string>();
  let nextPageToken = "";
  let requestsUsed = 0;
  do {
    // GoogleAdsService.Search uses fixed pages; pageSize is intentionally omitted.
    const data = await adsRequest(config, "/googleAds:search", { query, ...(nextPageToken ? { pageToken: nextPageToken } : {}) });
    requestsUsed += 1;
    rows.push(...records(data.results));
    nextPageToken = string(data.nextPageToken);
    if (nextPageToken && seenTokens.has(nextPageToken)) {
      throw new AppError("Google Ads: paginação inconsistente na resposta do serviço.", "UPSTREAM_INVALID_RESPONSE", 502);
    }
    if (nextPageToken) seenTokens.add(nextPageToken);
  } while (nextPageToken && rows.length < options.limit && requestsUsed < 5);

  const campaigns = rows.slice(0, options.limit).map((row) => {
    const campaign = record(row.campaign);
    const metrics = record(row.metrics);
    return {
      id: string(campaign.id),
      name: string(campaign.name),
      status: string(campaign.status),
      currency: string(record(row.customer).currencyCode) || null,
      impressions: number(metrics.impressions) ?? 0,
      clicks: number(metrics.clicks) ?? 0,
      ctr: number(metrics.ctr) ?? 0,
      averageCpcMicros: number(metrics.averageCpc) ?? 0,
      costMicros: micros(metrics.costMicros) ?? "0",
      cost: (number(metrics.costMicros) ?? 0) / 1_000_000,
      conversions: number(metrics.conversions) ?? 0,
      conversionValue: number(metrics.conversionsValue) ?? 0,
    };
  });
  const totals = campaigns.reduce((sum, item) => ({
    impressions: sum.impressions + item.impressions,
    clicks: sum.clicks + item.clicks,
    cost: sum.cost + item.cost,
    conversions: sum.conversions + item.conversions,
    conversionValue: sum.conversionValue + item.conversionValue,
  }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0 });

  return {
    provider: "google-ads",
    apiVersion: config.version,
    customerId: config.customerId,
    period: { startDate: options.startDate, endDate: options.endDate },
    campaigns,
    totals: { ...totals, ctr: totals.impressions ? totals.clicks / totals.impressions : 0, scope: "returned_campaigns" },
    truncated: Boolean(nextPageToken) || rows.length > options.limit,
    limitReached: campaigns.length >= options.limit,
    limit: options.limit,
    requestsUsed,
    fetchedAt: new Date().toISOString(),
    notes: ["Consulta somente leitura. Datas seguem o fuso da conta Google Ads; totais abrangem apenas as campanhas retornadas pelo limite."],
  };
}
