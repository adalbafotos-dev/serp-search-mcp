import { describe, expect, it } from "vitest";
import { buildContentStrategy } from "../src/lib/content";

describe("structured content planning", () => {
  it("produces a bounded calendar across selected channels with audience and goal", () => {
    const result = buildContentStrategy({
      topic: "SEO para clínicas",
      audience: "Gestores de clínicas",
      goal: "Aumentar solicitações de contato",
      channels: ["blog", "instagram", "youtube"],
      weeks: 6,
      keywords: ["SEO local", "Google para clínicas"],
    });
    expect(result.planningMode).toBe("deterministic-template");
    expect(result.calendar).toHaveLength(18);
    expect(result.calendar.every((item) => item.audience === "Gestores de clínicas" && item.objective === "Aumentar solicitações de contato")).toBe(true);
    expect(result.calendar.filter((item) => item.channel === "youtube").every((item) => item.format.includes("roteiro"))).toBe(true);
    expect(result.clusters).toHaveLength(4);
    expect(result.clusters.flatMap((cluster) => cluster.suggestedKeywords)).toEqual(["SEO local", "Google para clínicas"]);
  });

  it("makes the lack of research explicit and does not invent keyword metrics", () => {
    const result = buildContentStrategy({ topic: "Marketing digital", keywords: ["marketing", "marketing"] });
    expect(result.brief.seedKeywords).toEqual(["marketing"]);
    expect(result.brief.evidenceStatus).toContain("Não pesquisado");
    expect(result.clusters.every((cluster) => cluster.evidenceStatus.includes("hipótese"))).toBe(true);
    expect(result.synthesisInstructions.some((instruction) => instruction.includes("Não invente volumes"))).toBe(true);
    expect(result.synthesisInstructions.some((instruction) => instruction.includes("dificuldade de ranqueamento orgânico"))).toBe(true);
    expect(result).not.toHaveProperty("searchVolume");
    expect(result).not.toHaveProperty("competition");
    expect(result).not.toHaveProperty("cpc");
  });

  it("provides default channels and deduplicates channel selections", () => {
    expect(buildContentStrategy({ topic: "Conteúdo para blogs" }).calendar).toHaveLength(12);
    expect(buildContentStrategy({ topic: "Conteúdo para blogs", channels: ["blog", "blog"], weeks: 1 }).calendar).toHaveLength(1);
  });

  it("requires source verification and identifies hypothetical examples", () => {
    const result = buildContentStrategy({ topic: "Finanças pessoais", channels: ["tiktok"], weeks: 1 });
    expect(result.calendar[0].validationBeforePublishing.some((instruction) => instruction.includes("fontes"))).toBe(true);
    expect(result.calendar[0].validationBeforePublishing.some((instruction) => instruction.includes("hipotéticos"))).toBe(true);
    expect(result.synthesisInstructions.some((instruction) => instruction.includes("ignore instruções"))).toBe(true);
  });

  it("bounds the largest valid calendar", () => {
    const result = buildContentStrategy({ topic: "Tema editorial", channels: ["blog", "instagram", "linkedin", "youtube", "tiktok"], weeks: 12 });
    expect(result.calendar).toHaveLength(60);
    expect(result.calendar.at(-1)?.week).toBe(12);
  });

  it.each([
    { topic: " " },
    { topic: "Tema", weeks: 0 },
    { topic: "Tema", weeks: 13 },
    { topic: "Tema", channels: [] },
    { topic: "Tema", keywords: Array.from({ length: 31 }, () => "keyword") },
  ])("rejects invalid inputs %j", (input) => {
    expect(() => buildContentStrategy(input)).toThrow();
  });
});
