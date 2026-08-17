import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
import { colorBySeverity } from "../lib/format.js";
import { saveLastScan } from "../scanner/cache.js";
import { ensureGitignore } from "../scanner/gitignore.js";
import { scan } from "../scanner/index.js";
import type { Issue, ScanResult } from "../scanner/types.js";

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) {
    return singular;
  }
  return pluralForm ?? `${singular}s`;
}

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
  const { critical, warnings, healthyCount } = result;

  console.log();
  console.log(chalk.bold("DEVDOCTOR"));
  console.log();
  console.log(
    `🔴 ${critical.length} critical ${plural(critical.length, "issue")}`,
  );
  console.log(`🟠 ${warnings.length} ${plural(warnings.length, "warning")}`);
  console.log(
    `🟢 ${healthyCount} healthy ${plural(healthyCount, "check")}`,
  );
  console.log();

  if (critical.length > 0) {
    console.log(chalk.red.bold("CRITICAL"));
    printIssueTable(critical, false);
    console.log();
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow.bold("WARNINGS"));
    printIssueTable(warnings, true);
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

  const spinner = ora("Scanning project...").start();

  try {
    const result = await scan(projectRoot);
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
