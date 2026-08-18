import type { Issue } from "../types.js";
import { listSourceFiles, readTextFile, toRelative } from "../sourceFiles.js";
import {
  TODO_ISSUE_TITLE,
  countTodoComments,
  isTodoMetaFile,
} from "../todoPattern.js";

export async function run(projectRoot: string): Promise<Issue[]> {
  const files = await listSourceFiles(projectRoot);
  let count = 0;

  for (const file of files) {
    if (isTodoMetaFile(toRelative(projectRoot, file))) {
      continue;
    }

    const content = await readTextFile(file);
    if (content === null) {
      continue;
    }
    count += countTodoComments(content);
  }

  if (count === 0) {
    return [];
  }

  return [
    {
      id: 0,
      title: TODO_ISSUE_TITLE,
      severity: "warning",
      detail: `${count} TODO comment${count === 1 ? "" : "s"}`,
    },
  ];
}
