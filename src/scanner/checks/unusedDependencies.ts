import depcheck from "depcheck";
import type { Issue } from "../types.js";

export async function run(projectRoot: string): Promise<Issue[]> {
  const unused = await depcheck(projectRoot, {
    ignorePatterns: ["dist", "build", "node_modules", ".git"],
  });

  return unused.dependencies.map((name) => ({
    id: 0,
    title: `Unused dependency: ${name}`,
    severity: "warning" as const,
    detail: "Listed in package.json but not imported",
  }));
}
