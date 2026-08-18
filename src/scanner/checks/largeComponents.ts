import fs from "node:fs/promises";
import path from "node:path";
import type { Issue } from "../types.js";
import { listSourceFiles, readTextFile, toRelative } from "../sourceFiles.js";

const LINE_LIMIT = 500;

export async function run(projectRoot: string): Promise<Issue[]> {
  const srcDir = path.join(projectRoot, "src");
  let scanRoot = projectRoot;

  try {
    const stat = await fs.stat(srcDir);
    if (stat.isDirectory()) {
      scanRoot = srcDir;
    }
  } catch {
    scanRoot = projectRoot;
  }

  const files = await listSourceFiles(scanRoot);
  const issues: Issue[] = [];

  for (const file of files) {
    const content = await readTextFile(file);
    if (content === null) {
      continue;
    }

    const lineCount = content.split(/\r?\n/).length;
    if (lineCount > LINE_LIMIT) {
      const relativePath = toRelative(projectRoot, file);
      issues.push({
        id: 0,
        title: `Large file: ${relativePath}`,
        severity: "warning",
        detail: `${relativePath} (${lineCount} lines)`,
      });
    }
  }

  return issues;
}
