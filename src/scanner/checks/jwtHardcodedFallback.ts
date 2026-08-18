import type { Issue } from "../types.js";
import { listSourceFiles, readTextFile, toRelative } from "../sourceFiles.js";

const PATTERN =
  /JWT_SECRET(?:\s*["'\]])?\s*(?:\)\s*)?(?:\|\||\?\?)\s*['"`]/;

export async function run(projectRoot: string): Promise<Issue[]> {
  const files = await listSourceFiles(projectRoot);
  const issues: Issue[] = [];

  for (const file of files) {
    const content = await readTextFile(file);
    if (content === null) {
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
