import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { createTwoFilesPatch } from "diff";
import fs from "node:fs/promises";
import path from "node:path";
import ora from "ora";
import { filesForIssue } from "../lib/fixTargets.js";
import { colorBySeverity, printScanHeader } from "../lib/format.js";
import {
  currentBranch,
  hasUncommittedChanges,
  isGitRepo,
} from "../lib/git.js";
import { ScanCacheCorruptError } from "../lib/errors.js";
import { proposeFix, type ProposedFix } from "../lib/llm.js";
import { loadLastScan, saveLastScan } from "../scanner/cache.js";
import { ensureGitignore } from "../scanner/gitignore.js";
import { scan } from "../scanner/index.js";
import type { Issue } from "../scanner/types.js";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function findIssue(issues: Issue[], id: number): Issue | undefined {
  return issues.find((issue) => issue.id === id);
}

async function confirmOrStop(message: string): Promise<void> {
  const ok = await confirm({ message, default: false });
  if (!ok) {
    process.exit(0);
  }
}

async function ensureGitSafety(projectRoot: string): Promise<void> {
  const inRepo = await isGitRepo(projectRoot);

  if (!inRepo) {
    await confirmOrStop(
      "devdoctor fix works best in a git repo so changes are easy to undo. Continue anyway?",
    );
    return;
  }

  const dirty = await hasUncommittedChanges(projectRoot);
  if (dirty) {
    const branch = await currentBranch(projectRoot);
    const branchNote = branch ? ` (on ${branch})` : "";
    await confirmOrStop(
      `You have uncommitted changes${branchNote}. Commit or stash first so fix's changes are easy to review/undo separately. Continue anyway?`,
    );
  }
}

function resolveInProject(projectRoot: string, file: string): string {
  const absolute = path.isAbsolute(file) ? file : path.join(projectRoot, file);
  const resolved = path.resolve(absolute);
  const root = path.resolve(projectRoot);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Refusing to write outside the project: ${file}`);
  }
  return resolved;
}

function printUnifiedDiff(file: string, oldContent: string, newContent: string): void {
  const patch = createTwoFilesPatch(
    file,
    file,
    oldContent,
    newContent,
    undefined,
    undefined,
    { context: 3 },
  );

  for (const line of patch.split("\n")) {
    if (line.length === 0) {
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) {
      console.log(chalk.bold(line));
    } else if (line.startsWith("+")) {
      console.log(chalk.green(line));
    } else if (line.startsWith("-")) {
      console.log(chalk.red(line));
    } else if (line.startsWith("@@")) {
      console.log(chalk.cyan(line));
    } else {
      console.log(line);
    }
  }
}

function preserveTrailingNewline(original: string, next: string): string {
  const trimmed = next.replace(/\s+$/, "");
  if (original.length === 0 || original.endsWith("\n")) {
    return `${trimmed}\n`;
  }
  return trimmed;
}

async function applyProposedFixes(
  projectRoot: string,
  originals: Record<string, string>,
  proposals: ProposedFix[],
): Promise<number> {
  if (proposals.length === 0) {
    console.log("No file changes proposed.");
    return 0;
  }

  let applied = 0;

  for (const proposal of proposals) {
    const absolute = resolveInProject(projectRoot, proposal.file);
    const relative = path.relative(projectRoot, absolute).replaceAll("\\", "/");
    const oldContent =
      originals[relative] ??
      originals[proposal.file] ??
      (await fs.readFile(absolute, "utf8").catch(() => ""));
    const newContent = preserveTrailingNewline(oldContent, proposal.newContent);

    console.log();
    console.log(chalk.bold(proposal.summary));
    console.log();
    printUnifiedDiff(relative, oldContent, newContent);
    console.log();

    const apply = await confirm({
      message: "Apply this fix?",
      default: false,
    });

    if (!apply) {
      console.log(`Skipped: ${relative}`);
      continue;
    }

    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, newContent, "utf8");
    console.log(`✅ Fixed: ${relative}`);
    applied += 1;
  }

  return applied;
}

async function fixIssue(projectRoot: string, issue: Issue): Promise<number> {
  console.log();
  console.log(colorBySeverity(issue.severity, `${issue.id}. ${issue.title}`));
  if (issue.detail) {
    console.log(issue.detail);
  }

  const originals = await filesForIssue(projectRoot, issue);
  const spinner = ora("Proposing fix...").start();

  let proposals: ProposedFix[];
  try {
    const { fixes } = await proposeFix(issue, originals);
    proposals = fixes;
    spinner.stop();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Groq could not propose a fix right now. Try again in a bit.";
    spinner.fail(message);
    throw error;
  }

  return applyProposedFixes(projectRoot, originals, proposals);
}

async function rescanAndPrint(projectRoot: string): Promise<void> {
  const spinner = ora("Re-scanning project...").start();

  try {
    const result = await scan(projectRoot);
    spinner.stop();
    printScanHeader(result);
    await saveLastScan(projectRoot, result);
    await ensureGitignore(projectRoot);
  } catch (error) {
    spinner.fail("Re-scan failed");
    throw error;
  }
}

export async function runFix(args: {
  issueId?: string;
  interactive?: boolean;
}): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error(
      "devdoctor fix requires an interactive terminal (it needs to prompt for confirmation before writing files). Run it directly in your terminal, not through a piped or non-interactive session.",
    );
    process.exit(1);
  }

  const projectRoot = process.cwd();

  try {
    await ensureGitSafety(projectRoot);

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

    const issues = [...result.critical, ...result.warnings];

    if (args.interactive) {
      if (issues.length === 0) {
        console.log("No issues in the last scan.");
        return;
      }
      let applied = 0;
      for (const issue of issues) {
        try {
          applied += await fixIssue(projectRoot, issue);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Could not fix this issue.";
          console.error(message);
        }
      }
      if (applied > 0) {
        await rescanAndPrint(projectRoot);
      }
      return;
    }

    if (!args.issueId) {
      fail("Provide an issue id, or use --interactive.");
    }

    const id = Number.parseInt(args.issueId, 10);
    const issue = Number.isFinite(id) ? findIssue(issues, id) : undefined;
    if (!issue) {
      fail(
        `No issue with id ${args.issueId}. Run \`devdoctor scan\` to see current issues.`,
      );
    }

    const applied = await fixIssue(projectRoot, issue);
    if (applied > 0) {
      await rescanAndPrint(projectRoot);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("User force closed")) {
      process.exit(0);
    }
    throw error;
  }
}
