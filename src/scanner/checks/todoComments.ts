import fs from "node:fs/promises";
import type { Issue } from "../types.js";
import { listSourceFiles } from "../sourceFiles.js";

const MARKER = "TO" + "DO";
const PATTERN = new RegExp(`\\b${MARKER}\\b`, "g");

export async function run(projectRoot: string): Promise<Issue[]> {
  const files = await listSourceFiles(projectRoot);
  let count = 0;

  for (const file of files) {
    let content: string;
    try {
      content = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }
    const matches = content.match(PATTERN);
    if (matches) {
      count += matches.length;
    }
  }

  if (count === 0) {
    return [];
  }

  return [
    {
      id: 0,
      title: `${MARKER} comments found`,
      severity: "warning",
      detail: `${count} ${MARKER} comment${count === 1 ? "" : "s"}`,
    },
  ];
}
