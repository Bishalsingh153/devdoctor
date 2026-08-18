import fs from "node:fs/promises";
import path from "node:path";
import type { Issue } from "../types.js";
import { listSourceFiles, readTextFile } from "../sourceFiles.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function errorHandlerPattern(): RegExp {
  const param = (name: string) => `\\s*${name}\\s*(?::[^,)]+)?`;
  return new RegExp(
    `\\(${param("err")},${param("req")},${param("res")},${param("next")}\\s*\\)`,
  );
}

export async function run(projectRoot: string): Promise<Issue[]> {
  const pkgPath = path.join(projectRoot, "package.json");

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as PackageJson;
  } catch {
    return [];
  }

  const hasExpress = Boolean(
    pkg.dependencies?.express || pkg.devDependencies?.express,
  );
  if (!hasExpress) {
    return [];
  }

  const pattern = errorHandlerPattern();
  const files = await listSourceFiles(projectRoot);

  for (const file of files) {
    const content = await readTextFile(file);
    if (content === null) {
      continue;
    }
    if (pattern.test(content)) {
      return [];
    }
  }

  return [
    {
      id: 0,
      title: "Missing Express error-handling middleware",
      severity: "warning",
      detail: "No (err, req, res, next) handler found",
    },
  ];
}
