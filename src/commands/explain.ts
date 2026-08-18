import ora from "ora";
import { ScanCacheCorruptError } from "../lib/errors.js";
import { loadLastScan } from "../scanner/cache.js";
import type { Issue } from "../scanner/types.js";
import { explainIssue } from "../lib/llm.js";
import { colorBySeverity, wrapText } from "../lib/format.js";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function findIssue(issues: Issue[], id: number): Issue | undefined {
  return issues.find((issue) => issue.id === id);
}

export async function runExplain(args: { issueId: string }): Promise<void> {
  const projectRoot = process.cwd();
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

  const id = Number.parseInt(args.issueId, 10);
  const issue = Number.isFinite(id)
    ? findIssue([...result.critical, ...result.warnings], id)
    : undefined;

  if (!issue) {
    fail(
      `No issue with id ${args.issueId}. Run \`devdoctor scan\` to see current issues.`,
    );
  }

  const spinner = ora("Asking Groq...").start();

  try {
    const explanation = await explainIssue(issue);
    spinner.clear();
    spinner.stop();

    console.log();
    console.log(colorBySeverity(issue.severity, issue.title));
    if (issue.detail) {
      console.log(issue.detail);
    }
    console.log();
    console.log(wrapText(explanation));
    console.log();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Groq could not explain this issue right now. Try again in a bit.";
    spinner.fail(message);
    process.exit(1);
  }
}
