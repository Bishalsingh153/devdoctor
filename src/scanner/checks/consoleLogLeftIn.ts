import type { Issue } from "../types.js";
import { listSourceFiles, readTextFile, toRelative } from "../sourceFiles.js";

export const CONSOLE_LOG_ISSUE_TITLE = "console.log left in source";

const METHOD = "lo" + "g";
const CONSOLE_LOG_PATTERN = new RegExp(
  String.raw`\bconsole\.${METHOD}\s*\(`,
  "g",
);

export function countConsoleLogs(content: string): number {
  CONSOLE_LOG_PATTERN.lastIndex = 0;
  const matches = content.match(CONSOLE_LOG_PATTERN);
  return matches?.length ?? 0;
}

export function isConsoleLogSkippedFile(relativePath: string): boolean {
  const relative = relativePath.replaceAll("\\", "/");
  if (/(^|\/)cli\.[cm]?[jt]sx?$/.test(relative)) {
    return true;
  }
  if (/(^|\/)commands\//.test(relative)) {
    return true;
  }
  // Shared CLI printer (same class of intentional stdout as commands/).
  if (/(^|\/)lib\/format\.[cm]?[jt]sx?$/.test(relative)) {
    return true;
  }
  if (/(^|\/)(test|tests|__tests__)\//.test(relative)) {
    return true;
  }
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(relative)) {
    return true;
  }
  return false;
}

function isUnderSrc(relativePath: string): boolean {
  const relative = relativePath.replaceAll("\\", "/");
  return relative === "src" || relative.startsWith("src/");
}

export async function run(projectRoot: string): Promise<Issue[]> {
  const files = await listSourceFiles(projectRoot);
  let count = 0;

  for (const file of files) {
    const relative = toRelative(projectRoot, file);
    if (!isUnderSrc(relative) || isConsoleLogSkippedFile(relative)) {
      continue;
    }

    const content = await readTextFile(file);
    if (content === null) {
      continue;
    }
    count += countConsoleLogs(content);
  }

  if (count === 0) {
    return [];
  }

  return [
    {
      id: 0,
      title: CONSOLE_LOG_ISSUE_TITLE,
      severity: "warning",
      detail: `${count} console.log call${count === 1 ? "" : "s"}`,
    },
  ];
}
