import { afterEach, describe, expect, it, vi } from "vitest";
import { aiStatus, extract, interpret } from "../lib/ai";
import { sample } from "../lib/core";
const keys = [
  "AI_PROVIDER",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_FREE_TIER_CONFIRMED",
  "OPENAI_API_KEY",
  "ALLOW_PAID_AI",
];
afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of keys) delete process.env[key];
});
function setup(value: unknown) {
  process.env.AI_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "test-free-key";
  process.env.GEMINI_FREE_TIER_CONFIRMED = "true";
  const fetcher = vi.fn(async () =>
    Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text: JSON.stringify(value) }] },
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const image = () =>
  new File(
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])],
    "synthetic.png",
    { type: "image/png" },
  );
describe("zero-cost AI policy and Gemini contracts, mocked only", () => {
  it("defaults to manual mode even if an OpenAI key is present", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(aiStatus().ready).toBe(false);
    await expect(extract(image())).rejects.toThrow("manual mode");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("blocks OpenAI without explicit paid-AI opt-in", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(extract(image())).rejects.toThrow("zero-cost policy");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires billing-disabled Free Tier confirmation before calling Gemini", async () => {
    const fetcher = setup(sample.receipt);
    delete process.env.GEMINI_FREE_TIER_CONFIRMED;
    expect(aiStatus().ready).toBe(false);
    await expect(extract(image())).rejects.toThrow("billing disabled");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects missing keys and models outside the reviewed free profile", async () => {
    const fetcher = setup(sample.receipt);
    delete process.env.GEMINI_API_KEY;
    await expect(extract(image())).rejects.toThrow("GEMINI_API_KEY");
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "paid-or-unknown";
    await expect(extract(image())).rejects.toThrow("zero-cost profile");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("sends image data and structured JSON schema to the reviewed Gemini endpoint", async () => {
    const fetcher = setup(sample.receipt);
    expect(await extract(image())).toEqual(sample.receipt);
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    );
    expect(
      (calls[0][1].headers as Record<string, string>)["x-goog-api-key"],
    ).toBe("test-free-key");
    const body = JSON.parse(calls[0][1].body as string);
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe("image/png");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.additionalProperties).toBe(
      false,
    );
  });
  it("preserves schema validation, unsupported-currency rejection and missing totals", async () => {
    setup({ ...sample.receipt, currency: "EUR" });
    await expect(extract(image())).rejects.toThrow("USD");
    setup({ ...sample.receipt, total: null });
    await expect(extract(image())).rejects.toThrow("grand total is unreadable");
  });
  it("returns allocations without monetary authority", async () => {
    setup({
      assignments: Object.entries(sample.assignments).map(
        ([itemId, dinerIds]) => ({ itemId, dinerIds }),
      ),
      charges: "equal",
    });
    const result = await interpret(
      "John burgers, Mary pizza, Alex pasta; share sides.",
      sample,
    );
    expect(result.assignments).toEqual(sample.assignments);
    expect(result).not.toHaveProperty("amount");
  });
  it("stops on quota exhaustion without falling back to a paid provider", async () => {
    setup(sample.receipt);
    process.env.OPENAI_API_KEY = "test-key";
    const fetcher = vi.fn(async () => new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(extract(image())).rejects.toThrow("free quota");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects blocked, truncated and malformed Gemini responses", async () => {
    setup(sample.receipt);
    for (const value of [
      { promptFeedback: { blockReason: "SAFETY" } },
      { candidates: [{ finishReason: "MAX_TOKENS" }] },
      {
        candidates: [
          { finishReason: "STOP", content: { parts: [{ text: "invalid" }] } },
        ],
      },
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json(value)),
      );
      await expect(extract(image())).rejects.toThrow();
    }
  });
});
