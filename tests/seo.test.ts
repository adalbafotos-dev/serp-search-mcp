import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/lib/errors";
import type { SerpResponse } from "../src/lib/providers/serp";

const mocks = vi.hoisted(() => ({ search: vi.fn(), website: vi.fn() }));
vi.mock("../src/lib/providers/serp", () => ({ searchSerp: mocks.search }));
vi.mock("../src/lib/website", () => ({ analyzeWebsite: mocks.website }));
import { auditSeo, checkSerpRank, summarizeSerpRank } from "../src/lib/seo";

function evidence(): SerpResponse {
  return { provider: "dataforseo", query: "fotografia profissional", country: "br", language: "pt", type: "search",
    fetchedAt: "2026-10-13T22:00:00Z", requestsUsed: 1, truncated: false, costUsd: 0.002,
    relatedSearches: ["fotógrafo"], questions: [], results: [
      { title: "Outro", url: "https://cliente.com.br.evil.example/", snippet: "", position: 1 },
      { title: "Outro", url: "https://outrocliente.com.br/", snippet: "", position: 2 },
      { title: "Cliente", url: "https://www.cliente.com.br/servicos", snippet: "", position: 4 },
      { title: "Cliente", url: "https://cliente.com.br/", snippet: "", position: 7 },
    ] };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.search.mockResolvedValue(evidence());
  mocks.website.mockResolvedValue({ pages: [{ url: "https://cliente.com.br/", title: "Cliente" }], warnings: [] });
});

describe("SEO evidence and ranking", () => {
  it("matches only the domain and real subdomains, preserving the provider evidence", () => {
    const serp = evidence();
    const result = summarizeSerpRank(serp, "https://cliente.com.br/servicos");
    expect(result.bestObservedPosition).toBe(4);
    expect(result.matchedResults).toHaveLength(2);
    expect(result.serp).toBe(serp);
    expect(summarizeSerpRank(serp, "cliente.com.br", false).bestObservedPosition).toBe(7);
  });
  it("keeps missing rank as null, and absence limited to the returned sample", () => {
    const serp = evidence();
    const missing = summarizeSerpRank(serp, "ausente.com.br");
    expect(missing).toMatchObject({ status: "not_found_in_returned_results", bestObservedPosition: null, resultsInspected: 4 });
    serp.results[2].position = null;
    serp.results[3].position = null;
    expect(summarizeSerpRank(serp, "cliente.com.br")).toMatchObject({ status: "found", bestObservedPosition: null });
  });
  it("does not rewrite a keyword into site:, and flags site: queries separately", async () => {
    await checkSerpRank({ site: "cliente.com.br", keyword: "fotografia profissional", country: "us", language: "en", limit: 20 });
    expect(mocks.search).toHaveBeenCalledWith({ query: "fotografia profissional", country: "us", language: "en", limit: 20, type: "search" });
    expect(summarizeSerpRank({ ...evidence(), query: "site:cliente.com.br" }, "cliente.com.br").queryType).toBe("site-filtered");
  });
  it("rejects invalid domains and over-budget or repeated keywords before calls", async () => {
    await expect(checkSerpRank({ site: "https://user:secret@cliente.com.br", keyword: "SEO" })).rejects.toThrow();
    await expect(auditSeo({ url: "https://cliente.com.br", keywords: ["a1", "a2", "a3", "a4"] })).rejects.toThrow();
    await expect(auditSeo({ url: "https://cliente.com.br", keywords: ["SEO", "seo"] })).rejects.toThrow();
    await expect(auditSeo({ url: "ftp://cliente.com.br", keywords: ["SEO"] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.website).not.toHaveBeenCalled();
  });
  it("combines public HTML and bounded SERPs without any private client integration", async () => {
    const result = await auditSeo({ url: "https://cliente.com.br", keywords: ["fotografia", "retrato"], country: "pt", language: "pt", maxPages: 5 });
    expect(result.status).toBe("complete");
    expect(result.evidence).toHaveLength(3);
    expect(mocks.search).toHaveBeenCalledTimes(2);
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ country: "pt", language: "pt" }));
    expect(mocks.website).toHaveBeenCalledWith({ url: "https://cliente.com.br", maxPages: 5, includeContent: true });
  });
  it("retains useful SERP evidence when the website fails, without leaking native errors", async () => {
    mocks.website.mockRejectedValue(new Error("private-secret-in-error"));
    const result = await auditSeo({ url: "https://cliente.com.br", keywords: ["fotografia"] });
    expect(result.status).toBe("partial");
    expect(result.evidence[0].source).toBe("serp:fotografia");
    expect(result.warnings).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("private-secret-in-error");
  });
  it("retains HTML when the SERP provider fails and reports failure when all sources fail", async () => {
    mocks.search.mockRejectedValue(new AppError("Saldo insuficiente.", "UPSTREAM_PAYMENT_REQUIRED", 402));
    expect((await auditSeo({ url: "https://cliente.com.br", keywords: ["fotografia"] })).evidence[0].source).toBe("website");
    mocks.website.mockRejectedValue(new Error("website-down"));
    await expect(auditSeo({ url: "https://cliente.com.br", keywords: ["fotografia"] })).rejects.toMatchObject({ code: "SEO_AUDIT_UNAVAILABLE" });
  });
});
