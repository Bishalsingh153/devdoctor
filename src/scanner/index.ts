import { run as consoleLogLeftIn } from "./checks/consoleLogLeftIn.js";
import { run as envFileCommitted } from "./checks/envFileCommitted.js";
import { run as gitignoreGaps } from "./checks/gitignoreGaps.js";
import { run as jwtHardcodedFallback } from "./checks/jwtHardcodedFallback.js";
import { run as largeComponents } from "./checks/largeComponents.js";
import { run as missingErrorMiddleware } from "./checks/missingErrorMiddleware.js";
import { run as noTestScript } from "./checks/noTestScript.js";
import { run as outdatedDependencies } from "./checks/outdatedDependencies.js";
import { run as todoComments } from "./checks/todoComments.js";
import { run as unusedDependencies } from "./checks/unusedDependencies.js";
import { loadDevdoctorConfig } from "./config.js";
import { listSourceFiles } from "./sourceFiles.js";
import type { Issue, ScanResult } from "./types.js";

export interface ScanOptions {
  verbose?: boolean;
}

const CHECKS: { name: string; run: (projectRoot: string) => Promise<Issue[]> }[] =
  [
    { name: "noTestScript", run: noTestScript },
    { name: "unusedDependencies", run: unusedDependencies },
    { name: "todoComments", run: todoComments },
    { name: "missingErrorMiddleware", run: missingErrorMiddleware },
    { name: "largeComponents", run: largeComponents },
    { name: "jwtHardcodedFallback", run: jwtHardcodedFallback },
    { name: "envFileCommitted", run: envFileCommitted },
    { name: "outdatedDependencies", run: outdatedDependencies },
    { name: "gitignoreGaps", run: gitignoreGaps },
    { name: "consoleLogLeftIn", run: consoleLogLeftIn },
  ];

async function runCheck(
  name: string,
  run: (projectRoot: string) => Promise<Issue[]>,
  projectRoot: string,
  verbose: boolean,
): Promise<Issue[]> {
  try {
    return await run(projectRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (verbose) {
      console.error(`Check "${name}" failed:`, error);
    }
    return [
      {
        id: 0,
        title: `Check failed: ${name}`,
        severity: "warning",
        detail: message,
      },
    ];
  }
}

export async function scan(
  projectRoot: string = process.cwd(),
  options: ScanOptions = {},
): Promise<ScanResult> {
  const verbose = Boolean(options.verbose);
  const { disabledChecks } = await loadDevdoctorConfig(projectRoot);
  const disabled = new Set(disabledChecks);
  const checks = CHECKS.filter((check) => !disabled.has(check.name));
  const sourceFiles = await listSourceFiles(projectRoot);

  if (sourceFiles.length === 0) {
    return {
      critical: [],
      warnings: [],
      healthyCount: checks.length,
      note: "No source files found to scan.",
    };
  }

  const results = await Promise.all(
    checks.map((check) =>
      runCheck(check.name, check.run, projectRoot, verbose),
    ),
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

  return {
    critical,
    warnings,
    healthyCount,
    note:
      sourceFiles.length === 0
        ? "No source files found to scan."
        : undefined,
  };
}

export type { Issue, ScanResult, Severity } from "./types.js";
