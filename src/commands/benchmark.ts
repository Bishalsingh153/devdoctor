import chalk from "chalk";
import Table from "cli-table3";
import fs from "node:fs/promises";
import path from "node:path";
import ora from "ora";
import { ScanCacheCorruptError } from "../lib/errors.js";
import { filesForIssue } from "../lib/fixTargets.js";
import {
  GROQ_PRICING,
  estimateCostUsd,
  proposeFix,
} from "../lib/llm.js";
import { cacheDir, loadLastScan } from "../scanner/cache.js";
import type { Issue } from "../scanner/types.js";

const HISTORY_FILE = "benchmark-history.json";
const LARGE_ISSUE_HINT = 15;

export interface BenchmarkHistoryEntry {
  timestamp: string;
  issuesBenchmarked: number;
  totalTokens: number;
  avgTokensPerIssue: number;
  totalElapsedMs: number;
  estimatedCost: number;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function historyPath(projectRoot: string): string {
  return path.join(cacheDir(projectRoot), HISTORY_FILE);
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatUsd(value: number): string {
  if (value === 0) {
    return "$0";
  }
  if (value < 0.0001) {
    return `$${value.toExponential(2)}`;
  }
  if (value < 1) {
    return `$${value.toFixed(4)}`;
  }
  return `$${value.toFixed(2)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `~${Math.round(minutes)} min`;
  }
  const hours = minutes / 60;
  return `~${hours.toFixed(1)} h`;
}

async function loadHistory(projectRoot: string): Promise<BenchmarkHistoryEntry[]> {
  try {
    const raw = await fs.readFile(historyPath(projectRoot), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isHistoryEntry);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    if (error instanceof SyntaxError) {
      console.error("Benchmark history is corrupted. Starting a new history file.");
      return [];
    }
    throw error;
  }
}

function isHistoryEntry(value: unknown): value is BenchmarkHistoryEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.timestamp === "string" &&
    typeof row.issuesBenchmarked === "number" &&
    typeof row.totalTokens === "number" &&
    typeof row.avgTokensPerIssue === "number" &&
    typeof row.totalElapsedMs === "number" &&
    typeof row.estimatedCost === "number"
  );
}

async function appendHistory(
  projectRoot: string,
  entry: BenchmarkHistoryEntry,
): Promise<void> {
  const dir = cacheDir(projectRoot);
  await fs.mkdir(dir, { recursive: true });
  const history = await loadHistory(projectRoot);
  history.push(entry);
  await fs.writeFile(historyPath(projectRoot), `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

function printHistory(entries: BenchmarkHistoryEntry[]): void {
  if (entries.length === 0) {
    console.log("No benchmark history yet. Run `devdoctor benchmark` first.");
    return;
  }

  console.log();
  console.log(chalk.bold("DEVDOCTOR BENCHMARK HISTORY"));
  console.log();

  const table = new Table({
    head: ["When", "Issues", "Avg tokens/issue", "Est. cost"],
    style: { head: [], compact: true },
  });

  for (const entry of entries) {
    table.push([
      entry.timestamp.replace("T", " ").replace(/\.\d+Z$/, "Z"),
      String(entry.issuesBenchmarked),
      formatCount(entry.avgTokensPerIssue),
      formatUsd(entry.estimatedCost),
    ]);
  }

  console.log(table.toString());
  console.log();
}

function parseLimit(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(value) || value < 1) {
    fail("--limit must be a positive integer.");
  }
  return Math.floor(value);
}

export async function runBenchmark(args: {
  limit?: unknown;
  history?: boolean;
}): Promise<void> {
  const projectRoot = process.cwd();

  if (args.history) {
    printHistory(await loadHistory(projectRoot));
    return;
  }

  let result;
  try {
    result = await loadLastScan(projectRoot);
  } catch (error) {
    if (error instanceof ScanCacheCorruptError) {
      fail(error.message);
    }
    throw error;
  }

  if (!result) {
    fail("No scan cache found. Run `devdoctor scan` first.");
  }

  const issues: Issue[] = [...result.critical, ...result.warnings];
  if (issues.length === 0) {
    console.log("No issues in the last scan. Nothing to benchmark.");
    return;
  }

  const limit = parseLimit(args.limit);
  const selected = limit === undefined ? issues : issues.slice(0, limit);

  if (limit === undefined && issues.length > LARGE_ISSUE_HINT) {
    console.log(
      `Note: ${issues.length} issues in the last scan. Use --limit to cap the run and avoid rate limits (e.g. --limit 15).`,
    );
    console.log();
  }

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let totalElapsedMs = 0;
  let failed = 0;

  const spinner = ora().start();

  for (let index = 0; index < selected.length; index += 1) {
    const issue = selected[index];
    spinner.text = `Benchmarking issue ${index + 1}/${selected.length}...`;
    try {
      const files = await filesForIssue(projectRoot, issue);
      const { usage, elapsedMs } = await proposeFix(issue, files);
      promptTokens += usage?.promptTokens ?? 0;
      completionTokens += usage?.completionTokens ?? 0;
      totalTokens += usage?.totalTokens ?? 0;
      totalElapsedMs += elapsedMs;
    } catch {
      failed += 1;
    }
  }

  spinner.stop();

  const n = selected.length;
  const avgTokens = n === 0 ? 0 : totalTokens / n;
  const avgElapsedMs = n === 0 ? 0 : totalElapsedMs / n;
  const estimatedCost = estimateCostUsd({ promptTokens, completionTokens });
  const costPerIssue = n === 0 ? 0 : estimatedCost / n;
  const scale = 1000 / n;

  console.log();
  console.log(chalk.bold("DEVDOCTOR BENCHMARK"));
  console.log(`Benchmarked ${n} of ${issues.length} current issues`);
  if (failed > 0) {
    console.log(
      `${failed} issue${failed === 1 ? "" : "s"} failed (counted as 0 tokens; run continued)`,
    );
  }
  console.log();
  console.log(
    `Tokens:     ${formatCount(totalTokens)} total (${formatCount(avgTokens)} avg/issue)`,
  );
  console.log(
    `Time:       ${formatDuration(totalElapsedMs)} total (${formatDuration(avgElapsedMs)} avg/issue)`,
  );
  console.log(
    `Est. cost:  ${formatUsd(estimatedCost)} total (${formatUsd(costPerIssue)}/issue)`,
  );
  console.log();
  console.log(
    `Extrapolated for 1000 issues: ~${formatCount(avgTokens * 1000)} tokens, ~${formatUsd(estimatedCost * scale)}, ${formatDuration(avgElapsedMs * 1000)}`,
  );
  console.log();
  console.log(
    `Estimate uses Groq list prices for ${GROQ_PRICING.model} of $${GROQ_PRICING.inputUsdPerMillion}/1M input and $${GROQ_PRICING.outputUsdPerMillion.toFixed(2)}/1M output. Not a live quote; rates can change.`,
  );
  console.log();

  await appendHistory(projectRoot, {
    timestamp: new Date().toISOString(),
    issuesBenchmarked: n,
    totalTokens,
    avgTokensPerIssue: avgTokens,
    totalElapsedMs,
    estimatedCost,
  });
}
