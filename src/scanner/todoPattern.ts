const COMMENT_START = String.raw`(\/\/|\/\*|\*|#)`;
const MARKER = "TO" + "DO";

export const TODO_COMMENT_PATTERN = new RegExp(
  `${COMMENT_START}\\s*${MARKER}\\b`,
  "g",
);

export const TODO_ISSUE_TITLE = `${MARKER} comments found`;

export const TODO_META_FILES = new Set([
  "src/lib/llm.ts",
  "src/lib/fixTargets.ts",
]);

export function countTodoComments(content: string): number {
  TODO_COMMENT_PATTERN.lastIndex = 0;
  const matches = content.match(TODO_COMMENT_PATTERN);
  return matches?.length ?? 0;
}

export function isTodoMetaFile(relativePath: string): boolean {
  return TODO_META_FILES.has(relativePath.replaceAll("\\", "/"));
}
