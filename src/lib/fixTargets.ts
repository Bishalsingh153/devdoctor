import path from "node:path";
import type { Issue } from "../scanner/types.js";
import {
  listSourceFiles,
  readTextFile,
  toRelative,
} from "../scanner/sourceFiles.js";
import {
  CONSOLE_LOG_ISSUE_TITLE,
  countConsoleLogs,
  isConsoleLogSkippedFile,
} from "../scanner/checks/consoleLogLeftIn.js";
import { ENV_COMMITTED_TITLE } from "../scanner/checks/envFileCommitted.js";
import {
  GITIGNORE_GAPS_TITLE,
  NO_GITIGNORE_TITLE,
} from "../scanner/checks/gitignoreGaps.js";
import {
  OUTDATED_DEPS_COMBINED_TITLE,
  OUTDATED_DEP_TITLE_PREFIX,
} from "../scanner/checks/outdatedDependencies.js";
import {
  TODO_ISSUE_TITLE,
  countTodoComments,
  isTodoMetaFile,
} from "../scanner/todoPattern.js";

async function readIfExists(filePath: string): Promise<string | null> {
  return readTextFile(filePath);
}

async function fileWithHighestTodoCount(
  projectRoot: string,
): Promise<string | null> {
  // Multi-file TODO cleanup is a future improvement; for now pick the single
  // most-relevant file (highest TODO count).
  const files = await listSourceFiles(projectRoot);
  let best: { relative: string; count: number } | null = null;

  for (const file of files) {
    const relative = toRelative(projectRoot, file);
    if (isTodoMetaFile(relative)) {
      continue;
    }
    const content = await readIfExists(file);
    if (content === null) {
      continue;
    }
    const count = countTodoComments(content);
    if (count > 0 && (best === null || count > best.count)) {
      best = { relative, count };
    }
  }

  return best?.relative ?? null;
}

async function fileWithHighestConsoleLogCount(
  projectRoot: string,
): Promise<string | null> {
  const files = await listSourceFiles(projectRoot);
  let best: { relative: string; count: number } | null = null;

  for (const file of files) {
    const relative = toRelative(projectRoot, file);
    if (!relative.startsWith("src/") && relative !== "src") {
      continue;
    }
    if (isConsoleLogSkippedFile(relative)) {
      continue;
    }
    const content = await readIfExists(file);
    if (content === null) {
      continue;
    }
    const count = countConsoleLogs(content);
    if (count > 0 && (best === null || count > best.count)) {
      best = { relative, count };
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
    issue.title.startsWith("Unused dependency:") ||
    issue.title.startsWith(OUTDATED_DEP_TITLE_PREFIX) ||
    issue.title === OUTDATED_DEPS_COMBINED_TITLE
  ) {
    relative = "package.json";
  } else if (issue.title === TODO_ISSUE_TITLE) {
    relative = await fileWithHighestTodoCount(projectRoot);
  } else if (issue.title === CONSOLE_LOG_ISSUE_TITLE) {
    relative = await fileWithHighestConsoleLogCount(projectRoot);
  } else if (issue.title === "Missing Express error-handling middleware") {
    relative = await mostRelevantExpressFile(projectRoot);
  } else if (
    issue.title === ENV_COMMITTED_TITLE ||
    issue.title === GITIGNORE_GAPS_TITLE ||
    issue.title === NO_GITIGNORE_TITLE
  ) {
    // Committed .env files are not sent to the model (secrets). Propose
    // .gitignore changes only; untracking is `git rm --cached` by the user.
    relative = ".gitignore";
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
  const allowMissing =
    relative === ".gitignore" &&
    (issue.title === ENV_COMMITTED_TITLE ||
      issue.title === GITIGNORE_GAPS_TITLE ||
      issue.title === NO_GITIGNORE_TITLE);

  if (content === null && !allowMissing) {
    throw new Error(`Could not read ${relative} for issue ${issue.id}.`);
  }

  return { [relative]: content ?? "" };
}
