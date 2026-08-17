import fs from "node:fs/promises";
import path from "node:path";
import type { Issue } from "../scanner/types.js";
import { listSourceFiles, toRelative } from "../scanner/sourceFiles.js";

const TODO_MARKER = "TO" + "DO";
const TODO_PATTERN = new RegExp(`\\b${TODO_MARKER}\\b`, "g");

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function fileWithHighestTodoCount(
  projectRoot: string,
): Promise<string | null> {
  // Multi-file TODO cleanup is a future improvement; for now pick the single
  // most-relevant file (highest TODO count).
  const files = await listSourceFiles(projectRoot);
  let best: { relative: string; count: number } | null = null;

  for (const file of files) {
    const content = await readIfExists(file);
    if (content === null) {
      continue;
    }
    const count = content.match(TODO_PATTERN)?.length ?? 0;
    if (count > 0 && (best === null || count > best.count)) {
      best = { relative: toRelative(projectRoot, file), count };
    }
  }

  return best?.relative ?? null;
}

async function mostRelevantExpressFile(
  projectRoot: string,
): Promise<string | null> {
  // Multi-file Express wiring is a future improvement; target one likely app file.
  const files = await listSourceFiles(projectRoot);
  const scored: { relative: string; score: number }[] = [];

  for (const file of files) {
    const content = await readIfExists(file);
    if (content === null || !/\bexpress\b/.test(content)) {
      continue;
    }
    let score = 1;
    if (/\bapp\s*\.\s*use\b/.test(content)) {
      score += 2;
    }
    const relative = toRelative(projectRoot, file);
    if (/(^|\/)(app|server|index)\.[cm]?[jt]sx?$/.test(relative)) {
      score += 2;
    }
    scored.push({ relative, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.relative ?? null;
}

function pathFromIssue(issue: Issue): string | null {
  const large = issue.title.match(/^Large file:\s+(.+)$/);
  if (large?.[1]) {
    return large[1];
  }
  if (issue.title === "Hardcoded JWT secret fallback" && issue.detail) {
    return issue.detail;
  }
  return null;
}

export async function filesForIssue(
  projectRoot: string,
  issue: Issue,
): Promise<Record<string, string>> {
  let relative: string | null = null;

  if (
    issue.title === "No test script defined" ||
    issue.title === "Placeholder test script" ||
    issue.title.startsWith("Unused dependency:")
  ) {
    relative = "package.json";
  } else if (issue.title === `${TODO_MARKER} comments found`) {
    relative = await fileWithHighestTodoCount(projectRoot);
  } else if (issue.title === "Missing Express error-handling middleware") {
    relative = await mostRelevantExpressFile(projectRoot);
  } else {
    relative = pathFromIssue(issue);
  }

  if (!relative) {
    throw new Error(
      `Could not determine which file to fix for issue ${issue.id} (${issue.title}).`,
    );
  }

  const absolute = path.join(projectRoot, relative);
  const content = await readIfExists(absolute);
  if (content === null) {
    throw new Error(`Could not read ${relative} for issue ${issue.id}.`);
  }

  return { [relative]: content };
}
