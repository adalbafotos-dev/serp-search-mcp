import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let api: typeof import("../src/lib/providers/search-console");
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const siteUrl = "sc-domain:example.com";
const period = { siteUrl, startDate: "2026-09-01", endDate: "2026-09-30" };

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID", "gsc-client-test");
  vi.stubEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET", "private-gsc-secret");
  vi.stubEnv("GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN", "private-gsc-refresh");
  vi.stubEnv("GOOGLE_SEARCH_CONSOLE_SITE_URL", "");
  vi.stubEnv("GOOGLE_SEARCH_CONSOLE_ALLOWED_SITES", "");
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  api = await import("../src/lib/providers/search-console");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function responses(data: unknown) {
  fetchMock.mockResolvedValueOnce(json({ access_token: "private-gsc-access", expires_in: 3600 })).mockResolvedValueOnce(json(data));
}
const requestBody = (index = 1) => JSON.parse(String(fetchMock.mock.calls[index]?.[1]?.body));

describe("Search Console read-only provider", () => {
  it("discovers properties using separate OAuth credentials and caches the access token", async () => {
    responses({ siteEntry: [{ siteUrl, permissionLevel: "siteOwner" }] });
    const result = await api.listSearchConsoleSites();
    expect(result.sites).toEqual([{ siteUrl, permissionLevel: "siteOwner" }]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://oauth2.googleapis.com/token");
    const tokenBody = new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body));
    expect(tokenBody.get("refresh_token")).toBe("private-gsc-refresh");
    expect(fetchMock.mock.calls[1]).toEqual(["https://www.googleapis.com/webmasters/v3/sites", expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer private-gsc-access" } })]);
    expect(JSON.stringify(result)).not.toMatch(/private-gsc/);
    fetchMock.mockResolvedValueOnce(json({ siteEntry: [] }));
    await api.listSearchConsoleSites();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("uses encoded property and preserves metric values, dimensions, filters and paging", async () => {
    responses({ rows: [{ keys: ["seo", "https://example.com/blog/"], clicks: 7, impressions: 100, ctr: 0.07, position: 6.25 }], responseAggregationType: "byPage" });
    const result = await api.getSearchConsolePerformance({ ...period, rowLimit: 1, startRow: 4, filters: [{ dimension: "country", expression: "bra" }] });
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/searchAnalytics/query");
    expect(requestBody()).toEqual({ startDate: period.startDate, endDate: period.endDate, dimensions: ["query", "page"], type: "web", dataState: "final", aggregationType: "auto", rowLimit: 1, startRow: 4, dimensionFilterGroups: [{ groupType: "and", filters: [{ dimension: "country", operator: "equals", expression: "bra" }] }] });
    expect(result.rows).toEqual([{ dimensions: { query: "seo", page: "https://example.com/blog/" }, clicks: 7, impressions: 100, ctr: 0.07, averagePosition: 6.25 }]);
    expect(result).toMatchObject({ aggregationType: "byPage", limitReached: true, nextStartRow: 5, period: { timezone: "America/Los_Angeles" } });
    expect(result.notes.join(" ")).toContain("não é uma posição fixa");
  });

  it("retains missing metrics as null and empty results as empty evidence", async () => {
    responses({ rows: [{ keys: ["seo"] }] });
    const result = await api.getSearchConsolePerformance({ ...period, dimensions: ["query"] });
    expect(result.rows[0]).toMatchObject({ clicks: null, impressions: null, ctr: null, averagePosition: null });
    fetchMock.mockResolvedValueOnce(json({}));
    const empty = await api.getSearchConsolePerformance(period);
    expect(empty.rows).toEqual([]);
    expect(empty.nextStartRow).toBeNull();
  });

  it("uses the configured default property and encodes URL-prefix paths without endpoint injection", async () => {
    vi.stubEnv("GOOGLE_SEARCH_CONSOLE_SITE_URL", "https://example.com/blog/");
    responses({});
    await api.getSearchConsolePerformance({ startDate: period.startDate, endDate: period.endDate });
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fexample.com%2Fblog%2F/searchAnalytics/query");
  });

  it.each([
    { ...period, startDate: "2026-02-30" },
    { ...period, endDate: "2026-08-01" },
    { ...period, dimensions: ["query", "query"] },
    { ...period, rowLimit: 1001 },
    { ...period, siteUrl: "https://user:password@example.com/" },
    { ...period, siteUrl: "https://example.com/fragment/#bad" },
  ])("rejects invalid queries before requesting OAuth", async input => {
    await expect(api.getSearchConsolePerformance(input as never)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces the configured property allowlist and filters property discovery", async () => {
    vi.stubEnv("GOOGLE_SEARCH_CONSOLE_ALLOWED_SITES", siteUrl);
    await expect(api.getSearchConsolePerformance({ ...period, siteUrl: "sc-domain:other.example" })).rejects.toMatchObject({ code: "PROPERTY_NOT_ALLOWED" });
    expect(fetchMock).not.toHaveBeenCalled();
    responses({ siteEntry: [{ siteUrl, permissionLevel: "siteOwner" }, { siteUrl: "sc-domain:other.example", permissionLevel: "siteOwner" }] });
    expect((await api.listSearchConsoleSites()).sites).toHaveLength(1);
  });

  it("fails closed for missing Search Console credentials without reusing the Ads token", async () => {
    vi.stubEnv("GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN", "");
    vi.stubEnv("GOOGLE_ADS_REFRESH_TOKEN", "private-ads-refresh");
    await expect(api.listSearchConsoleSites()).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns safe permission failures without disclosing the upstream response", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "private-gsc-access", expires_in: 3600 })).mockResolvedValueOnce(json({ error: { message: "private-gsc-secret private-gsc-refresh" } }, 403));
    const error = await api.getSearchConsolePerformance(period).catch(error => error);
    expect(error).toMatchObject({ code: "UPSTREAM_AUTH_ERROR" });
    expect(String(error)).not.toMatch(/private-gsc/);
  });

  it("inspects indexed state for a subdomain without making a live crawl or indexing request", async () => {
    responses({ inspectionResult: { inspectionResultLink: "https://search.google.com/search-console/inspect", indexStatusResult: { verdict: "PASS", coverageState: "Indexed", googleCanonical: "https://www.example.com/page", sitemap: ["https://example.com/sitemap.xml"] } } });
    const result = await api.inspectSearchConsoleUrl({ siteUrl, inspectionUrl: "https://www.example.com/page" });
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect");
    expect(requestBody()).toEqual({ siteUrl, inspectionUrl: "https://www.example.com/page", languageCode: "pt-BR" });
    expect(result.indexStatus).toMatchObject({ verdict: "PASS", lastCrawlTime: null });
    expect(result.notes.join(" ")).toContain("não solicita indexação");
  });

  it.each([
    { siteUrl, inspectionUrl: "https://example.com.attacker.test/" },
    { siteUrl: "https://example.com/blog/", inspectionUrl: "https://example.com/blogger/" },
    { siteUrl: "https://example.com/", inspectionUrl: "http://example.com/" },
  ])("rejects inspections outside the requested property before making a call", async input => {
    await expect(api.inspectSearchConsoleUrl(input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists submitted sitemaps with GET and keeps unavailable indexed counts as null", async () => {
    responses({ sitemap: [{ path: "https://example.com/sitemap.xml", warnings: "1", errors: "0", contents: [{ type: "web", submitted: "12" }] }] });
    const result = await api.listSearchConsoleSitemaps({ siteUrl });
    expect(fetchMock.mock.calls[1][1]?.method).toBe("GET");
    expect(result.sitemaps[0]).toMatchObject({ warnings: 1, errors: 0, contents: [{ type: "web", submitted: 12, indexed: null }] });
  });

  it("rejects malformed response rows rather than manufacturing empty metrics", async () => {
    responses({ rows: { error: "wrong shape" } });
    await expect(api.getSearchConsolePerformance(period)).rejects.toMatchObject({ code: "UPSTREAM_INVALID_RESPONSE" });
  });
});
