import { Fault } from "./core";

export const FREE_GEMINI_MODEL = "gemini-3.5-flash-lite";
export function geminiReady() {
  return (
    !!process.env.GEMINI_API_KEY &&
    process.env.GEMINI_FREE_TIER_CONFIRMED === "true" &&
    (process.env.GEMINI_MODEL || FREE_GEMINI_MODEL) === FREE_GEMINI_MODEL
  );
}
export async function gemini(messages: unknown[], schema: unknown) {
  if (process.env.GEMINI_FREE_TIER_CONFIRMED !== "true")
    throw new Fault(
      503,
      "Confirm that your Gemini project is on the Free Tier with billing disabled, then set GEMINI_FREE_TIER_CONFIRMED=true on the server. Do not enable billing.",
    );
  if (!process.env.GEMINI_API_KEY)
    throw new Fault(
      503,
      "GEMINI_API_KEY is not configured. Add a key from a billing-disabled Free Tier project on the server.",
    );
  const model = process.env.GEMINI_MODEL || FREE_GEMINI_MODEL;
  if (model !== FREE_GEMINI_MODEL)
    throw new Fault(
      503,
      "The zero-cost profile supports only " +
        FREE_GEMINI_MODEL +
        ". Verify current free-tier availability before changing this policy.",
    );
  const input = messages as {
    role: string;
    content:
      string | { type: string; text?: string; image_url?: { url: string } }[];
  }[];
  const instructions = input
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
  const parts: (
    { text: string } | { inlineData: { mimeType: string; data: string } }
  )[] = [];
  for (const message of input.filter((message) => message.role === "user")) {
    if (typeof message.content === "string")
      parts.push({ text: message.content });
    else
      for (const part of message.content) {
        if (part.type === "text" && part.text) parts.push({ text: part.text });
        if (part.type === "image_url") {
          const match = part.image_url?.url.match(
            /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/,
          );
          if (!match) throw new Fault(422, "Unsupported receipt image data");
          parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      }
  }
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      model +
      ":generateContent",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
        },
      }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (response.status === 429)
    throw new Fault(
      429,
      "Gemini free quota is unavailable or exhausted. Wait or use manual mode; no paid provider fallback is enabled.",
    );
  if (!response.ok)
    throw new Fault(
      502,
      "Gemini could not process this request. Check the free project, API key, region and model access. Stop if Google requests billing or a credit card.",
    );
  const result = await response.json();
  const candidate = result.candidates?.[0];
  if (result.promptFeedback?.blockReason || candidate?.finishReason !== "STOP")
    throw new Fault(
      422,
      "Gemini could not confidently process this input. Review it manually.",
    );
  const text = candidate.content?.parts
    ?.filter(
      (part: { text?: string; thought?: boolean }) =>
        part.text && !part.thought,
    )
    .map((part: { text: string }) => part.text)
    .join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new Fault(502, "Gemini returned an unreadable result");
  }
}
