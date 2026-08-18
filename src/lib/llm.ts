import OpenAI from "openai";
import type { Issue } from "../scanner/types.js";

const MODEL = "openai/gpt-oss-120b";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/** Groq list prices for openai/gpt-oss-120b (USD per 1M tokens). Not a live quote. */
export const GROQ_PRICING = {
  model: MODEL,
  inputUsdPerMillion: 0.15,
  outputUsdPerMillion: 0.6,
} as const;

const EXPLAIN_SYSTEM_PROMPT =
  "You are a senior engineer explaining a code health issue to a developer in plain, direct language. Be concrete about WHY it matters and what could go wrong if ignored. Keep it under 150 words. No fluff, no restating the issue title.";

const FIX_SYSTEM_PROMPT = `You are a senior engineer applying minimal, targeted fixes to a codebase.
Propose the smallest change that resolves the given issue. Be conservative.
Return a JSON array with one entry per file that needs changing. Each entry must be:
{"file": "<path relative to project root>", "newContent": "<full new file content>", "summary": "<one sentence>"}
Use full new file content, not a patch format.
Never use the npm placeholder test script that contains "Error: no test specified".
Never propose a placeholder, stub, or fake fix that merely silences the check without solving the underlying problem. For a missing test script specifically: if the project has no test framework installed, propose adding a minimal one (prefer vitest for TS projects) as a devDependency AND write one real, meaningful test file that actually exercises existing code, plus a real 'test' script that runs it. Do not just add a script that echoes a message.
Never satisfy a check by obfuscating, renaming, splitting, or otherwise disguising the pattern being detected, without addressing the underlying problem. For example: do not break up a flagged string (like 'TODO') via concatenation, string interpolation, or encoding tricks just to dodge a regex — that hides the issue instead of resolving it. For TODO comments specifically: either actually implement what the TODO describes, or if that's out of scope, replace it with a proper tracked comment explaining the current limitation and why (not simply removing or disguising the word 'TODO').
Only change file contents. Never instruct the tool to run shell commands (npm update, git rm, etc.) as if they will be executed automatically. For a committed .env file: add the filename to .gitignore only — do not rewrite secret files; remind the user in the summary to run \`git rm --cached <file>\` themselves. For outdated dependencies: only edit package.json if a conservative version bump is clearly safe; do not assume lockfile or install steps will run.
Respond with ONLY a raw JSON array, no markdown code fences, no explanation text before or after.`;

export interface ProposedFix {
  file: string;
  newContent: string;
  summary: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProposeFixResult {
  fixes: ProposedFix[];
  usage: LlmUsage | null;
  elapsedMs: number;
}

export function estimateCostUsd(usage: Pick<LlmUsage, "promptTokens" | "completionTokens">): number {
  return (
    (usage.promptTokens / 1_000_000) * GROQ_PRICING.inputUsdPerMillion +
    (usage.completionTokens / 1_000_000) * GROQ_PRICING.outputUsdPerMillion
  );
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

function toUsage(
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
): LlmUsage | null {
  if (!usage) {
    return null;
  }
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

async function complete(
  client: OpenAI,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxTokens: number,
): Promise<{
  content: string;
  finishReason: string | null | undefined;
  usage: LlmUsage | null;
  elapsedMs: number;
}> {
  const started = performance.now();
  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: maxTokens,
  });
  const elapsedMs = Math.round(performance.now() - started);

  const choice = response.choices[0];
  return {
    content: choice?.message?.content?.trim() ?? "",
    finishReason: choice?.finish_reason,
    usage: toUsage(response.usage),
    elapsedMs,
  };
}

export async function explainIssue(issue: Issue): Promise<string> {
  const client = createClient();

  try {
    const { content } = await complete(
      client,
      [
        { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(issue) },
      ],
      500,
    );
    if (!content) {
      throw new LlmRequestError(
        "Groq returned an empty response. Try again in a bit.",
      );
    }
    return content;
  } catch (error) {
    if (error instanceof LlmRequestError) {
      throw error;
    }
    throw new LlmRequestError(llmErrorMessage(error));
  }
}

function extractJsonArray(raw: string): string {
  const stripped = stripJsonFences(raw);
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    return stripped;
  }
  return stripped.slice(start, end + 1);
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
): Promise<ProposeFixResult> {
  const client = createClient();
  let raw = "";
  let usage: LlmUsage | null = null;
  let elapsedMs = 0;

  try {
    const completion = await complete(
      client,
      [
        { role: "system", content: FIX_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({ issue, files: fileContents }),
        },
      ],
      4000,
    );
    usage = completion.usage;
    elapsedMs = completion.elapsedMs;

    if (completion.finishReason === "length") {
      throw new LlmRequestError(
        "Response was cut off — the file may be too large for a single-file fix. Try a smaller target file.",
      );
    }

    raw = completion.content;
    if (!raw) {
      throw new LlmRequestError(
        "Groq returned an empty response. Try again in a bit.",
      );
    }
  } catch (error) {
    if (error instanceof LlmRequestError) {
      throw error;
    }
    throw new LlmRequestError(llmErrorMessage(error));
  }

  const stripped = extractJsonArray(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    throw new LlmRequestError(
      `Failed to parse fix JSON${detail}. Raw response:\n${raw}`,
    );
  }

  if (!Array.isArray(parsed) || !parsed.every(isProposedFix)) {
    throw new LlmRequestError(
      `Failed to parse fix JSON. Raw response:\n${raw}`,
    );
  }

  return { fixes: parsed, usage, elapsedMs };
}
