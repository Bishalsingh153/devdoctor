import chalk from "chalk";
import type { Severity } from "../scanner/types.js";

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
