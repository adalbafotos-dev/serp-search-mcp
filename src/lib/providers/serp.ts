import { z } from "zod";
import { AppError } from "../errors";
import { providerJson, record, records, requiredEnv, string, type JsonRecord } from "./http";
import { dataForSeoCountryLocations } from "./dataforseo-locations";

export const serpInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  country: z.string().regex(/^[a-zA-Z]{2}$/).default("br"),
  language: z.string().regex(/^[a-zA-Z]{2,3}(?:[-_](?:[a-zA-Z]{2}|[0-9]{3}))?$/).default("pt"),
  limit: z.number().int().min(1).max(20).default(10),
  type: z.enum(["search", "news"]).default("search"),
});

export type SerpInput = z.input<typeof serpInputSchema>;
export interface SerpResult {
  title: string;
  url: string;
  snippet: string;
  position: number | null;
  source?: string;
  date?: string;
}
export interface SerpQuestion {
  question: string;
  snippet: string;
  url: string;
}
export interface SerpResponse {
  provider: "dataforseo" | "serpapi" | "serper";
  query: string;
  country: string;
  language: string;
  type: "search" | "news";
  results: SerpResult[];
  relatedSearches: string[];
  questions: SerpQuestion[];
  fetchedAt: string;
  requestsUsed: number;
  truncated: boolean;
  costUsd?: number | null;
  sourceFetchedAt?: string;
  notes?: string[];
}

function safeUrl(value: unknown): string {
  try {
    const url = new URL(string(value));
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

function normalizeResults(items: JsonRecord[], offset = 0, inferPosition = true): SerpResult[] {
  return items.flatMap((item, index) => {
    const url = safeUrl(item.link);
    const title = string(item.title);
    if (!url || !title) return [];
    const source = string(item.source) || string(record(item.source).name);
    const date = string(item.date);
    const rawPosition = Number(item.position);
    return [{
      title: title.slice(0, 1000),
      url,
      snippet: string(item.snippet).slice(0, 4000),
      position: Number.isInteger(rawPosition) && rawPosition > 0 ? rawPosition + offset : inferPosition ? index + offset + 1 : null,
      ...(source ? { source: source.slice(0, 300) } : {}),
      ...(date ? { date: date.slice(0, 100) } : {}),
    }];
  });
}

function assertDataForSeoStatus(value: unknown) {
  const code = Number(value);
  if (code === 20000) return;
  if (code === 40100 || code === 40104 || code === 40201 || code === 40204 || code === 40207 || code === 40208) {
    throw new AppError("DataForSEO: acesso recusado. Verifique as credenciais da API e as permissões da conta.", "UPSTREAM_AUTH_ERROR", 502);
  }
  if (code === 40200 || code === 40210) {
    throw new AppError("DataForSEO: saldo insuficiente. Verifique o saldo da conta.", "UPSTREAM_PAYMENT_REQUIRED", 402);
  }
  if (code === 40202 || code === 40203 || code === 40205 || code === 40206 || code === 40209) {
    throw new AppError("DataForSEO: limite de consultas atingido. Tente novamente mais tarde.", "UPSTREAM_RATE_LIMIT", 429);
  }
  if (!Number.isInteger(code) || code < 10000 || code > 60000) {
    throw new AppError("DataForSEO: resposta sem código de status válido.", "UPSTREAM_INVALID_RESPONSE", 502);
  }
  // status_message can include user data. Only the numeric provider code is public.
  throw new AppError(`DataForSEO: a tarefa não foi concluída (código ${code}). Verifique parâmetros, permissões e cotas.`, "UPSTREAM_ERROR", 502);
}

async function searchDataForSeo(options: z.output<typeof serpInputSchema>): Promise<SerpResponse> {
  const country = options.country.toLowerCase();
  const locationCode = dataForSeoCountryLocations[country === "uk" ? "gb" : country];
  if (!locationCode) {
    throw new AppError("País não disponível na lista de locais Google do DataForSEO.", "INVALID_INPUT");
  }
  const login = requiredEnv("DATAFORSEO_LOGIN");
  const password = requiredEnv("DATAFORSEO_PASSWORD");
  const authorization = `Basic ${Buffer.from(`${login}:${password}`, "utf8").toString("base64")}`;
  const kind = options.type === "news" ? "news" : "organic";
  const depth = Math.max(10, options.limit);
  const data = await providerJson("DataForSEO", `https://api.dataforseo.com/v3/serp/google/${kind}/live/advanced`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    // Live accepts one task. Optional paid enrichments are left at their defaults.
    body: JSON.stringify([{
      keyword: options.query.replaceAll("%", "%25").replaceAll("+", "%2B"),
      location_code: locationCode,
      language_code: options.language.toLowerCase().split(/[-_]/)[0],
      depth,
      max_crawl_pages: Math.ceil(depth / 10),
      ...(kind === "organic" ? { device: "desktop" } : {}),
    }]),
  });
  assertDataForSeoStatus(data.status_code);
  const tasks = records(data.tasks);
  if (tasks.length !== 1) throw new AppError("DataForSEO: resposta com tarefas ausentes ou inesperadas.", "UPSTREAM_INVALID_RESPONSE", 502);
  const task = tasks[0];
  const partial = Number(task.status_code) === 40106;
  const noResults = Number(task.status_code) === 40102;
  if (!partial && !noResults) assertDataForSeoStatus(task.status_code);
  const rawResult = records(task.result)[0];
  if (!rawResult && !noResults) throw new AppError("DataForSEO: resposta sem o resultado da pesquisa.", "UPSTREAM_INVALID_RESPONSE", 502);
  const result = rawResult ?? {};
  const items = records(result.items);
  const rawSearchItems = items.filter((item) => string(item.type) === (kind === "news" ? "news_search" : "organic"));
  const normalized = normalizeResults(rawSearchItems.map((item) => ({
    title: item.title,
    link: item.url,
    snippet: item.description || item.snippet,
    position: item.rank_group,
    source: item.source || item.domain,
    date: item.timestamp || item.time_published,
  })), 0, false);
  const results = normalized.filter((item, index) => normalized.findIndex((other) => other.url === item.url) === index);
  const relatedSearches = [...new Set(items.filter((item) => item.type === "related_searches")
    .flatMap((item) => Array.isArray(item.items) ? item.items.filter((query): query is string => typeof query === "string") : []))]
    .slice(0, 30).map((query) => query.slice(0, 500));
  const questions = items.filter((item) => item.type === "people_also_ask").flatMap((item) => records(item.items))
    .flatMap((item) => {
      const question = string(item.title).slice(0, 1000);
      if (!question) return [];
      const expanded = records(item.expanded_element)[0] ?? {};
      return [{ question, snippet: string(expanded.description).slice(0, 4000), url: safeUrl(expanded.url) }];
    }).slice(0, 30);
  return {
    provider: "dataforseo",
    query: options.query,
    country,
    language: options.language.toLowerCase(),
    type: options.type,
    results: results.slice(0, options.limit),
    relatedSearches,
    questions,
    fetchedAt: new Date().toISOString(),
    ...(string(result.datetime) ? { sourceFetchedAt: string(result.datetime).slice(0, 100) } : {}),
    requestsUsed: 1,
    truncated: partial || results.length > options.limit,
    costUsd: typeof task.cost === "number" && Number.isFinite(task.cost) ? task.cost : null,
    ...(partial ? { notes: ["O provedor retornou resultados parciais; algumas páginas não puderam ser recuperadas."] } : {}),
  };
}

export async function searchSerp(input: SerpInput): Promise<SerpResponse> {
  const parsed = serpInputSchema.safeParse(input);
  if (!parsed.success) throw new AppError("Consulta SERP inválida. Use uma busca de até 500 caracteres e limite entre 1 e 20.", "INVALID_INPUT");
  const options = parsed.data;
  const configuredProvider = process.env.SERP_PROVIDER?.trim().toLowerCase() || "dataforseo";
  if (configuredProvider !== "dataforseo" && configuredProvider !== "serpapi" && configuredProvider !== "serper") {
    throw new AppError("SERP_PROVIDER deve ser dataforseo, serpapi ou serper.", "INVALID_CONFIGURATION", 503);
  }
  if (configuredProvider === "dataforseo") return searchDataForSeo(options);
  const provider = configuredProvider;
  const key = requiredEnv(provider === "serpapi" ? "SERPAPI_API_KEY" : "SERPER_API_KEY");
  const results: SerpResult[] = [];
  const relatedSearches = new Set<string>();
  const questions = new Map<string, SerpQuestion>();
  let requestsUsed = 0;
  let hasNext = false;

  // SerpApi's current Google endpoint uses start offsets instead of num.
  // Three pages is a hard cap, including sparse pages, to bound paid requests.
  for (let page = 0; page < (provider === "serpapi" ? 3 : 1); page += 1) {
    let data: JsonRecord;
    if (provider === "serpapi") {
      const url = new URL("https://serpapi.com/search.json");
      url.search = new URLSearchParams({
        engine: "google",
        q: options.query,
        gl: options.country.toLowerCase(),
        hl: options.language.toLowerCase(),
        api_key: key,
        ...(page > 0 ? { start: String(page * 10) } : {}),
        ...(options.type === "news" ? { tbm: "nws" } : {}),
      }).toString();
      data = await providerJson("SerpApi", url);
    } else {
      data = await providerJson("Serper", `https://google.serper.dev/${options.type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": key },
        body: JSON.stringify({ q: options.query, gl: options.country.toLowerCase(), hl: options.language.toLowerCase(), num: options.limit }),
      });
    }
    requestsUsed += 1;
    const items = records(provider === "serpapi"
      ? (options.type === "news" ? data.news_results : data.organic_results)
      : (options.type === "news" ? data.news : data.organic));
    const normalized = normalizeResults(items, page * 10);
    for (const result of normalized) {
      if (!results.some((existing) => existing.url === result.url)) results.push(result);
    }
    for (const item of records(provider === "serpapi" ? data.related_searches : data.relatedSearches)) {
      const query = string(item.query).slice(0, 500);
      if (query) relatedSearches.add(query);
    }
    for (const item of records(provider === "serpapi" ? data.related_questions : data.peopleAlsoAsk)) {
      const question = string(item.question).slice(0, 1000);
      if (question) questions.set(question, { question, snippet: string(item.snippet).slice(0, 4000), url: safeUrl(item.link) });
    }
    hasNext = provider === "serpapi" && Boolean(string(record(data.serpapi_pagination).next));
    if (results.length >= options.limit || !hasNext || normalized.length === 0) break;
  }
  return {
    provider,
    query: options.query,
    country: options.country.toLowerCase(),
    language: options.language.toLowerCase(),
    type: options.type,
    results: results.slice(0, options.limit),
    relatedSearches: [...relatedSearches].slice(0, 30),
    questions: [...questions.values()].slice(0, 30),
    fetchedAt: new Date().toISOString(),
    requestsUsed,
    truncated: results.length > options.limit || hasNext,
  };
}
