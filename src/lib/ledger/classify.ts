import { createServerFn } from "@tanstack/react-start";
import { CATEGORIES, type ClassifyResult, type Section } from "./types";

const MAX_IMAGE = 1_800_000;

const SYSTEM = `You file one photo into a personal finance daybook. Reply with JSON only.
Keys:
- section: "income" | "spending" | "debt" | "inbox"
- amount: number or null. Dollars. Paycheck = net pay. Receipt = total paid. Debt = payment due or payment made. Positive, never negative.
- balance: number or null. Remaining debt balance in dollars if a statement shows one, else null.
- label: merchant, employer, or lender. Max 40 characters.
- category: one allowed category for that section.
- date: YYYY-MM-DD if a date is visible, else null.
- confidence: number from 0 to 1.
Allowed categories:
income: ${CATEGORIES.income.join(", ")}
spending: ${CATEGORIES.spending.join(", ")}
debt: ${CATEGORIES.debt.join(", ")}
Rules:
- Paystubs, deposits, and refunds received are income.
- Store receipts, rent, utilities, gas, groceries, and subscriptions are spending, even if a card paid them.
- Credit card statements, loan bills, and lender "amount due" notices are debt.
- If it is not a money document, use section "inbox", amount null, label "Not a money slip".
- If you cannot read an amount, use null. Do not guess a number.`;

type ModelJson = {
  section?: string;
  amount?: unknown;
  balance?: unknown;
  label?: unknown;
  category?: unknown;
  date?: unknown;
  confidence?: unknown;
};

function asDollars(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10_000_000) {
    return null;
  }
  return Math.round(value * 100);
}

function asSection(value: unknown): Section | "inbox" {
  if (value === "income" || value === "spending" || value === "debt" || value === "inbox") return value;
  return "inbox";
}

function parseModel(text: string): ClassifyResult {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  let parsed: ModelJson;
  try {
    parsed = JSON.parse(trimmed) as ModelJson;
  } catch {
    return { ok: false, error: "Could not read a section from that photo" };
  }
  const section = asSection(parsed.section);
  const categoryList = section === "inbox" ? CATEGORIES.spending : CATEGORIES[section];
  const category =
    typeof parsed.category === "string" && categoryList.includes(parsed.category)
      ? parsed.category
      : "Other";
  const labelRaw = typeof parsed.label === "string" ? parsed.label.trim() : "";
  const date =
    typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;
  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.5;
  return {
    ok: true,
    section,
    amountCents: asDollars(parsed.amount),
    balanceCents: asDollars(parsed.balance),
    label: (labelRaw || "Untitled slip").slice(0, 40),
    category,
    date,
    confidence,
  };
}

async function ask(apiKey: string, image: string, model: string, jsonMode: boolean): Promise<Response> {
  return fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 700,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${image}`, detail: "high" },
            },
            { type: "text", text: "Sort this slip." },
          ],
        },
      ],
    }),
  });
}

function messageText(payload: unknown): string {
  const content = (payload as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
    ?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String(part.text ?? "");
        return "";
      })
      .join("");
  }
  return "";
}

export const classifySlip = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const image = (input as { image?: unknown } | null)?.image;
    if (typeof image !== "string") throw new Error("Missing photo");
    const cleaned = image.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, "");
    if (cleaned.length < 32 || cleaned.length > MAX_IMAGE) throw new Error("That photo is too large");
    if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) throw new Error("That photo could not be read");
    return { image: cleaned };
  })
  .handler(async ({ data }): Promise<ClassifyResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Photo sorting is unavailable right now" };
    let response = await ask(apiKey, data.image, "grok-4.5", true);
    if (!response.ok && (response.status === 400 || response.status === 404)) {
      response = await ask(apiKey, data.image, "grok-4", false);
    }
    if (!response.ok) return { ok: false, error: "Photo sorting failed. File this one by hand." };
    const payload: unknown = await response.json();
    const text = messageText(payload);
    if (!text) return { ok: false, error: "No reading came back for that photo" };
    return parseModel(text);
  });
