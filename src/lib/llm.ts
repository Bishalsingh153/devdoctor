import OpenAI from "openai";
import type { Issue } from "../scanner/types.js";

const MODEL = "openai/gpt-oss-120b";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const EXPLAIN_SYSTEM_PROMPT =
  "You are a senior engineer explaining a code health issue to a developer in plain, direct language. Be concrete about WHY it matters and what could go wrong if ignored. Keep it under 150 words. No fluff, no restating the issue title.";

const FIX_SYSTEM_PROMPT = `You are a senior engineer applying minimal, targeted fixes to a codebase.
Propose the smallest change that resolves the given issue. Be conservative.
Return a JSON array with one entry per file that needs changing. Each entry must be:
{"file": "<path relative to project root>", "newContent": "<full new file content>", "summary": "<one sentence>"}
Use full new file content, not a patch format.
Never use the npm placeholder test script that contains "Error: no test specified".
Respond with ONLY a raw JSON array, no markdown code fences, no explanation text before or after.`;

export interface ProposedFix {
  file: string;
  newContent: string;
  summary: string;
}

export class LlmRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmRequestError";
  }
}

function requireApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY not set. Export it or add it to a .env file in your project root.",
    );
  }
  return apiKey;
}

function createClient(): OpenAI {
  return new OpenAI({
    apiKey: requireApiKey(),
    baseURL: GROQ_BASE_URL,
  });
}

export function llmErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("GROQ_API_KEY not set")) {
    return error.message;
  }

  if (error instanceof OpenAI.RateLimitError) {
    return "Groq is rate-limited right now. Wait a moment and try again.";
  }

  if (error instanceof OpenAI.AuthenticationError) {
    return "Groq API key was rejected. Check GROQ_API_KEY and try again.";
  }

  if (error instanceof OpenAI.APIConnectionError) {
    return "Could not reach Groq. Check your network and try again.";
  }

  if (error instanceof OpenAI.APIError) {
    return "Groq could not complete this request right now. Try again in a bit.";
  }

  return "Groq could not complete this request right now. Try again in a bit.";
}

async function complete(
  client: OpenAI,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxTokens: number,
): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: maxTokens,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new LlmRequestError(
      "Groq returned an empty response. Try again in a bit.",
    );
  }
  return content;
}

export async function explainIssue(issue: Issue): Promise<string> {
  const client = createClient();

  try {
    return await complete(
      client,
      [
        { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(issue) },
      ],
      500,
    );
  } catch (error) {
    if (error instanceof LlmRequestError) {
      throw error;
    }
    throw new LlmRequestError(llmErrorMessage(error));
  }
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isProposedFix(value: unknown): value is ProposedFix {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.file === "string" &&
    typeof record.newContent === "string" &&
    typeof record.summary === "string"
  );
}

export async function proposeFix(
  issue: Issue,
  fileContents: Record<string, string>,
): Promise<ProposedFix[]> {
  const client = createClient();
  let raw = "";

  try {
    raw = await complete(
      client,
      [
        { role: "system", content: FIX_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({ issue, files: fileContents }),
        },
      ],
      4096,
    );
  } catch (error) {
    if (error instanceof LlmRequestError) {
      throw error;
    }
    throw new LlmRequestError(llmErrorMessage(error));
  }

  const stripped = stripJsonFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new LlmRequestError(
      `Failed to parse fix JSON. Raw response:\n${raw}`,
    );
  }

  if (!Array.isArray(parsed) || !parsed.every(isProposedFix)) {
    throw new LlmRequestError(
      `Failed to parse fix JSON. Raw response:\n${raw}`,
    );
  }

  return parsed;
}
