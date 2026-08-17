import { run as jwtHardcodedFallback } from "./checks/jwtHardcodedFallback.js";
import { run as largeComponents } from "./checks/largeComponents.js";
import { run as missingErrorMiddleware } from "./checks/missingErrorMiddleware.js";
import { run as noTestScript } from "./checks/noTestScript.js";
import { run as todoComments } from "./checks/todoComments.js";
import { run as unusedDependencies } from "./checks/unusedDependencies.js";
import type { Issue, ScanResult } from "./types.js";

const CHECKS = [
  noTestScript,
  unusedDependencies,
  todoComments,
  missingErrorMiddleware,
  largeComponents,
  jwtHardcodedFallback,
] as const;

export async function scan(
  projectRoot: string = process.cwd(),
): Promise<ScanResult> {
  const results = await Promise.all(
    CHECKS.map((check) => check(projectRoot)),
  );

  let nextId = 1;
  const all: Issue[] = [];

  for (const issues of results) {
    for (const issue of issues) {
      all.push({ ...issue, id: nextId });
      nextId += 1;
    }
  }

  const critical = all.filter((issue) => issue.severity === "critical");
  const warnings = all.filter((issue) => issue.severity === "warning");
  const healthyCount = results.filter((issues) => issues.length === 0).length;

  return { critical, warnings, healthyCount };
}

export type { Issue, ScanResult, Severity } from "./types.js";
