import chalk from "chalk";
import Table from "cli-table3";
import fs from "node:fs/promises";
import path from "node:path";
import ora from "ora";
import { UserFacingError } from "../lib/errors.js";
import { colorBySeverity, printScanHeader } from "../lib/format.js";
import { saveLastScan } from "../scanner/cache.js";
import { ensureGitignore } from "../scanner/gitignore.js";
import { scan } from "../scanner/index.js";
import type { Issue, ScanResult } from "../scanner/types.js";

function printIssueTable(issues: Issue[], includeDetail: boolean): void {
  const table = new Table({
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: "",
    },
    style: { "padding-left": 0, "padding-right": 0, compact: true },
  });

  for (const issue of issues) {
    const title =
      includeDetail && issue.detail
        ? `${issue.title} (${issue.detail})`
        : issue.title;
    table.push([`${issue.id}. ${colorBySeverity(issue.severity, title)}`]);
  }

  console.log(table.toString());
}

function printReport(result: ScanResult): void {
  printScanHeader(result);

  if (result.critical.length > 0) {
    console.log(chalk.red.bold("CRITICAL"));
    printIssueTable(result.critical, false);
    console.log();
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow.bold("WARNINGS"));
    printIssueTable(result.warnings, true);
    console.log();
  }

  console.log("Run:");
  console.log("  devdoctor fix --interactive");
  console.log();
}

export async function runScan(
  args: Record<string, unknown> = {},
): Promise<void> {
  const projectRoot =
    typeof args.projectRoot === "string" ? args.projectRoot : process.cwd();
  const verbose = Boolean(args.verbose);

  try {
    await fs.access(path.join(projectRoot, "package.json"));
  } catch {
    throw new UserFacingError(
      "No package.json found in this directory. Run devdoctor from your project root.",
    );
  }

  const spinner = ora("Scanning project...").start();

  try {
    const result = await scan(projectRoot, { verbose });
    spinner.clear();
    spinner.stop();
    printReport(result);
    await saveLastScan(projectRoot, result);
    await ensureGitignore(projectRoot);
  } catch (error) {
    spinner.fail("Scan failed");
    throw error;
  }
}
