import chalk from "chalk";
import type { ScanResult, Severity } from "../scanner/types.js";

export function colorBySeverity(severity: Severity, text: string): string {
  switch (severity) {
    case "critical":
      return chalk.red.bold(text);
    case "warning":
      return chalk.yellow.bold(text);
    case "healthy":
      return chalk.green.bold(text);
  }
}

export function wrapText(
  text: string,
  width = Math.max(40, (process.stdout.columns ?? 80) - 2),
): string {
  return text
    .split(/\n/)
    .map((paragraph) => wrapParagraph(paragraph.trim(), width))
    .join("\n");
}

function wrapParagraph(paragraph: string, width: number): string {
  if (paragraph.length === 0) {
    return "";
  }

  const words = paragraph.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > width && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines.join("\n");
}

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) {
    return singular;
  }
  return pluralForm ?? `${singular}s`;
}

export function printScanHeader(result: ScanResult): void {
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
  if (result.note) {
    console.log(result.note);
    console.log();
  }
}
