import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let serp: typeof import("../src/lib/providers/serp");
let ads: typeof import("../src/lib/providers/google-ads");

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json" },
});
const oauth = () => json({ access_token: "test-access-token", expires_in: 3600 });
const bodyAt = (index: number) => JSON.parse(String(fetchMock.mock.calls[index]?.[1]?.body)) as Record<string, unknown>;
const urlAt = (index: number) => new URL(String(fetchMock.mock.calls[index]?.[0]));

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("SERP_PROVIDER", "serpapi");
  vi.stubEnv("SERPAPI_API_KEY", "serp-secret-test");
  vi.stubEnv("SERPER_API_KEY", "serper-secret-test");
  vi.stubEnv("DATAFORSEO_LOGIN", "test-login@example.com");
  vi.stubEnv("DATAFORSEO_PASSWORD", "dataforseo-secret-test");
  vi.stubEnv("GOOGLE_ADS_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_ADS_CLIENT_SECRET", "test-client-secret");
  vi.stubEnv("GOOGLE_ADS_REFRESH_TOKEN", "test-refresh-token");
  vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "test-developer-token");
  vi.stubEnv("GOOGLE_ADS_CUSTOMER_ID", "123-456-7890");
  vi.stubEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "999-888-7776");
  vi.stubEnv("GOOGLE_ADS_API_VERSION", "");
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  serp = await import("../src/lib/providers/serp");
  ads = await import("../src/lib/providers/google-ads");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("SERP provider contracts", () => {
  it("uses DataForSEO by default with one Basic-auth task and normalizes organic/PAA/related evidence", async () => {
    vi.stubEnv("SERP_PROVIDER", "");
    fetchMock.mockResolvedValueOnce(json({ status_code: 20000, tasks: [{ status_code: 20000, cost: 0.002, result: [{ datetime: "2026-10-13 07:00:00 +00:00", items: [
      { type: "paid", title: "Ad", url: "https://example.com/ad" },
      { type: "organic", title: "Conteúdo", url: "https://example.com/seo", description: "Descrição", rank_group: 1, rank_absolute: 4, domain: "example.com" },
      { type: "people_also_ask", items: [{ title: "Como planejar conteúdo?", expanded_element: [{ description: "Resposta", url: "https://example.com/pergunta" }] }] },
      { type: "related_searches", items: ["conteúdo seo", "conteúdo seo", "blog"] },
    ] }] }] }));
    const result = await serp.searchSerp({ query: "C++ 100%", country: "BR", language: "pt-BR", limit: 5 });
    expect(urlAt(0).href).toBe("https://api.dataforseo.com/v3/serp/google/organic/live/advanced");
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: `Basic ${Buffer.from("test-login@example.com:dataforseo-secret-test").toString("base64")}` });
    expect(JSON.parse(String(init?.body))).toEqual([{ keyword: "C%2B%2B 100%25", location_code: 2076, language_code: "pt", depth: 10, max_crawl_pages: 1, device: "desktop" }]);
    expect(result).toMatchObject({ provider: "dataforseo", query: "C++ 100%", costUsd: 0.002, requestsUsed: 1,
      results: [{ title: "Conteúdo", url: "https://example.com/seo", snippet: "Descrição", position: 1 }],
      questions: [{ question: "Como planejar conteúdo?", snippet: "Resposta", url: "https://example.com/pergunta" }], relatedSearches: ["conteúdo seo", "blog"],
    });
    expect(JSON.stringify(result)).not.toMatch(/dataforseo-secret-test|test-login@example.com/);
  });

  it("supports the official DataForSEO Google News Live endpoint", async () => {
    vi.stubEnv("SERP_PROVIDER", "dataforseo");
    fetchMock.mockResolvedValueOnce(json({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [
      { type: "news_search", title: "Notícia", url: "https://example.com/news", snippet: "Resumo da notícia", rank_group: 1, domain: "example.com", timestamp: "2026-10-12 08:00:00 +00:00" },
    ] }] }] }));
    const result = await serp.searchSerp({ query: "marketing", type: "news", country: "us", language: "en", limit: 1 });
    expect(urlAt(0).pathname).toBe("/v3/serp/google/news/live/advanced");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))[0]).toMatchObject({ location_code: 2840, language_code: "en" });
    expect(result.results[0]).toMatchObject({ snippet: "Resumo da notícia", date: "2026-10-12 08:00:00 +00:00" });
  });

  it.each([
    [40100, "UPSTREAM_AUTH_ERROR"],
    [40200, "UPSTREAM_PAYMENT_REQUIRED"],
    [40210, "UPSTREAM_PAYMENT_REQUIRED"],
    [40202, "UPSTREAM_RATE_LIMIT"],
    [40501, "UPSTREAM_ERROR"],
  ])("handles DataForSEO task status %i even on HTTP 200, without leaking status_message", async (status, code) => {
    vi.stubEnv("SERP_PROVIDER", "dataforseo");
    fetchMock.mockResolvedValueOnce(json({ status_code: 20000, tasks: [{ status_code: status, status_message: "dataforseo-secret-test test-login@example.com", result: null }] }));
    const error = await serp.searchSerp({ query: "seo" }).catch((value: unknown) => value);
    expect(error).toMatchObject({ code });
    expect(String(error)).not.toMatch(/dataforseo-secret-test|test-login@example.com/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("handles DataForSEO outer API status before inspecting tasks", async () => {
    vi.stubEnv("SERP_PROVIDER", "dataforseo");
    fetchMock.mockResolvedValueOnce(json({ status_code: 40203, status_message: "dataforseo-secret-test", tasks: [] }));
    await expect(serp.searchSerp({ query: "seo" })).rejects.toMatchObject({ code: "UPSTREAM_RATE_LIMIT" });
  });

  it("retains DataForSEO partial evidence and marks partial responses", async () => {
    vi.stubEnv("SERP_PROVIDER", "dataforseo");
    fetchMock.mockResolvedValueOnce(json({ status_code: 20000, tasks: [{ status_code: 40106, result: [{ items: [{ type: "organic", title: "Fonte", url: "https://example.com" }] }] }] }));
    const result = await serp.searchSerp({ query: "seo" });
    expect(result.results).toHaveLength(1);
    expect(result.truncated).toBe(true);
    expect(result.notes?.[0]).toContain("parciais");
    expect(result.results[0]?.position).toBeNull();
  });

  it("does not use absolute SERP rank as organic rank when rank_group is absent", async () => {
    vi.stubEnv("SERP_PROVIDER", "dataforseo");
    fetchMock.mockResolvedValueOnce(json({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [
      { type: "organic", title: "Fonte", url: "https://example.com", rank_absolute: 8 },
    ] }] }] }));
    const result = await serp.searchSerp({ query: "seo" });
    expect(result.results[0]?.position).toBeNull();
  });

  it("treats DataForSEO no-results as empty evidence and rejects malformed task envelopes", async () => {
    vi.stubEnv("SERP_PROVIDER", "dataforseo");
    fetchMock.mockResolvedValueOnce(json({ status_code: 20000, tasks: [{ status_code: 40102, result: null }] }));
    expect((await serp.searchSerp({ query: "seo" })).results).toEqual([]);
    fetchMock.mockResolvedValueOnce(json({ status_code: 20000, tasks: [] }));
    await expect(serp.searchSerp({ query: "seo" })).rejects.toMatchObject({ code: "UPSTREAM_INVALID_RESPONSE" });
  });

  it("rejects an unsupported DataForSEO country without a paid call", async () => {
    vi.stubEnv("SERP_PROVIDER", "dataforseo");
    await expect(serp.searchSerp({ query: "seo", country: "zz" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes SerpApi evidence and excludes malformed/unsafe links", async () => {
    fetchMock.mockResolvedValueOnce(json({
      organic_results: [
        { title: "Guia SEO", link: "https://example.com/seo", snippet: "Pesquisa com fontes", position: 1 },
        { title: "Invalid", link: "javascript:alert(1)" },
      ],
      related_searches: [{ query: "seo para blogs" }, { query: "seo para blogs" }],
      related_questions: [{ question: "Como fazer SEO?", snippet: "Resposta", link: "https://example.com/pergunta" }],
    }));
    const result = await serp.searchSerp({ query: "  SEO conteúdo  " });
    expect(result).toMatchObject({
      provider: "serpapi", query: "SEO conteúdo", country: "br", language: "pt",
      results: [{ title: "Guia SEO", url: "https://example.com/seo", snippet: "Pesquisa com fontes", position: 1 }],
      relatedSearches: ["seo para blogs"],
      questions: [{ question: "Como fazer SEO?", snippet: "Resposta", url: "https://example.com/pergunta" }],
      requestsUsed: 1,
    });
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(urlAt(0).origin).toBe("https://serpapi.com");
    expect(urlAt(0).searchParams.get("q")).toBe("SEO conteúdo");
    expect(urlAt(0).searchParams.has("num")).toBe(false);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store", redirect: "error" });
  });

  it("follows SerpApi pagination by rebuilding the trusted endpoint and bounds requests", async () => {
    fetchMock.mockResolvedValueOnce(json({
      organic_results: [{ title: "Primeiro", link: "https://example.com/1", position: 1 }],
      serpapi_pagination: { next: "https://malicious.example/steal?api_key=secret" },
    })).mockResolvedValueOnce(json({
      organic_results: [{ title: "Segundo", link: "https://example.com/2", position: 1 }],
    }));
    const result = await serp.searchSerp({ query: "SEO", limit: 2 });
    expect(result.results).toHaveLength(2);
    expect(result.requestsUsed).toBe(2);
    expect(urlAt(1).origin).toBe("https://serpapi.com");
    expect(urlAt(1).searchParams.get("start")).toBe("10");
    expect(result.results[1]?.position).toBe(11);
  });

  it("uses the Serper POST/header contract for news", async () => {
    vi.stubEnv("SERP_PROVIDER", "serper");
    fetchMock.mockResolvedValueOnce(json({ news: [{ title: "Notícia", link: "https://example.com/news", snippet: "Resumo", position: 1, source: "Jornal", date: "1 hour ago" }] }));
    const result = await serp.searchSerp({ query: "mercado", type: "news", country: "BR", language: "pt-BR", limit: 5 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://google.serper.dev/news");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST", headers: { "X-API-KEY": "serper-secret-test", "Content-Type": "application/json" } });
    expect(bodyAt(0)).toEqual({ q: "mercado", gl: "br", hl: "pt-br", num: 5 });
    expect(result.results[0]).toMatchObject({ source: "Jornal", date: "1 hour ago" });
  });

  it("selects SerpApi news using the documented tbm parameter", async () => {
    fetchMock.mockResolvedValueOnce(json({ news_results: [{ title: "Notícia", link: "https://example.com/news" }] }));
    expect((await serp.searchSerp({ query: "mercado", type: "news" })).results).toHaveLength(1);
    expect(urlAt(0).searchParams.get("tbm")).toBe("nws");
  });

  it("does not contact a paid provider when input/configuration is invalid", async () => {
    await expect(serp.searchSerp({ query: "" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(serp.searchSerp({ query: "x", limit: 21 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    vi.stubEnv("SERPAPI_API_KEY", "");
    await expect(serp.searchSerp({ query: "x" })).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Google Ads read-only REST contracts", () => {
  it("refreshes OAuth, sends correct headers, and paginates ideas without changing seed parameters", async () => {
    fetchMock.mockResolvedValueOnce(oauth())
      .mockResolvedValueOnce(json({ results: [{ text: "seo blog", keywordIdeaMetrics: { avgMonthlySearches: "1000", competition: "MEDIUM", competitionIndex: "42", lowTopOfPageBidMicros: "1000000" } }], nextPageToken: "second-page", totalSize: "10" }))
      .mockResolvedValueOnce(json({ results: [{ text: "conteúdo seo" }], totalSize: "2" }));
    const result = await ads.generateKeywordIdeas({ keywords: ["SEO"], url: "https://example.com/", limit: 2 });
    expect(urlAt(0).href).toBe("https://oauth2.googleapis.com/token");
    const tokenBody = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(tokenBody.get("grant_type")).toBe("refresh_token");
    expect(tokenBody.get("refresh_token")).toBe("test-refresh-token");
    expect(urlAt(1).href).toBe("https://googleads.googleapis.com/v24/customers/1234567890:generateKeywordIdeas");
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer test-access-token", "developer-token": "test-developer-token", "login-customer-id": "9998887776",
    });
    expect(bodyAt(1)).toEqual({
      language: "languageConstants/1014", geoTargetConstants: ["geoTargetConstants/2076"], keywordPlanNetwork: "GOOGLE_SEARCH",
      keywordAndUrlSeed: { keywords: ["SEO"], url: "https://example.com/" }, includeAdultKeywords: false, pageSize: 2,
    });
    expect(bodyAt(2)).toEqual({ ...bodyAt(1), pageToken: "second-page" });
    expect(result.ideas[0]).toMatchObject({ keyword: "seo blog", averageMonthlySearches: 1000, competitionIndex: 42, lowTopOfPageBidMicros: "1000000" });
    expect(result.ideas[1]?.averageMonthlySearches).toBeNull();
    expect(result).toMatchObject({ totalAvailable: 2, requestsUsed: 2, truncated: false });
    expect(JSON.stringify(result)).not.toContain("test-access-token");
  });

  it("supports URL-only ideas and all geo targets, and omits an optional manager ID", async () => {
    vi.stubEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "");
    fetchMock.mockResolvedValueOnce(oauth()).mockResolvedValueOnce(json({ results: [] }));
    await ads.generateKeywordIdeas({ url: "https://example.com", geoTargetIds: [] });
    expect(bodyAt(1)).toMatchObject({ urlSeed: { url: "https://example.com" }, geoTargetConstants: [] });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).not.toHaveProperty("login-customer-id");
  });

  it("deduplicates metrics keywords and distinguishes missing data from zero", async () => {
    fetchMock.mockResolvedValueOnce(oauth()).mockResolvedValueOnce(json({ results: [
      { text: "seo", closeVariants: ["SEO"], keywordMetrics: { avgMonthlySearches: "0", monthlySearchVolumes: [{ year: "2026", month: "SEPTEMBER", monthlySearches: "10" }] } },
      { text: "sem dados" },
    ] }));
    const result = await ads.getKeywordMetrics({ keywords: ["seo", "seo", "sem dados"] });
    expect(urlAt(1).pathname).toBe("/v24/customers/1234567890:generateKeywordHistoricalMetrics");
    expect(bodyAt(1).keywords).toEqual(["seo", "sem dados"]);
    expect(result.metrics[0]?.averageMonthlySearches).toBe(0);
    expect(result.metrics[1]?.averageMonthlySearches).toBeNull();
    expect(result.metrics[0]?.monthlySearchVolumes).toEqual([{ year: 2026, month: "SEPTEMBER", searches: 10 }]);
  });

  it("caches a valid OAuth access token for later queries", async () => {
    fetchMock.mockResolvedValueOnce(oauth()).mockResolvedValueOnce(json({ results: [] })).mockResolvedValueOnce(json({ results: [] }));
    await ads.getKeywordMetrics({ keywords: ["seo"] });
    await ads.getKeywordMetrics({ keywords: ["blog"] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(urlAt(2).origin).toBe("https://googleads.googleapis.com");
  });

  it("refreshes expired tokens before the next Ads request", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(json({ access_token: "expired-soon", expires_in: 120 }))
      .mockResolvedValueOnce(json({ results: [] })).mockResolvedValueOnce(oauth()).mockResolvedValueOnce(json({ results: [] }));
    await ads.getKeywordMetrics({ keywords: ["seo"] });
    await vi.advanceTimersByTimeAsync(61_000);
    await ads.getKeywordMetrics({ keywords: ["blog"] });
    expect(urlAt(2).origin).toBe("https://oauth2.googleapis.com");
  });

  it("reads campaign reports with GAQL and omits unsupported Search pageSize", async () => {
    fetchMock.mockResolvedValueOnce(oauth())
      .mockResolvedValueOnce(json({ results: [{ campaign: { id: "1", name: "Busca", status: "ENABLED" }, customer: { currencyCode: "BRL" }, metrics: { clicks: "10", impressions: "100", costMicros: "50000000", conversions: 2 } }], nextPageToken: "page-two" }))
      .mockResolvedValueOnce(json({ results: [{ campaign: { id: "2", name: "Conteúdo" }, customer: { currencyCode: "BRL" }, metrics: { clicks: "5", impressions: "100", costMicros: "10000000" } }] }));
    const result = await ads.getCampaignPerformance({ startDate: "2026-10-01", endDate: "2026-10-12", limit: 2 });
    expect(urlAt(1).pathname).toBe("/v24/customers/1234567890/googleAds:search");
    expect(bodyAt(1)).not.toHaveProperty("pageSize");
    expect(String(bodyAt(1).query)).toContain("segments.date BETWEEN '2026-10-01' AND '2026-10-12'");
    expect(String(bodyAt(1).query)).toContain("LIMIT 2");
    expect(String(bodyAt(1).query)).not.toContain("mutate");
    expect(bodyAt(2)).toEqual({ ...bodyAt(1), pageToken: "page-two" });
    expect(result.campaigns[0]).toMatchObject({ currency: "BRL", cost: 50, costMicros: "50000000" });
    expect(result.totals).toEqual({ clicks: 15, impressions: 200, cost: 60, conversions: 2, conversionValue: 0, ctr: 0.075, scope: "returned_campaigns" });
  });

  it("rejects GAQL injection, impossible dates, invalid ranges, and excessive seeds locally", async () => {
    await expect(ads.getCampaignPerformance({ startDate: "2026-01-01' OR 1=1", endDate: "2026-10-12" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(ads.getCampaignPerformance({ startDate: "2026-02-30", endDate: "2026-10-12" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(ads.getCampaignPerformance({ startDate: "2026-10-13", endDate: "2026-10-12" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(ads.generateKeywordIdeas({ keywords: Array(21).fill("seo") })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(ads.generateKeywordIdeas({})).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(ads.generateKeywordIdeas({ url: "https://username:password@example.com" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects repeated pagination tokens instead of looping paid requests", async () => {
    fetchMock.mockResolvedValueOnce(oauth())
      .mockResolvedValueOnce(json({ results: [], nextPageToken: "loop" }))
      .mockResolvedValueOnce(json({ results: [], nextPageToken: "loop" }));
    await expect(ads.generateKeywordIdeas({ keywords: ["seo"] })).rejects.toMatchObject({ code: "UPSTREAM_INVALID_RESPONSE" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("provider failure boundaries", () => {
  it("does not expose upstream secrets in authentication failures", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "echo test-client-secret test-refresh-token" }, 403));
    const error = await ads.getKeywordMetrics({ keywords: ["seo"] }).catch((value: unknown) => value);
    expect(error).toMatchObject({ code: "UPSTREAM_AUTH_ERROR", status: 502 });
    expect(String(error)).not.toMatch(/test-client-secret|test-refresh-token/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not expose a SerpApi URL in native network errors", async () => {
    fetchMock.mockRejectedValueOnce(new Error("https://serpapi.com/search?api_key=serp-secret-test"));
    const error = await serp.searchSerp({ query: "seo" }).catch((value: unknown) => value);
    expect(error).toMatchObject({ code: "UPSTREAM_CONNECTION_ERROR" });
    expect(String(error)).not.toContain("serp-secret-test");
  });

  it("handles rate limits, malformed JSON and oversized responses without raw bodies", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "private upstream details" }, 429));
    await expect(serp.searchSerp({ query: "seo" })).rejects.toMatchObject({ code: "UPSTREAM_RATE_LIMIT", status: 429 });
    fetchMock.mockResolvedValueOnce(new Response("not-json-private-details"));
    await expect(serp.searchSerp({ query: "seo" })).rejects.toMatchObject({ code: "UPSTREAM_INVALID_RESPONSE" });
    fetchMock.mockResolvedValueOnce(new Response("{}", { headers: { "content-length": "6000000" } }));
    await expect(serp.searchSerp({ query: "seo" })).rejects.toMatchObject({ code: "UPSTREAM_RESPONSE_TOO_LARGE" });
  });

  it("aborts stalled requests after the provider timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const assertion = expect(serp.searchSerp({ query: "seo" })).rejects.toMatchObject({ code: "UPSTREAM_TIMEOUT", status: 504 });
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });

  it("bounds streamed response bytes even when Content-Length is absent", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(1_000_001)); },
      cancel() { cancelled = true; },
    });
    fetchMock.mockResolvedValueOnce(new Response(stream));
    await expect(serp.searchSerp({ query: "seo" })).rejects.toMatchObject({ code: "UPSTREAM_RESPONSE_TOO_LARGE" });
    expect(cancelled).toBe(true);
  });
});
