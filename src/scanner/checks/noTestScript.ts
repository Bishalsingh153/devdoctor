import fs from "node:fs/promises";
import path from "node:path";
import type { Issue } from "../types.js";

interface PackageJson {
  scripts?: Record<string, string>;
}

export async function run(projectRoot: string): Promise<Issue[]> {
  const pkgPath = path.join(projectRoot, "package.json");

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as PackageJson;
  } catch {
    return [];
  }

  const testScript = pkg.scripts?.test;

  if (!testScript) {
    return [
      {
        id: 0,
        title: "No test script defined",
        severity: "critical",
        detail: 'package.json is missing a "test" script',
      },
    ];
  }

  if (testScript.includes("Error: no test specified")) {
    return [
      {
        id: 0,
        title: "Placeholder test script",
        severity: "critical",
        detail: testScript,
      },
    ];
  }

  return [];
}
