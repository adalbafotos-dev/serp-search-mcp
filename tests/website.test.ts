import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import http, { type IncomingMessage, type RequestOptions, type ClientRequest } from "node:http";
import {
  analyzeWebsite,
  fetchWebsiteHtml,
  isPublicIpAddress,
  parseWebsiteHtml,
  resolvePublicAddress,
  validateWebsiteUrl,
  type WebsiteNetwork,
} from "../src/lib/website";

const dnsMock = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => dnsMock);

function networkWithHtml(html: string): WebsiteNetwork {
  return {
    resolve: vi.fn().mockResolvedValue([{ address: "93.184.215.14", family: 4 }]),
    request: vi.fn().mockResolvedValue({
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: Buffer.from(html),
    }),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("website SSRF protections", () => {
  it.each([
    "http://localhost/",
    "http://localhost./",
    "http://sub.localhost/",
    "http://printer.local/",
    "http://metadata.internal/",
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://10.1.2.3/",
    "http://172.31.5.1/",
    "http://192.168.0.1/",
    "http://169.254.169.254/",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://192.0.2.1/",
    "http://224.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fe80::1]/",
    "http://[2607:f8b0::1]/",
    "file:///etc/passwd",
    "ftp://example.com/",
    "https://user:password@example.com/",
    "https://example.com:8080/",
  ])("rejects unsafe destination %s", (url) => {
    expect(() => validateWebsiteUrl(url)).toThrow();
  });

  it("accepts public HTTP(S), removes fragments and normalizes trailing dot", () => {
    expect(validateWebsiteUrl("https://example.com./article#section").toString()).toBe("https://example.com/article");
    expect(validateWebsiteUrl("http://8.8.8.8/").hostname).toBe("8.8.8.8");
    expect(isPublicIpAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("blocks DNS containing a private answer even when a public answer comes first", async () => {
    const network = networkWithHtml("<h1>Example</h1>");
    network.resolve = vi.fn().mockResolvedValue([
      { address: "93.184.215.14", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]);
    await expect(fetchWebsiteHtml("https://example.com/", network)).rejects.toMatchObject({ code: "UNSAFE_WEBSITE_ADDRESS" });
    expect(network.request).not.toHaveBeenCalled();
  });

  it("blocks a domain whose only answer is local IPv6", async () => {
    const network = networkWithHtml("<h1>Example</h1>");
    network.resolve = vi.fn().mockResolvedValue([{ address: "fd00::1", family: 6 }]);
    await expect(fetchWebsiteHtml("https://example.com/", network)).rejects.toMatchObject({ code: "UNSAFE_WEBSITE_ADDRESS" });
    expect(network.request).not.toHaveBeenCalled();
  });

  it("uses an approved IPv4 address rather than a subsequent DNS lookup", async () => {
    const network = networkWithHtml("<h1>Example</h1>");
    network.resolve = vi.fn().mockResolvedValue([
      { address: "2607:f8b0::1", family: 6 },
      { address: "93.184.215.14", family: 4 },
    ]);
    await fetchWebsiteHtml("https://example.com/", network);
    expect(network.resolve).toHaveBeenCalledTimes(1);
    expect(network.request).toHaveBeenCalledWith(new URL("https://example.com/"), { address: "93.184.215.14", family: 4 });
  });

  it("pins the actual Node transport lookup while preserving the original URL", async () => {
    dnsMock.lookup.mockResolvedValue([{ address: "93.184.215.14", family: 4 }]);
    let capturedOptions: RequestOptions | undefined;
    let capturedUrl: URL | undefined;
    vi.spyOn(http, "request").mockImplementationOnce(((url: URL, options: RequestOptions, callback: (res: IncomingMessage) => void) => {
      capturedUrl = url;
      capturedOptions = options;
      const req = new EventEmitter() as ClientRequest;
      req.destroy = vi.fn().mockReturnValue(req);
      req.end = vi.fn(() => {
        queueMicrotask(() => {
          const res = new EventEmitter() as IncomingMessage;
          res.statusCode = 200;
          res.headers = { "content-type": "text/html; charset=utf-8" };
          callback(res);
          res.emit("data", Buffer.from("<h1>Example</h1>"));
          res.emit("end");
        });
        return req;
      });
      return req;
    }) as typeof http.request);
    const result = await fetchWebsiteHtml("http://example.com/article");
    expect(result.status).toBe(200);
    expect(capturedUrl?.hostname).toBe("example.com");
    expect(capturedOptions?.agent).toBe(false);
    expect(capturedOptions?.family).toBe(4);
    expect(capturedOptions?.headers).toMatchObject({ "Accept-Encoding": "identity" });
    const callback = vi.fn();
    capturedOptions!.lookup!("example.com", { family: 4 }, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.215.14", 4);
    expect(dnsMock.lookup).toHaveBeenCalledTimes(1);
  });

  it("destroys an actual transport request that exceeds its timeout", async () => {
    vi.useFakeTimers();
    dnsMock.lookup.mockResolvedValue([{ address: "93.184.215.14", family: 4 }]);
    const req = new EventEmitter() as ClientRequest;
    req.destroy = vi.fn().mockReturnValue(req);
    req.end = vi.fn().mockReturnValue(req);
    vi.spyOn(http, "request").mockReturnValueOnce(req);
    const assertion = expect(fetchWebsiteHtml("http://example.com/")).rejects.toMatchObject({ code: "WEBSITE_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(12_000);
    await assertion;
    expect(req.destroy).toHaveBeenCalledTimes(1);
  });

  it("reports the IPv4-only limitation for public AAAA-only domains", async () => {
    await expect(resolvePublicAddress(new URL("https://example.com/"), async () => [
      { address: "2607:f8b0::1", family: 6 },
    ])).rejects.toMatchObject({ code: "WEBSITE_IPV4_REQUIRED" });
  });

  it("validates a redirect before any connection to its target", async () => {
    const network = networkWithHtml("");
    network.request = vi.fn().mockResolvedValue({
      status: 302,
      headers: { location: "http://169.254.169.254/latest/meta-data" },
      body: Buffer.alloc(0),
    });
    await expect(fetchWebsiteHtml("https://example.com/", network)).rejects.toMatchObject({ code: "UNSAFE_WEBSITE_URL" });
    expect(network.request).toHaveBeenCalledTimes(1);
  });

  it("validates DNS anew on a same-host redirect and rejects rebinding", async () => {
    const network = networkWithHtml("");
    network.resolve = vi.fn()
      .mockResolvedValueOnce([{ address: "93.184.215.14", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    network.request = vi.fn().mockResolvedValue({ status: 301, headers: { location: "/next" }, body: Buffer.alloc(0) });
    await expect(fetchWebsiteHtml("https://example.com/", network)).rejects.toMatchObject({ code: "UNSAFE_WEBSITE_ADDRESS" });
    expect(network.request).toHaveBeenCalledTimes(1);
    expect(network.resolve).toHaveBeenCalledTimes(2);
  });

  it("bounds redirect chains", async () => {
    const network = networkWithHtml("");
    network.request = vi.fn().mockResolvedValue({ status: 302, headers: { location: "/loop" }, body: Buffer.alloc(0) });
    await expect(fetchWebsiteHtml("https://example.com/", network)).rejects.toMatchObject({ code: "WEBSITE_REDIRECT_ERROR" });
    expect(network.request).toHaveBeenCalledTimes(5);
  });

  it("times out DNS resolution without making a request", async () => {
    vi.useFakeTimers();
    const network = networkWithHtml("");
    network.resolve = () => new Promise(() => {});
    const assertion = expect(fetchWebsiteHtml("https://example.com/", network)).rejects.toMatchObject({ code: "WEBSITE_DNS_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(12_000);
    await assertion;
    expect(network.request).not.toHaveBeenCalled();
  });

  it("rejects non-HTML resources and responses above the size limit", async () => {
    const network = networkWithHtml("");
    network.request = vi.fn().mockResolvedValue({ status: 200, headers: { "content-type": "application/pdf" }, body: Buffer.from("pdf") });
    await expect(fetchWebsiteHtml("https://example.com/", network)).rejects.toMatchObject({ code: "WEBSITE_NOT_HTML" });
    network.request = vi.fn().mockResolvedValue({ status: 200, headers: { "content-type": "text/html" }, body: Buffer.alloc(2 * 1024 * 1024 + 1) });
    await expect(fetchWebsiteHtml("https://example.com/", network)).rejects.toMatchObject({ code: "WEBSITE_TOO_LARGE" });
  });
});

describe("website observations", () => {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Guia de conteúdo</title><meta name="DESCRIPTION" content="Um guia para blogs.">
    <meta name="robots" content="noindex, follow"><link rel="canonical" href="/guia">
    <meta property="og:title" content="Guia social"><script type="application/ld+json">{"@type":"Article"}</script>
    </head><body><h1>Planejamento</h1><h2>Pesquisa</h2><p>Crie conteúdo com fontes verificadas.</p>
    <img src="image.png"><img src="decoration.png" alt="">
    <a href="/artigo#primeiro">Artigo interno</a><a href="/artigo#segundo">Duplicado</a>
    <a href="https://other.example.com/">Referência externa</a><a href="mailto:hello@example.com">Email</a>
    <script>window.bad = "do not run this";</script><p hidden>Oculto</p></body></html>`;

  it("extracts metadata and observations without executing scripts", () => {
    const page = parseWebsiteHtml(Buffer.from(html), "https://example.com/", true);
    expect(page.title).toBe("Guia de conteúdo");
    expect(page.description).toBe("Um guia para blogs.");
    expect(page.language).toBe("pt-BR");
    expect(page.canonical).toBe("https://example.com/guia");
    expect(page.h1).toEqual(["Planejamento"]);
    expect(page.h2).toEqual(["Pesquisa"]);
    expect(page.links).toHaveLength(2);
    expect(page.links[0]).toMatchObject({ url: "https://example.com/artigo", internal: true });
    expect(page.structuredData).toEqual([{ type: "Article", validJson: true }]);
    expect(page.images).toEqual({ total: 2, missingAltAttribute: 1 });
    expect(page.issues.some((issue) => issue.code === "META_NOINDEX")).toBe(true);
    expect(page.content).not.toContain("window.bad");
    expect(page.content).not.toContain("Oculto");
    expect(page.evidence.contentTrust).toContain("untrusted");
    expect(page).not.toHaveProperty("seoScore");
  });

  it("respects the HTML base and does not treat a different origin as internal", () => {
    const page = parseWebsiteHtml('<base href="https://other.example.com/base/"><a href="article">A</a><link rel="canonical" href="canonical">', "https://example.com/");
    expect(page.links[0]).toMatchObject({ url: "https://other.example.com/base/article", internal: false });
    expect(page.canonical).toBe("https://other.example.com/base/canonical");
  });

  it("honors the HTTP charset for pages that lack a meta charset", () => {
    const encoded = Buffer.from("<title>Conte\u00fado</title>", "latin1");
    expect(parseWebsiteHtml(encoded, "https://example.com/", false, "text/html; charset=ISO-8859-1").title).toBe("Conteúdo");
    expect(parseWebsiteHtml(Buffer.from("<title>Pre\u00e7o \x80</title>", "latin1"), "https://example.com/", false, "text/html; charset=windows-1252").title).toBe("Preço €");
  });

  it("defaults to metadata only and bounds requested text", () => {
    const page = parseWebsiteHtml(`<p>${"word ".repeat(4000)}</p>`, "https://example.com/", true);
    expect(page.content).toHaveLength(12_000);
    expect(page.contentTruncated).toBe(true);
    expect(page.wordCount).toBe(4000);
    expect(parseWebsiteHtml(html, "https://example.com/")).not.toHaveProperty("content");
  });

  it("reports invalid JSON-LD without failing the whole page", () => {
    const page = parseWebsiteHtml('<h1>Page</h1><script type="application/ld+json">{invalid}</script>', "https://example.com/");
    expect(page.issues.some((issue) => issue.code === "INVALID_JSON_LD")).toBe(true);
  });

  it("bounds all page attempts and preserves recoverable page failures", async () => {
    const network = networkWithHtml('<h1>Root</h1><a href="/private">A</a><a href="/okay">B</a><a href="/never">C</a><a href="https://elsewhere.example.com/">D</a>');
    network.request = vi.fn(async (url) => {
      if (url.pathname === "/private") return { status: 302, headers: { location: "http://127.0.0.1/" }, body: Buffer.alloc(0) };
      return { status: 200, headers: { "content-type": "text/html" }, body: Buffer.from(url.pathname === "/" ? '<h1>Root</h1><a href="/private">A</a><a href="/okay">B</a><a href="/never">C</a><a href="https://elsewhere.example.com/">D</a>' : "<h1>Okay</h1>") };
    });
    const result = await analyzeWebsite({ url: "https://example.com/", maxPages: 3 }, network);
    expect(result.pagesAnalyzed).toBe(2);
    expect(result.pages[1].url).toBe("https://example.com/okay");
    expect(result.skippedPages[0]).toMatchObject({ code: "UNSAFE_WEBSITE_URL" });
    expect(network.request).toHaveBeenCalledTimes(3);
    expect(result.pages.every((page) => !Object.hasOwn(page, "content"))).toBe(true);
  });

  it("prevents an internal page redirect from leaving the analyzed origin", async () => {
    const network = networkWithHtml("");
    network.request = vi.fn().mockResolvedValue({ status: 302, headers: { location: "https://another.example.com/" }, body: Buffer.alloc(0) });
    await expect(fetchWebsiteHtml("https://example.com/article", network, "https://example.com")).rejects.toMatchObject({ code: "WEBSITE_CROSS_ORIGIN_REDIRECT" });
    expect(network.request).toHaveBeenCalledTimes(1);
  });

  it("rejects page counts that could create unbounded crawls", async () => {
    const network = networkWithHtml("<h1>Root</h1>");
    await expect(analyzeWebsite({ url: "https://example.com/", maxPages: 50 }, network)).rejects.toMatchObject({ code: "INVALID_WEBSITE_INPUT" });
    expect(network.request).not.toHaveBeenCalled();
  });

  it("aborts the initial download at the global analysis budget", async () => {
    vi.useFakeTimers();
    const network = networkWithHtml("");
    let signal: AbortSignal | undefined;
    network.request = vi.fn((_url, _address, requestSignal) => {
      signal = requestSignal;
      return new Promise<never>(() => {});
    });
    const assertion = expect(analyzeWebsite({ url: "https://example.com/" }, network)).rejects.toMatchObject({ code: "WEBSITE_ANALYSIS_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });

  it("returns explicit partial results if an additional page exhausts the budget", async () => {
    vi.useFakeTimers();
    const network = networkWithHtml("");
    network.request = vi.fn()
      .mockResolvedValueOnce({ status: 200, headers: { "content-type": "text/html" }, body: Buffer.from('<h1>Root</h1><a href="/pending">Next</a>') })
      .mockImplementationOnce(() => new Promise(() => {}));
    const pending = analyzeWebsite({ url: "https://example.com/", maxPages: 2 }, network);
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await pending;
    expect(result.pagesAnalyzed).toBe(1);
    expect(result.truncatedByTimeBudget).toBe(true);
    expect(result.skippedPages[0]).toMatchObject({ code: "WEBSITE_ANALYSIS_TIMEOUT" });
  });
});
