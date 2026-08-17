import fs from "node:fs/promises";
import type { Issue } from "../types.js";
import { listSourceFiles, toRelative } from "../sourceFiles.js";

const PATTERN =
  /JWT_SECRET(?:\s*["'\]])?\s*(?:\)\s*)?(?:\|\||\?\?)\s*['"`]/;

export async function run(projectRoot: string): Promise<Issue[]> {
  const files = await listSourceFiles(projectRoot);
  const issues: Issue[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }

    if (PATTERN.test(content)) {
      const relativePath = toRelative(projectRoot, file);
      issues.push({
        id: 0,
        title: "Hardcoded JWT secret fallback",
        severity: "critical",
        detail: relativePath,
      });
    }
  }

  return issues;
}
